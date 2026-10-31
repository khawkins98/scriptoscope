// Midnight 2027 body patterns, the desktop, Finder colour records and the
// header / slider colour tables.
//
// Web runtime (docs/authoring-exotic-frames.md R21): document bodies tile the
// ppat named by cinf -9551's bgPatternId (else -9550's); utility, dialog,
// alert and modal bodies tile ppat 42. Both are plain white: the frame
// carries the celebration, live text sits on something calm (visual design
// §2.4, §3.3 "Calm bodies"). Classic uses -9551/-9550 for Finder views only (R22).
import { Raster, encodePpat, encodeCicn, encodeCinf } from '../../../tools/theme-author/index.js';
import { encodeClut, encodeHeaderClut } from '../../../tools/theme-author/encode-clut.js';
import { C } from './palette.mjs';

export const BODY_PPAT = 128;

const plain = (color) => new Raster(8, 8).fillRect(0, 0, 8, 8, color);

/**
 * 64×64 desktop: the night sky. Flat midnight navy, single-pixel stars of two
 * brightnesses, two four-point twinkles and a few confetti flecks (2×1, gold,
 * pink, cyan), all placed by hand so nothing lines up into stripes when the
 * tile repeats. Every colour is an exact 8-bit system entry, stored raw
 * (gamma: false), as Halcyon's and Bonn's desktops are.
 */
function desktop() {
  const N = 64, r = new Raster(N, N);
  const navy = [0, 0, 51], dim = [102, 153, 204], bright = [255, 255, 204], white = [255, 255, 255];
  const gold = [255, 204, 51], pink = [255, 102, 204], cyan = [51, 204, 255];
  r.fillRect(0, 0, N, N, navy);
  const dims = [[3, 5], [21, 2], [44, 9], [58, 17], [12, 23], [33, 28], [50, 36], [6, 41], [27, 47], [41, 55], [60, 50], [17, 60], [36, 13], [53, 26]];
  for (const [x, y] of dims) r.set(x, y, dim);
  for (const [x, y] of [[29, 6], [9, 32], [47, 45], [62, 3]]) r.set(x, y, bright);
  // Four-point twinkles: a white centre with dim arms.
  for (const [x, y] of [[40, 21], [14, 51]]) {
    r.set(x, y, white).set(x - 1, y, dim).set(x + 1, y, dim).set(x, y - 1, dim).set(x, y + 1, dim);
  }
  // Confetti: 2×1 flecks at a few angles' worth of offsets.
  const flecks = [[24, 16, gold, 'h'], [55, 8, pink, 'v'], [5, 14, cyan, 'h'], [36, 40, gold, 'v'], [58, 58, cyan, 'h'], [22, 36, pink, 'h'], [46, 62, gold, 'h']];
  for (const [x, y, c, d] of flecks) { r.set(x, y, c); if (d === 'h') r.set(x + 1, y, c); else r.set(x, y + 1, c); }
  return r;
}

function finderSwatch(fill, text) {
  return new Raster(8, 8).fillRect(0, 0, 8, 8, fill).set(1, 1, text);
}
const finderCinf = (bgPatternId = 0) => encodeCinf({
  cornerSize: 0, sideThickness: 0, tileSides: 0, patternAnchor: 0, bgPatternId,
  bgPixel: { x: 3, y: 3 }, textPixel: { x: 1, y: 1 }, embossPixel: { x: 0, y: 0 },
});

export function build(add) {
  add('ppat', BODY_PPAT, encodePpat(plain(C.body)), 'Document Body');
  add('ppat', 42, encodePpat(plain(C.body)), 'Utility Pattern');
  add('ppat', 17, encodePpat(desktop(), { gamma: false }), 'Desktop Pattern');
  const ink = '#000033';
  const finder = [
    [-9552, 'Desktop Text Color And Background', '#000033', '#ffffff', 0],
    [-9551, 'Icon View Background', C.body, ink, BODY_PPAT],
    [-9550, 'List View Background', C.body, ink, BODY_PPAT],
    [-9549, 'List View Sort Color', '#eeeeee', ink, 0],
    [-9548, 'List View Divider Line', '#cccccc', ink, 0],
  ];
  for (const [id, name, fill, text, ppat] of finder) {
    add('cicn', id, encodeCicn(finderSwatch(fill, text)), name);
    add('cinf', id, finderCinf(ppat), name);
  }

  // Header colour tables (part codes: frame, fill, text, tinges, bevels) and
  // the slider / focus-ring ramp (light → dark), as Halcyon ships them.
  const A = C.active, I = C.inactive;
  add('clut', -14336, encodeHeaderClut({ frame: A.outline, fill: A.gold, text: A.title, lightTinge: A.goldHi, darkTinge: A.goldLo, lightBevel: A.goldHi, darkBevel: A.bronze }), 'Active Header');
  add('clut', -14335, encodeHeaderClut({ frame: I.outline, fill: I.gold, text: I.title, lightTinge: I.goldHi, darkTinge: I.goldLo, lightBevel: I.goldHi, darkBevel: I.bronze }), 'Inactive Header');
  const ramp = ['#ffffcc', '#ffcc33', '#cc9933', '#996600', '#336699', '#003366', '#000033', '#000022'];
  add('clut', 300, encodeClut(ramp.map((color, value) => ({ value, color }))), 'Slider & Focus Ring Colors');
}
