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
