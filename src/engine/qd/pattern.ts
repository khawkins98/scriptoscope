// Pattern fill and erase (docs/spec/engine/qd-primitives.md §4 rows B3, B5, B6
// and table P; §6 Q7).
//
// Phase. QuickDraw aligns a pattern with the local coordinate origin (Inside
// Macintosh: Imaging With QuickDraw, "Patterns"); the kDEF's fill helper
// adjusts the port origin by the phase argument before filling (qd-primitives
// B5, §6 Q7). The engine models that as: the pattern's pixel (0, 0) lands on
// the phase point, so port pixel (x, y) shows pattern pixel
// `((x − phase.x) mod pw, (y − phase.y) mod ph)`. The sign of the origin
// adjustment and the FillCRect/FillRect alternate path are spec question L4-Q7.
//
// Transfer: patCopy; every pattern pixel overwrites the port (alpha copied as
// decoded; ppat pixels are opaque).
import type { Pixmap, QdPoint, QdRect, Rgba } from './types.js';
import type { EngineTrace } from '../trace.js';
import { emptyRect } from './rect.js';
import { pixelIndex } from './pixel.js';

const mod = (a: number, n: number): number => ((a % n) + n) % n;

/** Fill `r` of `port` with `pattern`, phase anchored at `phase`. */
export function fillPattern(port: Pixmap, r: QdRect, pattern: Pixmap, phase: QdPoint, trace?: EngineTrace, row?: string): void {
  if (emptyRect(r) || pattern.width <= 0 || pattern.height <= 0) return;
  trace?.drawOps.push({ op: 'fillPattern', ...(row ? { row } : {}), dst: r, phase: { x: phase.x, y: phase.y }, pattern: { width: pattern.width, height: pattern.height } });
  const d = port.data, p = pattern.data;
  for (let y = r.top; y < r.bottom; y++) {
    const py = mod(y - phase.y, pattern.height);
    for (let x = r.left; x < r.right; x++) {
      const di = pixelIndex(port, x, y);
      if (di < 0) continue;
      const pi = pixelIndex(pattern, mod(x - phase.x, pattern.width), py);
      d[di] = p[pi]!; d[di + 1] = p[pi + 1]!; d[di + 2] = p[pi + 2]!; d[di + 3] = p[pi + 3]!;
    }
  }
}

/**
 * EraseRect (the kDEF's EraseRoundRect with both oval sizes zero, §5): fill
 * with the current background colour, opaque.
 */
export function eraseRect(port: Pixmap, r: QdRect, background: Rgba, trace?: EngineTrace, row?: string): void {
  if (emptyRect(r)) return;
  trace?.drawOps.push({ op: 'erase', ...(row ? { row } : {}), dst: r, rgb: { r: background.r, g: background.g, b: background.b } });
  const d = port.data;
  for (let y = r.top; y < r.bottom; y++) {
    for (let x = r.left; x < r.right; x++) {
      const di = pixelIndex(port, x, y);
      if (di < 0) continue;
      d[di] = background.r; d[di + 1] = background.g; d[di + 2] = background.b; d[di + 3] = 255;
    }
  }
}
