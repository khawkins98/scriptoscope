// Guards the frozen routine denominator (docs/spec/routine-inventory.json) as
// enforced by scripts/report-coverage.mjs: identity (inScope.sha256), not just counts.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { spawnSync, execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const script = join(root, 'scripts/report-coverage.mjs');
const inventory = () => JSON.parse(readFileSync(join(root, 'docs/spec/routine-inventory.json'), 'utf8'));

function run(inv) {
  const dir = mkdtempSync(join(tmpdir(), 'routine-cov-'));
  try {
    const p = join(dir, 'inventory.json');
    writeFileSync(p, JSON.stringify(inv));
    return spawnSync(process.execPath, [script, '--json', '--inventory', p], { encoding: 'utf8' });
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

test('committed inventory passes', () => {
  const r = run(inventory());
  assert.equal(r.status, 0, r.stderr);
  assert.equal(JSON.parse(r.stdout).total.inScope, inventory().inScope.count);
});

test('swapping one in-scope range for another, counts unchanged, fails', () => {
  const inv = inventory();
  const rows = inv.binaries.kDEF0.routines;
  const out = rows.findIndex((r) => r[4] === true && r[3] !== 'unreached');
  const into = rows.findIndex((r) => r[4] === false && r[3] !== 'unreached');
  assert.ok(out >= 0 && into >= 0);
  rows[out][4] = false; rows[into][4] = true;
  const r = run(inv);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /in-scope set sha256/);
  assert.doesNotMatch(r.stderr, /in-scope rows/); // the counts alone would not have caught it
});

test('moving an in-scope range end fails', () => {
  const inv = inventory();
  const row = inv.binaries.CDEF3.routines.find((r) => r[4] === true);
  row[1] = '0x' + (parseInt(row[1], 16) + 2).toString(16);
  const r = run(inv);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /in-scope set sha256/);
});

test('editing the pinned hash fails', () => {
  const inv = inventory();
  inv.inScope.sha256 = '0'.repeat(64);
  assert.equal(run(inv).status, 1);
});

function runWithBase(inv, base) {
  const dir = mkdtempSync(join(tmpdir(), 'routine-cov-'));
  try {
    writeFileSync(join(dir, 'inv.json'), JSON.stringify(inv));
    writeFileSync(join(dir, 'base.json'), JSON.stringify(base));
    return spawnSync(process.execPath, [script, '--json', '--inventory', join(dir, 'inv.json'), '--base-inventory', join(dir, 'base.json')], { encoding: 'utf8' });
  } finally { rmSync(dir, { recursive: true, force: true }); }
}
const swapOne = (inv) => { inv.binaries.kDEF0.routines.find((r) => r[4] === true)[4] = false; return inv; };

test('a frozen inventory keeps its pin: frozen:false, a reworded status or a missing pin field fails', () => {
  assert.match(inventory().status, /FROZEN/);
  const flipped = swapOne(inventory());
  flipped.inScope.frozen = false;
  let r = run(flipped);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /inventory is frozen but inScope\.frozen is false/);
  assert.match(r.stderr, /in-scope set sha256/);
  for (const status of ['frozen 2026-10-21', 'PROVISIONAL', 'denominator draft']) {
    const reworded = swapOne(inventory());
    reworded.status = status; reworded.inScope.frozen = false;
    r = run(reworded);
    assert.equal(r.status, 1, `status ${status}: the remaining pin fields still freeze it`);
    assert.match(r.stderr, /in-scope set sha256/, status);
  }
  for (const field of ['count', 'sha256', 'perBinary']) {
    const missing = inventory();
    delete missing.inScope[field];
    r = run(missing);
    assert.equal(r.status, 1, field);
    assert.match(r.stderr, new RegExp(`frozen but inScope\\.${field}`), field);
  }
  const oneBinary = inventory();
  delete oneBinary.inScope.perBinary.CDEF8;
  assert.match(run(oneBinary).stderr, /inScope\.perBinary\.CDEF8 is missing/);
  for (const field of ['count', 'sha256', 'frozenOn', 'perBinary', 'changes']) {
    const only = swapOne(inventory());
    only.status = 'provisional';
    only.inScope = { column: only.inScope.column, [field]: inventory().inScope[field] ?? [{ what: 'x' }] };
    assert.equal(run(only).status, 1, `${field} alone marks the inventory frozen`);
  }
  const lowerOnly = inventory();
  lowerOnly.status = 'frozen (lower case)';
  lowerOnly.inScope = { column: lowerOnly.inScope.column };
  r = run(lowerOnly);
  assert.equal(r.status, 1, 'a lower-case frozen status alone requires the pin');
  assert.match(r.stderr, /inventory is frozen but inScope\.frozen is undefined/);
  const neverFrozen = inventory();
  neverFrozen.status = 'provisional';
  neverFrozen.inScope = { column: 'inScope' };
  assert.equal(run(neverFrozen).status, 0, 'an inventory with no pin and no frozen status is not checked');
});

test('deleting the whole pin and rewording the status fails against a frozen base', () => {
  const stripped = swapOne(inventory());
  stripped.status = 'provisional';
  stripped.inScope = { column: 'inScope' };
  assert.equal(run(stripped).status, 0, 'without a base, nothing marks it frozen');
  const r = runWithBase(stripped, inventory());
  assert.equal(r.status, 1);
  assert.match(r.stderr, /the base inventory is frozen but inScope\.frozen is undefined/);
  assert.match(r.stderr, /the base inventory is frozen but inScope\.sha256 is not a sha256/);
  assert.equal(runWithBase(inventory(), inventory()).status, 0);
});

test('an unreadable --base-commit exits 2', () => {
  const r = spawnSync(process.execPath, [script, '--base-commit', 'deadbeef'.repeat(5)], { encoding: 'utf8' });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /base commit .* is not readable/);
});

test('a consistent but unrecorded re-pin fails against a frozen base (reviewer R2-2)', () => {
  // Exactly the attack: drop one in-scope kDEF0 range, recompute count, perBinary.kDEF0 and
  // inScope.sha256 so every self-check agrees, and add no inScope.changes entry.
  const repin = () => {
    const inv = inventory();
    const rows = inv.binaries.kDEF0.routines;
    rows.find((r) => r[4] === true)[4] = false;
    inv.inScope.count -= 1;
    inv.inScope.perBinary.kDEF0 -= 1;
    const lines = [];
    for (const [name, b] of Object.entries(inv.binaries)) for (const r of b.routines) if (r[4] === true) lines.push(`${name} ${r[0]} ${r[1]}`);
    inv.inScope.sha256 = createHash('sha256').update(lines.sort().join('\n')).digest('hex');
    return inv;
  };
  const silent = repin();
  assert.equal(run(silent).status, 0, 'self-consistent: the pin alone cannot see it');
  let r = runWithBase(silent, inventory());
  assert.equal(r.status, 1);
  assert.match(r.stderr, /re-pinned \(count 552 -> 551.*without a new inScope\.changes entry/);
  const recorded = repin();
  recorded.inScope.changes.push({ from: 552, to: 551, date: '2026-10-22', what: 'drop one range (test)' });
  r = runWithBase(recorded, inventory());
  assert.equal(r.status, 0, r.stderr);
  const wrongCount = repin();
  wrongCount.inScope.changes.push({ from: 552, to: 550, what: 'mislabelled' });
  assert.match(runWithBase(wrongCount, inventory()).stderr, /must record from: 552, to: 551/);
  const rewritten = repin();
  rewritten.inScope.changes[0].what = 'history rewritten';
  rewritten.inScope.changes.push({ from: 552, to: 551, what: 'drop one range (test)' });
  assert.match(runWithBase(rewritten, inventory()).stderr, /append-only/);
  const editedOnly = inventory();
  editedOnly.inScope.changes[1].what = 'edited without a re-pin';
  assert.equal(runWithBase(editedOnly, inventory()).status, 1, 'changes stay append-only even without a re-pin');
});

// Citation heuristics, on a throwaway --root tree (the frozen pin is not involved).
function runRoot(files) {
  const dir = mkdtempSync(join(tmpdir(), 'routine-cov-root-'));
  try {
    for (const [rel, text] of Object.entries(files)) {
      mkdirSync(dirname(join(dir, rel)), { recursive: true });
      writeFileSync(join(dir, rel), text);
    }
    return spawnSync(process.execPath, [script, '--json', '--root', dir], { encoding: 'utf8' });
  } finally { rmSync(dir, { recursive: true, force: true }); }
}
const fixtureInventory = JSON.stringify({
  status: 'fixture', columns: ['start', 'end', 'class', 'reachedFrom', 'inScope'], inScope: { rule: 'fixture' },
  binaries: {
    kDEF0: { routines: [['0xc', '0x28', 'g', 'entry', true], ['0x28', '0x38', 'g', 'entry', true], ['0x1000', '0x1100', 'g', 'entry', true]] },
    PACH130: { routines: [['0x1000', '0x1100', 'g', 'entry', true]] },
  },
});

test("'dispatch' is not a PACH hint; a word starting with 'patch' still is", () => {
  const r = runRoot({
    'docs/spec/routine-inventory.json': fixtureInventory,
    'docs/spec/engine/fixture.md': 'The part dispatch table at 0x1050 selects the handler.\n',
    'docs/spec/notes.md': 'The patch installed at 0x1080 replaces the trap.\n',
  });
  assert.equal(r.status, 0, r.stderr);
  const b = JSON.parse(r.stdout).binaries;
  assert.equal(b.kDEF0.decoded, 1, 'the dispatch line belongs to the file default, kDEF0');
  assert.equal(b.PACH130.decoded, 0, 'the dispatch line is not a PACH 130 citation');
  assert.equal(b.PACH130.cited, 1, 'the patch line is a PACH 130 citation');
});

test('one- and two-digit addresses (0xc, 0x28) are cited; struct offsets and zero-padding still are not', () => {
  const files = { 'docs/spec/routine-inventory.json': fixtureInventory };
  const cited = text => JSON.parse(runRoot({ ...files, 'docs/spec/engine/fixture.md': text }).stdout).binaries.kDEF0.decoded;
  assert.equal(cited('Toolbox glue starts at 0xc.\n'), 1);
  assert.equal(cited('The second stub is 0x28.\n'), 1);
  assert.equal(cited('Reads the field at a4@(0x28).\n'), 0, 'an @( ) operand is a struct offset');
  assert.equal(cited('Adds base + 0xc.\n'), 0, "a value after '+' is an offset");
  assert.equal(cited('Zero-padded 0x000c.\n'), 0);
  // Low values in src/ comments never count (explicit files only).
  const r = runRoot({ ...files, 'src/x.ts': '// see 0xc\n' });
  assert.equal(JSON.parse(r.stdout).binaries.kDEF0.cited, 0);
});

test('without --base-*, the base is the merge-base with origin/main (v2 is retired, #534)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'routine-cov-default-base-'));
  try {
    const invPath = join(dir, 'docs/spec/routine-inventory.json');
    mkdirSync(dirname(invPath), { recursive: true });
    const inv = (inScope) => JSON.stringify({ status: 'fixture', columns: ['start', 'end', 'class', 'reachedFrom', 'inScope'], inScope, binaries: {} });
    const g = (...a) => execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...a], { cwd: dir, stdio: 'pipe' });
    // origin/main carries a frozen inventory (and there is no origin/v2); the head drops the pin.
    writeFileSync(invPath, inv({ frozen: true }));
    g('init', '-q'); g('add', '.'); g('commit', '-qm', 'base'); g('update-ref', 'refs/remotes/origin/main', 'HEAD');
    writeFileSync(invPath, inv({ rule: 'fixture' }));
    const r = spawnSync(process.execPath, [script, '--json', '--root', dir], { encoding: 'utf8' });
    assert.equal(r.status, 1, 'the frozen pin at origin/main must be enforced: ' + r.stdout + r.stderr);
    assert.match(r.stderr, /the base inventory is frozen but inScope\.frozen is undefined/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
