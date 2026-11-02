// Explicit independent verifier command; deliberately outside the normal test glob.
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
const test = 'tests/rendering-options/widget-family-acceptance.test.mjs';
for (const mutation of ['', 'omitAlternate', 'omitSideOffset', 'keepPopupCollapsed', 'useFirstRow']) {
  const r = spawnSync(process.execPath, ['--experimental-strip-types', '--test', test], {
    encoding: 'utf8', env: { ...process.env, SCRIPTOSCOPE_WIDGET_MUTATION: mutation },
  });
  if (!mutation) assert.equal(r.status, 0, r.stdout + r.stderr);
  else {
    assert.notEqual(r.status, 0, `Survived: ${mutation}`);
    assert.match(r.stdout, /ERR_ASSERTION/, r.stdout + r.stderr);
    assert.doesNotMatch(r.stdout + r.stderr, /Mutation did not bind/);
  }
  console.log(`${mutation || 'control'}: exit ${r.status}${mutation ? ' (killed)' : ''}`);
}
