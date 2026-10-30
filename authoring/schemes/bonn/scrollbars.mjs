// Bonn scroll bars: a sandstone channel, sandstone arrow buttons (lit top
// and left, shaded bottom and right) with whole-pixel city-red arrowheads, and
// a Rhine-teal thumb with a whole-pixel wave grip. Red is the title colour, so
// it appears only in the arrowheads; pressed buttons invert to a red face with
// a cream arrowhead. Structure from Castle's scrollbars.mjs (same engine
// rules, new art).
//
// The engine rules are the ones Halcyon's parts/scrollbars.mjs documents
// (docs/spec/engine/scrollbar.md): one TRACK cicn per tier holds both arrows
// and a 3px track source whose middle is stretched, so the track may only vary
// ACROSS the bar (no dithering, no stone joints along it); every image is
// opaque; the pressed track's middle equals the normal one; thumbs are copied
// 1:1 and must be opaque with the track painted into their sides.
import { Raster, encodeCicn } from '../../../tools/theme-author/index.js';

// Classic shows these as the nearest system colours: face and track share
// one entry (#d4d4a8), so the bevel and the dividers do the separating.
const SB = {
  line: '#3a2c26',      // hairline facing the content, and the arrow dividers
  track: '#e6d3b1',
  groove: '#cdb68f',    // shade next to the hairline: the channel is sunk
  far: '#f3e6cd',       // lit far lip of the channel
  face: '#e2c9a0', faceHi: '#f8f0d6', faceLo: '#b99a70',
  arrow: '#c0262d', arrowOff: '#c9b089',
  pressedFace: '#c0262d', pressedHi: '#d9585d', pressedLo: '#7e1419', pressedArrow: '#fff6de',
  thumb: '#44a8a8', thumbHi: '#99cccc', thumbLo: '#447878',
  thumbPressed: '#447878', thumbPressedHi: '#44a8a8', thumbPressedLo: '#2b5a5e',
  thumbEdge: '#173f46', grip: '#d9f0ec', gripPressed: '#f4c430',
  inactive: { line: '#a59b91', track: '#ece6dc', groove: '#e0d8cc', far: '#f4f0e9' },
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
  b.fill(0, 0, cross, along, look.track);
  b.fill(0, 0, 1, along, look.line);
  b.fill(1, 0, 1, along, look.groove);
  b.fill(cross - 1, 0, 1, along, look.far);
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
  arrowhead(b, (t >> 1), faceV0 + 1, faceV1 - 1, dir, t >= 14 ? 4 : 3, ink);
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

// The grip: a two-period wave across the thumb, on whole pixels (u across, v along).
const GRIP = { big: ['.##..##.', '#..##..#'], small: ['.##.', '#..#'] };

/** Rhine-teal thumb with a wave grip; opaque, with the track painted into its sides. */
function thumbImage(horizontal, t, pressed, ghost = false) {
  const small = t <= 11;
  const along = small ? 16 : 23;
  const b = barRaster(horizontal, t, along);
  const inset = 2;
  const w = t - 1 - 2 * (inset - 1), h = along - 2;
  if (ghost) {
    b.round(inset, 1, w, h, 3, SB.thumbEdge, { matte: SB.track });
    b.round(inset + 1, 2, w - 2, h - 2, 2, '#bfdcd8');
    return b.r;
  }
  paintTrack(b, t, along);
  const [face, hi, lo] = pressed ? [SB.thumbPressed, SB.thumbPressedHi, SB.thumbPressedLo] : [SB.thumb, SB.thumbHi, SB.thumbLo];
  const rad = small ? 3 : 4;
  b.round(inset, 1, w, h, rad, SB.thumbEdge);
  // Flat face with a 1px lit top/left and a shaded bottom/right inside the edge.
  b.round(inset + 1, 2, w - 2, h - 2, rad - 1, lo);
  b.round(inset + 1, 2, w - 3, h - 3, rad - 1, hi);
  b.round(inset + 2, 3, w - 4, h - 4, rad - 2, face);
  const grip = small ? GRIP.small : GRIP.big;
  const ink = pressed ? SB.gripPressed : SB.grip;
  const u0 = inset + ((w - grip[0].length) >> 1), v0 = (along >> 1) - 1;
  grip.forEach((row, dv) => [...row].forEach((ch, du) => { if (ch === '#') b.fill(u0 + du, v0 + dv, 1, 1, ink); }));
  return b.r;
}

/** Little arrows: two sandstone half-buttons with whole-pixel red arrowheads. */
function littleArrows(look, part = 'both') {
  const W = 13, H = 23, split = 11;
  const r = new Raster(W, H);
  const pressed = look === 'pressed', inactive = look === 'inactive';
  const edge = inactive ? '#b9ada1' : SB.line;
  const half = (y0, y1, dir, isPressed) => {
    const h = y1 - y0;
    r.fillRoundRectSmooth(0, y0, W, h, 3, edge, { matte: '#fbf5ea' });
    const [face, hi, lo] = isPressed ? [SB.pressedFace, SB.pressedHi, SB.pressedLo]
      : inactive ? ['#ece6dc', '#f4f0e9', '#d8ccb8'] : [SB.face, SB.faceHi, SB.faceLo];
    r.fillRoundRectSmooth(1, y0 + 1, W - 2, h - 2, 2, lo);
    r.fillRoundRectSmooth(1, y0 + 1, W - 3, h - 3, 2, hi);
    r.fillRoundRectSmooth(2, y0 + 2, W - 4, h - 4, 1, face);
    const ink = isPressed ? SB.pressedArrow : inactive ? '#c9bfb2' : SB.arrow;
    const rows = 3, top = y0 + ((h - rows) >> 1);
    for (let i = 0; i < rows; i++) {
      const k = dir < 0 ? i : rows - 1 - i;
      r.fillRect(6 - k, top + i, 2 * k + 1, 1, ink);
    }
  };
  if (part !== 'down') half(0, split + 1, -1, pressed && part === 'up');
  if (part !== 'up') half(split, H, 1, pressed && part === 'down');
  if (part === 'both') r.hline(1, split, W - 2, edge);
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
