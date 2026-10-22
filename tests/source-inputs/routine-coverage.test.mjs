// Guards the frozen routine denominator (docs/spec/routine-inventory.json) as
// enforced by scripts/report-coverage.mjs: identity (inScope.sha256), not just counts.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
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
