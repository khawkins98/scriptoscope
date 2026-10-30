// Halcyon control family: sliders, tabs (+ tab panes), bevel / small-button-bar
// buttons and popup menu buttons.
//
// How each piece is drawn decides how it may be painted (see the notes per
// section). In short: anything the engine stretches from ONE source column or
// row, or fills with one sampled colour, must be flat along that axis — no
// dither, no gradient across it. Everything is hard pixel art anyway, in the
// frames' style: 2-1 stair corners, slate outlines, the pebble as thumb.
//
// Text fields are deliberately absent: no corpus scheme ships edit-text art and
// the runtime draws fields with CSS (src/declarative/field.ts header comment);
// classic Kaleidoscope leaves them to the Appearance Manager.

import { Raster, encodeCicn, encodeCinf } from '../../../../tools/theme-author/index.js';

// Family colours, all from the shared palette (palette.mjs). Everything here
// is drawn on whole pixels with hard edges, like the frames: the slider groove
// is sunk water, its thumb is the grow box's river pebble.
const K = (C) => ({
  groove: {
    normal: { top: C.accentDeep, fill: C.water },
    pressed: { top: C.accentDeep, fill: C.water },
    inactive: { top: C.deep, fill: C.shade },
  },
  pebble: {
    normal: { rim: C.active.pebble.line, hi: C.white, face: C.glass, lo: C.shade },
    pressed: { rim: C.active.pebble.line, hi: C.glass, face: C.shade, lo: C.deep },
    inactive: { rim: C.shade, hi: C.glass, face: C.glass, lo: C.glass },
  },
  ghost: C.accent,
  tick: { normal: C.deep, inactive: C.shade },
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

// Signed distance to a rounded rectangle (negative inside), for the popup pieces.
const sdRoundRect = (x0, y0, x1, y1, rad) => (px, py) => {
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const qx = Math.abs(px - cx) - ((x1 - x0) / 2 - rad), qy = Math.abs(py - cy) - ((y1 - y0) / 2 - rad);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - rad;
};

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
const SLIDER = { k: 2, trackH: 4, thumbW: 15, cell: 16, band: 16 };

/** Groove: a 4px sunk channel of water, its top row the deep edge, ends cut square-round. */
function trackArt(t) {
  const { k, trackH } = SLIDER, w = 2 * k + 1;
  const r = new Raster(w, trackH).fillRect(0, 0, w, trackH, t.fill).hline(0, 0, w, t.top);
  return r.set(0, 0, null).set(w - 1, 0, null).set(0, trackH - 1, null).set(w - 1, trackH - 1, null)
    .set(0, 1, t.top).set(w - 1, 1, t.top);
}

// The pebble: the same 13px pixel disc as the title-bar widgets.
const DISC13 = [
  '....#####....', '..##.....##..', '.#.........#.', '.#.........#.', '#...........#', '#...........#',
  '#...........#', '#...........#', '#...........#', '.#.........#.', '.#.........#.', '..##.....##..', '....#####....',
];

/** One 15×16 thumb cell: the pebble, with a 3px point under it for directional sliders. */
function thumbCell(kind, cell, k) {
  const { thumbW: w, cell: h } = SLIDER;
  const out = new Raster(w, h);
  const tier = cell === 0 ? 'inactive' : cell === 1 ? 'normal' : 'pressed';
  const look = cell === 3 ? null : k.pebble[tier];
  const x0 = 1, y0 = kind === 'round' ? 1 : 0;
  for (let y = 0; y < 13; y++) {
    const row = DISC13[y], a = row.indexOf('#'), b = row.lastIndexOf('#');
    for (let x = a; x <= b; x++) {
      const rim = row[x] === '#';
      if (!look) { if (rim) out.set(x0 + x, y0 + y, k.ghost); continue; } // ghost: a teal ring, clear inside
      let c = look.face;
      if (rim) c = look.rim;
      else if ((DISC13[y - 1]?.[x] === '#' || row[x - 1] === '#') && x + y < 12) c = look.hi;
      else if ((DISC13[y + 1]?.[x] === '#' || row[x + 1] === '#') && x + y > 12) c = look.lo;
      out.set(x0 + x, y0 + y, c);
    }
  }
  if (kind === 'pointer') {
    const c = look ? look.rim : k.ghost;
    out.set(x0 + 5, 13, c).set(x0 + 6, 13, look ? look.lo : null).set(x0 + 7, 13, c).set(x0 + 6, 14, c);
    if (look) out.set(x0 + 6, 12, look.lo);
  }
  return out;
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
        add('cicn', gb + t, encodeCicn(orient(trackArt(k.groove[tier]))), `${prefix}${label} Slider Track`);
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
  // A square tab with 2-1 stair top corners; the bottom stays open (it rests on the pane).
  const r = new Raster(w, h).fillRect(0, 0, w, h, look.face);
  r.set(0, 0, null).set(1, 0, null).set(w - 1, 0, null).set(w - 2, 0, null).set(0, 1, null).set(w - 1, 1, null);
  const edge = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!r.get(x, y)) continue;
    const out = (px, py) => px < 0 || px >= w || py < 0 || (py < h && !r.get(px, py));
    if (out(x - 1, y) || out(x + 1, y) || out(x, y - 1)) edge.push([x, y]);
  }
  for (const [x, y] of edge) r.set(x, y, look.edge);
  // Light from the top left: the inner top row(s) carry the accent or the sheen.
  const band = look.accent ? [[1, look.accent], [2, look.accent]] : [[1, look.top]];
  for (const [y, col] of band) for (let x = 1; x < w - 1; x++) if (!edge.some(([ex, ey]) => ex === x && ey === y)) r.set(x, y, col);
  const t = hiddenPixel(r);
  r.swatch(t.x, t.y, look.text); // label colour for classic Kaleidoscope (C3)
  return { art: r, text: t };
}

function buildTabs(add, C) {
  // Front (selected) tab: white glass with a 2px teal top edge. Rear: #eeeeee
  // glass with a 1px #cccccc top row, so it reads as set back.
  const looks = (front) => [
    { tag: 'Disabled', face: front ? C.white : C.glass, edge: C.shade, accent: front ? C.shade : null, top: C.shade, text: C.textOff },
    { tag: '', face: front ? C.white : C.glass, edge: C.outline, accent: front ? C.accent : null, top: C.shade, text: C.text },
    { tag: 'Pressed', face: C.shade, edge: C.outline, accent: front ? C.accentDeep : null, top: C.deep, text: C.text },
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
    // runtime draws panels with CSS. Geometry as the corpus (13×13, c 4, s 4).
    // Ids: SSF −9970 inactive / −9969 active, LSF −9978 / −9977.
    const paneBase = size.base + 6;
    // The pane's middle is filled with the bgPixel colour and never copied, so
    // the label colour can live on a middle pixel too, as in the corpus
    // (1138: bg (4,4), text (6,6)). Sampling both from one pixel draws the
    // pane's labels in the background colour, which made them vanish in real
    // Kaleidoscope (its control panel puts group titles on a tab pane).
    for (const [off, tag, edge, text] of [[0, 'Inactive ', C.shade, C.textOff], [1, 'Active ', C.outline, C.text]]) {
      const pane = new Raster(13, 13).fillRect(0, 0, 13, 13, C.body);
      for (const [x, y] of [[0, 0], [1, 0], [0, 1], [12, 0], [11, 0], [12, 1], [0, 12], [1, 12], [0, 11], [12, 12], [11, 12], [12, 11]]) pane.set(x, y, null);
      pane.outlineEdges(0, 0, 13, 13, edge).set(6, 6, text);
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

function buildBevels(add, C) {
  // [value offset, state offset, label, face, edge, text]
  // On = the teal accent (the one place a bevel button spends it), off = white glass.
  const states = [
    [0, 0, 'On Pressed', C.accentDeep, C.outline, C.white],
    [0, 1, 'On', C.accent, C.outline, C.white],
    [0, 2, 'On Disabled', C.shade, C.deep, C.glass],
    [3, 0, 'Off Pressed', C.shade, C.outline, C.text],
    [3, 1, 'Off', C.white, C.outline, C.text],
    [3, 2, 'Off Disabled', C.glass, C.shade, C.textOff],
  ];
  for (const b of BEVEL) {
    const c = Math.ceil(b.radius) + 1, mid = Math.floor(b.size / 2);
    for (const [value, state, tag, face, edge, text] of states) {
      const id = -(b.base + value + state);
      const r = new Raster(b.size, b.size).fillRect(0, 0, b.size, b.size, face);
      for (const [x, y] of [[0, 0], [1, 0], [0, 1]]) {
        r.set(x, y, null).set(b.size - 1 - x, y, null).set(x, b.size - 1 - y, null).set(b.size - 1 - x, b.size - 1 - y, null);
      }
      r.outlineEdges(0, 0, b.size, b.size, edge);
      const t = hiddenPixel(r);
      r.swatch(t.x, t.y, text);
      const name = `${b.name} Bevel Button ${tag}`;
      add('cicn', id, encodeCicn(r), name);
      add('cinf', id, encodeCinf({
        cornerSize: c, sideThickness: 1, tileSides: 0, patternAnchor: 0, bgPatternId: 0,
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

function popupPiece({ side, face, edge, text, width = POPUP.w }) {
  const { h, top, bottom, radius } = POPUP;
  // side: 'text' (left end rounded), 'arrow' (right end rounded), 'both'.
  const x0 = side === 'arrow' ? -radius - 2 : 2, x1 = side === 'text' ? width + radius + 2 : width - 2;
  const r = new Raster(width, h)
    .paintCoverage(0, 0, width, h, (px, py) => sdRoundRect(x0, top, x1, bottom, radius)(px, py) <= 0, edge, { samples: 1 });
  r.paintCoverage(0, 0, width, h, (px, py) => sdRoundRect(x0, top, x1, bottom, radius)(px, py) <= -1, face, { samples: 1 });
  r.swatch(side === 'arrow' ? width - 1 : 0, 8, text);
  return r;
}

// Up and down pixel triangles (the corpus glyph shape), centred, on whole pixels.
const POPUP_GLYPHS = {
  large: ['...........', '.....#.....', '....###....', '...#####...', '..#######..', '...........',
    '...........', '..#######..', '...#####...', '....###....', '.....#.....', '...........'],
  small: ['.........', '....#....', '...###...', '..#####..', '.........', '.........',
    '..#####..', '...###...', '....#....', '.........'],
};
function popupGlyph(w, h, ink) {
  return new Raster(w, h).sprite(0, 0, POPUP_GLYPHS[w === 11 ? 'large' : 'small'], { '#': ink });
}

function buildPopups(add, C) {
  const tiers = [
    { tag: 'Disabled', face: C.glass, edge: C.shade, text: C.textOff, box: C.shade, boxEdge: C.deep, glyph: C.glass },
    { tag: 'Normal', face: C.white, edge: C.outline, text: C.text, box: C.accent, boxEdge: C.outline, glyph: C.white },
    { tag: 'Pressed', face: C.shade, edge: C.outline, text: C.text, box: C.accentDeep, boxEdge: C.outline, glyph: C.white },
  ];
  const cinf = (s, bg, t) => encodeCinf({ cornerSize: 6, sideThickness: s, tileSides: 0, patternAnchor: 0, bgPixel: bg, textPixel: t, embossPixel: { x: 0, y: 0 } });
  tiers.forEach((t, i) => {
    const textName = `${t.tag} Popup Button Text`, arrowName = `${t.tag} Popup Button Arrow`, onlyName = `${t.tag} Arrow Only Popup`;
    add('cicn', -8208 + i, encodeCicn(popupPiece({ side: 'text', face: t.face, edge: t.edge, text: t.text })), textName);
    add('cinf', -8208 + i, cinf(4, { x: 7, y: 8 }, { x: 0, y: 8 }), textName);
    add('cicn', -8205 + i, encodeCicn(popupPiece({ side: 'arrow', face: t.box, edge: t.boxEdge, text: t.glyph })), arrowName);
    add('cinf', -8205 + i, cinf(6, { x: 5, y: 8 }, { x: 13, y: 8 }), arrowName);
    add('cicn', -8202 + i, encodeCicn(popupPiece({ side: 'both', face: t.box, edge: t.boxEdge, text: t.glyph, width: 16 })), onlyName);
    add('cinf', -8202 + i, cinf(6, { x: 8, y: 8 }, { x: 0, y: 0 }), onlyName);
  });
  // Glyph ids run inactive, active, pressed (corpus labels), i.e. tiers 0, 1, 2.
  tiers.forEach((t, i) => {
    add('cicn', -8199 + i, encodeCicn(popupGlyph(11, 12, t.glyph)), `${['Inactive', 'Active', 'Pressed'][i]} Large Popup Arrow Glyph`);
    add('cicn', -8196 + i, encodeCicn(popupGlyph(9, 10, t.glyph)), `${['Inactive', 'Active', 'Pressed'][i]} Small Popup Arrow Glyph`);
  });
}

export function build(add, { C }) {
  const k = K(C);
  buildSliders(add, k);
  buildTabs(add, C);
  buildBevels(add, C);
  buildPopups(add, C);
}
