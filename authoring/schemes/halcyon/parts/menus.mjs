// Halcyon: menus, desktop and Finder colours, header colour tables, the
// scheme icon.
//
// Ids follow the corpus authors' own labels (docs/spec/corpus-corroborated-ids.md)
// and the Scheme Factory menu vocabulary (docs/spec/scheme-factory-vocabulary.md):
//
//   cicn+cinf -12240  menu bar background        -12239  menu bar item (title, normal)
//             -12238  selected menu bar item     -12237  pull-down menu background
//             -12236  selected pull-down item    -12235  pull-down divider line
//             -12234  solo (pop-up/context) menu -12233  selected solo item
//             -12232  solo divider line
//   cicn      -12231 / -12230  application menu grabber, normal / pressed (6×20)
//   ppat      17  desktop pattern                42  utility pattern (white)
//   cicn+cinf -9552…-9548  Finder colours: desktop label, icon view, list view,
//             sorted column, list divider (bgPixel = fill, textPixel = text)
//   clut      -14336 / -14335  active / inactive header (part-code entries 0–6)
//             300  slider and focus-ring colours (8-step ramp, light → dark)
//   ICN# icl8 icl4 ics# ics8 ics4  -16455  "Kaleidoscope Scheme Icon"
//
// How the menu faces are drawn (the same cinf face model as push buttons,
// docs/spec/control-face-geometry.md): the four c×c corners are copied 1:1,
// the s-thick edge bands repeat their FIRST middle column/row (tileSides 0), and
// the middle is filled with ONE colour read at bgPixel. So each face here is
// drawn at its smallest on-screen size and then split open by two middle
// rows and columns (`opened`), which is where the hidden samples live: the
// middle is always filled, never copied. Corpus evidence for the geometry
// (1138, BeOS, 1984): the menu background is drawn 1 px OUTSIDE the item
// rectangles (it carries the menu's frame), the selected-item face spans
// the item rectangle only, and the menu bar faces span the bar's full height.
// Nothing here is dithered: every face is stretched.

import { Raster, encodeCicn, encodeCinf, encodePpat } from '../../../../tools/theme-author/index.js';
import { encodeIconFamily } from '../../../../tools/theme-author/encode-icons.js';
import { encodeClut, encodeHeaderClut } from '../../../../tools/theme-author/encode-clut.js';
import { C, sys } from '../palette.mjs';

// Family colours (palette.mjs). The menu bar is the frosted bar with the
// branch as its one touch of the theme: a 1px olive line along its bottom.
const M = {
  bar: C.glass, barSheen: C.white, barLine: C.active.branch.mid, barText: C.text,
  menuBody: C.white, menuEdge: C.outline, menuText: C.text,
  divider: C.shade, grip: C.deep, gripLight: C.white,
};
const MENU_BAR = 20; // the System 7 / Mac OS 8 menu bar height

/**
 * Split a face drawn at its smallest size (2c × 2c) open by two middle rows
 * and columns, so the cinf's corners are the art's c×c corners and the edge
 * bands repeat the art's last corner column/row. Returns the (2c+2)² source.
 */
function opened(art, c) {
  const W = art.width + 2, H = art.height + 2;
  const from = (v) => (v < c ? v : v < c + 2 ? c - 1 : v - 2);
  const r = new Raster(W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (from(y) * art.width + from(x)) * 4;
    r.rgba.set(art.rgba.subarray(i, i + 4), (y * W + x) * 4);
  }
  return r;
}

/** A same-id cinf for an `opened` face: fill and text sampled in the middle. */
function faceCinf(c, s, { fill = { x: c, y: c }, text = { x: c + 1, y: c } } = {}) {
  return encodeCinf({ cornerSize: c, sideThickness: s, tileSides: 0, patternAnchor: 0, bgPatternId: 0, bgPixel: fill, textPixel: text, embossPixel: { x: 0, y: 0 } });
}

/** Write the middle samples (the middle is filled, never copied, so they never show). */
function samples(r, c, fill, text) {
  r.set(c, c, fill).set(c + 1, c, text).set(c, c + 1, fill).set(c + 1, c + 1, fill);
  return r;
}

// ── Menu bar ──────────────────────────────────────────────────────────────
// c = s = 10 on a 20 px bar: the whole bar is corners and top/bottom bands, so
// the sheen row and the olive line survive stretching to any width.
const BAR_C = MENU_BAR / 2;

function barArt(width) {
  const r = new Raster(width, MENU_BAR);
  r.fillRect(0, 0, width, MENU_BAR - 1, M.bar).hline(0, 0, width, M.barSheen);
  r.hline(0, MENU_BAR - 1, width, M.barLine);
  return r;
}

function menuBarFace() {
  return samples(opened(barArt(2 * BAR_C), BAR_C), BAR_C, M.bar, M.barText);
}

/** Selected menu title: an accent pill on the bar, white text. */
function menuBarSelected(fill, edge) {
  const r = barArt(2 * BAR_C);
  // A hard-edged teal plate across the bar's rows 1..18 (the olive line stays).
  void edge;
  r.fillRect(0, 1, 2 * BAR_C, MENU_BAR - 2, fill);
  return samples(opened(r, BAR_C), BAR_C, fill, '#ffffff');
}

/** Application menu grabber (Mac OS 8 application switcher), 6×20. */
function grabber(pressed) {
  const r = barArt(6);
  if (pressed) r.fillRect(0, 1, 6, MENU_BAR - 2, C.accent);
  for (let y = 5; y <= 14; y += 3) {
    r.set(2, y, pressed ? C.white : M.grip).set(3, y, pressed ? C.white : M.grip);
    r.set(3, y + 1, pressed ? C.accentDeep : M.gripLight);
  }
  return r;
}

// ── Pull-down and solo menus ──────────────────────────────────────────────
// The background face carries the 1 px frame (it is drawn 1 px outside the
// items). Pull-downs hang square from the bar and round their bottom corners;
// solo (pop-up / contextual) menus round all four.
const MENU_C = 4, MENU_S = 1;

function menuBackground(corners) {
  const n = 2 * MENU_C;
  const art = new Raster(n, n);
  // Hard edges throughout: a white panel, a 1px slate outline, 2-1 stair corners.
  art.fillRect(0, 0, n, n, M.menuBody);
  const cut = { tl: [0, 0, 1, 1], tr: [n - 1, 0, -1, 1], bl: [0, n - 1, 1, -1], br: [n - 1, n - 1, -1, -1] };
  for (const k of corners) { const [x, y, dx, dy] = cut[k]; art.set(x, y, null).set(x + dx, y, null).set(x, y + dy, null); }
  art.outlineEdges(0, 0, n, n, M.menuEdge);
  return samples(opened(art, MENU_C), MENU_C, M.menuBody, M.menuText);
}

// Selected item: an accent pill inside the item rectangle, on the menu body.
const ITEM_C = 6;
function menuSelected() {
  const n = 2 * ITEM_C;
  const art = new Raster(n, n).fillRect(0, 0, n, n, C.accent);
  return samples(opened(art, ITEM_C), ITEM_C, C.accent, '#ffffff');
}

// Divider: a hairline with 4 px margins, drawn at its own 2 px height.
const DIV_C = 6;
function divider() {
  const W = 2 * DIV_C + 2, r = new Raster(W, 2).fillRect(0, 0, W, 2, M.menuBody);
  r.hline(4, 0, W - 8, M.divider);
  return r;
}
const dividerCinf = () => encodeCinf({ cornerSize: DIV_C, sideThickness: 1, tileSides: 0, patternAnchor: 0, bgPatternId: 0,
  bgPixel: { x: 0, y: 0 }, textPixel: { x: 0, y: 0 }, embossPixel: { x: 0, y: 0 } });

// ── Desktop pattern ───────────────────────────────────────────────────────
// A quiet cool-grey linen. The three tones are colours of the standard 8-bit
// system palette, stored as-is (gamma: false), so a real 8 bpp Mac shows the
// same texture instead of rounding a subtle tint to one flat grey. In the
// browser they average a soft cool grey (~#e3e3e7). The ordered dither wraps
// at the 8 px tile, so the tile repeats seamlessly in both directions.
const BAYER8 = [
  [0, 32, 8, 40, 2, 34, 10, 42], [48, 16, 56, 24, 50, 18, 58, 26],
  [12, 44, 4, 36, 14, 46, 6, 38], [60, 28, 52, 20, 62, 30, 54, 22],
  [3, 35, 11, 43, 1, 33, 9, 41], [51, 19, 59, 27, 49, 17, 57, 25],
  [15, 47, 7, 39, 13, 45, 5, 37], [63, 31, 55, 23, 61, 29, 53, 21],
];
function desktopPattern() {
  const base = [221, 221, 221], cool = [204, 204, 255], light = [238, 238, 238];
  const r = new Raster(8, 8);
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    const t = BAYER8[y][x];
    r.set(x, y, t < 6 ? cool : t >= 56 ? light : base);
  }
  return r;
}

// ── Finder colours ────────────────────────────────────────────────────────
// 8×8 swatch cicns read by the cinf: fill at bgPixel (3,3), text at (1,1)
// (the Windows 95 scheme's layout). These alone do NOT enable the control
// panel's "Finder Colors" option on 7.5.5 (Apple Lisa ships all five and it
// stays greyed too); what does is not decoded yet.
function finderSwatch(fill, text) {
  return new Raster(8, 8).fillRect(0, 0, 8, 8, fill).set(1, 1, text);
}
const finderCinf = () => encodeCinf({ cornerSize: 0, sideThickness: 0, tileSides: 0, patternAnchor: 0, bgPatternId: 0,
  bgPixel: { x: 3, y: 3 }, textPixel: { x: 1, y: 1 }, embossPixel: { x: 0, y: 0 } });

// ── Scheme icon ───────────────────────────────────────────────────────────
// A little Halcyon window: the kingfisher on the branch rim, a glass bar, a
// white body and the water band. Hand-placed pixels in palette colours.
const ICON32 = [
  '................................',
  '....OOO.........................',
  '...OTTLO........................',
  '..OTTTTKOOOO....................',
  '..OWRRRRBBBBO...................',
  '..OTTTWWOOOO....................',
  '..OLDRRRO.......................',
  '..OLDRRrO.....................ll',
  '.OLDDrrO.....................lml',
  'nnnnnnFnFnnnnnnnnnnnnnnnnnnnnnnn',
  'gmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmm',
  'sssssssssssssssssssssssssssssssss',
  'sheeeeeeeeeeeeeeeeeeeeeeeeeeeecs',
  'sheeeeeeeeeeeeeeeeeeeeeeeeeeeecs',
  'sssssssssssssssssssssssssssssssss',
  'sw............................ws',
  'sw............................ws',
  'sw............................ws',
  'sw............................ws',
  'sw............................ws',
  'sw............................ws',
  'sw............................ws',
  'sw............................ws',
  'ssssssssssssssssssssssssssssssss',
  'sahaaaaaaaaaaaaaaaaaaaaaahhhaaas',
  'saaaaaaaaaaaahhhaaaaaaaaaaaaaaas',
  'sbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbs',
  'sbbbbbbbbbaaabbbbbbbbbbbbbbbbbbs',
  'sbbbbbbbbbbbbbbbbbbbbaabbbbbbbbs',
  '.ssssssssssssssssssssssssssssss.',
  '................................',
  '................................',
].map((row) => row.slice(0, 32).padEnd(32, '.'));

const ICON16 = [
  '..OO............',
  '.OTKBB..........',
  '.ORRO.........l.',
  'nnnFnnnnnnnnnnnn',
  'ssssssssssssssss',
  'seeeeeeeeeeeeecs',
  'ssssssssssssssss',
  'sw............ws',
  'sw............ws',
  'sw............ws',
  'sw............ws',
  'ssssssssssssssss',
  'sahaaaaaaaahaaas',
  'sbbbbbbabbbbbbbs',
  '.ssssssssssssss.',
  '................',
];

function schemeIcon(size) {
  const a = C.active, b = a.bird;
  const legend = {
    O: b.line, T: b.back, L: b.light, D: b.deep, K: b.eye, W: b.cheek, R: b.breast, r: b.breastLo, B: b.beak, F: b.feet,
    n: a.branch.line, g: a.branch.hi, m: a.branch.mid, l: a.leaf.mid,
    s: a.outline, h: C.white, e: a.face, c: a.shade, w: C.white,
    a: a.water.hi, b: a.water.lo,
  };
  // The body is white; the bar row 'e' / sheen 'h' / shade 'c'; 'h' in the water is foam.
  const rows = size === 32 ? ICON32 : ICON16;
  const r = new Raster(size, size).sprite(0, 0, rows, legend);
  // Body interior (between the 'w' columns) is white.
  for (let y = 0; y < size; y++) {
    const row = rows[y], i = row.indexOf('w'), j = row.lastIndexOf('w');
    if (i >= 0 && j > i) r.fillRect(i, y, j - i + 1, 1, C.white);
  }
  return r;
}

export function build(add, { C }) {
  // Menu bar and its titles.
  const bar = menuBarFace();
  add('cicn', -12240, encodeCicn(bar), 'Menu Bar Background');
  add('cinf', -12240, faceCinf(BAR_C, BAR_C), 'Menu Bar Background');
  add('cicn', -12239, encodeCicn(bar), 'Menu Bar Item');
  add('cinf', -12239, faceCinf(BAR_C, BAR_C), 'Menu Bar Item');
  add('cicn', -12238, encodeCicn(menuBarSelected(C.accent, C.accentPressed)), 'Selected Menu Bar Item');
  add('cinf', -12238, faceCinf(BAR_C, BAR_C), 'Selected Menu Bar Item');

  // Pull-down menus.
  add('cicn', -12237, encodeCicn(menuBackground(['bl', 'br'])), 'Pull Down Menu Background');
  add('cinf', -12237, faceCinf(MENU_C, MENU_S), 'Pull Down Menu Background');
  const selected = encodeCicn(menuSelected());
  add('cicn', -12236, selected, 'Selected Menu Item');
  add('cinf', -12236, faceCinf(ITEM_C, ITEM_C), 'Selected Menu Item');
  const div = encodeCicn(divider());
  add('cicn', -12235, div, 'Divider Line');
  add('cinf', -12235, dividerCinf(), 'Divider Line');

  // Solo (pop-up / contextual) menus.
  add('cicn', -12234, encodeCicn(menuBackground(['tl', 'tr', 'bl', 'br'])), 'Solo Menu Background');
  add('cinf', -12234, faceCinf(MENU_C, MENU_S), 'Solo Menu Background');
  add('cicn', -12233, selected, 'Selected Solo Menu Item');
  add('cinf', -12233, faceCinf(ITEM_C, ITEM_C), 'Selected Solo Menu Item');
  add('cicn', -12232, div, 'Solo Menu Divider Line');
  add('cinf', -12232, dividerCinf(), 'Solo Menu Divider Line');

  add('cicn', -12231, encodeCicn(grabber(false)), 'Application Menu Grabber');
  add('cicn', -12230, encodeCicn(grabber(true)), 'Pressed Application Menu Grabber');

  // Patterns.
  add('ppat', 17, encodePpat(desktopPattern(), { gamma: false }), 'Desktop Pattern');
  add('ppat', 42, encodePpat(new Raster(8, 8).fillRect(0, 0, 8, 8, C.body)), 'Utility Pattern');

  // Finder colours.
  const finder = [
    [-9552, 'Desktop Text Color And Background', C.white, C.text],
    [-9551, 'Icon View Background', C.body, C.text],
    [-9550, 'List View Background', C.body, C.text],
    [-9549, 'List View Sort Color', C.glass, C.text],
    [-9548, 'List View Divider Line', C.shade, C.text],
  ];
  for (const [id, name, fill, text] of finder) {
    add('cicn', id, encodeCicn(finderSwatch(fill, text)), name);
    add('cinf', id, finderCinf(), name);
  }

  // Header colour tables (part codes: frame, fill, text, tinges, bevels).
  const A = C.active, I = C.inactive;
  add('clut', -14336, encodeHeaderClut({ frame: A.outline, fill: A.face, text: A.title, lightTinge: A.sheen, darkTinge: A.shade, lightBevel: C.white, darkBevel: A.shade }), 'Active Header');
  add('clut', -14335, encodeHeaderClut({ frame: I.outline, fill: I.face, text: I.title, lightTinge: I.sheen, darkTinge: I.shade, lightBevel: C.white, darkBevel: I.shade }), 'Inactive Header');
  const ramp = [sys('#ccffff'), sys('#99ffff'), C.accentLight, sys('#33ccff'), C.accent, C.accentDeep, sys('#003399'), sys('#003366')];
  add('clut', 300, encodeClut(ramp.map((color, value) => ({ value, color }))), 'Slider & Focus Ring Colors');

  // The icon Kaleidoscope's scheme picker shows.
  for (const res of encodeIconFamily(-16455, { large: schemeIcon(32), small: schemeIcon(16), name: 'Kaleidoscope Scheme Icon', dither4: false })) {
    add(res.type, res.id, res.data, res.name);
  }
}
