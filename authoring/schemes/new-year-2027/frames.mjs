// Midnight 2027 window frames: the window is the night sky at midnight.
// A navy bar with sparse stars carries a champagne-gold title plate; a big
// gold-and-pink firework bursts through the bar's top edge left of the plate,
// and "2027" in gold numerals stands on the bar right of it under a cyan
// burst. The sides and bottom are thin navy bands with a gold rule round the
// content, and the bottom-right corner holds the clock at midnight.
//
// Geometry comes from the toolkit's frameLayout (per-edge cell lists). The
// recipes, per edge (document; numbers from concept/brief.md §3, measured
// off the concept at 3.7 source px per art pixel):
//
//   top (document)   cornerL 1 | burst 10 | bar 11 | capL 6 | plate 5 | capR 6 | bar 8 | year 10 | cornerR 1
//   top (modal)      the same, the corners without widgets
//   top (utility)    cornerL 1 | bar 11 | capL 6 | plate 5 | capR 6 | bar 8 | cornerR 1 (a small sparkle above it)
//   top (untitled)   cornerL 1 | bar 11 | crest 1 | bar 8 | cornerR 1     (burst on dialogs, clock on alerts)
//   left / right     sky 8 | twinkle 1 | sky 8                             (body rows only)
//   bottom           cornerBL 1 | sky 11 | mid 1 | sky 8 | clock 1        (document; the others end in a plain corner)
//
// Why these codes (docs/authoring-exotic-frames.md):
//   - The two bursts are code 10 (R6, R12): drawn once, never tiled, and
//     dropped (with the title) when the window is narrower than the top's
//     fixed cells. They ride the corners, with the bar's growers between
//     them and the plate, so the title gets the middle and the gap opens
//     as the window widens (the concept's layout).
//   - The bar tiles are 32px, one period of stars each, code 11 left of the
//     plate and 8 right of it (R3): the stars are painted in one phase across
//     the whole template, so every cell joins its neighbours and the partial
//     tiles land at the corners.
//   - The plate (code 5) is 2px, one colour per row (lint checks it). Its
//     rounded ends live in the code-6 caps, which vanish with the title.
//   - Bursts are clipped to their own cells, so no ray reaches the plate (a
//     code-5 column tiles whatever lands in it).
//   - Sides have two equal growers round one fixed twinkle, so the twinkles
//     stay centred down each side as the window grows ("many growers").
//   - The bursts are drawn AFTER the outline pass: single-pixel sparks would
//     otherwise all become outline.
//
// Light: one source, upper left. The bar has a lit row under its top edge,
// the left side a lit outer column; the plate, discs, numerals and clock rim
// are lit on their top/left and shaded on their bottom/right.
import { Raster, frameLayout } from '../../../tools/theme-author/index.js';
import { C } from './palette.mjs';
import { bigBurst, cyanBurst, drawYear, YEAR, clockFace, disc, WIDGET, twinkle } from './art.mjs';

// ── Geometry per window family ─────────────────────────────────────────────
// T: top band; barTop: the bar's first row (rows above it are sky, open to
// the page except for the ornaments). side/bottomH: band sizes.
const BAR_TILE = 32;
const G = {
  doc: { T: 86, barTop: 18, cornerL: 29, cornerR: 55, burst: 68, year: 79, cap: 8, side: 13, bottomH: 25, corner: 28, clock: 31, sideTile: 32, twinkle: 24 },
  util: { T: 38, barTop: 8, cornerL: 29, cornerR: 29, cap: 5, side: 7, bottomH: 10, corner: 16, sideTile: 16, twinkle: 16 },
  plain: { T: 42, barTop: 18, cornerL: 16, cornerR: 16, crest: 54, side: 10, bottomH: 18, corner: 24, sideTile: 24, twinkle: 24 },
};

/** Build the frameLayout spec for one window type. */
function spec(kind, { collapsed = false, widgets = 'none', clock = false, crest = 'burst' } = {}) {
  const g = G[kind];
  const titled = kind !== 'plain';
  const top = [{ name: 'cornerL', code: 1, w: g.cornerL }];
  if (kind === 'doc') {
    top.push({ name: 'burst', code: 10, w: g.burst }, { name: 'barL', code: 11, w: BAR_TILE },
      { name: 'capL', code: 6, w: g.cap }, { name: 'plate', code: 5, w: 2 }, { name: 'capR', code: 6, w: g.cap },
      { name: 'barR', code: 8, w: BAR_TILE }, { name: 'year', code: 10, w: g.year });
  } else if (kind === 'util') {
    top.push({ name: 'barL', code: 11, w: BAR_TILE });
    top.push({ name: 'capL', code: 6, w: g.cap }, { name: 'plate', code: 5, w: 2 }, { name: 'capR', code: 6, w: g.cap });
  } else {
    top.push({ name: 'barL', code: 11, w: BAR_TILE }, { name: 'crest', code: 1, w: g.crest, crest });
  }
  if (kind !== 'doc') top.push({ name: 'barR', code: 8, w: BAR_TILE });
  top.push({ name: 'cornerR', code: 1, w: g.cornerR });
  const W = top.reduce((s, c) => s + c.w, 0);
  const side = (pfx) => [
    { name: `${pfx}0`, code: 8, w: g.sideTile },
    { name: `${pfx}Twinkle`, code: 1, w: g.twinkle },
    { name: `${pfx}1`, code: 8, w: g.sideTile },
  ];
  const endR = clock ? g.clock : g.corner;
  const bottom = [
    { name: 'cornerBL', code: 1, w: g.corner }, { name: 'skyBL', code: 11, w: 16 },
    { name: 'mid', code: 1, w: W - g.corner - endR - 32 }, { name: 'skyBR', code: 8, w: 16 },
    { name: clock ? 'clock' : 'cornerBR', code: 1, w: endR },
  ];
  // Widgets: discs centred on the bar's inner rows. Close in the left corner,
  // zoom and collapse side by side in the right corner.
  const wy = g.barTop + 1 + Math.floor((g.T - g.barTop - 2 - WIDGET) / 2);
  const wset = {};
  if (widgets !== 'none') wset.close = { x: g.cornerL - WIDGET - 3, y: wy, w: WIDGET, h: WIDGET };
  if (widgets === 'all') {
    wset.zoom = { x: W - g.cornerR + 2, y: wy, w: WIDGET, h: WIDGET };
    wset.collapse = { x: W - g.cornerR + 2 + WIDGET + 2, y: wy, w: WIDGET, h: WIDGET };
  }
  const plate = plateRows(g);
  return {
    topH: g.T, sideL: g.side, sideR: g.side, bottomH: g.bottomH, collapsed,
    top, bottom, left: side('L'), right: side('R'),
    // The title sits on the plate: baseline at bottom − 4, descenders on the plate's lower rows.
    ...(titled ? { title: { cell: 'plate', top: Math.floor((plate.top + plate.bot) / 2) - 8, bottom: Math.floor((plate.top + plate.bot) / 2) + 10 } } : {}),
    widgets: wset,
  };
}

/** The plate's rows: bronze edge, champagne light, pale foil face and gold shade. */
function plateRows(g) {
  if (g === G.doc) return { top: g.barTop + 19, bot: g.barTop + 45 };
  const top = g.barTop + (g.T - g.barTop >= 26 ? 3 : 1);
  const bot = g.T - (g.T - g.barTop >= 26 ? 5 : 2);           // the last gold row's shade sits at bot, edge at bot+1
  return { top, bot };
}

// ── Painting ─────────────────────────────────────────────────────────────

/**
 * Stars on the night, in one phase across the template (x mod 32): one dim
 * star and one gold confetti fleck per tile, at rows chosen so
 * they don't line up into a dotted rule. Rows are counted from the band's
 * first navy row; `rows` is how many there are.
 */
const BAR_STARS = [[5, 0.2, 'starHi'], [16, 0.72, 'star'], [25, 0.5, 'fleck']];
function starAt(x, ry, rows, p) {
  const tx = ((x % BAR_TILE) + BAR_TILE) % BAR_TILE;
  for (const [sx, f, kind] of BAR_STARS) {
    const sy = Math.round(f * (rows - 1));
    if (kind === 'fleck' ? (tx === sx || tx === sx + 1) && ry === sy : tx === sx && ry === sy) return kind === 'fleck' ? p.goldLo : p[kind];
  }
  return null;
}

/** Cells of the top edge where no star may land (the plate's columns must all match; widgets cover the rest). */
const NO_STARS = new Set(['capL', 'plate', 'capR']);

function paintTopBand(r, layout, kind, state, typeKind) {
  const g = G[kind], p = C[state];
  const { width: W, content: A } = layout;
  const navyRows = g.T - g.barTop - 3; // under the edge and lit rows, above the gold rule
  for (const cell of layout.cells.top) {
    for (let x = cell.x0; x < cell.x1; x++) {
      for (let y = g.barTop; y < g.T; y++) {
        let c = p.sky;
        if (y === g.barTop + 1) c = p.skyHi;                             // lit row under the top edge
        else if (y === g.T - 1 && x >= A.left - 1 && x <= A.right) c = p.goldLo; // the gold rule over the content
        else if (y > g.barTop + 1 && y < g.T - 1 && !NO_STARS.has(cell.name)) c = starAt(x, y - g.barTop - 2, navyRows, p) ?? p.sky;
        r.set(x, y, c);
      }
    }
  }
  // Rounded top corners: a 2-1 stair, and the left side's lit column.
  r.set(0, g.barTop, null).set(1, g.barTop, null).set(0, g.barTop + 1, null);
  r.set(W - 1, g.barTop, null).set(W - 2, g.barTop, null).set(W - 1, g.barTop + 1, null);
  for (let y = g.barTop + 2; y < g.T; y++) r.set(1, y, p.skyHi);
  if (layout.titled) paintPlate(r, layout, g, p);
  void typeKind;
}

/** The champagne-gold plate: rows on the plate cell, rounded ends on the caps. */
function paintPlate(r, layout, g, p) {
  const capL = layout.named('capL'), capR = layout.named('capR');
  const { top, bot } = plateRows(g);
  r.fillRect(capL.x0 + 2, top, capR.x1 - capL.x0 - 2, bot - top + 4, p.skyLo);
  const rowColour = (y) => (y === top - 1 || y === bot + 1 ? p.bronze : y <= top + 1 ? p.goldHi : y >= bot - 1 ? p.goldLo : p.plate);
  for (let x = capL.x0 + 1; x < capR.x1 - 1; x++) {
    // Rounded ends: the outer two columns of each cap lose their corners (2-1 stair).
    const fromL = x - (capL.x0 + 1), fromR = capR.x1 - 2 - x;
    const e = Math.min(fromL, fromR);
    const y0 = top - 1 + (e === 0 ? 2 : e === 1 ? 1 : 0), y1 = bot + 1 - (e === 0 ? 2 : e === 1 ? 1 : 0);
    for (let y = y0; y <= y1; y++) {
      let c = rowColour(y);
      if (y === y0 || y === y1 || e === 0) c = p.bronze;                // the edge follows the stair
      else if (fromL === 1) c = p.goldHi;                                // lit left end
      else if (fromR === 1) c = p.goldLo;                                // shaded right end
      r.set(x, y, c);
    }
  }
}

/** The side bands, body rows only: outline, lit/plain column, navy with stars, a dark line, the gold rule. */
function paintSides(r, layout, kind, state) {
  const g = G[kind], p = C[state];
  const { content: A } = layout;
  const S = g.side;
  for (const [cells, bx, left] of [[layout.cells.left, 0, true], [layout.cells.right, A.right, false]]) {
    for (const cell of cells) {
      for (let y = cell.x0; y < cell.x1; y++) {
        for (let i = 0; i < S; i++) {
          const outer = left ? i : S - 1 - i;                             // 0 = the window's outer edge
          let c = p.sky;
          if (outer === 0) c = p.outline;
          else if (outer === 1 && left) c = p.skyHi;
          else if (outer === S - 1) c = p.goldLo;
          else if (outer === S - 2) c = p.skyLo;
          r.set(bx + i, y, c);
        }
      }
      if (cell.code !== 1) continue;
      // One twinkle per fixed cell, centred in the navy.
      const tx = bx + (S >= 9 ? 4 : left ? 2 : 3), ty = cell.x0 + Math.floor(cell.w / 2);
      if (S >= 9) twinkle(r, tx, ty, p);
      else r.set(tx, ty, p.starHi);
    }
  }
}

/** The bottom band: the gold rule, navy with stars, the outline; the clock in the corner. */
function paintBottom(r, layout, kind, state) {
  const g = G[kind], p = C[state];
  const { width: W, content: A, height: H } = layout;
  const rows = H - A.bottom - 3;
  for (let y = A.bottom; y < H; y++) for (let x = 0; x < W; x++) {
    const by = y - A.bottom;
    let c = p.sky;
    if (by === 0 && x >= A.left - 1 && x <= A.right) c = p.goldLo;
    else if (by === 1 && x >= A.left - 1 && x <= A.right) c = p.skyLo;
    else if (x === 0 || y === H - 1 || x === W - 1) c = p.outline;
    else if (x === 1) c = p.skyHi;
    else if (by >= 2 && by < H - A.bottom - 1 && g.bottomH >= 12) c = starAt(x + 11, by - 2, rows, p) ?? p.sky;
    r.set(x, y, c);
  }
  // The gold rule turns the corners of the content.
  for (let y = A.top - 1; y <= A.bottom; y++) { r.set(A.left - 1, y, p.goldLo); r.set(A.right, y, p.goldLo); }
  // Rounded bottom corners.
  r.set(0, H - 1, null).set(1, H - 1, null).set(0, H - 2, null);
  r.set(W - 1, H - 1, null).set(W - 2, H - 1, null).set(W - 1, H - 2, null);
  const clock = layout.cells.bottom.find((c) => c.name === 'clock');
  if (clock) clockFace(r, W - 29, A.bottom, 25, state);
  const mid = layout.named('mid');
  if (g.bottomH >= 12) twinkle(r, mid.x0 + Math.floor(mid.w / 2), A.bottom + Math.floor(g.bottomH / 2), p);
}

/** Ornaments above (and through) the bar, drawn after the outline pass. */
function paintOrnaments(r, layout, kind, state, typeKind) {
  const g = G[kind], p = C[state];
  if (kind === 'doc') {
    const b = layout.named('burst');
    bigBurst(r, b.x0 + Math.floor(b.w / 2), g.barTop + 23, p, [b.x0, b.x1], 1.65);
    const y = layout.named('year');
    cyanBurst(r, y.x0 + Math.floor(y.w / 2), g.barTop + 16, p, [y.x0, y.x1], 1.45);
    drawYear(r, y.x0 + Math.floor((y.w - YEAR.width) / 2), g.T - 3 - YEAR.height, p);
  } else if (kind === 'util') {
    const c = layout.named('cornerR');
    bigBurst(r, c.x0 + Math.floor(c.w / 2) - 1, g.barTop - 1, p, [c.x0, c.x1 - 2], 0.42);
  } else {
    const c = layout.named('crest');
    if (typeKind === 'alert') clockFace(r, c.x0 + Math.floor((c.w - 17) / 2), 3, 17, state);
    else bigBurst(r, c.x0 + Math.floor(c.w / 2), g.barTop, p, [c.x0, c.x1], 0.72);
  }
}

// ── Assemble ─────────────────────────────────────────────────────────────

/** Paint one frame image for a window type in a state ('active' | 'inactive'). */
export function paintFrame(t, state) {
  const { layout, kind } = t;
  const geom = kind === 'alert' || kind === 'dialog' ? 'plain' : kind === 'modal' ? 'doc' : kind;
  const p = C[state];
  const r = new Raster(layout.width, layout.height);
  paintTopBand(r, layout, geom, state, kind);
  if (!layout.collapsed) {
    paintSides(r, layout, geom, state);
    paintBottom(r, layout, geom, state);
  }
  // The content area is a hole; outline the whole silhouette.
  const A = layout.content;
  r.fillRect(A.left, A.top, A.right - A.left, A.bottom - A.top, null);
  r.outlineEdges(0, 0, r.width, r.height, p.outline);
  // The content hole's own edge is the gold rule, not outline.
  if (!layout.collapsed) {
    for (let y = A.top - 1; y <= A.bottom; y++) { r.set(A.left - 1, y, p.goldLo); r.set(A.right, y, p.goldLo); }
    r.hline(A.left - 1, A.top - 1, A.right - A.left + 2, p.goldLo).hline(A.left - 1, A.bottom, A.right - A.left + 2, p.goldLo);
  }
  paintOrnaments(r, layout, geom, state, kind);
  for (const [role, box] of Object.entries(layout.widgets)) disc(r, box, role, state);
  // Guard for exotic-frames R2/R8 and R18: a tiled cell repeats its source as
  // drawn, so stray art in the plate would repeat along the window.
  try { layout.lint(r); } catch (err) { throw new Error(`new-year-2027: ${t.name} (${state}): ${err.message}`); }
  // Hidden swatches: title text at (A.left, A.top), shadow at the pixel to its right (TC2).
  r.swatch(A.left, A.top, p.title);
  r.swatch(A.left + 1, A.top, p.titleShadow);
  return r;
}

/** Window type table: wnd# id → description. Active frame = id + 1. */
export function windowTypes() {
  const t = (id, name, kind, opts) => {
    const geom = kind === 'alert' || kind === 'dialog' ? 'plain' : kind === 'modal' ? 'doc' : kind;
    return { id, name, kind, layout: frameLayout(spec(geom, opts)) };
  };
  return [
    t(-14336, 'Document Window', 'doc', { widgets: 'all', clock: true }),
    t(-14332, 'Collapsed Document Window', 'doc', { widgets: 'all', collapsed: true }),
    t(-14328, 'Dialog', 'dialog'),
    t(-14326, 'Alert', 'alert'),
    t(-14324, 'Movable Modal', 'modal'),
    t(-14322, 'Movable Alert', 'modal'),
    t(-14304, 'Titled Utility Window', 'util', { widgets: 'close' }),
    t(-14300, 'Collapsed Titled Utility Window', 'util', { widgets: 'close', collapsed: true }),
  ];
}

export { G };
