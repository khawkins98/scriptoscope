// Stone helpers shared by Castle's frames and controls.
//
// The masonry is drawn as flat surfaces (authoring-visual-design §2.2, §2.7):
// two block tones, a 1px mortar joint, and a lit top row on about a third of
// the blocks. Nothing is speckled; variation is chosen per BLOCK, never per pixel.
const mod = (a, n) => ((a % n) + n) % n;

/** Deterministic hash → [0, 1). */
export function hash(x, y, seed = 0) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed | 0, 982451653);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// ── The curtain wall ──────────────────────────────────────────────────────
// Everything on the wall rows repeats every MERLON px (one merlon + one
// crenel), because the battlement cell tiles whole copies of itself (code 12,
// exotic-frames R4). So the masonry is a hand-laid 14px course table, not a
// hash: each course lists its head joints (x in 0..13), each block its tone
// (0 = A, 1 = B) and whether its top row catches the light. One joint per
// course gives the brief's big 14px blocks in a running bond (staggered by
// 7), the two tones alternate in pairs of courses so they don't stripe, and
// no course has a joint at x = 0, which is
// the column the 1px fillers and the title plate repeat (they must look like
// plain wall).
export const MERLON = 14;
export const MERLON_X = [3, 11]; // the merlon's columns [3, 11) inside the tile; the crenel straddles the tile edge
const COURSES = [
  { joints: [3], tones: [0], lit: [true] },
  { joints: [10], tones: [1], lit: [false] },
  { joints: [3], tones: [1], lit: [false] },
  { joints: [10], tones: [0], lit: [true] },
];

/**
 * Colour of the wall face at tile phase `px` (0..13) and wall row `wy`
 * (0 = the top row of the wall, under the merlons). Rows: 0 the joint the
 * merlons stand on, 1 the lit coping, 2 the shade under it, then 6-row
 * courses (5 stone + 1 mortar).
 */
export function wallAt(px, wy, p) {
  if (wy === 0) return p.mortar;
  if (wy === 1) return p.stoneHi;
  if (wy === 2) return p.stoneLo;
  const k = Math.floor((wy - 3) / 6), ry = (wy - 3) % 6;
  if (ry === 5) return p.mortar;
  const c = COURSES[k % COURSES.length];
  if (c.joints.includes(px)) return p.mortar;
  const n = c.joints.filter((j) => j < px).length % c.joints.length;
  if (ry === 0 && c.lit[n]) return p.stoneHi;
  return p.stone[c.tones[n]];
}

/**
 * Colour of a merlon (or the solid parapet over the gate) at column `mx` of
 * a merlon `w` wide and row `my` of `h`. The outline pass turns row 0 and the
 * end columns into the silhouette outline; inside: a lit top row and left
 * column, a shaded right column, two blocks split by one bed joint.
 */
export function merlonAt(mx, my, w, h, p, { ends = true } = {}) {
  const joint = Math.floor(h / 2);
  if (my === joint) return p.mortar;
  if (ends && mx === w - 2) return p.stoneLo;
  if (my === 1) return p.stoneHi;
  if (ends && mx === 1) return p.stoneHi;
  return p.stone[my < joint ? 0 : 1];
}

// ── Side walls ───────────────────────────────────────────────────────────
// Two courses per 12-row period, so a 12-row grower holds exactly one period
// (R2). Course A is one long block with a lit top; course B is two blocks.
export const SIDE_PERIOD = 12;
export function sideAt(sx, sy, inner, p) {
  // sx: column inside the band's stone (0 = first stone column), inner: stone width.
  const y = mod(sy, SIDE_PERIOD);
  if (y === 5 || y === 11) return p.mortar;
  if (y < 5) return y === 0 ? p.stoneHi : p.stone[0];
  const j = Math.floor(inner / 2) - 1;
  if (sx === j) return p.mortar;
  return p.stone[sx < j ? 1 : 0];
}

// ── Round tower drum ─────────────────────────────────────────────────────
// Small blocks (the drum is further round), 4-row courses, two tones and a lit
// top on about a third of them, chosen per block by hash.
export function drumAt(x, y, x0, p, seed) {
  const k = Math.floor(y / 4), ry = y % 4;
  if (ry === 3) return p.mortar;
  const bx = x - x0 + (k % 2 ? 3 : 0);
  if (mod(bx, 6) === 5) return p.mortar;
  const b = Math.floor(bx / 6);
  if (ry === 0 && hash(b, k, seed + 1) < 0.34) return p.stoneHi;
  return p.stone[hash(b, k, seed) < 0.5 ? 0 : 1];
}

export { mod };
