// Halcyon — progress bars, Finder/list headers, disclosure triangles and grow boxes.
//
// Ids, sizes and cinf layouts follow the corpus (1138, windows-95, 1984,
// evolution; author labels in docs/spec/corpus-corroborated-ids.md) and the
// runtime consumers named in each section. Not shipped: placards (no corpus
// scheme authors one and no id is known, docs/spec/scheme-factory-vs-corpus.md
// "Placards are truly dead") and the utility-window grow boxes -14317/-14313
// (corroborated only on corner-sprite schemes).

import { Raster, verticalGradient, mix, encodeCicn, encodeCinf, encodePpat } from '../../../../tools/theme-author/index.js';

// Family colours (palette.mjs holds only the shared ones: C.body, C.accent).
const family = (C) => ({
  active: {
    outline: '#97a2b2', troughShade: '#dce2e9', trough: '#e8ecf1',
    fillTop: '#3aa7c4', fillBottom: '#147f9c', fillSheen: '#6cc1d7',
    stripeDark: C.accent, stripeLight: '#62b9d0',
  },
  inactive: {
    outline: '#c4c9d0', troughShade: '#e9ecf0', trough: '#f1f3f6',
    fillTop: '#c3ccd5', fillBottom: '#b3bdc8', fillSheen: '#d3dae1',
    stripeDark: '#c7cfd8', stripeLight: '#e3e7ec',
  },
  header: {
    active: { highlight: '#ffffff', bg: '#f3f5f8', divider: '#dde2e9', bottom: '#cdd4de', text: '#4a5566' },
    inactive: { highlight: '#fdfdfe', bg: '#f8f9fb', divider: '#eceef1', bottom: '#e3e6ea', text: '#a3aab4' },
  },
  disclosure: { normal: '#4a5566', pressed: C.accent, inactive: '#b9c0ca' },
  grow: {
    active: { edge: '#d2d8e1', face: '#f6f8fa', grip: '#8d98a8' },
    inactive: { edge: '#e3e6ea', face: '#f9fafb', grip: null },
  },
  matte: C.body, // what these controls normally sit on, for smooth outer edges
});
let P;

// ── 1. Progress bar (CDEF 5; docs/spec/engine/progress.md, src/engine/families/progress.ts) ──
// The bar is always 14 rows (RECT1). Frame cicn -10080 active / -10077
// inactive is a 9-slice with NO body (FRAME8): corners c×c copied 1:1, edge
// bands s thick. With tile=1 (FRAME6) the side bands copy rows [c, 14−c)
// 1:1, because the bar never changes height. The fill (frame id + 1) and track
// (+ 2) are drawn into I = R inset by max(c, 2) across and s down (INSET1/2),
// fill over [I.left, x), track over [x, I.right) (DET1); each is a 3-slice
// with caps of cinf byte 0, middle = ONE source column stretched when byte 2
// is 0 (SLICE5), centred vertically in I (SLICE2).
// c = s = 3 keeps the frame bands and I seamless (c > s would leave
// uncovered columns between the side band and I). I is then 8 rows tall.
const BAR = { width: 8, height: 14, corner: 3, inner: 8, cap: 3 };

function progressFrame(p) {
  const { width: W, height: H, corner } = BAR;
  // Outline outside, a slightly shaded top row inside: an inset trough.
  // The frame's middle (rows 3..10) is never drawn; painting it keeps the
  // image readable in ResEdit-style tools.
  return new Raster(W, H)
    .fillRoundRectSmooth(0, 0, W, H, corner, p.outline, { matte: P.matte })
    .fillRoundRectSmooth(1, 1, W - 2, H - 2, corner - 1, (_x, y) => (y === 1 ? p.troughShade : p.trough));
}

// Fill: a rounded capsule end on both caps, sitting on trough colour, so the
// art is fully opaque and blends with the frame band and the track beside it.
// The middle column carries a vertical gradient; it is stretched, so never dither it.
function progressFill(p) {
  const w = 2 * BAR.cap + 1, h = BAR.inner;
  const shade = verticalGradient(0, h, [[0, p.fillTop], [1, p.fillBottom]]);
  return new Raster(w, h)
    .fillRect(0, 0, w, h, p.trough)
    .fillRoundRectSmooth(0, 0, w, h, 3, (x, y) => (y === 0 ? mix(p.fillSheen, shade(x, y), 0.35) : shade(x, y)));
}

const progressTrack = (p) => new Raster(3, BAR.inner).fillRect(0, 0, 3, BAR.inner, p.trough);

const frameCinf = () => encodeCinf({ cornerSize: BAR.corner, sideThickness: BAR.corner, tileSides: 1 });
// Slice cinf: byte 0 cap width, byte 2 = 0 → single middle column (SLICE5), byte 3 = 0 → tile from the start.
const sliceCinf = (cap) => encodeCinf({ cornerSize: cap, sideThickness: 0, tileSides: 0, patternAnchor: 0 });

// Indeterminate (§4.7 IND1–IND4): ppat id = base + phase, base -10080 active /
// -10072 inactive. When ppat base+1 exists the bar cycles through the steps
// that exist (phase ≥ 8, or a missing step, resets to 0), one step per idle
// advance (3 ticks). The pattern is phased at I's top-left, so rows 0..7 show.
// 45° stripes, period 16 → each of the 8 steps rolls the base pattern 2px
// right, so step 7 → step 0 is the same 2px move. The stripe edges are
// anti-aliased (4×4 samples of a wrapping function); the sheen is a 4×4
// Bayer dither between two shade levels, period 8 down, so the pattern tiles
// cleanly both ways and every step has identical dither (it is rolled with it).
const STEPS = 8, PAT = 16;
const BAYER4 = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];

function barberBase(p) {
  const r = new Raster(PAT, PAT);
  for (let y = 0; y < PAT; y++) for (let x = 0; x < PAT; x++) {
    let dark = 0;
    for (let sy = 0; sy < 4; sy++) for (let sx = 0; sx < 4; sx++) {
      const u = (x + (sx + 0.5) / 4 + y + (sy + 0.5) / 4) % PAT;
      if (u < PAT / 2) dark++;
    }
    const base = mix(p.stripeLight, p.stripeDark, dark / 16);
    // Sheen: lighter towards the top of the 8 visible rows, ordered-dithered.
    const row = y % 8, t = (7 - row) / 7;                       // 1 at the top, 0 at the bottom
    const lift = 0.22 * t, step = 0.11;                          // two dither levels: 0.11 apart
    const lo = Math.floor(lift / step) * step, frac = (lift - lo) / step;
    const amount = frac > (BAYER4[y & 3][x & 3] + 0.5) / 16 ? lo + step : lo;
    r.set(x, y, mix(base, '#ffffff', amount));
  }
  return r;
}

function rolled(src, dx) {
  const r = new Raster(src.width, src.height);
  for (let y = 0; y < src.height; y++) for (let x = 0; x < src.width; x++) {
    const sx = ((x - dx) % src.width + src.width) % src.width;
    r.set(x, y, src.get(sx, y));
  }
  return r;
}

// ── 2. Finder / list headers (docs/spec/engine/header.md; src/engine/families/header.ts) ──
// drawState 0 → -9568 ("Inactive Header"), nonzero → -9567 ("Active Header").
// A cinf 9-slice: c×c corners, s-thick edges stretched from one column/row,
// body erased with the colour at bgPixel (bodyRequest mode 0, no ppat).
// 12×12, c = s = 2, like 1138. textPixel sits in the body (never drawn; the
// body is erased) and carries the Finder's header text colour.
function header(h) {
  const r = new Raster(12, 12).fillRect(0, 0, 12, 12, h.bg);
  r.hline(0, 0, 11, h.highlight);  // 1px top sheen
  r.vline(11, 0, 11, h.divider);   // right edge = column divider in list headers
  r.hline(0, 11, 12, h.bottom);    // separator under the header
  r.set(5, 5, h.text);
  return r;
}
const headerCinf = () => encodeCinf({ cornerSize: 2, sideThickness: 2, tileSides: 0, patternAnchor: 0, bgPatternId: 0,
  bgPixel: { x: 3, y: 3 }, textPixel: { x: 5, y: 5 } });

// The list-view colours (-9550 background, -9549 sort column, -9548 divider)
// ship with the other Finder colours in parts/menus.mjs.

// ── 3. Disclosure triangles (kdef231-reference §2.6; src/controls.ts composeDisclosure) ──
// Right: -10112 inactive, -10111 normal, -10110 pressed, -10109..-10107 the
// opening frames (rotating towards down). Down: -10104 inactive, -10103 normal,
// -10102 pressed, -10101..-10099 the closing frames (back towards right).
// 12×12 like most of the corpus. The runtime finds them by their author
// names (the corpus spelling, e.g. 1138's), so keep those names.
function sdTriangle(px, py, [a, b, c]) {
  // Signed distance to a triangle (negative inside).
  const edge = (p0, p1) => {
    const ex = p1[0] - p0[0], ey = p1[1] - p0[1], vx = px - p0[0], vy = py - p0[1];
    const t = Math.max(0, Math.min(1, (vx * ex + vy * ey) / (ex * ex + ey * ey)));
    const dx = vx - ex * t, dy = vy - ey * t;
    return { d: dx * dx + dy * dy, s: ex * vy - ey * vx };
  };
  const es = [edge(a, b), edge(b, c), edge(c, a)];
  const d = Math.sqrt(Math.min(...es.map((e) => e.d)));
  const inside = es.every((e) => e.s >= 0) || es.every((e) => e.s <= 0);
  return inside ? -d : d;
}

function disclosure(angleDeg, color) {
  const S = 12, cx = 6, cy = 6, round = 0.7;
  // Right-pointing, centred on its bounding box so every rotation stays put;
  // shrunk by `round` and re-grown by it for softly rounded corners.
  const tri = [[3.1 - round * 1.6, 0], [-3.1 + round, -4 + round * 1.4], [-3.1 + round, 4 - round * 1.4]];
  const th = (angleDeg * Math.PI) / 180, cos = Math.cos(th), sin = Math.sin(th);
  const rot = tri.map(([x, y]) => [x * cos - y * sin, x * sin + y * cos]);
  // Centre each frame on its own bounding box (grown by `round`), so the
  // in-between frames don't drift towards a corner while rotating.
  const mid = (i) => (Math.min(...rot.map((p) => p[i])) + Math.max(...rot.map((p) => p[i]))) / 2;
  const [mx, my] = [mid(0), mid(1)];
  const pts = rot.map(([x, y]) => [cx + x - mx, cy + y - my]);
  return new Raster(S, S).paintCoverage(0, 0, S, S, (x, y) => sdTriangle(x, y, pts) <= round, color, { matte: P.matte });
}

// ── 4. Grow box (src/controls.ts composeGrowBox: -14333 active, -14334 inactive) ──
// The wnd# compositor does not draw it (only the built-in frame returns a
// grow-box sprite); classic Kaleidoscope draws it in the content corner.
// 16×16 (1138's 17×17 has a transparent last row and column).
function growBox(g) {
  const r = new Raster(16, 16).fillRect(0, 0, 16, 16, g.face);
  r.hline(0, 0, 16, g.edge).vline(0, 0, 16, g.edge);
  if (g.grip) for (const o of [10, 6, 2]) r.strokeLineSmooth(13 - o, 13, 13, 13 - o, 1, g.grip);
  return r;
}

export function build(add, { C }) {
  P = family(C);
  // Progress bar.
  for (const [state, base, label] of [['active', -10080, ''], ['inactive', -10077, 'Inactive ']]) {
    const p = P[state];
    add('cicn', base, encodeCicn(progressFrame(p)), `${label}Progress Indicator Frame`);
    add('cinf', base, frameCinf(), `${label}Progress Indicator Frame`);
    add('cicn', base + 1, encodeCicn(progressFill(p)), `${label}Full Progress Indicator Section`);
    add('cinf', base + 1, sliceCinf(BAR.cap), `${label}Progress Indicator Fill`);
    add('cicn', base + 2, encodeCicn(progressTrack(p)), `${label}Progress Indicator Track`);
    add('cinf', base + 2, sliceCinf(1), `${label}Progress Indicator Track`);
  }
  for (const [state, base, label] of [['active', -10080, ''], ['inactive', -10072, 'Inactive ']]) {
    const step0 = barberBase(P[state]);
    for (let k = 0; k < STEPS; k++) {
      add('ppat', base + k, encodePpat(rolled(step0, (k * PAT) / STEPS)), `${label}Indeterminate Progress Step ${k + 1}`);
    }
  }

  // Headers.
  add('cicn', -9568, encodeCicn(header(P.header.inactive)), 'Inactive Finder Header');
  add('cinf', -9568, headerCinf(), 'Inactive Header');
  add('cicn', -9567, encodeCicn(header(P.header.active)), 'Finder Header');
  add('cinf', -9567, headerCinf(), 'Active Header');

  // Disclosure triangles: right family -10112.., down family -10104...
  const D = P.disclosure;
  const families = [
    [-10112, 0, 'Right Pointing Disclosure Triangle', [22.5, 45, 67.5], 'Opening'],
    [-10104, 90, 'Down Pointing Disclosure Triangle', [67.5, 45, 22.5], 'Closing'],
  ];
  for (const [base, angle, name, frames, verb] of families) {
    // 1138 spells the inactive right one "Tringle"; the runtime accepts both.
    add('cicn', base, encodeCicn(disclosure(angle, D.inactive)), `Inactive ${name}`);
    add('cicn', base + 1, encodeCicn(disclosure(angle, D.normal)), name);
    add('cicn', base + 2, encodeCicn(disclosure(angle, D.pressed)), `Pressed ${name}`);
    frames.forEach((a, i) => add('cicn', base + 3 + i, encodeCicn(disclosure(a, D.normal)),
      `Disclosure Triangle ${verb} Frame ${['One', 'Two', 'Three'][i]}`));
  }

  // Grow boxes: document window, and the movable-modal pair (corpus n=7).
  const grows = [[-14334, 'inactive', 'Inactive Grow Box'], [-14333, 'active', 'Active Grow Box'],
    [-14310, 'inactive', 'Inactive Movable Modal Grow Box'], [-14309, 'active', 'Active Movable Modal Grow Box']];
  for (const [id, state, name] of grows) add('cicn', id, encodeCicn(growBox(P.grow[state])), name);
}
