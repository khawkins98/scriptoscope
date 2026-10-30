// Brickworks body patterns and Finder colour records.
//
// Web runtime (docs/authoring-exotic-frames.md R21): document bodies tile the
// ppat named by cinf -9551's bgPatternId (else -9550's); utility, dialog,
// alert and modal bodies tile ppat 42. Classic Kaleidoscope uses -9551/-9550
// for Finder icon/list views, not ordinary window bodies (R22), so the
// baseplate body is web-only decoration.
//
// Low contrast on purpose (R23): live DOM text sits on it. Each 8px cell is
// one stud seen from far above: a single 2×2 dot on a warm off-white plate,
// at most ~1.1:1 against it. No rings and nothing on a 1–2px rhythm, so the
// texture never lines up with letter stems (visual-design review §1.3, §2.4).
import { Raster, encodePpat, encodeCicn, encodeCinf } from '../../../tools/theme-author/index.js';
import { BODY, UTIL_BODY } from './palette.mjs';

export const BASEPLATE_PPAT = 128;

function baseplate(plate, dot, N = 16) {
  const r = new Raster(N, N).fillRect(0, 0, N, N, plate);
  for (let cy = 0; cy < N; cy += 8) for (let cx = 0; cx < N; cx += 8) r.fillRect(cx + 3, cy + 3, 2, 2, dot);
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
  add('ppat', BASEPLATE_PPAT, encodePpat(baseplate(BODY, '#e9e6dd')), 'Baseplate Body');
  add('ppat', 42, encodePpat(baseplate(UTIL_BODY, '#e3e7ee')), 'Utility Pattern');
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
