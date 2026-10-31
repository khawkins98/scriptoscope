// Bonn window frames, painted over the concept (concept/concept.jpg, 3
// concept px per pixel): a sandstone title bar with the Bonn skyline standing
// tall on it, the Minster and the Old Town Hall either side of a red ribbon
// that carries the title and the Post Tower over the right corner; a cherry
// bough rising from the left corner; thick sandstone ashlar piers down both
// sides; and along the bottom the Rhine, with one stone arch bridge centred
// on open water and a sandstone block in each corner.
//
// Geometry comes from the toolkit's frameLayout (per-edge cell lists). Recipes:
//
//   top (document, modal)  cornerL 1 | bar 11 | capL 6 | plate 5 | capR 6 | bar 8 | cornerR 1
//   top (utility)          cornerL 1 | branch 8 | capL 6 | plate 5 | capR 6 | bar 8 | cornerR 1
//   top (untitled)         cornerL 1 | bar 11 | ornament 1 | bar 8 | cornerR 1   (a centred sprig or alert disc)
//   left / right           pier 8 (one period: two courses of ashlar, offset joints)
//   bottom (document)      blockL 1 | skip 0 | water 11 | bridge 1 | water 8 | blockR 1
//   bottom (others)        blockL 1 | skip 0 | water 11 | water 8 | blockR 1
//
// Band sizes (concept px ÷ 3): document 99 top (78 sky + 21 bar) / 18 sides /
// 27 bottom; movable modal 99 / 14 / 20; titled utility 37 / 12 / 18; dialog
// and alert 21 / 12 / 18.
//
// Why these codes (docs/authoring-exotic-frames.md, compositor-spec TT1–TT10):
//   - The concept stands the skyline over and around the title. The plate
//     (code 5) is a 1px tiled cell, so nothing can stand above the title text
//     itself; but the code-6 caps either side of it are fixed cells that move
//     with the title, are drawn over the whole band height and drop with it
//     (R10, TT3). So the Minster stands in the sky over the left cap and the
//     Town Hall over the right cap: the skyline straddles the title wherever
//     it is, and goes when the title goes. The pennant's tails sit in the
//     caps' bar rows next to the plate. The Post Tower stands over the right
//     corner (fixed anyway, above the zoom and collapse boxes), as in the
//     concept. Caps cost title room like any fixed cell, so the Minster and
//     the Hall are kept to the concept's widths (R6).
//   - The bough is a fixed drawing in the left corner (the concept's single
//     branch, not a repeat); the 1px growers either side of the caps are
//     plain bar, transparent above it.
//   - The bridge is one fixed cell between two code-11/8 water tiles in one
//     allocation: both growers get equal shares, so the bridge stays centred
//     on open water at any width (R3, the "fixed ornament centred on an
//     untitled edge" row). The water is one 24px period of foam dashes.
//   - The bottom needs less width than the top, so a code-0 cell next to the
//     left block skips the spare template columns (R9).
//   - The side piers tile a 16-row period (two 8-row courses), so the courses
//     wrap cleanly at any height (R2).
import { Raster, frameLayout, fitPalette } from '../../../tools/theme-author/index.js';
import { C } from './palette.mjs';
import { DRAW, WIDGET } from './widgets.mjs';
import {
  drawMinsterCap, drawHallCap, drawTowerCorner, drawBough, drawBranchTile, drawBranchCorner, drawSprig, drawAlertDisc,
  SKY_ROWS, MINSTER_W, HALL_W, BOUGH_W, SPRIG_W, ALERT_W, BRANCH_TILE_W,
} from './skyline.mjs';

const COURSE = 8;         // ashlar course height; the side tile is two courses
const WATER = 24;         // water tile period
const BRIDGE = 76;        // the bridge: two 13px piers and a 50px arch
const TAIL = 6;           // the pennant's tails, inside the caps' bar rows

// Per family: sky = rows above the bar, bar = bar rows, side = pier width,
// bottom = river band rows, corners, what stands over the caps.
const G = {
  doc: { sky: SKY_ROWS, bar: 21, side: 18, bottom: 27, cornerL: BOUGH_W, cornerR: 36, skyline: true, tower: true, bough: true, bridge: true },
  modal: { sky: SKY_ROWS, bar: 21, side: 14, bottom: 20, cornerL: 16, cornerR: 16, skyline: true },
  util: { sky: 16, bar: 21, side: 12, bottom: 18, cornerL: 24, cornerR: 14, branch: true },
  plain: { sky: 11, bar: 10, side: 12, bottom: 18, cornerL: 25, cornerR: 25 },
};

/** Build the frameLayout spec for one window type. */
function spec(geom, kind, { collapsed = false, widgets = 'none' } = {}) {
  const g = G[geom];
  const titled = geom !== 'plain';
  const T = g.sky + g.bar, yb = g.sky;
  let top;
  if (titled) {
    top = [
      { name: 'cornerL', code: 1, w: g.cornerL },
      g.branch ? { name: 'branch', code: 8, w: BRANCH_TILE_W } : { name: 'barL', code: 11, w: 1, uniform: 'bar' },
      { name: 'capL', code: 6, w: g.skyline ? MINSTER_W : TAIL },
      { name: 'plate', code: 5, w: 1 },
      { name: 'capR', code: 6, w: g.skyline ? HALL_W : TAIL },
      { name: 'barR', code: 8, w: 1, uniform: 'bar' },
      { name: 'cornerR', code: 1, w: g.cornerR },
    ];
  } else {
    top = [
      { name: 'cornerL', code: 1, w: g.cornerL },
      { name: 'barL', code: 11, w: 1, uniform: 'bar' },
      { name: 'ornament', code: 1, w: kind === 'alert' ? ALERT_W : SPRIG_W },
      { name: 'barR', code: 8, w: 1, uniform: 'bar' },
      { name: 'cornerR', code: 1, w: g.cornerR },
    ];
  }
  const W = top.reduce((s, c) => s + c.w, 0);
  const used = 2 * g.side + 2 * WATER + (g.bridge ? BRIDGE : 0);
  const skip = W - used;
  if (skip < 0) throw new Error(`bonn: the ${geom} top is ${W}px but the bottom needs ${used}px`);
  const bottom = [
    { name: 'blockL', code: 1, w: g.side },
    { name: 'skip', code: 0, w: skip },
    { name: 'waterL', code: 11, w: WATER },
    ...(g.bridge ? [{ name: 'bridge', code: 1, w: BRIDGE }] : []),
    { name: 'waterR', code: 8, w: WATER },
    { name: 'blockR', code: 1, w: g.side },
  ];
  // Widgets centred on the bar's face rows: close in the left corner, zoom + collapse in the right.
  const wy = yb + Math.floor((g.bar - 3 - WIDGET) / 2) + 1;
  const box = (x) => ({ x, y: wy, w: WIDGET, h: WIDGET });
  const wset = {};
  if (widgets !== 'none') wset.close = box(4);
  if (widgets === 'all') {
    wset.zoom = box(W - g.cornerR + 3);
    wset.collapse = box(W - g.cornerR + 3 + WIDGET + 1);
  }
  return {
    topH: T, sideL: g.side, sideR: g.side, bottomH: g.bottom, collapsed,
    top, bottom,
    left: [{ name: 'pierL', code: 8, w: 2 * COURSE }],
    right: [{ name: 'pierR', code: 8, w: 2 * COURSE }],
    ...(titled ? { title: { cell: 'plate', top: yb + 1, bottom: yb + pennantRows(g) + 1 } } : {}),
    widgets: wset,
  };
}

/** Pennant height: the bar's rows but the outlines, the lit row and the shade rows. */
const pennantRows = (g) => g.bar - 4;

// ── Painting ───────────────────────────────────────────────────────────────

/**
 * The sandstone bar, rows [y0, y1): outline, a cream lit row, the flat face,
 * two shade rows, outline. One colour per row, so every 1px grower repeats
 * cleanly. Top corners on a 1-2 stair.
 */
function paintBar(r, W, y0, y1, p, { closed }) {
  const rows = [p.outline, p.stoneHi];
  while (rows.length < y1 - y0 - 3) rows.push(p.stone);
  rows.push(p.stoneLo, p.mortar, p.outline);
  rows.forEach((c, i) => r.hline(0, y0 + i, W, c));
  r.vline(0, y0, y1 - y0, p.outline).vline(W - 1, y0, y1 - y0, p.outline);
  r.vline(1, y0 + 1, y1 - y0 - 4, p.stoneHi);
  r.vline(W - 2, y0 + 2, y1 - y0 - 5, p.stoneLo);
  for (const [x, d] of [[0, 1], [W - 1, -1]]) {
    r.set(x, y0, null).set(x + d, y0, null).set(x + 2 * d, y0, null).set(x, y0 + 1, null);
    r.set(x + d, y0 + 1, p.outline).set(x + 2 * d, y0 + 1, p.outline).set(x, y0 + 2, p.outline);
    r.set(x + 2 * d, y0 + 2, d > 0 ? p.stoneHi : p.stone).set(x + d, y0 + 2, d > 0 ? p.stoneHi : p.stoneLo);
    if (closed) r.set(x, y1 - 1, null).set(x + d, y1 - 1, p.outline).set(x, y1 - 2, p.outline);
  }
}

/**
 * The red ribbon: a swallow-tail notch at each end (in the caps' bar rows
 * next to the plate), the 1px plate between. Built as a cloth mask, then
 * outlined; the next ring in is the hem, yellow where it faces the light (top,
 * left) and dark red where it doesn't (bottom, right).
 */
function paintPennant(r, layout, yb, rows, p) {
  const capL = layout.named('capL'), capR = layout.named('capR');
  const x0 = capL.x1 - TAIL, x1 = capR.x0 + TAIL;
  const y0 = yb + 1, y1 = y0 + rows;
  const mid = (y0 + y1 - 1) / 2, half = (rows - 1) / 2;
  const t = (y) => Math.abs(y - mid) / half;
  const cut = (y) => Math.round(4 * Math.max(0, 1 - t(y) * 1.15));
  const left = (y) => x0 + cut(y), right = (y) => x1 - 1 - cut(y);
  const cloth = (x, y) => y >= y0 && y < y1 && x >= left(y) && x <= right(y);
  const edge = (x, y) => cloth(x, y) && !(cloth(x - 1, y) && cloth(x + 1, y) && cloth(x, y - 1) && cloth(x, y + 1));
  for (let y = y0; y < y1; y++) for (let x = left(y); x <= right(y); x++) {
    let c = p.red;
    if (edge(x, y)) c = p.outline;
    else if (edge(x, y + 1) || edge(x + 1, y)) c = p.redLo;
    else if (edge(x, y - 1) || edge(x - 1, y)) c = p.yellow;
    r.set(x, y, c);
  }
}

/**
 * One ashlar pier column-set, `S` wide, at row k of the 16-row period.
 * Left pier, outside in: outline, lit edge, blocks, shade edge, outline, a
 * sandstone inset line by the body. The right pier mirrors the order of the
 * edges but keeps the light from the left.
 */
function pierColour(S, i, k, p, side) {
  const P = p.pier, m = S - 5;                         // m = block columns
  const order = side === 'left' ? ['o', 'hi', ...Array(m).fill('s'), 'lo', 'o', 'in'] : ['in', 'o', 'hi', ...Array(m).fill('s'), 'lo', 'o'];
  const role = order[i];
  if (role === 'o') return p.outline;
  if (role === 'in') return p.stone;
  if (role === 'hi') return k % COURSE === COURSE - 1 ? P.mortar : P.hi;
  if (role === 'lo') return k % COURSE === COURSE - 1 ? P.mortar : P.lo;
  const j = order.indexOf('s') <= i ? i - order.indexOf('s') : 0;
  const course = Math.floor(k / COURSE) % 2, row = k % COURSE;
  const joint = course === 0 ? [Math.floor(m * 0.6)] : [Math.floor(m * 0.3), Math.floor(m * 0.85)];
  if (row === COURSE - 1 || joint.includes(j)) return P.mortar;
  if (joint.includes(j + 1)) return P.lo;               // the right end of a block
  if (row === 0 || joint.includes(j - 1)) return P.hi;  // the lit top and left of a block
  return P.face;
}

function paintSides(r, layout, g, p) {
  const A = layout.content, W = layout.width, S = g.side;
  for (let y = A.top; y < A.bottom; y++) {
    const k = y - A.top;
    for (let i = 0; i < S; i++) {
      r.set(i, y, pierColour(S, i, k, p, 'left'));
      r.set(W - S + i, y, pierColour(S, i, k, p, 'right'));
    }
  }
}

/** The river band's rows for a band `H` tall: kerb, outline, water, the lighter shallows, outline. */
function waterPixel(i, k, H, p) {
  if (k === 0 || k === 4 || k === H - 1) return p.outline;
  if (k === 1) return p.stoneHi;
  if (k === 2) return p.stone;
  if (k === 3) return p.stoneLo;
  if (k === H - 2) return p.waterLo;
  if (k >= H - 5) return k === H - 4 && i >= 10 && i <= 14 ? p.water : p.waterHi;
  // Foam dashes, staggered, on whole pixels (one 24px period).
  const dashes = [[2, 7, 5], [14, 9, 4], [7, 12, 3], [17, 14, 5], [1, 16, 3]];
  for (const [dx, dk, n] of dashes) if (k === dk && i >= dx && i < dx + n) return p.foam;
  return p.water;
}

/** A corner block: the pier carried down to the river bottom, its top on the kerb row. */
function blockPixel(S, i, k, H, p, side) {
  const P = p.pier;
  const outer = side === 'left' ? i === 0 : i === S - 1;
  const inner = side === 'left' ? i === S - 1 : i === 0;
  if (outer || inner || k === H - 1 || k === 0) return p.outline;
  if (k === 1) return P.hi;
  const kk = k - 1, row = kk % 6, course = Math.floor(kk / 6) % 2;
  const j = side === 'left' ? i - 1 : i - 1, m = S - 2;
  const joint = course === 0 ? Math.floor(m / 2) : Math.floor(m / 4);
  if (row === 5 || j === joint) return P.mortar;
  if (j === joint - 1 || j === m - 1) return P.lo;
  if (row === 0 || j === joint + 1 || j === 0) return P.hi;
  return P.face;
}

/** The bridge, 76 wide: a deck on the kerb, two piers, one round arch with the river through it. */
function bridgePixel(i, k, H, p) {
  const P = p.pier;
  const cx = BRIDGE / 2, rx = 25, spring = H - 4, ry = spring - 7;
  const open = (x, y) => {
    if (y < 5 || y > H - 2 || x < 0 || x >= BRIDGE) return false;
    const dx = (x + 0.5 - cx) / rx;
    if (y >= spring) return Math.abs(dx) <= 1;
    const dy = (y + 0.5 - spring) / ry;
    return dx * dx + dy * dy <= 1;
  };
  if (k === H - 1) return p.outline;
  if (open(i, k)) {
    if (!open(i, k - 2)) return p.waterLo;                          // the vault's shadow on the water
    return waterPixel((i + 6) % WATER, k, H, p);
  }
  const near = (d) => { for (let dy = -d; dy <= d; dy++) for (let dx = -d; dx <= d; dx++) if (Math.abs(dx) + Math.abs(dy) <= d && open(i + dx, k + dy)) return true; return false; };
  // The deck and parapet over the kerb rows, with end posts.
  if (k <= 4) {
    if (k === 0) return p.outline;
    if (i <= 1 || i >= BRIDGE - 2) return k === 1 ? P.hi : i === 0 || i === BRIDGE - 1 ? p.outline : P.face;
    if (k === 1) return P.hi;
    if (k === 4) return P.mortar;
    return k === 3 ? P.lo : P.face;
  }
  if (i === 0 || i === BRIDGE - 1) return p.outline;                // the piers' outer faces meet the river
  if (near(1)) return p.outline;                                    // the arch's inner edge
  if (near(3)) {                                                     // voussoirs, the keystone lit
    if (Math.abs(i + 0.5 - cx) < 2) return P.hi;
    return (i + k) % 4 === 0 ? P.mortar : i < cx ? P.hi : P.face;
  }
  if (i === 1) return P.hi;
  if (i === BRIDGE - 2) return P.lo;
  if (k === 5) return P.hi;
  if ((k - 5) % 6 === 5) return P.mortar;                          // courses on the piers and spandrels
  if (k > spring - 4 && (i === 12 || i === BRIDGE - 13)) return i < cx ? P.lo : P.hi;
  return P.face;
}

function paintBottom(r, layout, g, p) {
  const { content: A, height: H } = layout;
  const y0 = A.bottom, BH = H - y0;
  const each = (cell, fn) => { for (let k = 0; k < BH; k++) for (let i = 0; i < cell.w; i++) r.set(cell.x0 + i, y0 + k, fn(i, k)); };
  for (const n of ['waterL', 'waterR']) { const c = layout.named(n); each(c, (i, k) => waterPixel(((c.x0 + i) % WATER + WATER) % WATER, k, BH, p)); }
  if (g.bridge) each(layout.named('bridge'), (i, k) => bridgePixel(i, k, BH, p));
  each(layout.named('blockL'), (i, k) => blockPixel(g.side, i, k, BH, p, 'left'));
  each(layout.named('blockR'), (i, k) => blockPixel(g.side, i, k, BH, p, 'right'));
}

/** Paint one frame image for a window type in a state ('active' | 'inactive'). */
export function paintFrame(t, state) {
  const { layout, geom, kind } = t;
  const g = G[geom];
  const p = C[state];
  const r = new Raster(layout.width, layout.height);
  const W = layout.width, yb = g.sky;
  if (layout.titled) {
    const cl = layout.named('cornerL'), cr = layout.named('cornerR');
    if (g.bough) drawBough(r, cl.x0, yb, cl.w, p);
    if (g.tower) drawTowerCorner(r, cr.x0, yb, cr.w, p);
    if (g.skyline) { drawMinsterCap(r, layout.named('capL').x0, yb, p); drawHallCap(r, layout.named('capR').x0, yb, p); }
  }
  paintBar(r, W, yb, layout.top, p, { closed: layout.collapsed });
  if (layout.titled) {
    if (g.branch) {
      const cl = layout.named('cornerL');
      drawBranchCorner(r, cl.x0, yb, cl.w, p, { cluster: true });
      drawBranchTile(r, layout.named('branch').x0, yb, p);
    }
    if (g.bough) {
      // The bough's base rests on the bar's top edge.
      const cl = layout.named('cornerL');
      for (let i = 0; i < 6; i++) r.set(cl.x0 + i, yb - 1, p.branch);
    }
    paintPennant(r, layout, yb, pennantRows(g), p);
  } else {
    const o = layout.named('ornament');
    if (kind === 'alert') drawAlertDisc(r, o.x0, yb, p); else drawSprig(r, o.x0, yb, p);
  }
  if (!layout.collapsed) {
    paintSides(r, layout, g, p);
    paintBottom(r, layout, g, p);
  }
  for (const [role, box] of Object.entries(layout.widgets)) DRAW[role](r, box, state);
  // The guard for exotic-frames R2/R8: the plate must be one column repeated
  // and the 1px bar growers must match each other; lint fails the build otherwise.
  try { layout.lint(r); } catch (err) { throw new Error(`bonn: ${t.name} (${state}): ${err.message}`); }
  const A = layout.content;
  r.fillRect(A.left, A.top, A.right - A.left, A.bottom - A.top, null);
  // Hidden swatches: title text at (A.left, A.top), shadow at the pixel to its right (TC2).
  r.swatch(A.left, A.top, p.title);
  r.swatch(A.left + 1, A.top, p.titleShadow);
  return fitPalette(r);
}

/** Window type table: wnd# id → description. Active frame = id + 1. */
export function windowTypes() {
  const t = (id, name, kind, opts) => {
    const geom = kind === 'alert' || kind === 'dialog' ? 'plain' : kind;
    return { id, name, kind, geom, layout: frameLayout(spec(geom, kind, opts)) };
  };
  return [
    t(-14336, 'Document Window', 'doc', { widgets: 'all' }),
    t(-14332, 'Collapsed Document Window', 'doc', { widgets: 'all', collapsed: true }),
    t(-14328, 'Dialog', 'dialog'),
    t(-14326, 'Alert', 'alert'),
    t(-14324, 'Movable Modal', 'modal'),
    t(-14322, 'Movable Alert', 'modal'),
    t(-14304, 'Titled Utility Window', 'util', { widgets: 'close' }),
    t(-14300, 'Collapsed Titled Utility Window', 'util', { widgets: 'close', collapsed: true }),
  ];
}
