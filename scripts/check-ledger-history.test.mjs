// Ledger history guard: merged family transitions are append-only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync, execFileSync } from 'node:child_process';
import { compareHistories } from './check-ledger-history.mjs';
import { readFamilies, recordTransition, assemble, formatFamily } from '../tests/rendering-requirements/build-ledger.mjs';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..');
const script = join(repo, 'scripts/check-ledger-history.mjs');
const strip = ({ text: _, ...f }) => structuredClone(f);

/** A family with two genuine transitions (no row changes, new scope each time). */
function history() {
  const { base, families } = readFamilies();
  const f0 = strip(families.find(f => f.family === 'tab'));
  const f1 = recordTransition(structuredClone(f0), f0, { version: '1.1.0', summary: 'first', review: 'review A', scope: 'tab scope at 1.1.0' });
  const f2 = recordTransition(structuredClone(f1), f1, { version: '1.2.0', summary: 'second', review: 'review B', scope: 'tab scope at 1.2.0' });
  return { base, families: families.map(strip), f1, f2 };
}

test('appending transitions passes; the committed families pass against themselves', () => {
  const { families, f1, f2 } = history();
  const map = Object.fromEntries(families.map(f => [f.family, f]));
  assert.deepEqual(compareHistories(map, map), []);
  assert.deepEqual(compareHistories({ ...map, tab: f1 }, { ...map, tab: f2 }), []);
});

test('a forged history that build-ledger accepts is rejected by the guard', () => {
  const { base, families, f2 } = history();
  // Forge: rewrite transition 0's review and re-derive every digest after it. The chain is
  // self-consistent, so the generator's own checks pass; only the merged base can expose it.
  const f0 = families.find(f => f.family === 'tab');
  const forged1 = recordTransition(structuredClone(f0), f0, { version: '1.1.0', summary: 'first', review: 'review A (softened)', scope: 'tab scope at 1.1.0' });
  const forged2 = recordTransition(structuredClone(forged1), forged1, { version: '1.2.0', summary: 'second', review: 'review B', scope: 'tab scope at 1.2.0' });
  assert.doesNotThrow(() => assemble(base, families.map(f => (f.family === 'tab' ? forged2 : f))), 'the forged chain is internally valid');
  const map = Object.fromEntries(families.map(f => [f.family, f]));
  const errors = compareHistories({ ...map, tab: f2 }, { ...map, tab: forged2 });
  assert.equal(errors.length, 2, errors.join('\n'));
  assert.match(errors[0], /tab: transition 0 \(1\.1\.0\) was edited after merge \(.*review.*\)/);
  assert.match(errors[1], /tab: transition 1 \(1\.2\.0\) was edited after merge \(.*priorInventorySha256.*\)/);
});

test('edited digest, removed, reordered transitions and a removed family all fail', () => {
  const { families, f2 } = history();
  const map = Object.fromEntries(families.map(f => [f.family, f]));
  const baseMap = { ...map, tab: f2 };
  const digestEdit = structuredClone(f2);
  digestEdit.transitions[0].resultSha256.cases = '0'.repeat(64);
  assert.match(compareHistories(baseMap, { ...map, tab: digestEdit })[0], /transition 0 .* edited after merge \(resultSha256 differ\)/);
  const removed = structuredClone(f2);
  removed.transitions.pop();
  assert.match(compareHistories(baseMap, { ...map, tab: removed })[0], /head has 1 transition\(s\), the base already had 2/);
  const reordered = structuredClone(f2);
  reordered.transitions.reverse();
  assert.match(compareHistories(baseMap, { ...map, tab: reordered }).join('\n'), /moved to position 1; recorded transitions are never reordered/);
  const { tab: _, ...withoutTab } = map;
  assert.match(compareHistories(baseMap, withoutTab)[0], /tab: family file present at the base was removed/);
  assert.match(compareHistories(map, map, { baseText: 'a', headText: 'b' })[0], /_base\.json changed/);
});

test('CLI: compares the working tree against a git base commit', () => {
  const root = mkdtempSync(join(tmpdir(), 'ledger-history-'));
  try {
    const famDir = join(root, 'tests/rendering-requirements/families');
    mkdirSync(join(root, 'scripts'), { recursive: true });
    mkdirSync(join(root, 'tests/rendering-requirements'), { recursive: true });
    cpSync(script, join(root, 'scripts/check-ledger-history.mjs'));
    cpSync(join(repo, 'tests/rendering-requirements/families'), famDir, { recursive: true });
    const { f2 } = history();
    writeFileSync(join(famDir, 'tab.json'), formatFamily(f2));
    const g = (...a) => execFileSync('git', a, { cwd: root, stdio: 'pipe' });
    g('init', '-q'); g('-c', 'user.email=t@t', '-c', 'user.name=t', 'add', '.');
    g('-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'base');
    const sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
    const cli = () => spawnSync(process.execPath, [join(root, 'scripts/check-ledger-history.mjs'), '--base-commit', sha], { cwd: root, encoding: 'utf8' });
    let r = cli();
    assert.equal(r.status, 0, r.stderr);
    const forged = JSON.parse(readFileSync(join(famDir, 'tab.json'), 'utf8'));
    forged.transitions[0].summary = 'rewritten';
    writeFileSync(join(famDir, 'tab.json'), formatFamily(forged));
    r = cli();
    assert.equal(r.status, 1, r.stdout + r.stderr);
    assert.match(r.stderr, /tab: transition 0 \(1\.1\.0\) was edited after merge \(summary differ\)/);
    assert.match(r.stderr, /append-only/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
