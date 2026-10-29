// Engine diff gate: the committed baselines are the head's output, the pure
// compare() enforces every rule, and an injected change to the engine's inputs
// is caught for each family through the real engine (the src mutation probes
// are recorded in the PR; tests must not edit src/).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { computeFamily, compare, compareBaseHarness, ruleIds, familyRules, ledgerEvidenceIds, declaredFromBody, baselinePath, expectedPath } from './run.mjs';
import { FAMILIES } from './cases.mjs';

const committed = f => JSON.parse(readFileSync(baselinePath(f), 'utf8')).cells;
const subset = (cells, slug) => Object.fromEntries(Object.entries(cells).filter(([k]) => k.startsWith(`${slug}/`)));

test('the committed baselines are the head output for every family (run npm run engine-diff:write after blessing)', async () => {
  for (const family of Object.keys(FAMILIES)) {
    const head = await computeFamily(family);
    // Independently enumerated grids: #459 has 18×4×3×2 push cells and
    // 18×2×4×4×2×2 checkable cells. Tab has 14 art archives×2 selections×2
    // widths + 4 missing-art archives×2 selections. Header has 13 art archives
    // ×3 raw states×2 kinds×2 sizes×2 origins +5 missing archives×3 states.
    // Missing art is one cell per state, with no filler geometry combinations.
    // Retain older >1000 guards and full committed-baseline equality below.
    const newCounts = { pushButton: 432, checkables: 2304, tab: 64, header: 327 };
    if (family in newCounts) assert.equal(Object.keys(head).length, newCounts[family], family);
    else assert.ok(Object.keys(head).length > 1000, `${family}: ${Object.keys(head).length} cells`);
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

test("rule ids also include the family's own ledger evidence ids, and only its own", () => {
  const w = familyRules('window', FAMILIES.window.rules), sb = familyRules('scrollbar', FAMILIES.scrollbar.rules);
  for (const id of ['W2', 'kdef.too-short-step', 'kdef.width-allocation']) assert.ok(w.has(id), id);
  assert.ok(sb.has('kdef.scroll-track') && sb.has('TR3'));
  assert.ok(!sb.has('kdef.too-short-step'), 'window evidence does not bless a scroll-bar change');
  assert.ok(!w.has('kdef.scroll-track'), 'scroll-bar evidence does not bless a window change');
  assert.ok(!w.has('fixture.band-collision-literal'), 'shared.json evidence is not a family rule');
  assert.equal(ledgerEvidenceIds('nosuchfamily').size, 0);
  assert.equal(ledgerEvidenceIds('../families/window').size, 0, 'family names are not paths');
  assert.equal(ledgerEvidenceIds('shared').size, 0, 'shared.json is not a family');
  assert.equal(ledgerEvidenceIds('_base').size, 0);
  const base = { a: '1' }, head = { a: '2' };
  assert.deepEqual(compare({ family: 'window', base, head, rules: w, expected: [{ key: 'a', rule: 'kdef.too-short-step', sha256: '2', why: 'too-short step' }] }).errors, []);
  assert.match(compare({ family: 'scrollbar', base, head, rules: sb, expected: [{ key: 'a', rule: 'kdef.too-short-step', sha256: '2', why: 'x' }] }).errors.join('\n'), /names rule "kdef\.too-short-step", not a decision-table row of the family spec or an evidence id/);
});

test('compareBaseHarness: a change the base harness sees must be listed by key and declared', () => {
  const base = { a: '1', b: '2' }, head = { a: '1', b: '3', c: '4' };
  let r = compareBaseHarness({ family: 'window', base, head });
  assert.deepEqual(r.diffs.map(d => d.key), ['b', 'c']);
  assert.equal(r.errors.length, 2);
  assert.match(r.errors[0], /base copy of cases\.mjs sees b change/);
  // Listed by key: passes even though the head harness blessed a different digest.
  const expected = [{ key: 'b', rule: 'W2', sha256: 'f00', why: 'x' }, { key: 'c', rule: 'W2', sha256: '4', why: 'x' }];
  assert.deepEqual(compareBaseHarness({ family: 'window', base, head, expected }).errors, []);
  assert.match(compareBaseHarness({ family: 'window', base, head, expected, declared: false }).errors.join('\n'), /does not declare "engine-diff: window"/);
  assert.deepEqual(compareBaseHarness({ family: 'window', base, head: base }).errors, [], 'no change, nothing to list');
  // #411 review B2: an inert entry (sha256 equal to the base digest) covers nothing.
  r = compareBaseHarness({ family: 'window', base: { k: 'A' }, head: { k: 'B' }, expected: [{ key: 'k', rule: 'W2', sha256: 'A', why: 'earlier PR' }] });
  assert.equal(r.errors.length, 1, 'an inert entry does not cover a base-harness diff');
  assert.match(r.errors[0], /sees k change/);
  r = compareBaseHarness({ family: 'window', base: { k: 'A' }, head: { k: 'B' }, expected: [{ key: 'k', rule: 'W2', sha256: null, why: 'x' }] });
  assert.deepEqual(r.errors, [], 'an entry blessing a change (here removal) from the base covers the key');
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
  const WINDOW = "  window: { rules: ['docs/spec/engine/window-widgets.md', 'docs/spec/engine/qd-primitives.md'], cells: windowCells },\n";
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

test('CLI: a cases.mjs edit cannot hide a runtime regression; the base copy of the harness sees it (#401 round-2)', async t => {
  const { spawnSync, execFileSync } = await import('node:child_process');
  const { mkdtempSync, rmSync, writeFileSync: write, readFileSync: read, symlinkSync, readdirSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const repo = new URL('../../', import.meta.url).pathname;
  const g = (cwd, ...a) => execFileSync('git', a, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const dir = mkdtempSync(join(tmpdir(), 'engine-diff-base-harness-'));
  const wt = join(dir, 'wt');
  g(repo, 'worktree', 'add', '-q', '--detach', wt, 'HEAD');
  t.after(() => { try { g(repo, 'worktree', 'remove', '--force', wt); } catch {} rmSync(dir, { recursive: true, force: true }); });
  for (const f of ['tests/engine-diff/cases.mjs', 'tests/engine-diff/run.mjs', 'tests/engine-diff/baselines/window.json', 'tests/engine-diff/baselines/scrollbar.json', 'tests/engine-diff/expected/window.json', 'tests/engine-diff/expected/scrollbar.json']) write(join(wt, f), read(join(repo, f)));
  symlinkSync(join(repo, 'node_modules'), join(wt, 'node_modules'));
  g(wt, '-c', 'user.email=t@t', '-c', 'user.name=t', '-c', 'commit.gpgsign=false', 'commit', '-qam', 'base', '--allow-empty');
  const base = g(wt, 'rev-parse', 'HEAD');
  const run = () => spawnSync(process.execPath, [join(wt, 'tests/engine-diff/run.mjs'), '--check', '--base-commit', base], { cwd: wt, encoding: 'utf8', env: { ...process.env, ENGINE_DIFF_PR_BODY: 'engine-diff: none' } });
  const cases = join(wt, 'tests/engine-diff/cases.mjs'), chrome = join(wt, 'src/composeChrome.ts');
  const RETURN = '  return {\n    buffer: out, frame,';
  const PIXELS = 'pixels: sha(c.buffer.data),';
  assert.ok(read(chrome, 'utf8').includes(RETURN) && read(cases, 'utf8').includes(PIXELS));

  // A harness-only edit (a comment) with no runtime change passes, and the base copy runs.
  write(cases, read(cases, 'utf8') + '\n// harness edit\n');
  let r = run();
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /window: base copy of cases\.mjs on the head runtime: 0 changed/);

  // Runtime regression (one window pixel flipped) plus a head harness that undoes it
  // before hashing: the head run sees no change, the base copy fails the gate.
  write(chrome, read(chrome, 'utf8').replace(RETURN, '  out.data[0] ^= 1;\n' + RETURN));
  write(cases, read(cases, 'utf8').replace(PIXELS, 'pixels: sha((c.buffer.data[0] ^= 1, c.buffer.data)),'));
  r = run();
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stdout, /engine-diff: window: 1\d{3} cells, 0 changed/, 'the edited head harness hides the change');
  assert.match(r.stderr, /window: the base copy of cases\.mjs sees \S+ change .* the head harness may be hiding a runtime change/);
  assert.deepEqual(readdirSync(join(wt, 'tests/engine-diff')).filter(n => n.startsWith('.cases-base-')), [], 'the temporary base harness is removed');

  // #411 review B1: a module-level patch in the head cases.mjs that restores a runtime
  // table object must not leak into the base pass (it runs in its own process).
  g(wt, 'checkout', '-q', '--', '.');
  const sbTables = join(wt, 'src/engine/tables/scrollbar.ts');
  const TRACK = 'export const SCROLLBAR_TRACK_BASE = { horizontal: -8288,';
  assert.ok(read(sbTables, 'utf8').includes(TRACK));
  write(sbTables, read(sbTables, 'utf8').replace(TRACK, 'export const SCROLLBAR_TRACK_BASE = { horizontal: -8287,'));
  const control = run();
  assert.equal(control.status, 1, 'control: the runtime change alone fails');
  write(cases, "(await import('../../src/engine/tables/scrollbar.ts')).SCROLLBAR_TRACK_BASE.horizontal = -8288;\n" + read(cases, 'utf8'));
  r = run();
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stdout, /engine-diff: scrollbar: 2\d{3} cells, 0 changed/, 'the patched head harness hides the change');
  assert.match(r.stderr, /scrollbar: the base copy of cases\.mjs sees \S+ change/);

  // A runtime API rename that the head harness follows but the base copy cannot run fails closed.
  g(wt, 'checkout', '-q', '--', '.');
  const tables = join(wt, 'src/engine/tables/scrollbar.ts');
  write(tables, read(tables, 'utf8').replace('export const SCROLLBAR_FACADE_THICKNESS =', 'export const SCROLLBAR_FACADE_THICKNESS_RENAMED ='));
  write(cases, read(cases, 'utf8').replace('tables.SCROLLBAR_FACADE_THICKNESS.thickness', 'tables.SCROLLBAR_FACADE_THICKNESS_RENAMED.thickness'));
  r = run();
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stdout, /engine-diff: scrollbar: 2\d{3} cells, 0 changed/, 'the head harness itself passes');
  assert.match(r.stderr, /base copy of cases\.mjs \(\w+\) failed on the head runtime/);
  assert.deepEqual(readdirSync(join(wt, 'tests/engine-diff')).filter(n => n.startsWith('.cases-base-')), []);
});

test('CI: the engine diff step compares every PR (into main or v2) against its merge-base', () => {
  const wf = readFileSync(new URL('../../.github/workflows/ci.yml', import.meta.url), 'utf8');
  const step = wf.slice(wf.indexOf('- name: Engine diff gate (Node trace diff)'));
  const run = step.slice(0, step.indexOf('\n      - name:', 1));
  assert.match(wf, /pull_request:\n\s+branches: \[main, v2\]/);
  assert.match(run, /if \[ "\$EVENT" = "pull_request" \] && \[ -n "\$BASE_REF" \]; then/);
  assert.doesNotMatch(run, /BASE_REF" = "v2"/, 'not only PRs into v2');
  assert.match(run, /base="\$\(git merge-base HEAD "origin\/\$BASE_REF"\)"\n\s+ENGINE_DIFF_PR_BODY="\$PR_BODY" node tests\/engine-diff\/run\.mjs --check --base-commit "\$base"/);
});
