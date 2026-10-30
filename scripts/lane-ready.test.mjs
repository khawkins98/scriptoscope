// lane:ready pre-review gate: every failure mode fails, the summary records each exit code.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { laneReady, defaultCommands, isHashOnlyBump, findReverts } from './lane-ready.mjs';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..');
const node = process.execPath;
const OK = [{ name: 'noop', cmd: node, args: ['-e', ''] }];

const H = c => c.repeat(64);
const BASE_REVIEW = { reviewers: ['independent review of 1.0.0'], inventoryVersion: '1.0.0', inventorySha256: H('1') };
const expectations = (over = {}) => JSON.stringify({
  schemaVersion: 1, inventoryVersion: '1.0.0', cases: [{ id: 'a', documentSha256: H('a') }], inventorySha256: H('1'),
  review: BASE_REVIEW, ...over,
}, null, 2) + '\n';
/** A genuine hash-only bump to 1.0.1: new document hash, new digest, prior review archived verbatim. */
const bump = (reviewers, over = {}) => expectations({ inventoryVersion: '1.0.1', cases: [{ id: 'a', documentSha256: H('b') }], inventorySha256: H('2'), review: { reviewers, inventoryVersion: '1.0.1', inventorySha256: H('2'), previousReview: BASE_REVIEW }, ...over });

/** A lane worktree with a bare origin carrying `main` and the lane branch, both at the same commit. */
function lane() {
  const dir = mkdtempSync(join(tmpdir(), 'lane-ready-'));
  const root = join(dir, 'work');
  const g = (...a) => execFileSync('git', a, { cwd: root, stdio: 'pipe', encoding: 'utf8' }).trim();
  execFileSync('git', ['init', '-q', '--bare', join(dir, 'origin.git')]);
  mkdirSync(root);
  g('init', '-q', '-b', 'lane-L9-test');
  g('config', 'user.email', 't@t'); g('config', 'user.name', 't'); g('config', 'commit.gpgsign', 'false');
  g('remote', 'add', 'origin', join(dir, 'origin.git'));
  const write = (path, body) => { mkdirSync(dirname(join(root, path)), { recursive: true }); writeFileSync(join(root, path), body); };
  write('tests/control-availability/expectations.json', expectations());
  write('tests/rendering-requirements/families/tab.json', '{"family":"tab","review":"reviewed"}\n{"row":"independent integration review pending."}\n');
  write('tests/rendering-requirements/ledger.json', '{"scope":{"review":"reviewed"}}\n');
  write('docs/a.md', 'doc\n');
  g('add', '.'); g('commit', '-qm', 'base');
  g('push', '-q', 'origin', 'HEAD:refs/heads/main');
  g('push', '-q', '-u', 'origin', 'HEAD:refs/heads/lane-L9-test');
  const commitPush = (msg = 'change') => { g('add', '-A'); g('commit', '-qm', msg); g('push', '-q', 'origin', 'HEAD:refs/heads/lane-L9-test'); };
  const run = (opts = {}) => laneReady({ root, commands: OK, ...opts });
  return { root, g, write, commitPush, run, done: () => rmSync(dir, { recursive: true, force: true }) };
}
const rowOf = (r, name) => r.rows.find(x => x.name.startsWith(name));

test('a clean, pushed head with passing checks passes and the summary names the commit and exit codes', () => {
  const t = lane();
  try {
    const r = t.run({ commands: [...OK, { name: 'second', cmd: node, args: ['-e', 'process.exit(0)'] }] });
    assert.equal(r.ok, true, r.summary);
    assert.match(r.summary, /^### lane:ready: PASS/);
    assert.ok(r.summary.includes(`\`${t.g('rev-parse', 'HEAD')}\``));
    assert.match(r.summary, /\| noop \| pass \| 0 \|/);
    assert.match(r.summary, /\| second \| pass \| 0 \|/);
    assert.match(r.summary, /merge-base `[0-9a-f]{40}`/);
  } finally { t.done(); }
});

test('a dirty worktree fails (tracked edit or untracked file)', () => {
  const t = lane();
  try {
    t.write('untracked.txt', 'x');
    let r = t.run();
    assert.equal(r.ok, false);
    assert.equal(rowOf(r, 'worktree clean').ok, false);
    assert.match(r.summary, /^### lane:ready: FAIL/);
    rmSync(join(t.root, 'untracked.txt'));
    t.write('docs/a.md', 'edited\n');
    r = t.run();
    assert.equal(rowOf(r, 'worktree clean').ok, false);
    assert.match(rowOf(r, 'worktree clean').note, /docs\/a\.md/);
  } finally { t.done(); }
});

test('an unpushed HEAD fails, and so does a pushed head that differs from HEAD', () => {
  const t = lane();
  try {
    t.write('docs/a.md', 'local only\n'); t.g('commit', '-qam', 'local');
    let r = t.run();
    assert.equal(r.ok, false);
    assert.match(rowOf(r, 'pushed head').note, /differs from HEAD/);
    t.g('checkout', '-q', '-b', 'never-pushed');
    r = t.run();
    assert.equal(r.ok, false);
    assert.match(rowOf(r, 'pushed head').note, /HEAD is not pushed: origin has no branch never-pushed/);
  } finally { t.done(); }
});

test('the pushed-head check uses the upstream (@{u}), and an upstream equal to the base fails', () => {
  const t = lane();
  try {
    t.g('branch', '--unset-upstream');
    let r = t.run();
    assert.equal(rowOf(r, 'pushed head').ok, true, 'falls back to origin/<branch>');
    assert.match(rowOf(r, 'pushed head').name, /no upstream/);
    assert.ok(r.warnings.some(w => /has no upstream/.test(w)));
    // Local branch name differs from the remote branch it tracks.
    t.g('branch', '-m', 'local-name');
    t.g('branch', '--set-upstream-to', 'origin/lane-L9-test');
    r = t.run();
    assert.equal(rowOf(r, 'pushed head').ok, true, r.summary);
    assert.match(rowOf(r, 'pushed head').name, /origin\/lane-L9-test\)/);
    t.write('docs/a.md', 'ahead\n'); t.g('commit', '-qam', 'ahead');
    assert.match(rowOf(t.run(), 'pushed head').note, /differs from HEAD/);
    t.g('push', '-q', 'origin', 'HEAD:refs/heads/lane-L9-test');
    assert.equal(rowOf(t.run(), 'pushed head').ok, true);
    // Tracking a local branch ('.' remote) falls back to origin/<branch> with a WARN.
    t.g('branch', 'local-base'); t.g('branch', '--set-upstream-to', 'local-base');
    r = t.run();
    assert.ok(r.warnings.some(w => /tracks a local branch \(refs\/heads\/local-base\)/.test(w)), r.summary);
    assert.match(rowOf(r, 'pushed head').name, /origin\/local-name, no upstream/);
    // A worktree made with `-b x origin/main` tracks main itself: that is not the lane branch.
    t.g('fetch', '-q', 'origin'); t.g('branch', '--set-upstream-to', 'origin/main');
    r = t.run();
    assert.equal(rowOf(r, 'pushed head').ok, false);
    assert.match(rowOf(r, 'pushed head').note, /the upstream is the base branch main/);
  } finally { t.done(); }
});

test('leftover review labels in families, ledger.json or expectations.json fail', () => {
  for (const [path, body] of [
    ['tests/rendering-requirements/families/tab.json', '{"family":"tab","review":"PENDING independent review"}\n'],
    ['tests/rendering-requirements/families/sub/x.json', '{"note":"Awaiting independent review"}\n'],
    ['tests/rendering-requirements/ledger.json', '{"status":"PROPOSED verified"}\n'],
    ['tests/control-availability/expectations.json', expectations({ policy: 'Awaiting independent review' })],
  ]) {
    const t = lane();
    try {
      t.write(path, body); t.commitPush();
      const r = t.run();
      assert.equal(r.ok, false, path);
      assert.equal(rowOf(r, 'review labels').ok, false, path);
      assert.ok(rowOf(r, 'review labels').note.includes(path), r.summary);
    } finally { t.done(); }
  }
});

test('label matching is case-insensitive on new lines and catches PENDING_REVIEW; carried prose passes', () => {
  const t = lane();
  try {
    assert.equal(t.run().ok, true, 'the base already carries "review pending" prose');
    for (const row of ['{"row":"pending independent review"}', '{"row":"PENDING_REVIEW"}', '{"row":"Awaiting Independent Review"}', '{"row":"proposed verified"}']) {
      t.write('tests/rendering-requirements/families/tab.json', `{"family":"tab","review":"reviewed"}\n{"row":"independent integration review pending."}\n${row}\n`);
      t.commitPush(row);
      const r = t.run();
      assert.equal(r.ok, false, row);
      assert.match(rowOf(r, 'review labels').note, /families\/tab\.json:3/, row);
    }
  } finally { t.done(); }
});

test('recorded history is skipped: transition replaced rows and the frozen 1.22.0 scope.review', () => {
  const t = lane();
  try {
    const frozen = 'final digest reflects only replacement of pending review labels';
    const transition = row => JSON.stringify({ version: '1.0.1', priorVersion: '1.0.0', resultSha256: {}, replaced: { assessments: [{ index: 0, row }] }, summary: 'reword stale labels', review: 'reviewed' });
    const family = (tline, extra = '') => `{\n  "family": "tab",\n  "transitions": [\n    ${tline}\n  ],\n  "rows": [\n    {"row":"reworded"}${extra}\n  ]\n}\n`;
    t.write('tests/rendering-requirements/families/_base.json', JSON.stringify({ scope: { review: frozen } }, null, 2) + '\n');
    t.write('tests/rendering-requirements/families/tab.json', family(transition({ note: 'PENDING: independent review; integration review pending.' })));
    t.write('tests/rendering-requirements/ledger.json', JSON.stringify({ scope: { review: `At the 1.22.0 split: ${frozen} Post-split changes carry their own review.` } }, null, 2) + '\n');
    t.commitPush('history');
    let r = t.run();
    assert.equal(r.ok, true, r.summary);
    t.write('tests/rendering-requirements/families/tab.json', family(JSON.stringify({ version: '1.0.1', priorVersion: '1.0.0', resultSha256: {}, replaced: {}, summary: 'review pending' })));
    t.commitPush('label in a transition summary');
    r = t.run();
    assert.equal(r.ok, false, 'only replaced is skipped, not the summary');
    t.write('tests/rendering-requirements/families/tab.json', family(transition({ note: 'old' }), ',\n    {"row":"PENDING"}'));
    t.commitPush('live row');
    assert.equal(t.run().ok, false, 'a live row is still scanned');
    t.write('tests/rendering-requirements/families/tab.json', family(transition({ note: 'old' })));
    t.write('tests/rendering-requirements/ledger.json', JSON.stringify({ scope: { review: `At the 1.22.0 split: ${frozen} Then: review pending.` } }, null, 2) + '\n');
    t.commitPush('ledger label outside the frozen text');
    r = t.run();
    assert.equal(r.ok, false);
    assert.match(rowOf(r, 'review labels').note, /ledger\.json/);
  } finally { t.done(); }
});

test('one PENDING reviewer label on a hash-only expectations bump passes with a WARN; anything more fails', () => {
  const pending = ['PENDING: independent hash-only review of 1.0.1 required before merge'];
  const t = lane();
  try {
    t.write('tests/control-availability/expectations.json', bump(pending));
    t.commitPush('hash bump');
    let r = t.run();
    assert.equal(r.ok, true, r.summary);
    assert.equal(r.warnings.length, 1);
    assert.match(r.summary, /> WARN: .*expectations\.json:\d+: one PENDING reviewer label on a hash-only bump\. PM:/);

    t.write('tests/control-availability/expectations.json', bump(pending, { cases: [{ id: 'a', documentSha256: H('b'), outcome: 'changed' }] }));
    t.commitPush('not hash-only');
    r = t.run();
    assert.equal(r.ok, false);
    assert.match(rowOf(r, 'review labels').note, /not hash-only/);

    t.write('tests/control-availability/expectations.json', bump([...pending, 'PENDING second']));
    t.commitPush('two labels');
    r = t.run();
    assert.equal(r.ok, false);
    assert.match(rowOf(r, 'review labels').note, /only a single PENDING reviewer label/);
  } finally { t.done(); }
});

test('isHashOnlyBump ignores only sha256 values, inventoryVersion and the review block', () => {
  const base = expectations();
  assert.equal(isHashOnlyBump(base, bump(['x'])), true);
  assert.equal(isHashOnlyBump(base, expectations({ review: { ...BASE_REVIEW, reviewers: ['relabelled'] } })), true, 'same-version relabel');
  assert.equal(isHashOnlyBump(base, expectations({ cases: [{ id: 'b', documentSha256: H('a') }] })), false);
  assert.equal(isHashOnlyBump(base, expectations({ schemaVersion: 2 })), false);
  assert.equal(isHashOnlyBump(base, bump(['x'], { cases: [{ id: 'a', documentSha256: 'not-a-hash' }] })), false, 'a sha256 value must be 64 hex');
  assert.equal(isHashOnlyBump(base, bump(['x'], { cases: [{ id: 'a', documentSha256: H('b'), payloadSha256: { evil: true } }] })), false, 'a new sha256 key is not hash-only');
  assert.equal(isHashOnlyBump(base, bump(['x'], { cases: [{ id: 'a', documentSha256: H('b'), payloadSha256: H('c') }] })), false, 'an added hash key changes the key set');
  assert.equal(isHashOnlyBump(base, bump(['x'], { review: { reviewers: ['x'], approves: 'everything', previousReview: BASE_REVIEW } })), false, 'unknown review keys');
  assert.equal(isHashOnlyBump(base, bump(['x'], { review: { reviewers: ['x'], inventoryVersion: '1.0.1', inventorySha256: H('2') } })), false, 'the prior review must be archived');
  assert.equal(isHashOnlyBump(base, bump(['x'], { review: { reviewers: ['x'], inventoryVersion: '1.0.9', inventorySha256: H('2'), previousReview: BASE_REVIEW } })), false, 'review version must match');
  assert.equal(isHashOnlyBump(null, base), false, 'a new file is never a hash-only bump');
});

/** Lane fixture helpers for the silent-revert check: advance origin/main, rebuild the lane. */
function withBase(t) {
  const src = lines => lines.map(l => `export const ${l} = '${l} value';\n`).join('');
  const advance = (path, body, msg) => {
    t.g('fetch', '-q', 'origin'); t.g('checkout', '-q', '--detach', 'origin/main');
    t.write(path, body); t.g('add', '-A'); t.g('commit', '-qm', msg); t.g('push', '-q', 'origin', 'HEAD:refs/heads/main');
    const sha = t.g('rev-parse', 'HEAD');
    t.g('checkout', '-q', 'lane-L9-test');
    return sha;
  };
  /** Re-parent the lane head's tree onto origin/main (the #440 shape: old tree, new parent). */
  const reparent = (msg = 'stale tree, new parent') => {
    t.g('fetch', '-q', 'origin');
    const c = t.g('commit-tree', t.g('rev-parse', 'HEAD^{tree}'), '-p', 'origin/main', '-m', msg);
    t.g('reset', '-q', '--hard', c); t.g('push', '-q', '-f', 'origin', 'HEAD:refs/heads/lane-L9-test');
  };
  const rebase = () => { t.g('fetch', '-q', 'origin'); t.g('rebase', '-q', 'origin/main'); t.g('push', '-q', '-f', 'origin', 'HEAD:refs/heads/lane-L9-test'); };
  return { src, advance, reparent, rebase };
}

test('a branch whose diff undoes a base commit fails and names the file and the commit', () => {
  const t = lane();
  try {
    const { src, advance, reparent } = withBase(t);
    t.write('src/x.mjs', src(['alpha', 'bravo', 'charlie', 'delta'])); t.commitPush('add x');
    t.g('push', '-q', 'origin', 'HEAD:refs/heads/main');
    // Lane work on its own file; meanwhile the base adds lines to src/x.mjs and a new file.
    t.write('src/lane.mjs', src(['lane'])); t.commitPush('lane work');
    const added = advance('src/x.mjs', src(['alpha', 'bravo', 'baseOnlyFeature', 'charlieV2', 'delta']), 'feat: base adds a line and renames one (#900)');
    t.write('src/new.mjs', src(['brandNew']));
    const newFile = advance('docs/a.md', 'doc\nthe base documents its new file here\n', 'feat: base adds a file (#901)');
    reparent();
    let r = t.run();
    assert.equal(r.ok, false, r.summary);
    const row = rowOf(r, 'no silent reverts');
    assert.equal(row.ok, false);
    assert.match(row.note, /^3 revert\(s\); first: /);
    const found = findReverts(t.root, t.g('merge-base', 'HEAD', 'origin/main'));
    assert.deepEqual(found.map(f => [f.file, f.commit]).sort(), [['docs/a.md', newFile], ['src/new.mjs', newFile], ['src/x.mjs', added]]);
    assert.ok(found.every(f => /\(#90[01]\)/.test(f.subject)));
    // Hunk form: the stale file also carries the lane's own edit, so its blob matches nothing.
    t.write('src/x.mjs', src(['alphaEdited', 'bravo', 'charlie', 'delta'])); t.commitPush('edit a stale copy');
    r = t.run();
    assert.equal(rowOf(r, 'no silent reverts').ok, false);
    const hunk = findReverts(t.root, t.g('merge-base', 'HEAD', 'origin/main')).find(f => f.file === 'src/x.mjs');
    assert.equal(hunk?.commit, added);
    assert.equal(hunk.how, 'undoes its 1 hunk(s)');
    // A deliberate revert passes when named.
    assert.equal(rowOf(t.run({ allowRevert: [added.slice(0, 10), newFile] }), 'no silent reverts').ok, true);
  } finally { t.done(); }
});

test('stacked base commits on the same line are measured at the merge-base (the #435 then #438 shape)', () => {
  const t = lane();
  try {
    const { src, advance, reparent } = withBase(t);
    const file = ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot'];
    t.write('src/x.mjs', src(file)); t.commitPush('add x'); t.g('push', '-q', 'origin', 'HEAD:refs/heads/main');
    const c1 = advance('src/x.mjs', src(['alpha', 'bravoFirstWording', 'charlie', 'delta', 'echo', 'foxtrot']), 'docs: first wording (#935)');
    advance('src/x.mjs', src(['alpha', 'bravoSecondWording', 'charlie', 'delta', 'echo', 'foxtrot']), 'docs: reword (#938)');
    // The lane carries the pre-c1 file plus an unrelated edit, so no blob matches.
    t.write('src/x.mjs', src(['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrotLane'])); t.commitPush('lane edit');
    reparent();
    const r = t.run();
    assert.equal(rowOf(r, 'no silent reverts').ok, false, r.summary);
    const found = findReverts(t.root, t.g('merge-base', 'HEAD', 'origin/main'));
    assert.ok(found.some(f => f.file === 'src/x.mjs' && f.commit === c1 && /undoes its 1 hunk/.test(f.how)), JSON.stringify(found));
  } finally { t.done(); }
});

test('a lane line next to a restored hunk still counts as a revert', () => {
  const t = lane();
  try {
    const { src, advance, reparent } = withBase(t);
    t.write('src/x.mjs', src(['alpha', 'bravo', 'charlie', 'delta', 'echo'])); t.commitPush('add x'); t.g('push', '-q', 'origin', 'HEAD:refs/heads/main');
    const c = advance('src/x.mjs', src(['alpha', 'bravo', 'charlieV2', 'delta', 'echo']), 'fix: base rewords charlie');
    // Stale charlie plus a new lane line right after it: git merges both into one hunk.
    t.write('src/x.mjs', src(['alpha', 'bravo', 'charlie', 'laneLine', 'delta', 'echo'])); t.commitPush('lane adds a line');
    reparent();
    const r = t.run();
    assert.equal(rowOf(r, 'no silent reverts').ok, false, r.summary);
    assert.match(rowOf(r, 'no silent reverts').note, new RegExp(`src/x\\.mjs undoes its 1 hunk\\(s\\) ${c.slice(0, 12)}`));
  } finally { t.done(); }
});

test('a normal branch rebased on the base passes the revert check', () => {
  const t = lane();
  try {
    const { src, advance, rebase } = withBase(t);
    t.write('src/x.mjs', src(['alpha', 'bravo', 'charlie'])); t.commitPush('add x'); t.g('push', '-q', 'origin', 'HEAD:refs/heads/main');
    t.write('src/lane.mjs', src(['lane'])); t.write('src/x.mjs', src(['alpha', 'bravo', 'charlie', 'laneAddition'])); t.commitPush('lane work');
    advance('src/x.mjs', src(['alpha', 'baseOnlyFeature', 'bravo', 'charlie']), 'feat: base adds a line');
    advance('docs/a.md', 'doc\nmore base docs\n', 'docs: base');
    const before = t.run();
    assert.equal(rowOf(before, 'no silent reverts').ok, true, 'an unrebased branch does not undo commits after its merge-base');
    rebase();
    const r = t.run();
    assert.equal(r.ok, true, r.summary);
    assert.equal(rowOf(r, 'no silent reverts').ok, true);
  } finally { t.done(); }
});

test('editing a file the base also changed, without restoring its old lines, passes', () => {
  const t = lane();
  try {
    const { src, advance, rebase } = withBase(t);
    t.write('src/x.mjs', src(['alpha', 'bravo', 'charlie', 'delta'])); t.commitPush('add x'); t.g('push', '-q', 'origin', 'HEAD:refs/heads/main');
    advance('src/x.mjs', src(['alpha', 'bravoRenamed', 'charlie', 'baseOnlyFeature', 'delta']), 'refactor: base renames and adds');
    rebase();
    // Rewrites a line the base replaced (new text, not the pre-change text) and edits others.
    t.write('src/x.mjs', src(['alphaLane', 'bravoRenamedAgain', 'charlie', 'baseOnlyFeature', 'delta', 'echo'])); t.commitPush('lane edits x');
    const r = t.run();
    assert.equal(r.ok, true, r.summary);
    // But putting the base's pre-change line back is a revert, even mixed with other edits.
    t.write('src/x.mjs', src(['alphaLane', 'bravo', 'charlie', 'baseOnlyFeature', 'delta', 'echo'])); t.commitPush('restore bravo');
    assert.equal(rowOf(t.run(), 'no silent reverts').ok, true, 'only part of the base hunk is undone');
    t.write('src/x.mjs', src(['alphaLane', 'bravo', 'charlie', 'delta', 'echo'])); t.commitPush('undo both');
    assert.equal(rowOf(t.run(), 'no silent reverts').ok, false, 'every base hunk undone');
    // Deleting exactly the lines a base commit only added is removal, not a restore: weak alone.
    advance('src/z.mjs', src(['one', 'two', 'three', 'four']), 'feat: base adds z');
    const addOnly = advance('src/z.mjs', src(['one', 'two', 'baseAddedBlock', 'baseAddedBlockToo', 'three', 'four']), 'feat: base adds a block');
    rebase();
    t.write('src/z.mjs', src(['one', 'two', 'three', 'fourEdited'])); t.commitPush('remove the block on purpose');
    const why = findReverts(t.root, t.g('merge-base', 'HEAD', 'origin/main'));
    assert.ok(!why.some(f => f.commit === addOnly), 'pure deletion of added lines is not flagged alone');
  } finally { t.done(); }
});

test('a branch commit saying "This reverts commit <sha>" makes that revert deliberate', () => {
  const t = lane();
  try {
    const { src, advance, rebase } = withBase(t);
    t.write('src/y.mjs', src(['oops', 'mistake']));
    const c = advance('docs/a.md', 'doc\nwiring for the mistaken module\n', 'feat: a mistake');
    rebase();
    t.g('revert', '--no-edit', c); t.g('push', '-q', 'origin', 'HEAD:refs/heads/lane-L9-test');
    assert.equal(rowOf(t.run(), 'no silent reverts').ok, true, t.run().summary);
    t.g('commit', '-q', '--amend', '-m', 'drop y');
    t.g('push', '-q', '-f', 'origin', 'HEAD:refs/heads/lane-L9-test');
    assert.equal(rowOf(t.run(), 'no silent reverts').ok, false, 'an unmarked revert fails');
    // A deleted file alone is not evidence (removing a recent file is often deliberate).
    t.write('docs/a.md', 'doc\nwiring for the mistaken module\n'); t.g('commit', '-q', '--amend', '-am', 'drop y only');
    t.g('push', '-q', '-f', 'origin', 'HEAD:refs/heads/lane-L9-test');
    assert.equal(rowOf(t.run(), 'no silent reverts').ok, true, 'an uncorroborated deletion passes');
  } finally { t.done(); }
});

test('a failing check fails the run and records its own exit code; a check that dirties the tree fails', () => {
  const t = lane();
  try {
    let r = t.run({ commands: [...OK, { name: 'broken', cmd: node, args: ['-e', 'console.error("boom"); process.exit(3)'] }, { name: 'after', cmd: node, args: ['-e', ''] }] });
    assert.equal(r.ok, false);
    assert.match(r.summary, /\| broken \| FAIL: see output above \| 3 \|/);
    assert.match(r.summary, /\| after \| pass \| 0 \|/, 'later checks still run');
    r = t.run({ commands: [{ name: 'writer', cmd: node, args: ['-e', 'require("fs").writeFileSync("junk.txt","x")'] }] });
    assert.equal(r.ok, false);
    assert.match(rowOf(r, 'worktree still clean').note, /junk\.txt/);
  } finally { t.done(); }
});

test('--skip-tests skips typecheck and npm test only for docs-only diffs', () => {
  const t = lane();
  try {
    const cmds = [...OK, { name: 'docs-pinned tests', cmd: node, args: ['-e', 'process.exit(0)'], docsOnly: true }, { name: 'typecheck', cmd: node, args: ['-e', 'process.exit(9)'], tests: true }, { name: 'npm test', cmd: node, args: ['-e', 'process.exit(9)'], tests: true }];
    t.write('docs/b.md', 'more\n'); t.write('README.md', 'x\n'); t.commitPush('docs');
    let r = t.run({ commands: cmds, skipTests: true });
    assert.equal(r.ok, true, r.summary);
    assert.match(r.summary, /\| typecheck \| SKIP: --skip-tests \(docs-only diff\) \| skipped \|/);
    assert.match(r.summary, /\| npm test \| SKIP/);
    assert.match(r.summary, /\| docs-pinned tests \| pass \| 0 \|/, 'doc-hash pins still run under --skip-tests');
    assert.equal(t.run({ commands: cmds.map(c => (c.docsOnly ? { ...c, args: ['-e', 'process.exit(4)'] } : c)), skipTests: true }).ok, false, 'a failing doc pin fails a docs-only run');
    assert.doesNotMatch(t.run({ commands: cmds }).summary, /docs-pinned tests/, 'full runs cover them through npm test');
    assert.equal(t.run({ commands: cmds }).ok, false, 'without --skip-tests the failing tests run');
    t.write('scripts/x.mjs', 'export {};\n'); t.commitPush('code');
    r = t.run({ commands: cmds, skipTests: true });
    assert.equal(r.ok, false);
    assert.match(rowOf(r, '--skip-tests allowed').note, /changed outside docs\/ and \*\.md: scripts\/x\.mjs/);
  } finally { t.done(); }
});

test('the default checks are the required set; a missing Traps.h fails instead of skipping', () => {
  const names = defaultCommands({ trapsH: '/x/Traps.h', baseCommit: 'abc' }).map(c => c.name);
  assert.deepEqual(names, ['lint:cleanroom', 'gen-trap-table --check', 'report-coverage', 'build-ledger --check', 'ledger history', 'engine-diff', 'validate-source', 'docs-pinned tests', 'typecheck', 'npm test']);
  const pinned = defaultCommands({ trapsH: null, baseCommit: 'abc', root: repo }).find(c => c.name === 'docs-pinned tests').args;
  for (const f of ['tests/control-availability/validate-source.test.mjs', 'tests/source-inputs/routine-coverage.test.mjs', 'tests/reference-captures/contract.test.mjs', 'tests/rendering-options/checkable-rules.test.mjs']) assert.ok(pinned.includes(f), f);
  const t = lane();
  try {
    const trap = defaultCommands({ trapsH: null, baseCommit: 'abc' }).filter(c => c.name.startsWith('gen-trap'));
    const r = t.run({ commands: trap });
    assert.equal(r.ok, false);
    assert.match(r.summary, /\| gen-trap-table --check \| FAIL: no Traps\.h: pass --traps-h <path> or set SCRIPTOSCOPE_TRAPS_H \| not run \|/);
  } finally { t.done(); }
});

test('package.json wires lane:ready and ledger:sync, and gates keeps lint:cleanroom', () => {
  const { scripts } = JSON.parse(readFileSync(join(repo, 'package.json'), 'utf8'));
  assert.equal(scripts['lane:ready'], 'node scripts/lane-ready.mjs');
  assert.match(scripts['ledger:sync'], /build-ledger\.mjs --write && node tests\/rendering-requirements\/build-ledger\.mjs --check/);
  assert.match(scripts.gates, /npm run lint:cleanroom/);
  assert.match(scripts.test, /scripts\/\*\.test\.mjs/);
});

test('the docs + ledger workflow runs on every main PR and push (no paths filter) with the no-browser checks', () => {
  const wf = readFileSync(join(repo, '.github/workflows/v2-docs.yml'), 'utf8');
  assert.doesNotMatch(wf, /paths(-ignore)?:/);
  assert.match(wf, /pull_request:\n\s+branches: \[main\]/);
  assert.match(wf, /push:\n\s+branches: \[main\]/);
  for (const cmd of ['node scripts/check-cleanroom.mjs', 'node scripts/gen-trap-table.mjs', 'node scripts/report-coverage.mjs', 'node tests/rendering-requirements/build-ledger.mjs --check', 'node scripts/check-ledger-history.mjs --base-commit', 'npm run ledger:sync', 'node tests/engine-diff/run.mjs --check --base-commit "$BASE_SHA"', 'node tests/control-availability/validate-source.mjs', 'npm test', 'node tests/engine-diff/run.mjs --check --base-commit "$BASE_SHA"', '--root "$GITHUB_WORKSPACE"', 'git fetch --no-tags origin "$BEFORE"', '0000000000000000000000000000000000000000'])
    assert.ok(wf.includes(cmd), cmd);
  assert.match(wf, /permissions:\n\s+contents: read/, 'read-only token: CI never commits the regenerated ledger');
  assert.doesNotMatch(wf, /git push|contents: write/);
  assert.doesNotMatch(wf, /secrets\./, 'no Traps.h secret (maintainer decision): CI checks the trap table structure only');
});

test('CI builds the Pages demo and loader after the library build, without deploying', () => {
  const wf = readFileSync(join(repo, '.github/workflows/ci.yml'), 'utf8');
  const lib = wf.indexOf('run: npm run build\n'), demo = wf.indexOf('run: npm run build:demo');
  assert.ok(lib > 0 && demo > lib, 'build:demo runs after the library build');
  assert.doesNotMatch(wf, /deploy-pages|upload-pages-artifact/);
});
