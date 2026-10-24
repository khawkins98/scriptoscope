import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeFamily, compare } from './run.mjs';

test('tab engine-diff seeds all18 archives and its input mutation changes real driver cells', async () => {
  const base = await computeFamily('tab');
  assert.equal(Object.keys(base).length, 64);
  assert.equal(Object.keys(base).filter(k => k.endsWith('/missing')).length, 8);
  const head = await computeFamily('tab', { mutate(input) { return { ...input, metadata: { ...input.metadata, corner: input.metadata.side, side: input.metadata.corner } }; } });
  const result = compare({ family: 'tab', base, head, expected: [], declared: true, rules: new Set(['B1', 'B2', 'B3', 'B4']) });
  assert.ok(result.diffs.length > 0, 'real engine draw must respond to c/s mutation');
  assert.ok(result.errors.length > 0, 'undeclared cell changes must fail');
});
