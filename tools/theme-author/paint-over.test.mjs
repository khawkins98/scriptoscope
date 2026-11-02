import { test } from 'node:test';
import assert from 'node:assert/strict';
import { paintOver } from './paint-over.js';

// A 9×3 "concept" at 3× scale: one red art pixel, one blue, one backdrop.
function concept() {
  const width = 9, height = 3, rgba = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const c = x < 3 ? [250, 10, 10] : x < 6 ? [10, 10, 240] : [200, 200, 200];
    rgba.set([...c, 255], (y * width + x) * 4);
  }
  rgba.set([10, 10, 240, 255], 0); // one stray pixel the mode vote should ignore
  return { width, height, rgba };
}

test('paintOver shrinks by scale, snaps to the palette and keys out the backdrop', () => {
  const r = paintOver(concept(), { crop: { x: 0, y: 0, w: 9, h: 3 }, scale: 3, palette: ['#ff0000', '#0000ff'], key: '#c8c8c8' });
  assert.equal(r.width, 3);
  assert.equal(r.height, 1);
  assert.deepEqual([...r.rgba.subarray(0, 4)], [255, 0, 0, 255]);
  assert.deepEqual([...r.rgba.subarray(4, 8)], [0, 0, 255, 255]);
  assert.equal(r.rgba[11], 0);
});
