// scripts/generate-platinum/palette.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PALETTE, SLOTS } from './palette.mjs';

test('palette defines every required slot as an [r,g,b] triple', () => {
  for (const slot of SLOTS) {
    const c = PALETTE[slot];
    assert.ok(Array.isArray(c) && c.length === 3, `missing/!triple: ${slot}`);
    c.forEach((v) => assert.ok(Number.isInteger(v) && v >= 0 && v <= 255));
  }
});
test('each Platinum slot is a near-neutral gray (R≈G≈B within 8)', () => {
  for (const slot of SLOTS) {
    const [r, g, b] = PALETTE[slot];
    assert.ok(Math.max(r, g, b) - Math.min(r, g, b) <= 8, `not gray: ${slot} = ${r},${g},${b}`);
  }
});
test('the bevel ramp is ordered light→dark', () => {
  const lum = ([r, g, b]) => r + g + b;
  assert.ok(lum(PALETTE.bevelHighlight) > lum(PALETTE.titleFillBack));
  assert.ok(lum(PALETTE.titleFillBack) > lum(PALETTE.bevelShadow));
});
