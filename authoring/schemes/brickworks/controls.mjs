// Brickworks push buttons, default ring, checkboxes and radio buttons.
//
// Push faces (authoring guide §5 item 3): the engine copies the four
// cornerSize corners 1:1, stretches the sideThickness bands, and fills the
// middle with ONE colour read at bgPixel. So a button is a yellow brick whose
// top side band (4 rows) is transparent above a 1px outline, and each 6×6
// corner carries one stud standing up: a long 1×N plate with a stud at each
// end, at any width. Shading lives in the side bands (uniform along them).
import { Raster, encodeCicn, encodeCinf, mix } from '../../../tools/theme-author/index.js';
import { BRICK, BODY } from './palette.mjs';

const BTN = { size: 22, corner: 7, side: 5, bodyTop: 3 };

function pushFace(b, { text, outline }) {
  const { size, bodyTop } = BTN;
  const r = new Raster(size, size);
  const last = size - 1;
  // Body rows bodyTop..last: outline, gloss row, highlight, base, shade rows.
  const shade = (x, y) => {
    if (y === bodyTop + 1) return b.gloss;
    if (y === bodyTop + 2) return b.hi;
    if (y === last - 1) return b.deep;
    if (y === last - 2) return b.lo;
    if (x === 1) return b.hi;
    if (x === size - 2) return b.lo;
    return b.base;
  };
  r.fillRoundRectSmooth(0, bodyTop, size, size - bodyTop, 3, outline, { matte: BODY });
  r.fillRoundRectSmooth(1, bodyTop + 1, size - 2, size - bodyTop - 2, 2, shade);
  // One stud on each top corner (copied 1:1 with the corner).
  for (const sx of [2, size - 7]) {
    r.fillRect(sx, 0, 5, bodyTop + 1, outline);
    r.fillRect(sx + 1, 1, 3, bodyTop, b.hi).set(sx + 1, 1, b.gloss).set(sx + 3, bodyTop, b.lo);
    r.set(sx, 0, null).set(sx + 4, 0, null);
  }
  r.swatch(size - 1, 0, text); // hidden label colour on a pixel that stays transparent
  return r;
}

const pushCinf = () => encodeCinf({
  cornerSize: BTN.corner, sideThickness: BTN.side, tileSides: 0, patternAnchor: 0, bgPatternId: 0,
  bgPixel: { x: 11, y: 11 }, textPixel: { x: BTN.size - 1, y: 0 }, embossPixel: { x: 0, y: 0 },
});

// Default ring: drawn 4px outside the face, after it; its corners are copied
// 1:1, so everything inside the band is transparent. A chunky red band with a
// dark edge, square-ish like a brick outline.
function ringFace(band, edge) {
  const size = 30; // the face is 22, the ring sits 4px outside it
  return new Raster(size, size)
    .fillRoundRectSmooth(0, 0, size, size, 6, edge, { matte: BODY })
    .fillRoundRectSmooth(1, 1, size - 2, size - 2, 5, band)
    .fillRoundRect(3, 3, size - 6, size - 6, 4, null);
}
const ringCinf = () => encodeCinf({
  cornerSize: 9, sideThickness: 4, tileSides: 0, patternAnchor: 0, bgPatternId: 0,
  bgPixel: { x: 15, y: 15 }, textPixel: { x: 15, y: 15 }, embossPixel: { x: 0, y: 0 },
});

// Checkboxes and radios: id = -9504 + 12·kind + 3·value + tier.
// A checkbox is a square 1×1 tile; a radio a round 1×1 tile. Off: white tile.
// On: a red tile with a white mark (checkbox) or a white tile with a red stud
// (radio). Smooth outer edges blend with the window body (matte).
const CHECK = 14;
function checkable(kind, value, tier) {
  const on = value > 0, disabled = tier === 0, pressed = tier === 2;
  const red = BRICK.red, white = BRICK.white;
  const edge = disabled ? '#b9b6ae' : '#2a1f19';
  const fillOff = disabled ? '#efede7' : pressed ? '#d9d7ce' : white.base;
  const fillOn = disabled ? mix(red.base, '#d6d3cc', 0.65) : pressed ? red.lo : red.base;
  const radius = kind === 0 ? 2.5 : CHECK / 2;
  const fill = on && kind === 0 ? fillOn : fillOff;
  const r = new Raster(CHECK, CHECK)
    .fillRoundRectSmooth(0, 0, CHECK, CHECK, radius, edge, { matte: BODY })
    .fillRoundRectSmooth(1, 1, CHECK - 2, CHECK - 2, radius - 1, fill);
  // A plastic sheen along the top inside edge.
  if (!disabled) r.strokeLineSmooth(3.5, 2.6, CHECK - 3.5, 2.6, 0.9, on && kind === 0 ? red.hi : '#ffffff');
  if (!on) return r;
  const ink = disabled ? '#f3f1ec' : '#ffffff';
  if (kind === 1) {
    // A red stud seen from above, with a glint.
    r.fillCircleSmooth(7, 7, 3.6, disabled ? mix(red.seam, '#d6d3cc', 0.6) : red.seam);
    r.fillCircleSmooth(7, 7, 2.7, fillOn);
    if (!disabled) r.fillCircleSmooth(6, 6, 0.9, red.gloss);
    if (value === 2) r.strokeLineSmooth(5, 7, 9, 7, 1.4, ink);
    return r;
  }
  if (value === 2) return r.strokeLineSmooth(4, 7, 10, 7, 2, ink);
  return r.strokeLineSmooth(3.4, 7.2, 5.9, 9.9, 1.9, ink).strokeLineSmooth(5.9, 9.9, 10.7, 3.8, 1.9, ink);
}

export function build(add) {
  const Y = BRICK.yellow;
  const faces = [
    [-10240, 'Inactive Push Button', { base: '#e6e3db', gloss: '#f6f5f0', hi: '#efede7', lo: '#d3d0c8', deep: '#c4c1b9' }, { text: '#a19e96', outline: '#aaa69e' }],
    [-10239, 'Push Button', Y, { text: '#1c1a17', outline: '#3a2b00' }],
    [-10238, 'Pressed Push Button', { base: Y.lo, gloss: Y.base, hi: Y.lo, lo: Y.deep, deep: Y.seam }, { text: '#1c1a17', outline: '#3a2b00' }],
  ];
  for (const [id, name, b, look] of faces) {
    add('cicn', id, encodeCicn(pushFace(b, look)), name);
    add('cinf', id, pushCinf(), name);
  }
  add('cicn', -10232, encodeCicn(ringFace('#d0cdc5', '#9d9a92')), 'Inactive Default Ring');
  add('cinf', -10232, ringCinf(), 'Inactive Default Ring');
  add('cicn', -10231, encodeCicn(ringFace(BRICK.red.base, BRICK.red.seam)), 'Default Ring');
  add('cinf', -10231, ringCinf(), 'Default Ring');

  const kinds = ['Checkbox', 'Radio Button'], values = ['Off', 'On', 'Mixed'], tiers = ['Disabled', 'Normal', 'Pressed'];
  for (let kind = 0; kind < 2; kind++) for (let value = 0; value < 3; value++) for (let tier = 0; tier < 3; tier++) {
    add('cicn', -9504 + 12 * kind + 3 * value + tier, encodeCicn(checkable(kind, value, tier)), `${tiers[tier]} ${values[value]} ${kinds[kind]}`);
  }
}
