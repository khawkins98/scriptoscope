// Bonn window frames: a sandstone title bar with the Bonn skyline standing on
// it and a cherry branch running along its top edge from the left corner, a
// red city pennant carrying the title, sandstone ashlar piers down both sides,
// and the Rhine along the bottom: an embankment, two flat teal bands with foam
// dashes, a stone arch bridge in the middle and a mooring bollard on the
// bottom-right pier where the grow box would be.
//
// Geometry comes from the toolkit's frameLayout (per-edge cell lists). Recipes:
//
//   top (document)  cornerL 1 | branch 8 | capL 6 | plate 5 | capR 6 | bar 8 | skyline 10 | bar 8 | cornerR 1
//   top (modal)     cornerL 1 | branch 8 | capL 6 | plate 5 | capR 6 | bar 8 | minster 10 | bar 8 | cornerR 1
//   top (utility)   cornerL 1 | branch 8 | capL 6 | plate 5 | capR 6 | bar 8 | cornerR 1
//   top (untitled)  cornerL 1 | bar 11 | ornament 1 | bar 8 | cornerR 1   (a centred sprig or alert disc)
//   left / right    pier 8 (one 20-row period: two courses of ashlar)
//   bottom          pierL 1 | skip 0 | water 11 | bridge 1 | water 8 | pierR 1
//                   (no bridge on modal / utility / untitled: the two water cells meet)
//
// Why these codes (docs/authoring-exotic-frames.md):
//   - The skyline is drawn once, so it is a fixed cell, and code 10 rather
//     than 1: below the edge's fixed sum the title drops anyway (TS1) and
//     code 10 then drops the skyline too, so a tiny window keeps a clean bar
//     (R6, R12, AW8). Two 1px code-8 growers either side make it float midway
//     between the pennant and the right-hand widgets as the window widens.
//   - The branch is a 48px code-8 tile (a long period, so its blossom doesn't
//     read as a fence): it tiles from the near end, so it continues the bough
//     in the corner cell, and its cut tile lands against the pennant (R2, R3).
//   - The water is one 12px period (foam dash pitch). Code 11 before the
//     bridge and 8 after it phase-lock it to the bridge; the cut tiles land
//     against the piers (R3).
//   - The bottom needs less width than the top, so a code-0 cell next to the
//     left pier skips the spare columns (R9).
//   - Above the bar the band is transparent except the skyline and the
//     blossom (R13). The title rect is on the bar rows and 18px tall (R28).
import { Raster, frameLayout, fitPalette } from '../../../tools/theme-author/index.js';
import { C } from './palette.mjs';
import { DRAW, WIDGET } from './widgets.mjs';
import {
  drawSkyline, drawMinster, drawBranchTile, drawBranchCorner, drawSprig, drawAlertDisc,
  SKYLINE_W, MINSTER_W, SPRIG_W, ALERT_W, BRANCH_TILE_W, SKY_ROWS,
} from './skyline.mjs';

const SIDE = 8;           // pier: outline + 6px ashlar + inner line
const COURSE = 10;        // ashlar course height; the side tile is two courses
const BOTTOM = 18;        // embankment 4 + water 12 + 2
const WATER = 12;         // water tile period (foam dash pitch)
const PIER_L = 14, PIER_R = 22;
const BRIDGE = 32;
const CAP = 6;            // pennant end caps

// Per family: sky = rows above the bar, bar = bar rows, corners, ornament.
const G = {
  doc: { sky: SKY_ROWS, bar: 22, cornerL: 24, cornerR: 36, ornament: 'skyline', bridge: true },
  modal: { sky: SKY_ROWS, bar: 22, cornerL: 12, cornerR: 12, ornament: 'minster' },
  util: { sky: 13, bar: 21, cornerL: 24, cornerR: 12 },
  plain: { sky: 11, bar: 10, cornerL: 18, cornerR: 18 },
};

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
  const used = PIER_L + PIER_R + 2 * WATER + (g.bridge ? BRIDGE : 0);
  const skip = W - used;
  if (skip < 0) throw new Error(`bonn: the ${geom} top is ${W}px but the bottom needs ${used}px`);
  const bottom = [
    { name: 'pierL', code: 1, w: PIER_L },
    { name: 'skip', code: 0, w: skip },
    { name: 'waterL', code: 11, w: WATER },
    ...(g.bridge ? [{ name: 'bridge', code: 1, w: BRIDGE }] : []),
    { name: 'waterR', code: 8, w: WATER },
    { name: 'pierR', code: 1, w: PIER_R },
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
    topH: T, sideL: SIDE, sideR: SIDE, bottomH: BOTTOM, collapsed,
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

/** Sandstone ashlar piers down both sides: two courses per 20-row tile, offset joints. */
function paintSides(r, layout, p) {
  const A = layout.content, W = layout.width;
  for (let y = A.top; y < A.bottom; y++) {
    const k = (y - A.top) % (2 * COURSE), course = k < COURSE ? 0 : 1, row = k % COURSE;
    for (const [x0, d] of [[0, 1], [W - 1, -1]]) {
      r.set(x0, y, p.outline);
      for (let i = 1; i <= 6; i++) {
        // Course 0 is one long block; course 1 has a joint 3px in from the outer edge.
        const joint = course === 1 && i === 3;
        let c = p.stone;
        if (row === COURSE - 1 || joint) c = p.mortar;
        else if (row === 0 || (course === 1 && i === 4)) c = p.stoneHi;     // lit top, lit left of the inner block
        else if (i === 1 && d > 0) c = p.stoneHi;                             // the left pier's outer face catches the light
        else if (i === 1 && d < 0) c = p.stoneLo;                             // the right pier's outer face is in shade
        r.set(x0 + d * i, y, c);
      }
      r.set(x0 + d * 7, y, d > 0 ? p.stoneLo : p.stoneHi);                   // inner line: shade left, lit right
    }
  }
}

/** The Rhine along the bottom band. */
function paintBottom(r, layout, geom, p) {
  const { width: W, content: A, height: H } = layout;
  const y0 = A.bottom;
  // Embankment: lit row, two face rows, kerb.
  r.hline(0, y0, W, p.stoneHi).hline(0, y0 + 1, W, p.stone).hline(0, y0 + 2, W, p.stone).hline(0, y0 + 3, W, p.mortar);
  // Water: two flat bands, foam dashes 4px long on a 12px pitch, offset between the bands.
  for (let x = 0; x < W; x++) {
    for (let y = y0 + 4; y < H - 1; y++) r.set(x, y, y < y0 + 10 ? p.water : p.waterLo);
    const ph = ((x % WATER) + WATER) % WATER;
    if (ph < 4) r.set(x, y0 + 6, p.foam);
    if (ph >= 6 && ph < 10) r.set(x, y0 + 12, p.water);           // a lighter ripple on the deep band
  }
  r.hline(0, H - 1, W, p.outline);
  paintPier(r, layout.named('pierL'), y0, H, p, 'left');
  paintPier(r, layout.named('pierR'), y0, H, p, 'right');
  if (G[geom].bridge) paintBridge(r, layout.named('bridge'), y0, p);
}

/** A corner pier foot: the side pier carried down, a quay block meeting the water, the bollard on the right. */
function paintPier(r, cell, y0, H, p, side) {
  const { x0, w } = cell;
  const left = side === 'left';
  for (let y = y0; y < H; y++) for (let x = x0; x < x0 + w; x++) {
    const k = y - y0, i = left ? x - x0 : x0 + w - 1 - x;        // i: 0 at the outer edge
    let c;
    if (i === 0 || y === H - 1) c = p.outline;
    else if (i === w - 1 && k >= 4) c = p.outline;                 // face meeting the water
    else if (k === 0) c = p.stoneHi;
    else if (k === 3 || k === 10) c = p.mortar;                    // course joints
    else if (k === 4 || k === 11) c = i === w - 2 ? p.stone : p.stoneHi;
    else if (i === 1) c = left ? p.stoneHi : p.stoneLo;
    else if (i === w - 2 && k >= 4) c = left ? p.stoneLo : p.stoneHi;
    else c = p.stone;
    if (k > 3 && k < 10 && i === Math.floor(w / 2)) c = p.mortar;  // a vertical joint in the middle course
    r.set(x, y, c);
  }
  if (!left) {
    // The bollard (the grow-box corner): a sandstone post with a rope ring.
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
    const bx = x0 + 3, by = y0 + 4;
    r.sprite(bx, by, BOLLARD, { o: p.outline, L: p.stoneHi, s: p.stone, D: p.stoneLo, r: p.mortar });
  }
}

/** The stone arch bridge: deck on the embankment, spandrels, a round arch with water through it. */
function paintBridge(r, cell, y0, p) {
  const { x0, w } = cell;
  const span = [[6, 13, 18], [7, 10, 21], [8, 8, 23], [9, 7, 24]];  // [row, first, last] of the opening's stair
  const opening = (k, i) => {
    if (k >= 10) return i >= 7 && i <= 24;
    const s = span.find(([row]) => row === k);
    return s ? i >= s[1] && i <= s[2] : false;
  };
  for (let k = 0; k < BOTTOM - 1; k++) for (let i = 0; i < w; i++) {
    const x = x0 + i, y = y0 + k;
    let c;
    if (opening(k, i)) {
      // Under the arch: shadow at the top, then the water seen through it.
      c = k < 10 ? p.waterLo : k < 13 ? p.water : p.waterLo;
      if (k === 11 && i >= 12 && i <= 15) c = p.foam;
    } else if (opening(k + 1, i) || opening(k, i - 1) || opening(k, i + 1)) {
      c = p.outline;                                             // the arch ring's inner edge
    } else if (i === 0 || i === w - 1) {
      c = k < 4 ? (k === 0 ? p.stoneHi : p.stone) : p.outline;   // abutments meet the water
    } else if (k === 0) c = p.stoneHi;
    else if (k === 1 || k === 2) c = p.stone;
    else if (k === 3) c = p.mortar;
    else if (opening(k + 2, i) || opening(k, i - 2) || opening(k, i + 2)) {
      c = (i + k) % 3 === 0 ? p.mortar : p.stone;                // voussoirs: joints across the ring
    } else if (k === 4) c = p.stoneHi;
    else if (i === 1) c = p.stoneHi;
    else if (i === w - 2) c = p.stoneLo;
    else if (k === 10 && (i < 7 || i > 24)) c = p.mortar;        // a course joint on the abutments
    else c = p.stone;
    r.set(x, y, c);
  }
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
    paintSides(r, layout, p);
    paintBottom(r, layout, geom, p);
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
