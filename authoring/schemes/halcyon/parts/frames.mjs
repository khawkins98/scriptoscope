// Halcyon window frames (concept/brief.md §3): a frosted glass bar with a
// hard slate outline, an olive branch running along the whole top as the
// bar's upper rim, a kingfisher perched on it at the top left (rising above
// the bar), two leaves at the branch tip, and a band of still water along the
// bottom with one ripple and a river pebble (the grow box).
//
// Geometry comes from the toolkit's frameLayout (per-edge cell lists,
// docs/authoring-exotic-frames.md §8). The recipes, per edge:
//
//   top (titled)    bird 1 | branch 11 | bezel 6 | plate 5 | bezel 6 | branch 8 | widgets+leaves 1
//   top (untitled)  bird 1 | branch 11 | branch 8 | leaves 1
//   left / right    glass 8                                   (rows A.top … A.bottom)
//   bottom          corner 1 | skip 0 | water 11 | ripple 1 | water 8 | skip 0 | pebble 1
//
// Why these codes:
//   - The branch and the water are textures where a cut copy looks fine, so
//     they tile with 11 before the centre piece and 8 after it: both runs
//     phase-lock to the plate / ripple and the partial tiles land at the
//     corners (R3). Each grower cell holds exactly one 24px period of a
//     texture painted in template coordinates (R2), so it repeats seamlessly.
//   - The bird and the widgets ride fixed code-1 cells; widgets never touch a
//     grower (R11). The bird cell is taller than the bar: the top band is the
//     whole height including the bird (R13), the title rect sits on the bar.
//   - The bottom is wider than the narrow top of some window types, so code-0
//     skips beside the corners take up the slack (R9).
//   - The ripple is centred by the two equal water growers either side.
//
// Pixel rules: one light from the upper left; the silhouette has a hard 1px
// outline; every shape is placed on whole pixels (no smooth blends), so the
// frame is the same at 8 bpp as in the browser.
import { Raster, frameLayout, stripLayout, pressedStripFrom, encodeCicn, encodeWnd } from '../../../../tools/theme-author/index.js';
import { C } from '../palette.mjs';
import { BIG, SMALL, legend as birdLegend } from './sprites/bird.mjs';

const PERIOD = 24;      // branch and water texture period (one grower cell)
const DISC = 13;

// ── Geometry per window family ─────────────────────────────────────────────
// bt: branch top row; thick/thin: branch rows left / right of the plate;
// bar: [first row (sheen), separator row]; plate: [top, bottom) rows;
// wy: widget top row; bird: sprite and its offset; bottomH: water band.
const G = {
  doc: {
    T: 48, bt: 22, thick: 4, thin: 3, bar: [26, 47], plate: [28, 46], wy: 30,
    bird: { rows: BIG, x: 1, y: 0, feet: 21, cell: 36 }, close: 6, bottom: 'big',
  },
  util: {
    T: 39, bt: 16, thick: 3, thin: 3, bar: [19, 38], plate: [20, 37], wy: 22,
    bird: { rows: SMALL, x: 1, y: 0, feet: 15, cell: 25 }, close: 5, bottom: 'small',
  },
  plain: {
    T: 24, bt: 16, thick: 3, thin: 3, bar: [19, 23],
    bird: { rows: SMALL, x: 1, y: 0, feet: 15, cell: 25 }, bottom: 'dialog',
  },
};
const BOTTOM = {
  // rows: 0 separator, 1 sheen, then upper water, lower water, last row outline
  big: { H: 16, upper: [2, 8], lower: [8, 15], corner: 16, ripple: 31, pebble: 16, rings: [[14, 4], [9, 3], [4, 1]], stone: 'big' },
  dialog: { H: 16, upper: [2, 8], lower: [8, 15], corner: 8, ripple: 27, pebble: 8, rings: [[12, 4], [7, 2], [3, 1]], stone: 'big' },
  small: { H: 10, upper: [2, 5], lower: [5, 9], corner: 12, ripple: 23, pebble: 12, rings: [[10, 2], [5, 1]], stone: 'small' },
};

/** Build the frameLayout spec for one window type. */
function spec(kind, { collapsed = false, widgets = 'none', resizable = false } = {}) {
  const g = G[kind];
  const titled = kind !== 'plain';
  const rightW = widgets === 'all' ? 34 : titled ? 18 : 24; // discs + leaves, or leaves only
  const top = titled
    ? [
      { name: 'bird', code: 1, w: g.bird.cell },
      { name: 'growL', code: 11, w: PERIOD },
      { name: 'bezelL', code: 6, w: 7 },
      { name: 'plate', code: 5, w: 1 },
      { name: 'bezelR', code: 6, w: 7 },
      { name: 'growR', code: 8, w: PERIOD },
      { name: 'right', code: 1, w: rightW },
    ]
    : [
      { name: 'bird', code: 1, w: g.bird.cell },
      { name: 'growL', code: 11, w: PERIOD },
      { name: 'growR', code: 8, w: PERIOD },
      { name: 'right', code: 1, w: rightW },
    ];
  const W = top.reduce((s, c) => s + c.w, 0);
  const b = BOTTOM[g.bottom];
  const fixed = 2 * b.corner + b.ripple + 2 * PERIOD;
  const slack = W - fixed;
  if (slack < 0) throw new Error(`halcyon: ${kind} top is ${W}px, narrower than its ${fixed}px bottom`);
  const skip = (name, w) => (w > 0 ? [{ name, code: 0, w }] : []);
  const bottom = [
    { name: 'cornerL', code: 1, w: b.corner },
    ...skip('skipL', Math.floor(slack / 2)),
    { name: 'waterL', code: 11, w: PERIOD },
    { name: 'ripple', code: 1, w: b.ripple },
    { name: 'waterR', code: 8, w: PERIOD },
    ...skip('skipR', Math.ceil(slack / 2)),
    { name: resizable ? 'pebble' : 'cornerR', code: 1, w: b.pebble },
  ];
  const wset = {};
  const box = (x) => ({ x, y: g.wy, w: DISC, h: DISC });
  if (widgets === 'all') {
    wset.close = box(g.close);
    wset.zoom = box(W - rightW + 3);
    wset.collapse = box(W - rightW + 18);
  }
  return {
    topH: g.T, sideL: 5, sideR: 5, bottomH: b.H, collapsed,
    top, bottom,
    left: [{ name: 'sideL', code: 8, w: 4, uniform: true }],
    right: [{ name: 'sideR', code: 8, w: 4, uniform: true }],
    ...(titled ? { title: { cell: 'plate', top: g.plate[0], bottom: g.plate[1] } } : {}),
    widgets: wset,
  };
}

// ── Widgets ────────────────────────────────────────────────────────────────
// Three identical 13px discs (one silhouette, one rim), glyph on whole pixels.
const RIM = [
  '....#####....',
  '..##.....##..',
  '.#.........#.',
  '.#.........#.',
  '#...........#',
  '#...........#',
  '#...........#',
  '#...........#',
  '#...........#',
  '.#.........#.',
  '.#.........#.',
  '..##.....##..',
  '....#####....',
];
const GLYPHS = {
  close: ['##.##', '.###.', '..#..', '.###.', '##.##'],
  zoom: ['#####', '#...#', '#.#.#', '#...#', '#####'],
  collapse: ['.....', '.....', '#####', '#####', '.....'],
};
/** Disc pixel classes: 'rim' | 'hi' (upper-left inner ring) | 'lo' (lower-right inner ring) | 'face'. */
const DISC_MAP = (() => {
  const rim = (x, y) => RIM[y]?.[x] === '#';
  const inside = (x, y) => { const row = RIM[y]; if (!row) return false; const a = row.indexOf('#'), b = row.lastIndexOf('#'); return x > a && x < b && !rim(x, y); };
  const map = [];
  for (let y = 0; y < DISC; y++) for (let x = 0; x < DISC; x++) {
    if (rim(x, y)) map.push([x, y, 'rim']);
    else if (inside(x, y)) {
      const nearRim = [[-1, 0], [1, 0], [0, -1], [0, 1]].some(([dx, dy]) => rim(x + dx, y + dy));
      const upperLeft = x + y < DISC - 1, lowerRight = x + y > DISC - 1;
      map.push([x, y, nearRim && upperLeft ? 'hi' : nearRim && lowerRight ? 'lo' : 'face']);
    }
  }
  return map;
})();

export function drawDisc(r, { x, y }, state, role, pressed = false) {
  const p = C[state];
  const look = pressed
    ? { rim: p.rim, hi: C.accent, face: C.accentDeep, lo: C.outline, glyph: '#ffffff' }
    : { rim: p.rim, hi: p.sheen, face: p.disc, lo: p.shade, glyph: p.glyph };
  for (const [dx, dy, k] of DISC_MAP) r.set(x + dx, y + dy, look[k]);
  if (look.glyph) r.sprite(x + 4, y + 4, GLYPHS[role], { '#': look.glyph });
}

// ── Branch and leaves ──────────────────────────────────────────────────────
const LEAVES = [
  '...........OOO.',
  '.........OOhhmO',
  '........OhhmmlO',
  '..OOO..OhmmmlO.',
  '.OhhmO.OhmmlO..',
  'OhmmmlOOmmlO...',
  'OhmmmlOOmlO....',
  '.OmmlO.OlO.....',
  '..OOlOOO.......',
  '.....OO........',
]

/** Paint the branch rows across [x0, x1): `rows` thick, with a knot bump and bark ticks on grower cells. */
function paintBranch(r, x0, x1, g, rows, p, textured) {
  const b = p.branch, bottom = g.bt + g.thick; // every branch ends on the same row (the bar's top)
  for (let x = x0; x < x1; x++) {
    const ph = ((x % PERIOD) + PERIOD) % PERIOD;
    const bump = textured && ph >= 6 && ph < 13 ? 1 : 0;
    const top = bottom - rows - bump;
    r.set(x, top, b.line);
    r.set(x, top + 1, b.hi);
    for (let y = top + 2; y < bottom - 1; y++) r.set(x, y, b.mid);
    r.set(x, bottom - 1, b.lo);
    if (!textured) continue;
    // Bark: a dark dash on the lower rows and a lit fleck, once per period each.
    if (ph === 16 || ph === 17 || ph === 18) r.set(x, bottom - 2, b.lo);
    if (ph === 9 || ph === 10) r.set(x, top + 1, b.mid);
  }
}

// ── Water ──────────────────────────────────────────────────────────────────
/** Water colour at template (x, row-in-band): two flat bands, foam dashes once per 12px, offset per band. */
function waterAt(x, j, bt, p) {
  const w = p.water, ph = ((x % PERIOD) + PERIOD) % PERIOD;
  const [u0, u1] = bt.upper, [l0, l1] = bt.lower;
  if (j >= u0 && j < u1) {
    const a = u0 + 1, b = Math.min(u1 - 1, u0 + 3);
    if (j === a && ph >= 2 && ph < 6) return w.foam;
    if (j === b && ph >= 14 && ph < 17) return w.foam;
    return w.hi;
  }
  if (j >= l0 && j < l1) {
    const a = l0 + 1, b = l1 - 2;
    if (j === a && ph >= 8 && ph < 12) return w.foamLo;
    if (j === b && ph >= 19 && ph < 21) return w.foamLo;
    return w.lo;
  }
  return null;
}

/** Hard 1px ellipse outline (upper and lower arcs) centred on (cx, cy), drawn where `onWater` holds. */
function ellipse(r, cx, cy, rx, ry, color, clip) {
  const pts = new Set();
  for (let dx = -rx; dx <= rx; dx++) {
    const dy = Math.round(ry * Math.sqrt(Math.max(0, 1 - (dx / (rx + 0.5)) ** 2)));
    pts.add(`${cx + dx},${cy - dy}`).add(`${cx + dx},${cy + dy}`);
  }
  for (const s of pts) {
    const [x, y] = s.split(',').map(Number);
    if (clip(x, y)) r.set(x, y, color);
  }
}

// The river pebble (grow box), lit from the upper left, half in the water.
const PEBBLES = {
  big: [
    '....OOOOO....',
    '..OOhhfffOO..',
    '.OhhfffffflO.',
    'OhffffffffllO',
    'OfffffffllllO',
    '.OlllllllllO.',
    '...OOOOOOO...',
  ],
  small: [
    '..OOOOO..',
    '.OhhfffO.',
    'OhffffflO',
    '.OlllllO.',
    '..OOOOO..',
  ],
};

function pebble(r, cell, H, p, size) {
  const P = p.pebble, rows = PEBBLES[size];
  const pw = rows[0].length, ph = rows.length;
  const x = cell.x1 - pw - 2, y = H - 1 - ph;
  r.sprite(x, y, rows, { O: P.line, h: P.hi, f: P.face, l: P.lo });
  // Foam where the pebble meets the water.
  const wl = y + Math.ceil(ph / 2);
  r.set(x - 1, wl, p.water.foam).set(x - 2, wl, p.water.foam).set(x + pw, wl, p.water.foam);
}

// ── Painting ───────────────────────────────────────────────────────────────

/** The 1-2 stair at a bottom corner: x0 the outline column, dir +1 for the left corner. */
function stairBottom(r, x0, yLast, dir, outline) {
  r.set(x0, yLast, null).set(x0 + dir, yLast, null).set(x0, yLast - 1, null);
  r.set(x0 + dir, yLast - 1, outline).set(x0 + 2 * dir, yLast, outline).set(x0, yLast - 2, outline);
}

function paintTop(r, layout, g, p) {
  const { width: W } = layout;
  const [barTop, sep] = g.bar;
  // The bar: a raised glass slab. Sheen on its top row and left column,
  // shade on its bottom row and right column, outline round it.
  for (let y = barTop; y <= sep; y++) for (let x = 0; x < W; x++) {
    let c = p.face;
    if (y === sep || x === 0 || x === W - 1) c = p.outline;
    else if (y === sep - 1 || x === W - 2) c = p.shade;
    else if (y === barTop || x === 1) c = p.sheen;
    r.set(x, y, c);
  }
  if (layout.titled) {
    // The title plate: a white pill with 4px stair ends, across bezelL | plate | bezelR.
    const bl = layout.named('bezelL'), br = layout.named('bezelR');
    const [y0, y1] = g.plate, x0 = bl.x0, x1 = br.x1, h = y1 - y0;
    const pill = new Raster(x1 - x0, h).fillRoundRect(0, 0, x1 - x0, h, 4, p.plate);
    pill.hline(0, h - 2, x1 - x0, p.plateShade).hline(0, 1, x1 - x0, p.plate);
    // Re-cut the corners after the shade row and outline the silhouette.
    pill.clipRounded(0, 0, x1 - x0, h, 4).outlineEdges(0, 0, x1 - x0, h, p.outline);
    r.blit(pill, x0, y0);
  }
}

function paintBranchAndBird(r, layout, g, p) {
  const { width: W } = layout;
  const bird = g.bird;
  const cells = layout.cells.top;
  const plate = cells.find((c) => c.code === 5);
  const splitX = plate ? layout.named('bezelR').x0 + 2 : layout.named('growR').x0;
  // The bird first, so the branch passes in front of its tail; feet go on last.
  const legend = birdLegend(p.bird);
  const body = bird.rows.map((row, j) => (j >= bird.feet ? row.replace(/F/g, '.') : row));
  r.sprite(bird.x, bird.y, body, legend);
  for (const c of cells) {
    const textured = c.code === 8 || c.code === 11;
    const x0 = c.x0, x1 = c.x1;
    for (let x = x0; x < x1; x++) paintBranch(r, x, x + 1, g, x < splitX ? g.thick : g.thin, p, textured);
  }
  // Cut end at the left (light heartwood), feet gripping the branch.
  const b = p.branch, bottom = g.bt + g.thick;
  r.set(0, bottom - g.thick, b.line);
  for (let y = bottom - g.thick + 1; y < bottom; y++) r.set(0, y, b.line).set(1, y, y === bottom - g.thick + 1 ? b.cut : b.ring);
  const feet = bird.rows.map((row, j) => (j >= bird.feet ? row.replace(/[^F]/g, '.') : '.'.repeat(row.length)));
  r.sprite(bird.x, bird.y, feet, legend);
  // The branch tip: it thins over the last 6px and two leaves rise from it.
  const top = bottom - g.thin;
  for (let x = W - 6; x < W; x++) r.set(x, top, null);
  r.hline(W - 6, top + 1, 6, b.line);
  r.set(W - 1, top + 1, null);
  r.set(W - 1, top + 2, b.line).set(W - 1, bottom - 1, b.line);
  const lx = W - LEAVES[0].length - 1, ly = top - LEAVES.length + 2;
  r.sprite(lx, ly, LEAVES, { O: b.line, h: p.leaf.hi, m: p.leaf.mid, l: p.leaf.lo });
}

function paintSides(r, layout, p) {
  const { width: W, content: A } = layout;
  for (let y = A.top; y < A.bottom; y++) {
    r.set(0, y, p.outline).set(1, y, p.sheen).set(2, y, p.face).set(3, y, p.face).set(4, y, p.shade);
    r.set(W - 5, y, p.sheen).set(W - 4, y, p.face).set(W - 3, y, p.face).set(W - 2, y, p.shade).set(W - 1, y, p.outline);
  }
}

function paintBottom(r, layout, g, p) {
  const { width: W, height: H, content: A } = layout;
  const bt = BOTTOM[g.bottom];
  const y0 = A.bottom;
  for (let x = 0; x < W; x++) {
    r.set(x, y0, p.outline);
    r.set(x, y0 + 1, x === 0 || x === W - 1 ? p.outline : p.sheen);
    for (let j = 2; j < bt.H - 1; j++) r.set(x, y0 + j, x === 0 || x === W - 1 ? p.outline : waterAt(x, j, bt, p));
    r.set(x, H - 1, p.outline);
  }
  // The ripple: three concentric rings, exactly centred in its cell.
  const rip = layout.named('ripple');
  const cx = rip.x0 + Math.floor(rip.w / 2), cy = y0 + Math.floor((bt.upper[0] + bt.lower[1]) / 2);
  const clip = (x, y) => x >= rip.x0 && x < rip.x1 && y >= y0 + bt.upper[0] && y < y0 + bt.lower[1];
  const rings = bt.rings;
  // Repaint plain water under the ripple first (no foam dashes inside it).
  for (let x = rip.x0; x < rip.x1; x++) for (let j = 2; j < bt.H - 1; j++) {
    const band = j < bt.upper[1] ? p.water.hi : p.water.lo;
    r.set(x, y0 + j, band);
  }
  rings.forEach(([rx, ry], i) => ellipse(r, cx, cy, rx, ry, i === 0 ? p.water.foamLo : p.water.ripple, clip));
  r.set(cx, cy, p.water.ripple);
  const peb = layout.cells.bottom.find((c) => c.name === 'pebble');
  if (peb) pebble(r, peb, H, p, bt.stone);
  stairBottom(r, 0, H - 1, 1, p.outline);
  stairBottom(r, W - 1, H - 1, -1, p.outline);
}

/** Paint one frame image for a window type in a state ('active' | 'inactive'). */
export function paintFrame(t, state) {
  const { layout, kind } = t;
  const g = G[kind];
  const p = C[state];
  const r = new Raster(layout.width, layout.height);
  paintTop(r, layout, g, p);
  paintBranchAndBird(r, layout, g, p);
  if (layout.collapsed) {
    const [, sep] = g.bar;
    stairBottom(r, 0, sep, 1, p.outline);
    stairBottom(r, layout.width - 1, sep, -1, p.outline);
  } else {
    paintSides(r, layout, p);
    paintBottom(r, layout, g, p);
  }
  for (const [role, box] of Object.entries(layout.widgets)) drawDisc(r, box, state, role);
  const A = layout.content;
  r.fillRect(A.left, A.top, A.right - A.left, A.bottom - A.top, null);
  try { layout.lint(r); } catch (err) { throw new Error(`halcyon: ${t.name} (${state}): ${err.message}`); }
  // Hidden swatches: title text at (A.left, A.top), shadow at the pixel to its right (same = no shadow).
  r.swatch(A.left, A.top, p.title);
  r.swatch(A.left + 1, A.top, p.title);
  return r;
}

/** Window type table: wnd# id → description. Active frame = id + 1. */
export function windowTypes() {
  const t = (id, name, kind, opts) => ({ id, name, kind, layout: frameLayout(spec(kind, opts)) });
  return [
    t(-14336, 'Document Window', 'doc', { widgets: 'all', resizable: true }),
    t(-14332, 'Collapsed Document Window', 'doc', { widgets: 'all', collapsed: true }),
    t(-14328, 'Dialog', 'plain'),
    t(-14326, 'Alert', 'plain'),
    t(-14324, 'Movable Modal', 'doc'),
    t(-14322, 'Movable Alert', 'doc'),
    t(-14304, 'Titled Utility Window', 'util', { widgets: 'all', resizable: true }),
    t(-14300, 'Collapsed Titled Utility Window', 'util', { widgets: 'all', collapsed: true }),
  ];
}

// ── Pressed widgets ───────────────────────────────────────────────────────
// -14330 for every window in the web (and documents in classic), -14298 for
// utility windows in classic (R24). Both windows carry close, zoom and
// collapse at the same 13px, so the web's single strip lines up for utility
// windows too. Pressed inverts: a deep-teal disc with a white glyph.
function pressedStrip(type) {
  return pressedStripFrom({
    strip: stripLayout(type.layout),
    activeFrame: paintFrame(type, 'active'),
    draw: (role, raster, box) => drawDisc(raster, box, 'active', role, true),
    rows: 2,
  });
}

/** The window family: every wnd# with its inactive (id) and active (id + 1) frame, and the pressed strips. */
export function build(add) {
  const types = windowTypes();
  for (const t of types) {
    add('wnd#', t.id, encodeWnd(t.layout.wnd), t.name);
    add('cicn', t.id, encodeCicn(paintFrame(t, 'inactive')), `Inactive ${t.name}`);
    add('cicn', t.id + 1, encodeCicn(paintFrame(t, 'active')), `Active ${t.name}`);
  }
  const byId = (id) => types.find((t) => t.id === id);
  add('cicn', -14330, encodeCicn(pressedStrip(byId(-14336))), 'Pressed Window Widgets');
  add('cicn', -14298, encodeCicn(pressedStrip(byId(-14304))), 'Pressed Utility Window Widgets');
}
