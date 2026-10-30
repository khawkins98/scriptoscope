// Stone and moss helpers shared by Castle's frames and controls.
//
// Everything here returns colour functions `(x, y) => colour` for
// Raster.fillRect / paintCoverage. Tiled cells repeat their whole source
// (docs/authoring-exotic-frames.md R2), so a texture inside a tile must be
// periodic with the tile: pass `periodX` / `periodY` and every random choice
// is made from coordinates wrapped by that period.
const mod = (a, n) => ((a % n) + n) % n;

/** Deterministic hash → [0, 1). */
export function hash(x, y, seed = 0) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed | 0, 982451653);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/**
 * Ashlar (coursed, staggered block) masonry, drawn as surfaces rather than
 * outlines (design review §1.2, §2.2): two block tones, a 1px mortar joint,
 * a lit top row on about half the blocks and a shaded right end on about a
 * third, chosen per block by hash. Everything else is flat. Light is from the
 * upper left, as on every other bevel in the scheme.
 * @param {object} p
 * @param {number} p.x0 @param {number} p.y0  origin of the pattern
 * @param {number} p.course   course height incl. its 1px bed joint
 * @param {number} p.block    block length incl. its 1px head joint
 * @param {number} [p.stagger] offset of every other course
 * @param {number} [p.periodX] wrap x (a tile width; must be a multiple of `block`)
 * @param {number} [p.periodY] wrap y (a tile height; must be a multiple of 2·course)
 * @param {object} p.pal      palette state: stone[2], stoneHi, stoneLo, mortar
 * @param {number} [p.seed]
 * @param {number} [p.lit]    fraction of blocks with a lit top row
 * @param {number} [p.shaded] fraction of blocks with a shaded right end
 */
export function ashlar({ x0, y0, course, block, stagger = Math.floor(block / 2), periodX, periodY, pal, seed = 0, lit = 0.5, shaded = 0.33 }) {
  return (x, y) => {
    let lx = x - x0, ly = y - y0;
    if (periodX) lx = mod(lx, periodX);
    if (periodY) ly = mod(ly, periodY);
    const c = Math.floor(ly / course), ry = ly - c * course;
    let bx = lx + (mod(c, 2) ? stagger : 0);
    if (periodX) bx = mod(bx, periodX);
    const b = Math.floor(bx / block), rx = bx - b * block;
    if (ry === course - 1 || rx === block - 1) return pal.mortar;
    if (ry === 0 && hash(b, c, seed + 1) < lit) return pal.stoneHi;
    if (rx === block - 2 && block > 4 && hash(b, c, seed + 2) < shaded) return pal.stoneLo;
    return pal.stone[hash(b, c, seed) < 0.5 ? 0 : 1];
  };
}

/**
 * Courses with no head joints: one colour per row, so it can sit in a cell the
 * engine tiles along x (the code-5 title plate, R2) and in the bezels either
 * side of it, which must match it. Reads as the dressed face of the gatehouse.
 */
export function coursed({ y0, course, pal }) {
  return (x, y) => {
    const ry = mod(y - y0, course);
    if (ry === course - 1) return pal.mortar;
    return ry === 0 ? pal.stone[0] : pal.stone[1];
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

export { mod };
