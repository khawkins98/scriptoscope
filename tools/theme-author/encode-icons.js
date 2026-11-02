// Encode classic Mac icon-family resources — the inverse of convertIcons in
// tools/theme-loader/convert.js (which reads icl8/ics8/icl4/ics4 with the mask
// from ICN#/ics#).
//
// Layouts (Inside Macintosh: More Macintosh Toolbox, "Icon Utilities"):
//
//   ICN#  32×32  1-bit image plane (128 bytes) then 1-bit mask (128 bytes)
//   ics#  16×16  1-bit image plane (32 bytes)  then 1-bit mask (32 bytes)
//   icl8  32×32  8-bit indices into the standard system palette (clut 8), 1024 bytes
//   ics8  16×16  same, 256 bytes
//   icl4  32×32  4-bit indices into the standard 16-colour palette (clut 4), 512 bytes
//   ics4  16×16  same, 128 bytes
//
// Unlike a cicn, icon resources carry no colour table: every pixel is an index
// into a FIXED system palette. So encoding is "nearest palette colour" rather
// than "build a palette". The colour planes have no mask of their own; the
// Finder (and Scriptoscope) take it from the same-id ICN# / ics#.
//
// Colours are compared in the sRGB you see: the loader shows each palette entry
// through the same Mac 1.8 → 2.2 gamma it applies to everything else, so we
// match against those brightened values (pass { gamma: false } for raw values).

import { packRows } from './encode-cicn.js';
import { macRgbToSrgb } from '../theme-loader/mac-gamma.js';

/** Apple's standard 16-colour palette (clut 4), stored values. */
export const SYSTEM_PALETTE_16 = Object.freeze([
  [0xff, 0xff, 0xff], [0xfc, 0xf3, 0x05], [0xff, 0x64, 0x03], [0xdd, 0x09, 0x07],
  [0xf2, 0x08, 0x84], [0x47, 0x00, 0xa5], [0x00, 0x00, 0xd3], [0x02, 0xab, 0xea],
  [0x1f, 0xb7, 0x14], [0x00, 0x64, 0x12], [0x56, 0x2c, 0x05], [0x90, 0x71, 0x3a],
  [0xc0, 0xc0, 0xc0], [0x80, 0x80, 0x80], [0x40, 0x40, 0x40], [0x00, 0x00, 0x00],
]);

/**
 * Apple's standard 256-colour palette (clut 8), stored values: the 6×6×6 cube
 * (levels 255…0, black left out) at 0–214, then ten-step red, green, blue and
 * grey ramps at 215–254, black at 255. Same construction as convert.js; the
 * corpus round-trip test proves the two agree.
 */
export const SYSTEM_PALETTE_256 = Object.freeze((() => {
  const L = [255, 204, 153, 102, 51, 0], pal = [];
  for (let x = 0; x < 215; x++) pal.push([L[(x / 36) | 0], L[((x / 6) | 0) % 6], L[x % 6]]);
  const R = [238, 221, 187, 170, 136, 119, 85, 68, 34, 17];
  for (const v of R) pal.push([v, 0, 0]);
  for (const v of R) pal.push([0, v, 0]);
  for (const v of R) pal.push([0, 0, v]);
  for (const v of R) pal.push([v, v, v]);
  pal.push([0, 0, 0]);
  return pal;
})());

const SHOWN = new Map();
function shownPalette(depth, gamma) {
  const key = `${depth}:${gamma}`;
  if (!SHOWN.has(key)) {
    const raw = depth === 4 ? SYSTEM_PALETTE_16 : SYSTEM_PALETTE_256;
    SHOWN.set(key, raw.map((c) => (gamma ? macRgbToSrgb(c) : c.slice())));
  }
  return SHOWN.get(key);
}

// Perceptual-ish weighting (the "redmean" approximation) keeps greys grey.
function distance(a, b) {
  const rm = (a[0] + b[0]) / 2;
  const dr = a[0] - b[0], dg = a[1] - b[1], db = a[2] - b[2];
  return (2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db;
}

function nearest(palette, rgb) {
  let best = 0, bestD = Infinity;
  for (let i = 0; i < palette.length; i++) {
    const d = distance(palette[i], rgb);
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}

function checkSize(raster, size, label) {
  if (raster.width !== size || raster.height !== size) {
    throw new Error(`${label}: needs a ${size}x${size} raster, got ${raster.width}x${raster.height}`);
  }
}

/**
 * Colour plane of an icon (icl8 / ics8 / icl4 / ics4) from a square raster.
 *
 * Each pixel becomes the nearest system-palette colour. Transparent pixels
 * become index 0 (white), the corpus convention under a mask. With
 * `dither: true` the quantisation error is diffused (Floyd–Steinberg) across
 * opaque pixels only, which helps the 16-colour planes most.
 * `ignoreAlpha: true` matches every pixel by its RGB (used to re-encode
 * decoded corpus icons, whose masked-out pixels still carry their colour).
 *
 * @param {{ width: number, height: number, rgba: Uint8Array }} raster
 * @param {4 | 8} depth
 * @param {{ gamma?: boolean, dither?: boolean, ignoreAlpha?: boolean }} [options]
 */
export function encodeIconPlane(raster, depth, { gamma = true, dither = false, ignoreAlpha = false } = {}) {
  if (depth !== 4 && depth !== 8) throw new Error('encodeIconPlane: depth must be 4 or 8');
  const { width: size, height, rgba } = raster;
  if (size !== height || (size !== 16 && size !== 32)) throw new Error(`encodeIconPlane: icons are 16x16 or 32x32, got ${size}x${height}`);
  const palette = shownPalette(depth, gamma);
  const n = size * size;
  const indices = new Uint8Array(n);
  const work = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) work[i * 3 + k] = rgba[i * 4 + k];
  const opaque = (i) => ignoreAlpha || rgba[i * 4 + 3] >= 128;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = y * size + x;
    if (!opaque(i)) { indices[i] = 0; continue; }
    const want = [0, 1, 2].map((k) => Math.max(0, Math.min(255, work[i * 3 + k])));
    const idx = nearest(palette, want);
    indices[i] = idx;
    if (!dither) continue;
    const err = want.map((v, k) => v - palette[idx][k]);
    const spread = (dx, dy, f) => {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || nx >= size || ny >= size) return;
      const j = ny * size + nx;
      if (!opaque(j)) return;
      for (let k = 0; k < 3; k++) work[j * 3 + k] += err[k] * f;
    };
    spread(1, 0, 7 / 16); spread(-1, 1, 3 / 16); spread(0, 1, 5 / 16); spread(1, 1, 1 / 16);
  }
  return packRows(indices, size, size, depth, (size * depth) / 8);
}

/** Pack a 1-bit plane (values 0/1, row-major) of a size×size icon. */
export function packIconBits(bits, size) {
  return packRows(bits, size, size, 1, size / 8);
}

/**
 * ICN# (32×32) or ics# (16×16) from a square raster: the mask is every pixel
 * with alpha ≥ 128; the 1-bit image plane (the black-and-white icon) is the
 * opaque pixels darker than `threshold` (luminance 0–255). Pass `image` (an
 * array of 0/1) to supply your own black-and-white drawing instead.
 *
 * @param {{ width: number, height: number, rgba: Uint8Array }} raster
 * @param {{ threshold?: number, image?: ArrayLike<number> }} [options]
 */
export function encodeIconList(raster, { threshold = 128, image } = {}) {
  const size = raster.width;
  if (size !== 16 && size !== 32) throw new Error(`encodeIconList: icons are 16x16 or 32x32, got ${size}x${raster.height}`);
  checkSize(raster, size, 'encodeIconList');
  const n = size * size;
  const mask = new Uint8Array(n), bw = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const [r, g, b, a] = raster.rgba.subarray(i * 4, i * 4 + 4);
    mask[i] = a >= 128 ? 1 : 0;
    bw[i] = image ? (image[i] ? 1 : 0) : (mask[i] && 0.299 * r + 0.587 * g + 0.114 * b < threshold ? 1 : 0);
  }
  const out = new Uint8Array((n / 8) * 2);
  out.set(packIconBits(bw, size), 0);
  out.set(packIconBits(mask, size), n / 8);
  return out;
}

/**
 * A full icon family for one id: ICN#, icl8, icl4 from a 32×32 raster and
 * ics#, ics8, ics4 from a 16×16 raster. Returns resources ready for `add()`.
 * The 4-bit planes are dithered by default (16 colours is very few).
 *
 * @param {number} id
 * @param {{ large: object, small: object, name?: string, dither4?: boolean, dither8?: boolean, threshold?: number }} spec
 * @returns {Array<{ type: string, id: number, data: Uint8Array, name?: string }>}
 */
export function encodeIconFamily(id, { large, small, name, dither4 = true, dither8 = false, threshold }) {
  checkSize(large, 32, 'encodeIconFamily (large)');
  checkSize(small, 16, 'encodeIconFamily (small)');
  const named = (type, data) => ({ type, id, data, ...(name ? { name } : {}) });
  return [
    named('ICN#', encodeIconList(large, { threshold })),
    named('icl8', encodeIconPlane(large, 8, { dither: dither8 })),
    named('icl4', encodeIconPlane(large, 4, { dither: dither4 })),
    named('ics#', encodeIconList(small, { threshold })),
    named('ics8', encodeIconPlane(small, 8, { dither: dither8 })),
    named('ics4', encodeIconPlane(small, 4, { dither: dither4 })),
  ];
}
