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
    if (!(width > 0 && height > 0)) throw new Error(`Raster: invalid size ${width}x${height}`);
    this.width = width;
    this.height = height;
    this.rgba = new Uint8Array(width * height * 4); // starts fully transparent
  }

  inBounds(x, y) { return x >= 0 && y >= 0 && x < this.width && y < this.height; }

  /** Set one pixel. `color` null/undefined makes it transparent. */
  set(x, y, color) {
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
    rows.forEach((row, dy) => [...row].forEach((ch, dx) => {
      if (ch in legend) this.set(x + dx, y + dy, legend[ch]);
      else if (ch !== '.' && ch !== ' ') throw new Error(`Raster.sprite: no legend entry for '${ch}'`);
    }));
    return this;
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
