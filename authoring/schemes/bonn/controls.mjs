// Bonn push buttons (a cream enamel street-sign plate with a dark rim; pressed
// turns cherry-blossom pink), the default-button ring (a yellow band with a red
// edge: the city colours), and checkboxes / radio buttons (cream boxes, red
// marks).
//
// Push faces (docs/authoring-a-scheme.md §5 item 3): the engine copies the four
// cornerSize corners 1:1, stretches the sideThickness bands, and fills the
// middle with ONE colour read at bgPixel. So shading may only live in the side
// bands (uniform along them) and the corners.
import { Raster, encodeCicn, encodeCinf } from '../../../tools/theme-author/index.js';
import { C } from './palette.mjs';

const BTN = { size: 20, corner: 6, side: 2, radius: 5 };

const LOOKS = {
  inactive: { face: '#efe9df', edge: '#b9ada1', hi: '#f7f3ec', lo: '#ddd4c7', text: '#a99d91' },
  normal: { face: '#fbf1de', edge: '#3a2c26', hi: '#ffffff', lo: '#e2cca7', text: '#2a211d' },
  pressed: { face: '#f6c4d2', edge: '#7e1f3d', hi: '#e7a3b7', lo: '#fbd9e3', text: '#4a0f22' },
};

function pushFace(look) {
  const { size, radius } = BTN;
  const r = new Raster(size, size)
    .fillRoundRectSmooth(0, 0, size, size, radius, look.edge, { matte: C.body })
    .fillRoundRectSmooth(1, 1, size - 2, size - 2, radius - 1, look.face);
  // Bevel in the 2px side band: row/col 1 lit, the far row/col shaded.
  r.fillRect(4, 1, size - 8, 1, look.hi).fillRect(1, 4, 1, size - 8, look.hi);
  r.fillRect(4, size - 2, size - 8, 1, look.lo).fillRect(size - 2, 4, 1, size - 8, look.lo);
  // Hidden swatch for the label colour, on a corner pixel that stays transparent.
  r.swatch(size - 1, 0, look.text);
  return r;
}

const pushCinf = () => encodeCinf({
  cornerSize: BTN.corner, sideThickness: BTN.side, tileSides: 0, patternAnchor: 0, bgPatternId: 0,
  bgPixel: { x: 10, y: 10 }, textPixel: { x: BTN.size - 1, y: 0 }, embossPixel: { x: 0, y: 0 },
});

// Default ring: drawn 4px outside the face, after it; corners copied 1:1, so
// everything inside the band must be transparent. Its curve shares the face's
// corner centre (radius 5 + 4).
function ringFace(band, edge) {
  const size = 28;
  return new Raster(size, size)
    .fillRoundRectSmooth(0, 0, size, size, 9, edge, { matte: C.body })
    .fillRoundRectSmooth(1, 1, size - 2, size - 2, 8, band)
    .fillRoundRect(3, 3, size - 6, size - 6, 6, null);
}
const ringCinf = () => encodeCinf({
  cornerSize: 10, sideThickness: 4, tileSides: 0, patternAnchor: 0, bgPatternId: 0,
  bgPixel: { x: 14, y: 14 }, textPixel: { x: 14, y: 14 }, embossPixel: { x: 0, y: 0 },
});

// Checkboxes and radios: id = -9504 + 12·kind + 3·value + tier.
const CHECK = 14;
function checkable(kind, value, tier) {
  const on = value > 0, disabled = tier === 0, pressed = tier === 2;
  const edge = disabled ? '#b9ada1' : '#3a2c26';
  const fill = disabled ? '#f1ece4' : pressed ? '#f6c4d2' : '#fffaf0';
  const ink = disabled ? '#c9b7b3' : pressed ? C.redLo : C.red;
  const radius = kind === 0 ? 3 : CHECK / 2;
  const r = new Raster(CHECK, CHECK)
    .fillRoundRectSmooth(0, 0, CHECK, CHECK, radius, edge, { matte: C.body })
    .fillRoundRectSmooth(1, 1, CHECK - 2, CHECK - 2, radius - 1, fill);
  // A soft sandstone inner shadow along the top: the box is set into the page.
  if (!disabled) r.strokeLineSmooth(3.5, 2.5, CHECK - 3.5, 2.5, 0.8, pressed ? '#e7a3b7' : '#eadbc0');
  if (!on) return r;
  if (value === 2) return r.strokeLineSmooth(4, 7, 10, 7, 2.2, ink);
  if (kind === 1) {
    r.fillCircleSmooth(7, 7, 3.2, ink);
    return disabled ? r : r.fillCircleSmooth(6, 6, 1, C.yellow); // a yellow glint
  }
  return r.strokeLineSmooth(3.4, 7.2, 5.9, 10, 2, ink).strokeLineSmooth(5.9, 10, 10.8, 3.6, 2, ink);
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
  add('cicn', -10232, encodeCicn(ringFace('#e6dccb', '#b9ada1')), 'Inactive Default Ring');
  add('cinf', -10232, ringCinf(), 'Inactive Default Ring');
  add('cicn', -10231, encodeCicn(ringFace(C.yellow, C.redLo)), 'Default Ring');
  add('cinf', -10231, ringCinf(), 'Default Ring');

  const kinds = ['Checkbox', 'Radio Button'], values = ['Off', 'On', 'Mixed'], tiers = ['Disabled', 'Normal', 'Pressed'];
  for (let kind = 0; kind < 2; kind++) for (let value = 0; value < 3; value++) for (let tier = 0; tier < 3; tier++) {
    add('cicn', -9504 + 12 * kind + 3 * value + tier, encodeCicn(checkable(kind, value, tier)), `${tiers[tier]} ${values[value]} ${kinds[kind]}`);
  }
}
