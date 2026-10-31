// Midnight 2027 menus (classic Kaleidoscope; the web runtime doesn't draw
// menus) and the scheme's picker icon. Ids and the face model follow
// Halcyon's parts/menus.mjs via Castle's menus.mjs:
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
//   menu bar      the night bar: a lit top row, flat navy, a gold rule, white text
//   selected      a gold block with a shade row, navy text
//   menus         white in a navy rim, with a gold rail along the top
import { Raster, encodeCicn, encodeCinf } from '../../../tools/theme-author/index.js';
import { encodeIconFamily } from '../../../tools/theme-author/encode-icons.js';
import { schemeIcon } from './art.mjs';

const M = {
  barLit: '#003366', bar: '#000033', barShade: '#cc9933', barEdge: '#000022', barText: '#ffffff',
  body: '#ffffff', rim: '#000033', rail: '#ffcc33', railLit: '#ffffcc', text: '#000033',
  sel: '#ffcc33', selGold: '#cc9933', selText: '#000033', divider: '#cccccc',
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
  for (let y = 5; y <= 14; y += 3) r.set(2, y, pressed ? M.selText : '#336699').set(3, y + 1, pressed ? M.selText : '#ffcc33');
  return r;
}

// ── Pull-down and solo menus ─────────────────────────────────────────────
const MENU_C = 4, MENU_S = 2;
function menuBackground(rounded) {
  const n = 2 * MENU_C, art = new Raster(n, n).fillRect(0, 0, n, n, M.rim);
  art.fillRect(1, 1, n - 2, n - 2, M.body);
  // The gold rail along the top (pull-downs hang from the bar; solo menus too).
  art.hline(1, 1, n - 2, M.rail);
  if (rounded) for (const [x, y] of [[0, 0], [n - 1, 0], [0, n - 1], [n - 1, n - 1]]) art.set(x, y, null);
  else for (const [x, y] of [[0, n - 1], [n - 1, n - 1]]) art.set(x, y, null);
  return samples(opened(art, MENU_C), MENU_C, M.body, M.text);
}
const ITEM_C = 4;
function menuSelected() {
  const n = 2 * ITEM_C, art = new Raster(n, n).fillRect(0, 0, n, n, M.sel);
  art.hline(0, n - 1, n, M.selGold);
  return samples(opened(art, ITEM_C), ITEM_C, M.sel, M.selText);
}
const DIV_C = 6;
function divider() {
  const W = 2 * DIV_C + 2, r = new Raster(W, 2).fillRect(0, 0, W, 2, M.body);
  return r.hline(4, 0, W - 8, M.divider);
}
const dividerCinf = () => encodeCinf({ cornerSize: DIV_C, sideThickness: 1, tileSides: 0, patternAnchor: 0, bgPatternId: 0,
  bgPixel: { x: 0, y: 0 }, textPixel: { x: 0, y: 0 }, embossPixel: { x: 0, y: 0 } });

// ── Scheme icon: a firework over the night, drawn by art.mjs ─────────────
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

  for (const res of encodeIconFamily(-16455, { large: schemeIcon(32), small: schemeIcon(16), name: 'Kaleidoscope Scheme Icon', dither4: false })) {
    add(res.type, res.id, res.data, res.name);
  }
}
