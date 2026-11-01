// Brickworks window frames, painted over the concept (concept/concept.jpg).
//
// The concept is drawn at about 2.5× in a three-quarter view: every brick shows
// its top face with two staggered rows of studs above a front face. At 1× its
// document window has a 105-row top band (the crane reaches row 0, the bar's
// stud tops are at row 63, its front face rows 83–103), a 29px left wall whose
// bricks show a skewed side face, an 18px right wall and a ~21-row baseplate.
// This file rebuilds those proportions cell by cell:
//
//   - The left corner stack is the concept's own pixels (concept-pieces.mjs,
//     shrunk with `npm run paint-over` and cleaned by hand).
//   - The bar is one 18px tile (a back-row and a front-row stud lifted from
//     the concept, sprites.mjs TOP_STUD) grown by code 11 left of the title and
//     code 8 right of it, so partial bricks land against the corners (R3).
//   - The title tile is code-6 caps around an 18px code-5 plate marked
//     `tiled`: the engine tiles the plate's source across the measured title
//     width (compositor-spec "Title TEXT + plate"), so the stud row runs on
//     above the title; only the title rows have to be uniform.
//   - The crane is drawn here at the concept's geometry: a 45° lattice jib from
//     its tip to the cab on the right corner, a hook and a hanging
//     1×2 brick. Its left part is a code-10 cell, dropped on tiny windows (R6).
//   - Walls: the left one shows each brick's side face, so its seams step
//     down diagonally; the right one is plain stacked bricks. Each side is one
//     code-8 grower holding a whole two-brick period (R2), then a fixed cell
//     at the foot (the loose bricks on the left).
//   - The bottom is the green baseplate: ground behind a row of perspective
//     studs (one 14px code-8 tile) and the plate; the document adds the loose
//     blue and green bricks at the left and the wheel at the right.
//
// Smaller window types keep the same bar, walls and plate, cropped: a movable
// modal loses the crane's sky, a utility window and untitled dialogs lose the
// raised corners too.
import { Raster, frameLayout } from '../../../tools/theme-author/index.js';
import { pal, SCHEME_COLOURS, BODY } from './palette.mjs';
import { drawWidget, WIDGET } from './widgets.mjs';
import { TOP_STUD, PLATE_STUD, PLATE_STUD_W, WHEEL } from './sprites.mjs';
import { CORNER_L, CORNER_L_Y } from './concept-pieces.mjs';

const RUN = 18;        // one bar tile: a back-row and a front-row stud
const PLATE_RUN = 14;  // one baseplate stud and its gap
const BRICK_H = 19;    // wall brick: 18 face rows and a seam
const WALL = 2 * BRICK_H;
const CAP = 3;

// ── Rows of the bar, in document coordinates (concept py − 1) ─────────────
// Other window types drop `sky` rows from the top.
const BAR = {
  backStud: 63,  // back-row stud tops (7 rows)
  edge: 69,      // the top face's back edge
  face: 70,      // top face 70..81
  frontStud: 74, // front-row studs (7 rows)
  lip: 82,       // lit front edge of the top face
  front: 83,     // front face 83..103 (83 lit, 103 shaded)
  last: 104,     // the row on the content (outlined)
  tile: [83, 103],
};

// Geometry per family. sky: rows cut from the top of the document's band.
// side: [left, right] wall widths. skew: the left wall shows side faces.
const G = {
  doc: { sky: 0, side: [29, 16], skew: true, B: 21, cornerL: 48, cornerR: 50, crane: 26, foot: 26, raised: true },
  modal: { sky: 49, side: [29, 18], skew: true, B: 21, cornerL: 48, cornerR: 32, foot: 0, raised: true },
  util: { sky: 62, side: [18, 18], skew: false, B: 17, cornerL: 24, cornerR: 18, foot: 0, raised: false },
  plain: { sky: 49, side: [18, 18], skew: false, B: 17, cornerL: 18, cornerR: 18, centre: 34, foot: 0, raised: false },
};
const T_DOC = BAR.last + 1;

function spec(geom, { collapsed = false, widgets = 'none', crane = false } = {}) {
  const g = G[geom];
  const T = T_DOC - g.sky;
  const middle = geom === 'plain'
    ? [{ name: 'centre', code: 1, w: g.centre }]
    : [{ name: 'capL', code: 6, w: CAP }, { name: 'plate', code: 5, w: RUN, tiled: true }, { name: 'capR', code: 6, w: CAP }];
  const top = [
    { name: 'cornerL', code: 1, w: g.cornerL }, { name: 'runL', code: 11, w: RUN },
    ...middle,
    { name: 'runR', code: 8, w: RUN },
    ...(crane ? [{ name: 'crane', code: 10, w: g.crane }] : []),
    { name: 'cornerR', code: 1, w: g.cornerR },
  ];
  const W = top.reduce((s, c) => s + c.w, 0);
  const baseL = crane ? 52 : g.side[0] + 2;
  const baseR = crane ? g.side[1] + 18 : g.side[1] + 2;
  const bottom = [
    { name: 'baseL', code: 1, w: baseL }, { name: 'skip', code: 0, w: W - baseL - baseR - PLATE_RUN },
    { name: 'baseRun', code: 8, w: PLATE_RUN },
    { name: 'baseR', code: 1, w: baseR },
  ];
  const wy = BAR.front + 2 - g.sky;
  const wset = {};
  const box = (x) => ({ x, y: wy, w: WIDGET, h: WIDGET });
  if (widgets !== 'none') wset.close = box(geom === 'util' ? 4 : 30);
  if (widgets === 'all') {
    const x0 = W - g.cornerR;
    wset.zoom = box(x0);
    wset.collapse = box(x0 + WIDGET);
  }
  const side = (name) => [{ name, code: 8, w: WALL }, ...(g.foot ? [{ name: `${name}Foot`, code: 1, w: g.foot }] : [])];
  return {
    topH: T, sideL: g.side[0], sideR: g.side[1], bottomH: g.B, collapsed,
    top, bottom, left: side('wallL'), right: side('wallR'),
    ...(geom === 'plain' ? {} : { title: { cell: 'plate', top: BAR.tile[0] - g.sky, bottom: BAR.last - g.sky } }),
    widgets: wset,
  };
}

// ── Painting helpers ──────────────────────────────────────────────────────

/** A sprite whose letters map to a brick ramp (h hi, b base, l lo, d deep) and the outline (o). */
const ramp = (b, p) => ({ o: p.outline, h: b.hi, b: b.base, l: b.lo, d: b.deep });

/** One column of the bar without studs (the title plate and caps use it). */
function barColumn(r, x, b, p, sky) {
  const at = (y) => y - sky;
  for (let y = BAR.backStud; y <= BAR.last; y++) {
    let c = null;
    if (y === BAR.edge) c = p.outline;
    else if (y >= BAR.face && y < BAR.lip) c = b.base;
    else if (y === BAR.lip || y === BAR.front) c = b.hi;
    else if (y > BAR.front && y < BAR.last - 1) c = b.base;
    else if (y === BAR.last - 1) c = b.lo;
    else if (y === BAR.last) c = p.outline;
    if (c) r.set(x, at(y), c);
  }
}

/** The bar over columns [x0, x1): plain columns, then the two stud rows phased by `phase`. */
function barRun(r, x0, x1, b, p, sky, phase = x0) {
  for (let x = x0; x < x1; x++) barColumn(r, x, b, p, sky);
  const clip = (sx, sy, rows, legend) => rows.forEach((row, dy) => [...row].forEach((ch, dx) => {
    const x = sx + dx;
    if (ch !== '.' && x >= x0 && x < x1) r.set(x, sy + dy - sky, legend[ch]);
  }));
  const back = TOP_STUD.map((row, i) => (i < 2 ? row.replace(/d/g, 'o') : row));
  for (let k = Math.floor((x0 - phase) / RUN) - 1; phase + k * RUN < x1; k++) {
    const sx = phase + k * RUN;
    clip(sx, BAR.backStud, back, ramp(b, p));
    clip(sx + 3, BAR.frontStud, TOP_STUD, ramp(b, p));
  }
}

/** A brick joint across the bar's top face: where one brick ends and the next begins. */
function joint(r, x, p, sky) {
  for (let y = BAR.edge; y < BAR.lip; y++) r.set(x, y - sky, p.outline);
}

/** A brick face inside its outline: hi top row and left column, lo bottom row and right column. */
function face(r, x0, x1, y0, y1, b) {
  r.fillRect(x0, y0, x1 - x0 + 1, y1 - y0 + 1, b.base);
  r.hline(x0, y0, x1 - x0 + 1, b.hi).vline(x0, y0, y1 - y0 + 1, b.hi);
  r.hline(x0 + 1, y1, x1 - x0, b.lo).vline(x1, y0 + 1, y1 - y0, b.lo);
  return r;
}
function boxed(r, x0, x1, y0, y1, b, p) {
  r.strokeRect(x0, y0, x1 - x0 + 1, y1 - y0 + 1, p.outline);
  return face(r, x0 + 1, x1 - 1, y0 + 1, y1 - 1, b);
}

/** A brick standing on the bar seen in three-quarter view: top face with studs, then front face. */
function standingBrick(r, x0, x1, top, bottom, b, p, studs) {
  // top face: 5 rows (outline, 3 base, lit lip), then the front face down to `bottom`
  r.hline(x0, top, x1 - x0 + 1, p.outline);
  r.fillRect(x0, top + 1, x1 - x0 + 1, 3, b.base).hline(x0, top + 4, x1 - x0 + 1, b.hi);
  r.vline(x0, top, 5, p.outline).vline(x1, top, 5, p.outline);
  boxed(r, x0, x1, top + 4, bottom, b, p);
  r.hline(x0 + 1, top + 4, x1 - x0 - 1, b.hi);
  const back = TOP_STUD.map((row, i) => (i < 2 ? row.replace(/d/g, 'o') : row));
  for (const sx of studs) r.sprite(sx, top - 4, back, ramp(b, p));
}

// ── Top band ──────────────────────────────────────────────────────────────

function paintTop(r, layout, t, g, colours, p) {
  const sky = g.sky, bar = p[colours.bar], Y = p[colours.corner];
  const cell = (n) => layout.named(n);
  // Stud phases. The tile (TOP_STUD at 0 and 3) leaves columns 15..17 bare, so
  // each cell is phased to start with that gap (G = 15): a grower or the
  // tiled plate cut at run time then ends its last partial stud against a
  // brick joint drawn at the start of the next cell, never against a stud.
  const G = 15;
  const startGap = (x) => x - G;     // tile column G at x
  const endGap = (x1) => x1;         // tile column 17 at x1 - 1
  for (const c of layout.cells.top) {
    if (c.name === 'runL') barRun(r, c.x0, c.x1, bar, p, sky, endGap(c.x1));
    else if (c.name === 'runR' || c.name === 'crane' || c.name === 'plate') barRun(r, c.x0, c.x1, bar, p, sky, startGap(c.x0));
    else if (c.name === 'capL' || c.name === 'capR') for (let x = c.x0; x < c.x1; x++) barColumn(r, x, bar, p, sky);
    if (['capR', 'crane', 'runR', 'runL', 'plate'].includes(c.name)) joint(r, c.x0, p, sky);
    if (c.name === 'capL') joint(r, c.x0 + 1, p, sky);
  }
  // Left corner.
  const cl = cell('cornerL');
  if (g.raised) {
    barRun(r, cl.x0 + 29, cl.x1, bar, p, sky, endGap(cl.x1));
    joint(r, cl.x1 - 1, p, sky);
    const legend = { o: p.outline, Y: Y.hi, y: Y.base, w: Y.lo, W: Y.deep };
    r.sprite(cl.x0, CORNER_L_Y - sky, CORNER_L, legend);
  } else {
    // Bar-height yellow brick with the bar's studs.
    barRun(r, cl.x0, cl.x1, Y, p, sky, endGap(cl.x1));
    r.vline(cl.x1 - 1, BAR.edge - sky, BAR.last - BAR.edge + 1, p.outline);
  }
  // Right corner.
  const cr = cell('cornerR');
  if (t.crane) paintCraneCorner(r, cr, g, p, bar, Y, startGap(cr.x0));
  else if (g.raised) {
    barRun(r, cr.x0, cr.x1, bar, p, sky, startGap(cr.x0));
    joint(r, cr.x0, p, sky);
    standingBrick(r, cr.x0, cr.x1 - 1, 61 - sky, BAR.last - sky, Y, p, [cr.x0 + 3, cr.x0 + 17]);
  } else {
    barRun(r, cr.x0, cr.x1, Y, p, sky, startGap(cr.x0));
    r.vline(cr.x0, BAR.edge - sky, BAR.last - BAR.edge + 1, p.outline);
  }
  if (t.kind === 'dialog' || t.kind === 'alert') {
    const c = cell('centre'), cb = p[colours.centre];
    barRun(r, c.x0, c.x1, bar, p, sky, startGap(c.x0));
    standingBrick(r, c.x0, c.x1 - 1, 61 - sky, BAR.last - sky, cb, p, [c.x0 + 4, c.x0 + 18]);
    if (t.kind === 'alert') {
      const cx = c.x0 + Math.floor(c.w / 2) - 1, ink = p.glyph ?? p.white.base;
      r.fillRect(cx, 70 - sky, 2, 20, ink).fillRect(cx, 94 - sky, 2, 3, ink);
    }
  }
  if (layout.titled) paintTile(r, layout, g, p, bar);
}

/** The white title tile across capL | plate | capR, on the bar's front face. */
function paintTile(r, layout, g, p, bar) {
  const capL = layout.named('capL'), capR = layout.named('capR');
  const [t0, t1] = BAR.tile.map((y) => y - g.sky);
  const W = p.white;
  for (let y = t0; y <= t1; y++) {
    const c = y === t0 || y === t1 ? p.outline : y <= t0 + 2 ? W.hi : y === t1 - 1 ? W.lo : W.base;
    r.hline(capL.x0, y, capR.x1 - capL.x0, c);
  }
  r.vline(capL.x0, t0, t1 - t0 + 1, p.outline).vline(capR.x1 - 1, t0, t1 - t0 + 1, p.outline);
  r.vline(capL.x0 + 1, t0 + 1, t1 - t0 - 1, W.hi).vline(capR.x1 - 2, t0 + 2, t1 - t0 - 2, W.lo);
  r.set(capL.x0, t0, bar.hi).set(capR.x1 - 1, t0, bar.hi);
}

/** The document's right corner: bar under the widgets, the yellow brick the crane stands on, the corner column. */
function paintCraneCorner(r, cr, g, p, bar, Y, ph) {
  const x0 = cr.x0, x1 = cr.x1 - 1;
  barRun(r, x0, cr.x1, bar, p, 0, ph);
  joint(r, x0, p, 0);
  // The yellow brick standing on the bar (its front face rows 61..82) and the
  // column below it down to the wall.
  standingBrick(r, x0 + 10, x1, 56, 83, Y, p, [x0 + 14, x0 + 36]);
  boxed(r, x0 + 34, x1, 83, BAR.last, Y, p);
  r.hline(x0 + 35, 83, x1 - x0 - 35, Y.lo);
}

/**
 * The crane at the concept's geometry, drawn after the frame's outline pass.
 * Jib: a 10px lattice at 45° from its tip at (crane.x0 + 7, 0) down to the
 * cab on the corner brick; the cab; a cable, a grey hook and a hanging red
 * 1×2 brick over the bar.
 */
function paintCrane(r, cc, cr, g, p, bar) {
  const o = p.outline, Y = p.yellow, grey = p.grey, x0 = cc.x0, rx = cr.x0;
  for (let y = 1; y <= 52; y++) {
    const L = x0 + 7 + y;
    r.set(L, y, o).set(L + 1, y, Y.hi);
    for (let u = 2; u <= 7; u++) {
      const strut = (y - u + 64) % 8 < 2 || (y + u) % 8 < 2;
      r.set(L + u, y, strut ? Y.base : o);
    }
    r.set(L + 8, y, Y.lo).set(L + 9, y, o);
  }
  r.hline(x0 + 7, 0, 9, o).sprite(x0 + 9, 2, ['oo.', 'ogk', '.k.'], { o, g: grey.hi, k: grey.base });
  // Cab with a grey pivot pin.
  const cx0 = rx + 25, cx1 = rx + 49, cy0 = 44, cy1 = 68;
  boxed(r, cx0, cx1, cy0, cy1, Y, p);
  r.sprite(rx + 41, 52, ['.ooo.', 'oGgko', 'oggko', 'okkko', '.ooo.'], { o, G: grey.hi, g: grey.base, k: grey.lo });
  r.vline(cx0 + 1, cy0 + 1, cy1 - cy0 - 1, Y.hi);
  // Cable and hook.
  const hx = x0 + 12;
  r.vline(hx, 4, 27, p.cable);
  r.sprite(hx - 2, 31, ['..o..', '.oGo.', 'ok.go', 'o...o', '.o.o.'], { o, G: grey.hi, g: grey.base, k: grey.lo });
  // The hanging red 1×2 brick (its studs behind the hook).
  const red = p.red;
  standingBrick(r, x0 + 1, x0 + 24, 41, 60, red, p, [x0 + 2, x0 + 13]);
  r.vline(x0 + 2, 46, 14, red.lo);
}

// ── Sides ─────────────────────────────────────────────────────────────────

/**
 * Wall bricks. Front rows: brick k covers rows [k·19, k·19 + 18) from the
 * content's top, its seam on the 19th. The left wall's side face (columns
 * 1..10) is sheared: column c is shifted down by 11 − c rows, so each seam
 * steps diagonally like the concept's three-quarter bricks.
 */
function wallPixel(p, walls, x, ly, w, skew) {
  const side = skew && x >= 1 && x <= 10;
  const s = ly + (side ? 11 - x : 0);
  const k = Math.floor(s / BRICK_H), ry = ((s % BRICK_H) + BRICK_H) % BRICK_H;
  const b = p[walls[((k % 2) + 2) % 2]];
  if (x === 0 || x === w - 1) return p.outline;
  if (ry === BRICK_H - 1) return p.outline;
  if (side) return ry === BRICK_H - 2 ? b.lo : b.base;
  const fx = skew ? 11 : 1;
  if (x === fx || ry === 0) return b.hi;
  if (ry === BRICK_H - 2 || x === w - 2) return b.lo;
  return b.base;
}

function paintSides(r, layout, g, colours, p) {
  const A = layout.content;
  const [wl, wr] = g.side;
  const right = [colours.walls[1], colours.walls[0]];
  for (let y = A.top; y < A.bottom; y++) {
    for (let x = 0; x < wl; x++) r.set(x, y, wallPixel(p, colours.walls, x, y - A.top, wl, g.skew));
    for (let x = 0; x < wr; x++) r.set(A.right + x, y, wallPixel(p, right, x, y - A.top + 9, wr, false));
  }
  // The skewed side faces continue up under the left corner block.
  if (g.skew && g.raised) {
    const Y = p[colours.corner];
    for (let y = A.top - 14; y < A.top; y++) for (let x = 0; x <= 10; x++) {
      const s = y - A.top + 11 - x;
      if (x === 0) r.set(x, y, p.outline);
      else if (s >= 0) r.set(x, y, wallPixel(p, colours.walls, x, y - A.top, wl, true));
      else if (s === -1) r.set(x, y, p.outline);
      else r.set(x, y, Y.lo); // the corner block's own side face
    }
    for (let x = 11; x < wl; x++) r.set(x, A.top - 1, p.outline);
  }
}

// ── Bottom ────────────────────────────────────────────────────────────────

function paintBottom(r, layout, g, colours, p) {
  const plate = p[colours.base];
  const A = layout.content, y0 = A.bottom, W = layout.width, B = layout.bottom;
  const pt = y0 + B - 9; // the plate's top-face row
  r.fillRect(0, y0, W, pt - y0, BODY);
  r.hline(0, pt, W, plate.base).hline(0, pt + 1, W, plate.hi);
  r.fillRect(0, pt + 2, W, y0 + B - 2 - (pt + 2), plate.base).hline(0, y0 + B - 2, W, plate.lo).hline(0, y0 + B - 1, W, p.outline);
  const run = layout.named('baseRun');
  r.sprite(run.x0 + 2, pt - 6, PLATE_STUD, ramp(plate, p));
  // The walls' last bricks stand on the plate.
  const [wl, wr] = g.side;
  for (const [x0, w, c] of [[0, wl, colours.walls[1]], [W - wr, wr, colours.walls[0]]]) {
    boxed(r, x0, x0 + w - 1, y0, pt, p[c], p);
  }
}

/** The document's loose bricks (left foot of the wall + bottom band) and the wheel. */
function paintDocCorners(r, layout, g, p) {
  const A = layout.content, W = layout.width, B = layout.bottom;
  const blue = p.blue, green = p.green, oy = A.bottom - g.foot; // stack origin row
  // Green 1×4 brick on the plate: top face with two studs, then its front.
  standingBrick(r, 0, 51, oy + 33, A.bottom + B - 1, green, p, [29, 39]);
  // Blue 2×2 brick on the green one, inside the left wall's columns.
  standingBrick(r, 0, 27, oy + 8, oy + 33, blue, p, [2, 14]);
  r.vline(1, oy + 13, 20, blue.hi);
  // The wheel grow box, leaning on the right wall's last brick.
  const grey = p.grey;
  r.sprite(W - g.side[1] - WHEEL[0].length + 1, A.bottom + B - WHEEL.length - 1, WHEEL, {
    o: p.outline, T: grey.base, t: grey.lo, s: grey.base, U: '#ffffff', u: grey.hi, a: grey.deep,
  });
}

/** Paint one frame image for a window type in a state ('active' | 'inactive'). */
export function paintFrame(t, state) {
  const { layout, geom, kind } = t;
  const g = G[geom];
  const p = pal(state);
  const colours = SCHEME_COLOURS[kind];
  const r = new Raster(layout.width, layout.height);
  paintTop(r, layout, t, g, colours, p);
  if (!layout.collapsed) {
    paintSides(r, layout, g, colours, p);
    paintBottom(r, layout, g, colours, p);
  }
  const A = layout.content;
  r.fillRect(A.left, A.top, A.right - A.left, A.bottom - A.top, null); // the content area is a hole
  r.outlineEdges(0, 0, r.width, r.height, p.outline);
  if (t.crane) paintCrane(r, layout.named('crane'), layout.named('cornerR'), g, p, p[colours.bar]);
  if (t.crane && !layout.collapsed) paintDocCorners(r, layout, g, p);
  for (const [role, box] of Object.entries(layout.widgets)) drawWidget(r, box, role, state);
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
