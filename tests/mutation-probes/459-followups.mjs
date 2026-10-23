import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const cwd = fileURLToPath(new URL('../..', import.meta.url));
for (const [mutation, path] of [['ellipsis', 'src/titleFont.test.mjs'], ['booleanize', 'src/engine/families/progress.test.mjs'], ['phase', 'src/progressFacade.test.mjs'], ['popup', 'tools/theme-loader/windowTitleSamples.test.mjs'], ['background', 'tools/theme-loader/windowTitleSamples.test.mjs']]) {
  const r = spawnSync(process.execPath, ['--import', './tests/mutation-probes/459-followups-hook.mjs', '--test', path], { cwd, encoding: 'utf8', env: { ...process.env, FOLLOWUP_MUTATION: mutation } });
  process.stdout.write(`MUTATION ${mutation} exit=${r.status}\n${r.stdout}${r.stderr}\n`);
  assert.equal(r.status, 1, 'a live runtime mutation must fail an assertion, not fail to load');
  assert.match(r.stdout + r.stderr, /AssertionError/);
  assert.doesNotMatch(r.stdout + r.stderr, /needle absent|never applied/);
}
