// Title-bar widgets, drawn straight onto the frame (so smooth edges blend with
// the real stone under them), plus the pressed-widget strip (cicn -14330).
//
//   close     a heater shield, iron rim, royal-blue field, gold saltire
//   zoom      a dressed-stone plate with a window-in-window glyph (bigger)
//   collapse  the same plate with a bar under a chevron (a drawbridge going up)
//
// Glyphs are whole pixels (Raster.sprite), not smooth strokes: a 1–1.5px
// anti-aliased stroke is a grey smear at 1x (design review §2.2). Pressed is
// inverted, not darkened: the shield goes gold-on-blue, the plates go to iron
// with a gold glyph. Inactive keeps the silhouette and drops the plate glyphs.
//
// The pressed strip's mask is the hit region (R24, HT7), so every widget has
// a near-square silhouette and the pressed art keeps exactly that silhouette.
import { verticalGradient, pressedStripFrom } from '../../../tools/theme-author/index.js';
import { C } from './palette.mjs';

/** Heater-shield coverage inside a w×h box at (x, y): straight sides, rounded point. */
function shieldShape(x, y, w, h, inset = 0) {
  const cx = x + w / 2, half = w / 2 - inset, top = y + inset, shoulder = y + h * 0.42;
  const bottom = y + h - inset;
  return (px, py) => {
    if (py < top || py > bottom) return false;
    if (py <= shoulder) return Math.abs(px - cx) <= half;
    const t = (py - shoulder) / (bottom - shoulder);           // 0 at the shoulder, 1 at the point
    return Math.abs(px - cx) <= half * Math.sqrt(Math.max(0, 1 - t * t));
  };
}

const SALTIRE = [
  '##...##',
  '.##.##.',
  '..###..',
  '.##.##.',
  '##...##',
];

export function drawClose(r, b, state, pressed = false) {
  const p = C[state];
  const lit = pressed && state === 'active';
  r.paintCoverage(b.x, b.y, b.w, b.h, shieldShape(b.x, b.y, b.w, b.h), p.iron);
  const field = lit ? verticalGradient(b.y, b.h, [[0, p.litHi], [1, p.gold]])
    : verticalGradient(b.y, b.h, [[0, p.fieldHi], [1, p.field]]);
  r.paintCoverage(b.x, b.y, b.w, b.h, shieldShape(b.x, b.y, b.w, b.h, 1.4), field);
  // A whole-pixel saltire on the shield's centre column.
  r.sprite(b.x + Math.floor(b.w / 2) - 3, b.y + 3, SALTIRE, { '#': lit ? p.field : p.gold });
  // Iron studs on the shoulders.
  r.fillCircleSmooth(b.x + 2.6, b.y + 2.6, 0.9, p.ironHi);
  r.fillCircleSmooth(b.x + b.w - 2.6, b.y + 2.6, 0.9, p.ironHi);
  return r;
}

// 9×9 glyphs for the stone plates, centred in the 13px box.
const ZOOM = [
  '#########',
  '#...#...#',
  '#...#...#',
  '#...#...#',
  '#####...#',
  '#.......#',
  '#.......#',
  '#.......#',
  '#########',
];
const COLLAPSE = [
  '.........',
  '....#....',
  '...###...',
  '..##.##..',
  '.##...##.',
  '.........',
  '#########',
  '#########',
  '.........',
];

/**
 * A dressed-stone plate: iron-dark rim with its four corner pixels left to the
 * frame (a 1-px stair, not a blended arc), a flat face, and a 1px bevel lit
 * from the upper left. Pressed: an iron face, sunk (the bevel flips).
 */
function plate(r, b, p, pressed) {
  r.fillRect(b.x + 1, b.y, b.w - 2, b.h, p.outline).fillRect(b.x, b.y + 1, b.w, b.h - 2, p.outline);
  const face = pressed ? p.iron : p.stone[0];
  const hi = pressed ? p.outline : p.stoneHi, lo = pressed ? p.ironHi : p.stoneLo;
  r.fillRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2, face);
  r.hline(b.x + 1, b.y + 1, b.w - 2, hi).vline(b.x + 1, b.y + 1, b.h - 2, hi);
  r.hline(b.x + 2, b.y + b.h - 2, b.w - 3, lo).vline(b.x + b.w - 2, b.y + 2, b.h - 3, lo);
}

function plateWidget(glyph) {
  return (r, b, state, pressed = false) => {
    const p = C[state];
    const lit = pressed && state === 'active';
    plate(r, b, p, lit);
    if (state === 'active') {
      const gx = b.x + Math.floor((b.w - 9) / 2), gy = b.y + Math.floor((b.h - 9) / 2);
      r.sprite(gx, gy, glyph, { '#': lit ? p.litHi : p.dark });
    }
    return r;
  };
}

export const drawZoom = plateWidget(ZOOM);
export const drawCollapse = plateWidget(COLLAPSE);

export const DRAW = { close: drawClose, zoom: drawZoom, collapse: drawCollapse };

/**
 * The pressed strip, built with the toolkit's pressedStripFrom: each piece is
 * the widget's own frame pixels with the pressed art on top, and the widget
 * silhouette is the click area.
 */
export function pressedStrip(strip, activeFrame) {
  return pressedStripFrom({ strip, activeFrame, draw: (role, raster, box) => DRAW[role](raster, box, 'active', true) });
}
