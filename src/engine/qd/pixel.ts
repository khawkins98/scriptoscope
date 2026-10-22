// Single-pixel access: GetPixel-style sampling and the one write path every
// primitive funnels through (docs/spec/engine/qd-primitives.md §3 "Sampled
// colours": samples are read by GetPixel).
//
// GetPixel's depth handling (1/2/4/8-bit pixmaps resolved through the colour
// table) is a decode-time concern here: engine pixmaps are already decoded to
// RGBA by tools/theme-loader, so sampling reads the decoded colour directly.
import type { Pixmap, Rgba } from './types.js';

/** Bytes per RGBA pixel. */
const STRIDE = 4;

/** Read a pixel; `null` outside the pixmap. */
export function getPixel(pm: Pixmap, x: number, y: number): Rgba | null {
  if (x < 0 || y < 0 || x >= pm.width || y >= pm.height) return null;
  const i = (y * pm.width + x) * STRIDE;
  const d = pm.data;
  return { r: d[i]!, g: d[i + 1]!, b: d[i + 2]!, a: d[i + 3]! };
}

/** Write a pixel; writes outside the pixmap are clipped (dropped). */
export function setPixel(pm: Pixmap, x: number, y: number, r: number, g: number, b: number, a: number): void {
  if (x < 0 || y < 0 || x >= pm.width || y >= pm.height) return;
  const i = (y * pm.width + x) * STRIDE;
  const d = pm.data;
  d[i] = r;
  d[i + 1] = g;
  d[i + 2] = b;
  d[i + 3] = a;
}

/** Index of pixel `(x, y)`'s first byte, or -1 outside the pixmap. */
export function pixelIndex(pm: Pixmap, x: number, y: number): number {
  if (x < 0 || y < 0 || x >= pm.width || y >= pm.height) return -1;
  return (y * pm.width + x) * STRIDE;
}
