import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeCicn } from './decoders/cicn.js';
import { loadKaleidoscopeScheme } from './loadKaleidoscopeScheme.js';
import { forkOf } from '../../tests/resource-provenance/fixtures.mjs';

// Independent literal-byte fixtures following Apple IM QuickDraw 4-105/106.
// No decoder/shared helper or production encoder constructs expected bytes/RGBA.
const red = [255, 0, 0], green = [0, 255, 0], blue = [0, 0, 255], yellow = [255, 255, 0];
const colors = [[0, ...red], [1, ...green], [2, ...blue], [3, ...yellow]];
function icon({ depth = 2, pixels = [0x18, 0xff, 0xe4, 0x5a], entries = colors, flags = 0,
  width = 3, height = 2, stride = 2, mask = [0xa0, 0x5a, 0x40, 0xa5], maskStride = 2,
  bitmap = [0xff, 0x17, 0x00, 0xe9], origin = 0 } = {}) {
  const tableOffset = 82 + mask.length + bitmap.length;
  const bytes = new Uint8Array(tableOffset + 8 + entries.length * 8 + pixels.length);
  const v = new DataView(bytes.buffer), word = (o, n) => v.setUint16(o, n);
  word(4, 0x8000 | stride); word(6, origin); word(8, origin); word(10, origin + height); word(12, origin + width);
  v.setUint32(22, 72 << 16); v.setUint32(26, 72 << 16); word(32, depth); word(34, 1); word(36, depth);
  word(54, maskStride); word(60, height); word(62, width);
  if (bitmap.length) { word(68, 2); word(74, 2); word(76, 3); }
  bytes.set(mask, 82); bytes.set(bitmap, 82 + mask.length);
  word(tableOffset + 4, flags); word(tableOffset + 6, entries.length - 1);
  entries.forEach(([value, r, g, b], i) => {
    const o = tableOffset + 8 + i * 8;
    word(o, value); word(o + 2, r * 257); word(o + 4, g * 257); word(o + 6, b * 257);
  });
  bytes.set(pixels, tableOffset + 8 + entries.length * 8);
  return bytes;
}
const rgba = (rgb, alpha) => rgb.flatMap((color, i) => [...color, alpha[i]]);
const maskAlpha = [255, 0, 255, 0, 255, 0];
const sixColors = [red, green, blue, yellow, blue, green];
for (const [depth, pixels, entries, stride, expected] of [
  [1, [0xa0, 0x7f, 0x40, 0xff], colors.slice(0, 2), 2, [green, red, green, red, green, red]],
  [2, [0x18, 0xff, 0xe4, 0x5a], colors, 2, sixColors],
  [4, [0x01, 0x2f, 0x32, 0x1e], colors, 2, sixColors],
  [8, [0, 1, 2, 0xff, 3, 2, 1, 0xee], colors, 4, sixColors],
]) test(`cicn ${depth}-bit MSB pixels, padded rows and independent binary mask`, () => {
  const actual = decodeCicn(icon({ depth, pixels, entries, stride, origin: 7 }));
  assert.deepEqual([actual.width, actual.height], [3, 2]);
  assert.deepEqual([...actual.rgba], rgba(expected, maskAlpha));
});

test('cicn mask crosses byte boundary and skips independent four-byte row padding', () => {
  const actual = decodeCicn(icon({ depth: 1, width: 9, stride: 2, maskStride: 4,
    pixels: [0x80, 0x80, 0x01, 0x00], mask: [0x80, 0x80, 0xff, 0xff, 0x01, 0x00, 0xff, 0xff], entries: colors.slice(0, 2) }));
  assert.deepEqual([...actual.rgba], rgba(
    [green, red, red, red, red, red, red, red, green, red, red, red, red, red, red, red, green, red],
    [255, 0, 0, 0, 0, 0, 0, 0, 255, 0, 0, 0, 0, 0, 0, 0, 255, 0]));
});

test('cicn flags0 maps permuted and sparse ColorSpec.value instead of position', () => {
  assert.deepEqual([...decodeCicn(icon({ entries: [colors[2], colors[0], colors[3], colors[1]] })).rgba], rgba(sixColors, maskAlpha));
  assert.deepEqual([...decodeCicn(icon({ pixels: [0x30, 0xff, 0xc0, 0xff], entries: [colors[3], colors[0]] })).rgba],
    rgba([red, yellow, red, yellow, red, red], maskAlpha));
});

test('cicn bit15 selects position and ignores ColorSpec.value', () => {
  assert.deepEqual([...decodeCicn(icon({ flags: 0x8000, entries: colors.map((c, i) => [20 + i, ...c.slice(1)]) })).rgba], rgba(sixColors, maskAlpha));
});

test('cicn ignores monochrome fallback pixels and accepts a NIL fallback', () => {
  const expected = rgba(sixColors, maskAlpha);
  for (const bitmap of [[], [0, 0, 0, 0], [255, 255, 255, 255]]) {
    assert.deepEqual([...decodeCicn(icon({ bitmap })).rgba], expected);
  }
  const nilWithBounds = icon({ bitmap: [] });
  const header = new DataView(nilWithBounds.buffer);
  header.setUint16(74, 2); header.setUint16(76, 3); // rowBytes=0: no fallback data
  assert.deepEqual([...decodeCicn(nilWithBounds).rgba], expected);
});

test('cicn undefined-index black is retained compatibility, not original color truth', () => {
  assert.deepEqual([...decodeCicn(icon({ entries: [colors[0], colors[3]] })).rgba],
    rgba([red, [0, 0, 0], [0, 0, 0], yellow, [0, 0, 0], [0, 0, 0]], maskAlpha));
});

test('cicn destination-window palette requires unavailable destination context', () => {
  for (const flags of [0x4000, 0xc000]) {
    const bytes = icon({ flags });
    assert.equal(decodeCicn(bytes), null);
    assert.throws(() => decodeCicn(bytes.subarray(0, bytes.length - 1)), /Truncated cicn pixel data/);
  }
});

test('cicn rejects truncated required sections rather than synthesizing pixels', () => {
  const valid = icon();
  for (const [end, message] of [[0, /headers/], [81, /headers/], [85, /mask and monochrome/], [94, /table header/], [110, /table records/], [valid.length - 1, /pixel data/]]) {
    assert.throws(() => decodeCicn(valid.subarray(0, end)), message);
  }
});

test('cicn rejects invalid dimensions, undersized strides and invalid table size', () => {
  for (const [offset, value, message] of [[10, 0, /dimensions/], [12, 0xffff, /dimensions/], [60, 0, /dimensions/],
    [4, 0x8000, /pixel map rowBytes/], [54, 0, /mask rowBytes/], [76, 17, /monochrome bitmap rowBytes/], [96, 0xfffe, /color table size/]]) {
    const bytes = icon(); new DataView(bytes.buffer).setUint16(offset, value);
    assert.throws(() => decodeCicn(bytes), message);
  }
  assert.throws(() => decodeCicn(icon({ depth: 8, stride: 2 })), /pixel map rowBytes/);
  assert.throws(() => decodeCicn(icon({ depth: 16 })), /Unsupported pixelSize/);
});


test('cicn unsupported palette is skipped with no converted asset or provenance binding', async () => {
  const bytes = forkOf([{ type: 'cicn', id: -10239, data: icon({ flags: 0x4000 }) }]);
  const raw = await loadKaleidoscopeScheme(bytes, { provenance: true, encodeAssets: false });
  assert.deepEqual(raw.assets, []);
  assert.deepEqual(raw.manifest.chromeElements ?? {}, {});
  assert.deepEqual(raw.byteProvenance.resources.map(r => [r.type, r.signedId, r.status]), [['cicn', -10239, 'skipped']]);
  let allocations = 0;
  const encoded = await loadKaleidoscopeScheme(bytes, { provenance: true, encodeAssets: true, assetUrlFactory() { allocations++; return 'blob:unexpected'; } });
  assert.equal(allocations, 0);
  assert.deepEqual(encoded.manifest.chromeElements ?? {}, {});
  assert.equal(encoded.byteProvenance.resources[0].status, 'skipped');
  encoded.dispose();
});
