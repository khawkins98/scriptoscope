// Byte-indexed lookup paths must be indistinguishable from the keyed paths they
// shortcut: same bytes, same errors at the same pixel, same callback sequence.
// A plain array of the same indices always takes the keyed path, so each case
// runs both and compares everything a caller can observe.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { expandIndexedPixels, expandIndexedRgba } from './decoders/shared.js';
import { inspectCicnBody } from './cicn-body.js';
import { compareOpaqueSampling } from './sampling-equivalence.js';
import { DisplayProfileError } from './display-profile.js';

function rng(seed) {
  let state = seed >>> 0;
  return max => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return Math.floor(state / 0x100000000 * max); };
}
/** Run and describe: the value or the thrown error, never a rejection of the test. */
function outcome(run) {
  try { return { value: run() }; } catch (error) { return { thrown: [error.constructor.name, error.message, error.code] }; }
}
const firstOccurrences = values => [...new Set(values)];

function randomTable(random, { positional, size, values }) {
  const entries = [];
  for (let i = 0; i < size; i++) entries.push({ value: random(values), r: random(65536), g: random(65536), b: random(65536) });
  return { flags: positional ? 0x8000 : 0, entries };
}

test('rgba expansion: byte and keyed paths agree on bytes, realizer calls, mask reads and the failing pixel', () => {
  const random = rng(0xc1c4);
  let failures = 0, realized = 0;
  for (let round = 0; round < 400; round++) {
    const width = 1 + random(9), height = 1 + random(7), count = width * height;
    const positional = random(2) === 0;
    const table = randomTable(random, { positional, size: 1 + random(12), values: 14 });
    const keys = table.entries.map((entry, position) => positional ? position : entry.value), stray = random(2) === 0;
    const indices = Uint8Array.from({ length: count }, () => stray && random(8) === 0 ? random(256) : keys[random(keys.length)]);
    const mask = [null, { width, height }, { width: Math.max(1, width - 2), height: height + 1 }][random(3)];
    const maskAlpha = mask ? Uint8Array.from({ length: mask.width * mask.height }, () => random(2) * 255) : undefined;
    const useRealizer = random(2) === 0;
    const run = source => {
      const calls = [], rgba = new Uint8Array(count * 4).fill(7);
      const realizer = useRealizer ? raw => { calls.push([...raw]); return raw.map(value => (value >> 8) ^ 0x5a); } : undefined;
      const result = outcome(() => expandIndexedRgba(source, rgba, table, realizer, 'Missing test palette index', width, height, mask, maskAlpha) === rgba);
      return { result, calls, rgba: Array.from(rgba) };
    };
    const bytes = run(indices), keyed = run(Array.from(indices));
    assert.deepEqual(bytes, keyed, `round ${round}`);
    if (bytes.result.thrown) {
      failures++;
      assert.deepEqual(bytes.result.thrown, ['DisplayProfileError', 'Missing test palette index', 'UNSUPPORTED_SOURCE_COLOR']);
    } else if (useRealizer) {
      realized++;
      assert.equal(bytes.calls.length, new Set(indices).size, 'one realization per distinct index');
    }
  }
  assert.ok(failures > 20 && realized > 20, 'both outcomes are exercised');
});

test('rgba expansion realizes each distinct index once, at its first raster occurrence, and stops at the first missing index', () => {
  const table = { flags: 0, entries: [
    { value: 5, r: 0x1100, g: 0x2200, b: 0x3300 }, { value: 2, r: 0x4400, g: 0x5500, b: 0x6600 },
    { value: 5, r: 0xffff, g: 0xffff, b: 0xffff }, { value: 9, r: 0x7700, g: 0x8800, b: 0x9900 },
  ] };
  const calls = [], realizer = raw => { calls.push(raw.join()); return raw.map(value => value >> 8); };
  const rgba = new Uint8Array(6 * 4);
  expandIndexedRgba(Uint8Array.of(9, 5, 9, 2, 5, 2), rgba, table, realizer, 'missing', 3, 2);
  assert.deepEqual(calls, ['30464,34816,39168', '4352,8704,13056', '17408,21760,26112']);
  assert.deepEqual(Array.from(rgba), [
    0x77, 0x88, 0x99, 255, 0x11, 0x22, 0x33, 255, 0x77, 0x88, 0x99, 255,
    0x44, 0x55, 0x66, 255, 0x11, 0x22, 0x33, 255, 0x44, 0x55, 0x66, 255,
  ]);

  calls.length = 0;
  const partial = new Uint8Array(4 * 4).fill(1);
  assert.throws(() => expandIndexedRgba(Uint8Array.of(2, 2, 200, 9), partial, table, realizer, 'Missing ordinary palette index', 2, 2),
    error => error instanceof DisplayProfileError && error.message === 'Missing ordinary palette index' && error.code === 'UNSUPPORTED_SOURCE_COLOR');
  assert.deepEqual(calls, ['17408,21760,26112'], 'nothing is realized past the failing pixel');
  assert.deepEqual(Array.from(partial), [0x44, 0x55, 0x66, 255, 0x44, 0x55, 0x66, 255, 1, 1, 1, 1, 1, 1, 1, 1]);

  // Without a realizer a missing index is black, not an error.
  assert.deepEqual(Array.from(expandIndexedRgba(Uint8Array.of(200), new Uint8Array(4), table, undefined, 'missing', 1, 1)), [0, 0, 0, 255]);
});

test('rgba expansion keeps the keyed path for non-byte indices, non-byte output and short rasters', () => {
  const table = { flags: 0, entries: [{ value: 300, r: 0x0a00, g: 0x0b00, b: 0x0c00 }, { value: 1, r: 0xff00, g: 0x8000, b: 0x0100 }] };
  // A 16-bit index is looked up by its full value, never truncated to a byte.
  assert.deepEqual(Array.from(expandIndexedRgba(Uint16Array.of(300, 44, 1), new Uint8Array(12), table, undefined, 'missing', 3, 1)),
    [0x0a, 0x0b, 0x0c, 255, 0, 0, 0, 255, 0xff, 0x80, 0x01, 255]);
  assert.throws(() => expandIndexedRgba(Uint16Array.of(44), new Uint8Array(4), table, raw => raw, 'wide', 1, 1), { message: 'wide' });
  // Output containers keep their own stores: no byte wrapping through a lookup table.
  const wide = [];
  expandIndexedRgba(Uint8Array.of(1), wide, table, raw => raw, 'missing', 1, 1);
  assert.deepEqual(wide, [0xff00, 0x8000, 0x0100, 255]);
  // Pixels past the end of the raster share one undefined index: realized once.
  for (const source of [Uint8Array.of(1), [1]]) {
    const calls = [], rgba = new Uint8Array(12);
    expandIndexedRgba(source, rgba, table, undefined, 'missing', 3, 1);
    assert.deepEqual(Array.from(rgba), [0xff, 0x80, 0x01, 255, 0, 0, 0, 255, 0, 0, 0, 255]);
    assert.throws(() => expandIndexedRgba(source, new Uint8Array(12), table, raw => { calls.push(raw); return raw; }, 'short', 3, 1), { message: 'short' });
    assert.equal(calls.length, 1);
  }
});

test('body inspection: byte and keyed membership agree, including duplicate and wide palette values', () => {
  const random = rng(0xb0d1);
  const seen = new Set();
  for (let round = 0; round < 600; round++) {
    const pixelSize = [1, 2, 4, 8][random(4)], width = 1 + random(8), height = 1 + random(4);
    const map = { bounds: { left: 0, top: 0 }, width, height, rowBytes: width };
    const pmap = { ...map, pixelSize, pixelType: 0, cmpCount: 1, cmpSize: pixelSize, packType: 0, planeBytes: 0 };
    const positional = random(2) === 0, size = 1 + random(6);
    const table = positional ? randomTable(random, { positional, size, values: 8 })
      : { flags: 0, entries: firstOccurrences(Array.from({ length: size }, () => [0, 1, 2, 3, 4, 5, 255, 256, 261][random(9)]))
        .map(value => ({ value, r: random(2) * 65535, g: random(2) * 65535, b: random(2) * 65535 })) };
    const indices = Uint8Array.from({ length: width * height }, () => [0, 1, 2, 3, 4, 5, 255][random(random(3) ? 3 : 7)]);
    const bytes = inspectCicnBody(pmap, map, map, table, indices);
    assert.deepEqual(bytes, inspectCicnBody(pmap, map, map, table, Array.from(indices)), `round ${round}`);
    const used = new Set(indices), keys = new Set(table.entries.map((entry, position) => positional ? position : entry.value));
    if (bytes.reason === 'missing-palette-index') assert.ok([...used].some(index => !keys.has(index)));
    else assert.ok([...used].every(index => keys.has(index)));
    seen.add(bytes.reason);
  }
  assert.deepEqual([...seen].sort(), ['aligned-color-source', 'missing-palette-index', 'unsupported-one-bit-palette']);
  // A palette value of 256 is not byte index 0.
  const map = { bounds: { left: 0, top: 0 }, width: 1, height: 1, rowBytes: 1 };
  const pmap = { ...map, pixelSize: 8, pixelType: 0, cmpCount: 1, cmpSize: 8, packType: 0, planeBytes: 0 };
  assert.equal(inspectCicnBody(pmap, map, map, { flags: 0, entries: [{ value: 256, r: 0, g: 0, b: 0 }] }, Uint8Array.of(0)).reason, 'missing-palette-index');
});

test('sampling comparison: byte and keyed memo agree on the record and on every sampler and realizer call', () => {
  const random = rng(0x5a3e);
  const statuses = new Set();
  for (let round = 0; round < 600; round++) {
    const width = 1 + random(7), height = 1 + random(5), count = width * height;
    const pmap = { isPixMap: true, pixelType: 0, cmpCount: 1, cmpSize: 8, pixelSize: 8, packType: 0, bounds: { left: 0, top: 0 }, width, height };
    const mask = { bounds: { left: 0, top: 0 }, width, height };
    const indices = Uint8Array.from({ length: count }, () => random(6));
    const colors = Array.from({ length: 6 }, () => [random(3) * 0x4000, random(2) * 0x8000, 0]);
    const rgba = new Uint8Array(count * 4);
    const disagree = random(3) === 0 ? random(6) : -1, unsafe = random(3) === 0 ? random(6) : -1;
    for (let i = 0; i < count; i++) {
      const color = colors[indices[i]];
      rgba.set([color[0] >> 8, color[1] >> 8, indices[i] === disagree ? 9 : 0, random(4) ? 255 : 0], i * 4);
    }
    const useRealizer = random(2) === 0, coordinatePlane = random(4) === 0;
    const run = source => {
      const calls = [];
      const sample = (x, y) => { calls.push(['sample', x, y]); const index = source[y * width + x]; return index === unsafe ? null : colors[index]; };
      const realizer = useRealizer ? rgb16 => { calls.push(['realize', ...rgb16]); return rgb16.map(value => value >> 8); } : undefined;
      return { record: compareOpaqueSampling(source, rgba, pmap, mask, sample, realizer, 'test-policy', coordinatePlane), calls };
    };
    const bytes = run(indices), keyed = run(Array.from(indices));
    assert.deepEqual(bytes, keyed, `round ${round}`);
    statuses.add(bytes.record.status);
    const samples = bytes.calls.filter(call => call[0] === 'sample');
    const opaque = [];
    for (let i = 0; i < count; i++) if (rgba[i * 4 + 3] !== 0) opaque.push(i);
    if (bytes.record.status !== 'different') {
      // No early exit: one sample per distinct opaque index at its first raster
      // occurrence, or one per opaque pixel for a coordinate plane.
      const expected = coordinatePlane ? opaque : firstOccurrences(opaque.map(i => indices[i])).map(index => opaque.find(i => indices[i] === index));
      assert.deepEqual(samples, expected.map(i => ['sample', i % width, Math.floor(i / width)]), `round ${round}`);
    } else {
      const last = samples.at(-1), at = last[2] * width + last[1];
      assert.equal(indices[at], disagree, 'the first mismatch ends the scan');
    }
  }
  assert.deepEqual([...statuses].sort(), ['different', 'equivalent', 'unknown']);
});

test('packed expansion matches a bit-string reading for plain-array and out-of-range sources', () => {
  const random = rng(0x9ac3);
  for (const depth of [1, 2, 4, 8]) for (const width of [1, 5, 8, 9, 17]) {
    const height = 2, rowBytes = Math.ceil(width * depth / 8) + 1;
    const packed = Array.from({ length: rowBytes * height }, () => random(256));
    const expected = [];
    for (let y = 0; y < height; y++) {
      const bits = packed.slice(y * rowBytes, (y + 1) * rowBytes).map(byte => byte.toString(2).padStart(8, '0')).join('');
      for (let x = 0; x < width; x++) expected.push(parseInt(bits.slice(x * depth, (x + 1) * depth), 2));
    }
    assert.deepEqual(Array.from(expandIndexedPixels(packed, width, height, depth, rowBytes)), expected, JSON.stringify({ depth, width }));
    assert.deepEqual(Array.from(expandIndexedPixels(Uint8Array.from(packed), width, height, depth, rowBytes)), expected);
    // Values beyond a byte contribute only their low bits, at every depth.
    assert.deepEqual(Array.from(expandIndexedPixels(packed.map(byte => byte + 0x300), width, height, depth, rowBytes)), expected);
  }
  assert.throws(() => expandIndexedPixels(new Uint8Array(4), 2, 2, 16, 2), /Unsupported pixelSize: 16/);
  assert.deepEqual(Array.from(expandIndexedPixels(new Uint8Array(4), 2, 0, 16, 2)), []);
});
