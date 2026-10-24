import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TAB_ENGINE_INPUT, TAB_ENGINE_PATTERN_ROWS, TAB_ENGINE_PALETTE, TAB_ENGINE_SOLID_ROWS, TAB_ENGINE_SAMPLED_ROWS } from './tab-engine-rules.mjs';

test('independent tab literals have consistent sizes and discriminate P4 modes and C1 lines', () => {
  assert.deepEqual(TAB_ENGINE_INPUT.map(r => r.length), [7, 7, 7, 7, 7]);
  for (const rows of [...Object.values(TAB_ENGINE_PATTERN_ROWS), TAB_ENGINE_SOLID_ROWS, TAB_ENGINE_SAMPLED_ROWS]) {
    assert.equal(rows.length, 5);
    for (const row of rows) { assert.equal(row.length, 8); for (const c of row) assert.ok(TAB_ENGINE_PALETTE[c]); }
  }
  assert.deepEqual(TAB_ENGINE_PATTERN_ROWS[0], TAB_ENGINE_PATTERN_ROWS[1]);
  assert.deepEqual(TAB_ENGINE_PATTERN_ROWS[0], TAB_ENGINE_PATTERN_ROWS[5]);
  assert.deepEqual(TAB_ENGINE_PATTERN_ROWS[0], TAB_ENGINE_PATTERN_ROWS[255]);
  assert.equal(new Set([0, 2, 3, 4].map(m => JSON.stringify(TAB_ENGINE_PATTERN_ROWS[m]))).size, 4);
  assert.notDeepEqual(TAB_ENGINE_SAMPLED_ROWS[0], TAB_ENGINE_SOLID_ROWS[0]);
});
