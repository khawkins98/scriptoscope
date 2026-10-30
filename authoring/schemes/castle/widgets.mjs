// Title-bar widgets, drawn straight onto the frame (so smooth edges blend with
// the real stone under them), plus the pressed-widget strip (cicn -14330).
//
//   close     a heater shield, iron rim, royal-blue field, gold saltire
//   zoom      a portcullis in an arched gateway
//   collapse  a cross-shaped arrow loop in a stone plate
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

export function drawClose(r, b, state, pressed = false) {
  const p = C[state];
  const lit = pressed && state === 'active';
  r.paintCoverage(b.x, b.y, b.w, b.h, shieldShape(b.x, b.y, b.w, b.h), p.iron);
  const field = lit ? verticalGradient(b.y, b.h, [[0, p.litHi], [1, p.gold]])
    : verticalGradient(b.y, b.h, [[0, p.fieldHi], [1, p.field]]);
  r.paintCoverage(b.x, b.y, b.w, b.h, shieldShape(b.x, b.y, b.w, b.h, 1.4), field);
  const ink = lit ? p.field : p.gold;
  const a = 3.6, z = b.w - 3.6, top = b.y + 3.2, bot = b.y + b.h - 4.4;
  r.strokeLineSmooth(b.x + a, top, b.x + z, bot, 1.4, ink);
  r.strokeLineSmooth(b.x + z, top, b.x + a, bot, 1.4, ink);
  // Iron studs on the shoulders.
  r.fillCircleSmooth(b.x + 2.6, b.y + 2.6, 0.9, p.ironHi);
  r.fillCircleSmooth(b.x + b.w - 2.6, b.y + 2.6, 0.9, p.ironHi);
  return r;
}

export function drawZoom(r, b, state, pressed = false) {
  const p = C[state];
  const lit = pressed && state === 'active';
  // Arched gateway: iron-dark surround, then the opening.
  const arch = (inset) => (px, py) => {
    const l = b.x + inset, rr = b.x + b.w - inset, top = b.y + inset, bot = b.y + b.h;
    if (px < l || px > rr || py < top || py > bot) return false;
    const cx = (l + rr) / 2, rad = (rr - l) / 2;
    return py >= top + rad || (px - cx) ** 2 + (py - (top + rad)) ** 2 <= rad * rad;
  };
  r.paintCoverage(b.x, b.y, b.w, b.h, arch(0), p.outline);
  r.paintCoverage(b.x, b.y, b.w, b.h, arch(1.2), lit ? verticalGradient(b.y, b.h, [[0, p.litHi], [1, p.lit]]) : p.dark);
  // The portcullis grid: three uprights with spikes, two cross bars.
  const bar = lit ? p.outline : p.ironHi;
  const drop = pressed ? -2 : 0; // pressed: the gate is raised
  for (const ux of [3, 6, 9]) {
    r.fillRect(b.x + ux, b.y + 3, 1, b.h - 5 + drop, bar);
    r.set(b.x + ux, b.y + b.h - 2 + drop, p.iron);
  }
  for (const uy of [5, 8]) r.fillRect(b.x + 2, b.y + uy + drop, b.w - 4, 1, bar);
  return r;
}

export function drawCollapse(r, b, state, pressed = false) {
  const p = C[state];
  const lit = pressed && state === 'active';
  r.fillRoundRectSmooth(b.x, b.y, b.w, b.h, 2, p.outline);
  r.fillRoundRectSmooth(b.x + 1, b.y + 1, b.w - 2, b.h - 2, 1.5,
    verticalGradient(b.y, b.h, [[0, p.stoneHi], [1, p.stone[3]]]));
  // A cross-shaped arrow loop, with splayed (wider) ends.
  const slit = lit ? p.lit : p.dark;
  const cx = b.x + Math.floor(b.w / 2), cy = b.y + Math.floor(b.h / 2) - 1;
  r.fillRect(cx, b.y + 2, 1, b.h - 4, slit);
  r.fillRect(b.x + 3, cy, b.w - 6, 1, slit);
  for (const [dx, dy] of [[-1, 2 - (cy - b.y)], [1, 2 - (cy - b.y)], [-1, b.h - 3 - (cy - b.y)], [1, b.h - 3 - (cy - b.y)]]) r.set(cx + dx, cy + dy, slit);
  if (lit) { r.set(cx, cy, p.litHi); }
  return r;
}

export const DRAW = { close: drawClose, zoom: drawZoom, collapse: drawCollapse };

/**
 * The pressed strip, built with the toolkit's pressedStripFrom: each piece is
 * the widget's own frame pixels with the pressed art on top, and the widget
 * silhouette is the click area.
 */
export function pressedStrip(strip, activeFrame) {
  return pressedStripFrom({ strip, activeFrame, draw: (role, raster, box) => DRAW[role](raster, box, 'active', true) });
}
