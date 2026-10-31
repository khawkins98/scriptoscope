// Title-bar widgets, drawn straight onto the frame, plus the pressed-widget
// strip (cicn -14330, and -14298 for classic utility windows).
//
// One family: every widget is the same 14px sandstone disc with a dark
// 1-2-1 stair rim, a lit arc on the upper left and a shaded arc on the lower
// right. The glyph sits inside on whole pixels:
//
//   close     a cherry rosette
//   zoom      a shield inspired by Bonn's arms: black cross on white over a gold lion on red
//   collapse  a breaking teal wave
//
// Pressed: the face drops to the shade colour and the lit and shaded arcs swap
// (the disc is pushed in). Inactive: a grey disc, no glyph. The pressed
// strip's mask is the hit region (exotic-frames R24), so each pressed piece
// keeps exactly the disc's silhouette.
import { pressedStripFrom } from '../../../tools/theme-author/index.js';
import { C } from './palette.mjs';

export const WIDGET = 14;

// o rim, f face, L lit arc, D shaded arc.
const DISC = [
  '.....oooo.....',
  '...ooLLLLoo...',
  '..oLLffffffo..',
  '.oLffffffffDo.',
  '.oLffffffffDo.',
  'oLffffffffffDo',
  'oLffffffffffDo',
  'oLffffffffffDo',
  'oLffffffffffDo',
  '.oLffffffffDo.',
  '.offffffffDDo.',
  '..offfffDDDo..',
  '...ooDDDDoo...',
  '.....oooo.....',
];

function disc(r, b, p, { face, lit, shade, top, bottom }) {
  const half = (y) => (top && bottom ? (y < 7 ? top : bottom) : face);
  DISC.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch === '.') return;
    const c = ch === 'o' ? p.outline : ch === 'L' ? (top ? half(y) : lit) : ch === 'D' ? (bottom ? half(y) : shade) : half(y);
    r.set(b.x + x, b.y + y, c);
  }));
}

// Glyphs, centred in the 14px disc (offset (14 − size) / 2).
const ROSE = [
  '..l.a..',
  '.llaaa.',
  'laaaaad',
  '.aacad.',
  'aaaaadd',
  '.aaddd.',
  '..a.d..',
];
// A stylised shield inspired by the City of Bonn's arms: a white top with a
// black cross, a red bottom with a gold lion walking to the left, tail up.
// At this size the lion is a blob with a head, legs and a raised tail.
const SHIELD = [
  'ooooooooo',
  'oWWWkWWWo',
  'okkkkkkko',
  'oWWWkWWWo',
  'oRRRRRRYo',
  'oYYRRRYRo',
  'oYYYYYYRo',
  '.oYRRYRo.',
  '..oRRRo..',
  '...ooo...',
];
// A breaking wave: lit crest, teal body, deep base.
const WAVE = [
  '....ttt..',
  '..ttTTTt.',
  '.tTTt..t.',
  'tTTt.....',
  'tTTt..t..',
  'ttttttt..',
];
const glyph = (r, b, rows, legend, dy = 0) => {
  const ox = Math.floor((WIDGET - rows[0].length) / 2), oy = Math.floor((WIDGET - rows.length) / 2) + dy;
  r.sprite(b.x + ox, b.y + oy, rows, legend);
};

function look(state, pressed) {
  const p = C[state];
  if (state !== 'active') return { p, face: '#cccccc', lit: '#dddddd', shade: '#bbbbbb' };
  return pressed ? { p, face: p.stoneLo, lit: p.mortar, shade: p.stone } : { p, face: p.stone, lit: p.stoneHi, shade: p.stoneLo };
}

export function drawClose(r, b, state, pressed = false) {
  const k = look(state, pressed);
  disc(r, b, k.p, k);
  if (state !== 'active') return;
  const a = C.active;
  glyph(r, b, ROSE, { l: a.blossomHi, a: a.blossom, d: a.blossomLo, c: pressed ? a.yellow : a.blossomLo });
}

export function drawZoom(r, b, state, pressed = false) {
  const k = look(state, pressed);
  if (state !== 'active') { disc(r, b, k.p, k); return; }
  const a = C.active;
  disc(r, b, k.p, k);
  const A = a.arms;
  glyph(r, b, SHIELD, { o: a.outline, W: A.white, k: A.cross, R: pressed ? A.redLo : A.red, Y: pressed ? A.goldLo : A.gold });
}

export function drawCollapse(r, b, state, pressed = false) {
  const k = look(state, pressed);
  disc(r, b, k.p, k);
  if (state !== 'active') return;
  const a = C.active;
  glyph(r, b, WAVE, { t: a.waterLo, T: pressed ? a.foam : a.water });
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
