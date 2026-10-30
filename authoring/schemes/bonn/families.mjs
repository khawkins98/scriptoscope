// Bonn control families: sliders, tabs (+ tab panes), bevel buttons and popup
// button pieces. Geometry and every engine rule are Halcyon's
// (authoring/schemes/halcyon/parts/controls.mjs, notes per section below);
// the art is Bonn's and drawn on whole pixels: the slider track is a strip of
// the Rhine and its thumb a mooring bollard seen from above, tabs and bevel
// buttons are sandstone blocks (the selected tab carries the city rule, red
// over yellow), popups are sandstone with a red arrow glyph.
//
// How each piece is drawn decides how it may be painted. Anything the engine
// stretches from ONE source column or row, or fills with one sampled colour,
// must be flat along that axis. Pieces copied 1:1 (caps, thumbs, glyphs) may
// carry detail.
//
// Text fields are deliberately absent: the runtime draws fields with CSS.

import { Raster, encodeCicn, encodeCinf } from '../../../tools/theme-author/index.js';
import { C as P } from './palette.mjs';
import { roundRect, bevel } from './pixels.mjs';

const A = P.active;

// Family colours.
const K = () => ({
  track: {
    normal: { edge: A.outline, top: A.water, bottom: A.waterLo },
    pressed: { edge: A.outline, top: A.waterLo, bottom: A.waterLo },
    inactive: { edge: '#999999', top: '#dddddd', bottom: '#cccccc' },
  },
  knob: {
    normal: { edge: A.outline, hi: A.stoneHi, face: A.stone, lo: A.stoneLo, ring: A.mortar },
    pressed: { edge: A.outline, hi: A.mortar, face: A.stoneLo, lo: A.stone, ring: A.outline },
    inactive: { edge: '#999999', hi: '#ffffff', face: '#eeeeee', lo: '#dddddd', ring: null },
  },
  ghost: A.stoneLo,
  tick: { normal: A.mortar, inactive: '#cccccc' },
});

// ── helpers ────────────────────────────────────────────────────────────────

/** Swap x and y (horizontal art → vertical art). Hidden swatches survive. */
function transpose(src) {
  const out = new Raster(src.height, src.width);
  for (let y = 0; y < src.height; y++) for (let x = 0; x < src.width; x++) {
    const s = (y * src.width + x) * 4, d = (x * out.width + y) * 4;
    out.rgba.set(src.rgba.subarray(s, s + 4), d);
  }
  return out;
}

/** Mirror top↔bottom (a down-pointing thumb → an up-pointing one). */
function flipY(src) {
  const out = new Raster(src.width, src.height);
  for (let y = 0; y < src.height; y++) {
    out.rgba.set(src.rgba.subarray(y * src.width * 4, (y + 1) * src.width * 4), (src.height - 1 - y) * src.width * 4);
  }
  return out;
}

/** First transparent pixel in column 0 from row 1 down: a safe home for a hidden swatch. */
function hiddenPixel(r, x = 0) {
  for (let y = 1; y < r.height; y++) if (!r.get(x, y)) return { x, y };
  throw new Error(`controls: no transparent pixel in column ${x} for a hidden swatch`);
}

// Signed distances (negative inside) for the shapes below.
const sdRoundRect = (x0, y0, x1, y1, rad) => (px, py) => {
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const qx = Math.abs(px - cx) - ((x1 - x0) / 2 - rad), qy = Math.abs(py - cy) - ((y1 - y0) / 2 - rad);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - rad;
};
const sdCircle = (cx, cy, rad) => (px, py) => Math.hypot(px - cx, py - cy) - rad;
/** Convex polygon, points clockwise in screen space (y down). */
const sdPolygon = (pts) => (px, py) => {
  let d = -Infinity;
  for (let i = 0; i < pts.length; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % pts.length];
    const len = Math.hypot(bx - ax, by - ay);
    d = Math.max(d, ((px - ax) * (by - ay) - (py - ay) * (bx - ax)) / len);
  }
  return d;
};
const union = (...fs) => (px, py) => Math.min(...fs.map((f) => f(px, py)));

// ── 1. Sliders ─────────────────────────────────────────────────────────────
// docs/spec/engine/slider.md (CDEF 3), src/engine/tables/slider.ts.
//   base −10144 horizontal / −10128 vertical; group g = 0 points down/right,
//   1 up/left, 2 non-directional; gb = base + 6g.
//   gb+0/1/2 track cicn + same-id cinf (inactive / normal / pressed, TR3–TR4),
//   gb+3 thumb strip (TH1), gb+4/5 tick (inactive / normal, TK4; groups 0–1 only:
//   for group 2 those ids belong to other families).
// The control rect is erased to the window background first (O4, BG6: white),
// so every edge here blends with white (C.body).
//
// Track (§5.5): caps of k = cinf byte 0 copied 1:1, the middle is ONE source
// column (byte 2 = 0) stretched as per-row lines (BL4). So the middle column
// may vary down the track (an inset gradient) but never along it.
// Thumb (§5.2–5.3): 4 cells of 16 rows (horizontal) stacked: 0 inactive,
// 1 normal, 2 pressed, 3 ghost. Copied 1:1, masked, over the track, so its
// edge pixels are blended with what lies under them in that row.
// c = byte 0 of cinf gb also insets the thumb's travel (ID6, §5.2).
const SLIDER = { k: 2, trackH: 5, thumbW: 15, cell: 16, band: 16 };

/** The river strip: outline, river, river, deep, outline; rounded ends on a 1px cut. */
function trackArt(t) {
  const { k, trackH } = SLIDER, w = 2 * k + 1;
  return bevel(new Raster(w, trackH), 0, 0, w, trackH, roundRect(w, trackH, 2), { outline: t.edge, hi: null, lo: t.bottom, face: t.top });
}

/** Thumb masks for one 15×16 cell: the round bollard, or a pointer whose tip is at the bottom. */
function thumbMask(kind) {
  const { thumbW: w, cell: h } = SLIDER;
  if (kind === 'round') return (x, y) => (x + 0.5 - w / 2) ** 2 + (y + 0.5 - h / 2) ** 2 <= 6.6 ** 2;
  const sd = union(sdRoundRect(1, 1, w - 1, 11, 3), sdPolygon([[1.6, 8], [w - 1.6, 8], [w / 2, h - 0.6]]));
  return (x, y) => sd(x + 0.5, y + 0.5) <= 0;
}

function thumbCell(kind, cell, k) {
  const { thumbW: w, cell: h } = SLIDER;
  const mask = thumbMask(kind);
  const r = new Raster(w, h);
  if (cell === 3) {
    // Ghost (where the thumb is being dragged to): the outline alone, in the shade colour.
    return bevel(r, 0, 0, w, h, (x, y) => mask(x, y) && !(mask(x - 1, y) && mask(x + 1, y) && mask(x, y - 1) && mask(x, y + 1)), { outline: k.ghost, face: k.ghost });
  }
  const look = k.knob[cell === 0 ? 'inactive' : cell === 1 ? 'normal' : 'pressed'];
  bevel(r, 0, 0, w, h, mask, { outline: look.edge, hi: look.hi, lo: look.lo, face: look.face });
  if (look.ring) {
    // The bollard's head seen from above: a rope ring round a lit cap.
    const cx = 7, cy = kind === 'round' ? 7 : 5;
    r.sprite(cx - 2, cy - 2, ['.rrr.', 'rhhfr', 'rhffr', 'rfffr', '.rrr.'], { r: look.ring, h: look.hi, f: look.face });
  }
  return r;
}

/** The 15×64 thumb strip: cells 0–3 stacked (TH3). */
function thumbStrip(kind, k) {
  const strip = new Raster(SLIDER.thumbW, SLIDER.cell * 4);
  for (let cell = 0; cell < 4; cell++) strip.blit(thumbCell(kind, cell, k), 0, cell * SLIDER.cell);
  return strip;
}

// cinf: byte 0 = cap k (and the thumb inset c), byte 1 is never read by CDEF 3
// (CF2; corpus stores the cross size), byte 2 = 0 one middle column, byte 3 = 0 start-anchored.
const trackCinf = () => encodeCinf({ cornerSize: SLIDER.k, sideThickness: SLIDER.trackH, tileSides: 0, patternAnchor: 0 });

function buildSliders(add, k) {
  const tiers = [['inactive', 'Inactive '], ['normal', ''], ['pressed', 'Pressed ']];
  const groups = [
    { g: 0, h: 'Down Pointing', v: 'Right Pointing', kind: 'pointer', flip: false },
    { g: 1, h: 'Up Pointing', v: 'Left Pointing', kind: 'pointer', flip: true },
    { g: 2, h: 'Non-Directional Horizontal', v: 'Non-Directional Vertical', kind: 'round', flip: false },
  ];
  for (const [base, axis] of [[-10144, 'h'], [-10128, 'v']]) {
    const orient = (r) => (axis === 'v' ? transpose(r) : r);
    for (const grp of groups) {
      const gb = base + 6 * grp.g, label = grp[axis];
      tiers.forEach(([tier, prefix], t) => {
        add('cicn', gb + t, encodeCicn(orient(trackArt(k.track[tier]))), `${prefix}${label} Slider Track`);
        add('cinf', gb + t, trackCinf(), `${prefix}${label} Slider Track`);
      });
      const strip = thumbStrip(grp.kind, k);
      add('cicn', gb + 3, encodeCicn(orient(grp.flip ? flipCells(strip) : strip)), `${label} Slider Thumbs`);
      if (grp.g === 2) continue;
      // Ticks: drawn 1:1 below (group 0) / above (group 1) the band, centred on the thumb (§5.4).
      for (const [tier, prefix, off] of [['inactive', 'Inactive ', 4], ['normal', '', 5]]) {
        const tick = new Raster(1, 4).fillRect(0, 0, 1, 4, k.tick[tier]);
        add('cicn', gb + off, encodeCicn(orient(tick)), `${prefix}${label} Slider Tick`);
      }
    }
  }
}

/** Flip each 16-row cell on its own, so cell order (inactive, normal, pressed, ghost) is kept. */
function flipCells(strip) {
  const out = new Raster(strip.width, strip.height);
  for (let cell = 0; cell < 4; cell++) {
    const one = new Raster(strip.width, SLIDER.cell);
    one.rgba.set(strip.rgba.subarray(cell * SLIDER.cell * strip.width * 4, (cell + 1) * SLIDER.cell * strip.width * 4));
    out.blit(flipY(one), 0, cell * SLIDER.cell);
  }
  return out;
}

// ── 2. Tabs and tab panes ──────────────────────────────────────────────────
// docs/spec/engine/tab.md (CDEF 8), src/engine/families/tab.ts.
//   small (SSF) −9976 + state, large (LSF) −9984 + state; state 0 disabled,
//   1 normal, 2 pressed, +3 when the tab is the selected one (ST1–ST5, V1–V2).
//   Each needs a same-id cinf or nothing is painted (V3).
// Body (B1–B5): the left and right c columns are copied 1:1 at full height;
// the top and bottom s rows are ONE middle column repeated as lines (C1); the
// centre is one colour sampled at bgPixel. So the face is flat between rows s
// and H − s, and only the per-row colour of the middle column may vary.
// The web facade (§5) asks for −9975 / −9972 (small) first and picks a black or
// white label by the face's luminance; label size is round(0.42 × height),
// so both small tabs (21 / 22 px) land on 9 px and both large on 10 px.
// Bottoms stay open: the tab rests on the pane edge (CSS in the browser).
const TAB = {
  small: { base: -9976, c: 6, s: 6, rear: 21, front: 22, radius: 5, name: 'SSF' },
  large: { base: -9984, c: 7, s: 7, rear: 23, front: 24, radius: 6, name: 'LSF' },
};

function tabFace(size, look) {
  const { c } = size, w = 2 * c + 1, h = look.front ? size.front : size.rear;
  // A rounded-top block that runs off the bottom edge (open bottom).
  const mask = roundRect(w, h + 4, 4, 'tl tr');
  const r = bevel(new Raster(w, h), 0, 0, w, h + 4, mask, { outline: look.edge, hi: look.hi, lo: null, face: look.face });
  if (look.accent) {
    // The city rule inside the top edge: red, then yellow.
    for (let x = 1; x < w - 1; x++) {
      if (mask(x, 0) && r.get(x, 1)) r.set(x, 1, look.accent[0]);
      if (r.get(x, 2)) r.set(x, 2, look.accent[1]);
    }
    r.set(1, 2, look.edge).set(w - 2, 2, look.edge);
  }
  const t = hiddenPixel(r);
  r.swatch(t.x, t.y, look.text); // label colour for classic Kaleidoscope (C3)
  return { art: r, text: t };
}

function buildTabs(add) {
  const looks = (front) => [
    { tag: 'Disabled', face: '#eeeeee', hi: '#ffffff', edge: '#aaaaaa', accent: null, text: '#999999' },
    { tag: '', face: front ? A.stone : '#eeeeee', hi: front ? A.stoneHi : '#ffffff', edge: A.outline, accent: front ? [A.red, A.yellow] : null, text: A.outline },
    { tag: 'Pressed', face: A.stoneLo, hi: A.mortar, edge: A.outline, accent: front ? [A.redLo, A.yellow] : null, text: A.outline },
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
          bgPixel: { x: size.c, y: size.s }, textPixel: text, embossPixel: { x: 0, y: 0 },
        }), name);
      });
    }
    // Tab pane (the body the tabs sit on): classic Kaleidoscope only; the web
    // draws panels with CSS. 13×13, c 4, s 4. The label colour lives on a
    // middle pixel (the middle is filled from bgPixel, never copied), apart
    // from the fill sample, or the pane's labels vanish (they did once).
    const paneBase = size.base + 6;
    for (const [off, tag, edge, text] of [[0, 'Inactive ', '#999999', '#999999'], [1, 'Active ', A.outline, '#000000']]) {
      const pane = bevel(new Raster(13, 13), 0, 0, 13, 13, roundRect(13, 13, 3), { outline: edge, hi: null, lo: null, face: P.body }).set(6, 6, text);
      add('cicn', paneBase + off, encodeCicn(pane), `${size.name} ${tag}Tab Pane`);
      add('cinf', paneBase + off, encodeCinf({
        cornerSize: 4, sideThickness: 4, bgPixel: { x: 4, y: 4 }, textPixel: { x: 6, y: 6 }, embossPixel: { x: 0, y: 0 },
      }), `${size.name} ${tag}Tab Pane`);
    }
  }
}

// ── 3. Bevel buttons (small = the "small button bar" segments) ─────────────
// src/controls.ts composeBevelButton: id = −(base + value + state) with base
// 10171 small / 10162 normal (10153 large, corpus), value 0 on / 3 off, state
// 0 pressed / 1 normal / 2 disabled. Corpus 1990/evolution label the small set
// "SBB" (small button bar). Faces are drawn like push buttons
// (docs/spec/engine/push-button.md, engine/bevel.md BV01): c×c corners 1:1,
// 1px edges stretched, the middle one colour sampled at bgPixel, label colour
// at textPixel. So: a rounded outline round a flat fill.
const BEVEL = [
  { base: 10171, size: 16, radius: 3.5, name: 'Small' },
  { base: 10162, size: 20, radius: 4, name: 'Normal' },
  { base: 10153, size: 24, radius: 4.5, name: 'Large' },
];

function buildBevels(add) {
  // [value offset, state offset, label, face, hi, lo, edge, text]: "on" is a block pushed in.
  const states = [
    [0, 0, 'On Pressed', A.mortar, A.stoneLo, A.stone, A.outline, A.stoneHi],
    [0, 1, 'On', A.stoneLo, A.mortar, A.stone, A.outline, A.outline],
    [0, 2, 'On Disabled', '#dddddd', '#cccccc', '#eeeeee', '#999999', '#999999'],
    [3, 0, 'Off Pressed', A.stoneLo, A.mortar, A.stone, A.outline, A.outline],
    [3, 1, 'Off', A.stone, A.stoneHi, A.stoneLo, A.outline, A.outline],
    [3, 2, 'Off Disabled', '#eeeeee', '#ffffff', '#dddddd', '#999999', '#999999'],
  ];
  for (const b of BEVEL) {
    const c = Math.ceil(b.radius) + 1, mid = Math.floor(b.size / 2);
    for (const [value, state, tag, face, hi, lo, edge, text] of states) {
      const id = -(b.base + value + state);
      const r = bevel(new Raster(b.size, b.size), 0, 0, b.size, b.size, roundRect(b.size, b.size, 3), { outline: edge, hi, lo, face });
      const t = hiddenPixel(r);
      r.swatch(t.x, t.y, text);
      const name = `${b.name} Bevel Button ${tag}`;
      add('cicn', id, encodeCicn(r), name);
      add('cinf', id, encodeCinf({
        cornerSize: c, sideThickness: 2, tileSides: 0, patternAnchor: 0, bgPatternId: 0,
        bgPixel: { x: mid, y: mid }, textPixel: t, embossPixel: { x: 0, y: 0 },
      }), name);
    }
  }
}

// ── 4. Popup menu buttons ──────────────────────────────────────────────────
// Ids and geometry follow 1984, the corpus scheme whose popup resources are
// cleanly named (docs/archive/popup-menu-controls.md, docs/spec/kdef231-reference.md
// §2.4, cinf −8208 is a literal GetResource in kDEF 1.8.2,
// docs/spec/kdef182-disassembly-findings.md):
//   −8208/−8207/−8206 text section (disabled / normal / pressed), 14×16
//   −8205/−8204/−8203 arrow section, 14×16; −8202/−8201/−8200 arrow only, 16×16
//   −8199/−8198/−8197 large arrow glyph, −8196/−8195/−8194 small (inactive / active / pressed)
// The text section is open on the right and the arrow section open on the left,
// so the two butt together. NOT drawn by the web runtime (a <select> is drawn
// with the push-button face); this is for classic Kaleidoscope, and how 2.3.1
// composes these pieces is not decoded, so treat the layout as best-evidence.
const POPUP = { w: 14, h: 16, top: 2, bottom: 14, radius: 5 };

function popupPiece({ side, face, hi, lo, edge, text, width = POPUP.w }) {
  const { h, top, bottom } = POPUP;
  // side: 'text' (left end rounded, open right), 'arrow' (right end rounded, open left), 'both'.
  const ext = 6;
  const x0 = side === 'arrow' ? -ext : 2, x1 = side === 'text' ? width + ext : width - 2;
  const bw = x1 - x0, bh = bottom - top;
  const m = roundRect(bw, bh, 4);
  const r = new Raster(width, h);
  const full = new Raster(bw, bh);
  bevel(full, 0, 0, bw, bh, m, { outline: edge, hi, lo, face });
  for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) { const c = full.get(x, y); if (c) r.set(x + x0, y + top, c); }
  r.swatch(side === 'arrow' ? width - 1 : 0, 8, text);
  return r;
}

/** Up and down arrowheads on whole pixels, 5px wide (3px small), centred. */
function popupGlyph(w, h, ink) {
  const r = new Raster(w, h);
  const n = w >= 11 ? 3 : 2, cx = Math.floor(w / 2), cy = Math.floor(h / 2);
  for (let i = 0; i < n; i++) {
    r.fillRect(cx - i, cy - n + i - 1, 2 * i + 1, 1, ink);          // up: tip first
    r.fillRect(cx - (n - 1 - i), cy + 1 + i, 2 * (n - 1 - i) + 1, 1, ink);
  }
  return r;
}

function buildPopups(add) {
  const tiers = [
    { tag: 'Disabled', face: '#eeeeee', hi: '#ffffff', lo: '#dddddd', edge: '#999999', text: '#999999', box: '#eeeeee', boxHi: '#ffffff', boxLo: '#dddddd', glyph: '#bbbbbb' },
    { tag: 'Normal', face: A.stone, hi: A.stoneHi, lo: A.stoneLo, edge: A.outline, text: A.outline, box: A.stone, boxHi: A.stoneHi, boxLo: A.stoneLo, glyph: A.red },
    { tag: 'Pressed', face: A.stoneLo, hi: A.mortar, lo: A.stone, edge: A.outline, text: A.outline, box: A.stoneLo, boxHi: A.mortar, boxLo: A.stone, glyph: A.redLo },
  ];
  const cinf = (s, bg, t) => encodeCinf({ cornerSize: 6, sideThickness: s, tileSides: 0, patternAnchor: 0, bgPixel: bg, textPixel: t, embossPixel: { x: 0, y: 0 } });
  tiers.forEach((t, i) => {
    const textName = `${t.tag} Popup Button Text`, arrowName = `${t.tag} Popup Button Arrow`, onlyName = `${t.tag} Arrow Only Popup`;
    add('cicn', -8208 + i, encodeCicn(popupPiece({ side: 'text', face: t.face, hi: t.hi, lo: t.lo, edge: t.edge, text: t.text })), textName);
    add('cinf', -8208 + i, cinf(4, { x: 7, y: 8 }, { x: 0, y: 8 }), textName);
    add('cicn', -8205 + i, encodeCicn(popupPiece({ side: 'arrow', face: t.box, hi: t.boxHi, lo: t.boxLo, edge: t.edge, text: t.glyph })), arrowName);
    add('cinf', -8205 + i, cinf(6, { x: 5, y: 8 }, { x: 13, y: 8 }), arrowName);
    add('cicn', -8202 + i, encodeCicn(popupPiece({ side: 'both', face: t.box, hi: t.boxHi, lo: t.boxLo, edge: t.edge, text: t.glyph, width: 16 })), onlyName);
    add('cinf', -8202 + i, cinf(6, { x: 8, y: 8 }, { x: 0, y: 0 }), onlyName);
  });
  tiers.forEach((t, i) => {
    add('cicn', -8199 + i, encodeCicn(popupGlyph(11, 12, t.glyph)), `${['Inactive', 'Active', 'Pressed'][i]} Large Popup Arrow Glyph`);
    add('cicn', -8196 + i, encodeCicn(popupGlyph(9, 10, t.glyph)), `${['Inactive', 'Active', 'Pressed'][i]} Small Popup Arrow Glyph`);
  });
}

export function build(add) {
  const k = K();
  buildSliders(add, k);
  buildTabs(add);
  buildBevels(add);
  buildPopups(add);
}
