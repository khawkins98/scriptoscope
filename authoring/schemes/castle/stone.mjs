// Stone, moss and dither helpers shared by Castle's frames and controls.
//
// Everything here returns colour functions `(x, y) => colour` for
// Raster.fillRect / paintCoverage. Tiled cells repeat their whole source
// (docs/authoring-exotic-frames.md R2), so a texture inside a tile must be
// periodic with the tile: pass `periodX` / `periodY` and every random choice
// is made from coordinates wrapped by that period.
import { mix } from '../../../tools/theme-author/index.js';

const mod = (a, n) => ((a % n) + n) % n;

/** Deterministic hash → [0, 1). */
export function hash(x, y, seed = 0) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed | 0, 982451653);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const BAYER4 = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
/** Ordered-dither threshold for (x, y) in [0, 1). */
export const bayer = (x, y) => (BAYER4[mod(y, 4)][mod(x, 4)] + 0.5) / 16;

/**
 * Horizontal ordered-dither ramp between colours (the toolkit only ships a
 * vertical one). For FIXED cells only: a dither must never sit in a cell the
 * engine repeats along one axis (authoring guide §4.5).
 */
export function ditheredRampX(x0, w, colors) {
  return (x, y) => {
    const t = Math.min(1, Math.max(0, (x - x0) / Math.max(1, w - 1))) * (colors.length - 1);
    const base = Math.floor(t);
    return colors[Math.min(colors.length - 1, t - base > bayer(x, y) ? base + 1 : base)];
  };
}

/**
 * Ashlar (coursed, staggered block) masonry.
 * @param {object} p
 * @param {number} p.x0 @param {number} p.y0  origin of the pattern
 * @param {number} p.course   course height incl. its 1px bed joint
 * @param {number} p.block    block length incl. its 1px head joint
 * @param {number} [p.stagger] offset of every other course
 * @param {number} [p.periodX] wrap x (a tile width; must be a multiple of `block`)
 * @param {number} [p.periodY] wrap y (a tile height; must be a multiple of 2·course)
 * @param {object} p.pal      palette state: stone[], stoneHi, stoneLo, mortar
 * @param {number} [p.seed]
 * @param {number} [p.speckle] fraction of pixels darkened, as grit
 */
export function ashlar({ x0, y0, course, block, stagger = Math.floor(block / 2), periodX, periodY, pal, seed = 0, speckle = 0.1 }) {
  return (x, y) => {
    let lx = x - x0, ly = y - y0;
    if (periodX) lx = mod(lx, periodX);
    if (periodY) ly = mod(ly, periodY);
    const c = Math.floor(ly / course), ry = ly - c * course;
    let bx = lx + (mod(c, 2) ? stagger : 0);
    if (periodX) bx = mod(bx, periodX);
    const b = Math.floor(bx / block), rx = bx - b * block;
    if (ry === course - 1 || rx === block - 1) return pal.mortar;
    const tone = pal.stone[Math.floor(hash(b, c, seed) * pal.stone.length)];
    if (ry === 0 || rx === 0) return mix(tone, pal.stoneHi, 0.55);
    if (ry === course - 2 || rx === block - 2) return mix(tone, pal.stoneLo, 0.45);
    if (hash(lx, ly, seed + 7) < speckle) return mix(tone, pal.stoneLo, 0.6);
    return tone;
  };
}

/** Sprinkle moss over the top `rows` opaque pixels of each column in a box (periodic in x if asked). */
export function moss(r, x, y, w, h, pal, { density = 0.35, periodX, seed = 3 } = {}) {
  for (let xx = x; xx < x + w; xx++) {
    const kx = periodX ? mod(xx - x, periodX) : xx;
    let depth = 0;
    for (let yy = y; yy < y + h && depth < 2; yy++) {
      if (!r.get(xx, yy)) continue;
      if (hash(kx, depth, seed) < density * (depth ? 0.5 : 1)) r.set(xx, yy, pal.moss[Math.floor(hash(kx, depth, seed + 1) * pal.moss.length)]);
      depth++;
    }
  }
  return r;
}

/** Dark 1px outline on every opaque pixel that touches a transparent one (or the raster edge). */
export function outlineSilhouette(r, color) {
  const edge = [];
  for (let y = 0; y < r.height; y++) for (let x = 0; x < r.width; x++) {
    if (!r.get(x, y)) continue;
    if (!r.get(x - 1, y) || !r.get(x + 1, y) || !r.get(x, y - 1) || !r.get(x, y + 1)) edge.push([x, y]);
  }
  for (const [x, y] of edge) r.set(x, y, color);
  return r;
}

export { mod };
