// The owned pixel engine. This is the "native compatibility runtime":
// a framework-agnostic RGBA buffer with the QuickDraw operations
// Kaleidoscope's kDEF actually uses, implemented ourselves so every
// pixel is under our control. No canvas-2D shortcuts — canvas is used
// only to load source bitmaps and to blit the finished buffer.
//
// Reference: docs/tracking/kdef-disassembly-findings.md §2.1 — kDEF
// renders via CopyBits/CopyMask with sample-and-hold (nearest-neighbor)
// scaling. That is exactly what `copyBits` below implements.

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

  /** Copy the buffer into a fresh ImageData for blitting to a canvas. */
  toImageData(): ImageData {
    const out = new ImageData(this.width, this.height);
    out.data.set(this.data);
    return out;
  }
}
