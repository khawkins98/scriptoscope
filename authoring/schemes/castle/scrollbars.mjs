// Castle scroll bars: a sunk stone channel, dressed-stone arrow plates with a
// carved arrowhead, and a bound oak barrel for the thumb.
//
// The engine rules are the ones Halcyon's parts/scrollbars.mjs documents
// (docs/spec/engine/scrollbar.md): one TRACK cicn per tier holds both arrows
// and a 3px track source whose middle is stretched, so the track may only vary
// ACROSS the bar (no stone joints along it); every image is opaque; the
// pressed track's middle equals the normal one; thumbs are copied 1:1 and
// must be opaque with the track painted into their sides.
//
// All whole pixels: the arrowheads and the barrel are drawn row by row, no
// anti-aliased strokes (authoring-visual-design §2.2). Light from the upper
// left: the channel's left/top wall is in shade and its far lip lit; plates
// and the barrel are lit on their left/top.
import { Raster, encodeCicn } from '../../../tools/theme-author/index.js';

const SB = {
  line: '#333333',      // hairline facing the content, the arrow dividers, outlines
  groove: '#666666',    // the channel's shaded near wall
  track: '#777777',     // channel floor
  far: '#999999',       // lit far lip
  plate: '#aaaaaa', plateHi: '#cccccc', plateLo: '#777777',
  pressedPlate: '#666666', pressedHi: '#555555', pressedLo: '#888888',
  ink: '#333333', inkOff: '#999999', inkPressed: '#ffcc33',
  oak: '#996633', oakHi: '#cc9966', oakLo: '#663300', oakPressed: '#663300', oakPressedHi: '#996633', oakPressedLo: '#330000',
  hoop: '#333333', hoopHi: '#666666',
  ghost: '#cc9900', ghostFill: '#ffcc99',
  inactive: { line: '#999999', groove: '#aaaaaa', track: '#bbbbbb', far: '#cccccc' },
};

/** A raster addressed as (u across the bar, v along it). */
function barRaster(horizontal, cross, along) {
  const r = horizontal ? new Raster(along, cross) : new Raster(cross, along);
  const box = (u, v, w, h) => (horizontal ? [v, u, h, w] : [u, v, w, h]);
  return {
    r,
    fill: (u, v, w, h, c) => r.fillRect(...box(u, v, w, h), c),
    dot: (u, v, c) => (horizontal ? r.set(v, u, c) : r.set(u, v, c)),
  };
}

function paintTrack(b, cross, along, look = SB) {
  b.fill(0, 0, cross, along, look.track);
  b.fill(0, 0, 1, along, look.line);
  b.fill(1, 0, 1, along, look.groove);
  b.fill(cross - 1, 0, 1, along, look.far);
}

/** Arrowheads pointing to the low end (up / left); flipped along v for the high end. */
const HEAD = {
  big: ['....#....', '...###...', '..#####..', '.#######.', '#########'],
  small: ['..#..', '.###.', '#####'],
};

function paintArrow(b, t, v0, d, end, cap, dir, look) {
  const divider = end === 'low' ? v0 + d - 1 : v0;
  const faceV0 = end === 'low' ? v0 : v0 + 1;
  const faceV1 = v0 + d - (end === 'low' || cap ? 1 : 0); // exclusive
  const pressed = look === 'pressed';
  const face = pressed ? SB.pressedPlate : SB.plate, hi = pressed ? SB.pressedHi : SB.plateHi, lo = pressed ? SB.pressedLo : SB.plateLo;
  b.fill(1, faceV0, t - 1, faceV1 - faceV0, face);
  // Bevel in screen terms: lit top and left, shaded bottom and right. In bar
  // terms (u across, v along) that is lit at low u and low v either way.
  b.fill(1, faceV0, t - 1, 1, hi); b.fill(1, faceV0, 1, faceV1 - faceV0, hi);
  b.fill(1, faceV1 - 1, t - 1, 1, lo); b.fill(t - 1, faceV0 + 1, 1, faceV1 - faceV0 - 1, lo);
  b.fill(0, v0, 1, d, SB.line);
  b.fill(0, divider, t, 1, SB.line);
  if (cap) b.fill(0, v0 + d - 1, t, 1, SB.line);
  const ink = look === 'off' ? SB.inkOff : pressed ? SB.inkPressed : SB.ink;
  const head = t >= 14 ? HEAD.big : HEAD.small, hw = head[0].length, hh = head.length;
  const u0 = 1 + Math.floor((t - 1 - hw) / 2), vMid = Math.floor((faceV0 + faceV1 - hh) / 2);
  head.forEach((row, i) => {
    const v = dir < 0 ? vMid + i : vMid + hh - 1 - i;
    for (let k = 0; k < hw; k++) if (row[k] === '#') b.dot(u0 + k, v, ink);
  });
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

/**
 * The bound barrel: oak staves along the bar, rounded ends on a 1-2 pixel
 * stair, two iron hoops across it. Opaque, with the track painted under it.
 * Ghost (drag outline): the silhouette only.
 */
function thumbImage(horizontal, t, pressed, ghost = false) {
  const small = t <= 11;
  const along = small ? 16 : 23;
  const b = barRaster(horizontal, t, along);
  paintTrack(b, t, along);
  const u0 = 2, u1 = t - 1;                     // the barrel's widest span [u0, u1), clear of the hairline
  const v0 = 1, v1 = along - 1;                 // [v0, v1)
  const span = (v) => {
    const e = Math.min(v - v0, v1 - 1 - v);    // distance from the nearest end
    const cut = e === 0 ? 2 : e === 1 ? 1 : 0; // 1-2 stair at the ends
    return [u0 + cut, u1 - cut];
  };
  const inside = (u, v) => { if (v < v0 || v >= v1) return false; const [a, z] = span(v); return u >= a && u < z; };
  const hoops = small ? [4, along - 5] : [5, along - 6];
  for (let v = v0; v < v1; v++) {
    const [a, z] = span(v);
    for (let u = a; u < z; u++) {
      const edge = !inside(u - 1, v) || !inside(u + 1, v) || !inside(u, v - 1) || !inside(u, v + 1);
      if (ghost) { b.dot(u, v, edge ? SB.ghost : SB.ghostFill); continue; }
      let c;
      if (edge) c = SB.line;
      else if (hoops.includes(v)) c = u <= a + 2 ? SB.hoopHi : SB.hoop;
      else if (hoops.some((h) => v === h + 1)) c = pressed ? SB.oakPressedLo : SB.oakLo; // hoop shadow
      else if (u === a + 1) c = pressed ? SB.oakPressedHi : SB.oakHi;                   // lit stave
      else if (u >= z - 3) c = pressed ? SB.oakPressedLo : SB.oakLo;                    // shaded staves
      else if ((u - u0) % 3 === 0) c = pressed ? SB.oakPressedLo : SB.oakLo;            // stave joints
      else c = pressed ? SB.oakPressed : SB.oak;
      b.dot(u, v, c);
    }
  }
  return b.r;
}

function littleArrows(look, part = 'both') {
  const W = 13, H = 23, split = 11;
  const r = new Raster(W, H);
  const pressed = look === 'pressed', inactive = look === 'inactive';
  const edge = inactive ? '#999999' : SB.line;
  const half = (y0, y1, dir, isPressed) => {
    const h = y1 - y0;
    r.fillRect(1, y0, W - 2, h, edge).fillRect(0, y0 + 1, W, h - 2, edge);
    const face = isPressed ? SB.pressedPlate : inactive ? '#cccccc' : SB.plate;
    const hi = isPressed ? SB.pressedHi : inactive ? '#dddddd' : SB.plateHi, lo = isPressed ? SB.pressedLo : inactive ? '#bbbbbb' : SB.plateLo;
    r.fillRect(1, y0 + 1, W - 2, h - 2, face);
    r.hline(1, y0 + 1, W - 2, hi).vline(1, y0 + 1, h - 2, hi).hline(2, y1 - 2, W - 3, lo).vline(W - 2, y0 + 2, h - 3, lo);
    const ink = isPressed ? SB.inkPressed : inactive ? '#aaaaaa' : SB.ink;
    const cy = Math.floor((y0 + y1 - 3) / 2);
    HEAD.small.forEach((row, i) => {
      const y = dir < 0 ? cy + i : cy + 2 - i;
      for (let k = 0; k < 5; k++) if (row[k] === '#') r.set(4 + k, y, ink);
    });
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
