// Title-bar widgets, drawn straight onto the frame (so their smooth edges blend
// with the real sandstone under them), plus the pressed-widget strip (cicn -14330).
//
//   close     a five-petal cherry blossom
//   zoom      a round badge in the city colours, red over yellow
//   collapse  a Rhine-blue disc with a wave across it
//
// The pressed strip's mask is the hit region (exotic-frames R24), so each
// pressed piece keeps exactly its widget's silhouette.
import { verticalGradient, pressedStripFrom } from '../../../tools/theme-author/index.js';
import { C } from './palette.mjs';
import { fitPalette } from '../../../tools/theme-author/index.js';

export const WIDGET = 13;

export function drawClose(r, b, state, pressed = false) {
  const p = C[state];
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
  const petal = pressed ? C.pinkLo : p.pink, edge = pressed ? '#8f2f4d' : state === 'active' ? '#b5577a' : p.outline;
  const flower = (grow) => (px, py) => {
    const dx = px - cx, dy = py - cy, d = Math.hypot(dx, dy);
    const a = Math.atan2(dy, dx) + Math.PI / 2;
    // Five rounded petals with a little notch at each tip.
    const lobe = 4.2 + 2.1 * Math.abs(Math.cos((5 * a) / 2)) - (Math.abs(Math.cos((5 * a) / 2)) > 0.97 ? 0.8 : 0);
    return d <= lobe + grow;
  };
  r.paintCoverage(b.x, b.y, b.w, b.h, flower(0.2), edge);
  r.paintCoverage(b.x, b.y, b.w, b.h, flower(-1), pressed ? verticalGradient(b.y, b.h, [[0, C.pink], [1, C.pinkLo]]) : petal);
  if (state === 'active') {
    // Pale petal tips and a yellow heart.
    r.fillCircleSmooth(cx, cy, 2, pressed ? C.red : C.yellow);
    r.set(Math.floor(cx), Math.floor(cy), pressed ? C.yellow : C.yellowLo);
  } else {
    r.fillCircleSmooth(cx, cy, 1.6, p.barBottom);
  }
}

export function drawZoom(r, b, state, pressed = false) {
  const p = C[state];
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2, rad = b.w / 2;
  r.fillCircleSmooth(cx, cy, rad, p.outline);
  const top = pressed ? p.redLo : p.red, bottom = pressed ? p.yellowLo : p.yellow;
  // Red over yellow, split across the middle (one row per colour band).
  r.paintCoverage(b.x, b.y, b.w, b.h, (px, py) => Math.hypot(px - cx, py - cy) <= rad - 1.1, (x, y) => (y < cy ? top : bottom));
  if (!pressed && state === 'active') r.strokeLineSmooth(cx - 2.6, b.y + 3.2, cx + 1, b.y + 2.4, 1, '#e8686d');
  // A small square: "make bigger".
  const ink = state === 'active' ? '#fff6de' : p.barTop;
  r.fillRect(Math.round(cx - 2), Math.round(cy - 2), 4, 4, ink);
  r.fillRect(Math.round(cx - 1), Math.round(cy - 1), 2, 2, pressed ? top : p.outline);
}

export function drawCollapse(r, b, state, pressed = false) {
  const p = C[state];
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2, rad = b.w / 2;
  r.fillCircleSmooth(cx, cy, rad, p.outline);
  const [w0, w1] = pressed ? [p.water[2], p.water[3]] : [p.water[0], p.water[2]];
  r.fillCircleSmooth(cx, cy, rad - 1.1, verticalGradient(b.y, b.h, [[0, w0], [1, w1]]));
  // A wave across the middle.
  const ink = state === 'active' ? (pressed ? C.yellow : p.foam) : p.barTop;
  for (let i = 0; i < 8; i++) {
    const x0 = b.x + 2.6 + i, x1 = x0 + 1;
    const y = (x) => cy + 0.2 + 1.3 * Math.sin(((x - b.x - 2.6) / 8) * 2 * Math.PI);
    r.strokeLineSmooth(x0, y(x0), x1, y(x1), 1.3, ink);
  }
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
