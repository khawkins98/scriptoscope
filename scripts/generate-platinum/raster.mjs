// scripts/generate-platinum/raster.mjs
// Shared raster primitives for the Platinum generators. These are the QuickDraw-
// flavoured ops the procedural drawers build on — extracted here so the window
// drawer (draw-window.mjs) and the control drawer (draw-control.mjs) share ONE
// set of primitives instead of each re-declaring set/fill/hline/vline.
//
// Buffers are plain { width, height, rgba: Uint8Array } (RGBA, row-major) — the
// shape generate-platinum.mjs writes via encodePng(). Colors are [r,g,b] arrays.

export function buf(w, h) { return { width: w, height: h, rgba: new Uint8Array(w * h * 4) }; }

export function set(img, x, y, [r, g, b], a = 255) {
  if (x < 0 || y < 0 || x >= img.width || y >= img.height) return;
  const i = (y * img.width + x) * 4;
  img.rgba[i] = r; img.rgba[i + 1] = g; img.rgba[i + 2] = b; img.rgba[i + 3] = a;
}
export function fill(img, x0, y0, w, h, c, a = 255) {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) set(img, x, y, c, a);
}
export function hline(img, x0, x1, y, c, a = 255) { for (let x = x0; x <= x1; x++) set(img, x, y, c, a); }
export function vline(img, x, y0, y1, c, a = 255) { for (let y = y0; y <= y1; y++) set(img, x, y, c, a); }

/**
 * The Platinum raised/recessed BEVEL box — the single shared idiom decoded from
 * WDEF 125 and reused for every control face. Draws, inside [x,y,w,h]:
 *   - a 1px `frame` outline,
 *   - a `face` fill,
 *   - a 1px inner bevel: highlight on top+left, shadow on bottom+right (raised),
 *     or the reverse (recessed/`raised:false`).
 * This is exactly how a beveled button face, a scroll thumb, and a track channel
 * differ only by their color slots + raised flag — the data/drawer split.
 */
export function beveledBox(img, x, y, w, h, { raised = true, face, frame, light, dark }) {
  const x1 = x + w - 1, y1 = y + h - 1;
  if (face) fill(img, x, y, w, h, face);
  const tl = raised ? light : dark;   // top + left edge
  const br = raised ? dark : light;   // bottom + right edge
  if (tl) { hline(img, x + 1, x1 - 1, y + 1, tl); vline(img, x + 1, y + 1, y1 - 1, tl); }
  if (br) { hline(img, x + 1, x1 - 1, y1 - 1, br); vline(img, x1 - 1, y + 1, y1 - 1, br); }
  if (frame) {
    hline(img, x, x1, y, frame); hline(img, x, x1, y1, frame);
    vline(img, x, y, y1, frame); vline(img, x1, y, y1, frame);
  }
}

/**
 * Knock the four 1px corners of an [x,y,w,h] rect transparent — the cheap
 * "rounded rect" Platinum uses for button faces / default rings at small sizes
 * (a single clipped corner pixel reads as a rounded 16px button).
 */
export function roundCorners(img, x, y, w, h, r = 1) {
  const x1 = x + w - 1, y1 = y + h - 1;
  for (let i = 0; i < r; i++) {
    for (let j = 0; j < r - i; j++) {
      set(img, x + j, y + i, [0, 0, 0], 0);
      set(img, x1 - j, y + i, [0, 0, 0], 0);
      set(img, x + j, y1 - i, [0, 0, 0], 0);
      set(img, x1 - j, y1 - i, [0, 0, 0], 0);
    }
  }
}

/** Dim a buffer toward gray (inactive states): lerp every opaque pixel to `t` toward `to`. */
export function desaturateToward(img, to, t) {
  for (let i = 0; i < img.rgba.length; i += 4) {
    if (img.rgba[i + 3] === 0) continue;
    img.rgba[i] = Math.round(img.rgba[i] * (1 - t) + to[0] * t);
    img.rgba[i + 1] = Math.round(img.rgba[i + 1] * (1 - t) + to[1] * t);
    img.rgba[i + 2] = Math.round(img.rgba[i + 2] * (1 - t) + to[2] * t);
  }
}
