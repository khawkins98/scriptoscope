// Brickworks extra control families: progress bar (+ indeterminate steps),
// sliders, tabs, list headers, disclosure triangles and the grow box.
// Geometry, ids and cinf layouts are Halcyon's (authoring/schemes/halcyon/
// parts/progress.mjs and controls.mjs carry the engine notes and spec
// citations); only the art differs. Flat colours, whole pixels.
//
//   progress  a grey channel filled with a row of green 1×1 bricks: the fill's
//             slice cinf tiles its whole middle (byte 2, SLICE6), so every
//             8px brick and its seam repeat. Indeterminate: green and yellow
//             bricks walking along the channel.
//   sliders   a grey plate track; the thumb is a yellow round stud (the
//             title-bar widget's disc) or a stud with a point.
//   tabs      1×2 bricks with a stud standing on each top corner: the front
//             tab yellow, rear tabs grey.
//   headers   Finder list headers: white tiles with a grey seam.
//   disclosure triangles in the outline brown, red when pressed.
//   grow box  the grey wheel (classic only: the web draws the frame's own wheel).
import { Raster, encodeCicn, encodeCinf, encodePpat } from '../../../tools/theme-author/index.js';
import { BRICK, BODY, OUTLINE, INK } from './palette.mjs';
import { DISC, WHEEL } from './sprites.mjs';

const R = BRICK.red, Y = BRICK.yellow, GR = BRICK.green;
const QUIET_GREEN = { hi: '#99cc99', base: '#669966', lo: '#336633' };

// ── 1. Progress bar (14 rows; frame c = s = 3; inner 8 rows) ──────────────
const BAR = { width: 8, height: 14, corner: 3, inner: 8, brick: 8 };
const LOOK = {
  active: { outline: OUTLINE, sunk: '#999999', channel: '#cccccc', fill: GR, seam: GR.deep, walk: [GR, Y] },
  inactive: { outline: '#999999', sunk: '#cccccc', channel: '#eeeeee', fill: QUIET_GREEN, seam: '#336633', walk: [QUIET_GREEN, { hi: '#ffffcc', base: '#cccc66', lo: '#999966' }] },
};

function progressFrame(p) {
  const { width: W, height: H } = BAR;
  const r = new Raster(W, H).fillRect(0, 0, W, H, p.channel);
  r.hline(1, 1, W - 2, p.sunk).vline(1, 1, H - 2, p.sunk);
  r.strokeRect(0, 0, W, H, p.outline);
  for (const [x, y] of [[0, 0], [W - 1, 0], [0, H - 1], [W - 1, H - 1]]) r.set(x, y, null);
  return r;
}

/** One brick row, 8 rows tall: a lit top row, a shaded bottom row and right column, a dark seam. */
function brickRow(r, x0, w, b, seam) {
  r.fillRect(x0, 0, w - 1, BAR.inner, b.base).hline(x0, 0, w - 1, b.hi).hline(x0, BAR.inner - 1, w - 1, b.lo).vline(x0 + w - 2, 1, BAR.inner - 1, b.lo);
  return r.vline(x0 + w - 1, 0, BAR.inner, seam);
}

// The fill: 1px cap | one 8px brick (tiled) | 1px cap.
function progressFill(p) {
  const r = new Raster(BAR.brick + 2, BAR.inner);
  r.vline(0, 0, BAR.inner, p.seam);
  brickRow(r, 1, BAR.brick, p.fill, p.seam);
  return r.vline(BAR.brick + 1, 0, BAR.inner, p.seam);
}
const progressTrack = (p) => new Raster(3, BAR.inner).fillRect(0, 0, 3, BAR.inner, p.channel);
const frameCinf = () => encodeCinf({ cornerSize: BAR.corner, sideThickness: BAR.corner, tileSides: 1 });
// Slice cinf bytes: cap, -, middle (1 = tile the whole middle), anchor (0 = from the start).
const sliceCinf = (cap, middle) => encodeCinf({ cornerSize: cap, sideThickness: 0, tileSides: middle, patternAnchor: 0 });

// Indeterminate: green and yellow bricks (period 16) walking 2px per step for
// 8 steps, so step 7 → step 0 is the same move.
const STEPS = 8, PAT = 16;
function walkers(p) {
  const row = new Raster(PAT, BAR.inner);
  brickRow(row, 0, 8, p.walk[0], p.seam);
  brickRow(row, 8, 8, p.walk[1], p.seam);
  const r = new Raster(PAT, PAT);
  for (let y = 0; y < PAT; y++) for (let x = 0; x < PAT; x++) r.set(x, y, row.get(x, y % BAR.inner));
  return r;
}
function rolled(src, dx) {
  const r = new Raster(src.width, src.height);
  for (let y = 0; y < src.height; y++) for (let x = 0; x < src.width; x++) r.set(x, y, src.get(((x - dx) % src.width + src.width) % src.width, y));
  return r;
}

function buildProgress(add) {
  for (const [state, base, label] of [['active', -10080, ''], ['inactive', -10077, 'Inactive ']]) {
    const p = LOOK[state];
    add('cicn', base, encodeCicn(progressFrame(p)), `${label}Progress Indicator Frame`);
    add('cinf', base, frameCinf(), `${label}Progress Indicator Frame`);
    add('cicn', base + 1, encodeCicn(progressFill(p)), `${label}Full Progress Indicator Section`);
    add('cinf', base + 1, sliceCinf(1, 1), `${label}Progress Indicator Fill`);
    add('cicn', base + 2, encodeCicn(progressTrack(p)), `${label}Progress Indicator Track`);
    add('cinf', base + 2, sliceCinf(1, 0), `${label}Progress Indicator Track`);
  }
  for (const [state, base, label] of [['active', -10080, ''], ['inactive', -10072, 'Inactive ']]) {
    const s0 = walkers(LOOK[state]);
    for (let k = 0; k < STEPS; k++) add('ppat', base + k, encodePpat(rolled(s0, (k * PAT) / STEPS)), `${label}Indeterminate Progress Step ${k + 1}`);
  }
}

// ── 2. Sliders (CDEF 3; Halcyon parts/controls.mjs §1 for the rules) ──────
// Track: caps of k copied 1:1, ONE middle column stretched (flat along it).
// Thumb strip: 4 cells of 16 rows (inactive, normal, pressed, ghost), copied
// 1:1 over the track; each thumb is a hard-edged sprite, so its mask is
// exactly its silhouette.
const SLIDER = { k: 2, trackH: 5, thumbW: 15, cell: 16 };
const TRACK = {
  inactive: { edge: '#999999', hi: '#eeeeee', base: '#eeeeee', lo: '#cccccc' },
  normal: { edge: OUTLINE, hi: '#cccccc', base: '#999999', lo: '#666666' },
  pressed: { edge: OUTLINE, hi: '#999999', base: '#666666', lo: '#666666' },
};
const KNOB = {
  inactive: { o: '#999999', h: '#ffffff', b: '#eeeeee', l: '#cccccc' },
  normal: { o: OUTLINE, h: Y.hi, b: Y.base, l: Y.lo },
  pressed: { o: OUTLINE, h: Y.lo, b: Y.lo, l: Y.base },
};
// A stud with a point, pointing down into the tick band.
const POINTER = [...DISC.slice(0, 9),
  '.obbbbbbbblo.',
  '..obbbbbblo..',
  '...obbbblo...',
  '....obblo....',
  '.....olo.....',
  '......o......',
  '.............'];

function trackArt(t) {
  const { k, trackH } = SLIDER, w = 2 * k + 1;
  const r = new Raster(w, trackH).fillRect(0, 0, w, trackH, t.base);
  r.hline(0, 1, w, t.hi).hline(0, trackH - 2, w, t.lo);
  r.hline(0, 0, w, t.edge).hline(0, trackH - 1, w, t.edge).vline(0, 0, trackH, t.edge).vline(w - 1, 0, trackH, t.edge);
  return r.set(0, 0, null).set(w - 1, 0, null).set(0, trackH - 1, null).set(w - 1, trackH - 1, null);
}

function thumbCell(kind, cell) {
  const { thumbW: w, cell: h } = SLIDER;
  const out = new Raster(w, h);
  const art = kind === 'round' ? DISC : POINTER, y = kind === 'round' ? 1 : 0;
  if (cell === 3) return out.sprite(1, y, art.map((row) => row.replace(/[hbl]/g, '.')), { o: Y.lo });
  const tier = ['inactive', 'normal', 'pressed'][cell];
  return out.sprite(1, y, art, KNOB[tier]);
}

function transpose(src) {
  const out = new Raster(src.height, src.width);
  for (let y = 0; y < src.height; y++) for (let x = 0; x < src.width; x++) {
    const s = (y * src.width + x) * 4, d = (x * out.width + y) * 4;
    out.rgba.set(src.rgba.subarray(s, s + 4), d);
  }
  return out;
}
function flipCellsY(strip) {
  const out = new Raster(strip.width, strip.height), H = SLIDER.cell;
  for (let c = 0; c < 4; c++) for (let y = 0; y < H; y++) {
    const s = (c * H + y) * strip.width * 4, d = (c * H + (H - 1 - y)) * strip.width * 4;
    out.rgba.set(strip.rgba.subarray(s, s + strip.width * 4), d);
  }
  return out;
}

function buildSliders(add) {
  const tiers = [['inactive', 'Inactive '], ['normal', ''], ['pressed', 'Pressed ']];
  const groups = [
    { g: 0, h: 'Down Pointing', v: 'Right Pointing', kind: 'pointer', flip: false },
    { g: 1, h: 'Up Pointing', v: 'Left Pointing', kind: 'pointer', flip: true },
    { g: 2, h: 'Non-Directional Horizontal', v: 'Non-Directional Vertical', kind: 'round', flip: false },
  ];
  const trackCinf = () => encodeCinf({ cornerSize: SLIDER.k, sideThickness: SLIDER.trackH, tileSides: 0, patternAnchor: 0 });
  for (const [base, axis] of [[-10144, 'h'], [-10128, 'v']]) {
    const orient = (r) => (axis === 'v' ? transpose(r) : r);
    for (const grp of groups) {
      const gb = base + 6 * grp.g, label = grp[axis];
      tiers.forEach(([tier, prefix], t) => {
        add('cicn', gb + t, encodeCicn(orient(trackArt(TRACK[tier]))), `${prefix}${label} Slider Track`);
        add('cinf', gb + t, trackCinf(), `${prefix}${label} Slider Track`);
      });
      const strip = new Raster(SLIDER.thumbW, SLIDER.cell * 4);
      for (let c = 0; c < 4; c++) strip.blit(thumbCell(grp.kind, c), 0, c * SLIDER.cell);
      add('cicn', gb + 3, encodeCicn(orient(grp.flip ? flipCellsY(strip) : strip)), `${label} Slider Thumbs`);
      if (grp.g === 2) continue;
      for (const [tier, prefix, off] of [['inactive', 'Inactive ', 4], ['normal', '', 5]]) {
        add('cicn', gb + off, encodeCicn(orient(new Raster(1, 4).fillRect(0, 0, 1, 4, TRACK[tier].edge))), `${prefix}${label} Slider Tick`);
      }
    }
  }
}

// ── 3. Tabs (CDEF 8; Halcyon parts/controls.mjs §2 for the rules) ─────────
// Left/right c columns copied 1:1 at full height; the top s rows are ONE
// middle column repeated; the centre one colour at bgPixel. So the studs
// live in the c-wide side columns (one stud per top corner) and the face is
// flat between them. Bottoms stay open (the tab rests on the pane edge).
const TAB = {
  small: { base: -9976, c: 7, s: 6, rear: 21, front: 22, name: 'SSF' },
  large: { base: -9984, c: 8, s: 7, rear: 23, front: 24, name: 'LSF' },
};
const STUD_ROWS = 4;
const TAB_STUD = ['.oooo.', 'ohhhho', 'ohbbbo', 'ohbblo'];

function tabFace(size, look) {
  const { c } = size, w = 2 * c + 1, h = look.front ? size.front : size.rear;
  const top = STUD_ROWS;
  const r = new Raster(w, h).fillRect(0, top, w, h - top, look.base);
  r.hline(1, top + 1, w - 2, look.hi).vline(w - 2, top + 1, h - top - 1, look.lo);
  r.hline(0, top, w, look.edge).vline(0, top, h - top, look.edge).vline(w - 1, top, h - top, look.edge);
  r.set(0, top, null).set(w - 1, top, null);
  for (const sx of [1, w - 7]) r.sprite(sx, 0, TAB_STUD, { o: look.edge, h: look.hi, b: look.base, l: look.lo });
  // Hidden label colour on the first transparent pixel in column 0.
  let ty = 0;
  while (r.get(0, ty)) ty++;
  r.swatch(0, ty, look.text);
  return { art: r, text: { x: 0, y: ty } };
}

function buildTabs(add) {
  const looks = (front) => [
    { tag: 'Disabled', hi: '#ffffff', base: '#eeeeee', lo: '#cccccc', edge: '#999999', text: '#999999' },
    front
      ? { tag: '', hi: Y.hi, base: Y.base, lo: Y.lo, edge: OUTLINE, text: INK }
      : { tag: '', hi: '#eeeeee', base: '#cccccc', lo: '#999999', edge: OUTLINE, text: INK },
    front
      ? { tag: 'Pressed', hi: Y.base, base: Y.lo, lo: Y.deep, edge: OUTLINE, text: INK }
      : { tag: 'Pressed', hi: '#cccccc', base: '#999999', lo: '#666666', edge: OUTLINE, text: INK },
  ];
  for (const size of Object.values(TAB)) {
    for (const front of [false, true]) {
      looks(front).forEach((look, state) => {
        const id = size.base + state + (front ? 3 : 0);
        const { art, text } = tabFace(size, { ...look, front });
        const name = `${size.name} ${look.tag ? `${look.tag} ` : ''}${front ? 'Front' : 'Rear'} Tab`;
        add('cicn', id, encodeCicn(art), name);
        add('cinf', id, encodeCinf({
          cornerSize: size.c, sideThickness: size.s, tileSides: 0, patternAnchor: 0, bgPatternId: 0,
          bgPixel: { x: size.c, y: size.s + 2 }, textPixel: text, embossPixel: { x: 0, y: 0 },
        }), name);
      });
    }
    // Tab pane (classic only): text and background on different pixels.
    const paneBase = size.base + 6;
    for (const [off, tag, edge, text] of [[0, 'Inactive ', '#999999', '#999999'], [1, 'Active ', OUTLINE, INK]]) {
      const pane = new Raster(13, 13).fillRect(0, 0, 13, 13, BODY).strokeRect(0, 0, 13, 13, edge).set(6, 6, text);
      add('cicn', paneBase + off, encodeCicn(pane), `${size.name} ${tag}Tab Pane`);
      add('cinf', paneBase + off, encodeCinf({ cornerSize: 4, sideThickness: 4, bgPixel: { x: 4, y: 4 }, textPixel: { x: 6, y: 6 }, embossPixel: { x: 0, y: 0 } }), `${size.name} ${tag}Tab Pane`);
    }
  }
}

// ── 4. Finder list headers (-9568 inactive / -9567 active; 9-slice c = s = 2) ──
function header(h) {
  const r = new Raster(12, 12).fillRect(0, 0, 12, 12, h.bg);
  r.hline(0, 0, 11, h.hi).vline(11, 0, 11, h.divider).hline(0, 11, 12, h.bottom);
  r.set(5, 5, h.text);
  return r;
}
const headerCinf = () => encodeCinf({ cornerSize: 2, sideThickness: 2, tileSides: 0, patternAnchor: 0, bgPatternId: 0, bgPixel: { x: 3, y: 3 }, textPixel: { x: 5, y: 5 } });

// ── 5. Disclosure triangles (right -10112.., down -10104..; 12×12) ─────────
// The resting and open triangles are hand-placed; the three in-between
// animation frames are rotated, hard-edged (no blend).
const RIGHT = ['X...', 'XX..', 'XXX.', 'XXXX', 'XXX.', 'XX..', 'X...'];
const DOWN = ['XXXXXXX', '.XXXXX.', '..XXX..', '...X...'];
function disclosure(angleDeg, color) {
  const S = 12;
  if (angleDeg === 0) return new Raster(S, S).sprite(4, 2, RIGHT, { X: color });
  if (angleDeg === 90) return new Raster(S, S).sprite(2, 4, DOWN, { X: color });
  const th = (angleDeg * Math.PI) / 180, cos = Math.cos(th), sin = Math.sin(th);
  const tri = [[3.5, 0], [-2.5, -3.5], [-2.5, 3.5]].map(([x, y]) => [6 + x * cos - y * sin, 6 + x * sin + y * cos]);
  const inside = (px, py) => {
    const s = tri.map(([ax, ay], i) => { const [bx, by] = tri[(i + 1) % 3]; return (bx - ax) * (py - ay) - (by - ay) * (px - ax); });
    return s.every((v) => v >= 0) || s.every((v) => v <= 0);
  };
  return new Raster(S, S).paintCoverage(0, 0, S, S, inside, color);
}

// ── 6. Grow box (-14334 inactive / -14333 active; classic only on wnd# windows) ──
function growBox(active) {
  const look = active
    ? { o: OUTLINE, T: '#999999', t: '#666666', s: '#999999', U: '#ffffff', u: '#cccccc', a: '#333333' }
    : { o: '#999999', T: '#cccccc', t: '#cccccc', s: '#cccccc', U: '#ffffff', u: '#eeeeee', a: '#999999' };
  return new Raster(16, 16).sprite(0, 0, WHEEL, look);
}

function buildFinderBits(add) {
  add('cicn', -9568, encodeCicn(header({ bg: '#eeeeee', hi: '#ffffff', divider: '#cccccc', bottom: '#cccccc', text: '#999999' })), 'Inactive Finder Header');
  add('cinf', -9568, headerCinf(), 'Inactive Header');
  add('cicn', -9567, encodeCicn(header({ bg: '#eeeeee', hi: '#ffffff', divider: '#cccccc', bottom: OUTLINE, text: INK })), 'Finder Header');
  add('cinf', -9567, headerCinf(), 'Active Header');
  const families = [
    [-10112, 0, 'Right Pointing Disclosure Triangle', [22.5, 45, 67.5], 'Opening'],
    [-10104, 90, 'Down Pointing Disclosure Triangle', [67.5, 45, 22.5], 'Closing'],
  ];
  for (const [base, angle, name, frames, verb] of families) {
    add('cicn', base, encodeCicn(disclosure(angle, '#999999')), `Inactive ${name}`);
    add('cicn', base + 1, encodeCicn(disclosure(angle, OUTLINE)), name);
    add('cicn', base + 2, encodeCicn(disclosure(angle, R.base)), `Pressed ${name}`);
    frames.forEach((a, i) => add('cicn', base + 3 + i, encodeCicn(disclosure(a, OUTLINE)), `Disclosure Triangle ${verb} Frame ${['One', 'Two', 'Three'][i]}`));
  }
  add('cicn', -14334, encodeCicn(growBox(false)), 'Inactive Grow Box');
  add('cicn', -14333, encodeCicn(growBox(true)), 'Active Grow Box');
}

export function build(add) {
  buildProgress(add);
  buildSliders(add);
  buildTabs(add);
  buildFinderBits(add);
}
