// Brickworks body patterns, the desktop and the Finder colour records.
//
// Web runtime (docs/authoring-exotic-frames.md R21): document bodies tile the
// ppat named by cinf -9551's bgPatternId (else -9550's); utility, dialog,
// alert and modal bodies tile ppat 42. Classic Kaleidoscope uses -9551/-9550
// for Finder icon/list views, not ordinary window bodies (R22), so the
// baseplate body is web-only decoration.
//
// Plain on purpose (concept brief §1): live DOM text sits on it, and the
// ground behind the baseplate studs in the frame is this same colour, so the
// studs read as standing inside the box. #eeeeee is in the 8-bit system
// palette, so classic and web agree.
//
// The desktop (ppat 17) is a baseplate seen from above: a muted green plate
// with one stud per 16×16 tile, drawn only as a lit upper-left rim and a
// shaded lower-right rim, each one cube step off the plate, so it reads as
// texture behind icons and windows rather than as a grid.
import { Raster, encodePpat, encodeCicn, encodeCinf } from '../../../tools/theme-author/index.js';
import { BODY, UTIL_BODY } from './palette.mjs';

export const BASEPLATE_PPAT = 128;

const plain = (fill, N = 8) => new Raster(N, N).fillRect(0, 0, N, N, fill);

// Desktop colours: exact 8-bit system palette entries, stored raw
// (gamma: false), as Kingfisher's, Bonn's and Midnight 2027's desktops are.
const PLATE = { face: '#669966', rim: '#99cc99', shade: '#336633' };
const STUD = [
  '.lll.',
  'l...s',
  'l...s',
  'l...s',
  '.sss.',
];

/** 16×16 desktop tile: the plate with one stud, placed off-centre (it repeats every 16 px). */
function desktop() {
  const N = 16;
  return plain(PLATE.face, N).sprite(5, 5, STUD, { l: PLATE.rim, s: PLATE.shade });
}

function finderSwatch(fill, text) {
  return new Raster(8, 8).fillRect(0, 0, 8, 8, fill).set(1, 1, text);
}
const finderCinf = (bgPatternId = 0) => encodeCinf({
  cornerSize: 0, sideThickness: 0, tileSides: 0, patternAnchor: 0, bgPatternId,
  bgPixel: { x: 3, y: 3 }, textPixel: { x: 1, y: 1 }, embossPixel: { x: 0, y: 0 },
});

export function build(add) {
  add('ppat', BASEPLATE_PPAT, encodePpat(plain(BODY)), 'Baseplate Body');
  add('ppat', 42, encodePpat(plain(UTIL_BODY)), 'Utility Pattern');
  add('ppat', 17, encodePpat(desktop(), { gamma: false }), 'Desktop Pattern');
  const ink = '#330000';
  const finder = [
    [-9552, 'Desktop Text Color And Background', '#ffffff', ink, 0],
    [-9551, 'Icon View Background', BODY, ink, BASEPLATE_PPAT],
    [-9550, 'List View Background', BODY, ink, BASEPLATE_PPAT],
    [-9549, 'List View Sort Color', '#cccccc', ink, 0],
    [-9548, 'List View Divider Line', '#999999', ink, 0],
  ];
  for (const [id, name, fill, text, ppat] of finder) {
    add('cicn', id, encodeCicn(finderSwatch(fill, text)), name);
    add('cinf', id, finderCinf(ppat), name);
  }
}
