// Title-bar widgets, drawn straight onto the frame (so their smooth edges blend
// with the real sandstone under them), plus the pressed-widget strip (cicn -14330).
//
// One family: every widget is the same 13px disc with the same dark rim
// (p.outline), and the picture sits inside it on whole pixels:
//
//   close     a five-petal cherry blossom on a pink disc
//   zoom      a small square on a disc in the city colours, red over yellow
//   collapse  a Rhine wave on a teal disc
//
// Pressed: the fill steps down and the glyph turns yellow. Inactive: the same
// disc and glyph in the quiet inactive colours. The pressed strip's mask is
// the hit region (exotic-frames R24), so each pressed piece keeps exactly its
// widget's silhouette.
import { pressedStripFrom } from '../../../tools/theme-author/index.js';
import { C } from './palette.mjs';
import { fitPalette } from '../../../tools/theme-author/index.js';

export const WIDGET = 13;
const RIM = 1.1;

/** The shared silhouette: a 13px disc with a 1px rim, filled with `fill`. */
function disc(r, b, p, fill) {
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2, rad = b.w / 2;
  r.fillCircleSmooth(cx, cy, rad, p.outline);
  r.paintCoverage(b.x, b.y, b.w, b.h, (px, py) => Math.hypot(px - cx, py - cy) <= rad - RIM, fill);
}

// Glyphs on whole pixels, centred in the 13px box (the blossom is 9×9 at
// +2, the others 7×7 at +3).
const BLOSSOM = [
  '...###...',
  '...###...',
  '##..#..##',
  '###.y.###',
  '.##yyy##.',
  '..#.y.#..',
  '.###.###.',
  '.###.###.',
  '..#...#..',
];
const SQUARE = [
  '.......',
  '.#####.',
  '.#ooo#.',
  '.#ooo#.',
  '.#ooo#.',
  '.#####.',
  '.......',
];
const WAVE = [
  '.......',
  '.......',
  '.##....',
  '#..#..#',
  '....##.',
  '.......',
  '.......',
];
const glyph = (r, b, rows, legend) => {
  const o = (b.w - rows.length) >> 1;
  r.sprite(b.x + o, b.y + o, rows, legend);
};

export function drawClose(r, b, state, pressed = false) {
  const p = C[state];
  disc(r, b, p, pressed ? C.red : p.pinkLo);
  const active = state === 'active';
  glyph(r, b, BLOSSOM, { '#': pressed ? C.pink : p.pinkHi, y: active ? C.yellow : p.pink });
}

export function drawZoom(r, b, state, pressed = false) {
  const p = C[state];
  const cy = b.y + b.h / 2;
  const top = pressed ? p.redLo : p.red, bottom = pressed ? p.yellowLo : p.yellow;
  disc(r, b, p, (x, y) => (y < cy ? top : bottom));
  const ink = state === 'active' ? (pressed ? C.yellow : C.active.title) : p.barTop;
  glyph(r, b, SQUARE, { '#': ink, o: pressed ? top : p.outline });
}

export function drawCollapse(r, b, state, pressed = false) {
  const p = C[state];
  disc(r, b, p, pressed ? p.water[1] : p.water[0]);
  const ink = state === 'active' ? (pressed ? C.yellow : p.foam) : p.barTop;
  glyph(r, b, WAVE, { '#': ink });
}

export const DRAW = { close: drawClose, zoom: drawZoom, collapse: drawCollapse };

/**
 * The pressed strip, built with the toolkit's pressedStripFrom: each piece is
 * the widget's own frame pixels with the pressed art on top, and the widget
 * silhouette is the click area.
 */
export function pressedStrip(strip, activeFrame) {
  return fitPalette(pressedStripFrom({ strip, activeFrame, draw: (role, raster, box) => DRAW[role](raster, box, 'active', true) }));
}
