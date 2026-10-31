// Brickworks push buttons, default ring, checkboxes and radio buttons.
//
// Push faces (authoring guide §6.1): the engine copies the four
// cornerSize corners 1:1, stretches the sideThickness bands, and fills the
// middle with ONE colour read at bgPixel. So a button is a yellow brick whose
// top band is transparent above a 1px outline, and each 9×9 corner carries
// one 6px stud standing on it (the same stud sprite as the frames): a long
// brick with a stud at each end, at any width. Flat plastic: base face, one
// hi row on top, one lo column on the right, the warm outline.
import { Raster, encodeCicn, encodeCinf } from '../../../tools/theme-author/index.js';
import { BRICK, OUTLINE, INK } from './palette.mjs';
import { STUD_SMALL as STUD } from './sprites.mjs';

const BTN = { size: 24, corner: 9, side: 6, bodyTop: 4 };

function pushFace(b, { text, outline }) {
  const { size, bodyTop } = BTN;
  const r = new Raster(size, size);
  r.fillRect(0, bodyTop, size, size - bodyTop, b.base);
  r.hline(1, bodyTop + 1, size - 2, b.hi);
  r.vline(size - 2, bodyTop + 1, size - bodyTop - 2, b.lo);
  r.strokeRect(0, bodyTop, size, size - bodyTop, outline);
  for (const sx of [2, size - 8]) r.sprite(sx, 0, STUD, { o: outline, h: b.hi, b: b.base, d: b.lo });
  r.swatch(size - 1, 0, text); // hidden label colour on a pixel that stays transparent
  return r;
}

const pushCinf = () => encodeCinf({
  cornerSize: BTN.corner, sideThickness: BTN.side, tileSides: 0, patternAnchor: 0, bgPatternId: 0,
  bgPixel: { x: 12, y: 14 }, textPixel: { x: BTN.size - 1, y: 0 }, embossPixel: { x: 0, y: 0 },
});

// Default ring: drawn 4px outside the face, after it; its corners are copied
// 1:1, so everything inside the band is transparent. A red plate frame: an
// outline, 2px of red (lit on the top and left) and an outline.
function ringFace(band, hi, edge) {
  const size = 32; // the face is 24, the ring sits 4px outside it
  const r = new Raster(size, size);
  r.strokeRect(0, 0, size, size, edge).strokeRect(3, 3, size - 6, size - 6, edge);
  r.strokeRect(1, 1, size - 2, size - 2, band).strokeRect(2, 2, size - 4, size - 4, band);
  r.hline(1, 1, size - 2, hi).vline(1, 1, size - 2, hi);
  for (const [x, y] of [[0, 0], [size - 1, 0], [0, size - 1], [size - 1, size - 1]]) r.set(x, y, null);
  return r;
}
const ringCinf = () => encodeCinf({
  cornerSize: 9, sideThickness: 4, tileSides: 0, patternAnchor: 0, bgPatternId: 0,
  bgPixel: { x: 15, y: 15 }, textPixel: { x: 15, y: 15 }, embossPixel: { x: 0, y: 0 },
});

// Checkboxes and radios: id = -9504 + 12·kind + 3·value + tier.
// A checkbox is a white 1×1 plate seen from above; a radio a yellow round
// stud. On: a red pixel check, or a red stud in the middle of the radio.
const BOX = [
  '.oooooooooo.',
  'ohhhhhhhhhlo',
  'ohbbbbbbbblo',
  'ohbbbbbbbblo',
  'ohbbbbbbbblo',
  'ohbbbbbbbblo',
  'ohbbbbbbbblo',
  'ohbbbbbbbblo',
  'ohbbbbbbbblo',
  'ohbbbbbbbblo',
  'ollllllllllo',
  '.oooooooooo.',
];
const ROUND = [
  '....oooo....',
  '..oohhhhoo..',
  '.ohhbbbbbbo.',
  '.ohbbbbbbbo.',
  'ohbbbbbbbblo',
  'ohbbbbbbbblo',
  'obbbbbbbbblo',
  'obbbbbbbbblo',
  '.obbbbbbblo.',
  '.obbbbbbllo.',
  '..oolllloo..',
  '....oooo....',
];
const CHECK = ['......XX', '.....XX.', 'XX..XX..', '.XXXX...', '..XX....'];
const DOT = ['.XX.', 'XxXX', 'XXXX', '.XX.'];

function checkable(kind, value, tier) {
  const on = value > 0, disabled = tier === 0, pressed = tier === 2;
  const red = BRICK.red;
  const face = kind === 0
    ? (disabled ? { h: '#ffffff', b: '#eeeeee', l: '#eeeeee' } : pressed ? { h: '#cccccc', b: '#cccccc', l: '#eeeeee' } : { h: '#ffffff', b: '#eeeeee', l: '#cccccc' })
    : (disabled ? { h: '#eeeeee', b: '#cccccc', l: '#cccccc' } : pressed ? { h: BRICK.yellow.lo, b: BRICK.yellow.lo, l: BRICK.yellow.base } : { h: BRICK.yellow.hi, b: BRICK.yellow.base, l: BRICK.yellow.lo });
  const edge = disabled ? '#999999' : OUTLINE;
  const r = new Raster(12, 12).sprite(0, 0, kind === 0 ? BOX : ROUND, { o: edge, ...face });
  if (!on) return r;
  const ink = disabled ? '#cc9999' : red.base;
  if (value === 2) return r.fillRect(3, 5, 6, 2, ink); // mixed: a red bar
  if (kind === 0) return r.sprite(2, 3, CHECK, { X: ink });
  return r.sprite(4, 4, DOT, { X: ink, x: disabled ? ink : red.hi });
}

export function build(add) {
  const Y = BRICK.yellow;
  const faces = [
    [-10240, 'Inactive Push Button', { hi: '#ffffff', base: '#eeeeee', lo: '#cccccc' }, { text: '#999999', outline: '#999999' }],
    [-10239, 'Push Button', Y, { text: INK, outline: OUTLINE }],
    [-10238, 'Pressed Push Button', { hi: Y.base, base: Y.lo, lo: Y.deep }, { text: INK, outline: OUTLINE }],
  ];
  for (const [id, name, b, look] of faces) {
    add('cicn', id, encodeCicn(pushFace(b, look)), name);
    add('cinf', id, pushCinf(), name);
  }
  add('cicn', -10232, encodeCicn(ringFace('#cccccc', '#eeeeee', '#999999')), 'Inactive Default Ring');
  add('cinf', -10232, ringCinf(), 'Inactive Default Ring');
  add('cicn', -10231, encodeCicn(ringFace(BRICK.red.base, BRICK.red.hi, OUTLINE)), 'Default Ring');
  add('cinf', -10231, ringCinf(), 'Default Ring');

  const kinds = ['Checkbox', 'Radio Button'], values = ['Off', 'On', 'Mixed'], tiers = ['Disabled', 'Normal', 'Pressed'];
  for (let kind = 0; kind < 2; kind++) for (let value = 0; value < 3; value++) for (let tier = 0; tier < 3; tier++) {
    add('cicn', -9504 + 12 * kind + 3 * value + tier, encodeCicn(checkable(kind, value, tier)), `${tiers[tier]} ${values[value]} ${kinds[kind]}`);
  }
}
