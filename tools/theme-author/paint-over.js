// Paint-over: turn a region of a concept image into a 1× starting raster.
//
// Concept mockups (authoring/schemes/<slug>/concept/concept.jpg) are drawn as
// pixel art at some integer-ish scale, usually 2–4 screen pixels per art pixel.
// Redrawing them from scratch in code loses most of what makes them work
// (pose, proportions, shading). Instead, take the region you want (the bird,
// a corner tower, a widget), shrink it back to 1× here, snap every pixel to
// your palette, and then clean the result up by hand in code: fix the outline,
// straighten tiles, remove stray pixels. See docs/authoring-visual-design.md §3.3.
//
// Each output pixel looks at its scale × scale block of source pixels, snaps
// each one to the nearest palette colour and keeps the most common colour
// (`mode`), so 1px outlines survive instead of blurring into the fill the way
// an average would. `mean` (average, then snap) is available for soft areas
// like gradients.
//
// Pixels close to `key` (the concept's backdrop) become transparent. The input
// is plain RGBA, so this module has no file or image-format dependencies; the
// script scripts/paint-over.mjs reads PNGs and writes previews.

import { Raster } from './raster.js';
import { parseColor } from './color.js';

/**
 * @param {{ width: number, height: number, rgba: Uint8Array | Uint8ClampedArray }} image
 * @param {{
 *   crop: { x: number, y: number, w: number, h: number },  // region in source pixels
 *   scale: number,            // source pixels per art pixel (may be fractional, e.g. 2.95)
 *   palette: string[],        // colours to snap to ('#rrggbb')
 *   key?: string | null,      // backdrop colour to make transparent
 *   keyTolerance?: number,    // max RGB distance from key that counts as backdrop (default 24)
 *   method?: 'mode' | 'mean',
 * }} options
 * @returns {Raster}
 */
export function paintOver(image, { crop, scale, palette, key = null, keyTolerance = 24, method = 'mode' }) {
  if (!(scale > 0)) throw new Error(`paintOver: scale must be > 0 (got ${scale})`);
  if (!palette?.length) throw new Error('paintOver: give at least one palette colour');
  const pal = palette.map((c) => { const [r, g, b] = parseColor(c); return [r, g, b]; });
  const keyRgb = key ? parseColor(key) : null;
  const w = Math.max(1, Math.round(crop.w / scale));
  const h = Math.max(1, Math.round(crop.h / scale));
  const out = new Raster(w, h);
  const at = (x, y) => {
    const cx = Math.min(image.width - 1, Math.max(0, x)), cy = Math.min(image.height - 1, Math.max(0, y));
    const i = (cy * image.width + cx) * 4;
    return [image.rgba[i], image.rgba[i + 1], image.rgba[i + 2], image.rgba[i + 3]];
  };
  const isKey = (p) => p[3] < 128 || (keyRgb && dist(p, keyRgb) <= keyTolerance);

  for (let oy = 0; oy < h; oy++) for (let ox = 0; ox < w; ox++) {
    // The block of source pixels this art pixel covers (centre-weighted: skip
    // the outer quarter on each side, where JPEG ringing and antialiasing live).
    const x0 = crop.x + ox * scale, y0 = crop.y + oy * scale;
    const inset = scale >= 3 ? scale * 0.25 : 0;
    const xs = Math.floor(x0 + inset), xe = Math.max(xs + 1, Math.ceil(x0 + scale - inset));
    const ys = Math.floor(y0 + inset), ye = Math.max(ys + 1, Math.ceil(y0 + scale - inset));
    const counts = new Map();
    let keyCount = 0, n = 0, sr = 0, sg = 0, sb = 0;
    for (let y = ys; y < ye; y++) for (let x = xs; x < xe; x++) {
      const p = at(x, y);
      n++;
      if (isKey(p)) { keyCount++; continue; }
      sr += p[0]; sg += p[1]; sb += p[2];
      const k = nearest(pal, p);
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    if (keyCount * 2 > n) continue; // mostly backdrop: leave transparent
    let idx;
    if (method === 'mean') {
      const m = n - keyCount;
      idx = nearest(pal, [sr / m, sg / m, sb / m]);
    } else {
      let best = -1;
      for (const [k, c] of counts) if (c > best) { best = c; idx = k; }
    }
    out.set(ox, oy, toHex(pal[idx]));
  }
  return out;
}

// Redmean-weighted RGB distance: cheap and much closer to perceived difference
// than plain Euclidean, which over-weights blue.
function dist(a, b) {
  const rm = (a[0] + b[0]) / 2;
  const dr = a[0] - b[0], dg = a[1] - b[1], db = a[2] - b[2];
  return Math.sqrt((2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db) / 3;
}

function nearest(pal, p) {
  let best = 0, bd = Infinity;
  for (let i = 0; i < pal.length; i++) { const d = dist(p, pal[i]); if (d < bd) { bd = d; best = i; } }
  return best;
}

const toHex = ([r, g, b]) => `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
