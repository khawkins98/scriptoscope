// Midnight 2027's whole-pixel ornaments. The composition pass measures the
// concept at the same outer window width, rather than keeping its motifs at
// sticker size: a ~66×70 gold/pink burst, a 44×35 cyan burst, 75×28 foil year,
// 23px widget discs and 25px corner clock. No antialiasing or soft glow.
// Rays use bright two-pixel inner clusters and sparse outer trails; numerals
// use chunky masks with lit faces, a gold shade and a bronze drop shadow.
// Smaller clocks and bursts remain available to controls and utility windows.
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
 *   sparks?: number[][], phase?: number, clip?: number[], coreR?: number, bend?: number }} spec
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
    let pts = linePoints(cx, cy, ex, ey);
    if (spec.bend) {
      // Gravity bows the warm trails downward; short whole-pixel segments
      // preserve the gaps and never escape the ornament's horizontal cell.
      pts = [[cx, cy]];
      const steps = Math.max(Math.abs(ex - cx), Math.abs(ey - cy));
      for (let k = 1; k <= steps; k++) {
        const t = k / steps;
        const x = Math.round(cx + (ex - cx) * t), y = Math.round(cy + (ey - cy) * t + spec.bend * t * t);
        pts.push(...linePoints(...pts.at(-1), x, y).slice(1));
      }
    }
    const n = pts.length;
    pts.forEach(([x, y], k) => {
      const t = k / (n - 1 || 1);
      // Keep the ray's shape intact before its final spark trail. Alternating
      // every outer pixel made the small burst look like unrelated confetti.
      if (t > 0.72 && k % 3 === 1 && k !== n - 1) return;
      const end = k === n - 1 && i % 3 === 0;
      const color = end ? tip : t < 0.3 ? hot : t < 0.55 ? inner : outer[i % outer.length];
      put(x, y, color);
      if (rx > 25 && i % 3 !== 1 && t > 0.18 && t < 0.84) {
        // Selected broad warm trails alternate with thin rays and dark gaps.
        const across = Math.abs(ex - cx) > Math.abs(ey - cy);
        put(x + (across ? 0 : 1), y + (across ? 1 : 0), color);
      }
    });
  }
  // Core: a white centre in a champagne disc.
  const R = Math.ceil(coreR);
  for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
    const d = Math.hypot(dx, dy);
    if (d <= coreR) put(cx + dx, cy + dy, d <= coreR - (rx > 25 ? 2.3 : 1.2) ? core : hot);
  }
  for (const [dx, dy, which] of sparks) put(cx + dx, cy + dy, which === 1 ? tip : outer[0]);
}

/** The big gold-and-pink burst (left of the title plate). */
export function bigBurst(r, cx, cy, p, clip, scale = 1) {
  burst(r, cx, cy, {
    rays: scale >= 1 ? 32 : 18, rx: Math.round(20 * scale), ry: Math.round(21 * scale), phase: 0.09, coreR: scale >= 1 ? 2.6 * scale : 1.6,
    hot: scale > 1 ? p.gold : p.goldHi, inner: p.gold, outer: [p.pink, p.pink, p.goldLo], core: p.spark, tip: p.spark, clip, bend: scale > 1 ? 6 : 0,
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
export const YEAR = { digitW: 16, digitH: 26, gap: 3, width: 4 * 16 + 3 * 3 + 2, height: 26 + 2 };

/**
 * "2027" at (x, y): bold gold digits, lit on their top/left edges, shaded on
 * their bottom/right, with a 2px bronze drop shadow down-right (the concept's
 * chunky foil numerals). Original letterforms.
 */
export function drawYear(r, x, y, p) {
  const mask = new Set();
  [2, 0, 2, 7].forEach((d, i) => {
    for (let dy = 0; dy < YEAR.digitH; dy++) for (let dx = 0; dx < YEAR.digitW; dx++) {
      if (DIGITS[d][Math.floor(dy * 16 / YEAR.digitH)][Math.floor(dx * 10 / YEAR.digitW)] === '#') {
        mask.add(`${x + i * (YEAR.digitW + YEAR.gap) + dx},${y + dy}`);
      }
    }
  });
  const has = (px, py) => mask.has(`${px},${py}`);
  for (const k of mask) {
    const [px, py] = k.split(',').map(Number);
    if (!has(px + 2, py + 2)) r.set(px + 2, py + 2, p.bronze);
  }
  for (const k of mask) {
    const [px, py] = k.split(',').map(Number);
    let c = py - y < 8 ? p.goldHi : py - y < 12 ? p.gold : py - y < 15 ? p.goldHi : p.gold;
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
  const p = typeof state === 'string' ? C[state] : state;
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

export const WIDGET = 23;
const GLYPHS = {
  close: ['#...#', '.#.#.', '..#..', '.#.#.', '#...#'],
  zoom: ['#####', '#...#', '#...#', '#...#', '#####'],
  collapse: ['.....', '.....', '#####', '.....', '.....'],
};

/** A 23×23 disc: bronze ring, gold rim lit upper-left, navy face, a 10px glyph. */
export function disc(r, b, role, state, pressed = false) {
  const p = C[state];
  const c = (WIDGET - 1) / 2;
  for (let py = 0; py < WIDGET; py++) for (let px = 0; px < WIDGET; px++) {
    const d = Math.hypot(px - c, py - c);
    if (d > 11.4) continue;
    let col = pressed ? p.gold : p.disc;
    if (d > 10.4) col = p.bronze;
    else if (d > 8.3) col = px + py < 2 * c - 1 ? p.goldHi : px + py > 2 * c + 1 ? p.goldLo : p.gold;
    else if (!pressed && d > 7.3 && px + py < 2 * c) col = p.discHi;
    r.set(b.x + px, b.y + py, col);
  }
  if (state !== 'active') return r;
  const glyph = GLYPHS[role];
  for (let y = 0; y < 10; y++) for (let x = 0; x < 10; x++) {
    if (glyph[Math.floor(y / 2)][Math.floor(x / 2)] === '#') r.set(b.x + 6 + x, b.y + 6 + y, pressed ? p.sky : p.glyph);
  }
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
