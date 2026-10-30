// Brickworks extra control families: progress bar (+ indeterminate steps),
// sliders and tabs. Geometry, ids and cinf layouts are Halcyon's
// (authoring/schemes/halcyon/parts/progress.mjs and controls.mjs carry the
// engine notes and spec citations); only the art differs.
//
//   progress  a grey baseplate channel filled with a red brick (one colour
//             per row in the stretched middle column), and yellow/red
//             diagonal stripes for the indeterminate steps.
//   sliders   a grey channel; the thumb is a round yellow stud seen from
//             above (non-directional) or a stud with a point (directional).
//   tabs      brick-coloured tabs: rear tabs grey plastic, the front tab
//             yellow, with a stud standing on each top corner.
//   headers   Finder list headers: a white tile with a grey seam.
//   disclosure triangles in dark brick-outline brown, red when pressed.
//   grow box  a yellow 1×1 brick corner with a stud (classic only: the web
//             doesn't draw grow boxes on wnd# windows).
import { Raster, verticalGradient, mix, bayer, encodeCicn, encodeCinf, encodePpat } from '../../../tools/theme-author/index.js';
import { BRICK, BODY } from './palette.mjs';

const R = BRICK.red, Y = BRICK.yellow;

// ── 1. Progress bar (14 rows; frame c = s = 3; inner 8 rows) ──────────────
const BAR = { width: 8, height: 14, corner: 3, inner: 8, cap: 3 };
const LOOK = {
  active: { outline: '#2a1f19', troughShade: '#a9a69f', trough: '#c9c6bf', fill: R, stripeA: Y.base, stripeB: R.base },
  inactive: { outline: '#9d9a93', troughShade: '#cfccc5', trough: '#dad8d2', fill: { hi: '#dcd2cf', base: '#cfc3c0', lo: '#bfb3b0', gloss: '#e9e2e0' }, stripeA: '#e1ddd1', stripeB: '#d3cbc8' },
};

function progressFrame(p) {
  const { width: W, height: H, corner } = BAR;
  return new Raster(W, H)
    .fillRoundRectSmooth(0, 0, W, H, corner, p.outline, { matte: BODY })
    .fillRoundRectSmooth(1, 1, W - 2, H - 2, corner - 1, (_x, y) => (y === 1 ? p.troughShade : p.trough));
}

// The fill's middle column is stretched: one colour per row, no dither.
function progressFill(p) {
  const w = 2 * BAR.cap + 1, h = BAR.inner, f = p.fill;
  const row = (_x, y) => [f.gloss, f.hi, f.base, f.base, f.base, f.lo, f.lo, f.lo][y];
  return new Raster(w, h).fillRect(0, 0, w, h, p.trough).fillRoundRectSmooth(0, 0, w, h, 2, row);
}
const progressTrack = (p) => new Raster(3, BAR.inner).fillRect(0, 0, 3, BAR.inner, p.trough);
const frameCinf = () => encodeCinf({ cornerSize: BAR.corner, sideThickness: BAR.corner, tileSides: 1 });
const sliceCinf = (cap) => encodeCinf({ cornerSize: cap, sideThickness: 0, tileSides: 0, patternAnchor: 0 });

// Indeterminate: 45° stripes, period 16, rolled 2px per step for 8 steps, so
// step 7 → step 0 is the same move. ppats tile both ways, so the 4×4 dither
// sheen is fine (16 is a multiple of 4).
const STEPS = 8, PAT = 16;
function stripes(p) {
  const r = new Raster(PAT, PAT);
  for (let y = 0; y < PAT; y++) for (let x = 0; x < PAT; x++) {
    let a = 0;
    for (let sy = 0; sy < 4; sy++) for (let sx = 0; sx < 4; sx++) if ((x + (sx + 0.5) / 4 + y + (sy + 0.5) / 4) % PAT < PAT / 2) a++;
    const base = mix(p.stripeB, p.stripeA, a / 16);
    const t = (7 - (y % 8)) / 7;
    r.set(x, y, bayer(x, y) < 0.35 * t ? mix(base, '#ffffff', 0.25) : base);
  }
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
    add('cinf', base + 1, sliceCinf(BAR.cap), `${label}Progress Indicator Fill`);
    add('cicn', base + 2, encodeCicn(progressTrack(p)), `${label}Progress Indicator Track`);
    add('cinf', base + 2, sliceCinf(1), `${label}Progress Indicator Track`);
  }
  for (const [state, base, label] of [['active', -10080, ''], ['inactive', -10072, 'Inactive ']]) {
    const s0 = stripes(LOOK[state]);
    for (let k = 0; k < STEPS; k++) add('ppat', base + k, encodePpat(rolled(s0, (k * PAT) / STEPS)), `${label}Indeterminate Progress Step ${k + 1}`);
  }
}

// ── 2. Sliders (CDEF 3; Halcyon parts/controls.mjs §1 for the rules) ──────
// Track: caps of k copied 1:1, ONE middle column stretched (flat along it).
// Thumb strip: 4 cells of 16 rows (inactive, normal, pressed, ghost), copied
// 1:1 over the track, so each cell is painted on a copy of what lies under
// it (white body + track rows) and masked back to the thumb's silhouette.
const SLIDER = { k: 2, trackH: 5, thumbW: 15, cell: 16, band: 16 };
const TRACK_ROW0 = Math.trunc((SLIDER.band - SLIDER.trackH) / 2);
const TRACK = {
  inactive: { edge: '#b5b2ab', fill: '#e2e0da' },
  normal: { edge: '#2a1f19', fill: '#a9a69f' },
  pressed: { edge: '#2a1f19', fill: '#96938c' },
};
const KNOB = {
  inactive: { edge: '#b0ada6', face: '#ebe7da', hi: '#f6f3ea', lo: '#dcd7c8' },
  normal: { edge: Y.seam, face: Y.base, hi: Y.gloss, lo: Y.deep },
  pressed: { edge: Y.seam, face: Y.lo, hi: Y.base, lo: Y.seam },
};

function trackArt(t) {
  const { k, trackH } = SLIDER, w = 2 * k + 1;
  return new Raster(w, trackH)
    .fillRoundRectSmooth(0, 0, w, trackH, 2, t.edge, { matte: '#ffffff' })
    .fillRect(1, 1, w - 2, trackH - 2, (_x, y) => (y === 1 ? mix(t.fill, '#000000', 0.15) : t.fill));
}

function inThumb(kind, px, py) {
  const { thumbW: w, cell: h } = SLIDER;
  const cx = w / 2, cy = kind === 'round' ? h / 2 : 6.5;
  if (Math.hypot(px - cx, py - cy) <= 6.5) return true;
  if (kind !== 'pointer') return false;
  // A point down into the tick band: a triangle under the stud.
  const t = (py - cy) / (h - 0.5 - cy);
  return t >= 0 && t <= 1 && Math.abs(px - cx) <= 5.5 * (1 - t);
}

function thumbCell(kind, cell) {
  const { thumbW: w, cell: h } = SLIDER;
  const tier = ['inactive', 'normal', 'pressed', 'normal'][cell];
  const under = new Raster(w, h).fillRect(0, 0, w, h, '#ffffff');
  const track = trackArt(TRACK[tier]);
  for (let y = 0; y < track.height; y++) under.hline(0, TRACK_ROW0 + y, w, track.get(SLIDER.k, y));
  const touched = new Raster(w, h).paintCoverage(0, 0, w, h, (x, y) => inThumb(kind, x, y), '#000000', { matte: '#ffffff' });
  const out = new Raster(w, h);
  if (cell === 3) {
    // Ghost: a yellow outline ring; its inside stays clear so the track shows.
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (touched.get(x, y) && !inThumbInset(kind, x + 0.5, y + 0.5, 1.6)) out.set(x, y, Y.lo);
    }
    return out;
  }
  const k = KNOB[tier];
  const cx = w / 2, cy = kind === 'round' ? h / 2 : 6.5;
  under.paintCoverage(0, 0, w, h, (x, y) => inThumb(kind, x, y), k.edge);
  under.paintCoverage(0, 0, w, h, (x, y) => inThumbInset(kind, x, y, 1), verticalGradient(1, h - 2, [[0, k.hi], [0.5, k.face], [1, k.lo]]));
  // The stud's top ring, seen from above.
  under.paintCoverage(0, 0, w, h, (x, y) => { const d = Math.hypot(x - cx, y - cy); return d <= 3.8 && d >= 2.8; }, k.lo);
  if (tier !== 'inactive') under.fillCircleSmooth(cx - 1.5, cy - 1.6, 1, k.hi);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (touched.get(x, y)) out.set(x, y, under.get(x, y));
  return out;
}
function inThumbInset(kind, px, py, inset) {
  // Shrink the silhouette: a point is inside if every neighbour `inset` away is.
  return [[0, 0], [inset, 0], [-inset, 0], [0, inset], [0, -inset]].every(([dx, dy]) => inThumb(kind, px + dx, py + dy));
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
const STUD_ROWS = 3;

function tabFace(size, look) {
  const { c } = size, w = 2 * c + 1, h = look.front ? size.front : size.rear;
  const top = STUD_ROWS;
  const r = new Raster(w, h).fillRoundRectSmooth(0, top, w, h - top + 4, 3, look.edge, { matte: '#ffffff' });
  r.fillRoundRectSmooth(1, top + 1, w - 2, h - top + 2, 2, (x, y) => (y === top + 1 ? look.gloss : x === 1 ? look.hi : look.face));
  for (const sx of [2, w - 7]) {
    r.fillRect(sx, 0, 5, top + 1, look.edge);
    r.fillRect(sx + 1, 1, 3, top, look.hi).set(sx + 1, 1, look.gloss);
    r.set(sx, 0, null).set(sx + 4, 0, null);
  }
  // Hidden label colour on the first transparent pixel in column 0.
  let ty = 1;
  while (r.get(0, ty)) ty++;
  r.swatch(0, ty, look.text);
  return { art: r, text: { x: 0, y: ty } };
}

function buildTabs(add) {
  const G = BRICK.grey, W = BRICK.white;
  const looks = (front) => [
    { tag: 'Disabled', face: '#eeece6', gloss: '#f7f6f2', hi: '#f3f1ec', edge: '#bcb9b1', text: '#a19e96' },
    front
      ? { tag: '', face: Y.base, gloss: Y.gloss, hi: Y.hi, edge: Y.seam, text: '#1c1a17' }
      : { tag: '', face: W.lo, gloss: W.gloss, hi: W.base, edge: G.seam, text: '#1c1a17' },
    front
      ? { tag: 'Pressed', face: Y.lo, gloss: Y.base, hi: Y.lo, edge: Y.seam, text: '#1c1a17' }
      : { tag: 'Pressed', face: G.hi, gloss: W.lo, hi: G.hi, edge: G.seam, text: '#1c1a17' },
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
    for (const [off, tag, edge, text] of [[0, 'Inactive ', '#bcb9b1', '#a19e96'], [1, 'Active ', '#2a1f19', '#1c1a17']]) {
      const pane = new Raster(13, 13).fillRoundRectSmooth(0, 0, 13, 13, 3, edge, { matte: '#ffffff' })
        .fillRoundRectSmooth(1, 1, 11, 11, 2, BODY).set(6, 6, text);
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

// ── 5. Disclosure triangles (right -10112.., down -10104..; 12×12, Halcyon's layout) ──
function disclosure(angleDeg, color) {
  const S = 12, th = (angleDeg * Math.PI) / 180, cos = Math.cos(th), sin = Math.sin(th);
  const tri = [[3.4, 0], [-2.6, -4], [-2.6, 4]].map(([x, y]) => [x * cos - y * sin, x * sin + y * cos]);
  const mid = (i) => (Math.min(...tri.map((p) => p[i])) + Math.max(...tri.map((p) => p[i]))) / 2;
  const pts = tri.map(([x, y]) => [6 + x - mid(0), 6 + y - mid(1)]);
  const inside = (px, py) => {
    const s = pts.map(([ax, ay], i) => { const [bx, by] = pts[(i + 1) % 3]; return (bx - ax) * (py - ay) - (by - ay) * (px - ax); });
    return s.every((v) => v >= 0) || s.every((v) => v <= 0);
  };
  return new Raster(S, S).paintCoverage(0, 0, S, S, inside, color, { matte: BODY });
}

// ── 6. Grow box (-14334 inactive / -14333 active; classic only on wnd# windows) ──
function growBox(active) {
  const b = active ? Y : { base: '#e9e5d8', hi: '#f4f1e8', lo: '#d6d1c1', seam: '#aaa69e', gloss: '#f8f6ef' };
  const r = new Raster(16, 16).fillRect(0, 0, 16, 16, b.base);
  r.hline(0, 0, 16, active ? '#2a1f19' : b.seam).vline(0, 0, 16, active ? '#2a1f19' : b.seam);
  r.hline(1, 1, 15, b.gloss).vline(1, 1, 15, b.hi).hline(1, 15, 15, b.lo).vline(15, 1, 15, b.lo);
  r.fillCircleSmooth(8.5, 8.5, 3.6, b.seam).fillCircleSmooth(8.5, 8.5, 2.7, b.hi).fillCircleSmooth(7.6, 7.6, 0.9, b.gloss);
  return r;
}

function buildFinderBits(add) {
  add('cicn', -9568, encodeCicn(header({ bg: '#f2f1ec', hi: '#fbfaf7', divider: '#e2e0d9', bottom: '#d6d3cb', text: '#a19e96' })), 'Inactive Finder Header');
  add('cinf', -9568, headerCinf(), 'Inactive Header');
  add('cicn', -9567, encodeCicn(header({ bg: '#f6f5ef', hi: '#ffffff', divider: '#c9c6bf', bottom: '#2a1f19', text: '#1c1a17' })), 'Finder Header');
  add('cinf', -9567, headerCinf(), 'Active Header');
  const families = [
    [-10112, 0, 'Right Pointing Disclosure Triangle', [22.5, 45, 67.5], 'Opening'],
    [-10104, 90, 'Down Pointing Disclosure Triangle', [67.5, 45, 22.5], 'Closing'],
  ];
  for (const [base, angle, name, frames, verb] of families) {
    add('cicn', base, encodeCicn(disclosure(angle, '#bcb9b1')), `Inactive ${name}`);
    add('cicn', base + 1, encodeCicn(disclosure(angle, '#3a2b20')), name);
    add('cicn', base + 2, encodeCicn(disclosure(angle, R.base)), `Pressed ${name}`);
    frames.forEach((a, i) => add('cicn', base + 3 + i, encodeCicn(disclosure(a, '#3a2b20')), `Disclosure Triangle ${verb} Frame ${['One', 'Two', 'Three'][i]}`));
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
