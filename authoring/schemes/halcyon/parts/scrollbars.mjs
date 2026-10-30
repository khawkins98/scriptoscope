// Halcyon scroll bars: tracks with their arrows, thumbs, drag ghosts, and the
// little-arrows stepper.
//
// How the Kaleidoscope 2.3.1 scroll-bar CDEF uses these images
// (docs/spec/engine/scrollbar.md; src/engine/families/scrollbar.ts):
//
// - One TRACK cicn per state holds both arrows and the track between them.
//   id = base + tier (+ offset), base -8288 horizontal / -8280 vertical (§4.2);
//   tier 0 inactive, 1 disabled / nothing to scroll, 2 normal, 3 pressed;
//   +18 small (bar ≤ 11px thick), +4 double-headed, +22 small double-headed.
// - A track longer than 16px is "composite" (§4.4): with t the bar thickness
//   and d = t − 1, the first and last d pixels along are the arrow cells,
//   copied 1:1 into d-long arrow boxes (§5.3, §5.4). Double-headed art has two
//   cells at each end (up, down … up, down).
// - The pixels between the cells are the track source (§5.5). They are sliced
//   in "halves" (§5.9): the middle column/row is STRETCHED to fill the track.
//   So the track must not change along the bar; it may vary only across it.
//   No dithering here (a repeated dithered column becomes stripes).
// - The track and the low/high segments are drawn after the thumb, clipped
//   around it, and each segment only reaches 1px under the thumb (§5.8). Any
//   thumb pixel left transparent further in is never painted at all, so the
//   thumb is fully opaque with the track painted into its sides; its rounded
//   ends then blend with real track pixels.
// - Arrows of a composite track are copied opaque, mask ignored (AC5), and
//   track pixels the cicn leaves clear are undefined without a ppat (§6 item
//   4), so every track image is opaque and Halcyon ships no track ppats.
// - Pressing an arrow selects the pressed track (tier 3) for the hit arrow and
//   the track; the other arrow comes from the normal track (AC2). Pressing the
//   thumb or the page area draws the pressed track with normal arrows. So the
//   pressed track's middle matches the normal one exactly.
// - Thumbs -10208 v / -10206 h, pressed -10207 / -10205 (TH3/TH4), small
//   +1956 (TH5). The engine copies the thumb 1:1 (its length is the image's
//   length, §5.6), so it can use any gradient.
// - Inactive (tier 0) draws no arrows and no thumb: the whole image is sliced
//   into the bar (T = R, §5.2), so it is plain track.
// - Ghosts -8272 v / -8271 h (+18 small) are the drag outline (message 13),
//   not drawn by the web runtime; little arrows -10048..-10045 follow the
//   corpus layout (1138, apple-platinum-2: 13×23, pressed images carry only
//   their half). Neither has a decoded draw path yet.
//
// Edges: the bar sits inside the window's content area, flush with the frame
// border on its outer side and under the title bar's divider at its top. So
// only the side facing the content gets a hairline, plus one across the far
// (bottom / right) end where it meets the corner. The other two sides are
// open, which avoids doubled lines against the frame.
import { Raster, verticalGradient, encodeCicn } from '../../../../tools/theme-author/index.js';
import { C } from '../palette.mjs';

const SB = {
  line: '#cbd2dc',        // hairline facing the content, and between arrow and track
  track: '#f0f2f5',
  trackShade: '#e6e9ee',  // 1px inner shade next to the hairline
  glyph: '#4a5566',
  glyphOff: '#b7bfca',    // nothing-to-scroll arrows
  thumbEdge: '#97a2b2',
  grip: '#a7b0bd',
  inactive: { line: '#e3e6ea', track: '#f6f7f9', trackShade: '#f1f3f5' },
};

/**
 * A raster addressed in bar coordinates: u across the bar (0 = the side
 * facing the content), v along it. Shapes are given in (u, v) and mapped to
 * (x, y); colours are always functions of real (x, y), so gradients stay
 * "light from the top" in both orientations.
 */
function barRaster(horizontal, cross, along) {
  const r = horizontal ? new Raster(along, cross) : new Raster(cross, along);
  const box = (u, v, w, h) => (horizontal ? [v, u, h, w] : [u, v, w, h]);
  const pt = (u, v) => (horizontal ? [v, u] : [u, v]);
  return {
    r,
    fill: (u, v, w, h, c) => r.fillRect(...box(u, v, w, h), c),
    // Pixel art in (u, v): rows[j][i] is the pixel at u = u0 + i, v = v0 + j.
    sprite: (u0, v0, rows, c) => rows.forEach((row, j) => [...row].forEach((ch, i) => {
      if (ch === '#') r.set(...pt(u0 + i, v0 + j), c);
    })),
    round: (u, v, w, h, rad, c, opts) => r.fillRoundRectSmooth(...box(u, v, w, h), rad, c, opts),
    gradient: (u, v, w, h, top, bottom) => {
      const [, y, , hh] = box(u, v, w, h);
      return verticalGradient(y, hh, [[0, top], [1, bottom]]);
    },
  };
}

/** Paint plain track across the whole raster: hairline, shade, fill (uniform along). */
function paintTrack(b, cross, along, look = SB) {
  b.fill(0, 0, cross, along, look.track);
  b.fill(0, 0, 1, along, look.line);
  b.fill(1, 0, 1, along, look.trackShade);
}

// Arrow glyphs on whole pixels (no anti-aliased strokes under 2px,
// docs/authoring-visual-design.md §2.2): a bold chevron, drawn pointing to the
// low end (up / left); rows run along the bar.
const CHEVRONS = {
  big: ['...#...', '..###..', '.##.##.', '##...##'],
  small: ['..#..', '.###.', '##.##'],
};

/** A chevron pointing toward the low (-1) or high (+1) end, centred at (cu, cv). */
function chevron(b, cu, cv, dir, big, color) {
  const rows = big ? CHEVRONS.big : CHEVRONS.small;
  const w = rows[0].length, h = rows.length;
  const u0 = Math.round(cu - w / 2), v0 = Math.round(cv - h / 2);
  b.sprite(u0, v0, dir < 0 ? rows : [...rows].reverse(), color);
}

/**
 * One arrow cell occupying along [v0, v0 + d). A cell at the low end has its
 * divider on its high side, one at the high end on its low side; `cap` adds
 * the far-end hairline (the last cell of the bar).
 */
function paintArrow(b, t, v0, d, end, cap, dir, look) {
  const divider = end === 'low' ? v0 + d - 1 : v0;
  const faceV0 = end === 'low' ? v0 : v0 + 1;
  const faceV1 = v0 + d - (end === 'low' || cap ? 1 : 0); // exclusive
  const pressed = look === 'pressed';
  // Pressed is the flat accent (one system-palette entry at 8 bpp, no ramp to band).
  const top = pressed ? C.accent : '#ffffff';
  const bottom = pressed ? C.accent : '#e4e9ef';
  b.fill(1, faceV0, t - 1, faceV1 - faceV0, b.gradient(1, faceV0, t - 1, faceV1 - faceV0, top, bottom));
  b.fill(0, v0, 1, d, SB.line);
  b.fill(0, divider, t, 1, SB.line);
  if (cap) b.fill(0, v0 + d - 1, t, 1, SB.line);
  const ink = pressed ? '#ffffff' : look === 'off' ? SB.glyphOff : SB.glyph;
  chevron(b, (1 + t) / 2, (faceV0 + faceV1) / 2, dir, t >= 14, ink);
}

/**
 * A track image: arrow cells at both ends (two per end when `double`) around
 * a 3px track source. `look` is the arrow look: 'normal' | 'pressed' | 'off'.
 */
function trackImage(horizontal, t, look, double) {
  const d = t - 1, cells = double ? 2 : 1, mid = 3;
  const along = 2 * cells * d + mid;
  const b = barRaster(horizontal, t, along);
  paintTrack(b, t, along);
  // Single: up … down. Double-headed: up, down … up, down (§4.5 arrow indices 0, 1 … 2, 3).
  const dirs = double ? [-1, 1] : [-1];
  dirs.forEach((dir, i) => paintArrow(b, t, i * d, d, 'low', false, dir, look));
  const highDirs = double ? [-1, 1] : [1];
  highDirs.forEach((dir, i) => paintArrow(b, t, along - (cells - i) * d, d, 'high', i === cells - 1, dir, look));
  return b.r;
}

/** Inactive: plain, lighter track with the far-end hairline; no arrows, no thumb. */
function inactiveImage(horizontal, t) {
  const along = 2 * (t - 1) + 3; // composite-sized, so a stray cell lookup finds plain track
  const b = barRaster(horizontal, t, along);
  paintTrack(b, t, along, SB.inactive);
  b.fill(0, along - 1, t, 1, SB.inactive.line);
  return b.r;
}

/** Thumb: an opaque image of track with a rounded pill on it. */
function thumbImage(horizontal, t, pressed, ghost = false) {
  const small = t <= 11;
  const along = small ? 16 : 23;
  const b = barRaster(horizontal, t, along);
  const inset = small ? 2 : 3;               // pill sits centred in the track (u = 1 … t − 1)
  const w = t - 1 - 2 * (inset - 1), h = along - 2, rad = w / 2;
  if (ghost) {
    // Drag outline: a translucent-looking pill; everything around it stays clear.
    b.round(inset, 1, w, h, rad, pressed ? C.accentPressed : C.accent, { matte: SB.track });
    b.round(inset + 1, 2, w - 2, h - 2, rad - 1, '#cfe7ef');
    return b.r;
  }
  paintTrack(b, t, along);
  b.round(inset, 1, w, h, rad, pressed ? C.accentPressed : SB.thumbEdge);
  b.round(inset + 1, 2, w - 2, h - 2, rad - 1,
    b.gradient(inset + 1, 2, w - 2, h - 2, pressed ? C.accent : '#ffffff', pressed ? C.accent : '#e2e7ee'));
  // Grip: 1px lines on whole rows, two pixels apart, centred on the pill
  // (pill pixels u = inset … inset + w − 1, v = 1 … along − 2).
  const grip = pressed ? '#d7edf3' : SB.grip;
  const gw = small ? 4 : 5, gu = inset + Math.floor((w - gw) / 2);
  const cv = Math.floor((along - 1) / 2);
  const lines = small ? [-1, 1] : [-2, 0, 2];
  for (const k of lines) b.fill(gu, cv + k, gw, 1, grip);
  return b.r;
}

/** Little arrows (13 × 23): `part` 'both' | 'up' | 'down' (pressed images carry only their half). */
function littleArrows(look, part = 'both') {
  const W = 13, H = 23, split = 11;
  const r = new Raster(W, H);
  const pressed = look === 'pressed';
  const edge = look === 'inactive' ? '#d0d4da' : '#8d98a8';
  const half = (y0, y1, dir, isPressed) => {
    const h = y1 - y0;
    r.fillRoundRectSmooth(0, y0, W, h, 4, edge, { matte: '#ffffff' });
    const top = isPressed ? C.accent : look === 'inactive' ? '#f6f7f9' : '#ffffff';
    const bottom = isPressed ? C.accent : look === 'inactive' ? '#f0f2f5' : '#e2e7ee';
    r.fillRoundRectSmooth(1, y0 + 1, W - 2, h - 2, 3, verticalGradient(y0 + 1, h - 2, [[0, top], [1, bottom]]));
    const ink = isPressed ? '#ffffff' : look === 'inactive' ? '#c3c9d1' : SB.glyph;
    // A 5px pixel chevron, centred on the half's middle pixel (W is odd).
    const rows = dir < 0 ? CHEVRONS.small : [...CHEVRONS.small].reverse();
    r.sprite((W - 5) / 2, Math.round((y0 + y1) / 2 - 1.5), rows, { '#': ink });
  };
  // The halves share row `split`: the up half is rows 0..11, the down half 11..22.
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
      const looks = [[1, 'off', 'Nothing To Scroll'], [2, 'normal', ''], [3, 'pressed', 'Pressed']];
      for (const [tier, look, what] of looks) {
        const name = (pre) => `${what ? `${what} ` : ''}${size}${pre}${label} Scroll Bar`;
        add('cicn', base + off + tier, encodeCicn(trackImage(horizontal, t, look, false)), name(''));
        add('cicn', base + dbl + tier, encodeCicn(trackImage(horizontal, t, look, true)), name('Double-Headed '));
      }
    }
  }
  // Thumbs (TH3/TH4) and their small forms (+1956, TH5).
  const thumbs = [[-10208, false, false], [-10207, false, true], [-10206, true, false], [-10205, true, true]];
  for (const [id, horizontal, pressed] of thumbs) {
    const label = `${pressed ? 'Pressed ' : ''}${horizontal ? 'Horizontal' : 'Vertical'} Thumb`;
    add('cicn', id, encodeCicn(thumbImage(horizontal, 16, pressed)), label);
    add('cicn', id + 1956, encodeCicn(thumbImage(horizontal, 11, pressed)), `Small ${label}`);
  }
  // Ghost thumbs (message 13; -8272 v, -8271 h, +18 small).
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
