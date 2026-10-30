// Title-bar widgets: flat round 1×1 bricks pressed into the corner bricks,
// drawn straight onto the frame so their smooth rims blend with the real brick
// pixels under them (authoring guide §4.5). Same plastic rules as the frame
// (visual-design review §1.3): a dark rim, a flat face, one lit fleck upper
// left, and a glyph stamped on whole pixels (no smooth strokes).
//
//   close     red round brick, printed ×
//   zoom      green round brick, printed +
//   collapse  blue round brick, printed −
//
// The disc is 13px (an odd size, so a 5px glyph has a centre pixel) in the
// 14px widget box. Pressed inverts rather than darkens: the face goes `deep`,
// a seam-coloured lip runs along the sunk top edge and the glyph turns
// `gloss`. Inactive keeps the brick and drops the glyph. The pressed strip
// (cicn -14330) is built by the toolkit's pressedStripFrom, so each piece's
// mask is exactly the round brick: that mask is the click area (R24).
import { pressedStripFrom } from '../../../tools/theme-author/index.js';
import { pal } from './palette.mjs';

const ROLE_COLOUR = { close: 'red', zoom: 'green', collapse: 'blue' };

// 5×5 glyphs, centred on the disc's centre pixel.
const GLYPH = {
  close: ['X...X', '.X.X.', '..X..', '.X.X.', 'X...X'],
  zoom: ['..X..', '..X..', 'XXXXX', '..X..', '..X..'],
  collapse: ['.....', '.....', 'XXXXX', '.....', '.....'],
};

export function drawWidget(r, box, role, state, pressed = false) {
  const p = pal(state);
  const b = p[ROLE_COLOUR[role]];
  const active = state === 'active';
  const D = box.w - 1, rad = D / 2, cx = box.x + rad, cy = box.y + rad;
  const c = Math.floor(rad); // the centre pixel, relative to the box
  r.fillCircleSmooth(cx, cy, rad, active ? b.seam : p.outline);
  r.fillCircleSmooth(cx, cy, rad - 1, pressed ? b.deep : b.base);
  if (pressed) {
    // Sunk: a dark lip just inside the top of the rim.
    r.hline(box.x + c - 2, box.y + 1, 5, b.seam);
    r.set(box.x + c - 3, box.y + 2, b.seam).set(box.x + c + 3, box.y + 2, b.seam);
  } else {
    // One lit fleck, upper left.
    r.set(box.x + c - 3, box.y + c - 2, b.gloss).set(box.x + c - 2, box.y + c - 3, b.gloss);
  }
  if (!p.glyph) return r; // inactive windows show plain bricks
  const ink = pressed ? b.gloss : p.glyph;
  const dy = pressed ? 1 : 0;
  return r.sprite(box.x + c - 2, box.y + c - 2 + dy, GLYPH[role], { X: ink });
}

/** The pressed strip: close | zoom | collapse at the document rect sizes, built from the active frame. */
export function pressedStrip(strip, activeFrame) {
  return pressedStripFrom({ strip, activeFrame, draw: (role, raster, box) => drawWidget(raster, box, role, 'active', true) });
}
