// Bonn body patterns, the desktop and the Finder colour records.
//
// Web runtime (docs/authoring-exotic-frames.md R21): document bodies tile the
// ppat named by cinf -9551's bgPatternId (else -9550's); utility, dialog,
// alert and modal bodies tile ppat 42. Classic Kaleidoscope uses -9551/-9550
// for Finder icon/list views, not for ordinary window bodies (R22).
//
// Bodies are plain white: live DOM text sits on them, and the frame's
// sandstone, skyline and river already carry the scheme (R23, design brief).
import { Raster, encodePpat, encodeCicn, encodeCinf } from '../../../tools/theme-author/index.js';
import { C } from './palette.mjs';
import { ROSETTE } from './skyline.mjs';

export const BODY_PPAT = 128;

const plain = (color) => new Raster(8, 8).fillRect(0, 0, 8, 8, color);

/**
 * 32×32 desktop: the Rhine seen from above. Open river teal with scattered
 * deep ripples and white foam dashes on whole pixels (no bands, so the tile
 * doesn't stripe across a screen), and two cherry rosettes drifting on it.
 * Every colour is an exact entry of the 8-bit system palette, stored raw
 * (gamma: false), so a 256-colour classic screen shows this texture as is.
 */
function desktop() {
  const N = 32, r = new Raster(N, N);
  const deep = [51, 102, 102], river = [51, 153, 153], foam = [255, 255, 255];
  r.fillRect(0, 0, N, N, river);
  const dash = (x, y, n, c) => { for (let i = 0; i < n; i++) r.set((x + i) % N, y, c); };
  // Ripples: a deep dash with a foam fleck above its right end, staggered.
  for (const [x, y] of [[3, 4], [19, 8], [11, 15], [27, 20], [5, 25], [17, 29]]) {
    dash(x, y, 5, deep);
    dash(x + 4, y - 1, 2, foam);
  }
  dash(24, 2, 3, foam); dash(9, 21, 3, foam);
  const legend = { l: [255, 204, 204], a: [255, 153, 204], d: [204, 102, 153], c: [204, 102, 153] };
  r.sprite(23, 11, ROSETTE, legend);
  r.sprite(4, 8, ROSETTE, legend);
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
  const ink = '#000000';
  const finder = [
    [-9552, 'Desktop Text Color And Background', '#ffffff', ink, 0],
    [-9551, 'Icon View Background', C.body, ink, BODY_PPAT],
    [-9550, 'List View Background', C.body, ink, BODY_PPAT],
    [-9549, 'List View Sort Color', '#ffffcc', ink, 0],
    [-9548, 'List View Divider Line', '#ffcc99', ink, 0],
  ];
  for (const [id, name, fill, text, ppat] of finder) {
    add('cicn', id, encodeCicn(finderSwatch(fill, text)), name);
    add('cinf', id, finderCinf(ppat), name);
  }
}
