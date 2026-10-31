// Castle menus (classic Kaleidoscope; the web runtime doesn't draw menus) and
// the scheme's picker icon. Ids and the face model follow Halcyon's
// parts/menus.mjs (corpus author labels, docs/spec/corpus-corroborated-ids.md):
//
//   cicn+cinf -12240 menu bar · -12239 menu bar item · -12238 selected title
//             -12237 pull-down background · -12236 selected item · -12235 divider
//             -12234 solo menu · -12233 selected solo item · -12232 solo divider
//   cicn      -12231 / -12230 application menu grabber, normal / pressed
//   ICN# icl8 icl4 ics# ics8 ics4  -16455  "Kaleidoscope Scheme Icon"
//
// Menu faces are cinf faces: c×c corners copied 1:1, the s-thick edge bands
// repeat their first middle column/row, the middle is ONE colour at bgPixel.
// So each face is drawn at its smallest size and split open by two middle
// rows and columns (`opened`), where the hidden samples live.
//
//   menu bar      one course of wall: a lit coping row, flat stone, a mortar
//                 line and a dark edge (a battlement can't repeat along a
//                 stretched band, so the merlons stay on the windows)
//   selected      a red banner block with a gold fringe row, parchment text
//   menus         parchment in a dark rim, with an oak rail along the top
import { Raster, encodeCicn, encodeCinf } from '../../../tools/theme-author/index.js';
import { encodeIconFamily } from '../../../tools/theme-author/encode-icons.js';

const M = {
  barLit: '#cccccc', bar: '#aaaaaa', barShade: '#888888', barEdge: '#333333', barText: '#333333',
  body: '#ffffcc', rim: '#333333', rail: '#996633', railLit: '#cc9966', text: '#333333',
  sel: '#990000', selGold: '#ffcc33', selText: '#ffffcc', divider: '#cccc99',
};
const MENU_BAR = 20;

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
function faceCinf(c, s) {
  return encodeCinf({ cornerSize: c, sideThickness: s, tileSides: 0, patternAnchor: 0, bgPatternId: 0, bgPixel: { x: c, y: c }, textPixel: { x: c + 1, y: c }, embossPixel: { x: 0, y: 0 } });
}
function samples(r, c, fill, text) {
  r.set(c, c, fill).set(c + 1, c, text).set(c, c + 1, fill).set(c + 1, c + 1, fill);
  return r;
}

// ── Menu bar ─────────────────────────────────────────────────────────────
const BAR_C = MENU_BAR / 2;
function barArt(width) {
  const r = new Raster(width, MENU_BAR).fillRect(0, 0, width, MENU_BAR, M.bar);
  r.hline(0, 0, width, M.barLit).hline(0, MENU_BAR - 2, width, M.barShade).hline(0, MENU_BAR - 1, width, M.barEdge);
  return r;
}
const menuBarFace = () => samples(opened(barArt(2 * BAR_C), BAR_C), BAR_C, M.bar, M.barText);
function menuBarSelected() {
  const r = barArt(2 * BAR_C);
  r.fillRect(0, 1, 2 * BAR_C, MENU_BAR - 3, M.sel).hline(0, MENU_BAR - 3, 2 * BAR_C, M.selGold);
  return samples(opened(r, BAR_C), BAR_C, M.sel, M.selText);
}
function grabber(pressed) {
  const r = barArt(6);
  if (pressed) r.fillRect(0, 1, 6, MENU_BAR - 3, M.sel);
  for (let y = 5; y <= 14; y += 3) r.set(2, y, pressed ? M.selGold : '#666666').set(3, y + 1, pressed ? M.selGold : M.barLit);
  return r;
}

// ── Pull-down and solo menus ─────────────────────────────────────────────
const MENU_C = 4, MENU_S = 2;
function menuBackground(rounded) {
  const n = 2 * MENU_C, art = new Raster(n, n).fillRect(0, 0, n, n, M.rim);
  art.fillRect(1, 1, n - 2, n - 2, M.body);
  // The oak rail along the top (pull-downs hang from the bar; solo menus too).
  art.hline(1, 1, n - 2, M.rail);
  if (rounded) for (const [x, y] of [[0, 0], [n - 1, 0], [0, n - 1], [n - 1, n - 1]]) art.set(x, y, null);
  else for (const [x, y] of [[0, n - 1], [n - 1, n - 1]]) art.set(x, y, null);
  return samples(opened(art, MENU_C), MENU_C, M.body, M.text);
}
const ITEM_C = 4;
function menuSelected() {
  const n = 2 * ITEM_C, art = new Raster(n, n).fillRect(0, 0, n, n, M.sel);
  art.hline(0, n - 1, n, '#660000');
  return samples(opened(art, ITEM_C), ITEM_C, M.sel, M.selText);
}
const DIV_C = 6;
function divider() {
  const W = 2 * DIV_C + 2, r = new Raster(W, 2).fillRect(0, 0, W, 2, M.body);
  return r.hline(4, 0, W - 8, M.divider);
}
const dividerCinf = () => encodeCinf({ cornerSize: DIV_C, sideThickness: 1, tileSides: 0, patternAnchor: 0, bgPatternId: 0,
  bgPixel: { x: 0, y: 0 }, textPixel: { x: 0, y: 0 }, embossPixel: { x: 0, y: 0 } });

// ── Scheme icon: a tower with a red roof and a pennant, hand-placed ──────
const ICON32 = [
  '................................',
  '...............kF...............',
  '...............kFFF.............',
  '...............kFFFFF...........',
  '...............kFF..............',
  '...............k................',
  '..............RR................',
  '.............RRRr...............',
  '............RRRRrr..............',
  '...........HRRRRrrr.............',
  '..........HRRRRRrrrr............',
  '.........HRRRRRRRrrrr...........',
  '........HRRRRRRRRRrrrr..........',
  '.......HRRRRRRRRRRRrrrrr........',
  '......HRRRRRRRRRRRRRrrrrr.......',
  '.....rrrrrrrrrrrrrrrrrrrrr......',
  '.......oLaaaaaaaaaaaass.o.......',
  '.......oLaaaaammaaaaass.o.......',
  '.......oLmmmmmmmmmmmmmm.o.......',
  '.......oLbbbbkkbbbbbbss.o.......',
  '.......oLbbbbkkbbbbbbss.o.......',
  '.......oLmmmmkkmmmmmmmm.o.......',
  '.......oLaaaakkaaamaass.o.......',
  '.......oLaaaaaaaaamaass.o.......',
  '.......oLmmmmmmmmmmmmmm.o.......',
  '.......oLbbbmbbbbbbbbss.o.......',
  '.......oLbbbmbbbkkkkbss.o.......',
  '.......oLmmmmmmmkkkkmmm.o.......',
  '.......oLaaaaaaakkkkass.o.......',
  '.......oLaaaaaaakkkkass.o.......',
  '.......oooooooooooooooooo.......',
  '................................',
];
export function icon32() {
  const rows = ICON32.map((row) => row.replace(/(\w)\.o/, '$1$1o')); // the drum's right wall
  return new Raster(32, 32).sprite(0, 0, rows, {
    k: '#333333', F: '#cc3333', R: '#993333', r: '#660000', H: '#cc6666',
    o: '#333333', L: '#cccccc', a: '#aaaaaa', b: '#999999', s: '#777777', m: '#666666',
  });
}
export function icon16() {
  const rows = [
    '................',
    '.......kFF......',
    '.......kF.......',
    '.......RR.......',
    '......RRRr......',
    '.....HRRRrr.....',
    '....HRRRRRrr....',
    '...rrrrrrrrrr...',
    '....oLaaaasso...',
    '....oLmmmmmmo...',
    '....oLbkkbbso...',
    '....oLbkkbbso...',
    '....oLmmmmmmo...',
    '....oLaaaasso...',
    '....oooooooo....',
    '................',
  ];
  return new Raster(16, 16).sprite(0, 0, rows, {
    k: '#333333', F: '#cc3333', R: '#993333', r: '#660000', H: '#cc6666',
    o: '#333333', L: '#cccccc', a: '#aaaaaa', b: '#999999', s: '#777777', m: '#666666',
  });
}

export function build(add) {
  const bar = menuBarFace();
  add('cicn', -12240, encodeCicn(bar), 'Menu Bar Background');
  add('cinf', -12240, faceCinf(BAR_C, BAR_C), 'Menu Bar Background');
  add('cicn', -12239, encodeCicn(bar), 'Menu Bar Item');
  add('cinf', -12239, faceCinf(BAR_C, BAR_C), 'Menu Bar Item');
  add('cicn', -12238, encodeCicn(menuBarSelected()), 'Selected Menu Bar Item');
  add('cinf', -12238, faceCinf(BAR_C, BAR_C), 'Selected Menu Bar Item');

  add('cicn', -12237, encodeCicn(menuBackground(false)), 'Pull Down Menu Background');
  add('cinf', -12237, faceCinf(MENU_C, MENU_S), 'Pull Down Menu Background');
  const selected = encodeCicn(menuSelected());
  add('cicn', -12236, selected, 'Selected Menu Item');
  add('cinf', -12236, faceCinf(ITEM_C, ITEM_C), 'Selected Menu Item');
  const div = encodeCicn(divider());
  add('cicn', -12235, div, 'Divider Line');
  add('cinf', -12235, dividerCinf(), 'Divider Line');

  add('cicn', -12234, encodeCicn(menuBackground(true)), 'Solo Menu Background');
  add('cinf', -12234, faceCinf(MENU_C, MENU_S), 'Solo Menu Background');
  add('cicn', -12233, selected, 'Selected Solo Menu Item');
  add('cinf', -12233, faceCinf(ITEM_C, ITEM_C), 'Selected Solo Menu Item');
  add('cicn', -12232, div, 'Solo Menu Divider Line');
  add('cinf', -12232, dividerCinf(), 'Solo Menu Divider Line');

  add('cicn', -12231, encodeCicn(grabber(false)), 'Application Menu Grabber');
  add('cicn', -12230, encodeCicn(grabber(true)), 'Pressed Application Menu Grabber');

  for (const res of encodeIconFamily(-16455, { large: icon32(), small: icon16(), name: 'Kaleidoscope Scheme Icon', dither4: false })) {
    add(res.type, res.id, res.data, res.name);
  }
}
