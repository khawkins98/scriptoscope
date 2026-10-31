// Bonn scroll bars, after the concept: a sandstone track with a mortar
// groove, the arrows are sandstone plates with whole-pixel red
// arrowheads (red stays small: it is the title's colour), and the thumb is a
// sandstone block with three carved grip dots. Pressed arrows sink to the
// shade colour. Structure from Castle's scrollbars.mjs (same engine rules,
// new art).
//
// The engine rules are the ones Kingfisher's parts/scrollbars.mjs documents
// (docs/spec/engine/scrollbar.md): one TRACK cicn per tier holds both arrows
// and a 3px track source whose middle is stretched, so the track may only vary
// ACROSS the bar (no joints along it); every image is
// opaque; the pressed track's middle equals the normal one; thumbs are copied
// 1:1 and must be opaque with the track painted into their sides.
import { Raster, encodeCicn } from '../../../tools/theme-author/index.js';
import { C } from './palette.mjs';
import { roundRect, bevel } from './pixels.mjs';

const A = C.active;
const SB = {
  line: A.outline,      // hairline facing the content, and the arrow dividers
  // The channel across the bar: sandstone, as in the concept, shaded on the
  // side by the content and lit on the far side, with a mortar groove.
  channel: (u, t) => (u === 1 ? A.stoneLo : u === 2 ? A.mortar : u === t - 1 ? A.stoneHi : A.stone),
  face: A.stone, faceHi: A.stoneHi, faceLo: A.stoneLo,
  arrow: A.red, arrowOff: A.stoneLo,
  pressedFace: A.stoneLo, pressedHi: A.mortar, pressedLo: A.stone, pressedArrow: A.redLo,
  thumb: A.stone, thumbHi: A.stoneHi, thumbLo: A.stoneLo,
  thumbPressed: A.stoneLo, thumbPressedHi: A.mortar, thumbPressedLo: A.stone,
  thumbEdge: A.outline, grip: A.mortar, gripPressed: A.outline,
  inactive: { line: '#999999', channel: (u) => (u === 1 ? '#cccccc' : '#eeeeee') },
};

/** A raster addressed as (u across the bar, v along it). */
function barRaster(horizontal, cross, along) {
  const r = horizontal ? new Raster(along, cross) : new Raster(cross, along);
  const box = (u, v, w, h) => (horizontal ? [v, u, h, w] : [u, v, w, h]);
  return {
    r,
    fill: (u, v, w, h, c) => r.fillRect(...box(u, v, w, h), c),
    round: (u, v, w, h, rad, c, opts) => r.fillRoundRectSmooth(...box(u, v, w, h), rad, c, opts),
  };
}

function paintTrack(b, cross, along, look = SB) {
  for (let u = 0; u < cross; u++) b.fill(u, 0, 1, along, u === 0 ? look.line : look.channel(u, cross));
}

/**
 * A whole-pixel arrowhead pointing to the low (-1) or high (+1) end: rows of
 * 1, 3, 5 (… `rows`) pixels, centred on column `cu` and the face's middle.
 */
function arrowhead(b, cu, v0, v1, dir, rows, color) {
  const start = v0 + ((v1 - v0 - rows) >> 1);
  for (let i = 0; i < rows; i++) {
    const half = dir < 0 ? i : rows - 1 - i;          // the tip row is 1px
    b.fill(cu - half, start + i, 2 * half + 1, 1, color);
  }
}

function paintArrow(b, t, v0, d, end, cap, dir, look) {
  const divider = end === 'low' ? v0 + d - 1 : v0;
  const faceV0 = end === 'low' ? v0 : v0 + 1;
  const faceV1 = v0 + d - (end === 'low' || cap ? 1 : 0);
  const pressed = look === 'pressed';
  const [face, hi, lo] = pressed ? [SB.pressedFace, SB.pressedHi, SB.pressedLo] : [SB.face, SB.faceHi, SB.faceLo];
  // A raised sandstone button: lit top and left, shaded bottom and right.
  b.fill(1, faceV0, t - 1, faceV1 - faceV0, face);
  b.fill(1, faceV0, 1, faceV1 - faceV0, hi);
  b.fill(1, faceV0, t - 1, 1, hi);
  b.fill(t - 1, faceV0, 1, faceV1 - faceV0, lo);
  b.fill(1, faceV1 - 1, t - 1, 1, lo);
  b.fill(0, v0, 1, d, SB.line);
  b.fill(0, divider, t, 1, SB.line);
  if (cap) b.fill(0, v0 + d - 1, t, 1, SB.line);
  const ink = look === 'off' ? SB.arrowOff : pressed ? SB.pressedArrow : SB.arrow;
  // Centre on the face inside the bevel (u 2 … t-2).
  arrowhead(b, (t >> 1), faceV0 + 1, faceV1 - 1, dir, t >= 14 ? 3 : 2, ink);
}

function trackImage(horizontal, t, look, double) {
  const d = t - 1, cells = double ? 2 : 1, mid = 3;
  const along = 2 * cells * d + mid;
  const b = barRaster(horizontal, t, along);
  paintTrack(b, t, along);
  const dirs = double ? [-1, 1] : [-1];
  dirs.forEach((dir, i) => paintArrow(b, t, i * d, d, 'low', false, dir, look));
  const highDirs = double ? [-1, 1] : [1];
  highDirs.forEach((dir, i) => paintArrow(b, t, along - (cells - i) * d, d, 'high', i === cells - 1, dir, look));
  return b.r;
}

function inactiveImage(horizontal, t) {
  const along = 2 * (t - 1) + 3;
  const b = barRaster(horizontal, t, along);
  paintTrack(b, t, along, SB.inactive);
  b.fill(0, along - 1, t, 1, SB.inactive.line);
  return b.r;
}

/** Sandstone thumb with three carved grip dots; opaque, with the track painted into its sides. */
function thumbImage(horizontal, t, pressed, ghost = false) {
  const small = t <= 11;
  const along = small ? 16 : 23;
  const b = barRaster(horizontal, t, along);
  paintTrack(b, t, along);
  // The block, across u 2 … t-2, along v 1 … along-2 (drawn in bar coordinates via a scratch raster).
  const w = t - 3, h = along - 2;
  const block = new Raster(w, h);
  const [face, hi, lo] = pressed ? [SB.thumbPressed, SB.thumbPressedHi, SB.thumbPressedLo] : [SB.thumb, SB.thumbHi, SB.thumbLo];
  if (ghost) bevel(block, 0, 0, w, h, roundRect(w, h, 3), { outline: SB.thumbEdge, hi: null, lo: null, face: null });
  else bevel(block, 0, 0, w, h, roundRect(w, h, 3), { outline: SB.thumbEdge, hi, lo, face });
  for (let v = 0; v < h; v++) for (let u = 0; u < w; u++) { const c = block.get(u, v); if (c) b.fill(2 + u, 1 + v, 1, 1, c); }
  if (!ghost) {
    const cu = 2 + (w >> 1), cv = 1 + (h >> 1);
    // Three dark grip dots, each with a lit pixel below right (a carved notch).
    for (const dv of [-3, 0, 3]) {
      b.fill(cu, cv + dv, 1, 1, pressed ? SB.gripPressed : SB.grip);
      b.fill(cu + 1, cv + dv + 1, 1, 1, pressed ? SB.pressedLo : A.stoneHi);
    }
  }
  return b.r;
}

/** Little arrows: two sandstone half-plates with whole-pixel red arrowheads. */
function littleArrows(look, part = 'both') {
  const W = 13, H = 23, split = 11;
  const r = new Raster(W, H);
  const pressed = look === 'pressed', inactive = look === 'inactive';
  const edge = inactive ? '#999999' : SB.line;
  const half = (y0, y1, dir, isPressed, corners) => {
    const h = y1 - y0;
    const [face, hi, lo] = isPressed ? [SB.pressedFace, SB.pressedHi, SB.pressedLo]
      : inactive ? ['#eeeeee', '#ffffff', '#dddddd'] : [SB.face, SB.faceHi, SB.faceLo];
    bevel(r, 0, y0, W, h, roundRect(W, h, 3, corners), { outline: edge, hi, lo, face });
    const ink = isPressed ? SB.pressedArrow : inactive ? '#bbbbbb' : SB.arrow;
    const rows = 3, top = y0 + ((h - rows) >> 1);
    for (let i = 0; i < rows; i++) {
      const k = dir < 0 ? i : rows - 1 - i;
      r.fillRect(6 - k, top + i, 2 * k + 1, 1, ink);
    }
  };
  if (part !== 'down') half(0, split + 1, -1, pressed && part === 'up', 'tl tr');
  if (part !== 'up') half(split, H, 1, pressed && part === 'down', 'bl br');
  return r;
}

export function build(add) {
  const orient = [['Horizontal', true, -8288], ['Vertical', false, -8280]];
  for (const [label, horizontal, base] of orient) {
    for (const [size, t, off, dbl] of [['', 16, 0, 4], ['Small ', 11, 18, 22]]) {
      add('cicn', base + off, encodeCicn(inactiveImage(horizontal, t)), `Inactive ${size}${label} Scroll Bar`);
      for (const [tier, look, what] of [[1, 'off', 'Nothing To Scroll'], [2, 'normal', ''], [3, 'pressed', 'Pressed']]) {
        const name = (pre) => `${what ? `${what} ` : ''}${size}${pre}${label} Scroll Bar`;
        add('cicn', base + off + tier, encodeCicn(trackImage(horizontal, t, look, false)), name(''));
        add('cicn', base + dbl + tier, encodeCicn(trackImage(horizontal, t, look, true)), name('Double-Headed '));
      }
    }
  }
  for (const [id, horizontal, pressed] of [[-10208, false, false], [-10207, false, true], [-10206, true, false], [-10205, true, true]]) {
    const label = `${pressed ? 'Pressed ' : ''}${horizontal ? 'Horizontal' : 'Vertical'} Thumb`;
    add('cicn', id, encodeCicn(thumbImage(horizontal, 16, pressed)), label);
    add('cicn', id + 1956, encodeCicn(thumbImage(horizontal, 11, pressed)), `Small ${label}`);
  }
  for (const [id, horizontal] of [[-8272, false], [-8271, true]]) {
    const label = `${horizontal ? 'Horizontal' : 'Vertical'} Ghost Thumb`;
    add('cicn', id, encodeCicn(thumbImage(horizontal, 16, false, true)), label);
    add('cicn', id + 18, encodeCicn(thumbImage(horizontal, 11, false, true)), `Small ${label}`);
  }
  add('cicn', -10048, encodeCicn(littleArrows('inactive')), 'Inactive Little Arrows');
  add('cicn', -10047, encodeCicn(littleArrows('normal')), 'Little Arrows');
  add('cicn', -10046, encodeCicn(littleArrows('pressed', 'up')), 'Pressed Up Little Arrow');
  add('cicn', -10045, encodeCicn(littleArrows('pressed', 'down')), 'Pressed Down Little Arrow');
}
