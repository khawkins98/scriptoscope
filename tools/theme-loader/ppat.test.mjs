import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodePpat } from './decoders/ppat.js';

// Independent serialized fixtures, not written by a production resource helper.
// Apple IM: Imaging With QuickDraw4-103/104 defines offsets and ColorSpecs;
// Technical Note QD13 defines ctFlags bit15 (position) and bit14 (palette).
const rgb = [[255,0,0], [0,255,0], [0,0,255], [255,255,0],
  [255,0,255], [0,255,255], [255,255,255], [0,0,0]];
const rgba = rows => rows.flatMap(row => row.flatMap(color => [...color, 255]));
const red = [255,0,0], green = [0,255,0], blue = [0,0,255], yellow = [255,255,0];
const magenta = [255,0,255], cyan = [0,255,255], white = [255,255,255], black = [0,0,0];
const expected = rgba([[red, green, blue, yellow], [magenta, cyan, white, black]]);

function indexedFixture({ gap = 0, flags = 0, depth = 4,
  entries = rgb.map((color, value) => ({ value, color })), pixels } = {}) {
  const rowBytes = depth === 4 ? 4 : 6;
  const table = 78 + rowBytes * 2 + gap;
  const bytes = new Uint8Array(table + 8 + entries.length * 8);
  const v = new DataView(bytes.buffer);
  v.setUint16(0, 1); // full-color PixPat
  v.setUint32(2, 28); v.setUint32(6, 78); v.setUint16(14, 0xffff);
  // PixMap starts at28. Non-image row padding contains distractor indices.
  v.setUint16(32, 0x8000 | rowBytes);
  v.setInt16(38, 2); v.setInt16(40, 4); // bounds bottom/right
  v.setUint32(50, 0x00480000); v.setUint32(54, 0x00480000);
  v.setUint16(60, depth); v.setUint16(62, 1); v.setUint16(64, depth);
  v.setUint32(70, table); // authoritative serialized pmTable offset
  bytes.set(pixels ?? (depth === 4
    ? [0x01, 0x23, 0xff, 0xee, 0x45, 0x67, 0xcc, 0xdd]
    : [0, 1, 2, 3, 0xff, 0xee, 4, 5, 6, 7, 0xcc, 0xdd]), 78);
  v.setUint16(table + 4, flags); v.setInt16(table + 6, entries.length - 1);
  entries.forEach(({ value, color }, i) => {
    v.setUint16(table + 8 + i * 8, value);
    color.forEach((channel, j) => v.setUint16(table + 10 + i * 8 + j * 2, channel * 257));
  });
  return bytes;
}

for (const depth of [4, 8]) test(`ppat ${depth} bpp follows pmTable beyond padded rows`, () => {
  const result = decodePpat(indexedFixture({ gap: 8, depth }));
  assert.equal(result.width, 4); assert.equal(result.height, 2);
  assert.deepEqual([...result.rgba], expected);
});

test('ppat pixel-map tables use explicit values even when records are permuted', () => {
  const entries = rgb.map((color, value) => ({ value, color })).reverse();
  assert.deepEqual([...decodePpat(indexedFixture({ entries })).rgba], expected);
});

test('ppat sparse pixel-map values do not fall back to record position', () => {
  const entries = [{ value: 7, color: blue }, { value: 2, color: red }];
  const pixels = [0x27, 0x72, 0xff, 0xee, 0x72, 0x27, 0xcc, 0xdd];
  assert.deepEqual([...decodePpat(indexedFixture({ entries, pixels })).rgba],
    rgba([[red, blue, blue, red], [blue, red, red, blue]]));
});

test('ppat device tables ignore ColorSpec.value and use record position', () => {
  const entries = rgb.map(color => ({ value: 37, color }));
  assert.deepEqual([...decodePpat(indexedFixture({ flags: 0x8000, entries })).rgba], expected);
});

for (const flags of [0x4000, 0xc000]) test(`ppat palette-relative table 0x${flags.toString(16)} is explicitly unsupported`, () => {
  assert.equal(decodePpat(indexedFixture({ flags })), null);
});

test('ppat rejects an out-of-resource color table and truncated ColorSpecs', () => {
  const bytes = indexedFixture();
  const wrong = bytes.slice(); new DataView(wrong.buffer).setUint32(70, bytes.length - 4);
  assert.throws(() => decodePpat(wrong), /color table/i);
  assert.throws(() => decodePpat(bytes.subarray(0, bytes.length - 1)), /color table/i);
});
