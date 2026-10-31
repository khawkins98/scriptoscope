// A minimal RGBA drawing surface for authoring scheme art in code.
//
// Kaleidoscope art is pixel art: every resource is a small indexed bitmap with
// a 1-bit mask, so there is no partial transparency and no anti-aliasing
// against whatever sits behind the window. Draw with hard edges. A pixel is
// opaque (alpha 255) or transparent (alpha 0).
//
// Hidden swatches (alpha 1): the engine reads some colours — title text,
// button text and face colour — from a chosen pixel of an image, and it ignores
// the mask while doing so. Authors therefore park those colours on pixels that
// are transparent on screen. `swatch()` writes such a pixel: invisible, but its
// colour is stored in the icon's palette at that position.
//
// Colours are written in the sRGB you want to SEE on screen ('#rrggbb' or
// [r, g, b]). The encoder converts them to classic Mac values for you
// (see color.js).

import { parseColor } from './color.js';

export class Raster {
  /** @param {number} width @param {number} height */
  constructor(width, height) {
    if (!(Number.isInteger(width) && Number.isInteger(height) && width > 0 && height > 0)) {
      throw new Error(`Raster: invalid size ${width}x${height} (whole numbers above 0)`);
    }
    this.width = width;
    this.height = height;
    this.rgba = new Uint8Array(width * height * 4); // starts fully transparent
  }

  /**
   * Wrap RGBA pixels drawn elsewhere (e.g. a PNG from claude-pxl or Aseprite,
   * via scripts/lib/png-decode.mjs). Alpha is snapped to 0 or 255 at 128,
   * because the encoder reads alpha 1–127 as a hidden swatch: an anti-aliased
   * edge would otherwise turn into invisible palette pixels. `snapped` counts
   * the pixels whose alpha changed, so you can tell soft-edged art apart.
   * @returns {{ raster: Raster, snapped: number }}
   */
  static fromRgba(width, height, rgba) {
    if (rgba.length !== width * height * 4) throw new Error(`Raster.fromRgba: expected ${width * height * 4} bytes, got ${rgba.length}`);
    const raster = new Raster(width, height);
    raster.rgba.set(rgba);
    let snapped = 0;
    for (let i = 3; i < raster.rgba.length; i += 4) {
      const a = raster.rgba[i];
      if (a !== 0 && a !== 255) { raster.rgba[i] = a >= 128 ? 255 : 0; snapped++; }
    }
    return { raster, snapped };
  }

  inBounds(x, y) { return x >= 0 && y >= 0 && x < this.width && y < this.height; }

  /**
   * Set one pixel. `color` null/undefined makes it transparent. Pixels outside
   * the raster are ignored, so shapes may hang off the edge. Coordinates must
   * be whole numbers: wrap centring maths in Math.floor or Math.round.
   */
  set(x, y, color) {
    // A fractional x would land the write between pixels and corrupt the
    // neighbours' channels (rgba is a flat byte array), so refuse it loudly.
    if (!Number.isInteger(x) || !Number.isInteger(y)) {
      throw new Error(`Raster: pixel (${x}, ${y}) is not on the grid; round coordinates with Math.floor or Math.round`);
    }
    if (!this.inBounds(x, y)) return this;
    const i = (y * this.width + x) * 4;
    if (color == null) { this.rgba.fill(0, i, i + 4); return this; }
    const [r, g, b] = parseColor(color);
    this.rgba[i] = r; this.rgba[i + 1] = g; this.rgba[i + 2] = b; this.rgba[i + 3] = 255;
    return this;
  }

  /**
   * Store a colour on a pixel that stays transparent on screen (see the
   * "hidden swatches" note at the top of this file).
   */
  swatch(x, y, color) {
    this.set(x, y, color);
    if (this.inBounds(x, y)) this.rgba[(y * this.width + x) * 4 + 3] = 1;
    return this;
  }

  /** @returns {[number, number, number] | null} null when transparent */
  get(x, y) {
    if (!this.inBounds(x, y)) return null;
    const i = (y * this.width + x) * 4;
    return this.rgba[i + 3] < 128 ? null : [this.rgba[i], this.rgba[i + 1], this.rgba[i + 2]];
  }

  /** Fill a rectangle. `color` may be a function (x, y) => colour for gradients. */
  fillRect(x, y, w, h, color) {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) {
      this.set(xx, yy, typeof color === 'function' ? color(xx, yy) : color);
    }
    return this;
  }

  hline(x, y, w, color) { return this.fillRect(x, y, w, 1, color); }
  vline(x, y, h, color) { return this.fillRect(x, y, 1, h, color); }

  /** 1px rectangle outline. */
  strokeRect(x, y, w, h, color) {
    this.hline(x, y, w, color).hline(x, y + h - 1, w, color);
    return this.vline(x, y, h, color).vline(x + w - 1, y, h, color);
  }

  /**
   * Fill only the pixels inside a rounded rectangle. `color` null punches a
   * transparent rounded hole, which is how you make rings and outlines.
   */
  fillRoundRect(x, y, w, h, radius, color) {
    radius = Math.min(radius, w / 2, h / 2); // larger radii would cut into the straight edges
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) {
      const dx = Math.min(xx - x, x + w - 1 - xx), dy = Math.min(yy - y, y + h - 1 - yy);
      if (dx < radius && dy < radius && !insideCircle(dx, dy, radius)) continue;
      this.set(xx, yy, typeof color === 'function' ? color(xx, yy) : color);
    }
    return this;
  }

  /**
   * Make the pixels outside a rounded corner transparent. Use after filling.
   * `corners` picks which corners to round: any of 'tl', 'tr', 'bl', 'br'.
   * The edge pixels that remain can be recoloured with `outlineEdges`.
   */
  clipRounded(x, y, w, h, radius, corners = ['tl', 'tr', 'bl', 'br']) {
    radius = Math.min(radius, w / 2, h / 2); // radius w/2 on a square gives a circle; more is meaningless
    for (const c of corners) {
      for (let dy = 0; dy < radius; dy++) for (let dx = 0; dx < radius; dx++) {
        if (insideCircle(dx, dy, radius)) continue;
        const px = c.endsWith('l') ? x + dx : x + w - 1 - dx;
        const py = c.startsWith('t') ? y + dy : y + h - 1 - dy;
        this.set(px, py, null);
      }
    }
    return this;
  }

  /**
   * Paint `color` on every opaque pixel that touches a transparent pixel (or
   * the raster edge) inside the given box. This gives a 1px outline that
   * follows rounded corners.
   */
  outlineEdges(x, y, w, h, color) {
    const edge = [];
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) {
      if (!this.get(xx, yy)) continue;
      const out = (px, py) => px < x || py < y || px >= x + w || py >= y + h || !this.get(px, py);
      if (out(xx - 1, yy) || out(xx + 1, yy) || out(xx, yy - 1) || out(xx, yy + 1)) edge.push([xx, yy]);
    }
    for (const [xx, yy] of edge) this.set(xx, yy, color);
    return this;
  }

  /**
   * Draw ASCII pixel art. `rows` is an array of equal-length strings; each
   * character is looked up in `legend`. '.' and ' ' are transparent unless the
   * legend says otherwise.
   *
   *   r.sprite(0, 0, ['.##.', '#..#'], { '#': '#334455' });
   */
  sprite(x, y, rows, legend) {
    if (!Array.isArray(rows)) throw new Error('Raster.sprite: rows must be an array of strings, one per pixel row');
    rows.forEach((row, dy) => [...row].forEach((ch, dx) => {
      if (ch in legend) this.set(x + dx, y + dy, legend[ch]);
      else if (ch !== '.' && ch !== ' ') throw new Error(`Raster.sprite: no legend entry for '${ch}'`);
    }));
    return this;
  }

  // ── Smooth (anti-aliased) shapes ──────────────────────────────────────
  // Kaleidoscope masks are 1-bit, so a pixel can't be half transparent. These
  // shapes still get smooth edges by blending each edge pixel's colour by how
  // much of the pixel the shape covers (measured with 4×4 sub-samples):
  //   • over an already-opaque pixel: blend with that pixel (inner edges,
  //     e.g. a fill meeting its border, a glyph on a button);
  //   • over a transparent pixel: blend with `matte`, the colour the art will
  //     sit on (e.g. the white window body under a checkbox), and make it
  //     opaque if at least half covered. With no matte the edge stays hard.
  // Coordinates are continuous here: (0, 0) is the top-left corner of the
  // top-left pixel, so a circle of radius 6 centred at (6, 6) fills 12×12.
  // Boxes may be fractional too: they are widened to whole pixels.

  /**
   * Paint `color` wherever coverage(px, py) (a point in pixel space → true/false)
   * holds, with smoothed edges. The building block for the shapes below.
   * @param {{ matte?: string|number[], samples?: number }} [opts]
   */
  paintCoverage(x, y, w, h, inside, color, { matte, samples = 4 } = {}) {
    // Widen a fractional box to whole pixels; `inside` is tested in continuous space anyway.
    const x0 = Math.floor(x), y0 = Math.floor(y);
    w = Math.ceil(x + w) - x0; h = Math.ceil(y + h) - y0; x = x0; y = y0;
    const n = samples, paint = typeof color === 'function' ? color : () => color;
    for (let py = y; py < y + h; py++) for (let px = x; px < x + w; px++) {
      if (!this.inBounds(px, py)) continue;
      let hits = 0;
      for (let sy = 0; sy < n; sy++) for (let sx = 0; sx < n; sx++) {
        if (inside(px + (sx + 0.5) / n, py + (sy + 0.5) / n)) hits++;
      }
      if (!hits) continue;
      const cov = hits / (n * n), c = paint(px, py);
      if (cov === 1) { this.set(px, py, c); continue; }
      const under = this.get(px, py) ?? (matte != null ? parseColor(matte) : null);
      if (under) this.set(px, py, mix(under, c, cov));
      else if (cov >= 0.5) this.set(px, py, c);
    }
    return this;
  }

  /** Smooth rounded rectangle (x, y, w, h in pixels; radius may be fractional). */
  fillRoundRectSmooth(x, y, w, h, radius, color, opts) {
    const r = Math.min(radius, w / 2, h / 2), cx = x + w / 2, cy = y + h / 2;
    return this.paintCoverage(x, y, w, h, (px, py) => {
      const dx = Math.max(Math.abs(px - cx) - (w / 2 - r), 0), dy = Math.max(Math.abs(py - cy) - (h / 2 - r), 0);
      return dx * dx + dy * dy <= r * r;
    }, color, opts);
  }

  /** Smooth filled circle centred at (cx, cy). */
  fillCircleSmooth(cx, cy, radius, color, opts) {
    const x = Math.floor(cx - radius), y = Math.floor(cy - radius), s = Math.ceil(cx + radius) - x;
    return this.paintCoverage(x, y, s, Math.ceil(cy + radius) - y, (px, py) => (px - cx) ** 2 + (py - cy) ** 2 <= radius * radius, color, opts);
  }

  /** Smooth straight stroke from (x0, y0) to (x1, y1), `width` px thick, round ends. */
  strokeLineSmooth(x0, y0, x1, y1, width, color, opts) {
    const half = width / 2, dx = x1 - x0, dy = y1 - y0, len2 = dx * dx + dy * dy || 1;
    const bx = Math.floor(Math.min(x0, x1) - half), by = Math.floor(Math.min(y0, y1) - half);
    return this.paintCoverage(bx, by, Math.ceil(Math.max(x0, x1) + half) - bx, Math.ceil(Math.max(y0, y1) + half) - by, (px, py) => {
      const t = Math.max(0, Math.min(1, ((px - x0) * dx + (py - y0) * dy) / len2));
      const ex = px - (x0 + t * dx), ey = py - (y0 + t * dy);
      return ex * ex + ey * ey <= half * half;
    }, color, opts);
  }

  /** Copy another raster in. Transparent source pixels are skipped; hidden swatches are kept. */
  blit(src, x, y) {
    for (let sy = 0; sy < src.height; sy++) for (let sx = 0; sx < src.width; sx++) {
      const si = (sy * src.width + sx) * 4;
      if (src.rgba[si + 3] === 0 || !this.inBounds(x + sx, y + sy)) continue;
      this.rgba.set(src.rgba.subarray(si, si + 4), ((y + sy) * this.width + x + sx) * 4);
    }
    return this;
  }
}

// Is the pixel (dx, dy) of an r×r corner box inside the quarter circle whose
// centre sits at the box's inner corner (r, r)? Sampled at the pixel centre.
function insideCircle(dx, dy, r) {
  const ex = r - (dx + 0.5), ey = r - (dy + 0.5);
  return ex * ex + ey * ey <= r * r;
}

/** Linear blend between two colours; t in [0, 1]. Returns [r, g, b]. */
export function mix(a, b, t) {
  const ca = parseColor(a), cb = parseColor(b);
  return ca.map((v, i) => Math.round(v + (cb[i] - v) * t));
}

// 4×4 Bayer matrix: the classic ordered-dither threshold pattern.
const BAYER4 = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];

/** Ordered-dither threshold for a pixel, in (0, 1). It repeats every 4 pixels. */
export const bayer = (x, y) => (BAYER4[((y % 4) + 4) % 4][((x % 4) + 4) % 4] + 0.5) / 16;

/**
 * Ordered-dithered vertical gradient for fillRect / paintCoverage. Instead of
 * one colour per row, it uses `levels` evenly spaced colours and mixes
 * neighbouring levels in a fixed 4×4 pattern, so a gradient looks smooth with
 * few colours (and never hits the 256-colour limit). This is the period
 * technique; classic Mac art dithered the same way.
 */
/**
 * `axis: 'x'` runs the ramp left to right instead: then `y0` and `h` are the
 * start column and the width.
 */
export function ditheredGradient(y0, h, stops, { levels = 6, axis = 'y' } = {}) {
  const smooth = verticalGradient(0, h, stops);
  const steps = Math.max(2, levels);
  const at = (k) => smooth(0, (k / (steps - 1)) * (h - 1));
  return (x, y) => {
    const along = axis === 'x' ? x : y;
    const t = h <= 1 ? 0 : Math.min(1, Math.max(0, (along - y0) / (h - 1))) * (steps - 1);
    const base = Math.floor(t), frac = t - base;
    return at(Math.min(steps - 1, frac > bayer(x, y) ? base + 1 : base));
  };
}

/** Vertical gradient helper for fillRect: stops are [[t, colour], ...]. */
export function verticalGradient(y0, h, stops) {
  return (_x, y) => {
    const t = h <= 1 ? 0 : (y - y0) / (h - 1);
    for (let i = 1; i < stops.length; i++) {
      const [t1, c1] = stops[i];
      const [t0, c0] = stops[i - 1];
      if (t <= t1) return mix(c0, c1, t1 === t0 ? 0 : (t - t0) / (t1 - t0));
    }
    return parseColor(stops[stops.length - 1][1]);
  };
}
