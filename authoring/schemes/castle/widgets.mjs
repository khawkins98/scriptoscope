// Title-bar widgets, drawn straight onto the frame, plus the pressed-widget
// strip (cicn -14330).
//
// One family: every widget is the same 14×14 dressed-stone plate (dark rim,
// corners stepped off, lit top/left bevel, shaded bottom/right) with a
// whole-pixel emblem on it (authoring-visual-design §2.6):
//
//   close     a heater shield, blue field, gold chevron
//   zoom      an arched opening: a 2px dark arch round a lit parchment pane
//   collapse  a drawbridge raised: a chevron over an oak plank
//
// Pressed is inverted, not darkened: the plate sinks (#777777, bevel flipped)
// and the emblem lights up gold (the shield goes gold with a blue chevron, the
// window glows, the chevron turns gold). Inactive keeps the plate and drops
// the emblem.
//
// The pressed strip's mask is the hit region (R24), so the pressed art keeps
// exactly the plate's silhouette.
import { pressedStripFrom } from '../../../tools/theme-author/index.js';
import { C } from './palette.mjs';

export const WIDGET = 14;

// 10×11 heater shield. o rim, h lit field, f field, g chevron (apex on the two centre columns).
const SHIELD = [
  'oooooooooo',
  'ohhhhhhhfo',
  'ohffggfffo',
  'ohfggggffo',
  'ohggffggfo',
  'oggffffggo',
  'ogffffffgo',
  '.offffffo.',
  '..offffo..',
  '...offo...',
  '....oo....',
];

// 10×10 arched opening (the concept's zoom emblem): a 2px dark arch round a
// lit parchment pane.
const WINDOW = [
  '...####...',
  '..######..',
  '.##wwww##.',
  '##wwwwww##',
  '##wwwwww##',
  '##wwwwww##',
  '##wwwwww##',
  '##wwwwww##',
  '##########',
  '##########',
];
// 10×8 raised drawbridge: chevron, then an oak plank in an iron rim.
const BRIDGE = [
  '....##....',
  '...####...',
  '..##..##..',
  '.##....##.',
  '..........',
  '##########',
  '#pppppppp#',
  '##########',
];

/** The 14×14 stone plate: rim with stepped corners, flat face, 1px bevel. */
function plate(r, b, p, pressed) {
  const { x, y, w, h } = b;
  r.fillRect(x + 1, y, w - 2, h, p.outline).fillRect(x, y + 1, w, h - 2, p.outline);
  const face = pressed ? '#777777' : p.plate;
  const hi = pressed ? '#666666' : p.plateHi, lo = pressed ? '#999999' : p.plateLo;
  r.fillRect(x + 1, y + 1, w - 2, h - 2, face);
  r.hline(x + 1, y + 1, w - 2, hi).vline(x + 1, y + 1, h - 2, hi);
  r.hline(x + 2, y + h - 2, w - 3, lo).vline(x + w - 2, y + 2, h - 3, lo);
}

export function drawClose(r, b, state, pressed = false) {
  const p = C[state];
  plate(r, b, p, pressed);
  if (state !== 'active') return r;
  const field = pressed ? p.gold : p.field, lit = pressed ? '#ffff99' : '#6699cc', ink = pressed ? p.field : p.gold;
  r.sprite(b.x + 2, b.y + 2, SHIELD, { o: p.outline, h: lit, f: field, g: ink });
  return r;
}

export function drawZoom(r, b, state, pressed = false) {
  const p = C[state];
  plate(r, b, p, pressed);
  if (state !== 'active') return r;
  r.sprite(b.x + 2, b.y + 2, WINDOW, { '#': p.glyph, w: pressed ? p.gold : p.window });
  return r;
}

export function drawCollapse(r, b, state, pressed = false) {
  const p = C[state];
  plate(r, b, p, pressed);
  if (state !== 'active') return r;
  r.sprite(b.x + 2, b.y + 3, BRIDGE, { '#': pressed ? p.gold : p.glyph, p: p.oak });
  if (pressed) r.sprite(b.x + 2, b.y + 8, ['##########', '#........#', '##########'], { '#': p.glyph });
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
