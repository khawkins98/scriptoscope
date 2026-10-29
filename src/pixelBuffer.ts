import { registerPixelBuffer } from './preparedPattern.js';
import type { Pixmap } from './engine/qd/types.js';
import { readPixel, setPixel, copyBits, nineSlice, fillRect, drawOver, rasterToImageData, type PixRect } from './raster.js';
import { rectXYWH } from './engine/qd/rect.js';
export type { PixRect } from './raster.js';

/** Public pixel value; painting is implemented by the shared immediate raster backend. */
export class PixelBuffer implements Pixmap {
  readonly data: Uint8ClampedArray;
  constructor(readonly width: number, readonly height: number, data?: Uint8ClampedArray) {
    this.data = data ?? new Uint8ClampedArray(width * height * 4);
    registerPixelBuffer(this);
  }
  static alloc(width: number, height: number): PixelBuffer { return new PixelBuffer(width, height); }
  getPixel(x: number, y: number): [number, number, number, number] { return readPixel(this, x, y); }
  setPixel(x: number, y: number, r: number, g: number, b: number, a: number): void { setPixel(this, x, y, r, g, b, a); }
  copyBits(src: PixelBuffer, S: PixRect, D: PixRect): void { copyBits(this, src, rectXYWH(S.x, S.y, S.w, S.h), rectXYWH(D.x, D.y, D.w, D.h)); }
  nineSlice(src: PixelBuffer, S: PixRect, ins: { l: number; t: number; r: number; b: number }, D: PixRect, mode: 'stretch' | 'tile' = 'stretch'): void {
    nineSlice(this, src, S, ins, D, mode);
  }
  fillRect(box: PixRect, r: number, g: number, b: number, a = 255): void { fillRect(this, box, r, g, b, a); }
  drawOver(src: PixelBuffer, x: number, y: number, clip?: PixRect): void { drawOver(this, src, x, y, clip); }
  toImageData(): ImageData { return rasterToImageData(this); }
}
