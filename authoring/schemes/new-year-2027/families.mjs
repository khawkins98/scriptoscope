// Midnight 2027 sliders and tabs (+ tab panes). Re-themed from Castle's
// families.mjs (itself a re-theme of Halcyon's parts/controls.mjs); the
// engine geometry is unchanged:
//
//   slider track  a 5px navy rail with a gold top row
//   slider thumb  a gold marker pointing at the value, a navy star on it;
//                 a little clock face for non-directional sliders
//   tabs          navy plates with a gold top edge; the front tab is the
//                 lighter navy and opens into a white pane
import { Raster, encodeCicn, encodeCinf } from '../../../tools/theme-author/index.js';

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

/** Mirror top↔bottom. */
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
  throw new Error(`families: no transparent pixel in column ${x} for a hidden swatch`);
}

// ── 1. Sliders ─────────────────────────────────────────────────────────────
// docs/spec/engine/slider.md (CDEF 3), src/engine/tables/slider.ts.
//   base −10144 horizontal / −10128 vertical; group g = 0 points down/right,
//   1 up/left, 2 non-directional; gb = base + 6g.
//   gb+0/1/2 track cicn + same-id cinf (inactive / normal / pressed),
//   gb+3 thumb strip, gb+4/5 tick (inactive / normal; groups 0–1 only).
// Track: caps of k = cinf byte 0 copied 1:1, the middle is ONE source column
// stretched, so the rail may vary down (its rows) but never along it.
// Thumb: 4 cells of 16 rows stacked (0 inactive, 1 normal, 2 pressed,
// 3 ghost), copied 1:1, masked, over the track. Hard edges need no underlay:
// the mask is the shape. The web erases the control area to white first (R23).
const SLIDER = { k: 2, trackH: 5, thumbW: 15, cell: 16, band: 16 };

const RAIL = {
  normal: ['#000022', '#ffcc33', '#000033', '#000033', '#000022'],
  pressed: ['#000022', '#ffffcc', '#003366', '#003366', '#000022'],
  inactive: ['#666699', '#cccccc', '#9999cc', '#9999cc', '#666699'],
};

function trackArt(tier) {
  const { k, trackH } = SLIDER, w = 2 * k + 1;
  const rows = RAIL[tier];
  const r = new Raster(w, trackH);
  for (let y = 0; y < trackH; y++) r.hline(0, y, w, rows[y]);
  // Rounded rail ends: the outer corner pixels stepped off.
  for (const x of [0, w - 1]) { r.set(x, 0, null); r.set(x, trackH - 1, null); r.set(x, 1, rows[0]); r.set(x, trackH - 2, rows[0]); }
  return r;
}

// A 13×16 marker pointing down: straight for 8 rows, then a stepped point.
function shieldRows() {
  const span = (y) => (y < 8 ? [0, 12] : [[0, 12], [1, 11], [1, 11], [2, 10], [3, 9], [4, 8], [5, 7], [6, 6]][y - 8]);
  return Array.from({ length: 16 }, (_, y) => span(y));
}
const SLIDER_STAR = ['......#......', '.....###.....', '...#######...', '....#####....', '....##.##....'];

const SHIELD_LOOK = {
  inactive: { rim: '#666699', field: '#cccccc', lit: '#eeeeee', shade: '#aaaaaa', ink: null },
  normal: { rim: '#000022', field: '#ffcc33', lit: '#ffffcc', shade: '#cc9933', ink: '#000033' },
  pressed: { rim: '#000022', field: '#000033', lit: '#003366', shade: '#000022', ink: '#ffcc33' },
};

function shieldCell(cell) {
  const { thumbW: w, cell: h } = SLIDER;
  const r = new Raster(w, h);
  const rows = shieldRows();
  if (cell === 3) {
    // Ghost: the rim only, so the track shows through where the thumb will land.
    rows.forEach(([a, b], y) => {
      for (let x = a; x <= b; x++) {
        const edge = x === a || x === b || y === 0 || y === h - 1 || (rows[y + 1] && (x < rows[y + 1][0] || x > rows[y + 1][1]));
        if (edge) r.set(x + 1, y, '#ffcc33');
      }
    });
    return r;
  }
  const L = SHIELD_LOOK[['inactive', 'normal', 'pressed'][cell]];
  rows.forEach(([a, b], y) => {
    for (let x = a; x <= b; x++) {
      const below = rows[y + 1];
      const edge = x === a || x === b || y === 0 || !below || x < below[0] || x > below[1];
      let c = L.field;
      if (edge) c = L.rim;
      else if (y === 1 || x === a + 1) c = L.lit;
      else if (x === b - 1) c = L.shade;
      r.set(x + 1, y, c);
    }
  });
  if (L.ink) r.sprite(1, 3, SLIDER_STAR, { '#': L.ink });
  return r;
}

// A 13px gold disc for non-directional sliders: rim, lit crescent, navy centre.
function bossCell(cell) {
  const { thumbW: w, cell: h } = SLIDER;
  const r = new Raster(w, h);
  const cx = 7, cy = 8, R = 6.5;
  const inDisc = (x, y, rad) => (x - cx) ** 2 + (y - cy) ** 2 <= rad * rad;
  const L = cell === 3 ? null : SHIELD_LOOK[['inactive', 'normal', 'pressed'][cell]];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!inDisc(x, y, R)) continue;
    const edge = !inDisc(x - 1, y, R) || !inDisc(x + 1, y, R) || !inDisc(x, y - 1, R) || !inDisc(x, y + 1, R);
    if (!L) { if (edge) r.set(x, y, '#ffcc33'); continue; }
    let c = L.field;
    if (edge) c = L.rim;
    else if (!inDisc(x - 1, y - 1, R - 1)) c = L.lit;
    else if (!inDisc(x + 1, y + 1, R - 1)) c = L.shade;
    r.set(x, y, c);
  }
  if (L?.ink) r.fillRect(cx - 1, cy - 1, 3, 3, L.ink);
  return r;
}

function thumbStrip(kind, flip) {
  const strip = new Raster(SLIDER.thumbW, SLIDER.cell * 4);
  for (let cell = 0; cell < 4; cell++) {
    const one = kind === 'boss' ? bossCell(cell) : shieldCell(cell);
    strip.blit(flip ? flipY(one) : one, 0, cell * SLIDER.cell);
  }
  return strip;
}

// cinf: byte 0 = cap k (and the thumb inset), byte 2 = 0 one middle column, byte 3 = 0 start-anchored.
const trackCinf = () => encodeCinf({ cornerSize: SLIDER.k, sideThickness: SLIDER.trackH, tileSides: 0, patternAnchor: 0 });

function buildSliders(add) {
  const tiers = [['inactive', 'Inactive '], ['normal', ''], ['pressed', 'Pressed ']];
  const groups = [
    { g: 0, h: 'Down Pointing', v: 'Right Pointing', kind: 'shield', flip: false },
    { g: 1, h: 'Up Pointing', v: 'Left Pointing', kind: 'shield', flip: true },
    { g: 2, h: 'Non-Directional Horizontal', v: 'Non-Directional Vertical', kind: 'boss', flip: false },
  ];
  for (const [base, axis] of [[-10144, 'h'], [-10128, 'v']]) {
    const orient = (r) => (axis === 'v' ? transpose(r) : r);
    for (const grp of groups) {
      const gb = base + 6 * grp.g, label = grp[axis];
      tiers.forEach(([tier, prefix], t) => {
        add('cicn', gb + t, encodeCicn(orient(trackArt(tier))), `${prefix}${label} Slider Track`);
        add('cinf', gb + t, trackCinf(), `${prefix}${label} Slider Track`);
      });
      add('cicn', gb + 3, encodeCicn(orient(thumbStrip(grp.kind, grp.flip))), `${label} Slider Thumbs`);
      if (grp.g === 2) continue;
      for (const [color, prefix, off] of [['#9999cc', 'Inactive ', 4], ['#000033', '', 5]]) {
        add('cicn', gb + off, encodeCicn(orient(new Raster(1, 4).fillRect(0, 0, 1, 4, color))), `${prefix}${label} Slider Tick`);
      }
    }
  }
}

// ── 2. Tabs and tab panes ──────────────────────────────────────────────────
// docs/spec/engine/tab.md (CDEF 8): small −9976 + state, large −9984 + state;
// state 0 disabled, 1 normal, 2 pressed, +3 when selected. Each needs a
// same-id cinf. Body: the left and right c columns are copied 1:1 at full
// height; the top and bottom s rows are ONE middle column repeated; the
// centre is one colour sampled at bgPixel. So the plate's gold top row and
// shaded sides are fine, and the face between them is flat. The web picks a
// black or white label by the face's luminance: white on the navy faces,
// black on the pressed gold one.
const TAB = {
  small: { base: -9976, c: 6, s: 6, rear: 21, front: 22, name: 'SSF' },
  large: { base: -9984, c: 7, s: 7, rear: 23, front: 24, name: 'LSF' },
};

function plateTab(size, look) {
  const { c } = size, w = 2 * c + 1, h = look.front ? size.front : size.rear;
  const r = new Raster(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (y === 0 && (x === 0 || x === w - 1)) continue;            // stepped shoulders
    let col = look.face;
    if (x === 0 || x === w - 1 || y === 0) col = look.edge;
    else if (y === 1) col = x === w - 2 ? look.lo : look.hi;
    else if (x === 1) col = look.hi;
    else if (x === w - 2) col = look.lo;
    r.set(x, y, col);
  }
  // The rear tab sits behind the pane: its last row is the pane's edge.
  if (!look.front) r.hline(0, h - 1, w, look.edge);
  const t = { x: c, y: Math.floor(h / 2) + 1 };
  r.set(t.x, t.y, look.text); // the label colour (classic, C3): a middle pixel, never copied
  return { art: r, text: t };
}

function buildTabs(add) {
  const looks = (front) => [
    { tag: 'Disabled', face: '#9999cc', hi: '#cccccc', lo: '#666699', edge: '#666699', text: '#eeeeee' },
    { tag: '', face: front ? '#003366' : '#000033', hi: '#ffcc33', lo: '#000022', edge: '#000022', text: '#ffffff' },
    { tag: 'Pressed', face: '#ffcc33', hi: '#ffffcc', lo: '#996600', edge: '#000022', text: '#000033' },
  ];
  for (const size of Object.values(TAB)) {
    for (const front of [false, true]) {
      looks(front).forEach((look, state) => {
        const id = size.base + state + (front ? 3 : 0);
        const { art, text } = plateTab(size, { ...look, front });
        const name = `${size.name} ${look.tag ? `${look.tag} ` : ''}${front ? 'Front' : 'Rear'} Tab`;
        add('cicn', id, encodeCicn(art), name);
        add('cinf', id, encodeCinf({
          cornerSize: size.c, sideThickness: size.s, tileSides: 0, patternAnchor: 0, bgPatternId: 0,
          bgPixel: { x: size.c, y: size.s }, textPixel: text, embossPixel: { x: 0, y: 0 },
        }), name);
      });
    }
    // Tab pane (classic only; the web draws panels with CSS): a white panel
    // in a navy rim with a gold top rule. Labels sample (6,6), the fill (4,4) (corpus layout).
    const paneBase = size.base + 6;
    for (const [off, tag, edge, text, rule] of [[0, 'Inactive ', '#666699', '#666699', '#cccccc'], [1, 'Active ', '#000033', '#000033', '#ffcc33']]) {
      const pane = new Raster(13, 13).fillRect(1, 0, 11, 13, edge).fillRect(0, 1, 13, 11, edge)
        .fillRect(1, 1, 11, 11, '#ffffff').hline(1, 1, 11, rule).set(6, 6, text);
      add('cicn', paneBase + off, encodeCicn(pane), `${size.name} ${tag}Tab Pane`);
      add('cinf', paneBase + off, encodeCinf({
        cornerSize: 4, sideThickness: 4, bgPixel: { x: 4, y: 4 }, textPixel: { x: 6, y: 6 }, embossPixel: { x: 0, y: 0 },
      }), `${size.name} ${tag}Tab Pane`);
    }
  }
  void hiddenPixel;
}

export function build(add) {
  buildSliders(add);
  buildTabs(add);
}
