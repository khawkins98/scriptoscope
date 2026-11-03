// Bonn — progress bars, Finder/list headers, disclosure triangles and grow boxes.
// Geometry and every engine rule below are Kingfisher's (parts/progress.mjs);
// the art is Bonn's: a sandstone channel filled with the Rhine, a barge
// moving along it for the indeterminate bar, sandstone list headers with
// mortar separators, and a mooring bollard for the grow box.

// Ids, sizes and cinf layouts follow the corpus (1138, windows-95, 1984,
// evolution; author labels in docs/spec/corpus-corroborated-ids.md) and the
// runtime consumers named in each section. Not shipped: placards (no corpus
// scheme authors one and no id is known, docs/spec/scheme-factory-vs-corpus.md
// "Placards are truly dead") and the utility-window grow boxes -14317/-14313
// (corroborated only on corner-sprite schemes).

import { Raster, encodeCicn, encodeCinf, encodePpat } from '../../../tools/theme-author/index.js';
import { C as PAL } from './palette.mjs';
import { roundRect, bevel } from './pixels.mjs';

const A = PAL.active;

// Family colours, Bonn.
const family = (C) => ({
  active: {
    outline: A.outline, troughShade: A.stoneLo, trough: A.stone, troughLit: A.stoneHi,
    water: A.water, waterLo: A.waterLo, foam: A.foam, barge: A.sky, bargeLit: A.lamp,
  },
  inactive: {
    outline: '#999999', troughShade: '#cccccc', trough: '#dddddd', troughLit: '#eeeeee',
    water: '#aaaaaa', waterLo: '#999999', foam: '#dddddd', barge: '#777777', bargeLit: '#cccccc',
  },
  header: {
    active: { highlight: A.stoneHi, bg: A.stone, divider: A.mortar, bottom: A.stoneLo, text: A.outline },
    inactive: { highlight: '#ffffff', bg: '#eeeeee', divider: '#cccccc', bottom: '#dddddd', text: '#999999' },
  },
  disclosure: { normal: A.sky, pressed: A.mortar, inactive: '#bbbbbb' },
  grow: {
    active: { edge: A.outline, face: A.stone, hi: A.stoneHi, lo: A.stoneLo, rope: A.mortar },
    inactive: { edge: '#999999', face: '#eeeeee', hi: '#ffffff', lo: '#dddddd', rope: null },
  },
  matte: C.body,
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
  // A sunk sandstone channel: shade on the top and left inside the outline, lit at the bottom and right.
  return bevel(new Raster(W, H), 0, 0, W, H, roundRect(W, H, corner), { outline: p.outline, hi: p.troughShade, lo: p.troughLit, face: p.trough });
}

// Fill: the Rhine, square-ended so it meets the channel flush. Rows only (the
// middle column is stretched): a foam line on the river, then the deep band.
function progressFill(p) {
  const w = 2 * BAR.cap + 1, h = BAR.inner;
  const r = new Raster(w, h);
  for (let y = 0; y < h; y++) r.hline(0, y, w, y === 1 ? p.foam : y < 5 ? p.water : p.waterLo);
  return r;
}

const progressTrack = (p) => new Raster(3, BAR.inner).fillRect(0, 0, 3, BAR.inner, p.trough);

const frameCinf = () => encodeCinf({ cornerSize: BAR.corner, sideThickness: BAR.corner, tileSides: 1 });
// Slice cinf: byte 0 cap width, byte 2 = 0 → single middle column (SLICE5), byte 3 = 0 → tile from the start.
const sliceCinf = (cap) => encodeCinf({ cornerSize: cap, sideThickness: 0, tileSides: 0, patternAnchor: 0 });

// Indeterminate (§4.7 IND1–IND4): ppat id = base + phase, base -10080 active /
// -10072 inactive. The bar cycles through the steps that exist, one step per
// idle advance; the pattern is phased at I's top-left, so its 8 rows show.
// Bonn: a barge on the Rhine. A 32×8 tile (power-of-two sides), each of the
// 8 steps rolling it 4px right, so the barge sails along and step 7 → 0 is
// the same 4px move.
const STEPS = 8, PAT = 32;
const BARGE = [
  '......bb....',
  '.....bLLb...',
  'bbbbbbbbbbbb',
  '.bbbLbbLbbb.',
  '..bbbbbbbb..',
];

function bargeBase(p) {
  const r = new Raster(PAT, 8);
  for (let y = 0; y < 8; y++) r.hline(0, y, PAT, y < 6 ? p.water : p.waterLo);
  for (const x of [18, 26]) r.hline(x, 6, 3, p.water);
  r.hline(20, 3, 4, p.foam);
  r.sprite(3, 1, BARGE, { b: p.barge, L: p.bargeLit });
  r.hline(1, 5, 2, p.foam);                    // the wake
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
  r.hline(0, 0, 11, h.highlight);  // lit top row
  r.vline(11, 0, 11, h.divider);   // right edge = mortar column divider in list headers
  r.hline(0, 11, 12, h.bottom);    // shade row under the header
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
  // A sandstone corner block with a bollard: the frame's grow-box corner, small.
  const r = new Raster(16, 16).fillRect(0, 0, 16, 16, g.face);
  r.hline(0, 0, 16, g.edge).vline(0, 0, 16, g.edge).hline(1, 1, 15, g.hi).vline(1, 1, 15, g.hi);
  const B = ['.oooooo.', 'oLssssDo', 'oDDDDDDo', '.oLssDo.', g.rope ? 'rrrrrrrr' : '.oLssDo.', '.oLssDo.', 'oLssssDo', 'oooooooo'];
  r.sprite(5, 5, B, { o: g.edge, L: g.hi, s: g.face, D: g.lo, r: g.rope ?? g.face });
  return r;
}

export function build(add, { C } = { C: PAL }) {
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
    const step0 = bargeBase(P[state]);
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
