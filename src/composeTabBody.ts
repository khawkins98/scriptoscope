import { PixelBuffer } from './pixelBuffer.js';
import type { ChromeElement } from './types.js';

/** CDEF 8 0x16e, ordinary full-color masked body subset. Null explicitly retains
 * the legacy compositor when the needed cinf/sample/pattern contract is absent.
 * See docs/spec/tab-cdef8-body.md; this does not choose variants or lay out text. */
export function composeTabBody(source: PixelBuffer, element: ChromeElement, width: number): PixelBuffer | null {
  const slice = element.slice;
  if (!slice) return null;
  const { corner: c, side: s } = slice;
  if (![c, s, width].every(Number.isInteger) || c < 0 || s < 0 ||
      c * 2 >= source.width || s > source.height || width < c * 2) return null;
  const hasCenter = width > c * 2 && source.height > s * 2;
  let background: readonly number[] | undefined;
  if (hasCenter) {
    // Original tab painter loads a ppat only for nonzero cinf+4. This is not
    // push/bevel's mode-5 cicn branch, and its phase is not implemented here.
    if (element.bodyRequest?.resourceId !== 0) return null;
    const samples = element.colorSamples;
    if (samples?.model === 'kdef-2.3.1-color' && samples.displayPolicy === 'mac-1.8-to-2.2-high-byte') {
      background = samples.background?.displayRgb;
    }
    if (!background) {
      const anchor = element.bgAnchor;
      if (!anchor || !anchor.every(Number.isInteger) || anchor[0] < 0 || anchor[1] < 0 ||
          anchor[0] >= source.width || anchor[1] >= source.height) return null;
      const pixel = source.getPixel(anchor[0], anchor[1]);
      // Canvas transport loses hidden RGB; do not invent a color for mask holes.
      if (pixel[3] !== 255) return null;
      background = pixel;
    }
  }
  const out = PixelBuffer.alloc(width, source.height);
  const copy = (sx: number, sy: number, dx: number, dy: number, w: number, h: number): void => {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const p = source.getPixel(sx + x, sy + y);
      if (p[3]) out.setPixel(dx + x, dy + y, p[0], p[1], p[2], p[3]);
    }
  };
  // Full-height ends precede the two bands (0x430..0x552). The source and
  // destination heights are identical, including transparent raster padding.
  copy(0, 0, 0, 0, c, source.height);
  copy(source.width - c, 0, width - c, 0, c, source.height);
  const bandWidth = slice.tile ? source.width - c * 2 : 1;
  for (const y of [0, source.height - s]) {
    for (let x = c; x < width - c; x += bandWidth) {
      copy(c, y, x, y, Math.min(bandWidth, width - c - x), s);
    }
  }
  // The source center is never stretched. Empty centers draw nothing; positive
  // solid centers use the independently sampled background (0x56c..0x600).
  if (hasCenter && background) out.fillRect({ x: c, y: s, w: width - 2 * c, h: source.height - 2 * s },
    background[0]!, background[1]!, background[2]!);
  return out;
}
