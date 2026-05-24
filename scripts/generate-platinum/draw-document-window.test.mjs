// scripts/generate-platinum/draw-document-window.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { drawDocumentWindow } from './draw-document-window.mjs';
import { PALETTE } from './palette.mjs';
import { METRICS } from './metrics.mjs';

const px = (img, x, y) => {
  const i = (y * img.width + x) * 4;
  return [img.rgba[i], img.rgba[i + 1], img.rgba[i + 2]];
};

test('active min-cicn: perimeter is the black outer outline, stipple alternates per row', () => {
  const { active } = drawDocumentWindow(PALETTE);
  assert.deepEqual(px(active, 0, 0), PALETTE.frameOutline);       // black outer window outline
  // title fill stipple: row 0 has fore at the lit column, row 1 is back
  const titleY0 = METRICS.frameInset;          // first title row
  assert.deepEqual(px(active, METRICS.cells.leftFixed, titleY0), PALETTE.titleFillFore);
  assert.deepEqual(px(active, METRICS.cells.leftFixed, titleY0 + 1), PALETTE.titleFillBack);
});

test('active min-cicn: bottom-right corner is the black outer outline', () => {
  const { active } = drawDocumentWindow(PALETTE);
  assert.deepEqual(px(active, active.width - 1, active.height - 1), PALETTE.frameOutline);
});

test('returns active + inactive + stipple buffers with sane dimensions', () => {
  const out = drawDocumentWindow(PALETTE);
  for (const k of ['active', 'inactive', 'stipple']) {
    assert.ok(out[k].width > 0 && out[k].height > 0 && out[k].rgba.length === out[k].width * out[k].height * 4);
  }
  assert.equal(out.active.height, METRICS.titleBarHeight + 2 * METRICS.frameInset + 1);
});
