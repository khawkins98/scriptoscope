// Brickworks body patterns and Finder colour records.
//
// Web runtime (docs/authoring-exotic-frames.md R21): document bodies tile the
// ppat named by cinf -9551's bgPatternId (else -9550's); utility, dialog,
// alert and modal bodies tile ppat 42. Classic Kaleidoscope uses -9551/-9550
// for Finder icon/list views, not ordinary window bodies (R22), so the
// baseplate body is web-only decoration.
//
// Low contrast on purpose (R23): live DOM text sits on it. Each 8px cell is
// one stud seen from above: a faint lit rim on the upper left and a faint
// shade on the lower right, on a warm off-white plate.
import { Raster, encodePpat, encodeCicn, encodeCinf } from '../../../tools/theme-author/index.js';
import { BODY, UTIL_BODY } from './palette.mjs';

export const BASEPLATE_PPAT = 128;

function baseplate(plate, lit, shade, N = 16) {
  const r = new Raster(N, N).fillRect(0, 0, N, N, plate);
  for (let cy = 0; cy < N; cy += 8) for (let cx = 0; cx < N; cx += 8) {
    // A ring of radius ~2.6 centred in the cell: lit half up-left, shaded half down-right.
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      const dx = x + 0.5 - 4, dy = y + 0.5 - 4, d = Math.hypot(dx, dy);
      if (d < 1.9 || d > 3.1) continue;
      r.set(cx + x, cy + y, dx + dy < 0 ? lit : shade);
    }
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
  add('ppat', BASEPLATE_PPAT, encodePpat(baseplate(BODY, '#fbfaf6', '#e4e1d8')), 'Baseplate Body');
  add('ppat', 42, encodePpat(baseplate(UTIL_BODY, '#f8f9fc', '#e1e5ed')), 'Utility Pattern');
  const ink = '#1c1a17';
  const finder = [
    [-9552, 'Desktop Text Color And Background', '#ffffff', ink, 0],
    [-9551, 'Icon View Background', BODY, ink, BASEPLATE_PPAT],
    [-9550, 'List View Background', BODY, ink, BASEPLATE_PPAT],
    [-9549, 'List View Sort Color', '#e9e6dc', ink, 0],
    [-9548, 'List View Divider Line', '#d6d2c6', ink, 0],
  ];
  for (const [id, name, fill, text, ppat] of finder) {
    add('cicn', id, encodeCicn(finderSwatch(fill, text)), name);
    add('cinf', id, finderCinf(ppat), name);
  }
}
