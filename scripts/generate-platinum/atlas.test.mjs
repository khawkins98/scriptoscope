// scripts/generate-platinum/atlas.test.mjs
// The atlas generator + slicer share atlas-layout.mjs, so a generated PAINTABLE
// atlas (1×, magenta gutters) must slice back to the source sprites byte-for-byte
// across the WHOLE sprite rect (incl. transparent px → white backing). This
// guards the generate↔slice coordinate agreement.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPaintableAtlas, buildGuideAtlas } from './atlas.mjs';
import { sliceAtlas } from './slice-atlas.mjs';
import { drawWindow } from './draw-window.mjs';
import { WINDOW_TYPES } from './window-types.mjs';
import { computePaintableLayout, computeGuideLayout } from './atlas-layout.mjs';
import { PALETTE } from './palette.mjs';

const SPRITE_BG = [255, 255, 255]; // backing the paintable atlas paints behind each sprite

test('paintable atlas holds 26 sprites (13 types × active/inactive)', () => {
  const { slots } = computePaintableLayout();
  assert.equal(slots.length, 26);
  assert.equal(new Set(slots.map((s) => s.slug)).size, 13);
});

test('paintable atlas is drawn at 1× native', () => {
  const layout = computePaintableLayout();
  assert.equal(layout.scale, 1);
  for (const s of layout.slots) {
    assert.equal(s.sprite.w, s.cicnW, `${s.slug} ${s.state} sprite w != native`);
    assert.equal(s.sprite.h, s.cicnH, `${s.slug} ${s.state} sprite h != native`);
  }
});

test('every paintable sprite cell fits inside the atlas page', () => {
  const layout = computePaintableLayout();
  for (const s of layout.slots) {
    assert.ok(s.sprite.x >= 0 && s.sprite.y >= 0);
    assert.ok(s.sprite.x + s.sprite.w <= layout.width, `${s.slug} ${s.state} overflows width`);
    assert.ok(s.sprite.y + s.sprite.h <= layout.height, `${s.slug} ${s.state} overflows height`);
  }
});

test('generated 1× atlas slices back to the source sprites byte-for-byte', () => {
  const { width, height, rgba } = buildPaintableAtlas(PALETTE);
  const sliced = sliceAtlas({ width, height, rgba });
  const drawn = {};
  for (const cfg of WINDOW_TYPES) drawn[cfg.slug] = drawWindow(cfg, PALETTE);

  let perfect = 0;
  for (const s of sliced) {
    const ref = drawn[s.slug][s.state];
    assert.equal(s.width, ref.width);
    assert.equal(s.height, ref.height);
    let diff = 0;
    for (let p = 0; p < s.width * s.height; p++) {
      const i = p * 4;
      // The slicer reads the painted rect verbatim. Where the source sprite is
      // transparent, the paintable atlas shows the white backing, so compare the
      // slice's RGB against either the source RGB (opaque) or white (transparent).
      const transparent = ref.rgba[i + 3] === 0;
      const exp = transparent ? SPRITE_BG : [ref.rgba[i], ref.rgba[i + 1], ref.rgba[i + 2]];
      if (s.rgba[i] !== exp[0] || s.rgba[i + 1] !== exp[1] || s.rgba[i + 2] !== exp[2]) diff++;
    }
    assert.equal(diff, 0, `${s.slug} ${s.state}: ${diff} px differ`);
    if (diff === 0) perfect++;
  }
  assert.equal(perfect, 26);
});

test('reference-map (guide) atlas builds with labels + slice lines', () => {
  const guide = computeGuideLayout();
  assert.equal(guide.scale, 4);
  const built = buildGuideAtlas(PALETTE);
  assert.equal(built.width, guide.width);
  assert.equal(built.height, guide.height);
  // Every titled slot exposes a horizontal divider; all expose vertical cuts.
  for (const s of guide.slots) assert.equal(s.sliceLinesX.length, 2);
});
