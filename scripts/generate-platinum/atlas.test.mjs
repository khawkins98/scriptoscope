// scripts/generate-platinum/atlas.test.mjs
// The atlas generator + slicer share atlas-layout.mjs, so a generated atlas must
// slice back to the source sprites pixel-for-pixel (opaque pixels). This guards
// the generate↔slice coordinate agreement.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildAtlas } from './atlas.mjs';
import { sliceAtlas } from './slice-atlas.mjs';
import { drawWindow } from './draw-window.mjs';
import { WINDOW_TYPES } from './window-types.mjs';
import { computeAtlasLayout } from './atlas-layout.mjs';
import { PALETTE } from './palette.mjs';

test('atlas holds 26 sprites (13 types × active/inactive)', () => {
  const { slots } = computeAtlasLayout();
  assert.equal(slots.length, 26);
  assert.equal(new Set(slots.map((s) => s.slug)).size, 13);
});

test('every sprite cell fits inside the atlas page', () => {
  const layout = computeAtlasLayout();
  for (const s of layout.slots) {
    assert.ok(s.sprite.x >= 0 && s.sprite.y >= 0);
    assert.ok(s.sprite.x + s.sprite.w <= layout.width, `${s.slug} ${s.state} overflows width`);
    assert.ok(s.sprite.y + s.sprite.h <= layout.height, `${s.slug} ${s.state} overflows height`);
  }
});

test('generated atlas slices back to the source sprites pixel-for-pixel', () => {
  const { width, height, rgba } = buildAtlas(PALETTE);
  const sliced = sliceAtlas({ width, height, rgba });
  const drawn = {};
  for (const cfg of WINDOW_TYPES) drawn[cfg.slug] = drawWindow(cfg, PALETTE);

  for (const s of sliced) {
    const ref = drawn[s.slug][s.state];
    assert.equal(s.width, ref.width);
    assert.equal(s.height, ref.height);
    let diff = 0;
    for (let p = 0; p < s.width * s.height; p++) {
      const i = p * 4;
      if (ref.rgba[i + 3] === 0) continue; // transparent in src → atlas shows page bg
      if (s.rgba[i] !== ref.rgba[i] || s.rgba[i + 1] !== ref.rgba[i + 1] || s.rgba[i + 2] !== ref.rgba[i + 2]) diff++;
    }
    assert.equal(diff, 0, `${s.slug} ${s.state}: ${diff} px differ`);
  }
});
