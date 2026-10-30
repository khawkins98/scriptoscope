// Halcyon window frames (concept/brief.md §3, scale-up pass): a frosted glass
// bar with a hard slate outline; a big kingfisher perched on a branch that
// crosses the left part of the bar and rises ~20px above it; 15px glass-bead
// widgets; slim glass side bands; and a 12px band of still water with reeds,
// one ripple and a river pebble (the grow box) along the bottom.
//
// Geometry comes from the toolkit's frameLayout (per-edge cell lists,
// docs/authoring-exotic-frames.md §8). The recipes, per edge:
//
//   top (titled)    close 1 | bird 10 | bar 11 | bezel 6 | plate 5 | bezel 6 | bar 8 | widgets 1
//   top (untitled)  cap 1 | bar 8 | cap 1
//   left / right    glass 8                                   (rows A.top … A.bottom)
//   bottom          corner 1 | skip 0 | water 11 | ripple 1 | water 8 | skip 0 | pebble 1
//
// Why these codes:
//   - The bird, its branch and the leaves live in ONE code-10 cell (R12): it
//     is fixed at any normal width and is dropped whole when the window is
//     narrower than the top's fixed sum, so a narrow window loses the bird
//     cleanly instead of overlapping cells. The close box has its own fixed
//     code-1 cell so it never goes with the bird (R11).
//   - The bar growers are 1px columns: the glass gradient runs down the bar
//     (one colour per row), so stretching never shows (no dithering).
//   - The water tiles with 11 before the ripple and 8 after it: both runs
//     phase-lock to the ripple and the partial tiles land at the corners (R3).
//     Each grower cell holds exactly one 32px period of reeds and foam,
//     painted in template coordinates (R2), so it wraps seamlessly.
//   - The bottom is narrower than the top, so code-0 skips take the slack (R9).
//
// Pixel rules: one light from the upper left; a hard 1px outline on the
// silhouette; every colour an exact system-palette entry (palette.mjs), so the
// frame is the same at 8 bpp as in the browser. The cicn mask is 1-bit, so the
// bird's outer edge stays hard against the unknown page; its inner edges step
// through 3–4 tones per colour mass instead of blending.
import { Raster, frameLayout, stripLayout, pressedStripFrom, encodeCicn, encodeWnd } from '../../../../tools/theme-author/index.js';
import { C } from '../palette.mjs';
import { BIG, SMALL, legend as birdLegend } from './sprites/bird.mjs';

const PERIOD = 32;      // water tile (one reed clump + foam)
const DISC = 15;        // widget bead

// ── Geometry per window family ─────────────────────────────────────────────
// bar: [top outline row, separator row]; bands: glass gradient rows;
// plate: title rows [top, bottom); wy: widget top row; bird: sprite, offset and
// the branch path (cell-relative x → row of the branch's top edge).
const G = {
  doc: {
    T: 46, bar: [20, 45], plate: [24, 43], wy: 26, closeCell: 26, rightCell: 40,
    bird: { rows: BIG, x: 2, y: 0, feet: 40, cell: 66, branch: [[0, 42], [30, 41], [52, 39], [64, 36]], thick: 4, leaves: true },
  },
  util: {
    T: 34, bar: [8, 33], plate: [12, 30], wy: 14, closeCell: 22, rightCell: 40,
    bird: { rows: SMALL, x: 3, y: 0, feet: 15, cell: 32, branch: [[0, 22], [8, 18], [16, 16], [30, 15]], thick: 3, leaves: false },
  },
  plain: { T: 12, bar: [0, 11] },
};
const BOTTOM = { H: 12, upper: [2, 6], lower: [6, 11], corner: 10, ripple: 25, pebble: 10 };

/** Build the frameLayout spec for one window type. */
function spec(kind, { collapsed = false, widgets = false, resizable = false } = {}) {
  const g = G[kind];
  const titled = kind !== 'plain';
  const top = titled
    ? [
      { name: 'closeCell', code: 1, w: g.closeCell },
      { name: 'bird', code: 10, w: g.bird.cell },
      { name: 'growL', code: 11, w: 1, uniform: 'bar' },
      { name: 'bezelL', code: 6, w: 6 },
      { name: 'plate', code: 5, w: 1 },
      { name: 'bezelR', code: 6, w: 6 },
      { name: 'growR', code: 8, w: 1, uniform: 'bar' },
      { name: 'right', code: 1, w: g.rightCell },
    ]
    : [
      { name: 'capL', code: 1, w: 24 },
      { name: 'grow', code: 8, w: 1, uniform: 'bar' },
      { name: 'capR', code: 1, w: 24 },
    ];
  let W = top.reduce((s, c) => s + c.w, 0);
  const b = BOTTOM;
  const fixed = 2 * b.corner + b.ripple + 2 * PERIOD;
  if (W < fixed) { // the bottom needs more room: widen the bar's (uniform) growers
    const growers = top.filter((c) => c.code === 8 || c.code === 11);
    let extra = fixed - W;
    growers.forEach((c, i) => { const n = Math.ceil(extra / (growers.length - i)); c.w += n; extra -= n; });
    W = fixed;
  }
  const slack = W - fixed;
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
  if (widgets) {
    const box = (x) => ({ x, y: g.wy, w: DISC, h: DISC });
    wset.close = box(Math.floor((g.closeCell - DISC) / 2) + 1);
    wset.zoom = box(W - g.rightCell + 4);
    wset.collapse = box(W - g.rightCell + 21);
  }
  return {
    topH: g.T, sideL: 7, sideR: 7, bottomH: b.H, collapsed,
    top, bottom,
    left: [{ name: 'sideL', code: 8, w: 4, uniform: true }],
    right: [{ name: 'sideR', code: 8, w: 4, uniform: true }],
    ...(titled ? { title: { cell: 'plate', top: g.plate[0], bottom: g.plate[1] } } : {}),
    widgets: wset,
  };
}

// ── Widgets: 15px glass beads ──────────────────────────────────────────────
// One silhouette and one rim for all three; light from the upper left: a
// white inner ring and a 2px glint up there, a lighter upper face, a shade
// ring on the lower right. Glyphs 7px on whole pixels.
const RIM = [
  '.....#####.....',
  '...##.....##...',
  '..#.........#..',
  '.#...........#.',
  '.#...........#.',
  '#.............#',
  '#.............#',
  '#.............#',
  '#.............#',
  '#.............#',
  '.#...........#.',
  '.#...........#.',
  '..#.........#..',
  '...##.....##...',
  '.....#####.....',
];
const GLYPHS = {
  close: ['##...##', '###.###', '.#####.', '..###..', '.#####.', '###.###', '##...##'],
  zoom: ['#######', '#.....#', '#.....#', '#..#..#', '#.....#', '#.....#', '#######'],
  collapse: ['.......', '.......', '.......', '#######', '#######', '.......', '.......'],
};
const GLINT = [[4, 3], [5, 3], [3, 4], [4, 4]];
/** Bead pixel classes: rim, hi (upper-left inner ring), lo (lower-right inner ring), top / bottom face. */
const BEAD = (() => {
  const rim = (x, y) => RIM[y]?.[x] === '#';
  const map = [];
  for (let y = 0; y < DISC; y++) {
    const a = RIM[y].indexOf('#'), b = RIM[y].lastIndexOf('#');
    for (let x = a; x <= b; x++) {
      if (rim(x, y)) { map.push([x, y, 'rim']); continue; }
      const near = [[-1, 0], [1, 0], [0, -1], [0, 1]].some(([dx, dy]) => rim(x + dx, y + dy));
      const s = x + y;
      map.push([x, y, near && s < DISC - 1 ? 'hi' : near && s > DISC - 1 ? 'lo' : y < 7 ? 'top' : 'face']);
    }
  }
  for (const [x, y] of GLINT) map.push([x, y, 'glint']);
  return map;
})();

export function drawDisc(r, { x, y }, state, role, pressed = false) {
  const p = C[state];
  const look = pressed
    ? { rim: p.rim, hi: C.accent, top: C.accentDeep, face: C.accentDeep, lo: C.outline, glint: C.accentLight, glyph: '#ffffff' }
    : state === 'active'
      ? { rim: p.rim, hi: p.sheen, top: p.disc, face: p.discLo, lo: p.shade, glint: p.sheen, glyph: p.glyph }
      : { rim: p.rim, hi: p.sheen, top: p.disc, face: p.disc, lo: p.shade, glint: p.disc, glyph: null };
  for (const [dx, dy, k] of BEAD) r.set(x + dx, y + dy, look[k]);
  if (look.glyph) r.sprite(x + 4, y + 4, GLYPHS[role], { '#': look.glyph });
}

// ── Branch and leaves ──────────────────────────────────────────────────────
const LEAVES = [ // two pointed leaves on a short twig, lit from the upper left
  '.........O.',
  '........OhO',
  '.......OhmO',
  '..O...OhmlO',
  '.OhO..OmlO.',
  'OhmlO.OlO..',
  'OmmlOOOO...',
  '.OlOO......',
  '..OO.......',
]

/** Row of the branch's top edge at cell-relative x, from the path's points. */
function branchTop(path, x) {
  for (let i = 1; i < path.length; i++) {
    const [x0, y0] = path[i - 1], [x1, y1] = path[i];
    if (x <= x1) return Math.round(y0 + ((y1 - y0) * (x - x0)) / (x1 - x0));
  }
  return path.at(-1)[1];
}

/** The branch across the bird cell: outline, lit top row, body, shaded bottom; thinning to a twig. */
function paintBranch(r, cell, bird, p) {
  const b = p.branch, end = bird.leaves ? cell.w - 2 : cell.w - 1;
  const layer = new Raster(r.width, r.height);
  for (let x = 1; x < end; x++) {
    const top = branchTop(bird.branch, x);
    const thick = x > end - 10 ? Math.max(2, bird.thick - 1) : bird.thick;
    layer.set(cell.x0 + x, top, b.hi);
    for (let y = top + 1; y < top + thick - 1; y++) layer.set(cell.x0 + x, y, b.mid);
    layer.set(cell.x0 + x, top + thick - 1, b.lo);
    // bark: a dark fleck every so often on the body row
    if (x % 11 === 5 && thick > 2) layer.set(cell.x0 + x, top + 1, b.lo);
  }
  layer.outlineEdges(0, 0, layer.width, layer.height, b.line);
  // The cut end on the left shows pale heartwood.
  const top0 = branchTop(bird.branch, 1);
  for (let y = top0; y < top0 + bird.thick - 2; y++) layer.set(cell.x0 + 1, y + 1, b.cut);
  r.blit(layer, 0, 0);
  if (bird.leaves) {
    const lx = cell.x1 - LEAVES[0].length - 1, ly = branchTop(bird.branch, cell.w - 4) - LEAVES.length + 2;
    r.sprite(lx, ly, LEAVES, { O: b.line, h: p.leaf.hi, m: p.leaf.mid, l: p.leaf.lo });
  }
}

function paintBird(r, layout, g, p) {
  const cell = layout.named('bird'), bird = g.bird;
  const legend = birdLegend(p.bird);
  const x = cell.x0 + bird.x, y = bird.y;
  // Body first, then the branch in front of the tail, then the feet on top.
  r.sprite(x, y, bird.rows.map((row, j) => (j >= bird.feet ? row.replace(/[Ff]/g, '.') : row)), legend);
  paintBranch(r, cell, bird, p);
  r.sprite(x, y, bird.rows.map((row, j) => (j >= bird.feet ? row.replace(/[^Ff]/g, '.') : '.'.repeat(row.length))), legend);
}

// ── Water ──────────────────────────────────────────────────────────────────
// One 32px tile: foam dashes on both bands, and one reed clump whose blades
// rise from the bottom through the water (olive on blue, lit side up-left).
const REEDS = [ // columns 0..9 of the clump, rows from the band's row 2 down to its row 10
  '....h.....',
  '....m..h..',
  '.h..m..m..',
  '.m..m..m..',
  '.m.mm..m..',
  '..mm..mm..',
  '..m...m...',
  '..m..m....',
  '..l..l....',
];
function waterAt(x, j, p) {
  const w = p.water, ph = ((x % PERIOD) + PERIOD) % PERIOD;
  const [u0, u1] = BOTTOM.upper, [l0, l1] = BOTTOM.lower;
  const rx = ph - 18;
  if (j >= 2 && j <= 10 && rx >= 0 && rx < 10) {
    const ch = REEDS[j - 2][rx];
    if (ch !== '.') return { h: p.leaf.hi, m: p.leaf.mid, l: p.leaf.lo }[ch];
  }
  if (j >= u0 && j < u1) {
    if (j === u0 + 1 && ((ph >= 3 && ph < 7) || (ph >= 29 && ph < 31))) return w.foam;
    return w.hi;
  }
  if (j >= l0 && j < l1) {
    if (j === l0 + 2 && ph >= 9 && ph < 13) return w.foamLo;
    return w.lo;
  }
  return null;
}

/** Hard 1px ellipse (upper and lower arcs) centred on (cx, cy), clipped. */
function ellipse(r, cx, cy, rx, ry, color, clip) {
  for (let dx = -rx; dx <= rx; dx++) {
    const dy = Math.round(ry * Math.sqrt(Math.max(0, 1 - (dx / (rx + 0.5)) ** 2)));
    for (const y of [cy - dy, cy + dy]) if (clip(cx + dx, y)) r.set(cx + dx, y, color);
  }
}

const PEBBLE = [
  '..OOOOO..',
  '.OhhfffO.',
  'OhffffflO',
  '.OlllllO.',
  '..OOOOO..',
];

// ── Painting ───────────────────────────────────────────────────────────────

/** The 2-1 stair at a corner: (x0, y0) the corner pixel, dx/dy pointing inward. */
function stair(r, x0, y0, dx, dy, outline) {
  r.set(x0, y0, null).set(x0 + dx, y0, null).set(x0, y0 + dy, null);
  r.set(x0 + dx, y0 + dy, outline).set(x0 + 2 * dx, y0, outline).set(x0, y0 + 2 * dy, outline);
}

/** The glass bar: outline, white sheen, a stepped gradient down the rows, shade, separator. */
function paintBar(r, layout, g, p) {
  const { width: W } = layout;
  const [t0, sep] = g.bar;
  const mid = t0 + Math.floor((sep - t0) / 2);
  for (let y = t0; y <= sep; y++) for (let x = 0; x < W; x++) {
    let c = y < mid ? p.face : p.faceLo;
    if (y === t0 || y === sep || x === 0 || x === W - 1) c = p.outline;
    else if (y === sep - 1 || x === W - 2) c = p.shade;
    else if (y === t0 + 1 || x === 1) c = p.sheen;
    r.set(x, y, c);
  }
  stair(r, 0, t0, 1, 1, p.outline);
  stair(r, W - 1, t0, -1, 1, p.outline);
  if (layout.titled) {
    // The title plate: a white pill with stair ends, across bezelL | plate | bezelR.
    const bl = layout.named('bezelL'), br = layout.named('bezelR');
    const [y0, y1] = g.plate, x0 = bl.x0, x1 = br.x1, h = y1 - y0, w = x1 - x0;
    const pill = new Raster(w, h).fillRoundRect(0, 0, w, h, 4, p.plate);
    pill.hline(0, h - 2, w, p.plateShade).clipRounded(0, 0, w, h, 4).outlineEdges(0, 0, w, h, p.outline);
    r.blit(pill, x0, y0);
  }
}

function paintSides(r, layout, p) {
  const { width: W, content: A } = layout;
  const L = [p.outline, p.sheen, p.face, p.face, p.face, p.faceLo, p.shade];
  const R = [p.sheen, p.face, p.face, p.face, p.faceLo, p.shade, p.outline];
  for (let y = A.top; y < A.bottom; y++) {
    L.forEach((c, i) => r.set(i, y, c));
    R.forEach((c, i) => r.set(W - 7 + i, y, c));
  }
}

function paintBottom(r, layout, p) {
  const { width: W, height: H, content: A } = layout;
  const y0 = A.bottom;
  for (let x = 0; x < W; x++) {
    const edge = x === 0 || x === W - 1;
    r.set(x, y0, p.outline);
    r.set(x, y0 + 1, edge ? p.outline : p.sheen);
    for (let j = 2; j < BOTTOM.H - 1; j++) r.set(x, y0 + j, edge ? p.outline : waterAt(x, j, p));
    r.set(x, H - 1, p.outline);
  }
  // The ripple: three concentric rings, centred in its cell, on plain water.
  const rip = layout.named('ripple');
  for (let x = rip.x0; x < rip.x1; x++) for (let j = 2; j < BOTTOM.H - 1; j++) r.set(x, y0 + j, j < BOTTOM.upper[1] ? p.water.hi : p.water.lo);
  const cx = rip.x0 + Math.floor(rip.w / 2), cy = y0 + 6;
  const clip = (x, y) => x >= rip.x0 && x < rip.x1 && y >= y0 + 2 && y < H - 1;
  [[11, 3], [7, 2], [3, 1]].forEach(([rx, ry], i) => ellipse(r, cx, cy, rx, ry, i === 0 ? p.water.foamLo : p.water.ripple, clip));
  r.set(cx, cy, p.water.ripple);
  const peb = layout.cells.bottom.find((c) => c.name === 'pebble');
  if (peb) {
    const P = p.pebble, x = peb.x1 - PEBBLE[0].length - 2, y = H - 1 - PEBBLE.length;
    r.sprite(x, y, PEBBLE, { O: P.line, h: P.hi, f: P.face, l: P.lo });
    r.set(x - 1, y + 2, p.water.foam).set(x + PEBBLE[0].length, y + 2, p.water.foam);
  }
  stair(r, 0, H - 1, 1, -1, p.outline);
  stair(r, W - 1, H - 1, -1, -1, p.outline);
}

/** Paint one frame image for a window type in a state ('active' | 'inactive'). */
export function paintFrame(t, state) {
  const { layout, kind } = t;
  const g = G[kind];
  const p = C[state];
  const r = new Raster(layout.width, layout.height);
  paintBar(r, layout, g, p);
  if (layout.titled) paintBird(r, layout, g, p);
  if (layout.collapsed) {
    stair(r, 0, g.bar[1], 1, -1, p.outline);
    stair(r, layout.width - 1, g.bar[1], -1, -1, p.outline);
  } else {
    paintSides(r, layout, p);
    paintBottom(r, layout, p);
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
    t(-14336, 'Document Window', 'doc', { widgets: true, resizable: true }),
    t(-14332, 'Collapsed Document Window', 'doc', { widgets: true, collapsed: true }),
    t(-14328, 'Dialog', 'plain'),
    t(-14326, 'Alert', 'plain'),
    t(-14324, 'Movable Modal', 'util'),
    t(-14322, 'Movable Alert', 'util'),
    t(-14304, 'Titled Utility Window', 'util', { widgets: true, resizable: true }),
    t(-14300, 'Collapsed Titled Utility Window', 'util', { widgets: true, collapsed: true }),
  ];
}

// ── Pressed widgets ───────────────────────────────────────────────────────
// -14330 for every window in the web (and documents in classic), -14298 for
// utility windows in classic (R24). Both windows carry close, zoom and
// collapse at the same 15px, so the web's single strip lines up for utility
// windows too. Pressed inverts: a deep-teal bead with a white glyph.
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
