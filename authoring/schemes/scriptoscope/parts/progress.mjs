import { Raster, encodeCicn, encodeCinf, encodePpat } from '../../../../tools/theme-author/index.js';

// Material roles for progress, list headers, disclosures and native grow boxes.
const family = (C) => ({
  active: { outline: C.ink, troughShade: C.shade, trough: C.paper, colors: C.mark },
  inactive: { outline: C.deep, troughShade: C.shade, trough: C.paper, colors: Array(6).fill(C.deep) },
  header: {
    active: { highlight: C.white, bg: C.paper, divider: C.shade, bottom: C.shade, text: C.text },
    inactive: { highlight: C.white, bg: C.paper, divider: C.shade, bottom: C.shade, text: C.textOff },
  },
  disclosure: { normal: C.ink, pressed: C.accent, inactive: C.deep },
  grow: {
    active: { ground: C.enamel, edge: C.shade, ink: C.accentLight },
    inactive: { ground: C.inactive.frame, edge: C.shade, ink: C.mutedBrass },
  },
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
const BAR = { width: 8, height: 14, corner: 3, inner: 8 };

/** Cut the 2-1 stair off all four corners of a w×h raster. */
function stair(r) {
  const { width: w, height: h } = r;
  for (const [x, y] of [
    [0, 0],
    [1, 0],
    [0, 1],
  ]) {
    r.set(x, y, null)
      .set(w - 1 - x, y, null)
      .set(x, h - 1 - y, null)
      .set(w - 1 - x, h - 1 - y, null);
  }
  return r;
}

function progressFrame(p) {
  // A sunk channel: outline, then the shade on the inner top and left, white trough.
  // The frame's middle (rows 3..10) is never drawn; painting it keeps the
  // image readable in ResEdit-style tools.
  const { width: W, height: H } = BAR;
  const r = stair(new Raster(W, H).fillRect(0, 0, W, H, p.trough)).outlineEdges(0, 0, W, H, p.outline);
  return r
    .hline(2, 1, W - 4, p.troughShade)
    .vline(1, 2, H - 4, p.troughShade)
    .set(1, 1, null);
}

// The entire 24px fill period repeats: six coloured segments with paper gaps.
function progressFill(p) {
  const w = 24,
    h = BAR.inner,
    r = new Raster(w, h).fillRect(0, 0, w, h, p.trough);
  for (let x = 0; x < w; x++)
    for (let y = 1; y < h - 1; y++) if (x % 4 !== 3) r.set(x, y, p.colors[Math.floor(x / 4)]);
  return r;
}

const progressTrack = (p) => new Raster(3, BAR.inner).fillRect(0, 0, 3, BAR.inner, p.trough);

const frameCinf = () => encodeCinf({ cornerSize: BAR.corner, sideThickness: BAR.corner, tileSides: 1 });
const sliceCinf = (cap) => encodeCinf({ cornerSize: cap, sideThickness: 0, tileSides: 0, patternAnchor: 0 });

// Indeterminate (§4.7 IND1–IND4): ppat id = base + phase, base -10080 active /
// -10072 inactive. When ppat base+1 exists the bar cycles through the steps
// that exist (phase ≥ 8, or a missing step, resets to 0), one step per idle
// advance (3 ticks). The pattern is phased at I's top-left, so rows 0..7 show.
// A 16px power-of-two tile advances 2px per step and loops seamlessly.
const STEPS = 8,
  PAT = 16;
function barberBase(p) {
  const r = new Raster(PAT, PAT).fillRect(0, 0, PAT, PAT, p.trough);
  for (let y = 0; y < PAT; y++)
    for (let x = 0; x < PAT; x++)
      if ((x - y + PAT) % 4 !== 3) r.set(x, y, p.colors[Math.floor(((x - y + PAT) % PAT) / 4)]);
  return r;
}

function rolled(src, dx) {
  const r = new Raster(src.width, src.height);
  for (let y = 0; y < src.height; y++)
    for (let x = 0; x < src.width; x++) {
      const sx = (((x - dx) % src.width) + src.width) % src.width;
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
  r.hline(0, 0, 11, h.highlight); // 1px top sheen
  r.vline(11, 0, 11, h.divider); // right edge = column divider in list headers
  r.hline(0, 11, 12, h.bottom); // separator under the header
  r.set(5, 5, h.text);
  return r;
}
const headerCinf = () =>
  encodeCinf({
    cornerSize: 2,
    sideThickness: 2,
    tileSides: 0,
    patternAnchor: 0,
    bgPatternId: 0,
    bgPixel: { x: 3, y: 3 },
    textPixel: { x: 5, y: 5 },
  });

// The list-view colours (-9550 background, -9549 sort column, -9548 divider)
// ship with the other Finder colours in parts/menus.mjs.

// ── 3. Disclosure triangles (kdef231-reference §2.6; src/controls.ts composeDisclosure) ──
// Right: -10112 inactive, -10111 normal, -10110 pressed, -10109..-10107 the
// opening frames (rotating towards down). Down: -10104 inactive, -10103 normal,
// -10102 pressed, -10101..-10099 the closing frames (back towards right).
// 12×12 like most of the corpus. The runtime finds them by their author
// names (the corpus spelling, e.g. 1138's), so keep those names.
// Pixel triangles: right-pointing and down-pointing are hand placed; the
// three in-between frames are the rotated triangle sampled once per pixel
// centre (hard edges, no blends).
const TRI_RIGHT = [
  '...#........',
  '...##.......',
  '...###......',
  '...####.....',
  '...#####....',
  '...######...',
  '...#####....',
  '...####.....',
  '...###......',
  '...##.......',
  '...#........',
  '............',
];
function rotateGrid(rows) {
  // 90° clockwise: right → down
  const n = rows.length;
  return rows
    .map((_, y) =>
      rows
        .map((row) => row[y])
        .reverse()
        .join(''),
    )
    .map((r) => r.slice(0, n));
}
function disclosure(angleDeg, color) {
  const S = 12;
  if (angleDeg === 0) return new Raster(S, S).sprite(0, 0, TRI_RIGHT, { '#': color });
  if (angleDeg === 90) return new Raster(S, S).sprite(0, 0, rotateGrid(TRI_RIGHT), { '#': color });
  const th = (angleDeg * Math.PI) / 180,
    cos = Math.cos(th),
    sin = Math.sin(th);
  const tri = [
    [3, 0],
    [-3, -5],
    [-3, 5],
  ].map(([x, y]) => [6 + x * cos - y * sin, 5.5 + x * sin + y * cos]);
  const inside = (px, py) => {
    const s = (a, b) => (b[0] - a[0]) * (py - a[1]) - (b[1] - a[1]) * (px - a[0]);
    const d = [s(tri[0], tri[1]), s(tri[1], tri[2]), s(tri[2], tri[0])];
    return d.every((v) => v >= 0) || d.every((v) => v <= 0);
  };
  return new Raster(S, S).paintCoverage(0, 0, S, S, inside, color, { samples: 1 });
}

// ── 4. Grow box (src/controls.ts composeGrowBox: -14333 active, -14334 inactive) ──
// The wnd# compositor does not draw it (only the built-in frame returns a
// grow-box sprite); classic Kaleidoscope draws it in the content corner.
// 16×16 (1138's 17×17 has a transparent last row and column).
function growBox(g) {
  const r = new Raster(16, 16).fillRect(0, 0, 16, 16, g.ground);
  r.hline(0, 0, 16, g.edge).vline(0, 0, 16, g.edge);
  for (let n = 4; n <= 12; n += 4) for (let k = 0; k < n; k++) r.set(14 - k, 14 - n + k, g.ink);
  return r;
}

export function build(add, { C }) {
  P = family(C);
  // Progress bar.
  for (const [state, base, label] of [
    ['active', -10080, ''],
    ['inactive', -10077, 'Inactive '],
  ]) {
    const p = P[state];
    add('cicn', base, encodeCicn(progressFrame(p)), `${label}Progress Indicator Frame`);
    add('cinf', base, frameCinf(), `${label}Progress Indicator Frame`);
    add('cicn', base + 1, encodeCicn(progressFill(p)), `${label}Full Progress Indicator Section`);
    add(
      'cinf',
      base + 1,
      encodeCinf({ cornerSize: 0, sideThickness: 0, tileSides: 1, patternAnchor: 0 }),
      `${label}Progress Indicator Fill`,
    );
    add('cicn', base + 2, encodeCicn(progressTrack(p)), `${label}Progress Indicator Track`);
    add('cinf', base + 2, sliceCinf(1), `${label}Progress Indicator Track`);
  }
  for (const [state, base, label] of [
    ['active', -10080, ''],
    ['inactive', -10072, 'Inactive '],
  ]) {
    const step0 = barberBase(P[state]);
    for (let k = 0; k < STEPS; k++) {
      add(
        'ppat',
        base + k,
        encodePpat(rolled(step0, (k * PAT) / STEPS)),
        `${label}Indeterminate Progress Step ${k + 1}`,
      );
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
    frames.forEach((a, i) =>
      add(
        'cicn',
        base + 3 + i,
        encodeCicn(disclosure(a, D.normal)),
        `Disclosure Triangle ${verb} Frame ${['One', 'Two', 'Three'][i]}`,
      ),
    );
  }

  // Grow boxes: document window, and the movable-modal pair (corpus n=7).
  const grows = [
    [-14334, 'inactive', 'Inactive Grow Box'],
    [-14333, 'active', 'Active Grow Box'],
    [-14310, 'inactive', 'Inactive Movable Modal Grow Box'],
    [-14309, 'active', 'Active Movable Modal Grow Box'],
  ];
  for (const [id, state, name] of grows) add('cicn', id, encodeCicn(growBox(P.grow[state])), name);
}
