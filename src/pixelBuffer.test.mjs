import '../tests/helpers/registerTs.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
const { PixelBuffer } = await import('./pixelBuffer.ts');

test('clipped alpha-over preserves straight-alpha rounding and transparent destination RGB', () => {
  const source = PixelBuffer.alloc(2, 2), target = PixelBuffer.alloc(3, 3);
  source.fillRect({ x: 0, y: 0, w: 2, h: 2 }, 100, 200, 80, 128);
  target.fillRect({ x: 0, y: 0, w: 3, h: 3 }, 20, 40, 60, 0);
  target.drawOver(source, 0, 0, { x: 1, y: 1, w: 1, h: 1 });
  assert.deepEqual(target.getPixel(1, 1), [60, 120, 70, 128]);
  for (const [x, y] of [[0, 0], [0, 1], [1, 0], [2, 1], [1, 2]])
    assert.deepEqual(target.getPixel(x, y), [20, 40, 60, 0]);
});

test('clipped alpha-over retains source order when source and destination alias', () => {
  const target = PixelBuffer.alloc(4, 1);
  for (let x = 0; x < 4; x++) target.setPixel(x, 0, x + 1, 0, 0, 255);
  target.drawOver(target, 1, 0, { x: 1, y: 0, w: 2, h: 1 });
  assert.deepEqual([0, 1, 2, 3].map(x => target.getPixel(x, 0)[0]), [1, 1, 1, 4]);
});

test('negative glyph origins clip in destination coordinates', () => {
  const source = PixelBuffer.alloc(2, 2), target = PixelBuffer.alloc(2, 2);
  source.setPixel(1, 1, 9, 8, 7, 255);
  target.drawOver(source, -1, -1, { x: 0, y: 0, w: 1, h: 1 });
  assert.deepEqual(target.getPixel(0, 0), [9, 8, 7, 255]);
  assert.deepEqual(target.getPixel(1, 1), [0, 0, 0, 0]);
});
