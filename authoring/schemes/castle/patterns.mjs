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
import { Raster, encodePpat, encodeCicn, encodeCinf, bayer } from '../../../tools/theme-author/index.js';
import { hash } from './stone.mjs';
import { C } from './palette.mjs';

export const PARCHMENT_PPAT = 42;

/** 16×16 parchment for every body: a faint ordered-dither mottle, about 1.05:1, too faint to fight letter stems. */
function parchment() {
  const N = 16, r = new Raster(N, N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const n = hash(x >> 2, y >> 2, 8);
    r.set(x, y, n > bayer(x, y) * 1.6 ? '#ede6d4' : '#e8e0cc');
  }
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
  const ink = '#2b2824';
  const finder = [
    [-9552, 'Desktop Text Color And Background', '#ffffff', ink, 0],
    [-9551, 'Icon View Background', C.body, ink, PARCHMENT_PPAT],
    [-9550, 'List View Background', C.body, ink, PARCHMENT_PPAT],
    [-9549, 'List View Sort Color', '#ddd3bd', ink, 0],
    [-9548, 'List View Divider Line', '#c9bfa9', ink, 0],
  ];
  for (const [id, name, fill, text, ppat] of finder) {
    add('cicn', id, encodeCicn(finderSwatch(fill, text)), name);
    add('cinf', id, finderCinf(ppat), name);
  }
}
