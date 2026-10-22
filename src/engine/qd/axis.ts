// Along/cross axis helpers for one-dimensional controls (scroll bars, and any
// family whose spec writes formulas for a horizontal control and says "a
// vertical one swaps x/y", e.g. docs/spec/engine/scrollbar.md §5). Pure; no drawing.
//
// "Along" is the axis the control runs on (x when horizontal, y when vertical),
// "cross" the other one. The readers return a rect's along start and end and
// its cross start and end; `mk` builds a rect from along and cross intervals.
import type { Pixmap, QdRect } from './types.js';
import { rect } from './rect.js';

export interface Axis {
  readonly h: boolean;
  a0(r: QdRect): number;
  a1(r: QdRect): number;
  c0(r: QdRect): number;
  c1(r: QdRect): number;
  mk(a0: number, a1: number, c0: number, c1: number): QdRect;
}

export function axis(horizontal: boolean): Axis {
  return horizontal
    ? { h: true, a0: r => r.left, a1: r => r.right, c0: r => r.top, c1: r => r.bottom, mk: (a0, a1, c0, c1) => rect(c0, a0, c1, a1) }
    : { h: false, a0: r => r.top, a1: r => r.bottom, c0: r => r.left, c1: r => r.right, mk: (a0, a1, c0, c1) => rect(a0, c0, a1, c1) };
}

/** Along length of `r`. */
export const alongLength = (ax: Axis, r: QdRect): number => ax.a1(r) - ax.a0(r);

/** A pixmap's bounds as a rect with its top-left at (0, 0). */
export const pixmapBounds = (pm: Pixmap): QdRect => rect(0, 0, pm.height, pm.width);
