// Halcyon window frames (concept/concept.jpg, paint-over pass): a rounded
// frame with a navy outline, a slate ring and a white inner rim around
// lavender glass; a tall glass header with the title capsule and three glass
// beads along its top and the kingfisher on its branch in its lower left; a
// navy border round the content; and a blue-grey water band with the ripple
// along the bottom.
//
// The kingfisher, the branch, the ripple and the beads are painted over from
// the concept (`npm run paint-over`, the concept is drawn at 3×) and cleaned
// by hand (parts/sprites/ornament.mjs); nothing here redraws them from shapes.
//
// Geometry comes from the toolkit's frameLayout (per-edge cell lists,
// docs/authoring-exotic-frames.md §8). The recipes, per edge:
//
//   top (document)  close 1 | bird 10 | glass 11 | cap 6 | plate 5 | cap 6 | glass 8 | zoom+collapse 1
//   top (utility)   close 1 | glass 11 | cap 6 | plate 5 | cap 6 | glass 8 | zoom+collapse 1
//   top (untitled)  corner 1 | glass 8 | corner 1
//   left / right    glass 8                                   (rows A.top … A.bottom)
//   bottom          corner 1 | skip 0 | water 11 | ripple 1 | water 8 | skip 0 | corner 1
//
// Why these codes:
//   - The bird and its branch are one code-10 cell (R12): fixed at normal
//     widths, dropped whole when the window is narrower than the top's fixed
//     sum. The engine drops the title before it drops a code-10 cell, so a
//     window between that sum and sum + title shows the bird and no title.
//     The close box has its own code-1 cell so it never goes with the bird.
//   - Every grower is a 1px column of a uniform vertical gradient (ring rows,
//     glass, border), so stretching never shows; `uniform: 'bar'` makes
//     layout.lint prove it.
//   - The ripple is a fixed cell between two 1px water growers, so it stays
//     centred (R3); the bottom is narrower than the top, so code-0 skips take
//     the slack (R9).
//   - The title rect is the capsule's rows at the top of the header; the
//     engine puts the baseline at its bottom − 4 (R28), so the title sits in
//     the capsule near the top, not in the middle of the tall header.
import { Raster, frameLayout, stripLayout, pressedStripFrom, encodeCicn, encodeWnd, SYSTEM_PALETTE_256 } from '../../../../tools/theme-author/index.js';
import { srgbToStored } from '../../../../tools/theme-author/color.js';
import { C, sys } from '../palette.mjs';
import { ORNAMENT, ORNAMENT_LEGEND, RIPPLE } from './sprites/ornament.mjs';

const BEAD_D = 15;      // widget bead diameter
const SIDE = 6;         // side band: outline, ring, rim, glass, glass, border
const RADIUS = 6;       // frame corner radius
const BOTTOM_H = 14;    // border, water rows, ring, outline

// ── Geometry per window family ─────────────────────────────────────────────
const G = {
  doc: { T: 62, plate: [3, 22], wy: 5, closeCell: 20, bird: { cell: 77, x: 3, y: 4 }, rightCell: 36 },
  util: { T: 26, plate: [3, 22], wy: 5, closeCell: 22, rightCell: 36 },
  plain: { T: 8 },
};

/** Build the frameLayout spec for one window type. */
function spec(kind, { collapsed = false, widgets = false } = {}) {
  const g = G[kind];
  const titled = kind !== 'plain';
  const bar = (name, code) => ({ name, code, w: 1, uniform: 'bar' });
  const top = titled
    ? [
      { name: 'closeCell', code: 1, w: g.closeCell },
      ...(g.bird ? [{ name: 'bird', code: 10, w: g.bird.cell }] : []),
      bar('growL', 11),
      { name: 'bezelL', code: 6, w: 8 },
      { name: 'plate', code: 5, w: 1 },
      { name: 'bezelR', code: 6, w: 8 },
      bar('growR', 8),
      { name: 'right', code: 1, w: g.rightCell },
    ]
    : [{ name: 'capL', code: 1, w: 12 }, bar('grow', 8), { name: 'capR', code: 1, w: 12 }];
  const rip = RIPPLE[0].length + 2;
  const fixed = 2 * 10 + rip + 2;
  let W = top.reduce((s, c) => s + c.w, 0);
  if (W < fixed) { // the bottom needs more room: widen the (uniform) growers
    const growers = top.filter((c) => c.code === 8 || c.code === 11);
    let extra = fixed - W;
    growers.forEach((c, i) => { const n = Math.ceil(extra / (growers.length - i)); c.w += n; extra -= n; });
    W = fixed;
  }
  const slack = W - fixed;
  const skip = (name, w) => (w > 0 ? [{ name, code: 0, w }] : []);
  const bottom = [
    { name: 'cornerL', code: 1, w: 10 },
    ...skip('skipL', Math.floor(slack / 2)),
    bar('waterL', 11),
    { name: 'ripple', code: 1, w: rip },
    bar('waterR', 8),
    ...skip('skipR', Math.ceil(slack / 2)),
    { name: 'cornerR', code: 1, w: 10 },
  ];
  const wset = {};
  if (widgets) {
    const box = (x) => ({ x, y: g.wy, w: BEAD_D, h: BEAD_D });
    wset.close = box(Math.floor((g.closeCell - BEAD_D) / 2) + 1);
    wset.zoom = box(W - g.rightCell + 1);
    wset.collapse = box(W - g.rightCell + 17);
  }
  return {
    topH: g.T, sideL: SIDE, sideR: SIDE, bottomH: BOTTOM_H, collapsed,
    top, bottom,
    left: [{ name: 'sideL', code: 8, w: 4, uniform: true }],
    right: [{ name: 'sideR', code: 8, w: 4, uniform: true }],
    ...(titled ? { title: { cell: 'plate', top: g.plate[0], bottom: g.plate[1] } } : {}),
    widgets: wset,
  };
}

// ── Widgets: 15px glass beads (painted over from the concept's buttons) ────
// A slate rim, a pale cyan inner ring, a white face shading to #eeeeee, and
// a deep-teal glyph: the ×, the four-corner zoom and the corner triangle.
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
  zoom: ['###.###', '##...##', '#.....#', '.......', '#.....#', '##...##', '###.###'],
  collapse: ['......#', '.....##', '....###', '...####', '..#####', '.######', '#######'],
};
const BEAD = (() => {
  const rim = (x, y) => RIM[y]?.[x] === '#';
  const map = [];
  for (let y = 0; y < BEAD_D; y++) {
    const a = RIM[y].indexOf('#'), b = RIM[y].lastIndexOf('#');
    for (let x = a; x <= b; x++) {
      if (rim(x, y)) { map.push([x, y, 'rim']); continue; }
      const near = [[-1, 0], [1, 0], [0, -1], [0, 1]].some(([dx, dy]) => rim(x + dx, y + dy));
      map.push([x, y, near ? 'inner' : y < 8 ? 'face' : 'faceLo']);
    }
  }
  return map;
})();

export function drawDisc(r, { x, y }, state, role, pressed = false) {
  const b = C[state].bead;
  const look = pressed
    ? { rim: b.rim, inner: C.accent, face: C.accentDeep, faceLo: C.accentDeep, glyph: '#ffffff' }
    : b;
  for (const [dx, dy, k] of BEAD) r.set(x + dx, y + dy, look[k]);
  if (look.glyph) r.sprite(x + 4, y + 4, GLYPHS[role], { '#': look.glyph });
}

// ── The ornament, active and inactive ──────────────────────────────────────
// Inactive greys the bird rather than hiding it: each colour is pulled toward
// its own grey, lifted toward white, and snapped to the nearest system entry.
const SYS = SYSTEM_PALETTE_256;
function quiet(color) {
  const [r, g, b] = srgbToStored(color);
  const y = 0.3 * r + 0.59 * g + 0.11 * b;
  const t = [r, g, b].map((v) => v + (y - v) * 0.6).map((v) => v + (255 - v) * 0.3);
  let best = SYS[0], bd = Infinity;
  for (const e of SYS) { const d = (e[0] - t[0]) ** 2 + (e[1] - t[1]) ** 2 + (e[2] - t[2]) ** 2; if (d < bd) { bd = d; best = e; } }
  return sys(`#${best.map((v) => v.toString(16).padStart(2, '0')).join('')}`);
}
const ORNAMENT_QUIET = Object.fromEntries(Object.entries(ORNAMENT_LEGEND).map(([k, v]) => [k, quiet(v)]));

function paintOrnament(r, layout, g, state) {
  const cell = layout.named('bird'), legend = state === 'active' ? ORNAMENT_LEGEND : ORNAMENT_QUIET;
  // Clip at the content border: the tail and the branch's low end pass behind it.
  const rows = ORNAMENT.slice(0, Math.max(0, layout.top - 1 - g.bird.y));
  r.sprite(g.bird.x, g.bird.y, rows, legend);
  void cell;
}

// ── Frame ──────────────────────────────────────────────────────────────────

/** Inset of (x, y) from the rounded silhouette: 0 on the outline, < 0 outside. */
function inset(x, y, W, H) {
  const px = x + 0.5, py = y + 0.5, R = RADIUS;
  const cx = px < R ? R : px > W - R ? W - R : null, cy = py < R ? R : py > H - R ? H - R : null;
  if (cx !== null && cy !== null) return Math.floor(R - Math.hypot(px - cx, py - cy));
  return Math.min(x, W - 1 - x, y, H - 1 - y);
}

/**
 * Header glass colour for row y: a vertical gradient in three system-palette
 * steps (pale sky, lavender, deeper sky), each band change softened by two
 * interleaved rows. One colour per row, so the 1px stretch columns repeat it
 * cleanly; a dither ALONG the row would turn into stripes when stretched.
 */
function skyRow(y, T, sky) {
  const t = (y - 3) / Math.max(1, T - 5);
  const band = (a, b, edge) => (t < edge - 0.04 ? a : t < edge + 0.04 ? (y % 2 ? b : a) : b);
  return t < 0.5 ? band(sky[0], sky[1], 0.3) : band(sky[1], sky[2], 0.78);
}

function paintFrameRings(r, layout, p) {
  const { width: W, height: H, content: A, collapsed } = layout;
  const shapeH = collapsed ? layout.top : H;
  const f = p.frame, L = p.lake;
  for (let y = 0; y < shapeH; y++) for (let x = 0; x < W; x++) {
    const d = inset(x, y, W, shapeH);
    if (d < 0) continue;
    let c = d === 0 ? f.outline : d === 1 ? f.ring : d === 2 ? f.rim : y < layout.top && layout.titled ? skyRow(y, layout.top, p.sky) : f.glass;
    if (!collapsed && d >= 2) {
      if (y === A.top - 1 || y === A.bottom || ((x === A.left - 1 || x === A.right) && y >= A.top && y < A.bottom)) c = f.border;
      else if (y > A.bottom) {
        const j = y - A.bottom;
        c = j === 1 ? L.top : y === H - 3 ? L.low : L.body;
      }
    }
    r.set(x, y, c);
  }
  if (!collapsed && layout.titled) for (let x = 2; x < W - 2; x++) if (inset(x, A.top - 1, W, H) >= 2) r.set(x, A.top - 1, f.border);
}

function paintPill(r, layout, g, p) {
  const bl = layout.named('bezelL'), br = layout.named('bezelR');
  const [y0, y1] = g.plate, x0 = bl.x0, w = br.x1 - x0, h = y1 - y0;
  const pill = new Raster(w, h).fillRoundRect(0, 0, w, h, Math.floor(h / 2), p.pill.face);
  pill.hline(0, h - 2, w, p.pill.shade).clipRounded(0, 0, w, h, Math.floor(h / 2)).outlineEdges(0, 0, w, h, p.pill.outline);
  r.blit(pill, x0, y0);
}

function paintRipple(r, layout, p) {
  const rip = layout.named('ripple'), L = p.lake;
  const y0 = layout.content.bottom + 2;
  r.sprite(rip.x0 + 1, y0, RIPPLE, { l: L.ripple, g: L.lilac, w: L.glint });
}

/** Paint one frame image for a window type in a state ('active' | 'inactive'). */
export function paintFrame(t, state) {
  const { layout, kind } = t;
  const g = G[kind];
  const p = C[state];
  const r = new Raster(layout.width, layout.height);
  paintFrameRings(r, layout, p);
  if (layout.titled) paintPill(r, layout, g, p);
  if (g.bird) paintOrnament(r, layout, g, state);
  if (!layout.collapsed) paintRipple(r, layout, p);
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
    t(-14336, 'Document Window', 'doc', { widgets: true }),
    t(-14332, 'Collapsed Document Window', 'doc', { widgets: true, collapsed: true }),
    t(-14328, 'Dialog', 'plain'),
    t(-14326, 'Alert', 'plain'),
    t(-14324, 'Movable Modal', 'util'),
    t(-14322, 'Movable Alert', 'util'),
    t(-14304, 'Titled Utility Window', 'util', { widgets: true }),
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
