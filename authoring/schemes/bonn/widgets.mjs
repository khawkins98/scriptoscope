// Bonn's 26px title-bar medallions: a five-petal cherry rose, a shield inspired
// by the city's arms, and a breaking Rhine wave. Art is placed at the custom
// wnd# rectangles supplied by frames.mjs, always inside fixed cells.
//
// Pressed art reverses the sandstone bevel and darkens the motif. Inactive
// medallions keep a legible grey motif. The pressed strip is cut from the same
// draw functions, so its mask matches the disc rather than a square hit box.
import { pressedStripFrom } from '../../../tools/theme-author/index.js';
import { C } from './palette.mjs';

export const WIDGET = 26;

function look(state, pressed) {
  const p = C[state];
  return { p, face: pressed ? p.stoneLo : p.stone,
    lit: pressed ? p.mortar : p.stoneHi, shade: pressed ? p.stone : p.stoneLo };
}

// Whole-pixel circle with an outlined rim, two-pixel bevel and inset face.
function disc(r, b, k) {
  for (let y = 0; y < WIDGET; y++) for (let x = 0; x < WIDGET; x++) {
    const dx = x - 12.5, dy = y - 12.5, d = Math.hypot(dx, dy);
    if (d > 12.5) continue;
    const c = d > 11.5 ? k.p.outline : d > 9.5 ? (dx + dy < 0 ? k.lit : k.shade) : k.face;
    r.set(b.x + x, b.y + y, c);
  }
}

// Five petals with one shared outline, a lit upper-left face, shaded folds,
// and a gold centre. Each petal is painted directly on the native pixel grid.
const PETALS = [[12, 7], [17, 10], [15, 16], [9, 16], [7, 10]];
const inRose = (x, y) => PETALS.some(([cx, cy]) => (x - cx) ** 2 + (y - cy) ** 2 <= 16);
export function drawClose(r, b, state, pressed = false) {
  const k = look(state, pressed), p = k.p;
  disc(r, b, k);
  for (let y = 3; y <= 20; y++) for (let x = 3; x <= 21; x++) {
    if (!inRose(x, y)) continue;
    const edge = !inRose(x - 1, y) || !inRose(x + 1, y) || !inRose(x, y - 1) || !inRose(x, y + 1);
    const nearest = PETALS.reduce((a, c) => (x - c[0]) ** 2 + (y - c[1]) ** 2 < (x - a[0]) ** 2 + (y - a[1]) ** 2 ? c : a);
    const [cx, cy] = nearest;
    const c = edge ? p.blossomLo : x + y < cx + cy ? p.blossomHi : pressed ? p.blossomLo : p.blossom;
    r.set(b.x + x, b.y + y, c);
  }
  for (let y = 10; y <= 14; y++) for (let x = 10; x <= 14; x++) {
    const d = (x - 12) ** 2 + (y - 12) ** 2;
    if (d <= 5) r.set(b.x + x, b.y + y, d >= 4 ? p.outline : pressed ? p.arms.goldLo : p.arms.gold);
  }
}

// A broad white chief and black cross above a red field with a walking gold
// lion. It is a stylised emblem inspired by the arms, not an official crest.
function shieldLeft(y) { return y < 14 ? 5 : y < 17 ? 6 : y < 19 ? 7 : y - 11; }
function inShield(x, y) { return y >= 3 && y <= 23 && x >= shieldLeft(y) && x <= 25 - shieldLeft(y); }
const LION = [
  '..........gg.',
  '.gg......g.g.',
  'ggggg...gg...',
  '.gggggggg....',
  '..ggggggg....',
  '.gg.ggg.g....',
  '.g..g..gg....',
  '.gg.....gg...',
];
export function drawZoom(r, b, state, pressed = false) {
  const k = look(state, pressed), p = k.p, a = p.arms;
  disc(r, b, k);
  for (let y = 3; y <= 23; y++) for (let x = 4; x <= 21; x++) {
    if (!inShield(x, y)) continue;
    const edge = !inShield(x - 1, y) || !inShield(x + 1, y) || !inShield(x, y - 1) || !inShield(x, y + 1);
    const upper = y <= 11;
    const c = edge ? p.outline : upper ? (x === 12 || x === 13 || y === 7 || y === 8 ? a.cross : a.white) : pressed ? a.redLo : a.red;
    r.set(b.x + x, b.y + y, c);
  }
  LION.forEach((row, y) => [...row].forEach((ch, x) => {
    const dx = x + 6, dy = y + 13;
    if (ch === 'g' && inShield(dx - 1, dy) && inShield(dx + 1, dy) && inShield(dx, dy + 1))
      r.set(b.x + dx, b.y + dy, pressed ? a.goldLo : a.gold);
  }));
}

// The curling crest keeps a clear inner opening; a short foam line follows
// the top edge instead of filling the whole wave with white.
const WAVE = [
  '.......oooo.......',
  '.....ooFFFFoo.....',
  '...ooFFTTTTTTo....',
  '..oFFTTTo...oTo...',
  '.oFFTTTo....oTo...',
  '.oFTTTo.....oTo...',
  'oFTTTo......oo....',
  'oTTTTo............',
  'oTTTTTo....ooo....',
  '.oTTTTTooooFFTo...',
  '..oTTTTTTTTTTTo...',
  '...ooooooooooo....',
];
export function drawCollapse(r, b, state, pressed = false) {
  const k = look(state, pressed), p = k.p;
  disc(r, b, k);
  r.sprite(b.x + 4, b.y + 7, WAVE, {
    o: p.waterLo, F: pressed ? p.waterHi : p.foam, T: pressed ? p.waterLo : p.water,
  });
}

export const DRAW = { close: drawClose, zoom: drawZoom, collapse: drawCollapse };

// Classic utilities use -14298; the web uses -14330. Both use26px close
// pieces, so the document strip is compatible with close-only utilities.
export function pressedStrip(strip, activeFrame) {
  return pressedStripFrom({ strip, activeFrame, draw: (role, raster, box) => DRAW[role](raster, box, 'active', true) });
}
