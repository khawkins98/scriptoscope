// lane:ready pre-review gate: every failure mode fails, the summary records each exit code.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { laneReady, defaultCommands, isHashOnlyBump } from './lane-ready.mjs';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..');
const node = process.execPath;
const OK = [{ name: 'noop', cmd: node, args: ['-e', ''] }];

const expectations = (over = {}) => JSON.stringify({
  schemaVersion: 1, inventoryVersion: '1.0.0', cases: [{ id: 'a', documentSha256: 'aa' }], inventorySha256: '11',
  review: { reviewers: ['independent review of 1.0.0'] }, ...over,
}, null, 2) + '\n';

/** A lane worktree with a bare origin carrying `v2` and the lane branch, both at the same commit. */
function lane() {
  const dir = mkdtempSync(join(tmpdir(), 'lane-ready-'));
  const root = join(dir, 'work');
  const g = (...a) => execFileSync('git', a, { cwd: root, stdio: 'pipe', encoding: 'utf8' }).trim();
  execFileSync('git', ['init', '-q', '--bare', join(dir, 'origin.git')]);
  mkdirSync(root);
  g('init', '-q', '-b', 'v2-L9-test');
  g('config', 'user.email', 't@t'); g('config', 'user.name', 't'); g('config', 'commit.gpgsign', 'false');
  g('remote', 'add', 'origin', join(dir, 'origin.git'));
  const write = (path, body) => { mkdirSync(dirname(join(root, path)), { recursive: true }); writeFileSync(join(root, path), body); };
  write('tests/control-availability/expectations.json', expectations());
  write('tests/rendering-requirements/families/tab.json', '{"family":"tab","review":"reviewed"}\n');
  write('tests/rendering-requirements/ledger.json', '{"scope":{"review":"reviewed"}}\n');
  write('docs/a.md', 'doc\n');
  g('add', '.'); g('commit', '-qm', 'base');
  g('push', '-q', 'origin', 'HEAD:refs/heads/v2', 'HEAD:refs/heads/v2-L9-test');
  const commitPush = (msg = 'change') => { g('add', '-A'); g('commit', '-qm', msg); g('push', '-q', 'origin', 'HEAD:refs/heads/v2-L9-test'); };
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

test('one PENDING reviewer label on a hash-only expectations bump passes with a WARN; anything more fails', () => {
  const pending = ['PENDING: independent hash-only review of 1.0.1 required before merge'];
  const t = lane();
  try {
    t.write('tests/control-availability/expectations.json', expectations({ inventoryVersion: '1.0.1', cases: [{ id: 'a', documentSha256: 'bb' }], inventorySha256: '22', review: { reviewers: pending, previousReview: { reviewers: ['independent review of 1.0.0'] } } }));
    t.commitPush('hash bump');
    let r = t.run();
    assert.equal(r.ok, true, r.summary);
    assert.equal(r.warnings.length, 1);
    assert.match(r.summary, /> WARN: .*expectations\.json:\d+: one PENDING reviewer label on a hash-only bump\. PM:/);

    t.write('tests/control-availability/expectations.json', expectations({ inventoryVersion: '1.0.1', cases: [{ id: 'a', documentSha256: 'bb', outcome: 'changed' }], inventorySha256: '22', review: { reviewers: pending } }));
    t.commitPush('not hash-only');
    r = t.run();
    assert.equal(r.ok, false);
    assert.match(rowOf(r, 'review labels').note, /not hash-only/);

    t.write('tests/control-availability/expectations.json', expectations({ inventoryVersion: '1.0.1', inventorySha256: '22', review: { reviewers: [...pending, 'PENDING second'] } }));
    t.commitPush('two labels');
    r = t.run();
    assert.equal(r.ok, false);
    assert.match(rowOf(r, 'review labels').note, /only a single PENDING reviewer label/);
  } finally { t.done(); }
});

test('isHashOnlyBump ignores only sha256 values, inventoryVersion and the review block', () => {
  const base = expectations();
  assert.equal(isHashOnlyBump(base, expectations({ inventorySha256: 'x', cases: [{ id: 'a', documentSha256: 'y' }], review: { reviewers: ['other'] }, inventoryVersion: '9' })), true);
  assert.equal(isHashOnlyBump(base, expectations({ cases: [{ id: 'b', documentSha256: 'aa' }] })), false);
  assert.equal(isHashOnlyBump(base, expectations({ schemaVersion: 2 })), false);
  assert.equal(isHashOnlyBump(null, base), false, 'a new file is never a hash-only bump');
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
    const cmds = [...OK, { name: 'typecheck', cmd: node, args: ['-e', 'process.exit(9)'], tests: true }, { name: 'npm test', cmd: node, args: ['-e', 'process.exit(9)'], tests: true }];
    t.write('docs/b.md', 'more\n'); t.write('README.md', 'x\n'); t.commitPush('docs');
    let r = t.run({ commands: cmds, skipTests: true });
    assert.equal(r.ok, true, r.summary);
    assert.match(r.summary, /\| typecheck \| SKIP: --skip-tests \(docs-only diff\) \| skipped \|/);
    assert.match(r.summary, /\| npm test \| SKIP/);
    assert.equal(t.run({ commands: cmds }).ok, false, 'without --skip-tests the failing tests run');
    t.write('scripts/x.mjs', 'export {};\n'); t.commitPush('code');
    r = t.run({ commands: cmds, skipTests: true });
    assert.equal(r.ok, false);
    assert.match(rowOf(r, '--skip-tests allowed').note, /changed outside docs\/ and \*\.md: scripts\/x\.mjs/);
  } finally { t.done(); }
});

test('the default checks are the required set; a missing Traps.h fails instead of skipping', () => {
  const names = defaultCommands({ trapsH: '/x/Traps.h', baseCommit: 'abc' }).map(c => c.name);
  assert.deepEqual(names, ['lint:cleanroom', 'gen-trap-table --check', 'report-coverage', 'build-ledger --check', 'ledger history', 'typecheck', 'npm test']);
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

test('the v2 docs workflow runs on every v2 PR (no paths filter) with the no-browser checks', () => {
  const wf = readFileSync(join(repo, '.github/workflows/v2-docs.yml'), 'utf8');
  assert.doesNotMatch(wf, /paths(-ignore)?:/);
  assert.match(wf, /pull_request:\n\s+branches: \[v2\]/);
  for (const cmd of ['node scripts/check-cleanroom.mjs', 'node scripts/gen-trap-table.mjs', 'node scripts/report-coverage.mjs', 'node tests/rendering-requirements/build-ledger.mjs --check', 'node scripts/check-ledger-history.mjs --base-commit', 'npm run ledger:sync'])
    assert.ok(wf.includes(cmd), cmd);
  assert.match(wf, /permissions:\n\s+contents: read/, 'read-only token: CI never commits the regenerated ledger');
  assert.doesNotMatch(wf, /git push|contents: write/);
});
