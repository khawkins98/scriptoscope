// Bonn's scheme icon: the picture Kaleidoscope's scheme picker shows, also
// the about box's icon (classic.mjs).
//
//   ICN# icl8 icl4 ics# ics8 ics4  -16455  "Kaleidoscope Scheme Icon"
//
// A stylised shield inspired by the City of Bonn's arms, drawn as a simple
// pixel emblem rather than a heraldic reproduction: a white top with a black
// cross, a thin black division, and a red bottom with a gold lion walking to
// the left, head turned out, one forepaw raised and its tail curled up over
// its back. Light from the upper left: a lit edge inside the outline on the
// left, a shaded one on the right. Each size is drawn at its own scale (the
// 16×16 one is not a scaled-down 32×32). Colours are exact system-palette
// entries from palette.mjs.
import { Raster } from '../../../tools/theme-author/index.js';
import { encodeIconFamily } from '../../../tools/theme-author/encode-icons.js';
import { C } from './palette.mjs';

const A = C.active, ARMS = A.arms;

// The lion, 18 × 10, facing left: maned head with eyes and mouth, a raised
// forepaw, four legs, the tail looping up over the back. K gold, k shaded
// gold, e the eyes and mouth.
const LION_32 = [
  '..KKKK............',
  '.KKkkKK.....KKK...',
  'KKeKKeKK...K...K..',
  'KKKKKKKK...K.K.K..',
  '.KKeeKKKKKKKKKK...',
  '..kKKKKKKKKKKKK...',
  'KKkkKKKKKKKKKKK...',
  '.KK.KK.....KK.KK..',
  '....KK.....KK..KK.',
  '...KKK....KKK..KKK',
];
const LION_16 = [
  'KK.....K',
  'KKKKKKKK',
  '.KKKKKK.',
  '.K.K.K.K',
];

/**
 * The shield: x0..x1 columns, y0..y1 rows, the top straight, the sides
 * straight down to `curve`, then a round bottom to a point.
 */
function shieldMask(x0, x1, y0, y1, curve) {
  const cx = (x0 + x1) / 2, hw = (x1 - x0) / 2, depth = y1 - curve;
  return (x, y) => {
    if (y < y0 || y > y1 || x < x0 || x > x1) return false;
    if (y <= curve) return true;
    const t = (y - curve) / depth;                       // 0 … 1 down the curve
    return Math.abs(x - cx) <= hw * Math.sqrt(Math.max(0, 1 - t * t)) + 0.4;
  };
}

function emblem(size) {
  const big = size === 32;
  const r = new Raster(size, size);
  const m = big ? shieldMask(3, 28, 1, 30, 17) : shieldMask(1, 14, 0, 15, 8);
  const split = big ? 14 : 7;                            // the division row (black)
  const cx = big ? [14, 17] : [7, 8], cy = big ? [6, 8] : [3, 3];
  const inside = (x, y) => m(x, y);
  const edge = (x, y) => inside(x, y) && !(inside(x - 1, y) && inside(x + 1, y) && inside(x, y - 1) && inside(x, y + 1));
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    if (!inside(x, y)) continue;
    let c;
    if (edge(x, y)) c = A.outline;
    else if (y < split) c = (x >= cx[0] && x <= cx[1]) || (y >= cy[0] && y <= cy[1]) ? ARMS.cross : ARMS.white;
    else if (y === split) c = ARMS.cross;
    else c = ARMS.red;
    // Light from the upper left: a lit column inside the left edge, a shaded one inside the right.
    if (c === ARMS.red && edge(x + 1, y) && !edge(x, y)) c = ARMS.redLo;
    r.set(x, y, c);
  }
  // The lion, with its own dark outline on the red.
  const lion = big ? LION_32 : LION_16, lx = big ? 7 : 4, ly = big ? 17 : 9;
  const at = (x, y) => { const row = lion[y - ly]; return row ? 'Kke'.includes(row[x - lx] ?? '.') : false; };
  for (let y = ly - 1; y <= ly + lion.length; y++) for (let x = lx - 1; x <= lx + lion[0].length; x++) {
    if (!at(x, y) && inside(x, y) && !edge(x, y) && y > split && (at(x - 1, y) || at(x + 1, y) || at(x, y - 1) || at(x, y + 1)) && big) r.set(x, y, A.outline);
  }
  r.sprite(lx, ly, lion, { K: ARMS.gold, k: ARMS.goldLo, e: A.outline });
  return r;
}

export function schemeIcon(size) {
  if (size !== 32 && size !== 16) throw new Error(`Bonn icon: no spec for ${size}×${size}`);
  return emblem(size);
}

export function build(add) {
  for (const res of encodeIconFamily(-16455, { large: schemeIcon(32), small: schemeIcon(16), name: 'Kaleidoscope Scheme Icon', dither4: false })) {
    add(res.type, res.id, res.data, res.name);
  }
}
