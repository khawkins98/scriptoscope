// Title-bar widgets: round 1×1 tiles pressed into the corner bricks, drawn
// straight onto the frame so their smooth rims blend with the real brick
// pixels under them (authoring guide §4.5).
//
//   close     red round tile, printed ×
//   zoom      green round tile, printed +
//   collapse  blue round tile, printed –
//
// Pressed: the tile sinks (darker, lit from below, glyph nudged down). The
// pressed strip (cicn -14330) is built by the toolkit's pressedStripFrom, so
// each piece's mask is exactly the round tile: that mask is the click area (R24).
import { ditheredGradient, pressedStripFrom } from '../../../tools/theme-author/index.js';
import { pal } from './palette.mjs';

const ROLE_COLOUR = { close: 'red', zoom: 'green', collapse: 'blue' };

export function drawWidget(r, box, role, state, pressed = false) {
  const p = pal(state);
  const b = p[ROLE_COLOUR[role]];
  const active = state === 'active';
  const cx = box.x + box.w / 2, cy = box.y + box.h / 2, rad = box.w / 2;
  r.fillCircleSmooth(cx, cy, rad, active ? b.seam : p.outline);
  const face = pressed
    ? ditheredGradient(box.y + 1, box.h - 2, [[0, b.deep], [1, b.lo]], { levels: 3 })
    : ditheredGradient(box.y + 1, box.h - 2, [[0, b.hi], [0.55, b.base], [1, b.lo]], { levels: 4 });
  r.fillCircleSmooth(cx, cy, rad - 1, face);
  if (pressed) {
    // A sunk tile: a dark lip along the top inside edge.
    r.paintCoverage(box.x, box.y, box.w, box.h, (px, py) => {
      const d = Math.hypot(px - cx, py - cy);
      return d <= rad - 1 && d > rad - 2.2 && py < cy - 1;
    }, b.seam);
  } else {
    // A glossy highlight, upper left.
    r.fillCircleSmooth(cx - 2.2, cy - 2.4, 1.7, b.gloss);
  }
  if (!p.glyph) return r; // inactive windows show plain tiles
  const ink = pressed ? b.gloss : p.glyph;
  const dy = pressed ? 0.7 : 0, a = 4.3, z = box.w - 4.3, m = box.w / 2;
  const stroke = (x0, y0, x1, y1) => r.strokeLineSmooth(box.x + x0, box.y + y0 + dy, box.x + x1, box.y + y1 + dy, 1.7, ink);
  if (role === 'close') { stroke(a + 0.4, a + 0.4, z - 0.4, z - 0.4); stroke(z - 0.4, a + 0.4, a + 0.4, z - 0.4); }
  if (role === 'zoom') { stroke(a, m, z, m); stroke(m, a, m, z); }
  if (role === 'collapse') stroke(a, m, z, m);
  return r;
}

/** The pressed strip: close | zoom | collapse at the document rect sizes, built from the active frame. */
export function pressedStrip(strip, activeFrame) {
  return pressedStripFrom({ strip, activeFrame, draw: (role, raster, box) => drawWidget(raster, box, role, 'active', true) });
}
