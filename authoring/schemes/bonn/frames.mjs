// Bonn window frames: a sandstone title bar with the city's skyline standing
// on it, a red-and-yellow city pennant carrying the title, sandstone side
// walls, and the Rhine along the bottom: a promenade, rolling water with a
// wavy lower edge, embankment piers at the corners and the Kennedy Bridge in
// the middle.
//
// Geometry comes from the toolkit's frameLayout (per-edge cell lists). Recipes:
//
//   top (document)  cornerL 1 | bar 11 | capL 6 | plate 5 | capR 6 | bar 8 | skyline 10 | bar 8 | cornerR 1
//   top (utility,   cornerL 1 | bar 11 | capL 6 | plate 5 | capR 6 | bar 8 | tower 10  | bar 8 | cornerR 1
//        modal)
//   top (untitled)  cornerL 1 | bar 11 | ornament 1 | bar 8 | cornerR 1
//   left / right    wall 8                                   (rows A.top … A.bottom only)
//   bottom          pierL 1 | skip 0 | wave 11 | bridge 1 | wave 8 | pierR 1
//                   (modal/utility/untitled: no bridge, the two wave cells meet)
//
// Why these codes (docs/authoring-exotic-frames.md):
//   - The skyline must be drawn once, so it is a fixed cell (R6), and it is
//     code 10 rather than 1: below the top edge's fixed sum the title drops
//     anyway (TS1), and code 10 then drops the skyline too, so a very narrow
//     window keeps a clean bar instead of overlapping cells (R12, AW8).
//   - Two code-8 growers either side of the skyline share the right half
//     equally, so the skyline floats midway between the pennant and the
//     right-hand widgets as the window widens ("many growers", §1 end).
//   - The wave is a 16px tile (one period of the wavy edge and the foam
//     dashes). Code 11 before the bridge and 8 after it phase-lock
//     the wave to the bridge; the cut tiles land against the piers (R3).
//   - The bottom only needs ~90px of fixed + tile art, but the top is wider,
//     so a code-0 cell skips the spare template columns (R9). It sits next to
//     a pier, where a cut tile lands anyway, so its width doesn't matter.
//   - The top band is the sky (transparent) plus the bar; the skyline and the
//     top of the pennant are the only things above the bar (R13). The title
//     rect sits on the bar rows and is 18px tall (R28).
import { Raster, verticalGradient, mix, bayer, frameLayout } from '../../../tools/theme-author/index.js';
import { C } from './palette.mjs';
import { DRAW, WIDGET } from './widgets.mjs';
import { fitPalette } from '../../../tools/theme-author/index.js';
import { drawSkyline, drawTowerMotif, drawOrnament, SKYLINE_W, TOWER_W, ORNAMENT_W } from './skyline.mjs';

const WAVE = 16;          // wave tile period
const SIDE = 5;           // side wall thickness
const BOTTOM = 16;        // bottom band: promenade + river
const PIER = 10;          // fixed embankment pier at each bottom corner
const BRIDGE = 32;        // fixed Kennedy Bridge piece

// Per family: sky = rows above the bar; T = whole top band.
// Every fixed px on a titled top edge comes out of the title's room
// (room = width − fixed cells − caps; the title drops at room ≤ 2, TT3), so
// corners and ornaments are kept as narrow as their widgets allow.
const G = {
  doc: { sky: 20, T: 40, cornerL: 20, cornerR: 36, cap: 10, plate: 4, title: [21, 39], ornament: 'skyline', bridge: true },
  modal: { sky: 20, T: 40, cornerL: 9, cornerR: 9, cap: 10, plate: 4, title: [21, 39], ornament: 'tower', towerH: 18 },
  util: { sky: 10, T: 29, cornerL: 20, cornerR: 9, cap: 8, plate: 4, title: [11, 28], ornament: 'tower', towerH: 10 },
  plain: { sky: 14, T: 24, cornerL: 12, cornerR: 12 },
};

/** Build the frameLayout spec for one window type. */
function spec(kind, { collapsed = false, widgets = 'none', ornament } = {}) {
  const g = G[kind];
  const titled = kind !== 'plain';
  const orn = titled
    ? (g.ornament === 'skyline' ? { name: 'skyline', code: 10, w: SKYLINE_W } : { name: 'skyline', code: 10, w: TOWER_W })
    : { name: 'ornament', code: 1, w: ORNAMENT_W };
  const top = titled
    ? [
      { name: 'cornerL', code: 1, w: g.cornerL },
      { name: 'barL', code: 11, w: 1, uniform: 'bar' },
      { name: 'capL', code: 6, w: g.cap },
      { name: 'plate', code: 5, w: g.plate },
      { name: 'capR', code: 6, w: g.cap },
      { name: 'barM', code: 8, w: 1, uniform: 'bar' },
      orn,
      { name: 'barR', code: 8, w: 1, uniform: 'bar' },
      { name: 'cornerR', code: 1, w: g.cornerR },
    ]
    : [
      { name: 'cornerL', code: 1, w: g.cornerL },
      { name: 'barL', code: 11, w: 1, uniform: 'bar' },
      orn,
      { name: 'barR', code: 8, w: 1, uniform: 'bar' },
      { name: 'cornerR', code: 1, w: g.cornerR },
    ];
  const W = top.reduce((s, c) => s + c.w, 0);
  const bridge = !!g.bridge;
  const used = 2 * PIER + 2 * WAVE + (bridge ? BRIDGE : 0);
  // Any width works: each wave cell is exactly one period, and the cells the
  // wave must join seamlessly (wave | bridge | wave) are adjacent.
  const skip = W - used;
  if (skip < 0) throw new Error(`bonn: the ${kind} top is ${W}px but the bottom needs ${used}px`);
  const bottom = [
    { name: 'pierL', code: 1, w: PIER },
    { name: 'skip', code: 0, w: skip },
    { name: 'waveL', code: 11, w: WAVE },
    ...(bridge ? [{ name: 'bridge', code: 1, w: BRIDGE }] : []),
    { name: 'waveR', code: 8, w: WAVE },
    { name: 'pierR', code: 1, w: PIER },
  ];
  // Widgets on the bar rows: close in the left corner; zoom + collapse in the right corner.
  const wy = titled ? g.sky + 3 : 0;
  const box = (x) => ({ x, y: wy, w: WIDGET, h: WIDGET });
  const wset = {};
  if (widgets !== 'none') wset.close = box(g.cornerL - WIDGET - 3);
  if (widgets === 'all') {
    wset.zoom = box(W - g.cornerR + 4);
    wset.collapse = box(W - g.cornerR + 4 + WIDGET + 3);
  }
  return {
    topH: g.T, sideL: SIDE, sideR: SIDE, bottomH: BOTTOM, collapsed,
    top, bottom,
    left: [{ name: 'wallL', code: 8, w: 2 }],
    right: [{ name: 'wallR', code: 8, w: 2 }],
    ...(titled ? { title: { cell: 'plate', top: g.title[0], bottom: g.title[1] } } : {}),
    widgets: wset,
  };
}

// ── Painting ───────────────────────────────────────────────────────────────

/** The sandstone bar: rows [y0, y1) across the full width, rounded top corners. */
function paintBar(r, W, y0, y1, p, { closed }) {
  const grad = verticalGradient(y0 + 1, y1 - y0 - 2, [[0, p.barTop], [1, p.barBottom]]);
  // One colour per row: the 1px growers repeat a column (guide §4.5).
  r.fillRect(0, y0, W, y1 - y0, (x, y) => {
    if (y === y0) return p.outline;
    if (y === y1 - 1) return closed ? p.outline : p.barLine;
    // The city rule: yellow over red, then barLine. Light next to the light
    // bar, dark next to the dark line, so it reads as a two-colour stripe.
    if (y === y1 - 3 && !closed) return p.yellow;
    if (y === y1 - 2 && !closed) return p.red;
    return grad(x, y);
  });
  // Side outline down the bar.
  r.vline(0, y0, y1 - y0, p.outline).vline(W - 1, y0, y1 - y0, p.outline);
  r.vline(1, y0 + 1, y1 - y0 - (closed ? 2 : 1), p.stoneHi);
  // Rounded top corners (radius 5), smooth over the transparent sky = hard outer edge.
  for (const [cx, dir] of [[0, 1], [W - 1, -1]]) {
    const rad = 5;
    for (let dy = 0; dy < rad; dy++) for (let dx = 0; dx < rad; dx++) {
      const ex = rad - (dx + 0.5), ey = rad - (dy + 0.5);
      const d = Math.hypot(ex, ey);
      const x = cx + dir * dx, y = y0 + dy;
      if (d > rad) r.set(x, y, null);
      else if (d > rad - 1.2) r.set(x, y, p.outline);
    }
    if (closed) for (let dy = 0; dy < 3; dy++) for (let dx = 0; dx < 3; dx++) {
      const ex = 3 - (dx + 0.5), ey = 3 - (dy + 0.5), d = Math.hypot(ex, ey);
      const x = cx + dir * dx, y = y1 - 1 - dy;
      if (d > 3) r.set(x, y, null); else if (d > 1.8) r.set(x, y, p.outline);
    }
  }
}

/** The red-and-yellow city pennant across capL, plate and capR (uniform along x on the plate: it tiles). */
function paintPennant(r, layout, g, p) {
  const capL = layout.named('capL'), capR = layout.named('capR');
  const y0 = g.sky - 1, y1 = layout.top;                // rises 1px above the bar
  const x0 = capL.x0, x1 = capR.x1;
  const mid = (y0 + y1 - 1) / 2, half = (y1 - y0) / 2, point = capL.w - 3;
  const field = verticalGradient(y0 + 2, y1 - y0 - 4, [[0, mix(p.red, '#ffffff', 0.12)], [1, p.red]]);
  const shape = (inset) => (px, py) => {
    if (py < y0 + inset || py > y1 - inset) return false;
    // Pointed ends: the pennant narrows to a point over `point` px at each end.
    const t = Math.abs(py - (mid + 0.5)) / half;     // 0 at the centre line, 1 at the edge
    const left = x0 + inset * 1.4 + point * t, right = x1 - inset * 1.4 - point * t;
    return px >= left && px <= right;
  };
  r.paintCoverage(x0, y0, x1 - x0, y1 - y0, shape(0), p.redLo);
  r.paintCoverage(x0, y0, x1 - x0, y1 - y0, shape(1), p.yellow);
  r.paintCoverage(x0, y0, x1 - x0, y1 - y0, shape(2.2), field);
  // Yellow grommets where the pennant is tied off.
  for (const cx of [x0 + point + 1, x1 - point - 2]) // inside the caps, clear of the tiled plate
    r.fillCircleSmooth(cx + 0.5, mid + 0.5, 1.3, p.yellow);
}

function paintSides(r, layout, p) {
  const A = layout.content, W = layout.width;
  const col = (x, c) => r.fillRect(x, A.top, 1, A.bottom - A.top, c);
  for (const [x0, dir] of [[0, 1], [W - 1, -1]]) {
    col(x0, p.outline);
    col(x0 + dir, p.stoneHi);
    col(x0 + 2 * dir, p.stone);
    col(x0 + 3 * dir, p.stone);
    col(x0 + 4 * dir, p.barLine);
  }
}

/** The wavy lower edge of the river, relative to the band top; periodic in WAVE. */
const waveEdge = (x) => Math.round(13 + 2 * Math.cos((2 * Math.PI * x) / WAVE));

function paintBottom(r, layout, kind, p) {
  const { width: W, content: A } = layout;
  const y0 = A.bottom;
  // Promenade (rows 0–3) and the quay edge (row 4); one colour per row.
  for (let x = 0; x < W; x++) {
    r.set(x, y0, p.barLine);
    r.set(x, y0 + 1, p.stoneHi);
    r.set(x, y0 + 2, p.stone);
    r.set(x, y0 + 3, p.stoneLo);
    r.set(x, y0 + 4, p.outline);
  }
  // Water: two flat bands (a dither striped as checkerboard at 8 bpp), the
  // wavy lower edge, and foam dashes on whole pixels.
  for (let x = 0; x < W; x++) {
    const e = y0 + waveEdge(x);
    for (let y = y0 + 5; y < e; y++) r.set(x, y, y < y0 + 9 ? p.water[0] : p.water[1]);
    r.set(x, e, p.waterEdge);
    // Foam on the crests, and a lighter ripple offset on the deep band.
    const ph = ((x % WAVE) + WAVE) % WAVE;
    if (ph >= 6 && ph <= 9) r.set(x, y0 + 7, p.foam);
    if (ph >= 14 || ph <= 1) r.set(x, y0 + 10, p.water[0]);
  }
  // Embankment piers at both corners: sandstone down to the bottom row, with
  // the side wall above. Their inner face is a vertical wall, so the cut wave
  // tile beside them reads as water meeting the quay.
  for (const cell of [layout.named('pierL'), layout.named('pierR')]) {
    const left = cell.name === 'pierL';
    const w = 7, x0 = left ? 0 : W - w;
    r.fillRect(x0, y0 + 1, w, BOTTOM - 1, (x, y) => {
      const k = left ? x - x0 : x0 + w - 1 - x;           // 0 at the outer edge
      if (k === 0 || k === w - 1) return p.outline;
      if ((y - y0) % 5 === 0) return p.stoneLo;           // block courses
      return k === 1 ? p.stoneHi : p.stone;
    });
    r.hline(x0, y0 + BOTTOM - 1, w, p.outline);
    // A tuft of riverbank grass at the foot of the pier.
    const gx = left ? x0 + w : x0 - 3;
    for (let i = 0; i < 3; i++) r.set(gx + i, y0 + 5, i === 1 ? p.bankLo : p.bank);
  }
  if (G[kind].bridge) paintBridge(r, layout.named('bridge'), y0, p);
}

/** The Kennedy Bridge: a steel deck at the quay edge on a shallow arch, piers in the river. */
function paintBridge(r, cell, y0, p) {
  const { x0, w } = cell;
  const steel = p.sky, steelHi = p.skyHi;
  // Railing along the promenade: a top rail and posts.
  r.hline(x0, y0 + 1, w, steel);
  for (let x = x0 + 1; x < x0 + w; x += 3) r.set(x, y0 + 2, steel);
  // Deck: two rows over the quay edge.
  r.hline(x0, y0 + 3, w, steelHi).hline(x0, y0 + 4, w, steel);
  // The arch: a thick curve from pier to pier, under the deck.
  const cx = x0 + w / 2, span = w / 2 - 2.5;
  const archY = (t) => y0 + 5 + 6 * t * t;
  r.paintCoverage(x0, y0 + 5, w, BOTTOM - 5, (px, py) => {
    const t = (px - cx) / span;
    if (Math.abs(t) > 1) return false;
    return py >= archY(t) && py <= archY(t) + 1.8;
  }, steel);
  // Hangers between the deck and the arch.
  for (const dx of [-10, -6, 6, 10]) {
    const yA = Math.round(archY(dx / span));
    r.vline(Math.round(cx + dx), y0 + 5, Math.max(0, yA - (y0 + 5)), steelHi);
  }
  // River piers down to the water's edge.
  for (const px of [x0 + 1, x0 + w - 4]) {
    for (let y = y0 + 5; y < y0 + BOTTOM; y++) for (let x = px; x < px + 3; x++) {
      if (y > y0 + waveEdge(x)) continue;
      r.set(x, y, x === px ? steelHi : steel);
    }
  }
}

/** Paint one frame image for a window type in a state ('active' | 'inactive'). */
export function paintFrame(t, state) {
  const { layout, kind } = t;
  const geomKind = t.geom;
  const g = G[geomKind];
  const p = C[state];
  const r = new Raster(layout.width, layout.height);
  const W = layout.width;
  paintBar(r, W, g.sky, layout.top, p, { closed: layout.collapsed });
  if (layout.titled) {
    paintPennant(r, layout, g, p);
    const sk = layout.named('skyline');
    if (g.ornament === 'skyline') drawSkyline(r, sk.x0, g.sky, p);
    else drawTowerMotif(r, sk.x0, g.sky, p, g.towerH);
  } else {
    drawOrnament(r, layout.named('ornament'), g.sky, p, kind);
  }
  if (!layout.collapsed) {
    paintSides(r, layout, p);
    paintBottom(r, layout, geomKind, p);
  }
  // Guard for exotic-frames R2/R8: a tiled cell repeats its source as drawn, so
  // stray art in it becomes a line or a dotted row (seen twice while building:
  // a tree in a 1px grower, a pennant grommet in the plate). The plate must be
  // one column repeated, and the 1px bar growers (uniform: 'bar') must match
  // each other; layout.lint fails the build otherwise.
  try { layout.lint(r); } catch (err) { throw new Error(`bonn: ${t.name} (${state}): ${err.message}`); }
  for (const [role, box] of Object.entries(layout.widgets)) DRAW[role](r, box, state);
  // The content area is a hole.
  const A = layout.content;
  r.fillRect(A.left, A.top, A.right - A.left, A.bottom - A.top, null);
  // Hidden swatches: title text at (A.left, A.top), shadow at the pixel to its right (TC2).
  r.swatch(A.left, A.top, p.title);
  r.swatch(A.left + 1, A.top, p.titleShadow);
  // Smooth widget edges + the bar gradient can pass the
  // 256-colour cicn limit; merge the rarest blends (the toolkit's fitPalette).
  return fitPalette(r);
}

/** Window type table: wnd# id → description. Active frame = id + 1. */
export function windowTypes() {
  const t = (id, name, kind, opts) => {
    const geom = kind === 'alert' ? 'plain' : kind;
    return { id, name, kind, geom, layout: frameLayout(spec(geom, opts)) };
  };
  return [
    t(-14336, 'Document Window', 'doc', { widgets: 'all' }),
    t(-14332, 'Collapsed Document Window', 'doc', { widgets: 'all', collapsed: true }),
    t(-14328, 'Dialog', 'plain'),
    t(-14326, 'Alert', 'alert'),
    t(-14324, 'Movable Modal', 'modal'),
    t(-14322, 'Movable Alert', 'modal'),
    t(-14304, 'Titled Utility Window', 'util', { widgets: 'close' }),
    t(-14300, 'Collapsed Titled Utility Window', 'util', { widgets: 'close', collapsed: true }),
  ];
}

export { bayer };
