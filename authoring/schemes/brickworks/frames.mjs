// Brickworks window frames: chunky plastic bricks.
//
//   - The title bar is a course of 2-stud bricks. Their round studs stand up
//     above the bar, and are only ever drawn whole: one 24px brick (two studs
//     and a seam) is a code-12 tile, with a 1px code-13 filler at each end of
//     the run to take the leftover pixels (exotic-frames R4, R8, and the
//     "which code for which effect" table).
//   - Document, utility and modal windows carry the title on a smooth white
//     "tile" piece (no studs) laid on the bar: code-6 end caps around a code-5
//     plate (R10). Above the tile the stud rows are transparent.
//   - Document windows have raised corner bricks (fixed code-1 cells, taller
//     than the bar: R13) in a contrasting colour; the widgets are round 1×1
//     tiles pressed into them.
//   - Untitled dialogs and alerts centre a raised 2-stud brick between two
//     stud runs: 13 | 12 | 13 | centre | 13 | 12 | 13 in one allocation, so the
//     four fillers share the remainder and the centre stays centred (R8 table).
//   - Side walls are offset brick courses (a 12-row, two-course code-8 tile).
//   - The bottom is a green baseplate with small studs on its top face (an
//     8px code-12 tile with code-13 fillers).
//
// Colour rule (authoring guide §4.5): the 1px code-13 fillers and the code-5
// plate repeat one column, so the bar and the tile are ONE colour per row;
// texture (studs, seams, dithered sheen) lives only in code-12 tiles whose
// width is a multiple of 4, and in fixed cells.
import { Raster, verticalGradient, ditheredGradient, bayer, mix, frameLayout } from '../../../tools/theme-author/index.js';
import { pal, SCHEME_COLOURS } from './palette.mjs';
import { drawWidget } from './widgets.mjs';

const STUD = { w: 8, h: 5 };
const RUN = 24;        // one 2-stud brick: seam + two studs
const PLATE_RUN = 8;   // one baseplate stud
const WIDGET = 14;

// ── Geometry per family ────────────────────────────────────────────────────
// T: top band (studs included). barTop: first row of the bar brick body.
// cornerTop: first body row of the corner bricks (< barTop = raised).
const G = {
  doc: { T: 32, barTop: 11, cornerTop: 5, plate: [13, 29], titleRows: [13, 31], side: 8, bottomH: 10, cornerL: 32, cornerR: 48, cap: 10, plateW: 4 },
  modal: { T: 32, barTop: 11, cornerTop: 5, plate: [13, 29], titleRows: [13, 31], side: 8, bottomH: 10, cornerL: 22, cornerR: 22, cap: 10, plateW: 4 },
  util: { T: 25, barTop: 5, cornerTop: 5, plate: [6, 22], titleRows: [6, 25], side: 6, bottomH: 8, cornerL: 22, cornerR: 14, cap: 9, plateW: 4 },
  plain: { T: 16, barTop: 9, cornerTop: 9, centreTop: 0, side: 8, bottomH: 10, corner: 14, centre: 28 },
};

function spec(geom, { collapsed = false, widgets = 'none' } = {}) {
  const g = G[geom];
  // Every filler of one edge shows the same column (uniform groups), so layout.lint
  // catches stray art reaching into one of them.
  const filler = (name, uniform = name.startsWith('base') ? 'base' : 'bar') => ({ name, code: 13, w: 1, uniform });
  const top = geom === 'plain'
    ? [
      { name: 'cornerL', code: 1, w: g.corner }, filler('fillA'), { name: 'runL', code: 12, w: RUN }, filler('fillB'),
      { name: 'centre', code: 1, w: g.centre },
      filler('fillC'), { name: 'runR', code: 12, w: RUN }, filler('fillD'), { name: 'cornerR', code: 1, w: g.corner },
    ]
    : [
      { name: 'cornerL', code: 1, w: g.cornerL }, filler('fillA'), { name: 'runL', code: 12, w: RUN }, filler('fillB'),
      { name: 'capL', code: 6, w: g.cap }, { name: 'plate', code: 5, w: g.plateW }, { name: 'capR', code: 6, w: g.cap },
      filler('fillC'), { name: 'runR', code: 12, w: RUN }, filler('fillD'), { name: 'cornerR', code: 1, w: g.cornerR },
    ];
  const W = top.reduce((s, c) => s + c.w, 0);
  const edge = W - 2 - PLATE_RUN;
  const bottom = [
    { name: 'baseL', code: 1, w: Math.floor(edge / 2) }, filler('baseFillL'), { name: 'baseRun', code: 12, w: PLATE_RUN },
    filler('baseFillR'), { name: 'baseR', code: 1, w: Math.ceil(edge / 2) },
  ];
  const wall = (name) => [{ name, code: 8, w: 12 }];
  const wset = {};
  const wy = geom === 'util' ? 8 : 15;
  if (widgets !== 'none') wset.close = { x: Math.floor((g.cornerL - WIDGET) / 2), y: wy, w: WIDGET, h: WIDGET };
  if (widgets === 'all') {
    const x0 = W - g.cornerR;
    wset.zoom = { x: x0 + 6, y: wy, w: WIDGET, h: WIDGET };
    wset.collapse = { x: x0 + 28, y: wy, w: WIDGET, h: WIDGET };
  }
  return {
    topH: g.T, sideL: g.side, sideR: g.side, bottomH: g.bottomH, collapsed,
    top, bottom, left: wall('wallL'), right: wall('wallR'),
    ...(geom === 'plain' ? {} : { title: { cell: 'plate', top: g.titleRows[0], bottom: g.titleRows[1] } }),
    widgets: wset,
  };
}

// ── Brick painting ─────────────────────────────────────────────────────────

/** One colour per row for a brick body from `top` to `last` (inclusive): gloss near the top, shade at the bottom, seam on the last row. */
function bodyRows(b, top, last) {
  const mid = verticalGradient(top + 3, Math.max(1, last - top - 5), [[0, b.base], [1, mix(b.base, b.lo, 0.5)]]);
  return (_x, y) => {
    if (y === top) return b.hi;
    if (y === top + 1) return b.gloss;
    if (y === top + 2) return b.hi;
    if (y === last) return b.seam;
    if (y === last - 1) return b.deep;
    if (y === last - 2) return b.lo;
    return mid(0, y);
  };
}

/** A stud standing on a brick: rows [y0, y0 + h), lit from the left (dithered: only in fixed cells or tiles that are a multiple of 4 wide). */
function drawStud(r, x0, y0, b, h = STUD.h) {
  const shade = ditheredGradient(x0 + 1, STUD.w - 2, [[0, b.gloss], [0.3, b.hi], [0.6, b.base], [1, b.deep]], { axis: 'x', levels: 5 });
  r.fillRect(x0, y0, STUD.w, h, shade);
  r.hline(x0 + 1, y0 + 1, STUD.w - 2, b.hi); // the stud's lit top edge
  r.set(x0, y0, null).set(x0 + STUD.w - 1, y0, null); // rounded top corners
  // Its foot casts a little shade on the brick top beside it.
  return r;
}

/** A fixed brick (corner or centre): body rows [top, last], studs on top, a left sheen and a seam on its inner side(s). */
function drawBlock(r, x0, w, top, last, b, { studs, seamL = false, seamR = false }) {
  const rows = bodyRows(b, top, last);
  // Mix against fixed colours only: a mix of the per-row colour would add one
  // colour per row and blow the 256-colour budget.
  const sheen = mix(b.base, b.gloss, 0.5);
  r.fillRect(x0, top, w, last - top + 1, (x, y) => {
    const c = rows(x, y);
    const t = (x - x0) / Math.max(1, w - 1);
    if (y > top + 2 && y < last - 2) {
      // A dithered sheen on the left, shade on the right (fixed cell: dithering is fine).
      if (t < 0.25 && bayer(x, y) < (0.25 - t) / 0.25 * 0.6) return sheen;
      if (t > 0.8 && bayer(x, y) < (t - 0.8) / 0.2 * 0.7) return b.lo;
    }
    return c;
  });
  if (seamL) r.vline(x0, top, last - top + 1, b.seam);
  if (seamR) r.vline(x0 + w - 1, top, last - top + 1, b.seam);
  if (studs > 0) {
    const span = studs * STUD.w + (studs - 1) * 4;
    const sx = x0 + Math.floor((w - span) / 2);
    for (let k = 0; k < studs; k++) drawStud(r, sx + k * (STUD.w + 4), top - STUD.h, b);
  }
}

function paintTop(r, layout, geom, colours, p, kind) {
  const g = G[geom];
  const T = layout.top, last = T - 1;
  const bar = p[colours.bar];
  const rows = bodyRows(bar, g.barTop, last);
  for (const cell of layout.cells.top) {
    const { name, x0, w } = cell;
    if (name.startsWith('fill') || name === 'capL' || name === 'capR' || name === 'plate') {
      r.fillRect(x0, g.barTop, w, T - g.barTop, rows); // plain bar: one colour per row
    } else if (name.startsWith('run')) {
      r.fillRect(x0, g.barTop, w, T - g.barTop, rows);
      r.vline(x0, g.barTop, T - g.barTop, bar.seam);   // the seam between two bricks
      r.vline(x0 + 1, g.barTop + 1, T - g.barTop - 3, bar.hi);
      drawStud(r, x0 + 2, g.barTop - STUD.h, bar);
      drawStud(r, x0 + 14, g.barTop - STUD.h, bar);
    }
  }
  if (layout.titled) paintTile(r, layout, g, p, bar);
  const cornerB = p[colours.corner];
  const cl = layout.named('cornerL'), cr = layout.named('cornerR');
  const studsFor = (w) => Math.max(1, Math.floor((w + 4) / 12));
  drawBlock(r, cl.x0, cl.w, g.cornerTop, last, geom === 'plain' ? bar : cornerB, { studs: studsFor(cl.w), seamR: true });
  drawBlock(r, cr.x0, cr.w, g.cornerTop, last, geom === 'plain' ? bar : cornerB, { studs: studsFor(cr.w), seamL: true });
  if (geom === 'plain') {
    const c = layout.named('centre'), cb = p[colours.centre];
    drawBlock(r, c.x0, c.w, g.centreTop + STUD.h, last, cb, { studs: 2, seamL: true, seamR: true });
    if (kind === 'alert') {
      // A printed exclamation mark on the alert's centre brick.
      const cx = c.x0 + c.w / 2, y0 = g.centreTop + STUD.h + 1;
      const ink = p.glyph ?? p.white.base;
      r.strokeLineSmooth(cx, y0 + 1.5, cx, last - 4.5, 2.2, ink);
      r.fillCircleSmooth(cx, last - 2.3, 1.2, ink);
    }
  }
}

/** The smooth white title tile across capL | plate | capR; uniform along x on the plate (it tiles). */
function paintTile(r, layout, g, p, bar) {
  const capL = layout.named('capL'), capR = layout.named('capR');
  const [t0, t1] = g.plate;
  const x0 = capL.x0 + 2, x1 = capR.x1 - 2; // exclusive
  const tile = p.white;
  const row = (y) => {
    if (y === t0 || y === t1) return p.outline;
    if (y === t0 + 1) return tile.gloss;
    if (y === t1 - 1) return tile.deep;
    if (y === t1 - 2) return tile.lo;
    return tile.base;
  };
  for (let y = t0; y <= t1; y++) r.hline(x0, y, x1 - x0, row(y));
  // A shadow under the tile, on the bar (one colour per row).
  r.hline(x0 + 1, t1 + 1, x1 - x0, bar.deep);
  // Ends: outline columns, rounded corners, a lit left edge and a shaded right edge.
  for (let y = t0; y <= t1; y++) { r.set(x0, y, p.outline); r.set(x1 - 1, y, p.outline); }
  for (let y = t0 + 1; y < t1 - 1; y++) { r.set(x0 + 1, y, tile.gloss); r.set(x1 - 2, y, tile.lo); }
  r.vline(x1, t0 + 1, t1 - t0 + 1, bar.deep);
  const barRows = bodyRows(bar, g.barTop, layout.top - 1);
  for (const [x, y] of [[x0, t0], [x1 - 1, t0], [x0, t1], [x1 - 1, t1]]) r.set(x, y, barRows(x, y));
  r.set(x1, t0, barRows(x1, t0));
}

/** Offset brick courses down a wall: two 6-row courses per 12-row tile; the second course has a head joint mid-wall. */
function paintSides(r, layout, colours, p) {
  const b = p[colours.wall], A = layout.content;
  const course = 6;
  for (const [cells, x0, w] of [[layout.cells.left, 0, A.left], [layout.cells.right, A.right, layout.width - A.right]]) {
    for (const cell of cells) {
      r.fillRect(x0, cell.x0, w, cell.w, (x, y) => {
        const ly = (y - A.top) % (2 * course), c = Math.floor(ly / course), ry = ly % course;
        const lx = x - x0;
        if (ry === course - 1) return b.seam;
        if (c === 1 && lx === Math.floor(w / 2)) return b.seam;              // head joint
        if (c === 1 && lx === Math.floor(w / 2) + 1) return b.hi;
        if (ry === 0) return b.hi;
        if (ry === course - 2) return b.lo;
        return lx === 1 ? mix(b.base, b.gloss, 0.4) : b.base;
      });
    }
  }
}

/** The baseplate: a seam row, the plate's studded top face, a lit edge and the front face. */
function paintBottom(r, layout, colours, p) {
  const b = p[colours.base];
  const y0 = layout.content.bottom, H = layout.height, n = H - y0;
  const faceTop = n - 4; // first row of the front face's lit edge
  const topFace = mix(b.base, b.hi, 0.5);
  r.fillRect(0, y0, layout.width, n, (x, y) => {
    const ry = y - y0;
    if (ry === 0) return b.seam;
    if (ry < faceTop) return topFace;
    if (ry === faceTop) return b.gloss;
    if (ry === n - 1) return p.outline;
    return ry === n - 2 ? b.lo : b.base;
  });
  // Studs on the top face, seen from slightly above: a 6×3 lit cap with a dark
  // foot shadow. Every 8px, phased from each cell's own edge (the left corner
  // from its right end, so it meets the code-12 run seamlessly).
  const studAt = (x) => {
    const y = y0 + 1;
    r.fillRect(x + 1, y, 4, 1, b.gloss);
    r.fillRect(x, y + 1, 6, 1, b.hi).set(x, y + 1, b.gloss);
    r.fillRect(x, y + 2, 6, 1, b.lo).set(x + 5, y + 2, b.deep);
    r.fillRect(x + 1, y + 3, 5, 1, b.deep);
  };
  for (const cell of layout.cells.bottom) {
    if (cell.code === 13) continue;
    if (cell.name === 'baseL') { for (let x = cell.x1 - PLATE_RUN + 1; x >= cell.x0 + 1; x -= PLATE_RUN) studAt(x); continue; }
    for (let x = cell.x0 + 1; x + 7 <= cell.x1; x += PLATE_RUN) studAt(x);
  }
  r.set(0, H - 1, null).set(layout.width - 1, H - 1, null); // rounded bottom corners
}

/** Paint one frame image for a window type in a state ('active' | 'inactive'). */
export function paintFrame(t, state) {
  const { layout, geom, kind } = t;
  const p = pal(state);
  const colours = SCHEME_COLOURS[kind];
  const r = new Raster(layout.width, layout.height);
  paintTop(r, layout, geom, colours, p, kind);
  if (!layout.collapsed) {
    paintSides(r, layout, colours, p);
    paintBottom(r, layout, colours, p);
  }
  const A = layout.content;
  r.fillRect(A.left, A.top, A.right - A.left, A.bottom - A.top, null); // the content area is a hole
  r.outlineEdges(0, 0, r.width, r.height, p.outline); // 1px outline round the whole silhouette
  for (const [role, box] of Object.entries(layout.widgets)) drawWidget(r, box, role, state);
  // Hidden swatches: title text at (A.left, A.top), its shadow one pixel right (TC2).
  r.swatch(A.left, A.top, p.title);
  r.swatch(A.left + 1, A.top, p.titleShadow);
  try { layout.lint(r); } catch (err) { throw new Error(`brickworks: ${t.name} (${state}): ${err.message}`); }
  return r;
}

/** Window type table: wnd# id → description. Active frame = id + 1. */
export function windowTypes() {
  const t = (id, name, kind, geom, opts) => ({ id, name, kind, geom, layout: frameLayout(spec(geom, opts)) });
  return [
    t(-14336, 'Document Window', 'doc', 'doc', { widgets: 'all' }),
    t(-14332, 'Collapsed Document Window', 'doc', 'doc', { widgets: 'all', collapsed: true }),
    t(-14328, 'Dialog', 'dialog', 'plain'),
    t(-14326, 'Alert', 'alert', 'plain'),
    t(-14324, 'Movable Modal', 'modal', 'modal'),
    t(-14322, 'Movable Alert', 'movableAlert', 'modal'),
    t(-14304, 'Titled Utility Window', 'util', 'util', { widgets: 'close' }),
    t(-14300, 'Collapsed Titled Utility Window', 'util', 'util', { widgets: 'close', collapsed: true }),
  ];
}
