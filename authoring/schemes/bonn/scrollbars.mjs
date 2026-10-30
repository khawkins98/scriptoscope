// Bonn scroll bars: a sandstone channel, city-red arrow buttons with cream
// arrowheads, and a Rhine-teal thumb with a little wave on it. Structure from
// Castle's scrollbars.mjs (same engine rules, new art).
//
// The engine rules are the ones Halcyon's parts/scrollbars.mjs documents
// (docs/spec/engine/scrollbar.md): one TRACK cicn per tier holds both arrows
// and a 3px track source whose middle is stretched, so the track may only vary
// ACROSS the bar (no dithering, no stone joints along it); every image is
// opaque; the pressed track's middle equals the normal one; thumbs are copied
// 1:1 and must be opaque with the track painted into their sides.
import { Raster, verticalGradient, encodeCicn } from '../../../tools/theme-author/index.js';

const SB = {
  line: '#3a2c26',      // hairline facing the content, and the arrow dividers
  track: '#e6d3b1',
  groove: '#cdb68f',    // shade next to the hairline: the channel is sunk
  far: '#f3e6cd',       // lit far lip of the channel
  ink: '#fff6de', inkOff: '#e9b9b5',
  btnTop: '#d23a40', btnBottom: '#a81e26', pressedTop: '#8a141b', pressedBottom: '#6a0e14',
  thumbTop: '#5fa3a3', thumbBottom: '#2b6a72', thumbPressedTop: '#3f8689', thumbPressedBottom: '#1d4f56',
  thumbEdge: '#173f46', foam: '#d9f0ec',
  inactive: { line: '#a59b91', track: '#ece6dc', groove: '#e0d8cc', far: '#f4f0e9' },
};

/** A raster addressed as (u across the bar, v along it). */
function barRaster(horizontal, cross, along) {
  const r = horizontal ? new Raster(along, cross) : new Raster(cross, along);
  const box = (u, v, w, h) => (horizontal ? [v, u, h, w] : [u, v, w, h]);
  const pt = (u, v) => (horizontal ? [v, u] : [u, v]);
  return {
    r,
    fill: (u, v, w, h, c) => r.fillRect(...box(u, v, w, h), c),
    round: (u, v, w, h, rad, c, opts) => r.fillRoundRectSmooth(...box(u, v, w, h), rad, c, opts),
    stroke: (u0, v0, u1, v1, wd, c) => r.strokeLineSmooth(...pt(u0, v0), ...pt(u1, v1), wd, c),
    cover: (u, v, w, h, inside, c) => {
      // paintCoverage wants a whole-pixel box; grow it to cover the shape.
      const [fx, fy, fw, fh] = box(u, v, w, h);
      const x = Math.floor(fx), y = Math.floor(fy), ww = Math.ceil(fx + fw) - x, hh = Math.ceil(fy + fh) - y;
      return r.paintCoverage(x, y, ww, hh, horizontal ? (px, py) => inside(py, px) : inside, c);
    },
    gradient: (u, v, w, h, top, bottom) => {
      const [, y, , hh] = box(u, v, w, h);
      return verticalGradient(y, hh, [[0, top], [1, bottom]]);
    },
  };
}

function paintTrack(b, cross, along, look = SB) {
  b.fill(0, 0, cross, along, look.track);
  b.fill(0, 0, 1, along, look.line);
  b.fill(1, 0, 1, along, look.groove);
  b.fill(cross - 1, 0, 1, along, look.far);
}

/** A filled arrowhead (a barbed triangle) pointing to the low (-1) or high (+1) end. */
function arrowhead(b, cu, cv, dir, size, color) {
  const tip = cv + dir * size * 0.75, back = cv - dir * size * 0.55;
  b.cover(cu - size, Math.min(tip, back) - 1, 2 * size + 1, Math.abs(tip - back) + 2, (pu, pv) => {
    const t = (pv - back) / (tip - back);             // 0 at the back, 1 at the tip
    if (t < 0 || t > 1) return false;
    return Math.abs(pu - cu) <= size * (1 - t);
  }, color);
}

function paintArrow(b, t, v0, d, end, cap, dir, look) {
  const divider = end === 'low' ? v0 + d - 1 : v0;
  const faceV0 = end === 'low' ? v0 : v0 + 1;
  const faceV1 = v0 + d - (end === 'low' || cap ? 1 : 0);
  const pressed = look === 'pressed';
  b.fill(1, faceV0, t - 1, faceV1 - faceV0, b.gradient(1, faceV0, t - 1, faceV1 - faceV0,
    pressed ? SB.pressedTop : SB.btnTop, pressed ? SB.pressedBottom : SB.btnBottom));
  b.fill(0, v0, 1, d, SB.line);
  b.fill(0, divider, t, 1, SB.line);
  if (cap) b.fill(0, v0 + d - 1, t, 1, SB.line);
  const ink = look === 'off' ? SB.inkOff : pressed ? '#f4c430' : SB.ink;
  arrowhead(b, (1 + t) / 2, (faceV0 + faceV1) / 2, dir, t >= 14 ? 4 : 2.6, ink);
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

/** Rhine-teal thumb with a wave; opaque, with the track painted into its sides. */
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
  b.round(inset, 1, w, h, small ? 3 : 4, SB.thumbEdge);
  b.round(inset + 1, 2, w - 2, h - 2, small ? 2 : 3, b.gradient(inset + 1, 2, w - 2, h - 2,
    pressed ? SB.thumbPressedTop : SB.thumbTop, pressed ? SB.thumbPressedBottom : SB.thumbBottom));
  // A little wave across the middle of the thumb (along the bar's cross axis).
  const ink = pressed ? '#f4c430' : SB.foam, mid = along / 2;
  for (let i = 0; i < w - 3; i++) {
    const u0 = inset + 1.5 + i, u1 = u0 + 1;
    const v = (u) => mid + 1.1 * Math.sin(((u - inset - 1.5) / (w - 3)) * 2 * Math.PI);
    b.stroke(u0, v(u0), u1, v(u1), 1.1, ink);
  }
  return b.r;
}

function littleArrows(look, part = 'both') {
  const W = 13, H = 23, split = 11;
  const r = new Raster(W, H);
  const pressed = look === 'pressed';
  const edge = look === 'inactive' ? '#b9ada1' : '#5b0d12';
  const half = (y0, y1, dir, isPressed) => {
    const h = y1 - y0;
    r.fillRoundRectSmooth(0, y0, W, h, 3, edge, { matte: '#fbf5ea' });
    const top = isPressed ? SB.pressedTop : look === 'inactive' ? '#e6dccb' : SB.btnTop;
    const bottom = isPressed ? SB.pressedBottom : look === 'inactive' ? '#d8ccb8' : SB.btnBottom;
    r.fillRoundRectSmooth(1, y0 + 1, W - 2, h - 2, 2, verticalGradient(y0 + 1, h - 2, [[0, top], [1, bottom]]));
    const ink = isPressed ? '#f4c430' : look === 'inactive' ? '#f4f0e9' : SB.ink;
    const cx = W / 2, cy = (y0 + y1) / 2;
    r.paintCoverage(0, y0, W, h, (px, py) => {
      const tip = cy + dir * 2.4, back = cy - dir * 1.8, tt = (py - back) / (tip - back);
      return tt >= 0 && tt <= 1 && Math.abs(px - cx) <= 3.2 * (1 - tt);
    }, ink);
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
