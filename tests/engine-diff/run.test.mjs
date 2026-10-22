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
