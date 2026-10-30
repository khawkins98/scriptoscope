// Bonn push buttons (sandstone blocks with a dark outline, a lit top row and a
// shaded bottom row; pressed sinks to the shade colour), the default ring
// (the city colours: red with a yellow inner line) and checkboxes / radio
// buttons (cream boxes, red marks). Every edge is whole pixels.
//
// Push faces (docs/authoring-a-scheme.md §5 item 3): the engine copies the four
// cornerSize corners 1:1, stretches the sideThickness bands, and fills the
// middle with ONE colour read at bgPixel. So shading may only live in the side
// bands (uniform along them) and the corners.
import { Raster, encodeCicn, encodeCinf } from '../../../tools/theme-author/index.js';
import { C } from './palette.mjs';
import { roundRect, disc, bevel } from './pixels.mjs';

const A = C.active;
const BTN = { size: 20, corner: 6, side: 2, radius: 4 };

const LOOKS = {
  inactive: { face: '#eeeeee', outline: '#999999', hi: '#ffffff', lo: '#dddddd', text: '#999999' },
  normal: { face: A.stone, outline: A.outline, hi: A.stoneHi, lo: A.stoneLo, text: A.outline },
  pressed: { face: A.stoneLo, outline: A.outline, hi: A.mortar, lo: A.stone, text: A.titleShadow },
};

function pushFace(look) {
  const { size, radius } = BTN;
  const r = bevel(new Raster(size, size), 0, 0, size, size, roundRect(size, size, radius), look);
  // Hidden swatch for the label colour, on a corner pixel that stays transparent.
  r.swatch(size - 1, 0, look.text);
  return r;
}

const pushCinf = () => encodeCinf({
  cornerSize: BTN.corner, sideThickness: BTN.side, tileSides: 0, patternAnchor: 0, bgPatternId: 0,
  bgPixel: { x: 10, y: 10 }, textPixel: { x: BTN.size - 1, y: 0 }, embossPixel: { x: 0, y: 0 },
});

// Default ring: drawn 4px outside the face, after it; corners copied 1:1, so
// everything inside the band must be transparent. From the outside in: dark
// red edge, red, the yellow inner line, a 1px gap. Its corner is concentric
// with the face's (radius 4 + 4).
function ringFace(outer, band, inner) {
  const size = 28, R = 8;
  const out = roundRect(size, size, R), hole = roundRect(size - 6, size - 6, R - 3);
  const gap = roundRect(size - 4, size - 4, R - 2), lineIn = roundRect(size - 2, size - 2, R - 1);
  const r = new Raster(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    if (!out(x, y)) continue;
    if (hole(x - 3, y - 3)) continue;
    let c = outer;
    if (gap(x - 2, y - 2)) c = inner;
    else if (lineIn(x - 1, y - 1)) c = band;
    r.set(x, y, c);
  }
  return r;
}
const ringCinf = () => encodeCinf({
  cornerSize: 10, sideThickness: 4, tileSides: 0, patternAnchor: 0, bgPatternId: 0,
  bgPixel: { x: 14, y: 14 }, textPixel: { x: 14, y: 14 }, embossPixel: { x: 0, y: 0 },
});

// Checkboxes and radios: id = -9504 + 12·kind + 3·value + tier.
const CHECK = 12;
const TICK = [
  '......#',
  '.....##',
  '#...##.',
  '##.##..',
  '.###...',
  '..#....',
];
const DOT = [
  '..yyy..',
  '.y###y.',
  'y#####y',
  'y#####y',
  'y#####y',
  '.y###y.',
  '..yyy..',
];
function checkable(kind, value, tier) {
  const on = value > 0, disabled = tier === 0, pressed = tier === 2;
  const outline = disabled ? '#999999' : A.outline;
  const face = disabled ? '#eeeeee' : pressed ? A.stone : A.stoneHi;
  const inset = disabled ? '#dddddd' : pressed ? A.stoneLo : A.stone;      // the box is set into the page: shade top-left
  const ink = disabled ? '#999999' : pressed ? A.redLo : A.red;
  const mask = kind === 0 ? roundRect(CHECK, CHECK, 2) : disc(CHECK);
  const r = bevel(new Raster(CHECK, CHECK), 0, 0, CHECK, CHECK, mask, { outline, hi: inset, lo: null, face });
  if (!on) return r;
  if (value === 2) return r.fillRect(3, 5, 6, 2, ink);
  if (kind === 1) return r.sprite(2, 2, DOT, { '#': ink, y: disabled ? face : A.yellow });
  return r.sprite(3, 3, TICK, { '#': ink });
}

export function build(add) {
  const faces = [
    [-10240, 'Inactive Push Button', LOOKS.inactive],
    [-10239, 'Push Button', LOOKS.normal],
    [-10238, 'Pressed Push Button', LOOKS.pressed],
  ];
  for (const [id, name, look] of faces) {
    add('cicn', id, encodeCicn(pushFace(look)), name);
    add('cinf', id, pushCinf(), name);
  }
  add('cicn', -10232, encodeCicn(ringFace('#888888', '#aaaaaa', '#dddddd')), 'Inactive Default Ring');
  add('cinf', -10232, ringCinf(), 'Inactive Default Ring');
  add('cicn', -10231, encodeCicn(ringFace(A.redLo, A.red, A.yellow)), 'Default Ring');
  add('cinf', -10231, ringCinf(), 'Default Ring');

  const kinds = ['Checkbox', 'Radio Button'], values = ['Off', 'On', 'Mixed'], tiers = ['Disabled', 'Normal', 'Pressed'];
  for (let kind = 0; kind < 2; kind++) for (let value = 0; value < 3; value++) for (let tier = 0; tier < 3; tier++) {
    add('cicn', -9504 + 12 * kind + 3 * value + tier, encodeCicn(checkable(kind, value, tier)), `${tiers[tier]} ${values[value]} ${kinds[kind]}`);
  }
}
