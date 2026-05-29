// The owned pixel engine. This is the "native compatibility runtime":
// a framework-agnostic RGBA buffer with the QuickDraw operations
// Kaleidoscope's kDEF actually uses, implemented ourselves so every
// pixel is under our control. No canvas-2D shortcuts — canvas is used
// only to load source bitmaps and to blit the finished buffer.
//
// Reference: docs/spec/kdef231-recipe-walk.md Q5 — kDEF renders via
// CopyBits/CopyMask; the default blit (0xfeae) tiles the source cell and
// code 18 (0x10320) does a single scaled CopyBits. `copyBits` below is the
// primitive both build on (nearest-neighbour sample-and-hold scaling).

/** A rectangle in pixel coordinates: top-left origin, width/height. */
export interface PixRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export class PixelBuffer {
  readonly width: number;
  readonly height: number;
  /** RGBA, row-major, 4 bytes per pixel. */
  readonly data: Uint8ClampedArray;

  constructor(width: number, height: number, data?: Uint8ClampedArray) {
    this.width = width;
    this.height = height;
    this.data = data ?? new Uint8ClampedArray(width * height * 4);
  }

  static alloc(width: number, height: number): PixelBuffer {
    return new PixelBuffer(width, height);
  }

  private idx(x: number, y: number): number {
    return (y * this.width + x) * 4;
  }

  /** Read a pixel as [r,g,b,a]. Out-of-bounds returns transparent black. */
  getPixel(x: number, y: number): [number, number, number, number] {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return [0, 0, 0, 0];
    const i = this.idx(x, y);
    return [this.data[i]!, this.data[i + 1]!, this.data[i + 2]!, this.data[i + 3]!];
  }

  setPixel(x: number, y: number, r: number, g: number, b: number, a: number): void {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    const i = this.idx(x, y);
    this.data[i] = r;
    this.data[i + 1] = g;
    this.data[i + 2] = b;
    this.data[i + 3] = a;
  }

  /**
   * QuickDraw `CopyBits`: copy `srcRect` of `src` into `dstRect` of this
   * buffer, scaling by sample-and-hold (nearest-neighbor) when the rects
   * differ in size. srcCopy transfer mode (overwrite, alpha included).
   *
   * This is the workhorse: a fixed widget is a copy with srcRect.size ==
   * dstRect.size (no scale); a stretched fill is a 1px-wide srcRect blown
   * up to an N-px dstRect (kDEF-findings §13.2).
   */
  copyBits(src: PixelBuffer, srcRect: PixRect, dstRect: PixRect): void {
    const { x: sx, y: sy, w: sw, h: sh } = srcRect;
    const { x: dx, y: dy, w: dw, h: dh } = dstRect;
    if (sw <= 0 || sh <= 0 || dw <= 0 || dh <= 0) return;
    for (let row = 0; row < dh; row++) {
      // sample-and-hold: floor-map dst row → src row
      const ssy = sy + Math.floor((row * sh) / dh);
      for (let col = 0; col < dw; col++) {
        const ssx = sx + Math.floor((col * sw) / dw);
        const [r, g, b, a] = src.getPixel(ssx, ssy);
        this.setPixel(dx + col, dy + row, r, g, b, a);
      }
    }
  }

  /**
   * 9-slice blit `src` (region `sr`) into dest rect `dr`: the four
   * corners (inset `ins` px) copy 1:1, the four edges and center span the
   * gaps. Two span modes — kDEF cinfs declare which one the artist intended:
   *   `mode: 'stretch'` (default) — copyBits scales the source segment to fit.
   *   `mode: 'tile'` — repeats the source segment 1:1 across the destination,
   *     preserving the artist's pixel-rate border pattern. This is what
   *     `slice.tile: true` / `resizeBehavior: 'repeat-whole'` on a cinf calls
   *     for (apple-lisa rings, windows-31 rings, crayon-os faces — they all
   *     bake the border thickness into the pixel pattern; stretching it
   *     blurs the artist's intent).
   * See docs/spec/kdef231-reference.md §5.
   */
  nineSlice(
    src: PixelBuffer,
    sr: PixRect,
    ins: { l: number; t: number; r: number; b: number },
    dr: PixRect,
    mode: 'stretch' | 'tile' = 'stretch',
  ): void {
    // Clamp insets so the FOUR CORNERS NEVER OVERLAP — when (l+r) > sr.w or
    // (t+b) > sr.h, an unclamped 9-slice silently corrupts: the corner blits
    // overdraw each other AND the middle/side spans early-return (their srcLen
    // goes negative). The first known failure (commit 0bfe533) was 1990 + evolution
    // shipping rings at 21×21 with slice.side=14 → smy = 21−14−14 = −7. The middle
    // band never drew, the two horizontal corner halves stacked on top of each
    // other, and the buggy render got baselined. Clamp to a hard ceiling so the
    // worst case is a degraded-but-consistent render that the eyeball + visual
    // baselines can catch on first sight.
    const _l = Math.max(0, Math.min(ins.l, Math.floor(sr.w / 2)));
    const _r = Math.max(0, Math.min(ins.r, sr.w - _l));
    const _t = Math.max(0, Math.min(ins.t, Math.floor(sr.h / 2)));
    const _b = Math.max(0, Math.min(ins.b, sr.h - _t));
    const smx = sr.w - _l - _r;
    const smy = sr.h - _t - _b;
    const dmx = dr.w - _l - _r;
    const dmy = dr.h - _t - _b;
    const cp = (sx: number, sy: number, sw: number, sh: number, dx: number, dy: number, dw: number, dh: number): void => {
      if (sw <= 0 || sh <= 0 || dw <= 0 || dh <= 0) return;
      this.copyBits(src, { x: sr.x + sx, y: sr.y + sy, w: sw, h: sh }, { x: dr.x + dx, y: dr.y + dy, w: dw, h: dh });
    };
    /** Repeat `src[sx..sx+sw, sy..sy+sh]` into `dest[dx..dx+dw, dy..dy+dh]` at
     *  native pixel rate (no scaling). Tile-aware fallback for the 9-slice
     *  side bands + center when `mode === 'tile'`. Hands the rightmost /
     *  bottom-most cells a clipped final tile when dw / dh aren't multiples
     *  of the source size. */
    const tile = (sx: number, sy: number, sw: number, sh: number, dx: number, dy: number, dw: number, dh: number): void => {
      if (sw <= 0 || sh <= 0 || dw <= 0 || dh <= 0) return;
      for (let ty = 0; ty < dh; ty += sh) {
        const rh = Math.min(sh, dh - ty);
        for (let tx = 0; tx < dw; tx += sw) {
          const rw = Math.min(sw, dw - tx);
          cp(sx, sy, rw, rh, dx + tx, dy + ty, rw, rh);
        }
      }
    };
    // Corners always copy 1:1 — using clamped insets so we don't read past
    // the source bitmap when the cinf overdeclared the band thickness.
    cp(0, 0, _l, _t, 0, 0, _l, _t); // TL
    cp(sr.w - _r, 0, _r, _t, dr.w - _r, 0, _r, _t); // TR
    cp(0, sr.h - _b, _l, _b, 0, dr.h - _b, _l, _b); // BL
    cp(sr.w - _r, sr.h - _b, _r, _b, dr.w - _r, dr.h - _b, _r, _b); // BR
    // Edges + center — stretch or tile per mode.
    const span = mode === 'tile' ? tile : cp;
    span(_l, 0, smx, _t, _l, 0, dmx, _t); // top
    span(_l, sr.h - _b, smx, _b, _l, dr.h - _b, dmx, _b); // bottom
    span(0, _t, _l, smy, 0, _t, _l, dmy); // left
    span(sr.w - _r, _t, _r, smy, dr.w - _r, _t, _r, dmy); // right
    span(_l, _t, smx, smy, _l, _t, dmx, dmy); // center
  }

  /** Fill a rectangle with a solid RGBA color (srcCopy). */
  fillRect(rect: PixRect, r: number, g: number, b: number, a = 255): void {
    for (let y = rect.y; y < rect.y + rect.h; y++) {
      for (let x = rect.x; x < rect.x + rect.w; x++) {
        this.setPixel(x, y, r, g, b, a);
      }
    }
  }

  /**
   * Composite `src` over this buffer at (dx, dy) with straight-alpha
   * source-over blending. Used for glyphs: transparent pixels leave the
   * destination untouched, opaque pixels overwrite.
   */
  drawOver(src: PixelBuffer, dx: number, dy: number): void {
    for (let y = 0; y < src.height; y++) {
      for (let x = 0; x < src.width; x++) {
        const [r, g, b, a] = src.getPixel(x, y);
        if (a === 0) continue;
        if (a === 255) {
          this.setPixel(dx + x, dy + y, r, g, b, 255);
          continue;
        }
        const [dr, dg, db, da] = this.getPixel(dx + x, dy + y);
        const sa = a / 255;
        this.setPixel(
          dx + x,
          dy + y,
          Math.round(r * sa + dr * (1 - sa)),
          Math.round(g * sa + dg * (1 - sa)),
          Math.round(b * sa + db * (1 - sa)),
          Math.max(a, da),
        );
      }
    }
  }

  /** Copy the buffer into a fresh ImageData for blitting to a canvas. */
  toImageData(): ImageData {
    const out = new ImageData(this.width, this.height);
    out.data.set(this.data);
    return out;
  }
}
