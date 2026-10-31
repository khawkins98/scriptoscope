// Midnight 2027 progress bars, Finder/list headers, disclosure triangles and
// grow boxes. Engine geometry as in Kingfisher's parts/progress.mjs (re-themed
// by Bonn and Castle); the art is Midnight's:
//
//   progress      a sunk navy channel; the fill is champagne rising (gold
//                 rows under a pale lit row); indeterminate is confetti
//                 stripes (gold, pink, cyan) sliding over navy
//   list header   a navy rail with gold separators
//   disclosure    small navy arrowheads, hard-edged
//   grow box      the clock at midnight
import { Raster, encodeCicn, encodeCinf, encodePpat } from '../../../tools/theme-author/index.js';
import { clockFace } from './art.mjs';
import { C } from './palette.mjs';

const P = {
  active: {
    outline: '#000022', shade: '#000022', floor: '#000033', lip: '#003366',
    lit: '#ffffcc', gold: '#ffcc33', goldLo: '#cc9933', bronze: '#996600', pink: '#ff66cc', cyan: '#33ccff',
  },
  inactive: {
    outline: '#333366', shade: '#333366', floor: '#666699', lip: '#9999cc',
    lit: '#eeeeee', gold: '#cccccc', goldLo: '#aaaaaa', bronze: '#999999', pink: '#bbbbbb', cyan: '#aaaaaa',
  },
  header: {
    active: { lit: '#003366', face: '#000033', lo: '#000022', iron: '#cc9933', ironHi: '#ffcc33', text: '#ffffff' },
    inactive: { lit: '#9999cc', face: '#666699', lo: '#333366', iron: '#999999', ironHi: '#cccccc', text: '#eeeeee' },
  },
  disclosure: { normal: '#000033', pressed: '#cc9933', inactive: '#9999cc' },
};

// ── 1. Progress bar (CDEF 5; docs/spec/engine/progress.md) ──
// 14 rows. Frame -10080 active / -10077 inactive is a 9-slice with no body:
// corners c×c copied 1:1, edge bands s thick. Fill (+1) and track (+2) are
// drawn into the frame inset by c across and s down: 3-slices with caps of
// cinf byte 0 and ONE stretched middle column. c = s = 3, inner 8 rows.
const BAR = { width: 8, height: 14, corner: 3, inner: 8, cap: 3 };

function progressFrame(p) {
  const { width: W, height: H } = BAR;
  const r = new Raster(W, H).fillRect(1, 0, W - 2, H, p.outline).fillRect(0, 1, W, H - 2, p.outline);
  r.fillRect(1, 1, W - 2, H - 2, p.floor);
  r.hline(1, 1, W - 2, p.shade).vline(1, 1, H - 2, p.shade);    // sunk: shade on the top/left walls
  r.hline(2, H - 2, W - 3, p.lip).vline(W - 2, 2, H - 3, p.lip); // lit far lips
  return r;
}

/** The fill: champagne rising. A pale lit row, gold, a gold shade row, a bronze leading edge. */
function progressFill(p) {
  const w = 2 * BAR.cap + 1, h = BAR.inner;
  const r = new Raster(w, h).fillRect(0, 0, w, h, p.gold);
  r.hline(0, 0, w, p.lit).hline(0, h - 1, w, p.goldLo);
  r.vline(w - 1, 0, h, p.bronze);
  return r;
}

const progressTrack = (p) => new Raster(3, BAR.inner).fillRect(0, 0, 3, BAR.inner, p.floor).hline(0, 0, 3, p.shade);

const frameCinf = () => encodeCinf({ cornerSize: BAR.corner, sideThickness: BAR.corner, tileSides: 1 });
const sliceCinf = (cap) => encodeCinf({ cornerSize: cap, sideThickness: 0, tileSides: 0, patternAnchor: 0 });

// Indeterminate: ppat id = base + phase (8 steps, base -10080 active / -10072
// inactive), phased at the inner rect's top-left (rows 0..7 show). Confetti
// stripes (gold, pink, cyan) slanting across navy, period 16, each step
// rolled 2px right so step 7 → step 0 is the same move. Hard-edged, no dither.
const STEPS = 8, PAT = 16;
function barberBase(p) {
  const r = new Raster(PAT, PAT);
  for (let y = 0; y < PAT; y++) for (let x = 0; x < PAT; x++) {
    const u = (x + y) % PAT;
    r.set(x, y, u < 3 ? p.gold : u >= 5 && u < 8 ? p.pink : u >= 10 && u < 13 ? p.cyan : p.floor);
  }
  return r;
}
function rolled(src, dx) {
  const r = new Raster(src.width, src.height);
  for (let y = 0; y < src.height; y++) for (let x = 0; x < src.width; x++) r.set(x, y, src.get(((x - dx) % src.width + src.width) % src.width, y));
  return r;
}

// ── 2. List headers (docs/spec/engine/header.md): -9568 inactive, -9567 active ──
// A 9-slice, c = s = 2, body erased with the bgPixel colour. A navy rail: lit
// top row, a gold rule on the right edge (the column divider), shade below.
function header(h) {
  const r = new Raster(12, 12).fillRect(0, 0, 12, 12, h.face);
  r.hline(0, 0, 12, h.lit);
  r.vline(10, 0, 11, h.ironHi).vline(11, 0, 11, h.iron);
  r.hline(0, 11, 12, h.lo);
  r.set(5, 5, h.text);
  return r;
}
const headerCinf = () => encodeCinf({ cornerSize: 2, sideThickness: 2, tileSides: 0, patternAnchor: 0, bgPatternId: 0,
  bgPixel: { x: 3, y: 3 }, textPixel: { x: 5, y: 5 } });

// ── 3. Disclosure triangles (src/controls.ts composeDisclosure) ──
// Right: -10112 inactive, -10111 normal, -10110 pressed, -10109..-10107 frames
// opening towards down; down: -10104.., closing frames back towards right.
// 12×12. The runtime finds them by their author names, so keep those names.
// Drawn without a matte, so every edge is a hard pixel edge.
function sdTriangle(px, py, [a, b, c]) {
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
  const S = 12, cx = 6, cy = 6;
  const tri = [[3.2, 0], [-3, -4.2], [-3, 4.2]];
  const th = (angleDeg * Math.PI) / 180, cos = Math.cos(th), sin = Math.sin(th);
  const rot = tri.map(([x, y]) => [x * cos - y * sin, x * sin + y * cos]);
  const mid = (i) => (Math.min(...rot.map((p) => p[i])) + Math.max(...rot.map((p) => p[i]))) / 2;
  const [mx, my] = [mid(0), mid(1)];
  const pts = rot.map(([x, y]) => [cx + x - mx, cy + y - my]);
  return new Raster(S, S).paintCoverage(0, 0, S, S, (x, y) => sdTriangle(x, y, pts) <= 0, color);
}

// ── 4. Grow box (-14333 active, -14334 inactive; classic draws it in the
// content corner): the clock at midnight on a navy square, 16×16.
function growBox(state) {
  const p = C[state];
  const r = new Raster(16, 16).fillRect(0, 0, 16, 16, p.outline).fillRect(1, 1, 14, 14, p.sky);
  return clockFace(r, 1, 1, 13, state);
}

export function build(add) {
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
    for (let k = 0; k < STEPS; k++) add('ppat', base + k, encodePpat(rolled(step0, (k * PAT) / STEPS)), `${label}Indeterminate Progress Step ${k + 1}`);
  }

  add('cicn', -9568, encodeCicn(header(P.header.inactive)), 'Inactive Finder Header');
  add('cinf', -9568, headerCinf(), 'Inactive Header');
  add('cicn', -9567, encodeCicn(header(P.header.active)), 'Finder Header');
  add('cinf', -9567, headerCinf(), 'Active Header');

  const D = P.disclosure;
  const families = [
    [-10112, 0, 'Right Pointing Disclosure Triangle', [22.5, 45, 67.5], 'Opening'],
    [-10104, 90, 'Down Pointing Disclosure Triangle', [67.5, 45, 22.5], 'Closing'],
  ];
  for (const [base, angle, name, frames, verb] of families) {
    add('cicn', base, encodeCicn(disclosure(angle, D.inactive)), `Inactive ${name}`);
    add('cicn', base + 1, encodeCicn(disclosure(angle, D.normal)), name);
    add('cicn', base + 2, encodeCicn(disclosure(angle, D.pressed)), `Pressed ${name}`);
    frames.forEach((a, i) => add('cicn', base + 3 + i, encodeCicn(disclosure(a, D.normal)),
      `Disclosure Triangle ${verb} Frame ${['One', 'Two', 'Three'][i]}`));
  }

  const grows = [[-14334, 'inactive', 'Inactive Grow Box'], [-14333, 'active', 'Active Grow Box'],
    [-14310, 'inactive', 'Inactive Movable Modal Grow Box'], [-14309, 'active', 'Active Movable Modal Grow Box']];
  for (const [id, state, name] of grows) add('cicn', id, encodeCicn(growBox(state)), name);
}
