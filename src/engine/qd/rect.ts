// Rect helpers (Inside Macintosh: QuickDraw). Pure; no drawing.
import type { QdRect } from './types.js';

export function rect(top: number, left: number, bottom: number, right: number): QdRect {
  return { top, left, bottom, right };
}

/** Build a Rect from an `(x, y, w, h)` box, the form the legacy runtime uses. */
export function rectXYWH(x: number, y: number, w: number, h: number): QdRect {
  return { top: y, left: x, bottom: y + h, right: x + w };
}

export function rectWidth(r: QdRect): number {
  return r.right - r.left;
}

export function rectHeight(r: QdRect): number {
  return r.bottom - r.top;
}

/** QuickDraw EmptyRect: true when the rect encloses no pixels. */
export function emptyRect(r: QdRect): boolean {
  return r.right <= r.left || r.bottom <= r.top;
}

/** QuickDraw OffsetRect. */
export function offsetRect(r: QdRect, dh: number, dv: number): QdRect {
  return { top: r.top + dv, left: r.left + dh, bottom: r.bottom + dv, right: r.right + dh };
}

/** QuickDraw InsetRect: positive insets shrink. */
export function insetRect(r: QdRect, dh: number, dv: number): QdRect {
  return { top: r.top + dv, left: r.left + dh, bottom: r.bottom - dv, right: r.right - dh };
}
