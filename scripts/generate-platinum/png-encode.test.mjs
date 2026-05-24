// scripts/generate-platinum/png-encode.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodePng } from '../lib/png-encode.mjs';

test('encodePng emits a valid PNG signature + IHDR dimensions', () => {
  const rgba = new Uint8Array(2 * 2 * 4).fill(255); // 2x2 opaque white
  const png = encodePng(2, 2, rgba);
  // PNG signature
  assert.deepEqual([...png.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  // IHDR width/height at bytes 16..24 (8 sig + 4 len + 4 'IHDR')
  assert.equal(png.readUInt32BE(16), 2);
  assert.equal(png.readUInt32BE(20), 2);
});
