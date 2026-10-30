// Castle window frames: the window is a stone keep. Two round corner towers
// with conical red roofs and pennants rise above a crenellated curtain wall;
// the wall IS the title bar, and the title is a red banner with a gold fringe
// hung from it. Arrow slits run down the side walls, a plinth over a narrow
// moat runs along the bottom, and a portcullis in the lower-right corner
// marks the grow box.
//
// Geometry comes from the toolkit's frameLayout (per-edge cell lists). The
// recipes, per edge:
//
//   top (document)   towerL 1 | fill 13 | merlons 12 | bezel 6 | banner 5 | bezel 6 | merlons 12 | fill 13 | zoom wall 1 | towerR 1
//   top (modal)      the same without the zoom wall
//   top (utility)    turretL 1 | fill 13 | merlons 12 | bezel 6 | banner 5 | bezel 6 | merlons 12 | fill 13 | turretR 1
//   top (untitled)   turretL 1 | fill 13 | merlons 12 | fill 13 | crest 1 | fill 13 | merlons 12 | fill 13 | turretR 1
//   left / right     wall 8 | slit 1 | wall 8 [| slit 1 | wall 8]        (body rows only)
//   bottom           corner 1 | plinth 11 | plinth 1 | plinth 8 | portcullis 1   (document)
//                    corner 1 | plinth 11 | gate 1 | plinth 8 | corner 1       (dialog, alert)
//
// Why these codes (docs/authoring-exotic-frames.md):
//   - The merlon cell (14px: one merlon, one crenel) is code 12, so a merlon
//     is never cut (R4). Its leftover goes to the 1px code-13 filler at the
//     tower end of the same half, which reads as a slightly wider crenel (R8).
//   - The banner (code 5) is a 2px source, one colour per row (lint checks
//     it): the cloth, the pole and the fringe are horizontal bands, so it
//     tiles to any title width with no seam. Its ends (finials, hems,
//     tassels) live in the code-6 bezels, which vanish with the title.
//   - Towers are fixed corner cells taller than the bar (R13); the wall rows
//     carry the widgets. The essential look (wall, banner, widgets, tower
//     drums) is all in the bar rows, because the classic menu bar can cover
//     the roofs and pennants above them (R16).
//   - Sides have several equal growers between fixed arrow slits, so the
//     slits spread out evenly as a window grows (§1, "many growers").
//   - Bottom: 11 before the fixed plinth and 8 after it, painted in one
//     phase, so the partial tiles land at the corners (R3).
//
// Light: one source, upper left. Towers have a lit column on the left and a
// 3px shade band on the right; roofs are lit on the left half and dark on the
// right third; every block, merlon and plate has its lit top/left and
// shaded right edge on the same sides.
import { Raster, frameLayout } from '../../../tools/theme-author/index.js';
import { C } from './palette.mjs';
import { MERLON, MERLON_X, wallAt, merlonAt, sideAt, SIDE_PERIOD, drumAt, mod } from './stone.mjs';
import { DRAW, WIDGET } from './widgets.mjs';

// ── Geometry per window family ─────────────────────────────────────────────
// T: top band. Document windows (eave set): pennant from row 0, a tall cone
// down to `eave` (its slope: how much the half-width shrinks per row going
// up, cycled), the drum below. Utility and dialog: the turret's pepper-pot roof (and
// pennant) from 0, its crenellated cap from capTop (4 rows of crenels, 3 of
// parapet, 1 of corbels), the drum below; the curtain's merlons
// merlonTop..wallTop−1; the wall (= title bar) wallTop..T−1. The cap stands
// wallTop − capTop px over the bar. bezel: banner end caps. side/bottomH:
// band sizes; sides are thick dressed-stone columns, the bottom a heavy plinth.
const G = {
  doc: { T: 61, tower: 32, eave: 27, roofSteps: [1, 1, 0], merlonTop: 32, wallTop: 38, bezel: 8, zoomWall: 16, side: 18, bottomH: 18, slits: 2, corner: 18 },
  util: { T: 36, tower: 22, capTop: 6, merlonTop: 10, wallTop: 15, bezel: 8, side: 12, bottomH: 12, slits: 1, corner: 12 },
  plain: { T: 27, tower: 26, capTop: 7, merlonTop: 12, wallTop: 18, crest: 24, side: 14, bottomH: 16, slits: 1 },
};

/** Build the frameLayout spec for one window type. */
function spec(kind, { collapsed = false, widgets = 'none', grow = false } = {}) {
  const g = G[kind];
  const titled = kind !== 'plain';
  const zoomWall = widgets === 'all' ? g.zoomWall : 0;
  const top = [
    { name: 'towerL', code: 1, w: g.tower },
    { name: 'fillL', code: 13, w: 1, uniform: 'fill' },
    { name: 'crenL', code: 12, w: MERLON },
    ...(titled
      ? [{ name: 'capL', code: 6, w: g.bezel }, { name: 'plate', code: 5, w: 2 }, { name: 'capR', code: 6, w: g.bezel }]
      : [{ name: 'fillCL', code: 13, w: 1, uniform: 'fill' }, { name: 'crest', code: 1, w: g.crest }, { name: 'fillCR', code: 13, w: 1, uniform: 'fill' }]),
    { name: 'crenR', code: 12, w: MERLON },
    { name: 'fillR', code: 13, w: 1, uniform: 'fill' },
    ...(zoomWall ? [{ name: 'zoomWall', code: 1, w: zoomWall }] : []),
    { name: 'towerR', code: 1, w: g.tower },
  ];
  const W = top.reduce((s, c) => s + c.w, 0);
  const side = (pfx) => {
    const cells = [{ name: `${pfx}0`, code: 8, w: SIDE_PERIOD }];
    for (let i = 1; i <= g.slits; i++) cells.push({ name: `${pfx}Slit${i}`, code: 1, w: SIDE_PERIOD }, { name: `${pfx}${i}`, code: 8, w: SIDE_PERIOD });
    return cells;
  };
  let bottom;
  if (kind === 'util') {
    const corner = g.corner;
    bottom = [
      { name: 'cornerBL', code: 1, w: corner }, { name: 'plinthL', code: 11, w: MERLON },
      { name: 'mid', code: 1, w: W - 2 * corner - 2 * MERLON }, { name: 'plinthR', code: 8, w: MERLON },
      { name: 'cornerBR', code: 1, w: corner },
    ];
  } else if (kind === 'plain') {
    const corner = (W - 2 * MERLON - 24) / 2;
    bottom = [
      { name: 'cornerBL', code: 1, w: corner }, { name: 'plinthL', code: 11, w: MERLON },
      { name: 'gate', code: 1, w: 24 }, { name: 'plinthR', code: 8, w: MERLON },
      { name: 'cornerBR', code: 1, w: corner },
    ];
  } else {
    const corner = g.corner, end = 24;
    bottom = [
      { name: 'cornerBL', code: 1, w: corner }, { name: 'plinthL', code: 11, w: MERLON },
      { name: 'mid', code: 1, w: W - corner - end - 2 * MERLON }, { name: 'plinthR', code: 8, w: MERLON },
      { name: grow ? 'portcullis' : 'cornerBR', code: 1, w: end },
    ];
  }
  // Widgets: on the wall rows, centred on the lower courses. Close on the left
  // tower, collapse on the right tower, zoom on the fixed wall section beside it.
  const wy = g.wallTop + 3 + Math.floor((g.T - g.wallTop - 3 - WIDGET) / 2);
  const onTower = (x0) => ({ x: x0 + Math.floor((g.tower - WIDGET) / 2), y: wy, w: WIDGET, h: WIDGET });
  const wset = {};
  if (widgets !== 'none') wset.close = onTower(0);
  if (widgets === 'all') {
    wset.zoom = { x: W - g.tower - zoomWall + Math.floor((zoomWall - WIDGET) / 2), y: wy, w: WIDGET, h: WIDGET };
    wset.collapse = onTower(W - g.tower);
  }
  const clothBot = g.T - 6;
  return {
    topH: g.T, sideL: g.side, sideR: g.side, bottomH: g.bottomH, collapsed,
    top, bottom, left: side('L'), right: side('R'),
    // The title sits on the cloth: baseline at bottom − 4, descenders inside the cloth.
    ...(titled ? { title: { cell: 'plate', top: clothBot + 1 - 18, bottom: clothBot + 1 } } : {}),
    widgets: wset,
  };
}

// ── Painting: the top band ───────────────────────────────────────────────

/** Tile phase of a top cell's column x (which merlon column / course joint it shows). */
function phaseOf(cell, x) {
  if (cell.code === 13 || cell.code === 5) return 0;              // uniform columns: plain wall
  if (cell.name === 'zoomWall') return mod(x - cell.x0 - 1, MERLON); // its merlon sits 1px further in
  return mod(x - cell.x0, MERLON);
}

function paintWall(r, layout, g, p) {
  for (const cell of layout.cells.top) {
    for (let x = cell.x0; x < cell.x1; x++) {
      // Behind a tower only its inner side shows wall; its outer side is sky
      // down to the battered foot (which meets the side wall).
      if (cell.name === 'towerL' && x < cell.x0 + 2) continue;
      if (cell.name === 'towerR' && x >= cell.x1 - 2) continue;
      const ph = phaseOf(cell, x);
      for (let y = g.wallTop; y < g.T; y++) r.set(x, y, wallAt(ph, y - g.wallTop, p));
      // Merlons on the battlement cells and the zoom wall; crenels stay open.
      if ((cell.code === 12 || cell.name === 'zoomWall') && ph >= MERLON_X[0] && ph < MERLON_X[1]) {
        const h = g.wallTop - g.merlonTop;
        for (let y = g.merlonTop; y < g.wallTop; y++) r.set(x, y, merlonAt(ph - MERLON_X[0], y - g.merlonTop, MERLON_X[1] - MERLON_X[0], h, p));
      }
    }
  }
}

/** The solid parapet over the banner (bezels + plate): one long merlon, uniform over the plate. */
function paintParapet(r, layout, g, p) {
  const capL = layout.named('capL'), capR = layout.named('capR');
  const w = capR.x1 - capL.x0, h = g.wallTop - g.merlonTop;
  for (let x = capL.x0; x < capR.x1; x++) {
    // Inside the plate every column must match (R2): only the bezels see the ends.
    const plate = layout.named('plate');
    const mx = x >= plate.x0 && x < plate.x1 ? 3 : x - capL.x0;
    for (let y = g.merlonTop; y < g.wallTop; y++) r.set(x, y, merlonAt(mx, y - g.merlonTop, w, h, p));
    r.set(x, g.wallTop, p.mortar);
  }
}

// Turret cap: corner crenels (4 rows), parapet (3), corbel teeth (1); the drum starts below.
const CAP = { crenels: 4, parapet: 3 };
const drumTop = (g) => g.capTop + CAP.crenels + CAP.parapet + 1;

/** The cap's two corner merlons, [x, w) pairs; the roof fills the crenel between them. */
const capMerlonW = (W) => (W >= 28 ? 7 : W >= 24 ? 6 : 5);
const capMerlons = (W) => [[0, capMerlonW(W)], [W - capMerlonW(W), capMerlonW(W)]];

/**
 * Pepper-pot roof in the cap's crenel: a 2px spire two rows tall, then 45°
 * flanks down to the parapet, its base exactly filling the gap between the
 * corner merlons. Its apex is at row 4, leaving rows 0–3 for the pennant.
 */
function roofRows(g) {
  const n = g.capTop + CAP.crenels - 4, max = g.tower / 2 - capMerlonW(g.tower);
  return Array.from({ length: n }, (_, i) => Math.min(max, Math.max(1, i)));
}

/**
 * A round turret: a small red pepper-pot roof set inside a crenellated cap
 * that overhangs the drum on corbels; the drum carries an arrow slit and
 * ends in a battered foot over the side column. Drawn before the outline
 * pass, so its silhouette edges become outline; the pennant comes after.
 */
function paintTower(r, cell, g, p, seed) {
  const { x0 } = cell, W = g.tower, cx = x0 + W / 2, top = drumTop(g);
  // Roof first: the cap's crenels stand in front of its base.
  const rows = roofRows(g), roofY = g.capTop + CAP.crenels - rows.length;
  rows.forEach((hw, i) => {
    const y = roofY + i, a = Math.floor(cx - hw), b = Math.ceil(cx + hw);
    for (let x = a; x < b; x++) {
      const u = (x - a) / (b - a);
      let c = u >= 0.6 ? p.roofLo : p.roof;
      if (x === a + 1 && b - a > 3) c = p.roofHi;                       // lit left flank
      else if ((y - roofY) % 3 === 2 && u < 0.6 && x % 2 === 0 && b - a > 4) c = p.roofHi; // tile row
      r.set(x, y, c);
    }
  });
  // Cap: crenels, then the parapet ring, then corbel teeth, all the full width.
  const stone = (x, y) => {
    let c = drumAt(x, y - g.capTop, x0, p, seed + 3);
    if (x === x0 + 1) c = p.stoneHi;
    else if (x >= x0 + W - 4 && x < x0 + W - 1 && c !== p.mortar) c = p.stoneLo;
    return c;
  };
  for (const [mx, mw] of capMerlons(W)) {
    for (let y = g.capTop; y < g.capTop + CAP.crenels; y++) for (let x = x0 + mx; x < x0 + mx + mw; x++) {
      const my = y - g.capTop;
      r.set(x, y, my === 1 ? p.stoneHi : x === x0 + mx + mw - 2 ? p.stoneLo : p.stone[0]);
    }
  }
  const pTop = g.capTop + CAP.crenels;
  for (let y = pTop; y < pTop + CAP.parapet; y++) for (let x = x0; x < x0 + W; x++) {
    r.set(x, y, y === pTop + 1 ? (x < x0 + W - 3 ? p.stoneHi : p.stoneLo) : stone(x, y));
  }
  for (let x = x0 + 1; x < x0 + W - 1; x++) r.set(x, top - 1, (x - x0) % 2 ? p.stoneLo : p.mortar);
  // Drum: inset 2 under the cap, widening over its last rows to the full cell
  // (a battered foot that sits on the side column).
  const inset = (y) => (y >= g.T - 3 ? 0 : y === g.T - 4 ? 1 : 2);
  for (let y = top; y < g.T; y++) {
    const a = x0 + inset(y), b = x0 + W - inset(y);
    for (let x = a; x < b; x++) {
      let c = drumAt(x, y - top, a, p, seed);
      if (y === top) c = p.mortar;                                         // shadow under the corbels
      else if (x === a + 1) c = p.stoneHi;                                 // lit flank
      else if (x >= b - 4 && x < b - 1 && c !== p.mortar) c = p.stoneLo;  // shaded flank
      r.set(x, y, c);
    }
    if (y >= g.wallTop && inset(y) > 0) { r.set(a, y, p.outline); r.set(b - 1, y, p.outline); }
    if (y === g.T - 4) { r.set(a, y, p.outline); r.set(b - 1, y, p.outline); }
  }
  // Arrow slit on the drum, above the widget.
  const sx = Math.floor(cx) - 1, sy = top + 1, sh = Math.min(W > 24 ? 6 : 4, g.wallTop + 3 - sy);
  if (sh >= 3) {
    r.fillRect(sx, sy, 2, sh, p.outline);
    r.vline(sx - 1, sy, sh, p.stoneHi);
  }
}

/** Pennant on the roof's apex (after the outline pass: too thin to outline). Flags fly right. */
const FLAGS = { big: ['fffff', 'FFFFFF', 'FFF'], small: ['fff', 'FF'] };
function paintPennant(r, cell, g, p) {
  const px = cell.x0 + g.tower / 2 - 1;
  const apex = g.capTop + CAP.crenels - roofRows(g).length;
  if (apex < 2) { r.set(px, apex - 1, p.gold); return; }
  r.vline(px, 1, apex - 1, p.outline);
  r.set(px, 0, p.gold);
  const flag = apex >= 4 ? FLAGS.big : FLAGS.small;
  flag.forEach((row, i) => {
    for (let k = 0; k < row.length; k++) r.set(px + 1 + k, 1 + i, row[k] === 'f' ? p.flag : p.flagLo);
  });
}

/**
 * Roof half-width per row, top to bottom. From the eave up the half-width
 * shrinks by roofSteps (cycled: [1, 1, 1, 0] is a 3:4 slope, a regular
 * 1-1-1-2 pixel stair), down to 2, then a 2px spire two rows tall.
 */
function coneRows(g) {
  const rows = [];
  let hw = g.tower / 2, i = 0;
  while (hw >= 2) { rows.unshift(hw); hw -= g.roofSteps[i++ % g.roofSteps.length]; }
  rows.unshift(1, 1);
  return rows;
}
const coneTop = (g) => g.eave - coneRows(g).length + 1;

// ── The document's towers: tall conical roofs (pass 1, restored) ──────────
// Document and movable-modal windows get a full cone on a corbelled drum,
// rising well over the battlements: the scheme's silhouette. The smaller
// windows keep the capped turret with a pepper-pot roof (below).

/**
 * A round tower: conical tiled roof, a corbelled drum with an arrow slit, a
 * battered foot. Drawn before the outline pass, so its silhouette edges become
 * outline; the pennant and pole are drawn after it (see paintPennant).
 */
function paintConeTower(r, cell, g, p, seed) {
  const { x0 } = cell, W = g.tower, cx = x0 + W / 2;
  // Drum: inset 2px under the eave (the roof overhangs it), widening to the
  // full cell over the last rows (a battered foot that meets the side wall).
  const inset = (y) => (y >= g.T - 3 ? 0 : y === g.T - 4 ? 1 : 2);
  for (let y = g.eave + 1; y < g.T; y++) {
    const a = x0 + inset(y), b = x0 + W - inset(y); // [a, b)
    for (let x = a; x < b; x++) {
      let c = drumAt(x, y - g.eave - 1, a, p, seed);
      if (y === g.eave + 1) c = p.mortar;                                       // shadow under the eave
      else if (y === g.eave + 2) c = (x - x0) % 2 ? p.stoneLo : p.mortar;       // corbel teeth
      else if (x === a + 1) c = p.stoneHi;                                      // lit flank
      else if (x >= b - 4 && x < b - 1 && c !== p.mortar) c = p.stoneLo;       // shaded flank
      r.set(x, y, c);
    }
    // Where the drum stands in front of the wall, draw its edges (the outline
    // pass only sees edges against transparent pixels).
    if (y >= g.wallTop && inset(y) > 0) { r.set(a, y, p.outline); r.set(b - 1, y, p.outline); }
    if (y === g.T - 4) { r.set(a, y, p.outline); r.set(b - 1, y, p.outline); }
  }
  // Batter: lit top edge on the step.
  r.set(x0 + 1, g.T - 4, p.stoneHi); r.set(x0, g.T - 3, p.stoneHi);
  // Arrow slit high on the drum: dark, with a lit lip on its left.
  const sx = Math.floor(cx) - 1, sy = g.eave + 4, sh = Math.min(W > 24 ? 7 : 5, g.wallTop - sy);
  if (sh >= 4) {
    r.fillRect(sx, sy, 2, sh, p.outline);
    r.vline(sx - 1, sy, sh, p.stoneHi);
    r.set(sx, sy - 1, p.mortar).set(sx + 1, sy - 1, p.mortar);
  }
  // Roof: rows of tiles. Left part lit, right third in shade, a dark tile
  // seam every third row with staggered joints.
  const rows = coneRows(g), top = coneTop(g);
  rows.forEach((hw, i) => {
    const y = top + i, a = Math.floor(cx - hw), b = Math.ceil(cx + hw);
    const fromEave = g.eave - y;
    for (let x = a; x < b; x++) {
      const u = (x - a) / (b - a);
      let c = u >= 0.66 ? p.roofLo : p.roof;
      const seam = fromEave % 3 === 0;
      if (seam) c = (x + Math.floor(fromEave / 3) * 2) % 4 === 0 ? p.roofLo : (u >= 0.66 ? p.roofLo : p.roof);
      else if (fromEave % 3 === 2 && u < 0.45) c = p.roofHi;
      if (x === a + 1 && u < 0.5) c = p.roofHi;
      r.set(x, y, c);
    }
    if (y === g.eave) r.hline(a, y, b - a, p.roofLo); // the drip edge
  });
}

/** Pennant and pole above a tower (after the outline pass: too thin to outline). Flags fly right. */
const CONE_FLAGS = {
  big: ['ffffff..', 'fffffffF', 'FFFFFFF.', 'FFFF....', 'F.......'],
  small: ['fffff', 'FFFFFF', 'FFF..'],
};
function paintConePennant(r, cell, g, p) {
  const px = cell.x0 + g.tower / 2 - 1, top = coneTop(g);
  r.vline(px, 1, top - 1, p.outline);
  r.set(px, 0, p.gold);
  const flag = g.tower >= 28 ? CONE_FLAGS.big : CONE_FLAGS.small;
  flag.forEach((row, i) => {
    for (let k = 0; k < row.length; k++) if (row[k] !== '.') r.set(px + 1 + k, 1 + i, row[k] === 'f' ? p.flag : p.flagLo);
  });
}

/** The banner: pole across the top, cloth, gold fringe; uniform rows on the plate. */
function bannerRows(g) {
  const pole = g.wallTop + 1, clothTop = g.wallTop + 3, clothBot = g.T - 6;
  return { pole, clothTop, clothBot, fringe: clothBot + 1, shadow: clothBot + 4 };
}

function paintBanner(r, layout, g, p) {
  const capL = layout.named('capL'), capR = layout.named('capR');
  const { pole, clothTop, clothBot, fringe, shadow } = bannerRows(g);
  const B = capL.w;
  // Cloth columns: from the left hem (bezel col 3) to the right hem (mirror).
  const x0 = capL.x0 + 3, x1 = capR.x1 - 3; // [x0, x1)
  for (let x = x0; x < x1; x++) {
    r.set(x, clothTop, p.clothLo);                                    // shade under the pole
    for (let y = clothTop + 1; y <= clothBot; y++) r.set(x, y, p.cloth);
    r.set(x, fringe, p.gold).set(x, fringe + 1, p.gold).set(x, fringe + 2, p.goldLo);
    r.set(x, shadow, p.stoneLo);                                      // its shadow on the wall
  }
  // Hems: a dark fold at each end, lit just inside on the left (light from the left).
  for (let y = clothTop; y <= clothBot; y++) {
    r.set(x0, y, p.clothLo).set(x0 + 1, y, p.clothHi);
    r.set(x1 - 1, y, p.clothLo);
  }
  // Fringe tassels hanging from each corner.
  r.set(x0, fringe + 3, p.gold).set(x1 - 1, fringe + 3, p.goldLo);
  // The banner's shadow falls right of it on the wall.
  for (let y = clothTop + 1; y <= fringe + 3; y++) r.set(x1, y, p.stoneLo);
  r.set(x1, fringe + 3, p.stoneLo);
  // Pole: two rows across, from finial to finial.
  const pa = capL.x0 + 1, pb = capR.x1 - 1;
  r.hline(pa, pole, pb - pa, p.pole).hline(pa, pole + 1, pb - pa, p.poleLo);
  // Brass finials: a little diamond knob at each end of the pole.
  for (const fx of [capL.x0 + 1, capR.x1 - 2]) {
    r.set(fx, pole - 1, p.goldLo);
    r.set(fx - 1, pole, p.gold).set(fx, pole, p.gold).set(fx + 1, pole, p.gold);
    r.set(fx - 1, pole + 1, p.goldLo).set(fx, pole + 1, p.goldLo).set(fx + 1, pole + 1, p.goldLo);
    r.set(fx, pole + 2, p.goldLo);
  }
  void B;
}

// ── The crest on untitled windows (dialog, alert) ─────────────────────────
// A heraldic shield standing on a solid stretch of parapet, rising over the
// battlements: blue with a gold chevron (dialog), red with a gold "!" (alert).
// 16×18 shield: straight sides for ten rows, then a stepped point. Rim o,
// lit row and left column h, shaded right column k, field f.
const CREST = (() => {
  const span = (y) => (y < 10 ? [0, 15] : [[1, 14], [1, 14], [2, 13], [3, 12], [4, 11], [5, 10], [6, 9], [7, 8]][y - 10]);
  return Array.from({ length: 18 }, (_, y) => {
    const [a, b] = span(y);
    return Array.from({ length: 16 }, (_, x) => {
      if (x < a || x > b) return '.';
      if (x === a || x === b || y === 0 || y === 17) return 'o';
      if (y === 1 || x === a + 1) return 'h';
      if (x === b - 1) return 'k';
      return 'f';
    }).join('');
  });
})();
const CHEVRON = ['.......##.......', '......####......', '.....##..##.....', '....##....##....', '...##......##...', '..##........##..'];
const BANG = ['......##', '......##', '......##', '......##', '......##', '......##', '........', '......##', '......##'];

function paintCrest(r, cell, g, p, kind, state) {
  // The parapet block behind it (a solid, wider merlon).
  const h = g.wallTop - g.merlonTop;
  for (let x = cell.x0 + 2; x < cell.x1 - 2; x++) {
    for (let y = g.merlonTop; y < g.wallTop; y++) r.set(x, y, merlonAt(x - cell.x0 - 2, y - g.merlonTop, cell.w - 4, h, p));
  }
  const sx = cell.x0 + Math.floor((cell.w - 16) / 2), sy = 1;
  const field = kind === 'alert' ? p.alertField : p.field;
  const lit = kind === 'alert' ? p.clothHi : p.waterHi;
  const shade = state === 'active' ? (kind === 'alert' ? p.clothLo : '#003366') : p.stoneLo;
  r.sprite(sx, sy, CREST, { o: p.outline, h: lit, f: field, k: shade });
  if (kind === 'alert') r.sprite(sx + 1, sy + 3, BANG, { '#': p.gold });
  else r.sprite(sx, sy + 4, CHEVRON, { '#': p.gold });
}

function paintTopBand(r, layout, kind, state, typeKind) {
  const g = G[kind], p = C[state];
  paintWall(r, layout, g, p);
  if (layout.titled) paintParapet(r, layout, g, p);
  else paintCrest(r, layout.named('crest'), g, p, typeKind, state);
  const tower = g.eave ? paintConeTower : paintTower;
  tower(r, layout.named('towerL'), g, p, 7);
  tower(r, layout.named('towerR'), g, p, 8);
  if (layout.titled) paintBanner(r, layout, g, p);
}

// ── Sides and bottom ─────────────────────────────────────────────────────

function paintSides(r, layout, kind, state) {
  const g = G[kind], p = C[state];
  const { content: A, width: W } = layout;
  for (const [cells, bx] of [[layout.cells.left, 0], [layout.cells.right, A.right]]) {
    const inner = g.side - 2;
    for (const cell of cells) {
      for (let y = cell.x0; y < cell.x1; y++) {
        r.set(bx, y, p.outline).set(bx + g.side - 1, y, p.outline);
        for (let sx = 0; sx < inner; sx++) r.set(bx + 1 + sx, y, sideAt(sx, y - cell.x0, inner, p));
      }
      if (cell.code !== 1) continue;
      // Arrow slit: a dark 2px slot with a lit lip on its left, and a splayed
      // sill/lintel one shade down.
      const sx = bx + Math.floor(g.side / 2) - 1, len = g.side >= 14 ? 7 : 5, sy = cell.x0 + Math.floor((cell.w - len) / 2);
      r.fillRect(sx - 1, sy - 1, 4, len + 2, p.stoneLo);
      r.fillRect(sx, sy, 2, len, p.outline);
      r.vline(sx - 1, sy, len, p.stoneHi);
    }
  }
  void W;
}

/**
 * The plinth along the bottom, period 14 along x (the growers hold one
 * period). Rows: 0 the rim under the content, 1 a lit ledge, then two heavy
 * courses (course 0 one long block, course 1 two blocks, one with a lit
 * top), then either a narrow moat (bands of 16+ rows) or a shaded batter.
 */
function bottomAt(x, by, p, H) {
  const moat = H >= 16;
  const a = moat ? (H >= 18 ? 6 : 5) : 4;            // course 0 rows
  const bRows = moat ? H - a - 7 : H - a - 5;         // course 1 rows
  const px = mod(x, MERLON);
  if (by <= 1) return p.stoneHi;
  if (by < 2 + a) return px === 0 ? p.mortar : p.stone[0];
  if (by === 2 + a) return p.mortar;
  if (by < 3 + a + bRows) {
    if (px === 4 || px === 11) return p.mortar;
    const right = px > 4 && px < 11;
    if (by === 3 + a && right) return p.stoneHi;
    if (!right && (px === 3)) return p.stoneLo;
    return p.stone[right ? 0 : 1];
  }
  const r = by - (3 + a + bRows);
  if (!moat) return r === 0 ? p.stoneLo : p.outline;
  if (r === 0) return p.outline;
  if (r === 1) return mod(x, MERLON) >= 2 && mod(x, MERLON) < 5 ? p.waterHi : p.water;
  if (r === 2) return mod(x, MERLON) >= 9 && mod(x, MERLON) < 11 ? p.waterHi : p.water;
  return p.outline;
}

/** Arch with a lowered portcullis, 18 columns wide, over the bottom band. */
function paintGate(r, cell, layout, p) {
  const H = layout.height, y0 = layout.content.bottom;
  const ox = cell.x0 + Math.floor((cell.w - 14) / 2), ow = 14, top = y0 + 2, spring = top + 6;
  const inArch = (x, y, grow) => {
    const cx = ox + ow / 2 - 0.5, rad = ow / 2 + grow;
    if (x < ox - grow || x > ox + ow - 1 + grow || y >= H - 1) return false;
    return y >= spring || (x - cx) ** 2 + (y - spring) ** 2 <= rad * rad;
  };
  // Voussoirs: a 2px ring of dressed stone, lit on the left, shaded on the right.
  for (let y = y0 + 1; y < H - 1; y++) for (let x = ox - 2; x < ox + ow + 2; x++) {
    if (!inArch(x, y, 2) || inArch(x, y, 0)) continue;
    const left = x < ox + ow / 2;
    r.set(x, y, inArch(x, y, 1) ? (left ? p.stoneHi : p.stoneLo) : p.mortar);
  }
  // The passage behind: dark. The portcullis: iron bars on a 4px grid, lit on
  // their left, ending in spikes above the threshold.
  for (let y = top; y < H - 1; y++) for (let x = ox; x < ox + ow; x++) {
    if (!inArch(x, y, 0)) continue;
    const gx = mod(x - ox - 1, 4), gy = mod(y - (spring - 1), 4);
    let c = p.outline;
    if (gx === 0) c = p.ironHi;
    if (gy === 0 && y < H - 3) c = gx === 0 ? p.stoneLo : p.ironHi;
    if (y === H - 3 && gx !== 0) c = p.outline;
    if (y === H - 2) c = gx === 0 ? p.ironHi : p.stoneLo; // threshold with the spike tips on it
    r.set(x, y, c);
  }
}

/** Flat moss tufts on the plinth (fixed cells only, so they never repeat). */
function moss(r, x, y, p) {
  r.set(x, y, p.moss).set(x + 1, y, p.moss).set(x + 2, y, p.moss).set(x + 1, y - 1, p.moss).set(x + 3, y, p.moss);
}

function paintBottom(r, layout, kind, state) {
  const g = G[kind], p = C[state];
  const { width: W, content: A, height: H } = layout;
  for (let y = A.bottom; y < H; y++) for (let x = 0; x < W; x++) r.set(x, y, bottomAt(x, y - A.bottom, p, g.bottomH));
  const bl = layout.named('cornerBL');
  if (g.bottomH >= 14) {
    moss(r, bl.x0 + 3, A.bottom + 2, p);
    const mid = layout.cells.bottom.find((c) => c.name === 'mid');
    if (mid) moss(r, mid.x0 + Math.floor(mid.w / 2) - 2, A.bottom + 2, p);
  }
  for (const name of ['portcullis', 'gate']) {
    const cell = layout.cells.bottom.find((c) => c.name === name);
    if (cell) paintGate(r, cell, layout, p);
  }
}

// ── Assemble ─────────────────────────────────────────────────────────────

/** Paint one frame image for a window type in a state ('active' | 'inactive'). */
export function paintFrame(t, state) {
  const { layout, kind } = t;
  const geom = kind === 'alert' || kind === 'dialog' ? 'plain' : kind;
  const g = G[geom], p = C[state];
  const r = new Raster(layout.width, layout.height);
  paintTopBand(r, layout, geom, state, kind);
  if (!layout.collapsed) {
    paintSides(r, layout, geom, state);
    paintBottom(r, layout, geom, state);
  }
  for (const [role, box] of Object.entries(layout.widgets)) DRAW[role](r, box, state);
  // The content area is a hole; outline the whole silhouette (outer edge,
  // merlon tops, roofs, and the rim round the content).
  const A = layout.content;
  r.fillRect(A.left, A.top, A.right - A.left, A.bottom - A.top, null);
  r.outlineEdges(0, 0, r.width, r.height, p.outline);
  // Too thin to outline: pennants and poles, drawn after.
  const pennant = g.eave ? paintConePennant : paintPennant;
  pennant(r, layout.named('towerL'), g, p);
  pennant(r, layout.named('towerR'), g, p);
  // Guard for exotic-frames R2/R8 and R18: a tiled cell repeats its source as
  // drawn, so stray art in the banner or a filler would repeat along the window.
  try { layout.lint(r); } catch (err) { throw new Error(`castle: ${t.name} (${state}): ${err.message}`); }
  // Hidden swatches: title text at (A.left, A.top), shadow at the pixel to its right (TC2).
  r.swatch(A.left, A.top, p.title);
  r.swatch(A.left + 1, A.top, p.titleShadow);
  return r;
}

/** Window type table: wnd# id → description. Active frame = id + 1. */
export function windowTypes() {
  const t = (id, name, kind, opts) => {
    const geom = kind === 'alert' || kind === 'dialog' ? 'plain' : kind;
    return { id, name, kind, layout: frameLayout(spec(geom, opts)) };
  };
  return [
    t(-14336, 'Document Window', 'doc', { widgets: 'all', grow: true }),
    t(-14332, 'Collapsed Document Window', 'doc', { widgets: 'all', collapsed: true }),
    t(-14328, 'Dialog', 'dialog'),
    t(-14326, 'Alert', 'alert'),
    t(-14324, 'Movable Modal', 'doc'),
    t(-14322, 'Movable Alert', 'doc'),
    t(-14304, 'Titled Utility Window', 'util', { widgets: 'close' }),
    t(-14300, 'Collapsed Titled Utility Window', 'util', { widgets: 'close', collapsed: true }),
  ];
}

export { G };
