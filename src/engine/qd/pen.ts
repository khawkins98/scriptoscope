// Pen state, MoveTo / LineTo (Inside Macintosh: Imaging With QuickDraw,
// "Drawing Lines"). Used by the tile fast paths (qd-primitives T1/T2) and the
// one-column slicing pieces of the scroll-bar spec (scrollbar §5.9), which
// draw one line per row in a sampled colour.
//
// The pen is 1 × 1 and normal (PenNormal), so a line from the pen location to
// `(x, y)` covers both endpoints. Only horizontal and vertical lines are
// implemented: every engine caller the specs describe draws axis-aligned lines,
// and QuickDraw's diagonal stepping is not specified anywhere the engine may
// read, so a diagonal LineTo throws instead of guessing.
import type { Pixmap, Rgba } from './types.js';
import type { EngineTrace } from '../trace.js';
import { setPixel } from './pixel.js';

export interface Pen {
  x: number;
  y: number;
  /** RGBForeColor. */
  fore: Rgba;
}

export function newPen(fore: Rgba): Pen {
  return { x: 0, y: 0, fore };
}

export function moveTo(pen: Pen, x: number, y: number): void {
  pen.x = x;
  pen.y = y;
}

export function lineTo(port: Pixmap, pen: Pen, x: number, y: number, trace?: EngineTrace): void {
  if (x !== pen.x && y !== pen.y) throw new Error('lineTo: diagonal lines are not specified for the engine');
  trace?.drawOps.push({ op: 'line', from: { x: pen.x, y: pen.y }, to: { x, y }, rgb: { r: pen.fore.r, g: pen.fore.g, b: pen.fore.b } });
  const { r, g, b } = pen.fore;
  const x0 = Math.min(pen.x, x), x1 = Math.max(pen.x, x);
  const y0 = Math.min(pen.y, y), y1 = Math.max(pen.y, y);
  for (let yy = y0; yy <= y1; yy++) for (let xx = x0; xx <= x1; xx++) setPixel(port, xx, yy, r, g, b, 255);
  pen.x = x;
  pen.y = y;
}
