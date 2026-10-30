// Castle body patterns and Finder colour records.
//
// Web runtime (docs/authoring-exotic-frames.md R21): document bodies tile the
// ppat named by cinf -9551's bgPatternId (else -9550's); utility, dialog,
// alert and modal bodies tile ppat 42. All of them are parchment: a stone
// frame round a stone floor had no value step between frame and content (design
// review §1.2, §2.4), so the interior is light and quiet behind live text.
// Classic Kaleidoscope uses -9551/-9550 for Finder icon/list views, not for
// ordinary window bodies (R22), so this is web-only decoration there.
//
// ppats tile in both directions, so the ordered dither (period 4) is fine as
// long as the tile size is a multiple of 4 (authoring guide §4.5).
import { Raster, encodePpat, encodeCicn, encodeCinf } from '../../../tools/theme-author/index.js';
import { C } from './palette.mjs';

export const PARCHMENT_PPAT = 42;

/**
 * 64×64 parchment for every body: flat #ffffcc with eight #cccc99 flecks
 * scattered by hand: the brief's one per 16×16, on a grid, read as graph
 * paper at 2x, so they are sparser and off-grid. Single pixels far apart, so nothing aliases with letter
 * stems (visual design §2.4); both colours are system-palette entries, so
 * 8 bpp keeps the page flat.
 */
const FLECKS = [[5, 3], [41, 11], [22, 24], [58, 30], [9, 44], [35, 50], [50, 61], [27, 37]];
function parchment() {
  const N = 64, r = new Raster(N, N).fillRect(0, 0, N, N, C.body);
  for (const [x, y] of FLECKS) r.set(x, y, '#cccc99');
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
  const ink = '#333333';
  const finder = [
    [-9552, 'Desktop Text Color And Background', '#ffffff', ink, 0],
    [-9551, 'Icon View Background', C.body, ink, PARCHMENT_PPAT],
    [-9550, 'List View Background', C.body, ink, PARCHMENT_PPAT],
    [-9549, 'List View Sort Color', '#ffff99', ink, 0],
    [-9548, 'List View Divider Line', '#cccc99', ink, 0],
  ];
  for (const [id, name, fill, text, ppat] of finder) {
    add('cicn', id, encodeCicn(finderSwatch(fill, text)), name);
    add('cinf', id, finderCinf(ppat), name);
  }
}
