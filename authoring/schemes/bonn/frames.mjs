// Bonn frame geometry places the actual concept-extracted PNGs (3 source
// pixels per native pixel): a sandstone title bar with the Bonn skyline standing
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
// Current geometry: document 144 top (110 sky + 34 ribbon/bar), 22px sides,
// 40px river. Landmarks occupy 64/72px title caps; corners 72/58px. The
// 266px fixed budget leaves 158px title room at 424px outer width. A 145px
// title needs 411px outer width. Narrow windows shed both landmark caps with
// the title; corner blossoms/glass, sandstone and river remain.
//
// The 12px growers and code-5 plate tile only the low contoured tree canopy
// above the text. The plate is explicitly tiled and lint validates its title
// rows. Landmarks remain draw-once code-6 cells; no building is repeated.
// Bottom: one 120px bridge between equal 11/8 water allocations. Side ashlar
// uses 22px tile periods (two 11px courses). No runtime special cases.
import { Raster, frameLayout, fitPalette } from '../../../tools/theme-author/index.js';
import { C } from './palette.mjs';
import { DRAW, WIDGET } from './widgets.mjs';
import {
  drawMinsterCap, drawHallCap, drawTowerCorner, drawBough, drawBridge, drawBranchTile, drawBranchCorner, drawSprig, drawAlertDisc,
  SKY_ROWS, MINSTER_W, HALL_W, BOUGH_W, SPRIG_W, ALERT_W, BRANCH_TILE_W,
} from './skyline.mjs';

const COURSE = 11;         // ashlar course height; the side tile is two courses
const WATER = 24;         // water tile period
const BRIDGE = 120;       // broad stone arch and two substantial piers
const TAIL = 12;          // tails extend into the caps, leaving 6px beside the title after the notch/hem

// Per family: sky = rows above the bar, bar = bar rows, side = pier width,
// bottom = river band rows, corners, what stands over the caps.
const G = {
  doc: { sky: SKY_ROWS, bar: 34, side: 22, bottom: 40, cornerL: BOUGH_W, cornerR: 58, skyline: true, tower: true, bough: true, bridge: true },
  modal: { sky: SKY_ROWS, bar: 34, side: 14, bottom: 20, cornerL: 16, cornerR: 16, skyline: true },
  util: { sky: 16, bar: 34, side: 12, bottom: 18, cornerL: 34, cornerR: 14, branch: true },
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
      g.branch ? { name: 'branch', code: 8, w: BRANCH_TILE_W } : { name: 'barL', code: 11, w: g.skyline ? 12 : 1 },
      { name: 'capL', code: 6, w: g.skyline ? MINSTER_W : TAIL },
      { name: 'plate', code: 5, w: g.skyline ? 12 : 1, tiled: !!g.skyline },
      { name: 'capR', code: 6, w: g.skyline ? HALL_W : TAIL },
      { name: 'barR', code: 8, w: g.skyline ? 12 : 1 },
      { name: 'cornerR', code: 1, w: g.cornerR },
    ];
  } else {
    top = [
      { name: 'cornerL', code: 1, w: g.cornerL },
      { name: 'barL', code: 11, w: g.skyline ? 12 : 1 },
      { name: 'ornament', code: 1, w: kind === 'alert' ? ALERT_W : SPRIG_W },
      { name: 'barR', code: 8, w: g.skyline ? 12 : 1 },
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
  // wnd# widget rects are custom positions, not standard OS coordinates.
  // Keep every hit rectangle inside its fixed cell: the close medallion sits
  // under the bough's right end; the two right medallions sit below the towers.
  const wy = yb + 4;
  const box = (x) => ({ x, y: wy, w: WIDGET, h: WIDGET });
  const wset = {};
  if (widgets !== 'none') wset.close = box(g.cornerL - WIDGET - 5);
  if (widgets === 'all') {
    wset.zoom = box(W - g.cornerR + 2);
    wset.collapse = box(W - g.cornerR + WIDGET + 4);
  }
  return {
    topH: T, sideL: g.side, sideR: g.side, bottomH: g.bottom, collapsed,
    top, bottom,
    left: [{ name: 'pierL', code: 8, w: 2 * COURSE }],
    right: [{ name: 'pierR', code: 8, w: 2 * COURSE }],
    ...(titled ? { title: { cell: 'plate', top: yb + 7, bottom: yb + 25 } } : {}),
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
  // One staggered joint per course; the tiny blocks used to make the piers
  // read as a bright ladder beside the quiet sandstone in the concept.
  const joint = [Math.floor(m * (course === 0 ? 0.65 : 0.3))];
  if (row === COURSE - 1 || joint.includes(j)) return P.mortar;
  if (row === 0) return P.hi;                          // light across a whole course
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
  // The river corners are broad plinth blocks, not more miniature ashlar.
  if (k === H - 3) return P.mortar;
  if (k === H - 2 || i === S - 2) return P.lo;
  if (i === 1 || k === 2) return P.hi;
  return P.face;
}

function paintBottom(r, layout, g, p) {
  const { content: A, height: H } = layout;
  const y0 = A.bottom, BH = H - y0;
  const each = (cell, fn) => { for (let k = 0; k < BH; k++) for (let i = 0; i < cell.w; i++) r.set(cell.x0 + i, y0 + k, fn(i, k)); };
  for (const n of ['waterL', ...(g.bridge ? ['bridge'] : []), 'waterR']) {
    const c = layout.named(n);
    each(c, (i, k) => waterPixel(((c.x0 + i) % WATER + WATER) % WATER, k, BH, p));
  }
  if (g.bridge) {
    // Actual concept masonry; its transparent arch exposes the river below.
    const bridge = layout.named('bridge');
    drawBridge(r, bridge.x0, y0, bridge.w, BH, p);
  }
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
    // A low continuous canopy grounds the separated landmarks. It is one
    // colour per row through the growers and title plate, so it stretches
    // cleanly without changing the title-room budget or repeating buildings.
    if (g.skyline) {
      // A continuous riverside tree line, including above the growing title
      // plate. Each tile begins/ends at the same height; only its sky rows
      // carry the silhouette, so the title's sampled rows remain uniform.
      const crown = [20,22,25,28,28,28,25,24,22,21,22,20];
      for (const name of ['cornerL', 'barL', 'capL', 'plate', 'capR', 'barR', 'cornerR']) {
        const c = layout.named(name);
        for (let i = 0; i < c.w; i++) r.vline(c.x0 + i, yb - crown[i % crown.length] - 8, crown[i % crown.length] + 8, p.sky3.tree);
      }
    }
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
  // R2/R8: the tiled plate must remain uniform through all live title rows.
  // Canopy silhouette variations are confined to the sky above those rows.
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
