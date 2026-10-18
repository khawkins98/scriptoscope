import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { gitIdentity } from './execution.mjs';
import { observationExecution, preservePrimaryFailure } from './observation-execution.mjs';
import { collectObservations } from './observations.mjs';

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'observation-identity-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const path of ['dist', 'node_modules/@playwright/test']) mkdirSync(join(root, path), { recursive: true });
  for (const [path, value] of Object.entries({ '.gitignore': 'dist/\nnode_modules/\n', source: 'fixture source',
    'package-lock.json': '{}', 'dist/scriptoscope.js': 'fixture bundle', 'dist/scriptoscope.css': 'fixture CSS',
    'node_modules/@playwright/test/package.json': '{"version":"TEST_ONLY"}' })) writeFileSync(join(root, path), value);
  const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  git(['init']); git(['config', 'user.name', 'Test']); git(['config', 'user.email', 'test@example.invalid']);
  git(['add', '.']); git(['commit', '-m', 'test-only fixture']);
  return { root, commit: git(['rev-parse', 'HEAD']) };
}
const browser = { browserVersion: 'TEST_BROWSER', browserName: 'chromium', configuredDeviceScaleFactor: 2 };

test('observed checkout wins over stale environment claims; missing git remains unknown', t => {
  const { root, commit } = fixture(t), keys = ['SCRIPTOSCOPE_GIT_COMMIT', 'GITHUB_SHA'];
  const saved = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  t.after(() => { for (const key of keys) if (saved[key] === undefined) delete process.env[key]; else process.env[key] = saved[key]; });
  for (const key of keys) process.env[key] = '0'.repeat(40);
  const actual = gitIdentity(root);
  assert.equal(actual.executionCommit, commit); assert.equal(actual.identitySource, 'git-checkout');
  assert.equal(actual.declarationsMatchCheckout, false);
  rmSync(join(root, '.git'), { recursive: true });
  const missing = gitIdentity(root);
  assert.equal(missing.executionCommit, null); assert.equal(missing.identitySource, 'unknown');
  assert.equal(missing.workingTreeDirty, null); assert.equal(missing.declarationsMatchCheckout, null);
  assert.equal(JSON.stringify(missing).includes(root), false, 'Git errors must not disclose local paths');
});
test('caller metadata cannot overwrite actual dirty checkout, bundle or browser identity', t => {
  const { root, commit } = fixture(t);
  writeFileSync(join(root, 'source'), 'changed source');
  const actual = observationExecution(root, browser, { executionCommit: 'forged', workingTreeDirty: false,
    builtBundleSha256: 'forged', browserVersion: 'forged', mode: 'source' });
  assert.equal(actual.executionCommit, commit); assert.equal(actual.workingTreeDirty, true);
  assert.equal(actual.builtBundleSha256, createHash('sha256').update('fixture bundle').digest('hex'));
  assert.equal(actual.browserVersion, 'TEST_BROWSER'); assert.deepEqual(actual.declaredRuntimeModes, ['source']);
  assert.deepEqual(actual.suppliedExecutionDisagreements.sort(), ['browserVersion', 'builtBundleSha256', 'executionCommit', 'workingTreeDirty']);
});
test('changed ignored build assets receive new identities even at the same clean source commit', t => {
  const { root } = fixture(t), before = observationExecution(root, browser);
  writeFileSync(join(root, 'dist/scriptoscope.js'), 'different built code');
  writeFileSync(join(root, 'dist/scriptoscope.css'), 'different CSS');
  const after = observationExecution(root, browser);
  assert.equal(after.executionCommit, before.executionCommit); assert.equal(after.workingTreeDirty, false);
  assert.notEqual(after.builtBundleSha256, before.builtBundleSha256); assert.notEqual(after.builtStylesheetSha256, before.builtStylesheetSha256);
});
test('runtime modes must be explicit; no filename-derived or historical verification is invented', t => {
  const { root } = fixture(t);
  assert.deepEqual(observationExecution(root, browser).declaredRuntimeModes, []);
  assert.deepEqual(observationExecution(root, browser, {}, ['source', 'built', 'source']).declaredRuntimeModes, ['source', 'built']);
  assert.throws(() => observationExecution(root, browser, {}, ['declarative']), /source\/built/);
  assert.throws(() => observationExecution(root, browser, {}, 'built'), /source\/built/);
});
test('missing built bytes cannot be replaced by a caller-provided hash', t => {
  const { root } = fixture(t); rmSync(join(root, 'dist/scriptoscope.css'));
  assert.throws(() => observationExecution(root, browser, { builtStylesheetSha256: 'invented' }), /ENOENT/);
});
test('summary reads canonical and legacy execution identity without promoting fidelity', t => {
  const { root } = fixture(t), directory = join(root, 'test-results/rendering-evidence');
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, 'new.json'), JSON.stringify({ complete: true, execution: {
    executionCommit: 'actual', gitCommit: 'stale', workingTreeDirty: false, builtBundleSha256: 'bundle', browserVersion: 'browser', declaredRuntimeModes: ['source', 'built'] }, cases: [] }));
  writeFileSync(join(directory, 'old.json'), JSON.stringify({ executionProvenance: { gitCommit: 'legacy', bundleSha256: 'legacy-bundle' } }));
  writeFileSync(join(directory, 'package.json'), JSON.stringify({ evidence: 'packed-consumer-execution', executionCommit: 'installed-package-run', workingTreeDirty: false }));
  const errors = [], records = collectObservations(root, errors);
  assert.deepEqual(errors, []); const modern = records.find(r => r.path.endsWith('new.json')), legacy = records.find(r => r.path.endsWith('old.json'));
  assert.equal(modern.executionCommit, 'actual'); assert.equal(modern.workingTreeDirty, false);
  assert.deepEqual(modern.declaredRuntimeModes, ['source', 'built']); assert.equal(legacy.executionCommit, 'legacy');
  assert.equal(legacy.workingTreeDirty, null); assert.equal(legacy.builtBundleSha256, 'legacy-bundle');
  assert.equal(records.find(r => r.path.endsWith('package.json')).executionCommit, 'installed-package-run');
  assert.equal(modern.historicalFidelity, undefined);
});
test('canonical unknown commit cannot be resurrected from legacy claims', t => {
  const { root } = fixture(t), directory = join(root, 'test-results/rendering-evidence');
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, 'unknown.json'), JSON.stringify({ execution: {
    executionCommit: null, identitySource: 'unknown', gitCommit: 'untrusted', builtBundleSha256: null, bundleSha256: 'untrusted' },
    executionProvenance: { gitCommit: 'also-untrusted' } }));
  writeFileSync(join(directory, 'null-envelope.json'), JSON.stringify({ execution: null, executionProvenance: { gitCommit: 'untrusted' } }));
  writeFileSync(join(directory, 'unknown-source.json'), JSON.stringify({ execution: { identitySource: 'unknown', gitCommit: 'untrusted' } }));
  const errors = [], records = collectObservations(root, errors);
  assert.deepEqual(errors, []); assert.equal(records.length, 3);
  for (const record of records) assert.equal(record.executionCommit, null);
  assert.equal(records.find(r => r.path.endsWith('unknown.json')).builtBundleSha256, null);
});
test('finally metadata failures preserve an original assertion and remain visible', async () => {
  const primary = new Error('original contract failure'), metadata = Object.assign(new Error('private /local/path'), { code: 'ENOENT' });
  const annotations = [];
  async function failedContract() {
    try { throw primary; }
    finally { await preservePrimaryFailure(true, async () => { throw metadata; }, text => annotations.push(text)); }
  }
  await assert.rejects(failedContract, error => error === primary);
  assert.deepEqual(annotations, ['Observation metadata unavailable (ENOENT)']);
  await assert.rejects(() => preservePrimaryFailure(false, async () => { throw metadata; }, () => {}), error => error === metadata);
  await assert.doesNotReject(() => preservePrimaryFailure(true, async () => { throw metadata; }, () => { throw new Error('reporter also failed'); }));
});
