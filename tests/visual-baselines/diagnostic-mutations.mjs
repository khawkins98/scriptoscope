// Explicit, opt-in negative controls. Every mutation stays in a test process or
// intercepted browser response; the checkout and production assets stay intact.
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const evidenceDir = process.env.SCRIPTOSCOPE_459_EVIDENCE_DIR;
if (evidenceDir) mkdirSync(evidenceDir, { recursive: true });
const probes = [
  ['loader-model', 'retired progress model', 'tools/theme-loader/progressMetadata.test.mjs', /progressSummary must not be exported/],
  ['inspector-model', 'retired progress model', 'tools/theme-loader/progressMetadata.test.mjs', /resourceRoles.progress must not exist/],
  ['sample-role', 'CDEF 5 roles', 'tools/theme-loader/progressMetadata.test.mjs', /colour\|color/],
  ['public-model', 'public TypeScript consumers', 'tools/theme-loader/progressMetadata.test.mjs', /2578.*Unused '@ts-expect-error'/s],
  ['initial-hash', 'initial valid hash', 'tests/visual-baselines/diagnostic-hash.spec.mjs', 'beos-r503'],
  ['hashchange', 'hashchange switches', 'tests/visual-baselines/diagnostic-hash.spec.mjs', 'windows-95'],
];
function run([mutation, name, file], fault = '') {
  const result = spawnSync(process.execPath, ['--experimental-strip-types', '--test', '--test-reporter=tap', `--test-name-pattern=${name}`, file], {
    encoding: 'utf8', timeout: 60_000, env: { ...process.env, SCRIPTOSCOPE_459_MUTATION: mutation, SCRIPTOSCOPE_459_HARNESS_FAULT: fault },
  });
  assert.ifError(result.error);
  const output = result.stdout + result.stderr;
  if (evidenceDir) writeFileSync(join(evidenceDir, `${mutation}${fault ? `-${fault}` : ''}.tap`), output);
  return { ...result, output };
}
function browserReceipt(result) {
  const receipts = [...result.output.matchAll(/^# 459-browser-receipt (.+)$/gm)];
  assert.equal(receipts.length, 1, 'exactly one browser receipt required');
  return JSON.parse(Buffer.from(receipts[0][1], 'base64').toString('utf8'));
}
function browserKill(result, [mutation, , , slug]) {
  assert.equal(result.status, 1, `${mutation} must fail its targeted contract assertion`);
  const receipt = browserReceipt(result);
  assert.equal(receipt.mutation, mutation);
  assert.equal(receipt.applications, 1, 'mutation applied exactly once');
  assert.equal(receipt.resources.length, 1);
  const resource = new URL(receipt.resources[0]);
  assert.equal(resource.pathname, '/diagnostic.html');
  assert.ok(resource.searchParams.has('html-proxy'), 'mutation reached Vite JavaScript proxy');
  assert.equal(receipt.navigations, 1, 'successful navigation required');
  for (const key of ['routeErrors', 'navigationErrors', 'pageErrors', 'requestErrors']) {
    assert.deepEqual(receipt[key], [], `${key} disqualify a mutation kill`);
  }
  assert.deepEqual(receipt.selectedFailure, { expected: slug, actual: '1138' });
  assert.match(result.output, new RegExp(`error: \\|-\\n\\s+selected-theme contract: expected ${slug}`));
  assert.match(result.output, /code: 'ERR_ASSERTION'/);
  assert.match(result.output, /operator: 'strictEqual'/);
  for (const [key, value] of [['tests', 1], ['pass', 0], ['fail', 1], ['cancelled', 0]]) {
    assert.match(result.output, new RegExp(`^# ${key} ${value}$`, 'm'), 'only the targeted assertion may fail');
  }
  assert.doesNotMatch(result.output, /failureType: '(?:hookFailed|cancelledByParent|testTimeoutFailure)'/);
  return receipt;
}
for (const probe of probes) {
  const [mutation, name, file, failure] = probe;
  const result = run(probe);
  if (typeof failure === 'string') {
    console.log(`${mutation}: receipt ${JSON.stringify(browserKill(result, probe))}`);
  } else {
    assert.equal(result.status, 1, `${mutation} must fail its targeted contract assertion`);
    assert.match(result.output, failure, `${mutation} failed for the wrong reason`);
  }
  console.log(`${mutation}: rejected by ${file} (${name}), exit ${result.status}`);
}
// These are failures of the harness, not kills of a runtime mutation. Exercise
// the same acceptance function with real browser results, including navigation.
for (const fault of ['navigation', 'route-error', 'unapplied', 'unrelated']) {
  const probe = probes.find(([mutation]) => mutation === 'initial-hash');
  const result = run(probe, fault);
  assert.throws(() => browserKill(result, probe), { code: 'ERR_ASSERTION' }, `${fault} must not count as a killed mutation`);
  if (fault === 'navigation') {
    assert.notEqual(result.status, 0, 'broken navigation control must actually fail');
    assert.match(result.output, /page.goto: net::ERR_FAILED/);
  }
  const receipt = browserReceipt(result);
  if (fault === 'route-error') assert.deepEqual(receipt.routeErrors, ['injected route exception']);
  if (fault === 'unapplied') assert.equal(receipt.applications, 0);
  if (fault === 'unrelated') assert.match(result.output, /injected unrelated assertion/);
  console.log(`${fault}: receipt ${JSON.stringify(receipt)}`);
  console.log(`${fault}: harness failure correctly refused as a runtime mutation kill (child exit ${result.status})`);
}
