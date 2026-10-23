// Explicit, opt-in negative controls. Every mutation stays in a test process or
// intercepted browser response; the checkout and production assets stay intact.
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
const probes = [
  ['loader-model', 'retired progress model', 'tools/theme-loader/progressMetadata.test.mjs', /progressSummary must not be exported/],
  ['inspector-model', 'retired progress model', 'tools/theme-loader/progressMetadata.test.mjs', /resourceRoles.progress must not exist/],
  ['sample-role', 'CDEF 5 roles', 'tools/theme-loader/progressMetadata.test.mjs', /colour\|color/],
  ['public-model', 'public TypeScript consumers', 'tools/theme-loader/progressMetadata.test.mjs', /2578.*Unused '@ts-expect-error'/s],
  ['initial-hash', 'initial valid hash', 'tests/visual-baselines/diagnostic-hash.spec.mjs', /TimeoutError/],
  ['hashchange', 'hashchange switches', 'tests/visual-baselines/diagnostic-hash.spec.mjs', /TimeoutError/],
];
for (const [mutation, name, file, failure] of probes) {
  const result = spawnSync(process.execPath, ['--experimental-strip-types', '--test', `--test-name-pattern=${name}`, file], {
    encoding: 'utf8', timeout: 60_000, env: { ...process.env, SCRIPTOSCOPE_459_MUTATION: mutation },
  });
  assert.ifError(result.error);
  assert.equal(result.status, 1, `${mutation} must fail its targeted contract assertion`);
  assert.match(result.stdout + result.stderr, failure, `${mutation} failed for the wrong reason`);
  console.log(`${mutation}: rejected by ${file} (${name}), exit ${result.status}`);
}
