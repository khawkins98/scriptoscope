// Engine diff gate: the committed baselines are the head's output, the pure
// compare() enforces every rule, and an injected change to the engine's inputs
// is caught for each family through the real engine (the src mutation probes
// are recorded in the PR; tests must not edit src/).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { computeFamily, compare, ruleIds, declaredFromBody, baselinePath, expectedPath } from './run.mjs';
import { FAMILIES } from './cases.mjs';

const committed = f => JSON.parse(readFileSync(baselinePath(f), 'utf8')).cells;
const subset = (cells, slug) => Object.fromEntries(Object.entries(cells).filter(([k]) => k.startsWith(`${slug}/`)));

test('the committed baselines are the head output for every family (run npm run engine-diff:write after blessing)', async () => {
  for (const family of Object.keys(FAMILIES)) {
    const head = await computeFamily(family);
    assert.ok(Object.keys(head).length > 1000, `${family}: ${Object.keys(head).length} cells`);
    assert.deepEqual(head, committed(family), family);
    const expected = JSON.parse(readFileSync(expectedPath(family), 'utf8'));
    assert.equal(expected.family, family);
    assert.ok(Array.isArray(expected.entries));
  }
});

test('rule ids come from the family spec decision tables', () => {
  const sb = ruleIds(FAMILIES.scrollbar.rules), w = ruleIds(FAMILIES.window.rules);
  for (const id of ['TR3', 'TF8', 'AC2', 'T5']) assert.ok(sb.has(id), id);
  for (const id of ['W2', 'W3', 'T1']) assert.ok(w.has(id), id);
  assert.ok(!w.has('TR3'), 'scroll-bar rows are not window rules');
});

test('compare: unlisted, mis-blessed, undeclared, bad rule and stale entries fail; blessed and inert pass', () => {
  const rules = new Set(['W2', 'W3']);
  const base = { a: '1', b: '2', c: '3' }, head = { a: '1', b: '9', d: '4' };
  let r = compare({ family: 'window', base, head, rules });
  assert.deepEqual(r.diffs.map(d => d.key), ['b', 'c', 'd']);
  assert.equal(r.errors.filter(e => /not listed/.test(e)).length, 3);
  const bless = [
    { key: 'b', rule: 'W2', sha256: '9', why: 'tile from the far end' },
    { key: 'c', rule: 'W3', sha256: null, why: 'type dropped from the matrix' },
    { key: 'd', rule: 'W3', sha256: '4', why: 'new size' },
  ];
  assert.deepEqual(compare({ family: 'window', base, head, rules, expected: bless }).errors, []);
  assert.match(compare({ family: 'window', base, head, rules, expected: bless, declared: false }).errors.join('\n'), /does not declare "engine-diff: window"/);
  r = compare({ family: 'window', base, head, rules, expected: bless.map(e => (e.key === 'b' ? { ...e, sha256: '8' } : e)) });
  assert.match(r.errors.join('\n'), /b changed to 9, but expected\/window\.json blesses 8/);
  r = compare({ family: 'window', base, head, rules, expected: bless.map(e => (e.key === 'b' ? { ...e, rule: 'TR3' } : e)) });
  assert.match(r.errors.join('\n'), /names rule "TR3", not a decision-table row/);
  r = compare({ family: 'window', base, head, rules, expected: bless.map(e => (e.key === 'b' ? { ...e, why: '' } : e)) });
  assert.match(r.errors.join('\n'), /needs a one-sentence why/);
  r = compare({ family: 'window', base: head, head, rules, expected: bless });
  assert.deepEqual(r.errors, [], 'entries already merged are inert');
  assert.deepEqual(r.inert.sort(), ['b', 'c', 'd']);
  r = compare({ family: 'window', base, head: base, rules, expected: [{ key: 'a', rule: 'W2', sha256: '7', why: 'x' }] });
  assert.match(r.errors.join('\n'), /blesses 7, but the cell is unchanged at 1/);
});

test('injected change, window: a moved recipe boundary is caught, and passes only once blessed', async () => {
  const flip = (wt, { type }) => {
    if (type === 'document-window') { const cell = wt.edges.top.find(c => c.at > 0); cell.at += 2; }
    return wt;
  };
  const head = await computeFamily('window', { slugs: ['animals'], mutate: flip });
  const base = subset(committed('window'), 'animals');
  const rules = ruleIds(FAMILIES.window.rules);
  const r = compare({ family: 'window', base, head, rules });
  assert.ok(r.diffs.length >= 12, `${r.diffs.length} cells changed`);
  assert.ok(r.diffs.every(d => d.key.startsWith('animals/document-window/')), 'only the mutated type changes');
  assert.ok(r.errors.length >= r.diffs.length);
  const expected = r.diffs.map(d => ({ key: d.key, rule: 'W3', sha256: d.to, why: 'injected test change' }));
  assert.deepEqual(compare({ family: 'window', base, head, rules, expected }).errors, []);
});

test('injected change, scrollbar: a missing pressed-tier track is caught in the pressed cells only', async () => {
  const drop = (entries, { horizontal }) => entries.filter(([k]) => k !== (horizontal ? 'cicn:-8285' : 'cicn:-8277'));
  const head = await computeFamily('scrollbar', { slugs: ['1138'], mutate: drop });
  const base = subset(committed('scrollbar'), '1138');
  const r = compare({ family: 'scrollbar', base, head, rules: ruleIds(FAMILIES.scrollbar.rules) });
  assert.ok(r.diffs.length > 0, 'the gate sees the change');
  assert.ok(r.diffs.every(d => d.key.includes('/pressed-')), r.diffs.map(d => d.key).join(', '));
  assert.ok(r.errors.some(e => /not listed in expected\/scrollbar\.json/.test(e)));
});

test('injected change, proceduralFrame: a missing zoom icon is caught in the hilited zoom-bearing cells only', async () => {
  const drop = entries => entries.filter(([k]) => k !== 'ics#:-14334');
  const head = await computeFamily('proceduralFrame', { slugs: ['apple-platinum-2'], mutate: drop });
  const base = subset(committed('proceduralFrame'), 'apple-platinum-2');
  const r = compare({ family: 'proceduralFrame', base, head, rules: ruleIds(FAMILIES.proceduralFrame.rules) });
  assert.ok(r.diffs.length > 0, 'the gate sees the change');
  // Only the zoom-variation document windows draw (or hit-test) the zoom icon, and only when hilited (§5 row 12).
  assert.ok(r.diffs.every(d => /^apple-platinum-2\/(collapsed-)?document-window\/active\//.test(d.key)), r.diffs.map(d => d.key).join(', '));
  assert.ok(r.errors.some(e => /not listed in expected\/proceduralFrame\.json/.test(e)));
});

test('declaredFromBody reads engine-diff lines from a PR body', () => {
  assert.deepEqual([...declaredFromBody('Fixes x.\n\nengine-diff: scrollbar, window\n')], ['scrollbar', 'window']);
  assert.deepEqual([...declaredFromBody('engine-diff: none')], []);
  assert.deepEqual([...declaredFromBody('`engine-diff: window`')], [], 'must be its own line');
  assert.deepEqual([...declaredFromBody('no declaration')], []);
});

test('CLI: passes against the committed baselines, fails closed on an unreadable base', async () => {
  const { spawnSync } = await import('node:child_process');
  const script = new URL('./run.mjs', import.meta.url).pathname;
  let r = spawnSync(process.execPath, [script, '--check'], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /engine-diff: pass/);
  r = spawnSync(process.execPath, [script, '--check', '--base-commit', 'deadbeef'.repeat(5)], { encoding: 'utf8' });
  assert.equal(r.status, 2);
  r = spawnSync(process.execPath, [script, '--check', '--declared', 'nosuchfamily'], { encoding: 'utf8' });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /declared family nosuchfamily is unknown/);
});

test('CLI: a family judged at the base cannot be deleted, renamed or taken over by a seed (#401 review P9-P11)', async t => {
  const { spawnSync, execFileSync } = await import('node:child_process');
  const { mkdtempSync, rmSync, writeFileSync: write, readFileSync: read, renameSync, symlinkSync, existsSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const repo = new URL('../../', import.meta.url).pathname;
  const g = (cwd, ...a) => execFileSync('git', a, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  // Base: HEAD with this tree's engine-diff files committed on top, so the base has the baselines.
  const dir = mkdtempSync(join(tmpdir(), 'engine-diff-cli-'));
  const wt = join(dir, 'wt');
  g(repo, 'worktree', 'add', '-q', '--detach', wt, 'HEAD');
  t.after(() => { try { g(repo, 'worktree', 'remove', '--force', wt); } catch {} rmSync(dir, { recursive: true, force: true }); });
  for (const f of ['tests/engine-diff/cases.mjs', 'tests/engine-diff/run.mjs', 'tests/engine-diff/baselines/window.json', 'tests/engine-diff/baselines/scrollbar.json', 'tests/engine-diff/expected/window.json', 'tests/engine-diff/expected/scrollbar.json']) write(join(wt, f), read(join(repo, f)));
  symlinkSync(join(repo, 'node_modules'), join(wt, 'node_modules'));
  g(wt, '-c', 'user.email=t@t', '-c', 'user.name=t', '-c', 'commit.gpgsign=false', 'commit', '-qam', 'base', '--allow-empty');
  const base = g(wt, 'rev-parse', 'HEAD');
  const cases = join(wt, 'tests/engine-diff/cases.mjs'), original = read(cases, 'utf8');
  const WINDOW = "  window: { rules: ['docs/spec/engine/qd-primitives.md'], cells: windowCells },\n";
  assert.ok(original.includes(WINDOW));
  const run = body => spawnSync(process.execPath, [join(wt, 'tests/engine-diff/run.mjs'), '--check', '--base-commit', base], { cwd: wt, encoding: 'utf8', env: { ...process.env, ENGINE_DIFF_PR_BODY: body } });
  const reset = () => { g(wt, 'checkout', '-q', '--', '.'); g(wt, 'clean', '-qfd', 'tests/engine-diff'); };

  let r = run('engine-diff: none');
  assert.equal(r.status, 0, r.stdout + r.stderr);

  // P9: delete `window` from FAMILIES.
  write(cases, original.replace(WINDOW, ''));
  r = run('engine-diff: none');
  assert.equal(r.status, 1, 'P9 deleting a family fails');
  assert.match(r.stderr, /window: has a baseline at base .* but is not a family in cases\.mjs/);
  reset();

  // P10: rename window -> win, move its baseline and expected files, declare win.
  write(cases, original.replace(WINDOW, WINDOW.replace('window:', 'win:')));
  renameSync(join(wt, 'tests/engine-diff/baselines/window.json'), join(wt, 'tests/engine-diff/baselines/win.json'));
  renameSync(join(wt, 'tests/engine-diff/expected/window.json'), join(wt, 'tests/engine-diff/expected/win.json'));
  r = run('engine-diff: win');
  assert.equal(r.status, 1, 'P10 renaming a family fails');
  assert.match(r.stderr, /window: has a baseline at base .* but is not a family in cases\.mjs/);
  assert.match(r.stderr, /win: the seed reproduces cells of base family window/);
  reset();

  // P11: rename to win but keep baselines/window.json.
  write(cases, original.replace(WINDOW, WINDOW.replace('window:', 'win:')));
  r = run('engine-diff: win');
  assert.equal(r.status, 1, 'P11 rename keeping the old baseline fails');
  assert.match(r.stderr, /baselines\/window\.json belongs to no family/);
  reset();

  // Seed takeover: a new family that re-runs window's cells, window kept.
  write(cases, original.replace(WINDOW, WINDOW + WINDOW.replace('window:', 'win2:')));
  r = run('engine-diff: win2');
  assert.equal(r.status, 1, 'a seed reproducing an existing family fails');
  assert.match(r.stderr, /win2: the seed reproduces cells of base family window/);
  reset();
  assert.ok(!existsSync(join(wt, 'tests/engine-diff/baselines/win.json')));
});
