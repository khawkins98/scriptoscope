// Brickworks scroll bars: a grey channel sunk on its top/left, blue 1×1 plate
// arrow buttons with white arrowheads, and a red 2×1 brick thumb seen from
// above with its two studs. Flat colours and whole-pixel glyphs only.
//
// The engine rules are the ones Halcyon's parts/scrollbars.mjs documents
// (docs/spec/engine/scrollbar.md): one TRACK cicn per tier holds both arrows
// and a 3px track source whose middle is stretched, so the track may only vary
// ACROSS the bar; every image is opaque; the pressed track's middle equals the
// normal one; thumbs are copied 1:1 and must be opaque with the track painted
// into their sides.
import { Raster, encodeCicn } from '../../../tools/theme-author/index.js';
import { BRICK, OUTLINE } from './palette.mjs';

const B = BRICK.blue, RED = BRICK.red;
const SB = {
  line: OUTLINE,        // hairline facing the content, and the arrow dividers
  sunk: '#999999',      // the channel's sunk top/left line
  track: '#cccccc',
  inactive: { line: '#999999', sunk: '#cccccc', track: '#eeeeee' },
};

/** A raster addressed as (u across the bar, v along it). Light comes from low u and low v. */
function barRaster(horizontal, cross, along) {
  const r = horizontal ? new Raster(along, cross) : new Raster(cross, along);
  const box = (u, v, w, h) => (horizontal ? [v, u, h, w] : [u, v, w, h]);
  const b = {
    r,
    fill: (u, v, w, h, c) => { r.fillRect(...box(u, v, w, h), c); return b; },
    px: (u, v, c) => { if (horizontal) r.set(v, u, c); else r.set(u, v, c); return b; },
  };
  return b;
}

function paintTrack(b, cross, along, look = SB) {
  b.fill(0, 0, cross, along, look.track);
  b.fill(0, 0, 1, along, look.line);
  b.fill(1, 0, 1, along, look.sunk);
}

/** A whole-pixel arrowhead centred on (cu, cv) pointing to low v (dir -1) or high v (+1). */
function arrowhead(b, cu, cv, dir, big, color) {
  const rows = big ? [1, 3, 5, 7] : [1, 3, 5];
  const v0 = cv + Math.floor(rows.length / 2) * dir; // the tip
  rows.forEach((w, i) => b.fill(cu - (w - 1) / 2, v0 - i * dir, w, 1, color));
}

/** A blue 1×1 plate arrow button over v0..v0+d. `end` low: divider after it; high: divider before it. */
function paintArrow(b, t, v0, d, end, cap, dir, look) {
  const fv0 = end === 'low' ? v0 : v0 + 1;
  const fv1 = v0 + d - (end === 'low' || cap ? 1 : 0); // exclusive
  const pressed = look === 'pressed';
  const face = pressed ? { hi: B.deep, base: B.deep, lo: B.lo } : B;
  b.fill(1, fv0, t - 1, fv1 - fv0, face.base);
  b.fill(1, fv0, t - 1, 1, face.hi).fill(1, fv0, 1, fv1 - fv0, face.hi);
  b.fill(t - 1, fv0, 1, fv1 - fv0, face.lo).fill(1, fv1 - 1, t - 1, 1, face.lo);
  b.fill(0, v0, 1, d, SB.line);
  b.fill(0, end === 'low' ? v0 + d - 1 : v0, t, 1, SB.line);
  if (cap) b.fill(0, v0 + d - 1, t, 1, SB.line);
  const ink = look === 'off' ? B.hi : pressed ? B.hi : '#ffffff';
  arrowhead(b, Math.floor((1 + t) / 2), Math.floor((fv0 + fv1 - 1) / 2), dir, t >= 14, ink);
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

// A stud on the thumb, seen from above: lit upper-left arc, shaded lower-right.
const THUMB_STUD = ['.oooo.', 'ohhhbo', 'ohbbdo', 'ohbbdo', 'obdddo', '.oooo.'];
const THUMB_STUD_SMALL = ['.oo.', 'ohbo', 'obdo', '.oo.'];

/** A red 2×1 brick seen from above: opaque, the track painted into its sides, two studs on its face. */
function thumbImage(horizontal, t, pressed, ghost = false) {
  const small = t <= 11;
  const along = small ? 16 : 24;
  const b = barRaster(horizontal, t, along);
  const u0 = 2, u1 = t - 2; // brick columns across (inclusive)
  const w = u1 - u0 + 1, h = along - 2;
  if (ghost) {
    b.fill(u0, 1, w, h, RED.hi);
    b.fill(u0, 1, w, 1, RED.base).fill(u0, along - 2, w, 1, RED.base).fill(u0, 1, 1, h, RED.base).fill(u1, 1, 1, h, RED.base);
    return b.r;
  }
  paintTrack(b, t, along);
  const face = pressed ? { hi: RED.lo, base: RED.lo, lo: RED.deep } : RED;
  b.fill(u0, 1, w, h, face.base);
  b.fill(u0 + 1, 2, w - 2, 1, face.hi).fill(u0 + 1, 2, 1, h - 2, face.hi);
  b.fill(u1 - 1, 2, 1, h - 2, face.lo).fill(u0 + 1, along - 3, w - 2, 1, face.lo);
  b.fill(u0, 1, w, 1, OUTLINE).fill(u0, along - 2, w, 1, OUTLINE).fill(u0, 1, 1, h, OUTLINE).fill(u1, 1, 1, h, OUTLINE);
  const sprite = small ? THUMB_STUD_SMALL : THUMB_STUD, sw = sprite.length;
  const cu = u0 + Math.floor((w - sw) / 2);
  const studs = small ? [3, 9] : [4, 14];
  const look = { o: OUTLINE, h: pressed ? RED.base : RED.hi, b: face.base, d: RED.deep };
  for (const v of studs) sprite.forEach((row, dv) => [...row].forEach((ch, du) => { if (ch !== '.') b.px(cu + du, v + dv, look[ch]); }));
  return b.r;
}

function littleArrows(look, part = 'both') {
  const W = 13, H = 23, split = 11;
  const r = new Raster(W, H);
  const inactive = look === 'inactive';
  const half = (y0, y1, up, isPressed) => {
    const face = inactive ? { hi: '#ffffff', base: '#eeeeee', lo: '#cccccc' } : isPressed ? { hi: B.deep, base: B.deep, lo: B.lo } : B;
    r.fillRect(0, y0, W, y1 - y0, face.base);
    r.hline(1, y0 + 1, W - 2, face.hi).vline(1, y0 + 1, y1 - y0 - 2, face.hi);
    r.vline(W - 2, y0 + 1, y1 - y0 - 2, face.lo).hline(1, y1 - 2, W - 2, face.lo);
    r.strokeRect(0, y0, W, y1 - y0, inactive ? '#999999' : OUTLINE);
    const ink = inactive ? '#cccccc' : isPressed ? B.hi : '#ffffff';
    const cy = Math.floor((y0 + y1 - 1) / 2);
    [1, 3, 5].forEach((w, i) => r.hline(6 - (w - 1) / 2, up ? cy - 1 + i : cy + 1 - i, w, ink));
  };
  if (part !== 'down') half(0, split + 1, true, look === 'pressed' && part === 'up');
  if (part !== 'up') half(split, H, false, look === 'pressed' && part === 'down');
  r.set(0, 0, null).set(W - 1, 0, null).set(0, H - 1, null).set(W - 1, H - 1, null);
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
