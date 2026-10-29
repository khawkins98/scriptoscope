import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeFamily, compare, ruleIds } from './run.mjs';
import { FAMILIES } from './cases.mjs';

test('header engine-diff enumerates327 meaningful cases and catches changed real paint inputs', async () => {
  const base = await computeFamily('header');
  assert.equal(Object.keys(base).length, 327); //13×3×2×2×2 +5×3.
  assert.equal(Object.keys(base).filter(k => k.endsWith('/missing')).length, 15);
  assert.equal(new Set(Object.keys(base).map(k => k.split('/')[0])).size, 18);
  for (const state of [0, 1, 0xffffffff]) assert.equal(Object.keys(base).filter(k => k.includes(`/state${state}/`)).length, 109);
  const head = await computeFamily('header', { mutate(input) {
    const data = new Uint8ClampedArray(input.source.data);
    for (let i = 0; i < data.length; i += 4) data[i] ^= 255;
    return { ...input, source: { ...input.source, data } };
  } });
  const result = compare({ family: 'header', base, head, expected: [], declared: true, rules: ruleIds(FAMILIES.header.rules) });
  assert.ok(result.diffs.length > 0, 'real engine pixels must respond to changed source colors');
  assert.ok(result.errors.length > 0, 'undeclared cell changes must fail');
});
