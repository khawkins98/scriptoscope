// Castle push buttons (oak planks with iron corner studs), the default-button
// ring (a brass band), and checkboxes / radio buttons (parchment in iron).
//
// Push faces (docs/authoring-a-scheme.md §5 item 3): the engine copies the four
// cornerSize corners 1:1, stretches the sideThickness bands, and fills the middle
// with ONE colour read at bgPixel. So the plank grain can only live in the side
// bands (uniform along them) and the corner studs live in the corners.
import { Raster, encodeCicn, encodeCinf } from '../../../tools/theme-author/index.js';
import { C } from './palette.mjs';

const BTN = { size: 20, corner: 6, side: 2, radius: 4 };
const W = C.wood;

function pushFace(look) {
  const { size, radius } = BTN;
  const r = new Raster(size, size)
    .fillRoundRectSmooth(0, 0, size, size, radius, look.edge, { matte: C.body })
    .fillRoundRectSmooth(1, 1, size - 2, size - 2, radius - 1, look.face);
  // Bevel bands (inside the 2px side band: row/col 1 lit or shaded).
  r.fillRect(3, 1, size - 6, 1, look.hi).fillRect(1, 3, 1, size - 6, look.hi);
  r.fillRect(3, size - 2, size - 6, 1, look.lo).fillRect(size - 2, 3, 1, size - 6, look.lo);
  // Iron studs in each corner.
  if (look.stud) for (const [cx, cy] of [[3.5, 3.5], [size - 3.5, 3.5], [3.5, size - 3.5], [size - 3.5, size - 3.5]]) {
    r.fillCircleSmooth(cx, cy, 1.3, look.stud);
    r.set(Math.floor(cx) - 1 + (cx > size / 2 ? 1 : 0), Math.floor(cy) - 1 + (cy > size / 2 ? 1 : 0), '#9aa0a8');
  }
  // Hidden swatches on corner pixels that stay fully transparent.
  r.swatch(size - 1, 0, look.text);
  if (look.emboss) r.swatch(0, size - 1, look.emboss);
  return r;
}

const pushCinf = (emboss) => encodeCinf({
  cornerSize: BTN.corner, sideThickness: BTN.side, tileSides: 0, patternAnchor: 0, bgPatternId: 0,
  bgPixel: { x: 10, y: 10 }, textPixel: { x: BTN.size - 1, y: 0 },
  embossPixel: emboss ? { x: 0, y: BTN.size - 1 } : { x: 0, y: 0 }, // (0,0) = no emboss
});

// Default ring: drawn 4px outside the face, after it; corners copied 1:1, so
// everything inside the band must be transparent. Same centre as the face's
// corner curve (8, 8 in ring coordinates), so the curves stay parallel.
function ringFace(band, edge) {
  const size = 24;
  return new Raster(size, size)
    .fillRoundRectSmooth(0, 0, size, size, 8, edge, { matte: C.body })
    .fillRoundRectSmooth(1, 1, size - 2, size - 2, 7, band)
    .fillRoundRect(3, 3, size - 6, size - 6, 5, null);
}
const ringCinf = () => encodeCinf({
  cornerSize: 9, sideThickness: 4, tileSides: 0, patternAnchor: 0, bgPatternId: 0,
  bgPixel: { x: 12, y: 12 }, textPixel: { x: 12, y: 12 }, embossPixel: { x: 0, y: 0 },
});

// Checkboxes and radios: id = -9504 + 12·kind + 3·value + tier.
const CHECK = 14;
function checkable(kind, value, tier) {
  const on = value > 0, disabled = tier === 0, pressed = tier === 2;
  const edge = disabled ? '#a7a097' : '#34373d';
  const fill = disabled ? '#ebe6dc' : pressed ? '#d8c9a8' : '#f6eedb';
  const ink = disabled ? '#b5a8a0' : pressed ? '#5e1018' : '#8a1d26';
  const radius = kind === 0 ? 2.5 : CHECK / 2;
  const r = new Raster(CHECK, CHECK)
    .fillRoundRectSmooth(0, 0, CHECK, CHECK, radius, edge, { matte: C.body })
    .fillRoundRectSmooth(1, 1, CHECK - 2, CHECK - 2, radius - 1, fill);
  // An inner shadow on the top-left: the box is set into the page.
  if (!disabled) r.strokeLineSmooth(3, 2.5, CHECK - 3, 2.5, 0.8, pressed ? '#bba985' : '#ddd1b4');
  if (!on) return r;
  if (value === 2) return r.strokeLineSmooth(4, 7, 10, 7, 2, ink);
  if (kind === 1) {
    r.fillCircleSmooth(7, 7, 3, ink);
    return disabled ? r : r.fillCircleSmooth(6.2, 6.2, 0.9, '#d4a943'); // a gold glint
  }
  return r.strokeLineSmooth(3.4, 7.2, 5.9, 10, 1.9, ink).strokeLineSmooth(5.9, 10, 10.8, 3.6, 1.9, ink);
}

export function build(add) {
  const faces = [
    [-10240, 'Inactive Push Button', { face: W.disabledFace, edge: W.disabledEdge, hi: '#bfae99', lo: '#a3927d', text: W.disabledText, stud: '#9b9389' }],
    [-10239, 'Push Button', { face: W.face, edge: W.edge, hi: W.hi, lo: W.lo, text: W.text, emboss: W.emboss, stud: '#3a3d43' }],
    [-10238, 'Pressed Push Button', { face: W.pressedFace, edge: W.edge, hi: W.pressedHi, lo: W.pressedLo, text: W.text, emboss: W.emboss, stud: '#2a2c31' }],
  ];
  for (const [id, name, look] of faces) {
    add('cicn', id, encodeCicn(pushFace(look)), name);
    add('cinf', id, pushCinf(!!look.emboss), name);
  }
  add('cicn', -10232, encodeCicn(ringFace('#c8bfae', '#8e8576')), 'Inactive Default Ring');
  add('cinf', -10232, ringCinf(), 'Inactive Default Ring');
  add('cicn', -10231, encodeCicn(ringFace('#d4a943', '#5a4210')), 'Default Ring');
  add('cinf', -10231, ringCinf(), 'Default Ring');

  const kinds = ['Checkbox', 'Radio Button'], values = ['Off', 'On', 'Mixed'], tiers = ['Disabled', 'Normal', 'Pressed'];
  for (let kind = 0; kind < 2; kind++) for (let value = 0; value < 3; value++) for (let tier = 0; tier < 3; tier++) {
    add('cicn', -9504 + 12 * kind + 3 * value + tier, encodeCicn(checkable(kind, value, tier)), `${tiers[tier]} ${values[value]} ${kinds[kind]}`);
  }
}
