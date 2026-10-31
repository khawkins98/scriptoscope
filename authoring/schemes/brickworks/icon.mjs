// Brickworks' scheme icon: the picture Kaleidoscope's scheme picker shows.
//
//   ICN# icl8 icl4 ics# ics8 ics4  -16455  "Kaleidoscope Scheme Icon"
//
// One red 2×2 brick in three-quarter view: the lit top face carrying four
// studs, the front face and a shaded right side, light from the upper left,
// in the warm near-black outline every Brickworks piece shares. Colours are
// the frames' red brick ramp (palette.mjs), on whole pixels. Each size is
// drawn at its own scale (the 16×16 one is not a scaled-down 32×32), from a
// cabinet projection: depth runs up and to the right at 45°, half length.
// A generic building-toy brick: plain studs, no brand, logo or lettering.
import { Raster } from '../../../tools/theme-author/index.js';
import { encodeIconFamily } from '../../../tools/theme-author/encode-icons.js';
import { BRICK, OUTLINE } from './palette.mjs';

const R = BRICK.red;
// The top face is a step brighter than the front: #ff3333 is the cube entry
// between the ramp's lit #ff6666 (the stud highlight) and the #cc0000 face.
const LIT = '#ff3333';

// Per size: front-bottom-left corner (x0, yb), width W, depth D (screen
// offset D/2 right and up) and height H.
const SPEC = {
  32: { x0: 1, yb: 29, W: 21, D: 18, H: 11 },
  16: { x0: 1, yb: 14, W: 10, D: 8, H: 5 },
};

export function schemeIcon(size) {
  const s = SPEC[size];
  if (!s) throw new Error(`Brickworks icon: no spec for ${size}×${size}`);
  const { x0, yb, W, D, H } = s;
  const depth = D / 2; // screen offset of the back edge, right and up
  const yTop = yb - H; // screen y of the top face's front edge
  const r = new Raster(size, size);
  const part = new Array(size * size).fill(null);

  // Faces by pixel centre.
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const px = x + 0.5, py = y + 0.5;
    let face = null;
    if (px >= x0 && px <= x0 + W && py >= yTop && py <= yb) face = 'front';
    else {
      const v = yTop - py; // up from the front edge = depth travelled
      const u = px - x0 - v;
      if (v >= 0 && v <= depth && u >= 0 && u <= W) face = 'top';
      const sv = px - x0 - W, sh = yb - py - sv;
      if (sv >= 0 && sv <= depth && sh >= 0 && sh <= H) face = face ?? 'side';
    }
    part[y * size + x] = face;
  }
  const at = (x, y) => (x < 0 || y < 0 || x >= size || y >= size ? null : part[y * size + x]);
  const colour = { top: LIT, front: R.base, side: R.lo };
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const f = at(x, y);
    if (!f) continue;
    const edge = !at(x - 1, y) || !at(x + 1, y) || !at(x, y - 1) || !at(x, y + 1);
    r.set(x, y, edge ? OUTLINE : colour[f]);
  }
  // The crease between the top and the front catches the light; between the
  // front and the side it is the outline.
  for (let x = x0 + 1; x < x0 + W; x++) if (at(x, Math.floor(yTop)) === 'front') r.set(x, Math.floor(yTop), R.hi);
  for (let y = Math.ceil(yTop); y < yb; y++) r.set(x0 + W, y, OUTLINE);

  // Studs, back row first so the front row overlaps it. Each is a small
  // hand-placed sprite (a lit top ellipse over a short wall), bottom-centred on
  // its plan position 1/4 and 3/4 across and deep.
  const sp = STUD[size];
  for (const pv of [0.75, 0.25]) for (const pu of [0.25, 0.75]) {
    const cx = x0 + pu * W + pv * depth, cy = yTop - pv * depth;
    r.sprite(Math.round(cx - sp[0].length / 2), Math.round(cy) - sp.length + 1, sp, STUD_LEGEND);
  }
  return r;
}

// o outline · H highlight · t lit top · B wall face · S wall shade
const STUD = {
  32: [
    '.ooooo.',
    'oHHttto',
    'oHtttto',
    'oBoooSo',
    'oBBBSSo',
    '.ooooo.',
  ],
  16: [
    '.oo.',
    'oHto',
    'oBSo',
    '.oo.',
  ],
};
const STUD_LEGEND = { o: OUTLINE, H: R.hi, t: LIT, B: R.base, S: R.lo };

export function build(add) {
  for (const res of encodeIconFamily(-16455, { large: schemeIcon(32), small: schemeIcon(16), name: 'Kaleidoscope Scheme Icon', dither4: false })) {
    add(res.type, res.id, res.data, res.name);
  }
}
