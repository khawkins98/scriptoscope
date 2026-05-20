import { PixelBuffer } from './pixelBuffer.js';

/**
 * Rasterize a short text string into a PixelBuffer at native chrome
 * resolution, so it composites into the chrome bitmap and pixelates with
 * everything else under the CSS integer upscale (a bitmap-font look).
 *
 * Canvas is used only to rasterize glyphs; the result is raw pixels in
 * the chrome buffer. The text is drawn in `color`; the buffer background
 * is transparent (the caller clears the title band first, then alpha-
 * overs this in).
 *
 * NOTE: the glyph shapes come from the platform font here (a bold
 * geometric fallback), not the period Chicago bitmap font — a later
 * refinement is to bundle the actual scheme/system bitmap font. The
 * point of this module is that the title is now PART OF the composited
 * buffer, not a separate DOM overlay.
 */
export function rasterizeText(text: string, heightPx: number, color: string): PixelBuffer {
  const fontPx = Math.max(6, heightPx);
  const measure = document.createElement('canvas').getContext('2d');
  if (!measure) return PixelBuffer.alloc(1, 1);
  const font = `700 ${fontPx}px Chicago, "Charcoal", Geneva, Verdana, sans-serif`;
  measure.font = font;
  const w = Math.max(1, Math.ceil(measure.measureText(text).width));
  const h = Math.ceil(fontPx * 1.3);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return PixelBuffer.alloc(1, 1);
  ctx.imageSmoothingEnabled = false;
  ctx.font = font;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillStyle = color;
  ctx.fillText(text, 0, Math.round(h / 2));
  const id = ctx.getImageData(0, 0, w, h);
  return new PixelBuffer(w, h, id.data);
}
