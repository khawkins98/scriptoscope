// Castle window frames: curtain walls with whole-merlon battlements, corner
// towers that rise above the title bar, a gatehouse carrying a hanging banner
// (the title plate and its end caps), stone side walls with arrow loops, and
// a heavier plinth with a little gate along the bottom.
//
// Geometry comes from the toolkit's frameLayout (tools/theme-author/frame-layout.js: per-edge cell lists). The recipes, per edge:
//
//   top (titled)   towerL 1 | filler 13 | merlons 12 | cap 6 | plate 5 | cap 6 | merlons 12 | filler 13 | [wall 1] | towerR 1
//   top (untitled) turretL 1 | filler 13 | merlons 12 | crest 1 | merlons 12 | filler 13 | turretR 1
//   left / right   stone 11 | arrow loop 1 | stone 8            (rows A.top … A.bottom only)
//   bottom         corner 1 | filler 13 | plinth 12 | gate 1 | plinth 12 | filler 13 | corner 1
//
// Why these codes (docs/authoring-exotic-frames.md):
//   - 12 tiles whole copies only (R4), so a merlon is never cut in half; its
//     leftover pixels go to the 1px code-13 filler beside the tower, which
//     reads as a slightly wider crenel (R8). One 12 width per allocation (R5).
//   - The top halves are allocated independently either side of the plate
//     (R10), so each half has its own 12 + 13 pair.
//   - Sides use 11 above the loop and 8 below it, so both stone runs
//     phase-lock to the loop and the cut course lands at the ends (R3).
//   - The tower and turret cells are fixed (code 1) and taller than the bar:
//     the top band includes everything above the bar (R13).
import { Raster, verticalGradient, mix, frameLayout } from '../../../tools/theme-author/index.js';
import { C } from './palette.mjs';
import { ashlar, moss, hash, bayer, mod } from './stone.mjs';
import { DRAW } from './widgets.mjs';

const TILE_CODES = new Set([5, 8, 11, 12]);

// ── Geometry per window family ─────────────────────────────────────────────
const G = {
  doc: {
    T: 36, tower: 26, crenH: 4, parH: 7, merlonTop: 9, wallTop: 16, gateTop: 5, pinTop: 1,
    bannerTop: 18, bannerBot: 35, titleRows: [18, 35], merl: { w: 12, gapL: 2, m: 7 }, cap: 10, plate: 12, course: 5,
    side: 11, gutter: 3, sideCourse: 6, sideCell: 12, bottomH: 17, plinth: 16, gate: 24, towerSlit: true,
  },
  util: {
    T: 30, tower: 20, crenH: 3, parH: 5, merlonTop: 7, wallTop: 12, gateTop: 4, pinTop: 1,
    bannerTop: 13, bannerBot: 29, titleRows: [12, 29], merl: { w: 10, gapL: 2, m: 5 }, cap: 8, plate: 10, course: 5,
    side: 8, gutter: 2, sideCourse: 5, sideCell: 10, bottomH: 10, plinth: 16, gate: 8, towerSlit: false,
  },
  plain: {
    T: 22, tower: 22, crenH: 4, parH: 6, merlonTop: 9, wallTop: 15, gateTop: 9, pinTop: 3,
    merl: { w: 12, gapL: 2, m: 7 }, course: 5, crest: 20,
    side: 11, gutter: 3, sideCourse: 6, sideCell: 12, bottomH: 14, plinth: 16, gate: 24, towerSlit: true,
  },
};

const WIDGET = 13;

/** Build the frameLayout spec for one window type. */
function spec(kind, { collapsed = false, widgets = 'none' } = {}) {
  const g = G[kind];
  const titled = kind !== 'plain';
  const wallR = widgets === 'all' ? 16 : 0; // a fixed wall section carrying the zoom box
  const top = titled
    ? [
      { name: 'towerL', code: 1, w: g.tower },
      { name: 'fillL', code: 13, w: 1 },
      { name: 'crenL', code: 12, w: g.merl.w },
      { name: 'capL', code: 6, w: g.cap },
      { name: 'plate', code: 5, w: g.plate },
      { name: 'capR', code: 6, w: g.cap },
      { name: 'crenR', code: 12, w: g.merl.w },
      { name: 'fillR', code: 13, w: 1 },
      ...(wallR ? [{ name: 'wallR', code: 1, w: wallR }] : []),
      { name: 'towerR', code: 1, w: g.tower },
    ]
    : [
      { name: 'towerL', code: 1, w: g.tower },
      { name: 'fillL', code: 13, w: 1 },
      { name: 'crenL', code: 12, w: g.merl.w },
      { name: 'crest', code: 1, w: g.crest },
      { name: 'crenR', code: 12, w: g.merl.w },
      { name: 'fillR', code: 13, w: 1 },
      { name: 'towerR', code: 1, w: g.tower },
    ];
  const W = top.reduce((s, c) => s + c.w, 0);
  const sideCells = (pfx) => [
    { name: `${pfx}Upper`, code: 11, w: g.sideCell },
    { name: `${pfx}Loop`, code: 1, w: g.sideCell },
    { name: `${pfx}Lower`, code: 8, w: g.sideCell },
  ];
  const corner = (W - 2 - 2 * g.plinth - g.gate) / 2;
  const bottom = [
    { name: 'cornerBL', code: 1, w: Math.floor(corner) },
    { name: 'fillBL', code: 13, w: 1 },
    { name: 'plinthL', code: 12, w: g.plinth },
    { name: 'gate', code: 1, w: g.gate },
    { name: 'plinthR', code: 12, w: g.plinth },
    { name: 'fillBR', code: 13, w: 1 },
    { name: 'cornerBR', code: 1, w: Math.ceil(corner) },
  ];
  // Widgets: close on the left tower face; zoom on the right wall section,
  // collapse on the right tower face. All on the bar rows.
  const wy = titled ? g.bannerTop + 2 : 0;
  const wx = Math.floor((g.tower - WIDGET) / 2);
  const box = (x) => ({ x, y: wy, w: WIDGET, h: WIDGET });
  const wset = {};
  if (widgets !== 'none') wset.close = box(wx);
  if (widgets === 'all') {
    wset.zoom = box(W - g.tower - wallR + Math.floor((wallR - WIDGET) / 2));
    wset.collapse = box(W - g.tower + wx);
  }
  return {
    topH: g.T, sideL: g.side, sideR: g.side, bottomH: g.bottomH, collapsed,
    top, bottom, left: sideCells('L'), right: sideCells('R'),
    ...(titled ? { title: { cell: 'plate', top: g.titleRows[0], bottom: g.titleRows[1] } } : {}),
    widgets: wset,
  };
}

// ── Painting ───────────────────────────────────────────────────────────────

/** The texture function for wall rows in a top or bottom cell (periodic in tiled cells). */
function cellStone(cell, y0, course, p, seed) {
  if (cell.code === 13) return ashlar({ x0: cell.x0, y0, course, block: 10000, pal: p, seed, speckle: 0 });
  const tiled = TILE_CODES.has(cell.code);
  const block = tiled ? cell.w : 12;
  return ashlar({ x0: cell.x0, y0, course, block, stagger: Math.floor(block / 2), periodX: tiled ? cell.w : undefined, pal: p, seed });
}

/** Light from the upper left on a fixed tower face: dithered highlight and shade bands (fixed cells only). */
function towerLight(x0, w, p, base) {
  return (x, y) => {
    const c = base(x, y), t = (x - x0) / (w - 1);
    if (c === p.mortar) return c;
    if (t < 0.22 && bayer(x, y) < (0.22 - t) / 0.22 * 0.7) return mix(c, p.stoneHi, 0.45);
    if (t > 0.72 && bayer(x, y) < (t - 0.72) / 0.28 * 0.8) return mix(c, p.stoneLo, 0.5);
    return c;
  };
}

/** Three merlons along the top of a tower of width w. */
function towerCrenels(w) {
  const gap = w >= 24 ? 4 : 3, a = Math.floor((w - 2 * gap) / 3);
  return [[0, a], [a + gap, w - a - gap], [w - a, w]];
}

function paintTower(r, cell, g, p, seed, side) {
  const { x0, w } = cell;
  const shaft = (x, y) => towerLight(x0, w, p, ashlar({ x0, y0: 0, course: g.course, block: 9, stagger: 4, pal: p, seed }))(x, y);
  // Crenellated parapet, projecting 1px over the shaft on corbels.
  for (const [a, b] of towerCrenels(w)) r.fillRect(x0 + a, 0, b - a, g.crenH, shaft);
  r.fillRect(x0, g.crenH, w, g.parH - g.crenH, shaft);
  r.hline(x0, g.crenH, w, mix(p.stone[0], p.stoneHi, 0.6)); // the wall-walk line
  // The shaft is inset 1px on its OUTER side only: its inner side meets the
  // wall, and a transparent column there would outline the 1px code-13 filler
  // next to it, which then repeats as a dark block (seen in the first render).
  r.fillRect(x0 + (side === 'L' ? 1 : 0), g.parH, w - 1, g.T - g.parH, shaft);
  // Corbels under the parapet: little dark notches.
  for (let x = x0 + 2; x < x0 + w - 2; x += 3) r.set(x, g.parH, p.mortar);
  // Chipped crenel corners (irregular edge).
  for (const [a, b] of towerCrenels(w)) {
    if (hash(a, seed, 11) < 0.6) r.set(x0 + a + (side === 'L' ? 0 : b - a - 1), 0, null);
  }
  if (g.towerSlit) {
    const cx = x0 + Math.floor(w / 2), y = g.parH + 3;
    r.fillRect(cx, y, 1, 6, p.dark).fillRect(cx - 1, y + 2, 3, 1, p.dark);
  }
}

function paintMerlons(r, cell, g, p, seed) {
  const { x0, w } = cell;
  const tex = ashlar({ x0, y0: g.merlonTop, course: g.wallTop - g.merlonTop + 1, block: 100, pal: p, seed, speckle: 0.08 });
  const tiled = cell.code === 12;
  const reps = tiled ? 1 : Math.ceil(w / g.merl.w);
  for (let k = 0; k < reps; k++) {
    const mx = tiled ? x0 + g.merl.gapL : x0 + k * g.merl.w; // a fixed wall section starts flush with a merlon
    const mw = Math.min(g.merl.m, x0 + w - mx);
    if (mw <= 0) continue;
    r.fillRect(mx, g.merlonTop, mw, g.wallTop - g.merlonTop, tex);
    r.hline(mx, g.merlonTop, mw, mix(p.stone[2], p.stoneHi, 0.7));
    if (hash(k, seed, 5) < 0.5) r.set(mx + mw - 1, g.merlonTop, null); // a chipped corner
  }
}

function paintGatehouse(r, layout, g, p) {
  const capL = layout.named('capL'), capR = layout.named('capR'), plate = layout.named('plate');
  for (const [cell, seed] of [[capL, 21], [plate, 22], [capR, 23]]) {
    r.fillRect(cell.x0, g.gateTop, cell.w, g.wallTop - g.gateTop, cellStone(cell, g.gateTop, g.course, p, seed));
  }
  r.hline(capL.x0, g.gateTop, capR.x1 - capL.x0, mix(p.stone[2], p.stoneHi, 0.7)); // coping
  // Corner pinnacles at the outer ends of the gatehouse.
  const pin = 4;
  for (const [x, seed] of [[capL.x0, 1], [capR.x1 - pin, 2]]) {
    r.fillRect(x, g.pinTop, pin, g.gateTop - g.pinTop + 1, ashlar({ x0: x, y0: g.pinTop, course: 4, block: 100, pal: p, seed }));
    r.hline(x, g.pinTop, pin, p.stoneHi);
  }
}

/** The hanging banner across both caps and the plate. Uniform along x on the plate (it tiles). */
function paintBanner(r, layout, g, p) {
  const capL = layout.named('capL'), capR = layout.named('capR');
  const y0 = g.bannerTop, y1 = g.bannerBot; // exclusive
  const fabric = verticalGradient(y0 + 2, y1 - y0 - 4, [[0, p.banner[0]], [0.5, p.banner[1]], [1, p.banner[2]]]);
  const row = (y) => (y === y0 || y === y1 - 1 ? p.trim : y === y0 + 1 || y === y1 - 2 ? p.trimLo : fabric(0, y));
  const x0 = capL.x0 + 1, x1 = capR.x1 - 1;
  for (let y = y0; y < y1; y++) r.hline(x0, y, x1 - x0, row(y));
  // Swallowtail ends: a V notch cut into each outer end, and a fold line
  // where the tail turns behind the banner.
  const mid = (y0 + y1 - 1) / 2, depth = Math.min(5, capL.w - 4), halfH = (y1 - y0) / 2;
  for (const [outer, dir] of [[x0, 1], [x1 - 1, -1]]) {
    for (let j = 0; j < depth; j++) {
      const reach = (depth - j) / depth * (halfH - 2);
      for (let y = y0; y < y1; y++) if (Math.abs(y - mid) < reach) r.set(outer + dir * j, y, null);
    }
    const fold = outer + dir * (depth + 1);
    for (let y = y0; y < y1; y++) r.set(fold, y, p.bannerLo);
    // The tail is the banner's back: a shade darker.
    for (let j = 0; j <= depth; j++) for (let y = y0 + 2; y < y1 - 2; y++) {
      const c = r.get(outer + dir * j, y);
      if (c) r.set(outer + dir * j, y, mix(c, p.bannerLo, 0.35));
    }
    // An iron ring on the coping holds each end.
    const ring = fold + dir * 2;
    r.set(ring, g.wallTop, p.iron).set(ring, g.wallTop + 1, p.iron).set(ring + 1, g.wallTop, p.ironHi);
  }
}

function paintTopBand(r, layout, geomKind, state, kind) {
  const g = G[geomKind], p = C[state];
  const T = g.T;
  // Curtain wall face behind everything: coping row, then coursed stone.
  layout.cells.top.forEach((cell, i) => {
    if (cell.name.startsWith('tower')) return;
    r.fillRect(cell.x0, g.wallTop + 1, cell.w, T - g.wallTop - 1, cellStone(cell, g.wallTop + 1, g.course, p, 40 + i));
    r.hline(cell.x0, g.wallTop, cell.w, mix(p.stone[2], p.stoneHi, 0.7));
  });
  layout.cells.top.forEach((cell, i) => {
    if (cell.name.startsWith('cren') || cell.name === 'wallR') paintMerlons(r, cell, g, p, 60 + i);
  });
  if (layout.titled) {
    paintGatehouse(r, layout, g, p);
    paintBanner(r, layout, g, p);
  } else {
    paintCrest(r, layout.named('crest'), g, p, kind);
  }
  paintTower(r, layout.named('towerL'), g, p, 7, 'L');
  paintTower(r, layout.named('towerR'), g, p, 8, 'R');
}

/** Untitled windows: a heraldic shield on a raised block between the battlements. */
function paintCrest(r, cell, g, p, kind) {
  r.fillRect(cell.x0, g.merlonTop, cell.w, g.wallTop - g.merlonTop, ashlar({ x0: cell.x0, y0: g.merlonTop, course: 7, block: 10, pal: p, seed: 5 }));
  r.hline(cell.x0, g.merlonTop, cell.w, mix(p.stone[2], p.stoneHi, 0.7));
  const w = 14, h = 17, x = cell.x0 + Math.floor((cell.w - w) / 2), y = 2;
  const shape = (inset) => {
    const cx = x + w / 2, half = w / 2 - inset, top = y + inset, sh = y + h * 0.45, bot = y + h - inset;
    return (px, py) => {
      if (py < top || py > bot) return false;
      if (py <= sh) return Math.abs(px - cx) <= half;
      const t = (py - sh) / (bot - sh);
      return Math.abs(px - cx) <= half * Math.sqrt(Math.max(0, 1 - t * t));
    };
  };
  const field = kind === 'alert' ? p.crestAlert : p.field;
  r.paintCoverage(x, y, w, h, shape(0), p.iron);
  r.paintCoverage(x, y, w, h, shape(1.3), verticalGradient(y, h, [[0, mix(field, '#ffffff', 0.18)], [1, field]]));
  if (kind === 'alert') {
    // A gold exclamation mark.
    r.strokeLineSmooth(x + w / 2, y + 4, x + w / 2, y + 10, 2, p.gold);
    r.fillCircleSmooth(x + w / 2, y + 13, 1.1, p.gold);
  } else {
    // A gold chevron.
    r.strokeLineSmooth(x + 3, y + 11, x + w / 2, y + 6, 1.8, p.gold);
    r.strokeLineSmooth(x + w / 2, y + 6, x + w - 3, y + 11, 1.8, p.gold);
  }
}

function paintSides(r, layout, kind, state) {
  const g = G[kind], p = C[state];
  const { width: W, content: A } = layout;
  for (const [cells, x0, seedBase] of [[layout.cells.left, g.gutter, 80], [layout.cells.right, A.right, 90]]) {
    const wallW = g.side - g.gutter;
    cells.forEach((cell, i) => {
      const tex = ashlar({ x0, y0: cell.x0, course: g.sideCourse, block: wallW, stagger: Math.floor(wallW / 2), periodY: 2 * g.sideCourse, pal: p, seed: seedBase + (cell.code === 1 ? i : 0) });
      r.fillRect(x0, cell.x0, wallW, cell.w, tex);
      if (cell.code === 1) {
        // A cross-shaped arrow loop in the middle of the fixed cell.
        const cx = x0 + Math.floor(wallW / 2) - (x0 === g.gutter ? 0 : 1), cy = cell.x0 + Math.floor(cell.w / 2);
        const len = Math.min(8, cell.w - 3);
        r.fillRect(cx, cy - Math.floor(len / 2), 1, len, p.dark);
        r.fillRect(cx - 1, cy - 1, 3, 1, p.dark);
      }
    });
  }
  void W;
}

function paintBottom(r, layout, kind, state) {
  const g = G[kind], p = C[state];
  const { width: W, content: A, height: H } = layout;
  const y0 = A.bottom;
  // String course under the content, as wide as the walls.
  r.fillRect(g.gutter, y0, W - 2 * g.gutter, 2, (x, y) => (y === y0 ? mix(p.stone[1], p.stoneHi, 0.4) : p.stone[3]));
  // Chamfered plinth top, then the plinth, full width.
  const top = y0 + 2, chamfer = 2;
  r.fillRect(g.gutter - 1, top, W - 2 * (g.gutter - 1), chamfer, (x, y) => (y === top ? p.stoneHi : mix(p.stone[0], p.stoneHi, 0.3)));
  const base = top + chamfer;
  const course = Math.max(4, Math.ceil((H - base) / 2));
  layout.cells.bottom.forEach((cell, i) => {
    const tex = cell.code === 13
      ? ashlar({ x0: cell.x0, y0: base, course, block: 10000, pal: p, seed: 100, speckle: 0 })
      : ashlar({ x0: cell.x0, y0: base, course, block: g.plinth, stagger: g.plinth / 2, periodX: cell.code === 12 ? cell.w : undefined, pal: p, seed: 100 + (cell.code === 12 ? 0 : i) });
    r.fillRect(cell.x0, base, cell.w, H - base, tex);
  });
  // Moss along the plinth top (periodic inside the code-12 cells).
  for (const cell of layout.cells.bottom) {
    moss(r, cell.x0, top, cell.w, H - top, p, { density: 0.22, periodX: cell.code === 12 || cell.code === 13 ? cell.w : undefined, seed: cell.code === 12 ? 9 : 30 + cell.x0 });
  }
  const gate = layout.named('gate');
  if (kind === 'util') {
    // A keystone block.
    r.fillRect(gate.x0 + 1, top - 1, gate.w - 2, H - top, ashlar({ x0: gate.x0 + 1, y0: top - 1, course: 100, block: 100, pal: p, seed: 4 }));
    r.hline(gate.x0 + 1, top - 1, gate.w - 2, p.stoneHi);
    return;
  }
  // A little arched sally port with its portcullis down.
  const ow = 10, ox = gate.x0 + Math.floor((gate.w - ow) / 2), spring = top + 5, rad = ow / 2;
  const opening = (inset) => (px, py) => {
    const l = ox - inset, rr = ox + ow + inset, cx = (l + rr) / 2, rd = rad + inset;
    if (px < l || px > rr || py > H) return false;
    return py >= spring || (px - cx) ** 2 + (py - spring) ** 2 <= rd * rd;
  };
  r.paintCoverage(ox - 3, y0, ow + 6, H - y0, opening(2), (x, y) => mix(p.stone[2], p.stoneHi, 0.5)); // voussoirs
  r.paintCoverage(ox - 3, y0, ow + 6, H - y0, opening(0), p.dark);
  for (let x = ox + 2; x < ox + ow; x += 3) r.vline(x, spring - rad + 1, H - (spring - rad + 1) - 1, p.ironHi);
  r.hline(ox + 1, spring, ow - 2, p.ironHi).hline(ox + 1, spring + 3, ow - 2, p.ironHi);
}

/** Paint one frame image for a window type in a state ('active' | 'inactive'). */
export function paintFrame(t, state) {
  const { layout, kind } = t;
  const geomKind = kind === 'alert' ? 'plain' : kind;
  const g = G[geomKind];
  const p = C[state];
  const r = new Raster(layout.width, layout.height);
  paintTopBand(r, layout, geomKind, state, kind);
  if (!layout.collapsed) {
    paintSides(r, layout, geomKind, state);
    paintBottom(r, layout, geomKind, state);
  }
  for (const [role, box] of Object.entries(layout.widgets)) DRAW[role](r, box, state);
  // The content area is a hole.
  const A = layout.content;
  r.fillRect(A.left, A.top, A.right - A.left, A.bottom - A.top, null);
  r.outlineEdges(0, 0, r.width, r.height, p.outline); // 1px outline round the whole silhouette
  // Moss on the merlon tops, over the outline so it reads as growing over the
  // edge (periodic inside code-12 cells, so every tiled copy matches).
  for (const cell of layout.cells.top) {
    if (!cell.name.startsWith('cren') && cell.name !== 'wallR') continue;
    moss(r, cell.x0, g.merlonTop, cell.w, 3, p, { density: 0.3, periodX: cell.code === 12 ? cell.w : undefined, seed: cell.code === 12 ? 2 : 50 });
  }
  // Hidden swatches: title text at (A.left, A.top), shadow at the pixel to its right (TC2).
  r.swatch(A.left, A.top, p.title);
  r.swatch(A.left + 1, A.top, p.titleShadow);
  return r;
}

/** Window type table: wnd# id → description. Active frame = id + 1. */
export function windowTypes() {
  const t = (id, name, kind, opts) => {
    const geom = kind === 'alert' ? 'plain' : kind;
    return { id, name, kind, layout: frameLayout(spec(geom, opts)) };
  };
  return [
    t(-14336, 'Document Window', 'doc', { widgets: 'all' }),
    t(-14332, 'Collapsed Document Window', 'doc', { widgets: 'all', collapsed: true }),
    t(-14328, 'Dialog', 'plain'),
    t(-14326, 'Alert', 'alert'),
    t(-14324, 'Movable Modal', 'doc'),
    t(-14322, 'Movable Alert', 'doc'),
    t(-14304, 'Titled Utility Window', 'util', { widgets: 'close' }),
    t(-14300, 'Collapsed Titled Utility Window', 'util', { widgets: 'close', collapsed: true }),
  ];
}

export { mod };
