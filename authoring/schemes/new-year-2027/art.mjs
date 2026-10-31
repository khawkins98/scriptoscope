// Midnight 2027's ornaments, cleaned up from the concept by paint-over
// (concept/concept.jpg, scale 3.7 source px per art pixel; see concept/brief.md).
//
// `npm run paint-over` gave each piece at 1× snapped to the palette. Those
// rasters were the measuring stick, not the pixels: at 1× the concept's bursts
// come out as a few hundred noisy dots and its numerals with JPEG-ragged
// edges. So each piece is redrawn here on whole pixels, to the numbers the
// paint-over gave:
//
//   big burst    50×44 at 1× in the concept, drawn 41×43: 24 rays from one
//                centre in three lengths, a white core in a champagne disc,
//                solid gold inner halves, pink (two in three) or gold outer
//                halves dotted like trailing sparks, white tips, loose sparks
//   cyan burst   30×23 at 1×, drawn 31×25: 16 rays, white core, cyan rays
//   "2027"       55×22 at 1× (11×17 digits, 2px gaps), drawn as four 10×16
//                bold digit masks plus a 1px bronze drop shadow: gold face,
//                champagne lit edge top/left, gold shade bottom/right
//   clock        17×17 at 1× in the concept's corner, drawn 13–15px:
//                bronze ring, gold rim lit top-left, white face, ticks at
//                12/3/6/9, both hands on 12
//   discs        15×15 (close / zoom / collapse): bronze ring, gold rim, navy
//                face, a 5×5 whole-pixel gold glyph
//
// Rays are Bresenham lines (one pixel per step, no anti-aliasing), so the
// bursts stay crisp at 1× and identical at 8 bpp (visual design §2.2).
import { Raster } from '../../../tools/theme-author/index.js';
import { C } from './palette.mjs';

// ── Bursts ────────────────────────────────────────────────────────────────

/** Points of a whole-pixel line from (x0, y0) to (x1, y1), Bresenham. */
function linePoints(x0, y0, x1, y1) {
  const pts = [];
  let dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, err = dx + dy;
  for (;;) {
    pts.push([x0, y0]);
    if (x0 === x1 && y0 === y1) return pts;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

/**
 * A firework burst centred on (cx, cy), clipped to the box [bx0, bx1) so it
 * never reaches a neighbouring recipe cell (a code-5 plate tiles whatever
 * lands in it).
 * @param {{ rays: number, rx: number, ry: number, hot?: string, inner: string, outer: string[], core: string, tip: string,
 *   sparks?: number[][], phase?: number, clip?: number[], coreR?: number }} spec
 *   hot: the core disc and the rays' first third; inner: their middle; outer: the dotted outer part, per ray in turn
 */
export function burst(r, cx, cy, spec) {
  const { rays, rx, ry, inner, outer, core, tip, sparks = [], phase = 0.13, clip = [-Infinity, Infinity], coreR = 2.5 } = spec;
  const hot = spec.hot ?? inner;
  const put = (x, y, c) => { if (x >= clip[0] && x < clip[1]) r.set(x, y, c); };
  const LENGTH = [1, 0.62, 0.84];                           // long, short, medium rays in turn
  for (let i = 0; i < rays; i++) {
    const a = phase + (i * 2 * Math.PI) / rays;
    const long = LENGTH[i % LENGTH.length];
    const ex = Math.round(cx + Math.cos(a) * rx * long), ey = Math.round(cy + Math.sin(a) * ry * long);
    const pts = linePoints(cx, cy, ex, ey);
    const n = pts.length;
    pts.forEach(([x, y], k) => {
      const t = k / (n - 1 || 1);
      if (t > 0.55 && k % 2 === 1 && k !== n - 1) return;   // dotted outer part: sparks trailing off
      put(x, y, k === n - 1 ? tip : t < 0.3 ? hot : t < 0.55 ? inner : outer[i % outer.length]);
    });
  }
  // Core: a white centre in a champagne disc.
  const R = Math.ceil(coreR);
  for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
    const d = Math.hypot(dx, dy);
    if (d <= coreR) put(cx + dx, cy + dy, d <= coreR - 1.2 ? core : hot);
  }
  for (const [dx, dy, which] of sparks) put(cx + dx, cy + dy, which === 1 ? tip : outer[0]);
}

/** The big gold-and-pink burst (left of the title plate). */
export function bigBurst(r, cx, cy, p, clip, scale = 1) {
  burst(r, cx, cy, {
    rays: 24, rx: Math.round(20 * scale), ry: Math.round(21 * scale), phase: 0.09, coreR: scale >= 1 ? 2.6 : 1.6,
    hot: p.goldHi, inner: p.gold, outer: [p.pink, p.pink, p.goldLo], core: p.spark, tip: p.spark, clip,
    sparks: scale >= 1 ? [[-17, -14, 1], [15, -17, 0], [-19, 7, 0], [18, 10, 1], [-6, 21, 1], [7, -21, 1], [12, 19, 0]] : [[-9, -6, 1], [9, 5, 1]],
  });
}

/** The smaller cyan burst (behind the year). */
export function cyanBurst(r, cx, cy, p, clip, scale = 1) {
  burst(r, cx, cy, {
    rays: 16, rx: Math.round(15 * scale), ry: Math.round(12 * scale), phase: 0.26, coreR: 1.8,
    hot: p.cyan, inner: p.cyan, outer: [p.cyanLo], core: p.spark, tip: p.spark, clip,
    sparks: scale >= 1 ? [[-14, -8, 0], [13, -10, 1], [15, 4, 0]] : [],
  });
}

// ── The year ──────────────────────────────────────────────────────────────

const DIGITS = {
  2: [
    '..######..',
    '.########.',
    '###....###',
    '###....###',
    '.......###',
    '.......###',
    '......###.',
    '.....###..',
    '....###...',
    '...###....',
    '..###.....',
    '.###......',
    '###.......',
    '##########',
    '##########',
    '##########',
  ],
  0: [
    '..######..',
    '.########.',
    '###....###',
    '###....###',
    '###....###',
    '###....###',
    '###....###',
    '###....###',
    '###....###',
    '###....###',
    '###....###',
    '###....###',
    '###....###',
    '###....###',
    '.########.',
    '..######..',
  ],
  7: [
    '##########',
    '##########',
    '##########',
    '.......###',
    '......###.',
    '......###.',
    '.....###..',
    '.....###..',
    '....###...',
    '....###...',
    '...###....',
    '...###....',
    '...###....',
    '...###....',
    '...###....',
    '...###....',
  ],
};
export const YEAR = { digitW: 10, digitH: 16, gap: 2, width: 4 * 10 + 3 * 2 + 1, height: 16 + 1 };

/**
 * "2027" at (x, y): bold gold digits, lit on their top/left edges, shaded on
 * their bottom/right, with a 1px bronze drop shadow down-right (the concept's
 * chunky foil numerals). Original letterforms.
 */
export function drawYear(r, x, y, p) {
  const mask = new Set();
  [2, 0, 2, 7].forEach((d, i) => DIGITS[d].forEach((row, dy) => [...row].forEach((ch, dx) => {
    if (ch === '#') mask.add(`${x + i * (YEAR.digitW + YEAR.gap) + dx},${y + dy}`);
  })));
  const has = (px, py) => mask.has(`${px},${py}`);
  for (const k of mask) {
    const [px, py] = k.split(',').map(Number);
    if (!has(px + 1, py + 1)) r.set(px + 1, py + 1, p.bronze);
  }
  for (const k of mask) {
    const [px, py] = k.split(',').map(Number);
    let c = p.gold;
    if (!has(px, py - 1) || !has(px - 1, py)) c = p.goldHi;
    else if (!has(px, py + 1) || !has(px + 1, py)) c = p.goldLo;
    r.set(px, py, c);
  }
}

// ── The clock at midnight ─────────────────────────────────────────────────

/**
 * A clock face `size` px across (odd) at (x, y): bronze ring, gold rim lit on
 * the upper left, white face, ticks at 12/3/6/9, both hands on 12.
 */
export function clockFace(r, x, y, size, state) {
  const p = C[state];
  const c = (size - 1) / 2, R = size / 2;
  for (let py = 0; py < size; py++) for (let px = 0; px < size; px++) {
    const d = Math.hypot(px - c, py - c);
    if (d > R - 0.3) continue;
    let col = p.face;
    if (d > R - 1.3) col = p.bronze;
    else if (d > R - 2.4) col = px + py < 2 * c ? p.goldHi : px + py > 2 * c ? p.goldLo : p.gold;
    r.set(x + px, y + py, col);
  }
  const k = Math.floor(R - 2.4);
  for (const [dx, dy] of [[k, 0], [-k, 0], [0, k]]) r.set(x + c + dx, y + c + dy, p.star);
  r.set(x + c, y + c - k, p.hand);                      // 12 o'clock: covered by the hands
  r.vline(x + c, y + c - k + 1, k, p.hand);             // minute hand, to the rim
  if (size >= 13) r.vline(x + c + 1, y + c - 2, 3, p.hand); // hour hand: the thicker, shorter one
  r.set(x + c, y + c, p.bronze);                        // the pivot
  return r;
}

// ── Title-bar discs ───────────────────────────────────────────────────────

export const WIDGET = 15;
const GLYPHS = {
  close: ['#...#', '.#.#.', '..#..', '.#.#.', '#...#'],
  zoom: ['#####', '#...#', '#...#', '#...#', '#####'],
  collapse: ['.....', '.....', '#####', '.....', '.....'],
};

/** A 15×15 disc: bronze ring, gold rim lit upper-left, navy face, a whole-pixel glyph. */
export function disc(r, b, role, state, pressed = false) {
  const p = C[state];
  const c = (WIDGET - 1) / 2;
  for (let py = 0; py < WIDGET; py++) for (let px = 0; px < WIDGET; px++) {
    const d = Math.hypot(px - c, py - c);
    if (d > 7.4) continue;
    let col = pressed ? p.gold : p.disc;
    if (d > 6.4) col = p.bronze;
    else if (d > 4.9) col = px + py < 2 * c - 1 ? p.goldHi : px + py > 2 * c + 1 ? p.goldLo : p.gold;
    else if (!pressed && d > 3.9 && px + py < 2 * c) col = p.discHi;
    r.set(b.x + px, b.y + py, col);
  }
  if (state !== 'active') return r;
  r.sprite(b.x + 5, b.y + 5, GLYPHS[role], { '#': pressed ? p.sky : p.glyph });
  return r;
}

// ── Small pieces ─────────────────────────────────────────────────────────

/** A four-point twinkle: white centre, bright arms. */
export function twinkle(r, x, y, p) {
  r.set(x, y, p.spark).set(x - 1, y, p.starHi).set(x + 1, y, p.starHi).set(x, y - 1, p.starHi).set(x, y + 1, p.starHi);
  r.set(x - 2, y, p.star).set(x + 2, y, p.star).set(x, y - 2, p.star).set(x, y + 2, p.star);
}

/** The scheme's icon: a firework over a navy night, in a dark rounded square. */
export function schemeIcon(size) {
  const p = C.active, r = new Raster(size, size);
  const big = size >= 32;
  r.fillRect(1, 0, size - 2, size, p.outline).fillRect(0, 1, size, size - 2, p.outline);
  r.fillRect(1, 1, size - 2, size - 2, p.sky).hline(1, 1, size - 2, p.skyHi);
  const c = Math.floor(size / 2) - (big ? 1 : 0);
  burst(r, c, c, {
    rays: big ? 18 : 9, rx: big ? 12 : 6, ry: big ? 12 : 6, phase: 0.1, coreR: big ? 2.2 : 1.2,
    hot: p.goldHi, inner: p.gold, outer: [p.pink, p.pink, p.goldLo], core: p.spark, tip: p.spark, clip: [1, size - 1],
  });
  if (big) { r.hline(1, size - 3, size - 2, p.goldLo); r.set(4, 4, p.starHi).set(27, 6, p.star).set(5, 25, p.star); }
  return r;
}
