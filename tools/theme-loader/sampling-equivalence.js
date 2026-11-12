// Whole-raster admission for the independently bound kDEF/PACH full-color line
// samplers. This compares CURRENT DISPLAY RGB, not raw RGB16 or device colors.
import { macRgbToSrgb } from './mac-gamma.js';

const UNSET = 0, EQUIVALENT = 1, DIFFERENT = 2, UNKNOWN = 3;
// True only for a genuine Uint8Array (any realm, including subclasses): the
// %TypedArray% brand getter ignores a forged prototype on an ordinary array.
const typedArrayTag = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Uint8Array.prototype), Symbol.toStringTag).get;
const isByteArray = value => typedArrayTag.call(value) === 'Uint8Array';

export function samplingEquivalenceRecord(width, height, status, reason, displayPolicy = 'mac-1.8-to-2.2-high-byte') {
  return Object.freeze({ model: 'kaleidoscope-2.3.1-opaque-sampling-v1',
    comparison: 'opaque-current-display-rgb', displayPolicy,
    width, height, status, reason });
}

/** Use the actual indexed decoder output; no second raster palette resolver. */
export function compareOpaqueSampling(indices, rgba, pmap, mask, sample, realizeRgb16, displayPolicy, coordinatePlane = false) {
  const record = (status, reason) => samplingEquivalenceRecord(pmap.width, pmap.height, status, reason, displayPolicy);
  if (!pmap.isPixMap || pmap.pixelType !== 0 || pmap.cmpCount !== 1 || pmap.cmpSize !== pmap.pixelSize || pmap.packType !== 0
      || pmap.bounds.left !== 0 || pmap.bounds.top !== 0 || mask.bounds.left !== 0 || mask.bounds.top !== 0
      || mask.width !== pmap.width || mask.height !== pmap.height) return record('unknown', 'unsupported-layout');
  if (!sample) return record('unknown', 'missing-sampler');
  // Each safe indexed palette has at most 256 used indices. Retain nothing after
  // this call. Equal source/mask strides are NOT required (their depths differ).
  // Byte rasters (every decoder call site) remember each index's verdict in a
  // 256-entry table; any other index container keeps the keyed memo.
  const bytes = isByteArray(indices);
  const verdicts = bytes ? new Uint8Array(256) : null, memo = bytes ? null : new Map();
  let unsafe = false;
  for (let i = 0; i < indices.length; i++) {
    if (rgba[i * 4 + 3] === 0) continue; // original mask-check sampler exits first
    const index = indices[i];
    let result = coordinatePlane ? UNSET : bytes ? verdicts[index] : memo.get(index) ?? UNSET;
    if (result === UNSET) {
      const rgb16 = sample(i % pmap.width, Math.floor(i / pmap.width));
      if (!rgb16) result = UNKNOWN;
      else {
        const source = realizeRgb16 ? realizeRgb16(rgb16) : macRgbToSrgb(rgb16.map(value => value >> 8));
        const rawRaster = [rgba[i * 4], rgba[i * 4 + 1], rgba[i * 4 + 2]];
        const raster = realizeRgb16 ? rawRaster : macRgbToSrgb(rawRaster);
        result = source.every((value, channel) => value === raster[channel]) ? EQUIVALENT : DIFFERENT;
      }
      if (!coordinatePlane) { if (bytes) verdicts[index] = result; else memo.set(index, result); }
    }
    if (result === DIFFERENT) return record('different', 'opaque-display-mismatch');
    if (result === UNKNOWN) unsafe = true;
  }
  return unsafe ? record('unknown', 'unsafe-palette-access') : record('equivalent', 'all-opaque-display-rgb-equal');
}

/** Complete safe pass for a conditional derived image. The early-exit
 * equivalence decision alone does not establish safety of remaining indices.
 * Returns RAW high-byte RGB; the ordinary converter applies its LUT once. */
export function sampledBandPixels(indices, rgba, pmap, sample, equivalence, realizeRgb16) {
  if (equivalence.status !== 'different' || !sample) return null;
  const memo = new Map();
  for (let i = 0; i < indices.length; i++) {
    if (!rgba[i * 4 + 3] || memo.has(indices[i])) continue;
    const rgb16 = sample(i % pmap.width, Math.floor(i / pmap.width));
    if (!rgb16) return null;
    memo.set(indices[i], realizeRgb16 ? realizeRgb16(rgb16) : rgb16.map(value => value >> 8));
  }
  const out = new Uint8Array(rgba.length);
  for (let i = 0; i < indices.length; i++) {
    const alpha = rgba[i * 4 + 3];
    if (!alpha) continue;
    out.set(memo.get(indices[i]), i * 4); out[i * 4 + 3] = alpha;
  }
  return out;
}
