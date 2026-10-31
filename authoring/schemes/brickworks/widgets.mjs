// Title-bar widgets: three round studs seen from above, one silhouette and one
// glyph grammar (visual-design guide §2.6), drawn straight onto the frame:
//
//   close     red stud, printed ×
//   zoom      green stud, printed +
//   collapse  blue stud, printed −
//
// The knob is a hand-placed 15px sprite (sprites.mjs KNOB): a 1-2-1 stair
// rim, a lit arc upper left, a 1px shade lower right, a flat face and a
// 7px white glyph on whole pixels. Pressed inverts the bevel (shade upper left,
// light lower right) on a `deep` face. Inactive windows show plain grey studs
// with no glyph. The pressed strip (cicn -14330) is built by the toolkit's
// pressedStripFrom, so each piece's mask is exactly the disc: that mask is
// the click area (R24).
import { pressedStripFrom } from '../../../tools/theme-author/index.js';
import { pal, BRICK } from './palette.mjs';
import { KNOB, KNOB_SIZE, GLYPH } from './sprites.mjs';

const ROLE_COLOUR = { close: 'red', zoom: 'green', collapse: 'blue' };
export const WIDGET = KNOB_SIZE;

export function drawWidget(r, box, role, state, pressed = false) {
  const p = pal(state);
  const active = state === 'active';
  const b = active ? BRICK[ROLE_COLOUR[role]] : null;
  const look = !active
    ? { o: p.outline, h: '#ffffff', b: '#cccccc', l: '#999999' }
    : pressed
      ? { o: p.outline, h: b.lo, b: b.deep, l: b.base }
      : { o: p.outline, h: b.hi, b: b.base, l: b.lo };
  r.sprite(box.x, box.y, KNOB, look);
  if (!active) return r;
  const c = Math.floor(KNOB_SIZE / 2);
  return r.sprite(box.x + c - 3, box.y + c - 3, GLYPH[role], { X: '#ffffff' });
}

/** The pressed strip: close | zoom | collapse at the document rect sizes, built from the active frame. */
export function pressedStrip(strip, activeFrame) {
  return pressedStripFrom({ strip, activeFrame, draw: (role, raster, box) => drawWidget(raster, box, role, 'active', true) });
}
