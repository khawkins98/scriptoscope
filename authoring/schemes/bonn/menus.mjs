// Bonn menus: the menu bar is the title bar's sandstone with its city rule
// (yellow over red) along the bottom; pull-down and pop-up menus are white
// panels with the dark sandstone outline; the selected title and item are the
// city red with cream text. Plus the application-menu grabber.
//
// The face model and ids are Kingfisher's (authoring/schemes/kingfisher/parts/menus.mjs
// documents both): corners copied 1:1, the edge bands repeat ONE middle
// column/row, the middle is one colour read at bgPixel. So nothing here can
// tile along the bar: the blossom branch the brief asks for on the menu bar
// isn't expressible, and the bar keeps the bar's rows instead.
import { Raster, encodeCicn, encodeCinf } from '../../../tools/theme-author/index.js';
import { C } from './palette.mjs';

const A = C.active;
const MENU_BAR = 20;
const BAR_C = MENU_BAR / 2;

/** Split a face drawn at 2c × 2c open by two middle rows and columns (Kingfisher's `opened`). */
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
  return encodeCinf({ cornerSize: c, sideThickness: s, tileSides: 0, patternAnchor: 0, bgPatternId: 0,
    bgPixel: { x: c, y: c }, textPixel: { x: c + 1, y: c }, embossPixel: { x: 0, y: 0 } });
}
const samples = (r, c, fill, text) => r.set(c, c, fill).set(c + 1, c, text).set(c, c + 1, fill).set(c + 1, c + 1, fill);

/** The bar's rows: lit, sandstone, then the city rule and the outline. */
function barRows(width, fill = A.stone, lit = A.stoneHi) {
  const r = new Raster(width, MENU_BAR).fillRect(0, 0, width, MENU_BAR, fill);
  r.hline(0, 0, width, lit);
  r.hline(0, MENU_BAR - 4, width, A.stoneLo).hline(0, MENU_BAR - 3, width, A.yellow).hline(0, MENU_BAR - 2, width, A.red).hline(0, MENU_BAR - 1, width, A.outline);
  return r;
}

const menuBarFace = () => samples(opened(barRows(2 * BAR_C), BAR_C), BAR_C, A.stone, A.outline);
const menuBarSelected = () => samples(opened(barRows(2 * BAR_C, A.red, A.red), BAR_C), BAR_C, A.red, A.title);

/** Application menu grabber, 6×20: three mortar notches on the bar. */
function grabber(pressed) {
  const r = barRows(6, pressed ? A.stoneLo : A.stone, pressed ? A.mortar : A.stoneHi);
  for (let y = 4; y <= 12; y += 4) r.set(2, y, A.mortar).set(3, y, A.mortar).set(3, y + 1, A.stoneHi);
  return r;
}

// Pull-down (square top, it hangs from the bar) and solo menus: a white panel
// with the outline, drawn 1px outside the items. Corners on a 1px cut.
const MENU_C = 4, MENU_S = 1;
function menuBackground(rounded) {
  const n = 2 * MENU_C;
  const art = new Raster(n, n).fillRect(0, 0, n, n, A.outline).fillRect(1, 1, n - 2, n - 2, C.body);
  // A 2px shade on the right and bottom edges inside the outline would stretch
  // with the bands; keep it to the outline and cut the rounded corners.
  for (const [x, y, top] of [[0, 0, true], [n - 1, 0, true], [0, n - 1, false], [n - 1, n - 1, false]]) {
    if (top && !rounded) continue;
    art.set(x, y, null);
  }
  return samples(opened(art, MENU_C), MENU_C, C.body, '#000000');
}

// Selected item: the city red across the item, a dark bottom row.
const ITEM_C = 6;
function menuSelected() {
  const n = 2 * ITEM_C;
  const art = new Raster(n, n).fillRect(0, 0, n, n, A.red).hline(0, n - 1, n, A.redLo);
  return samples(opened(art, ITEM_C), ITEM_C, A.red, A.title);
}

// Divider: a sandstone line with 4px margins.
const DIV_C = 6;
function divider() {
  const W = 2 * DIV_C + 2, r = new Raster(W, 2).fillRect(0, 0, W, 2, C.body);
  r.hline(4, 0, W - 8, A.stoneLo);
  return r;
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
