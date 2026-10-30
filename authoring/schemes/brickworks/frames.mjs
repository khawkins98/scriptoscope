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
import { STUD, STUD_W, STUD_H, STACK, WHEEL, legend } from './sprites.mjs';

const RUN = 24;        // one 2-stud brick
const PLATE_RUN = 12;  // one baseplate stud and its gap

// ── Geometry per family ────────────────────────────────────────────────────
// T: top band. barTop: the bar's top-edge row (8px studs stand on it, rows
// barTop-5..barTop). blockTop: the top edge of the raised corner stacks
// (two bricks: one above the bar, one beside it). tile: first and last row
// of the white title tile. title: the title rect rows (≥ 17). wy: widget row.
// side: wall width. course: wall brick height (seam included). B: bottom band.
const G = {
  doc: { T: 62, barTop: 34, blockTop: 20, tile: [38, 57], title: [38, 58], wy: 40, side: 16, course: 14, B: 18, cornerL: 28, cornerR: 36, crane: 40 },
  modal: { T: 40, barTop: 16, blockTop: 6, tile: [19, 36], title: [19, 37], wy: 21, side: 14, course: 12, B: 14, cornerL: 26, cornerR: 26 },
  util: { T: 30, barTop: 6, blockTop: 6, tile: [9, 26], title: [9, 27], wy: 10, side: 12, course: 10, B: 14, cornerL: 24, cornerR: 16 },
  plain: { T: 32, barTop: 14, blockTop: 14, centreTop: 6, side: 12, course: 10, B: 14, cornerL: 18, cornerR: 18, centre: 32 },
};
const CAP = 3; // code-6 bezel width
const wallPeriod = (g) => 2 * g.course; // two courses, one of each wall colour

function spec(geom, { collapsed = false, widgets = 'none', crane = false } = {}) {
  const g = G[geom];
  // Stud runs grow by tiling one 24px brick: code 11 left of the centre piece
  // (tiles from its far end, so it phase-locks to the centre) and code 8 right
  // of it (tiles from its near end). Partial bricks land against the raised
  // corner stacks, where a cut stud reads as standing behind the stack (R3).
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
    wset.zoom = box(x0 + 3);
    wset.collapse = box(x0 + 3 + WIDGET + 1);
  }
  // Each side is one code-8 grower holding a whole four-course period (R2).
  const wall = (name) => [{ name, code: 8, w: wallPeriod(g) }];
  return {
    topH: g.T, sideL: g.side, sideR: g.side, bottomH: g.B, collapsed,
    top, bottom, left: wall('wallL'), right: wall('wallR'),
    ...(geom === 'plain' ? {} : { title: { cell: 'plate', top: g.title[0], bottom: g.title[1] } }),
    widgets: wset,
  };
}

// ── Brick painting ─────────────────────────────────────────────────────────

const stud = (r, x, y0, b, p) => r.sprite(x, y0, STUD, legend(b, p));

/**
 * The face of one brick inside its outline: columns [x0, x1], rows [y0, y1]
 * (inclusive). Lit from the upper left: a `hi` top row and left column, a
 * `lo` bottom row and right column, `base` in between.
 */
function face(r, x0, x1, y0, y1, b) {
  r.fillRect(x0, y0, x1 - x0 + 1, y1 - y0 + 1, b.base);
  r.hline(x0, y0, x1 - x0 + 1, b.hi).vline(x0, y0, y1 - y0 + 1, b.hi);
  r.hline(x0 + 1, y1, x1 - x0, b.lo).vline(x1, y0 + 1, y1 - y0, b.lo);
  return r;
}

/**
 * A brick over columns [x0, x0 + w) and rows [top, last]: outline on its top
 * edge (studs stand on it), on its bottom row, and on the sides asked for;
 * the face inside. `flat` keeps every column identical (for tiled cells).
 */
function brick(r, x0, w, top, last, b, p, { seamL = false, seamR = false, flat = false } = {}) {
  r.fillRect(x0, top, w, last - top + 1, p.outline);
  if (flat) {
    r.hline(x0, top + 1, w, b.hi).fillRect(x0, top + 2, w, last - top - 3, b.base).hline(x0, last - 1, w, b.lo);
    return r;
  }
  return face(r, x0 + (seamL ? 1 : 0), x0 + w - 1 - (seamR ? 1 : 0), top + 1, last - 1, b);
}

/** n studs evenly spread over a block's top edge. */
function studsOn(r, x0, w, top, n, b, p) {
  const gap = (w - n * STUD_W) / (n + 1);
  for (let k = 0; k < n; k++) stud(r, x0 + Math.round(gap + k * (STUD_W + gap)), top - STUD_H + 1, b, p);
}
const studCount = (w) => Math.max(1, Math.min(2, Math.floor((w + 4) / 12)));

/** A raised corner stack: a brick above the bar and one beside it, studs on top. */
function cornerStack(r, x0, w, g, last, b, p) {
  if (g.blockTop < g.barTop) brick(r, x0, w, g.blockTop, g.barTop, b, p, { seamL: true, seamR: true });
  brick(r, x0, w, g.barTop, last, b, p, { seamL: true, seamR: true });
  if (g.blockTop < g.barTop) r.hline(x0, g.barTop, w, p.outline);
  studsOn(r, x0, w, g.blockTop, studCount(w), b, p);
}

function paintTop(r, layout, g, colours, p, kind) {
  const last = layout.top - 1;
  const bar = p[colours.bar];
  for (const cell of layout.cells.top) {
    const { name, x0, w } = cell;
    if (name === 'capL' || name === 'capR' || name === 'plate') {
      brick(r, x0, w, g.barTop, last, bar, p, { flat: true });
    } else if (name.startsWith('run')) {
      brick(r, x0, w, g.barTop, last, bar, p, { seamL: true });
      stud(r, x0 + 2, g.barTop - STUD_H + 1, bar, p);
      stud(r, x0 + 14, g.barTop - STUD_H + 1, bar, p);
    } else if (name === 'crane') {
      // Two bar bricks under the crane: a red one with no studs (the gap the
      // hanging brick is headed for) and the crane's yellow base brick.
      brick(r, x0, 16, g.barTop, last, bar, p, { seamL: true });
      brick(r, x0 + 16, w - 16, g.barTop, last, p.yellow, p, { seamL: true });
    }
  }
  const corner = p[colours.corner];
  const cl = layout.named('cornerL'), cr = layout.named('cornerR');
  cornerStack(r, cl.x0, cl.w, g, last, corner, p);
  cornerStack(r, cr.x0, cr.w, g, last, corner, p);
  if (kind === 'dialog' || kind === 'alert') {
    const c = layout.named('centre'), cb = p[colours.centre];
    brick(r, c.x0, c.w, g.centreTop, last, cb, p, { seamL: true, seamR: true });
    studsOn(r, c.x0, c.w, g.centreTop, 2, cb, p);
    if (kind === 'alert') {
      // A printed exclamation mark on the alert's centre brick: whole pixels.
      const cx = c.x0 + Math.floor(c.w / 2) - 1, ink = p.glyph ?? p.white.base;
      r.fillRect(cx, g.centreTop + 4, 2, 13, ink).fillRect(cx, g.centreTop + 19, 2, 3, ink);
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
 * it is placed here. Rows 0..barTop-1 of the 40px crane cell: an 8px yellow
 * lattice jib rising up-left at 45° from behind the cab, a cable to a grey
 * hook, and a red 1×2 brick hanging over the stud-less brick in the bar
 * below. The cab stands on a grey turntable on the crane's yellow base brick.
 */
function paintCrane(r, cell, g, p) {
  const x0 = cell.x0, Y = p.yellow, grey = p.grey, o = p.outline;
  if (g.barTop !== 34) throw new Error('brickworks: the crane is drawn for a 34-row sky');
  // Jib: rows 1..24, 8px across, stepping right one pixel per row. Rails are
  // hi (upper) and lo (lower); between them yellow rungs cross a dark gap
  // every third row, so it reads as a lattice. The cab hides its foot.
  for (let y = 1; y <= 24; y++) {
    const L = x0 + 3 + y;
    const rung = (u) => ((2 * y + u) % 6 < 2 ? Y.base : o);
    r.set(L, y, o).set(L + 1, y, Y.hi);
    for (let u = 2; u <= 5; u++) r.set(L + u, y, rung(u));
    r.set(L + 6, y, Y.lo).set(L + 7, y, o);
  }
  // The jib head: a rounded cap with a grey sheave.
  r.hline(x0 + 4, 0, 7, o).set(x0 + 3, 1, o).hline(x0 + 4, 1, 6, Y.hi)
    .set(x0 + 6, 2, grey.hi).set(x0 + 7, 2, grey.base).set(x0 + 6, 3, grey.base).set(x0 + 7, 3, grey.lo);
  // Cab: rows 18..31 with a grey pivot pin, on a turntable (rows 32..33).
  const cx0 = x0 + 23, cx1 = x0 + 38;
  r.hline(cx0, 18, cx1 - cx0 + 1, o);
  for (let y = 19; y <= 30; y++) r.set(cx0, y, o).set(cx1, y, o);
  face(r, cx0 + 1, cx1 - 1, 19, 30, Y);
  r.hline(cx0, 31, cx1 - cx0 + 1, o);
  r.sprite(cx0 + 3, 22, ['.oooo.', 'oGGgko', 'oGggko', 'ogggko', 'okkkko', '.oooo.'], { o, G: grey.hi, g: grey.base, k: grey.lo });
  r.set(cx0 - 2, 32, o).hline(cx0 - 1, 32, cx1 - cx0 + 3, grey.hi).set(cx1 + 2, 32, o);
  r.set(cx0 - 2, 33, o).hline(cx0 - 1, 33, cx1 - cx0 + 3, grey.base).set(cx1 + 2, 33, o);
  // Cable and hook.
  const hx = x0 + 6;
  r.vline(hx, 4, 6, p.cable);
  r.sprite(hx - 1, 10, ['.o.', 'oGo', 'g.k'], { o, G: grey.hi, g: grey.base, k: grey.lo });
  // The hanging red brick: an 8px stud on top (rows 13..18), body rows 18..27.
  const red = p.red, bx = hx - 6;
  stud(r, bx + 3, 13, red, p);
  r.hline(bx, 18, 3, o).hline(bx + 11, 18, 3, o);
  for (let y = 19; y <= 26; y++) r.set(bx, y, o).set(bx + 13, y, o);
  face(r, bx + 1, bx + 12, 19, 26, red);
  r.hline(bx, 27, 14, o);
}

/**
 * Brick walls: stacked bricks (from the content's top), alternating the two
 * wall colours, each with its own outline, a lit top-left and a shaded
 * bottom-right. The right wall swaps the colours and is shifted half a
 * course, so the two walls' seams never line up.
 */
function paintSides(r, layout, g, colours, p) {
  const A = layout.content, ch = g.course;
  const sides = [[0, A.left, colours.walls, 0], [A.right, layout.width - A.right, [colours.walls[1], colours.walls[0]], ch >> 1]];
  for (const [x0, w, walls, shift] of sides) {
    r.fillRect(x0, A.top, w, A.bottom - A.top, p.outline);
    // Course k starts at row A.top + k·ch - shift; draw one extra on each end and clip.
    for (let k = -1; k * ch - shift < A.bottom - A.top; k++) {
      const b = p[walls[((k % 2) + 2) % 2]];
      const y0 = A.top + k * ch - shift, y1 = y0 + ch - 2; // face rows; the row after is the seam
      const clip = new Raster(r.width, r.height);
      face(clip, x0 + 1, x0 + w - 2, y0, y1, b);
      for (let y = Math.max(y0, A.top); y <= Math.min(y1, A.bottom - 1); y++) for (let x = x0; x < x0 + w; x++) {
        const c = clip.get(x, y);
        if (c) r.set(x, y, c);
      }
    }
  }
}

/** The green baseplate: ground behind the studs, the studs, then the plate. */
function paintBottom(r, layout, g, colours, p) {
  const plate = p[colours.base];
  const y0 = layout.content.bottom, W = layout.width, B = layout.bottom;
  const pt = y0 + B - 8; // the plate's top edge row
  r.fillRect(0, y0, W, pt - y0, BODY);
  brick(r, 0, W, pt, y0 + B - 1, plate, p, { flat: true });
  const run = layout.named('baseRun');
  stud(r, run.x0 + 2, pt - STUD_H + 1, plate, p);
  // Wall feet: the last course of each wall stands on the plate.
  const walls = colours.walls;
  for (const [x0, c] of [[0, walls[1]], [W - g.side, walls[0]]]) {
    brick(r, x0, g.side, y0, pt, p[c], p, { seamL: true, seamR: true });
  }
}

/** The document's bottom corners: the loose bricks and the wheel. */
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
    paintSides(r, layout, g, colours, p);
    paintBottom(r, layout, g, colours, p);
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
