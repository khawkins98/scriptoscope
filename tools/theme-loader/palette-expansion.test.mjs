import assert from 'node:assert/strict';
import test from 'node:test';
import { decodeCicn } from './decoders/cicn.js';
import { decodePpat } from './decoders/ppat.js';

function indexedArt(kind, flags = 0, missing = false) {
  const bytes = new Uint8Array(160), view = new DataView(bytes.buffer);
  const word = (offset, value) => view.setUint16(offset, value);
  const map = kind === 'cicn' ? 0 : 28, pixels = kind === 'cicn' ? 115 : 80, table = kind === 'cicn' ? 83 : 88;
  word(map + 4, 0x8004); word(map + 10, 2); word(map + 12, 3);
  word(map + 32, 8); word(map + 34, 1); word(map + 36, 8); view.setUint32(map + 42, table);
  if (kind === 'cicn') { word(54, 1); word(60, 1); word(62, 2); bytes[82] = 0x80; }
  else { word(0, 1); view.setUint32(2, 28); view.setUint32(6, pixels); }
  word(table + 4, flags); word(table + 6, 2);
  [[0, 65535, 0x1234, 0x5678], [1, 0, 0x8000, 65535], [1, 0xffff, 0xffff, 0xffff]]
    .forEach((entry, i) => entry.forEach((value, channel) => word(table + 8 + i * 8 + channel * 2, value)));
  bytes.set([1, 0, missing ? 3 : 1, 255, 0, 1, 0, 255], pixels);
  return bytes;
}
for (const [kind, decode] of [['cicn', decodeCicn], ['ppat', decodePpat]]) {
  test(`${kind}: first duplicate, padded rows and caller-specific alpha`, () => {
    const alpha = kind === 'cicn' ? [255, 0, 255, 255, 255, 255] : Array(6).fill(255);
    const colors = [[0,128,255], [255,18,86], [0,128,255], [255,18,86], [0,128,255], [255,18,86]];
    assert.deepEqual([...decode(indexedArt(kind)).rgba], colors.flatMap((rgb, i) => [...rgb, alpha[i]]));
    assert.equal(decode(indexedArt(kind, 0x4000)), null);
  });
  test(`${kind}: lazy realization, reentrancy, byte coercion and strict diagnostics`, () => {
    const calls = [];
    const decoded = decode(indexedArt(kind), { realizeRgb16(rgb) {
      calls.push([...rgb]); assert.equal(decode(indexedArt(kind)).rgba.length, 24);
      rgb[0] = 99; return [511.9, -3.2, NaN];
    }});
    // CICN's separately specified sampling pass can invoke the callback again.
    assert.deepEqual(calls.slice(0, 2), [[0,32768,65535], [65535,4660,22136]]);
    assert.deepEqual([...decoded.rgba.slice(0, 3)], [255,253,0]);
    assert.throws(() => decode(indexedArt(kind, 0, true), { realizeRgb16: rgb => rgb }), {
      name: 'DisplayProfileError', message: `Missing ${kind === 'cicn' ? 'ordinary' : 'pattern'} palette index`, code: 'UNSUPPORTED_SOURCE_COLOR',
    });
  });
}

test('cicn: finite-transfer fallthrough retains changed raster dimensions', () => {
  for (const width of [0, 4]) {
    let calls = 0;
    const run = () => decodeCicn(indexedArt('cicn'), {
      finiteTransfer(parsed) { parsed.pmap.width = width; return null; },
      realizeRgb16(rgb) { calls++; return rgb.map(value => value >> 8); },
    });
    if (width === 0) { assert.equal(run().rgba.length, 0); assert.equal(calls, 0); }
    else assert.throws(run, { name: 'DisplayProfileError', code: 'UNSUPPORTED_SOURCE_COLOR', message: 'Missing ordinary palette index' });
  }
});

test('cicn: realization observes masks in pixel order', () => {
  const bytes = new Uint8Array(109), view = new DataView(bytes.buffer);
  for (const [offset, value] of [[4,0x8002],[10,1],[12,2],[32,8],[34,1],[36,8],[54,1],[60,1],[62,2],[89,1],[99,1]]) view.setUint16(offset, value);
  bytes[82] = 255; bytes[108] = 1;
  let parsed, calls = 0;
  const decoded = decodeCicn(bytes, {
    finiteTransfer(value) { parsed = value; return null; },
    realizeRgb16(rgb) { if (++calls === 2) parsed.maskAlpha[0] = 0; return rgb.map(value => value >> 8); },
  });
  assert.equal(decoded.rgba[3], 255);
  assert.equal(calls, 4);
});
