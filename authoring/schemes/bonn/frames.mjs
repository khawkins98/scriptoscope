// Bonn window frames: a sandstone title bar with the Bonn skyline standing
// tall on it and a cherry branch along its top edge from the left corner, a
// red city pennant carrying the title, thick sandstone ashlar piers down both
// sides, and along the bottom a stone arcade bridge over the Rhine: whole
// arches with the river showing through them, abutments in the corners and
// a mooring bollard on the right one where the grow box would be.
//
// Geometry comes from the toolkit's frameLayout (per-edge cell lists). Recipes:
//
//   top (document)  cornerL 1 | branch 8 | capL 6 | plate 5 | capR 6 | bar 8 | skyline 10 | bar 8 | cornerR 1
//   top (modal)     cornerL 1 | branch 8 | capL 6 | plate 5 | capR 6 | bar 8 | minster 10 | bar 8 | cornerR 1
//   top (utility)   cornerL 1 | branch 8 | capL 6 | plate 5 | capR 6 | bar 8 | cornerR 1
//   top (untitled)  cornerL 1 | bar 11 | ornament 1 | bar 8 | cornerR 1   (a centred sprig or alert disc)
//   left / right    pier 8 (one 20-row period: two courses of ashlar, offset joints)
//   bottom          abutL 1 | skip 0 | fill 13 | arch 12 | fill 13 | abutR 1
//
// Band sizes: document and movable modal 66 top (44 sky + 22 bar) / 16 sides
// / 22 bottom; titled utility 34 / 12 / 18; dialog and alert 21 / 12 / 18.
//
// Why these codes (docs/authoring-exotic-frames.md):
//   - The skyline is drawn once, so it is a fixed cell, and code 10 rather
//     than 1: below the edge's fixed sum the title drops anyway (TS1) and
//     code 10 then drops the skyline too (R6, R12, AW8). Every px of its WIDTH
//     comes out of the title's room, so it grows up (44 rows), not across.
//     Two 1px code-8 growers either side make it float midway between the
//     pennant and the right-hand widgets as the window widens.
//   - The branch is a 48px code-8 tile (a long period, so its blossom doesn't
//     read as a fence): it tiles from the near end, so it continues the bough
//     in the corner cell, and its cut tile lands against the pennant (R2, R3).
//   - The bridge is a 40px code-12 arch tile (one arch + a pier), so only whole
//     arches are ever drawn; the leftover pixels go to the two 1px code-13
//     fillers either side, which widen the abutments evenly (13 | 12 | 13, R4).
//   - The bottom needs less width than the top, so a code-0 cell next to the
//     left abutment skips the spare template columns (R9).
//   - The side piers tile a 20-row period (two courses), so the courses wrap
//     cleanly at any height (R2).
//   - Above the bar the band is transparent except the skyline and the
//     blossom (R13). The title rect is on the bar rows and 18px tall (R28).
import { Raster, frameLayout, fitPalette } from '../../../tools/theme-author/index.js';
import { C } from './palette.mjs';
import { DRAW, WIDGET } from './widgets.mjs';
import {
  drawSkyline, drawMinster, drawBranchTile, drawBranchCorner, drawSprig, drawAlertDisc,
  SKYLINE_W, MINSTER_W, SPRIG_W, ALERT_W, BRANCH_TILE_W, SKY_ROWS,
} from './skyline.mjs';

const COURSE = 10;        // ashlar course height; the side tile is two courses
const ARCH = 40;          // arch tile: a 28px segmental arch and a 12px pier
const CAP = 6;            // pennant end caps

// Per family: sky = rows above the bar, bar = bar rows, side = pier width,
// bottom = bridge band rows, corners, ornament.
const G = {
  doc: { sky: SKY_ROWS, bar: 22, side: 16, bottom: 22, cornerL: 24, cornerR: 36, ornament: 'skyline' },
  modal: { sky: SKY_ROWS, bar: 22, side: 16, bottom: 22, cornerL: 16, cornerR: 16, ornament: 'minster' },
  util: { sky: 13, bar: 21, side: 12, bottom: 18, cornerL: 24, cornerR: 14 },
  plain: { sky: 11, bar: 10, side: 12, bottom: 18, cornerL: 31, cornerR: 31 },
};
const abutL = (g) => g.side + 8, abutR = (g) => g.side + 14;

/** Build the frameLayout spec for one window type. */
function spec(geom, kind, { collapsed = false, widgets = 'none' } = {}) {
  const g = G[geom];
  const titled = geom !== 'plain';
  const T = g.sky + g.bar, yb = g.sky;
  const branch = { name: 'branch', code: 8, w: BRANCH_TILE_W };
  let top;
  if (titled) {
    const orn = g.ornament === 'skyline' ? { name: 'skyline', code: 10, w: SKYLINE_W }
      : g.ornament === 'minster' ? { name: 'skyline', code: 10, w: MINSTER_W } : null;
    top = [
      { name: 'cornerL', code: 1, w: g.cornerL }, branch,
      { name: 'capL', code: 6, w: CAP }, { name: 'plate', code: 5, w: 1 }, { name: 'capR', code: 6, w: CAP },
      { name: 'barM', code: 8, w: 1, uniform: 'bar' },
      ...(orn ? [orn, { name: 'barR', code: 8, w: 1, uniform: 'bar' }] : []),
      { name: 'cornerR', code: 1, w: g.cornerR },
    ];
  } else {
    // Untitled: a plain bar with one ornament, centred (11 | fixed | 8, R3).
    top = [
      { name: 'cornerL', code: 1, w: g.cornerL },
      { name: 'barL', code: 11, w: 1, uniform: 'bar' },
      { name: 'ornament', code: 1, w: kind === 'alert' ? ALERT_W : SPRIG_W },
      { name: 'barR', code: 8, w: 1, uniform: 'bar' },
      { name: 'cornerR', code: 1, w: g.cornerR },
    ];
  }
  const W = top.reduce((s, c) => s + c.w, 0);
  const used = abutL(g) + abutR(g) + ARCH + 2;
  const skip = W - used;
  if (skip < 0) throw new Error(`bonn: the ${geom} top is ${W}px but the bottom needs ${used}px`);
  const bottom = [
    { name: 'abutL', code: 1, w: abutL(g) },
    { name: 'skip', code: 0, w: skip },
    { name: 'fillL', code: 13, w: 1, uniform: 'fill' },
    { name: 'arch', code: 12, w: ARCH },
    { name: 'fillR', code: 13, w: 1, uniform: 'fill' },
    { name: 'abutR', code: 1, w: abutR(g) },
  ];
  // Widgets centred on the bar's face rows: close in the left corner, zoom + collapse in the right.
  const wy = yb + Math.floor((g.bar - 3 - WIDGET) / 2) + 1;
  const box = (x) => ({ x, y: wy, w: WIDGET, h: WIDGET });
  const wset = {};
  if (widgets !== 'none') wset.close = box(Math.floor((g.cornerL - WIDGET) / 2));
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

/** Pennant height: the bar's face rows (everything but the outline, lit row and the rule). */
const pennantRows = (g) => g.bar - 4;

// ── Painting ───────────────────────────────────────────────────────────────

/**
 * The sandstone bar, rows [y0, y1): outline, lit row, flat face, a shade row,
 * the city rule (yellow over red), outline. One colour per row, so every
 * 1px grower repeats cleanly. Top corners on a 1-2 stair.
 */
function paintBar(r, W, y0, y1, p, { closed }) {
  const rows = [p.outline, p.stoneHi];
  while (rows.length < y1 - y0 - 4) rows.push(p.stone);
  rows.push(p.stoneLo, p.yellow, p.red, p.outline);
  rows.forEach((c, i) => r.hline(0, y0 + i, W, c));
  r.vline(0, y0, y1 - y0, p.outline).vline(W - 1, y0, y1 - y0, p.outline);
  r.vline(1, y0 + 1, y1 - y0 - 5, p.stoneHi);
  r.vline(W - 2, y0 + 2, y1 - y0 - 6, p.stoneLo);
  // Rounded top corners: a 1-2 stair.
  for (const [x, d] of [[0, 1], [W - 1, -1]]) {
    r.set(x, y0, null).set(x + d, y0, null).set(x + 2 * d, y0, null).set(x, y0 + 1, null);
    r.set(x + d, y0 + 1, p.outline).set(x + 2 * d, y0 + 1, p.outline).set(x, y0 + 2, p.outline);
    r.set(x + 2 * d, y0 + 2, d > 0 ? p.stoneHi : p.stone).set(x + d, y0 + 2, d > 0 ? p.stoneHi : p.stoneLo);
    if (closed) {
      r.set(x, y1 - 1, null).set(x + d, y1 - 1, p.outline).set(x, y1 - 2, p.outline);
    }
  }
  if (!closed) {
    // Where the bar meets the piers, the rule stops at the pier's outline.
    r.set(0, y1 - 1, p.outline).set(W - 1, y1 - 1, p.outline);
  }
}

/**
 * The red pennant: a swallow-tail notch in each end cap,
 * the 1px plate between. Built as a cloth mask, then outlined; the next ring
 * in is the hem, yellow where it faces the light (top, left) and dark red
 * where it doesn't (bottom, right).
 */
function paintPennant(r, layout, yb, rows, p) {
  const capL = layout.named('capL'), capR = layout.named('capR');
  const y0 = yb + 1, y1 = y0 + rows;                       // rows [y0, y1)
  const mid = (y0 + y1 - 1) / 2, half = (rows - 1) / 2;
  const t = (y) => Math.abs(y - mid) / half;              // 0 middle … 1 edge
  // Swallow-tail notches at both ends: the cloth is cut in up to 4px at the middle rows.
  const cut = (y) => Math.round(4 * Math.max(0, 1 - t(y) * 1.15));
  const left = (y) => capL.x0 + 1 + cut(y);
  const right = (y) => capR.x1 - 2 - cut(y);
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
 * Sandstone ashlar piers down both sides: two 10-row courses per tile with
 * offset joints. Every block has a lit top row and left column, a shaded right
 * column and a mortar bottom row (light from the upper left, the same on both
 * sides); a 1px outline outside and a shade line facing the body.
 */
function paintSides(r, layout, g, p) {
  const A = layout.content, W = layout.width, S = g.side, m = S - 2;
  const joints = [[Math.floor(m * 0.55)], [Math.floor(m * 0.2), Math.floor(m * 0.8)]];
  for (let y = A.top; y < A.bottom; y++) {
    const k = (y - A.top) % (2 * COURSE), course = k < COURSE ? 0 : 1, row = k % COURSE;
    const js = joints[course];
    for (const x0 of [0, W - S]) {
      const left = x0 === 0;
      for (let i = 0; i < S; i++) {
        const x = x0 + i;
        if ((left && i === 0) || (!left && i === S - 1)) { r.set(x, y, p.outline); continue; }
        if ((left && i === S - 1) || (!left && i === 0)) { r.set(x, y, p.stoneLo); continue; }
        const j = left ? i - 1 : i - 1;                     // 0 … m−1 across the masonry
        let c = p.stone;
        if (row === COURSE - 1 || js.includes(j)) c = p.mortar;
        else if (js.includes(j + 1) || j === m - 1) c = p.stoneLo;   // right end of a block
        else if (row === 0 || js.includes(j - 1) || j === 0) c = p.stoneHi;
        r.set(x, y, c);
      }
    }
  }
}

/** The bridge band's parts, for a band `H` rows tall. */
function bridgeRows(H) {
  const deck = H >= 22 ? 5 : 4;                 // rows 0 … deck−1: coping, parapet, string course
  const spring = H - 9;                          // springing line = the water line
  return { deck, spring, rv: spring - deck - 1 };
}

/** One arch tile column-and-row function: what colour is at (i, k) of the 24px tile. */
function archPixel(i, k, H, p) {
  const { deck, spring, rv } = bridgeRows(H);
  if (k === H - 1) return p.outline;
  if (k === 0) return p.stoneHi;
  if (k < deck - 1) return p.stone;
  if (k === deck - 1) return p.mortar;
  const open = (x, y) => {
    if (y < deck || y > H - 2 || x < 0 || x >= ARCH) return false;
    const dx = (x + 0.5 - ARCH / 2) / 14;
    if (y >= spring) return Math.abs(dx) <= 1;
    const dy = (y + 0.5 - spring) / rv;
    return dx * dx + dy * dy <= 1;
  };
  if (open(i, k)) {
    // Through the arch: shadow under the vault, then the river with foam dashes.
    if (k < spring - 2) return p.skyLo;
    if (k < spring) return p.waterLo;
    if (k === spring + 1 && ((i >= 9 && i <= 13) || (i >= 24 && i <= 27))) return p.foam;
    if (k === spring + 4 && i >= 16 && i <= 19) return p.water;
    return k < spring + 3 ? p.water : p.waterLo;
  }
  const near = (d) => { for (let dy = -d; dy <= d; dy++) for (let dx = -d; dx <= d; dx++) if (Math.abs(dx) + Math.abs(dy) <= d && open(i + dx, k + dy)) return true; return false; };
  if (near(1)) return p.outline;                                   // the arch's inner edge
  if (near(3) && k < spring) {                                     // voussoirs, keystone lit
    if (i === 19 || i === 20) return p.stoneHi;
    return (i + k) % 3 === 0 ? p.mortar : i < 20 ? p.stoneHi : p.stone;
  }
  // Piers and spandrels: a course joint at the springing line, the pier faces lit / shaded.
  if (k >= spring) {
    if (k === H - 2) return p.stoneLo;                             // footing in the water
    if (i === 34) return p.stoneHi;
    if (i === 5) return p.stoneLo;
    if (k === spring && (i < 5 || i > 34)) return p.mortar;
    if (i === 0 && k > spring) return p.mortar;                    // a joint down the pier's middle
  }
  if (k === deck && i !== 19 && i !== 20) return p.stoneHi;
  return p.stone;
}

/** Abutment masonry (corner cells and the 13 fillers): coping, then ashlar courses. */
function abutPixel(i, k, H, p, joints = true) {
  const { deck } = bridgeRows(H);
  if (k === H - 1) return p.outline;
  if (k === 0) return p.stoneHi;
  if (k < deck - 1) return p.stone;
  if (k === deck - 1) return p.mortar;
  const row = (k - deck) % 4, course = Math.floor((k - deck) / 4);
  if (row === 3) return p.mortar;
  if (joints && (i + (course % 2) * 5) % 10 === 0) return p.mortar;
  if (joints && (i + (course % 2) * 5) % 10 === 9) return p.stoneLo;
  if (row === 0) return p.stoneHi;
  return p.stone;
}

function paintBottom(r, layout, g, p) {
  const { width: W, content: A, height: H } = layout;
  const y0 = A.bottom, BH = H - y0;
  const cells = Object.fromEntries(['abutL', 'fillL', 'arch', 'fillR', 'abutR'].map((n) => [n, layout.named(n)]));
  const each = (cell, fn) => { for (let k = 0; k < BH; k++) for (let i = 0; i < cell.w; i++) r.set(cell.x0 + i, y0 + k, fn(i, k)); };
  each(cells.arch, (i, k) => archPixel(i, k, BH, p));
  each(cells.fillL, (i, k) => abutPixel(1, k, BH, p, false));
  each(cells.fillR, (i, k) => abutPixel(1, k, BH, p, false));
  each(cells.abutL, (i, k) => (i === 0 && k > 0 ? p.outline : abutPixel(i, k, BH, p)));
  const R = cells.abutR;
  each(R, (i, k) => (i === R.w - 1 && k > 0 ? p.outline : abutPixel(i + 3, k, BH, p)));
  // The rounded outer corners at the very bottom.
  r.set(0, H - 1, null).set(W - 1, H - 1, null).set(1, H - 1, p.outline).set(W - 2, H - 1, p.outline).set(0, H - 2, p.outline).set(W - 1, H - 2, p.outline);
  // The bollard (the grow-box corner): a sandstone post with a rope ring, in a shaded niche.
  const { deck } = bridgeRows(BH);
  const nx = R.x0 + 1, ny = y0 + deck, nh = BH - deck - 2;
  r.fillRect(nx, ny, 14, nh, p.stoneLo).hline(nx, ny, 14, p.mortar);
  const BOLLARD = [
    '..oooooooo..',
    '.oLLLssssDo.',
    'oLssssssssDo',
    'oDDDDDDDDDDo',
    '.ooLsssDoo..',
    '..oLsssDo...',
    '.rrrrrrrrr..',
    '..oLsssDo...',
    '..oLsssDo...',
    '.oLssssDDo..',
    'oooooooooooo',
  ];
  const rows = BOLLARD.slice(BOLLARD.length > nh ? BOLLARD.length - nh : 0);
  r.sprite(nx + 1, ny + nh - rows.length, rows, { o: p.outline, L: p.stoneHi, s: p.stone, D: p.stoneLo, r: p.mortar });
}

/** Paint one frame image for a window type in a state ('active' | 'inactive'). */
export function paintFrame(t, state) {
  const { layout, geom, kind } = t;
  const g = G[geom];
  const p = C[state];
  const r = new Raster(layout.width, layout.height);
  const W = layout.width, yb = g.sky;
  paintBar(r, W, yb, layout.top, p, { closed: layout.collapsed });
  // The branch: bough and cluster in the left corner, then the tile.
  if (layout.titled) {
    const corner = layout.named('cornerL'), br = layout.named('branch');
    drawBranchCorner(r, corner.x0, yb, corner.w, p, { cluster: g.sky >= 13 });
    drawBranchTile(r, br.x0, yb, p);
  }
  if (layout.titled) {
    paintPennant(r, layout, yb, pennantRows(g), p);
    if (g.ornament === 'skyline') drawSkyline(r, layout.named('skyline').x0, yb, p);
    if (g.ornament === 'minster') drawMinster(r, layout.named('skyline').x0, yb, p);
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
  // The content area is a hole.
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
