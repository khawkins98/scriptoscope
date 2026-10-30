// Castle body patterns and Finder colour records.
//
// Web runtime (docs/authoring-exotic-frames.md R21): document bodies tile the
// ppat named by cinf -9551's bgPatternId (else -9550's); utility, dialog,
// alert and modal bodies tile ppat 42. Classic Kaleidoscope uses -9551/-9550
// for Finder icon/list views, not for ordinary window bodies (R22), so the
// flagstone floor is web-only decoration there.
//
// ppats tile in both directions, so the ordered dither (period 4) is fine as
// long as the tile size is a multiple of 4 (authoring guide §4.5).
import { Raster, encodePpat, encodeCicn, encodeCinf, mix } from '../../../tools/theme-author/index.js';
import { hash, bayer } from './stone.mjs';

export const FLAGSTONE_PPAT = 128;

/**
 * 32×32 flagstones: three courses of irregular-length slabs, each slab a
 * slightly different pale warm grey, faint mortar, and a dithered speckle.
 * Low contrast on purpose: live DOM text sits on it.
 */
function flagstones() {
  const N = 32, r = new Raster(N, N);
  const courses = [[0, 11, [0, 13, 22]], [11, 10, [6, 17, 27]], [21, 11, [3, 11, 24]]]; // [y, h, seam xs]
  const tones = ['#e3ddd1', '#dfd9cc', '#e5e0d5', '#dcd6c8', '#e1dbcf'];
  const mortar = '#d0c9bb';
  courses.forEach(([y0, h, seams], ci) => {
    for (let y = y0; y < y0 + h; y++) for (let x = 0; x < N; x++) {
      // Which slab (seams wrap around the tile edge).
      let k = seams.findLastIndex((s) => s <= x);
      if (k < 0) k = seams.length - 1;
      const tone = tones[Math.floor(hash(k, ci, 17) * tones.length)];
      const onSeam = seams.includes(x) || y === y0;
      let c = onSeam ? mortar : tone;
      if (!onSeam && y === y0 + 1) c = mix(tone, '#efeae1', 0.35);           // lit top edge
      if (!onSeam && hash(x, y, 3) < 0.12 && bayer(x, y) < 0.5) c = mix(tone, '#c4bcac', 0.3); // grit
      r.set(x, y, c);
    }
  });
  return r;
}

/** 16×16 parchment for dialogs and palettes: a faint ordered-dither mottle. */
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
  add('ppat', FLAGSTONE_PPAT, encodePpat(flagstones()), 'Flagstone Floor');
  add('ppat', 42, encodePpat(parchment()), 'Utility Pattern');
  const ink = '#2b2824';
  const finder = [
    [-9552, 'Desktop Text Color And Background', '#ffffff', ink, 0],
    [-9551, 'Icon View Background', '#e0d9cb', ink, FLAGSTONE_PPAT],
    [-9550, 'List View Background', '#e0d9cb', ink, FLAGSTONE_PPAT],
    [-9549, 'List View Sort Color', '#d6cebd', ink, 0],
    [-9548, 'List View Divider Line', '#c9c1b1', ink, 0],
  ];
  for (const [id, name, fill, text, ppat] of finder) {
    add('cicn', id, encodeCicn(finderSwatch(fill, text)), name);
    add('cinf', id, finderCinf(ppat), name);
  }
}
