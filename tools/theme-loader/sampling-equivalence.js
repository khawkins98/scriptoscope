// Whole-raster admission for the independently bound kDEF/PACH full-color line
// samplers. This compares CURRENT DISPLAY RGB, not raw RGB16 or device colors.
import { macRgbToSrgb } from './mac-gamma.js';

export function samplingEquivalenceRecord(width, height, status, reason) {
  return Object.freeze({ model: 'kaleidoscope-2.3.1-opaque-sampling-v1',
    comparison: 'opaque-current-display-rgb', displayPolicy: 'mac-1.8-to-2.2-high-byte',
    width, height, status, reason });
}

/** Use the actual indexed decoder output; no second raster palette resolver. */
export function compareOpaqueSampling(indices, rgba, pmap, mask, sample) {
  const record = (status, reason) => samplingEquivalenceRecord(pmap.width, pmap.height, status, reason);
  if (!pmap.isPixMap || pmap.pixelType !== 0 || pmap.cmpCount !== 1 || pmap.cmpSize !== pmap.pixelSize || pmap.packType !== 0
      || pmap.bounds.left !== 0 || pmap.bounds.top !== 0 || mask.bounds.left !== 0 || mask.bounds.top !== 0
      || mask.width !== pmap.width || mask.height !== pmap.height) return record('unknown', 'unsupported-layout');
  if (!sample) return record('unknown', 'missing-sampler');
  // Each safe indexed palette has at most 256 used indices. Retain nothing after
  // this call. Equal source/mask strides are NOT required (their depths differ).
  const memo = new Map(); let unsafe = false;
  for (let i = 0; i < indices.length; i++) {
    if (rgba[i * 4 + 3] === 0) continue; // original mask-check sampler exits first
    const index = indices[i];
    let result = memo.get(index);
    if (result === undefined) {
      const rgb16 = sample(i % pmap.width, Math.floor(i / pmap.width));
      if (!rgb16) result = 'unknown';
      else {
        const source = macRgbToSrgb(rgb16.map(value => value >> 8));
        const raster = macRgbToSrgb([rgba[i * 4], rgba[i * 4 + 1], rgba[i * 4 + 2]]);
        result = source.every((value, channel) => value === raster[channel]) ? 'equivalent' : 'different';
      }
      memo.set(index, result);
    }
    if (result === 'different') return record('different', 'opaque-display-mismatch');
    if (result === 'unknown') unsafe = true;
  }
  return unsafe ? record('unknown', 'unsafe-palette-access') : record('equivalent', 'all-opaque-display-rgb-equal');
}
