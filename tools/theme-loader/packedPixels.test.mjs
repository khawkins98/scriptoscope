import { test } from 'node:test';
import assert from 'node:assert/strict';
import { expandIndexedPixels, expandMask } from './decoders/shared.js';

test('packed pixels retain MSB-first depth, row padding and byte-view offsets', () => {
  let random = 0x51c0;
  for (const depth of [1, 2, 4, 8]) for (const width of [1, 3, 7, 8, 13, 16, 31]) for (const padding of [0, 1, 3]) {
    const height = 3, rowBytes = Math.ceil(width * depth / 8) + padding;
    const backing = new Uint8Array(rowBytes * height + 5), packed = backing.subarray(2, backing.length - 3);
    for (let i = 0; i < packed.length; i++) { random = (Math.imul(random, 1664525) + 1013904223) >>> 0; packed[i] = random >>> 24; }
    const expected = [];
    for (let y = 0; y < height; y++) {
      const bits = Array.from(packed.subarray(y * rowBytes, (y + 1) * rowBytes), b => b.toString(2).padStart(8, '0')).join('');
      for (let x = 0; x < width; x++) expected.push(parseInt(bits.slice(x * depth, (x + 1) * depth), 2));
    }
    assert.deepEqual(Array.from(expandIndexedPixels(packed, width, height, depth, rowBytes)), expected,
      JSON.stringify({ depth, width, padding }));
    if (depth === 1) assert.deepEqual(Array.from(expandMask(packed, width, height, rowBytes)), expected.map(bit => bit * 255));
  }
});

test('empty unsupported formats remain empty and truncated byte reads remain zero', () => {
  assert.deepEqual(Array.from(expandIndexedPixels(new Uint8Array(), 0, 4, 3, 0)), []);
  assert.throws(() => expandIndexedPixels(new Uint8Array(), 1, 1, 3, 1), /Unsupported pixelSize: 3/);
  for (const depth of [1, 2, 4, 8])
    assert.deepEqual(Array.from(expandIndexedPixels(new Uint8Array(), 3, 2, depth, 4)), [0, 0, 0, 0, 0, 0]);
});
