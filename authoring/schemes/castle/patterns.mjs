// Castle body patterns, the desktop and the Finder colour records.
//
// Web runtime (docs/authoring-exotic-frames.md R21): document bodies tile the
// ppat named by cinf -9551's bgPatternId (else -9550's); utility, dialog,
// alert and modal bodies tile ppat 42. All of them are parchment: a stone
// frame round a stone floor had no value step between frame and content (design
// review §1.2, §2.4), so the interior is light and quiet behind live text.
// Classic Kaleidoscope uses -9551/-9550 for Finder icon/list views, not for
// ordinary window bodies (R22), so this is web-only decoration there.
//
// The desktop (ppat 17, classic only) is a calm sky behind the keep: grey
// stone reads best against a cool, quiet ground, and stone or grass texture
// would fight the frames. See `desktop()`.
import { Raster, encodePpat, encodeCicn, encodeCinf } from '../../../tools/theme-author/index.js';
import { C } from './palette.mjs';

export const PARCHMENT_PPAT = 42;

// Flat parchment keeps the live content quieter than the masonry. A minimal
// 8×8 pattern preserves the body/background wiring without decorative flecks.
function parchment() {
  return new Raster(8, 8).fillRect(0, 0, 8, 8, C.body);
}

/**
 * 64×64 desktop: a high, quiet sky. Flat #6699cc (the moat's lit blue) with a
 * sparse grain of short, pale #99cccc wisps, one to three pixels long,
 * scattered by hand: off any grid and far apart,
 * so at 1x it reads as a still sky and the tile never shows as rows.
 * Both are exact 8-bit system palette entries, stored raw (gamma: false), as
 * Kingfisher's, Bonn's and Midnight 2027's desktops are.
 */
const SKY = '#6699cc', WISP = '#99cccc';
// [x, y, length]
const WISPS = [
  [4, 6, 3], [29, 3, 1], [47, 11, 2], [17, 19, 2], [58, 24, 3], [36, 29, 1],
  [8, 37, 2], [26, 44, 3], [50, 41, 1], [41, 54, 2], [12, 58, 1], [61, 50, 2],
];
function desktop() {
  const N = 64, r = new Raster(N, N).fillRect(0, 0, N, N, SKY);
  for (const [x, y, n] of WISPS) for (let i = 0; i < n; i++) r.set((x + i) % N, y, WISP);
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
  add('ppat', PARCHMENT_PPAT, encodePpat(parchment()), 'Parchment');
  add('ppat', 17, encodePpat(desktop(), { gamma: false }), 'Desktop Pattern');
  const ink = '#333333';
  const finder = [
    [-9552, 'Desktop Text Color And Background', '#ffffff', ink, 0],
    [-9551, 'Icon View Background', C.body, ink, PARCHMENT_PPAT],
    [-9550, 'List View Background', C.body, ink, PARCHMENT_PPAT],
    [-9549, 'List View Sort Color', '#e3dccb', ink, 0],
    [-9548, 'List View Divider Line', '#cccccc', ink, 0],
  ];
  for (const [id, name, fill, text, ppat] of finder) {
    add('cicn', id, encodeCicn(finderSwatch(fill, text)), name);
    add('cinf', id, finderCinf(ppat), name);
  }
}
