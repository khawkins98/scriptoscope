// scripts/generate-platinum/palette.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PALETTE, SLOTS } from './palette.mjs';

const REQUIRED = [
  'frameOutline', 'windowHighlight', 'windowShadow',
  'plateBase', 'pinstripeLight', 'pinstripeDark', 'titleText', 'contentBg',
];

test('palette defines every required slot as an [r,g,b] triple', () => {
  for (const slot of REQUIRED) {
    assert.ok(SLOTS.includes(slot), `SLOTS missing: ${slot}`);
    const c = PALETTE[slot];
    assert.ok(Array.isArray(c) && c.length === 3, `missing/!triple: ${slot}`);
    c.forEach((v) => assert.ok(Number.isInteger(v) && v >= 0 && v <= 255, `bad channel: ${slot}`));
  }
});

test('every slot is neutral (R==G==B)', () => {
  // The Platinum ramp now spans pure white..black; all slots are still neutral
  // grays/whites/blacks (no chroma), so each channel of a slot is equal.
  for (const slot of SLOTS) {
    const [r, g, b] = PALETTE[slot];
    assert.ok(r === g && g === b, `not neutral: ${slot} = ${r},${g},${b}`);
  }
});

test('the bevel ramp is highlight(255) > plate(204) > shadow(119) > outline(0)', () => {
  const lum = ([r]) => r; // neutral, so any channel is the luminance
  assert.equal(lum(PALETTE.windowHighlight), 255);
  assert.equal(lum(PALETTE.plateBase), 204);
  assert.equal(lum(PALETTE.pinstripeDark), 119);
  assert.equal(lum(PALETTE.frameOutline), 0);
  assert.ok(
    lum(PALETTE.windowHighlight) > lum(PALETTE.plateBase) &&
    lum(PALETTE.plateBase) > lum(PALETTE.pinstripeDark) &&
    lum(PALETTE.pinstripeDark) > lum(PALETTE.frameOutline),
    'ramp not strictly descending',
  );
});
