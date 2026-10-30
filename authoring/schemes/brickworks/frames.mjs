// Brickworks window frames: a window snapped together from toy bricks on a
// building site (concept/brief.md).
//
//   - The title bar is one course of red 2-stud bricks. Studs are 6px
//     cylinders standing proud of the bar (hand-placed sprite, sprites.mjs).
//     One 24px brick is the tile of a code-11 run left of the title and a
//     code-8 run right of it, so studs show at every width and partial
//     bricks tuck in against the raised corner blocks (exotic-frames R3).
//     (Whole-only code-12 runs left a 260px window with a bare bar.)
//   - Titled windows carry the title on a smooth white tile laid on the bar:
//     code-6 end caps around a 1px code-5 plate (R10).
//   - Document and modal windows have raised yellow 2×2 corner blocks (fixed
//     code-1 cells taller than the bar, R13); the widgets are round studs on
//     their front faces.
//   - The document's right corner carries a yellow lattice crane on its own
//     yellow base brick, lowering a red brick toward a gap in the bar. The
//     crane is a code-10 cell, so a window too narrow for it sheds it and
//     keeps the plain corner block (R6, R12).
//   - Side walls are courses of two colours (red and blue on a document),
//     one 46-row code-8 tile holding a whole period (R2).
//   - The bottom is a green baseplate whose studs stand inside the box (the
//     ground behind them is the body colour). The document adds a loose
//     brick stack on its bottom-left corner and a grey wheel as the grow box.
//     A code-0 skip lets the bottom drop template columns the top needs (R9).
//
// Flat plastic only: base face + one `hi` row on top + one `lo` column on the
// right + the warm near-black outline. No dither, no gradients.
import { Raster, frameLayout } from '../../../tools/theme-author/index.js';
import { pal, SCHEME_COLOURS, BODY } from './palette.mjs';
import { drawWidget, WIDGET } from './widgets.mjs';
import { STUD, STUD_W, STACK, WHEEL, legend } from './sprites.mjs';

const RUN = 24;        // one 2-stud brick
const PLATE_RUN = 10;  // one baseplate stud and its gap
const WALL = 46;       // two wall courses (23 rows each, seam included)

// ── Geometry per family ────────────────────────────────────────────────────
// T: top band. barTop: the bar's top-edge row (studs stand on it, rows
// barTop-4..barTop). blockTop: the corner blocks' top-edge row. tile: first
// and last row of the white title tile. title: the title rect rows (≥ 17).
// wy: widget row. side: wall width. B: bottom band height.
const G = {
  doc: { T: 46, barTop: 24, blockTop: 14, tile: [26, 43], title: [26, 44], wy: 28, side: 10, B: 20, cornerL: 28, cornerR: 36, crane: 36 },
  modal: { T: 36, barTop: 14, blockTop: 4, tile: [16, 33], title: [16, 34], wy: 18, side: 10, B: 12, cornerL: 28, cornerR: 28 },
  util: { T: 25, barTop: 4, blockTop: 4, tile: [6, 22], title: [6, 23], wy: 8, side: 8, B: 12, cornerL: 22, cornerR: 16 },
  plain: { T: 22, barTop: 10, blockTop: 10, centreTop: 4, side: 8, B: 12, cornerL: 16, cornerR: 16, centre: 28 },
};
const CAP = 3; // code-6 bezel width

function spec(geom, { collapsed = false, widgets = 'none', crane = false } = {}) {
  const g = G[geom];
  // Stud runs grow by tiling one 24px brick: code 11 left of the centre piece
  // (tiles from its far end, so it phase-locks to the centre) and code 8 right
  // of it (tiles from its near end). Partial bricks land against the raised
  // corner blocks, where a cut stud reads as standing behind the block (R3).
  const middle = geom === 'plain'
    ? [{ name: 'centre', code: 1, w: g.centre }]
    : [{ name: 'capL', code: 6, w: CAP }, { name: 'plate', code: 5, w: 1 }, { name: 'capR', code: 6, w: CAP }];
  const top = [
    { name: 'cornerL', code: 1, w: g.cornerL }, { name: 'runL', code: 11, w: RUN },
    ...middle,
    { name: 'runR', code: 8, w: RUN },
    ...(crane ? [{ name: 'crane', code: 10, w: g.crane }] : []),
    { name: 'cornerR', code: 1, w: g.cornerR },
  ];
  const W = top.reduce((s, c) => s + c.w, 0);
  const baseL = crane ? STACK[0].length : g.side + 2;
  const baseR = crane ? g.side + WHEEL[0].length + 2 : g.side + 2;
  // The baseplate: one stud period tiled from the left (code 8), a code-0
  // skip for the template columns only the top needs (R9).
  const bottom = [
    { name: 'baseL', code: 1, w: baseL }, { name: 'skip', code: 0, w: W - baseL - baseR - PLATE_RUN },
    { name: 'baseRun', code: 8, w: PLATE_RUN },
    { name: 'baseR', code: 1, w: baseR },
  ];
  const wset = {};
  const box = (x) => ({ x, y: g.wy, w: WIDGET, h: WIDGET });
  if (widgets !== 'none') wset.close = box(Math.floor((g.cornerL - WIDGET) / 2));
  if (widgets === 'all') {
    const x0 = W - g.cornerR;
    wset.zoom = box(x0 + 4);
    wset.collapse = box(x0 + 4 + WIDGET + 2);
  }
  return {
    topH: g.T, sideL: g.side, sideR: g.side, bottomH: g.B, collapsed,
    top, bottom, left: [{ name: 'wallL', code: 8, w: WALL }], right: [{ name: 'wallR', code: 8, w: WALL }],
    ...(geom === 'plain' ? {} : { title: { cell: 'plate', top: g.title[0], bottom: g.title[1] } }),
    widgets: wset,
  };
}

// ── Brick painting ─────────────────────────────────────────────────────────

const stud = (r, x, y0, b, p) => r.sprite(x, y0, STUD, legend(b, p));

/**
 * A brick face over columns [x0, x0 + w) and rows [top, last]: the top edge
 * row is outline (studs stand on it), then one `hi` row, then the base. A
 * seam (outline) on the left when `seamL`, and a `lo` column on the right
 * (or a seam there when `seamR`). The last row is left as base: the content
 * hole or the raster edge outlines it.
 */
function brick(r, x0, w, top, last, b, p, { seamL = false, seamR = false, lo = true } = {}) {
  r.hline(x0, top, w, p.outline);
  r.hline(x0, top + 1, w, b.hi);
  r.fillRect(x0, top + 2, w, last - top - 1, b.base);
  if (lo) r.vline(x0 + w - 1 - (seamR ? 1 : 0), top + 1, last - top, b.lo);
  if (seamL) r.vline(x0, top, last - top + 1, p.outline);
  if (seamR) r.vline(x0 + w - 1, top, last - top + 1, p.outline);
  return r;
}

/** n studs evenly spread over a block's top edge. */
function studsOn(r, x0, w, top, n, b, p) {
  const gap = (w - n * STUD_W) / (n + 1);
  for (let k = 0; k < n; k++) stud(r, x0 + Math.round(gap + k * (STUD_W + gap)), top - 4, b, p);
}
const studCount = (w) => Math.max(1, Math.floor((w + 2) / 12));

function paintTop(r, layout, g, colours, p, kind) {
  const last = layout.top - 1;
  const bar = p[colours.bar];
  for (const cell of layout.cells.top) {
    const { name, x0, w } = cell;
    if (name === 'capL' || name === 'capR' || name === 'plate') {
      brick(r, x0, w, g.barTop, last, bar, p, { lo: false });
    } else if (name.startsWith('run')) {
      brick(r, x0, w, g.barTop, last, bar, p, { seamL: true });
      stud(r, x0 + 3, g.barTop - 4, bar, p);
      stud(r, x0 + 15, g.barTop - 4, bar, p);
    } else if (name === 'crane') {
      // Two bar bricks under the crane: a red one with no stud (the gap the
      // hanging brick is headed for) and the crane's yellow base brick.
      brick(r, x0, 18, g.barTop, last, bar, p, { seamL: true });
      brick(r, x0 + 18, w - 18, g.barTop, last, p.yellow, p, { seamL: true });
    }
  }
  const corner = p[colours.corner];
  const cl = layout.named('cornerL'), cr = layout.named('cornerR');
  // Corner blocks sit on the walls: a seam along their foot, and seams on both sides.
  brick(r, cl.x0, cl.w, g.blockTop, last, corner, p, { seamL: true, seamR: true }).hline(cl.x0, last, cl.w, p.outline);
  studsOn(r, cl.x0, cl.w, g.blockTop, studCount(cl.w), corner, p);
  brick(r, cr.x0, cr.w, g.blockTop, last, corner, p, { seamL: true, seamR: true }).hline(cr.x0, last, cr.w, p.outline);
  studsOn(r, cr.x0, cr.w, g.blockTop, studCount(cr.w), corner, p);
  if (kind === 'dialog' || kind === 'alert') {
    const c = layout.named('centre'), cb = p[colours.centre];
    brick(r, c.x0, c.w, g.centreTop, last, cb, p, { seamL: true, seamR: true });
    studsOn(r, c.x0, c.w, g.centreTop, 2, cb, p);
    if (kind === 'alert') {
      // A printed exclamation mark on the alert's centre brick: whole pixels.
      const cx = c.x0 + Math.floor(c.w / 2) - 1, ink = p.glyph ?? p.white.base;
      r.fillRect(cx, g.centreTop + 3, 2, 9, ink).fillRect(cx, g.centreTop + 14, 2, 2, ink);
    }
  }
  if (layout.titled) paintTile(r, layout, g, p, bar);
}

/** The smooth white title tile across capL | plate | capR; one colour per row on the plate (it tiles). */
function paintTile(r, layout, g, p, bar) {
  const capL = layout.named('capL'), capR = layout.named('capR');
  const [t0, t1] = g.tile;
  const tile = p.white;
  const row = (y) => (y === t0 || y === t1 ? p.outline : y === t0 + 1 ? tile.hi : y === t1 - 1 ? tile.lo : tile.base);
  for (let y = t0; y <= t1; y++) r.hline(capL.x0, y, capR.x1 - capL.x0, row(y));
  // Ends: an outline column, a lit left edge and a shaded right edge, square
  // corners nicked by one pixel.
  r.vline(capL.x0, t0, t1 - t0 + 1, p.outline).vline(capR.x1 - 1, t0, t1 - t0 + 1, p.outline);
  r.vline(capL.x0 + 1, t0 + 1, t1 - t0 - 2, tile.hi).vline(capR.x1 - 2, t0 + 1, t1 - t0 - 1, tile.lo);
  for (const x of [capL.x0, capR.x1 - 1]) r.set(x, t0, bar.base).set(x, t1, bar.base);
}

/**
 * The crane (document only), drawn after the outline pass so every pixel of
 * it is placed here. Rows 0..23 of the 36px crane cell: a yellow lattice jib
 * rising up-left at 45° from behind the cab, a cable to a grey hook, and a
 * red 1×1 brick hanging over the stud-less brick in the bar below. The cab
 * stands on a grey turntable on the crane's yellow base brick.
 */
function paintCrane(r, cell, g, p) {
  const x0 = cell.x0, Y = p.yellow, grey = p.grey, o = p.outline;
  if (g.barTop !== 24) throw new Error('brickworks: the crane is drawn for a 24-row sky');
  // Jib: rows 0..18, 7px across, stepping right one pixel per row. Rails are
  // hi (upper) and lo (lower); between them yellow rungs cross a dark gap
  // every third row, so it reads as a lattice.
  for (let y = 1; y <= 19; y++) {
    const L = x0 + 3 + y;
    const rung = (u) => ((2 * y + u) % 6 < 2 ? Y.base : o);
    r.set(L, y, o).set(L + 1, y, Y.hi).set(L + 2, y, rung(2)).set(L + 3, y, rung(3)).set(L + 4, y, rung(4))
      .set(L + 5, y, Y.lo).set(L + 6, y, o);
  }
  // The jib head: a rounded cap with a grey sheave.
  r.hline(x0 + 4, 0, 5, o).set(x0 + 3, 1, o).hline(x0 + 4, 1, 4, Y.hi).set(x0 + 5, 2, grey.hi).set(x0 + 6, 2, grey.base);
  // Cab: rows 12..21 with a grey pivot pin, on a turntable (rows 22..23).
  const cx0 = x0 + 22, cx1 = x0 + 33;
  r.hline(cx0, 12, cx1 - cx0 + 1, o);
  for (let y = 13; y <= 20; y++) {
    r.set(cx0, y, o).hline(cx0 + 1, y, cx1 - cx0 - 2, y === 13 ? Y.hi : Y.base).set(cx1 - 1, y, Y.lo).set(cx1, y, o);
  }
  r.hline(cx0, 21, cx1 - cx0 + 1, o);
  r.sprite(cx0 + 2, 15, ['.oo.', 'oGgo', 'ogko', '.oo.'], { o, G: grey.hi, g: grey.base, k: grey.lo });
  r.set(cx0 - 1, 22, o).hline(cx0, 22, cx1 - cx0 + 1, grey.hi).set(cx1 + 1, 22, o);
  r.set(cx0 - 1, 23, o).hline(cx0, 23, cx1 - cx0 + 1, grey.base).set(cx1 + 1, 23, o);
  // Cable and hook.
  const hx = x0 + 6;
  r.vline(hx, 3, 3, p.cable);
  r.sprite(hx - 1, 6, ['.o.', 'oGo', 'g.k'], { o, G: grey.hi, g: grey.base, k: grey.lo });
  // The hanging red 1×1 brick: stud rows 9..13, body rows 13..19.
  const red = p.red, bx = hx - 5;
  stud(r, bx + 2, 9, red, p);
  r.hline(bx, 13, 2, o).hline(bx + 8, 13, 2, o);
  for (let y = 14; y <= 18; y++) r.set(bx, y, o).hline(bx + 1, y, 7, y === 14 ? red.hi : red.base).set(bx + 8, y, red.lo).set(bx + 9, y, o);
  r.hline(bx, 19, 10, o);
}

/**
 * Two-colour wall courses, one 46-row period from the content's top. The
 * right wall swaps the colours and is staggered half a course, so the seams
 * of the two walls never line up.
 */
function paintSides(r, layout, colours, p) {
  const A = layout.content;
  const sides = [[0, A.left, colours.walls, 0], [A.right, layout.width - A.right, [colours.walls[1], colours.walls[0]], 11]];
  for (const [x0, w, walls, shift] of sides) {
    for (let y = A.top; y < A.bottom; y++) {
      const ly = (y - A.top + shift) % WALL, c = ly < WALL / 2 ? 0 : 1, ry = ly % (WALL / 2);
      const b = p[walls[c]];
      for (let x = x0; x < x0 + w; x++) {
        const lx = x - x0;
        let col = b.base;
        if (ry === WALL / 2 - 1) col = p.outline;                  // the seam under each brick
        else if (lx === w - 2) col = b.lo;                         // shaded right column
        else if (ry === 0) col = b.hi;                             // lit top row
        r.set(x, y, col);
      }
    }
  }
}

/** The green baseplate: ground behind the studs, the studs, then the plate. */
function paintBottom(r, layout, g, colours, p, kind) {
  const plate = p[colours.base];
  const y0 = layout.content.bottom, W = layout.width, B = layout.bottom;
  const pt = y0 + B - 6; // the plate's top edge row
  r.fillRect(0, y0, W, pt - y0, BODY);
  r.hline(0, pt, W, p.outline).hline(0, pt + 1, W, plate.hi);
  r.fillRect(0, pt + 2, W, 3, plate.base).hline(0, pt + 4, W, plate.lo).hline(0, pt + 5, W, p.outline);
  const run = layout.named('baseRun');
  stud(r, run.x0 + 2, pt - 4, plate, p);
  // Wall feet: the last course of each wall stands on the plate.
  const walls = colours.walls;
  for (const [x0, w, c] of [[0, g.side, walls[1]], [W - g.side, g.side, walls[0]]]) {
    brick(r, x0, w, y0, pt - 1, p[c], p, { seamL: true, seamR: true });
  }
}

/** The document's bottom corners: the loose brick stack and the wheel. */
function paintBottomCorners(r, layout, p) {
  const y0 = layout.content.bottom, W = layout.width;
  const blue = p.blue, green = p.green;
  r.sprite(0, y0, STACK, { o: p.outline, B: blue.hi, c: blue.base, L: blue.lo, E: green.hi, e: green.base, F: green.lo });
  const grey = p.grey;
  const wx = W - G.doc.side - WHEEL[0].length - 1;
  r.sprite(wx, y0 + layout.bottom - WHEEL.length, WHEEL, {
    o: p.outline, T: grey.base, t: grey.lo, s: grey.base, U: '#ffffff', u: grey.hi, a: grey.deep,
  });
}

/** Paint one frame image for a window type in a state ('active' | 'inactive'). */
export function paintFrame(t, state) {
  const { layout, geom, kind, crane } = t;
  const g = G[geom];
  const p = pal(state);
  const colours = SCHEME_COLOURS[kind];
  const r = new Raster(layout.width, layout.height);
  paintTop(r, layout, g, colours, p, kind);
  if (!layout.collapsed) {
    paintSides(r, layout, colours, p);
    paintBottom(r, layout, g, colours, p, kind);
  }
  const A = layout.content;
  r.fillRect(A.left, A.top, A.right - A.left, A.bottom - A.top, null); // the content area is a hole
  r.outlineEdges(0, 0, r.width, r.height, p.outline); // 1px outline round the whole silhouette
  if (crane) paintCrane(r, layout.named('crane'), g, p);
  if (crane && !layout.collapsed) paintBottomCorners(r, layout, p);
  for (const [role, box] of Object.entries(layout.widgets)) drawWidget(r, box, role, state);
  // Hidden swatches: title text at (A.left, A.top), its shadow one pixel right (TC2).
  r.swatch(A.left, A.top, p.title);
  r.swatch(A.left + 1, A.top, p.titleShadow);
  try { layout.lint(r); } catch (err) { throw new Error(`brickworks: ${t.name} (${state}): ${err.message}`); }
  return r;
}

/** Window type table: wnd# id → description. Active frame = id + 1. */
export function windowTypes() {
  const t = (id, name, kind, geom, opts = {}) => ({ id, name, kind, geom, crane: !!opts.crane, layout: frameLayout(spec(geom, opts)) });
  return [
    t(-14336, 'Document Window', 'doc', 'doc', { widgets: 'all', crane: true }),
    t(-14332, 'Collapsed Document Window', 'doc', 'doc', { widgets: 'all', crane: true, collapsed: true }),
    t(-14328, 'Dialog', 'dialog', 'plain'),
    t(-14326, 'Alert', 'alert', 'plain'),
    t(-14324, 'Movable Modal', 'modal', 'modal'),
    t(-14322, 'Movable Alert', 'movableAlert', 'modal'),
    t(-14304, 'Titled Utility Window', 'util', 'util', { widgets: 'close' }),
    t(-14300, 'Collapsed Titled Utility Window', 'util', 'util', { widgets: 'close', collapsed: true }),
  ];
}
