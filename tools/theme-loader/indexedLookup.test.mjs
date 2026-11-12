// The byte-table paths in the indexed decoders are checked against straightforward
// per-pixel, keyed reference implementations written here from the contract:
// same bytes, same records, same error at the same pixel, same callback sequence.
// The references share no code with the decoders. One deliberate difference
// (a realizer that reuses its returned array) is pinned separately at the end.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { expandIndexedPixels, expandIndexedRgba } from './decoders/shared.js';
import { inspectCicnBody } from './cicn-body.js';
import { compareOpaqueSampling, samplingEquivalenceRecord } from './sampling-equivalence.js';
import { DisplayProfileError } from './display-profile.js';
import { macRgbToSrgb } from './mac-gamma.js';

// ---- references -----------------------------------------------------------

/** Packed samples, leftmost first; unsupported depths fail at the first pixel. */
function referencePixels(packed, width, height, pixelSize, rowBytes) {
  const out = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (![1, 2, 4, 8].includes(pixelSize)) throw new Error(`Unsupported pixelSize: ${pixelSize}`);
    const perByte = 8 / pixelSize;
    const byte = packed[y * rowBytes + Math.floor(x / perByte)];
    out[y * width + x] = (byte >> ((perByte - 1 - (x % perByte)) * pixelSize)) & ((1 << pixelSize) - 1);
  }
  return out;
}

/** First-match (or positional) palette; one realization per distinct index, kept
 *  only when truthy; the realized value is read again for every pixel. */
function referenceRgba(indices, rgba, colorTable, realizeRgb16, missingMessage, width, height, mask, maskAlpha) {
  const palette = new Map();
  colorTable.entries.forEach((entry, position) => {
    const key = colorTable.flags & 0x8000 ? position : entry.value;
    if (!palette.has(key)) palette.set(key, [entry.r, entry.g, entry.b]);
  });
  const realized = new Map();
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = y * width + x, index = indices[i];
    let rgb = realized.get(index);
    if (!rgb) {
      if (realizeRgb16 && !palette.has(index)) throw new DisplayProfileError(missingMessage, 'UNSUPPORTED_SOURCE_COLOR');
      const raw = palette.get(index) ?? [0, 0, 0];
      rgb = realizeRgb16 ? realizeRgb16(raw) : raw.map(value => value >> 8);
      realized.set(index, rgb);
    }
    const [r, g, b] = rgb;
    rgba[i * 4] = r; rgba[i * 4 + 1] = g; rgba[i * 4 + 2] = b;
    rgba[i * 4 + 3] = mask ? (x < mask.width && y < mask.height ? maskAlpha[y * mask.width + x] : 255) : 255;
  }
  return rgba;
}

function referenceBody(pmap, mask, bitmap, table, indices) {
  const unsupported = reason => ({ status: 'unsupported', reason });
  const depthOk = [1, 2, 4, 8].includes(pmap.pixelSize) && pmap.pixelType === 0 && pmap.cmpCount === 1
    && pmap.cmpSize === pmap.pixelSize && pmap.packType === 0 && pmap.planeBytes === 0;
  const aligned = map => map.bounds.left === 0 && map.bounds.top === 0 && map.width === pmap.width && map.height === pmap.height
    && map.rowBytes >= Math.ceil(map.width * (map === pmap ? pmap.pixelSize : 1) / 8);
  if (!depthOk || ![pmap, mask, bitmap].every(aligned)) return unsupported('unsupported-source-layout');
  const palette = new Map();
  for (let position = 0; position < table.entries.length; position++) {
    const entry = table.entries[position], key = table.flags & 0x8000 ? position : entry.value;
    if (palette.has(key)) return unsupported('ambiguous-palette-index');
    palette.set(key, [entry.r, entry.g, entry.b]);
  }
  for (const index of new Set(indices)) if (!palette.has(index)) return unsupported('missing-palette-index');
  const all = (rgb, value) => rgb !== undefined && rgb.every(channel => channel === value);
  if (pmap.pixelSize === 1 && (palette.size !== 2 || !all(palette.get(0), 65535) || !all(palette.get(1), 0))) return unsupported('unsupported-one-bit-palette');
  return { status: 'ready', reason: 'aligned-color-source', pixelSize: pmap.pixelSize, sourceRect: { x: 0, y: 0, w: pmap.width, h: pmap.height } };
}

/** Opaque pixels in raster order; one sample per distinct index (every pixel for a
 *  coordinate plane); the first mismatch ends the scan. */
function referenceSampling(indices, rgba, pmap, mask, sample, realizeRgb16, displayPolicy, coordinatePlane = false) {
  const record = (status, reason) => samplingEquivalenceRecord(pmap.width, pmap.height, status, reason, displayPolicy);
  if (!pmap.isPixMap || pmap.pixelType !== 0 || pmap.cmpCount !== 1 || pmap.cmpSize !== pmap.pixelSize || pmap.packType !== 0
      || pmap.bounds.left !== 0 || pmap.bounds.top !== 0 || mask.bounds.left !== 0 || mask.bounds.top !== 0
      || mask.width !== pmap.width || mask.height !== pmap.height) return record('unknown', 'unsupported-layout');
  if (!sample) return record('unknown', 'missing-sampler');
  const verdicts = new Map();
  let unsafe = false;
  for (let i = 0; i < indices.length; i++) {
    if (rgba[i * 4 + 3] === 0) continue;
    let verdict = coordinatePlane ? undefined : verdicts.get(indices[i]);
    if (verdict === undefined) {
      const rgb16 = sample(i % pmap.width, Math.floor(i / pmap.width));
      if (!rgb16) verdict = 'unknown';
      else {
        const source = realizeRgb16 ? realizeRgb16(rgb16) : macRgbToSrgb(rgb16.map(value => value >> 8));
        const raw = [rgba[i * 4], rgba[i * 4 + 1], rgba[i * 4 + 2]];
        const raster = realizeRgb16 ? raw : macRgbToSrgb(raw);
        verdict = source.every((value, channel) => value === raster[channel]) ? 'equivalent' : 'different';
      }
      if (!coordinatePlane) verdicts.set(indices[i], verdict);
    }
    if (verdict === 'different') return record('different', 'opaque-display-mismatch');
    if (verdict === 'unknown') unsafe = true;
  }
  return unsafe ? record('unknown', 'unsafe-palette-access') : record('equivalent', 'all-opaque-display-rgb-equal');
}

// ---- generators -----------------------------------------------------------

function rng(seed) {
  let state = seed >>> 0;
  return max => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return Math.floor(state / 0x100000000 * max); };
}
/** The value, or what was thrown. Engine-worded TypeError text is not compared. */
function outcome(run) {
  try { return { value: run() }; } catch (error) {
    return { thrown: error instanceof TypeError ? ['TypeError'] : [error.constructor.name, error.message, error.code] };
  }
}
/** Read by index: forged containers cannot be iterated. */
const snapshot = container => { const out = []; for (let i = 0; i < container.length; i++) out.push(i in container ? container[i] : 'hole'); return out; };
const forged = values => Object.setPrototypeOf(values, Uint8Array.prototype);
const CONTAINERS = {
  bytes: values => Uint8Array.from(values, value => value & 255),
  buffer: values => Buffer.from(values.map(value => value & 255)),
  clamped: values => Uint8ClampedArray.from(values, value => value & 255),
  signed: values => Int8Array.from(values, value => value & 255),
  wide: values => Uint16Array.from(values, value => Math.floor(value)),
  array: values => values,
  forged: values => forged(values),
};
const containerNames = Object.keys(CONTAINERS);
/** Index values: mostly palette keys, with strays beyond a byte, fractions and negatives. */
function indexValues(random, count, keys) {
  const strays = [255, 256, 257, 300, 511, 65535, 1.5, 0.5, -1, 128, 200];
  const stray = random(3) === 0;
  return Array.from({ length: count }, () => stray && random(6) === 0 ? strays[random(strays.length)] : keys[random(keys.length)]);
}
/** Duplicate, missing, wide, fractional and (rarely) absent palette values. */
function colorTable(random, { allowOdd = true } = {}) {
  const positional = random(3) === 0, size = 1 + random(8);
  const pool = allowOdd ? [0, 1, 2, 3, 4, 5, 6, 7, 255, 256, 300, 1.5, undefined] : [0, 1, 2, 3, 4, 5, 6, 7, 255];
  const entries = Array.from({ length: size }, () => ({ value: pool[random(random(4) ? 8 : pool.length)], r: random(65536), g: random(65536), b: random(65536) }));
  const keys = [...new Set(entries.map((entry, position) => positional ? position : entry.value))].filter(key => key !== undefined);
  return { table: { flags: positional ? 0x8000 : 0, entries }, keys: keys.length ? keys : [0] };
}

// ---- differential cases ---------------------------------------------------

test('packed expansion equals the per-pixel reference for every depth, stride, source container and odd size', () => {
  const random = rng(0x9ac3);
  for (let round = 0; round < 1500; round++) {
    const depth = [1, 2, 4, 8, 8, 4, 2, 1, 3, 16, 0][random(11)];
    const width = [0, 1, 2, 3, 7, 8, 9, 16, 17, 31, 2.5][random(11)], height = [0, 1, 2, 3, 1.5][random(5)];
    const rowBytes = Math.ceil(Math.ceil(width) * Math.max(depth, 1) / 8) + random(3);
    const length = [rowBytes * Math.ceil(height), Math.max(0, rowBytes * Math.ceil(height) - 1 - random(4)), 0][random(6) ? 0 : 1 + random(2)];
    const values = Array.from({ length }, () => random(8) ? random(256) : [256, 0x3ff, -1, 1.5, -200.5][random(5)]);
    const packed = [Uint8Array.from(values, value => value & 255), values, Uint16Array.from(values, value => value & 0xffff)][random(3)];
    const run = decode => { const result = outcome(() => decode(packed, width, height, depth, rowBytes)); return result.thrown ? result : { value: Array.from(result.value) }; };
    assert.deepEqual(run(expandIndexedPixels), run(referencePixels), JSON.stringify({ round, depth, width, height, rowBytes, length }));
  }
  assert.throws(() => expandIndexedPixels(new Uint8Array(4), 2, 2, 16, 2), { message: 'Unsupported pixelSize: 16' });
  assert.deepEqual(Array.from(expandIndexedPixels(new Uint8Array(4), 2, 0, 16, 2)), []);
});

test('rgba expansion equals the keyed reference: bytes, realizer calls, mask reads and the failing pixel', () => {
  const random = rng(0xc1c4);
  const seen = { byteTable: 0, thrown: 0, typeError: 0, refused: 0, short: 0, fractional: 0 };
  for (let round = 0; round < 6000; round++) {
    const width = random(12) ? 1 + random(7) : [0, 2.5, 1.5][random(3)], height = random(12) ? 1 + random(5) : [0, 1.5, 2.5][random(3)];
    const pixels = Math.ceil(width) * Math.ceil(height);
    const { table, keys } = colorTable(random);
    const lengthKind = random(5), length = lengthKind === 0 ? Math.max(0, pixels - 1 - random(3)) : lengthKind === 1 ? pixels + 1 + random(3) : pixels;
    const indexKind = containerNames[random(3) ? 0 : random(containerNames.length)], outputKind = ['bytes', 'bytes', 'bytes', 'array', 'clamped', 'forged', 'buffer'][random(7)];
    const values = indexValues(random, length, keys);
    const mask = [null, null, { width, height }, { width: Math.max(1, Math.ceil(width) - 2), height: Math.ceil(height) + 1 }, { width: Math.ceil(width) + 2, height: 1 }][random(5)];
    const maskAlpha = mask ? Uint8Array.from({ length: Math.ceil(mask.width) * Math.ceil(mask.height) }, () => random(2) * 255) : undefined;
    // Realizers: none; well-behaved; or one that answers some colors with a
    // falsy or short value. Always a fresh value per call.
    const realizerKind = random(4), oddAt = random(5);
    const realizer = calls => realizerKind === 0 ? undefined : raw => {
      calls.push([...raw]);
      const kind = realizerKind === 3 && raw[0] % 5 === oddAt ? raw[1] % 6 : -1;
      return [null, undefined, '', [raw[0] >> 8], [], Uint8Array.of(raw[2] >> 8, raw[0] >> 8, 9, 9)][kind]
        ?? (kind === 0 ? null : kind === 1 ? undefined : kind === 2 ? '' : raw.map(value => realizerKind === 2 ? value : value >> 8));
    };
    const run = expand => {
      const calls = [], indices = CONTAINERS[indexKind]([...values]);
      const rgba = CONTAINERS[outputKind](Array(pixels * 4 + 4).fill(7));
      const result = outcome(() => expand(indices, rgba, table, realizer(calls), 'Missing test palette index', width, height, mask, maskAlpha) === rgba);
      return { result, calls, rgba: snapshot(rgba) };
    };
    const actual = run(expandIndexedRgba), expected = run(referenceRgba);
    assert.deepEqual(actual, expected, JSON.stringify({ round, width, height, indexKind, outputKind, lengthKind, realizerKind, flags: table.flags }));
    const integral = Number.isInteger(width) && Number.isInteger(height);
    if (['bytes', 'buffer'].includes(indexKind) && ['bytes', 'buffer'].includes(outputKind) && integral && length >= pixels) seen.byteTable++;
    if (actual.result.thrown?.[0] === 'DisplayProfileError') seen.thrown++;
    if (actual.result.thrown?.[0] === 'TypeError') seen.typeError++;
    if (realizerKind === 3 && !actual.result.thrown && actual.calls.length > new Set(values.slice(0, pixels)).size) seen.refused++;
    if (lengthKind === 0 && pixels > 0) seen.short++;
    if (!integral) seen.fractional++;
  }
  for (const [kind, count] of Object.entries(seen)) assert.ok(count > 40, `${kind} cases exercised: ${count}`);
});

test('rgba expansion: one realization per distinct index at its first raster occurrence, stopping at the first missing index', () => {
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

test('rgba expansion: a falsy realization is not remembered, and null or undefined fail at that pixel', () => {
  const table = { flags: 0, entries: [{ value: 1, r: 0x1000, g: 0x2000, b: 0x3000 }, { value: 2, r: 0x4000, g: 0x5000, b: 0x6000 }] };
  const calls = [], rgba = new Uint8Array(5 * 4).fill(9);
  // '' is falsy yet destructures: index 1 is realized again at each of its pixels.
  expandIndexedRgba(Uint8Array.of(1, 2, 1, 1, 2), rgba, table, raw => { calls.push(raw[0]); return raw[0] === 0x1000 ? '' : [1, 2, 3]; }, 'missing', 5, 1);
  assert.deepEqual(calls, [0x1000, 0x4000, 0x1000, 0x1000]);
  assert.deepEqual(Array.from(rgba), [0, 0, 0, 255, 1, 2, 3, 255, 0, 0, 0, 255, 0, 0, 0, 255, 1, 2, 3, 255]);
  for (const nothing of [null, undefined]) {
    const partial = new Uint8Array(3 * 4).fill(9);
    assert.throws(() => expandIndexedRgba(Uint8Array.of(2, 1, 2), partial, table, raw => raw[0] === 0x1000 ? nothing : [1, 2, 3], 'missing', 3, 1), TypeError);
    assert.deepEqual(Array.from(partial), [1, 2, 3, 255, 9, 9, 9, 9, 9, 9, 9, 9]);
  }
  // A short array leaves its missing channels at zero.
  assert.deepEqual(Array.from(expandIndexedRgba(Uint8Array.of(1), new Uint8Array(4).fill(9), table, () => [200], 'missing', 1, 1)), [200, 0, 0, 255]);
});

test('rgba expansion: pixels outside the raster share one undefined index, for short rasters and fractional sizes', () => {
  // A palette value of `undefined` makes the out-of-raster index a real color,
  // so its realization count and color are observable.
  const table = { flags: 0, entries: [{ value: undefined, r: 0xaa00, g: 0xbb00, b: 0xcc00 }, { value: 1, r: 0x1100, g: 0x2200, b: 0x3300 }] };
  const run = (indices, width, height) => {
    const calls = [], rgba = new Uint8Array(Math.ceil(width) * Math.ceil(height) * 4);
    expandIndexedRgba(indices, rgba, table, raw => { calls.push(raw[0]); return raw.map(value => value >> 8); }, 'missing', width, height);
    return { calls, rgba: Array.from(rgba) };
  };
  // Short raster: three of four pixels read past the end.
  assert.deepEqual(run(Uint8Array.of(1), 4, 1), { calls: [0x1100, 0xaa00],
    rgba: [0x11, 0x22, 0x33, 255, 0xaa, 0xbb, 0xcc, 255, 0xaa, 0xbb, 0xcc, 255, 0xaa, 0xbb, 0xcc, 255] });
  // Width 1.5 and height 3: rows 0 and 2 address pixels 0,1 and 3,4; row 1
  // addresses 1.5 and 2.5, which are outside any raster however long it is and
  // land on byte offsets 6 and 10 (row 2 then overwrites offset 12 onward).
  assert.deepEqual(run(Uint8Array.of(1, 1, 1, 1, 1, 1, 1, 1), 1.5, 3), { calls: [0x1100, 0xaa00],
    rgba: [0x11, 0x22, 0x33, 255, 0x11, 0x22, 0xaa, 0xbb, 0xcc, 255, 0xaa, 0xbb, 0x11, 0x22, 0x33, 255, 0x11, 0x22, 0x33, 255, 0, 0, 0, 0] });
});

test('rgba expansion: wide indices, non-byte output and forged byte arrays are not treated as bytes', () => {
  const table = { flags: 0, entries: [{ value: 300, r: 0x0a00, g: 0x0b00, b: 0x0c00 }, { value: 1, r: 0xff00, g: 0x8000, b: 0x0100 }, { value: 44, r: 0x6600, g: 0x6600, b: 0x6600 }] };
  // 300 is looked up as 300, never as 300 & 255 = 44.
  assert.deepEqual(Array.from(expandIndexedRgba(Uint16Array.of(300, 45, 1), new Uint8Array(12), table, undefined, 'missing', 3, 1)),
    [0x0a, 0x0b, 0x0c, 255, 0, 0, 0, 255, 0xff, 0x80, 0x01, 255]);
  assert.deepEqual(snapshot(expandIndexedRgba(forged([300, 300]), new Uint8Array(8), table, undefined, 'missing', 2, 1)),
    [0x0a, 0x0b, 0x0c, 255, 0x0a, 0x0b, 0x0c, 255]);
  // Output containers keep their own stores: no byte wrapping through a table.
  const raw = raster => raster;
  assert.deepEqual(expandIndexedRgba(Uint8Array.of(1), [], table, raw, 'missing', 1, 1), [0xff00, 0x8000, 0x0100, 255]);
  assert.deepEqual(snapshot(expandIndexedRgba(Uint8Array.of(1), forged([0, 0, 0, 0]), table, raw, 'missing', 1, 1)), [0xff00, 0x8000, 0x0100, 255]);
  assert.deepEqual(Array.from(expandIndexedRgba(Uint8Array.of(1), new Uint8ClampedArray(4), table, raw, 'missing', 1, 1)), [255, 255, 255, 255]);
  assert.deepEqual(Array.from(expandIndexedRgba(Uint8Array.of(1), new Uint8Array(4), table, raw, 'missing', 1, 1)), [0, 0, 0, 255]);
});

test('body inspection equals the keyed reference for every index container and palette shape', () => {
  const random = rng(0xb0d1);
  const reasons = new Set();
  for (let round = 0; round < 4000; round++) {
    const pixelSize = [1, 2, 4, 8, 8][random(5)], width = 1 + random(6), height = 1 + random(3);
    const map = { bounds: { left: 0, top: random(40) ? 0 : 1 }, width, height, rowBytes: width };
    const pmap = { ...map, pixelSize, pixelType: 0, cmpCount: 1, cmpSize: pixelSize, packType: 0, planeBytes: 0 };
    let table, keys;
    if (pixelSize === 1 && random(2)) { table = { flags: 0, entries: [{ value: 0, r: 65535, g: 65535, b: 65535 }, { value: 1, r: 0, g: 0, b: random(4) ? 0 : 1 }] }; keys = [0, 1]; }
    else {
      ({ table, keys } = colorTable(random));
      // Mostly unambiguous palettes, so the membership scan is what decides.
      if (random(4)) { const unique = new Set(); table.entries = table.entries.filter(entry => !unique.has(entry.value) && unique.add(entry.value)); }
    }
    const kind = containerNames[random(2) ? 0 : random(containerNames.length)];
    const values = indexValues(random, width * height + (random(6) ? 0 : random(3) - 1), keys);
    const run = inspect => { const result = outcome(() => inspect(pmap, map, map, table, CONTAINERS[kind]([...values]))); return result.thrown ? result : { value: JSON.parse(JSON.stringify(result.value)) }; };
    const actual = run(inspectCicnBody);
    assert.deepEqual(actual, run(referenceBody), JSON.stringify({ round, kind, pixelSize, flags: table.flags, values }));
    reasons.add(actual.thrown ? 'thrown' : actual.value.reason);
  }
  assert.deepEqual([...reasons].sort(), ['aligned-color-source', 'ambiguous-palette-index', 'missing-palette-index', 'thrown', 'unsupported-one-bit-palette', 'unsupported-source-layout']);
  const map = { bounds: { left: 0, top: 0 }, width: 2, height: 1, rowBytes: 2 };
  const pmap = { ...map, pixelSize: 8, pixelType: 0, cmpCount: 1, cmpSize: 8, packType: 0, planeBytes: 0 };
  const entry = value => ({ value, r: 0, g: 0, b: 0 });
  // A palette value of 256 is not byte index 0, and wide index 256 is not byte 0.
  assert.equal(inspectCicnBody(pmap, map, map, { flags: 0, entries: [entry(256)] }, Uint8Array.of(0, 0)).reason, 'missing-palette-index');
  assert.equal(inspectCicnBody(pmap, map, map, { flags: 0, entries: [entry(0)] }, Uint16Array.of(256, 0)).reason, 'missing-palette-index');
  assert.equal(inspectCicnBody(pmap, map, map, { flags: 0, entries: [entry(256), entry(0)] }, Uint16Array.of(256, 0)).status, 'ready');
  assert.ok(Object.isFrozen(inspectCicnBody(pmap, map, map, { flags: 0, entries: [entry(0)] }, Uint8Array.of(0, 0)).sourceRect));
});

test('sampling comparison equals the keyed reference: record, early exit and every sampler and realizer call', () => {
  const random = rng(0x5a3e);
  const seen = { equivalent: 0, different: 0, unknown: 0, coordinatePlane: 0, wide: 0 };
  for (let round = 0; round < 5000; round++) {
    const width = 1 + random(6), height = 1 + random(4), count = width * height;
    const pmap = { isPixMap: random(60) !== 0, pixelType: 0, cmpCount: 1, cmpSize: 8, pixelSize: 8, packType: 0, bounds: { left: 0, top: 0 }, width, height };
    const mask = { bounds: { left: 0, top: 0 }, width: random(60) ? width : width + 1, height };
    const kind = containerNames[random(2) ? 0 : random(containerNames.length)];
    const values = indexValues(random, count + (random(8) ? 0 : random(5) - 2), [0, 1, 2, 3, 4, 5]);
    const color = index => [(Math.floor(Math.abs(index) * 2) % 3) * 0x4000, (Math.floor(Math.abs(index)) % 2) * 0x8000, 0];
    const disagree = random(3) === 0 ? values[random(values.length)] : 'none', unsafe = random(3) === 0 ? values[random(values.length)] : 'none';
    const useRealizer = random(2) === 0, coordinatePlane = random(4) === 0, noSampler = random(60) === 0;
    const run = compare => {
      const calls = [], indices = CONTAINERS[kind]([...values]);
      const rgba = new Uint8Array(count * 4 + 8), opaque = rng(round);
      for (let i = 0; i < indices.length; i++) {
        const rgb16 = color(indices[i]);
        rgba.set([rgb16[0] >> 8, rgb16[1] >> 8, indices[i] === disagree ? 9 : 0, opaque(4) ? 255 : 0], i * 4);
      }
      const sample = noSampler ? undefined : (x, y) => { calls.push(['sample', x, y]); const index = indices[y * width + x]; return index === unsafe ? null : color(index); };
      const realizer = useRealizer ? rgb16 => { calls.push(['realize', ...rgb16]); return rgb16.map(value => value >> 8); } : undefined;
      const result = outcome(() => compare(indices, rgba, pmap, mask, sample, realizer, 'test-policy', coordinatePlane));
      return { result: result.thrown ? result : { value: { ...result.value }, frozen: Object.isFrozen(result.value) }, calls };
    };
    const actual = run(compareOpaqueSampling);
    assert.deepEqual(actual, run(referenceSampling), JSON.stringify({ round, kind, width, height, coordinatePlane, values }));
    if (actual.result.value) seen[actual.result.value.status]++;
    if (coordinatePlane && actual.calls.length) seen.coordinatePlane++;
    if (!['bytes', 'buffer'].includes(kind)) seen.wide++;
  }
  for (const [kind, count] of Object.entries(seen)) assert.ok(count > 100, `${kind} cases exercised: ${count}`);
});

test('sampling comparison: wide and forged indices are remembered by full value, not by low byte', () => {
  const pmap = { isPixMap: true, pixelType: 0, cmpCount: 1, cmpSize: 8, pixelSize: 8, packType: 0, bounds: { left: 0, top: 0 }, width: 2, height: 1 };
  const mask = { bounds: { left: 0, top: 0 }, width: 2, height: 1 };
  // 300 and 44 share a low byte; only 300's raster color disagrees with its sample.
  for (const indices of [Uint16Array.of(44, 300), forged([44, 300]), [44, 300]]) {
    const samples = [];
    const record = compareOpaqueSampling(indices, Uint8Array.of(1, 1, 1, 255, 2, 2, 2, 255), pmap, mask,
      (x, y) => { samples.push([x, y]); return [0x0100, 0x0100, 0x0100]; }, rgb16 => rgb16.map(value => value >> 8), 'test-policy');
    assert.deepEqual(samples, [[0, 0], [1, 0]]);
    assert.equal(record.status, 'different');
  }
});

// ---- the one deliberate difference ----------------------------------------

test('byte path copies each realized color once: a realizer reusing its returned array still yields per-index colors', () => {
  const table = { flags: 0, entries: [{ value: 1, r: 0x1100, g: 0x1200, b: 0x1300 }, { value: 2, r: 0x2100, g: 0x2200, b: 0x2300 }] };
  const sharedScratch = () => { const scratch = [0, 0, 0]; return raw => { for (let i = 0; i < 3; i++) scratch[i] = raw[i] >> 8; return scratch; }; };
  // Byte indices into byte output: each index keeps the color realized for it.
  assert.deepEqual(Array.from(expandIndexedRgba(Uint8Array.of(1, 2, 1, 2), new Uint8Array(16), table, sharedScratch(), 'missing', 4, 1)),
    [0x11, 0x12, 0x13, 255, 0x21, 0x22, 0x23, 255, 0x11, 0x12, 0x13, 255, 0x21, 0x22, 0x23, 255]);
  // The keyed path (here: a plain index array) re-reads the realizer's object at
  // every pixel, so after index 2 is realized every pixel shows that color. This
  // was the behavior of byte rasters too before the byte table.
  assert.deepEqual(Array.from(expandIndexedRgba([1, 2, 1, 2], new Uint8Array(16), table, sharedScratch(), 'missing', 4, 1)),
    [0x11, 0x12, 0x13, 255, 0x21, 0x22, 0x23, 255, 0x21, 0x22, 0x23, 255, 0x21, 0x22, 0x23, 255]);
  // A one-shot iterable is consumed once per index instead of once per pixel.
  const oneShot = raw => raw.map(value => value >> 8).values();
  assert.deepEqual(Array.from(expandIndexedRgba(Uint8Array.of(1, 1), new Uint8Array(8), table, oneShot, 'missing', 2, 1)),
    [0x11, 0x12, 0x13, 255, 0x11, 0x12, 0x13, 255]);
  assert.deepEqual(Array.from(expandIndexedRgba([1, 1], new Uint8Array(8), table, oneShot, 'missing', 2, 1)),
    [0x11, 0x12, 0x13, 255, 0, 0, 0, 255]);
});
