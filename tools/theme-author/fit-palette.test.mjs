import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Raster } from './raster.js';
import { fitPalette, colorCount } from './fit-palette.js';

test('fitPalette preserves protected swatches while fitting visible colours', () => {
  const raster = new Raster(4, 1)
    .swatch(0, 0, '#ff0000')
    .set(1, 0, '#ee0000')
    .set(2, 0, '#0000ff')
    .set(3, 0, '#0000ff');
  assert.equal(fitPalette(raster, 2), raster);
  assert.equal(colorCount(raster), 2);
  assert.deepEqual([...raster.rgba.subarray(0, 4)], [255, 0, 0, 1]);
  assert.deepEqual([...raster.rgba.subarray(4, 8)], [255, 0, 0, 255]);
});

test('fitPalette rejects an impossible swatch limit without mutating the raster', () => {
  const raster = new Raster(3, 1)
    .swatch(0, 0, '#ff0000')
    .swatch(1, 0, '#0000ff')
    .set(2, 0, '#00ff00');
  const before = raster.rgba.slice();
  assert.throws(() => fitPalette(raster, 1), /2 protected swatch colours exceed the 1-colour limit/);
  assert.deepEqual(raster.rgba, before);
});

test('fitPalette rejects invalid limits even for an empty palette', () => {
  for (const max of [0, -1, 257, 1.5, NaN, Infinity]) {
    assert.throws(() => fitPalette(new Raster(1, 1), max), /integer from 1 to 256/);
  }
});
