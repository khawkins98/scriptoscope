// Brickworks menus (classic Kaleidoscope only; the web runtime doesn't draw
// menus). Ids and the face model follow Castle's menus.mjs and Kingfisher's
// parts/menus.mjs (corpus author labels, docs/spec/corpus-corroborated-ids.md):
//
//   cicn+cinf -12240 menu bar · -12239 menu bar item · -12238 selected title
//             -12237 pull-down background · -12236 selected item · -12235 divider
//             -12234 solo menu · -12233 selected solo item · -12232 solo divider
//   cicn      -12231 / -12230 application menu grabber, normal / pressed
//
// Menu faces are cinf faces: c×c corners copied 1:1, the s-thick edge bands
// repeat their first middle column/row, the middle is ONE colour at bgPixel.
// So each face is drawn at its smallest size and split open by two middle
// rows and columns (`opened`), where the hidden samples live. Studs can't
// repeat along a stretched band, so the bar is a plain plate: what makes it
// a brick is the four-step plastic shading (palette.mjs) and the outline.
//
//   menu bar      a yellow plate: lit top row, face, a shaded row and the
//                 warm near-black outline along the bottom
//   selected      a red brick (white text): titles in the bar and menu items
//   menus         a white tile in the outline, rounded 1px at the corners
//   divider       a grey groove between two light rows
//   grabber       two little studs on the yellow plate (red when pressed)
import { Raster, encodeCicn, encodeCinf } from '../../../tools/theme-author/index.js';
import { BRICK, OUTLINE, INK } from './palette.mjs';

const Y = BRICK.yellow, R = BRICK.red, W = BRICK.white;
const MENU_BAR = 20;

function opened(art, c) {
  const Wd = art.width + 2, H = art.height + 2;
  const from = (v) => (v < c ? v : v < c + 2 ? c - 1 : v - 2);
  const r = new Raster(Wd, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < Wd; x++) {
    const i = (from(y) * art.width + from(x)) * 4;
    r.rgba.set(art.rgba.subarray(i, i + 4), (y * Wd + x) * 4);
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
function plate(width, brick) {
  const r = new Raster(width, MENU_BAR).fillRect(0, 0, width, MENU_BAR, brick.base);
  return r.hline(0, 0, width, brick.hi).hline(0, MENU_BAR - 2, width, brick.lo).hline(0, MENU_BAR - 1, width, OUTLINE);
}
const menuBarFace = () => samples(opened(plate(2 * BAR_C, Y), BAR_C), BAR_C, Y.base, INK);
const menuBarSelected = () => samples(opened(plate(2 * BAR_C, R), BAR_C), BAR_C, R.base, '#ffffff');

/** 6×20: two studs, each a lit upper-left arc and a shaded lower-right one. */
function grabber(pressed) {
  const b = pressed ? R : Y, r = plate(6, b);
  for (const y of [4, 10]) r.sprite(1, y, ['.hh.', 'hbbl', 'hbbl', '.ll.'], { h: b.hi, b: b.base, l: b.deep });
  return r;
}

// ── Pull-down and solo menus ─────────────────────────────────────────────
const MENU_C = 4, MENU_S = 1;
function menuBackground(rounded) {
  const n = 2 * MENU_C, art = new Raster(n, n).fillRect(0, 0, n, n, OUTLINE).fillRect(1, 1, n - 2, n - 2, '#ffffff');
  for (const [x, y, top] of [[0, 0, true], [n - 1, 0, true], [0, n - 1, false], [n - 1, n - 1, false]]) {
    if (top && !rounded) continue; // a pull-down hangs square from the bar
    art.set(x, y, null);
  }
  return samples(opened(art, MENU_C), MENU_C, '#ffffff', INK);
}
const ITEM_C = 4;
function menuSelected() {
  const n = 2 * ITEM_C, art = new Raster(n, n).fillRect(0, 0, n, n, R.base);
  art.hline(0, 0, n, R.hi).hline(0, n - 1, n, R.lo);
  return samples(opened(art, ITEM_C), ITEM_C, R.base, '#ffffff');
}
const DIV_C = 6;
function divider() {
  const Wd = 2 * DIV_C + 2, r = new Raster(Wd, 2).fillRect(0, 0, Wd, 2, '#ffffff');
  return r.hline(3, 0, Wd - 6, W.deep).hline(3, 1, Wd - 6, W.hi);
}
const dividerCinf = () => encodeCinf({ cornerSize: DIV_C, sideThickness: 1, tileSides: 0, patternAnchor: 0, bgPatternId: 0,
  bgPixel: { x: 0, y: 0 }, textPixel: { x: 0, y: 0 }, embossPixel: { x: 0, y: 0 } });

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
}
