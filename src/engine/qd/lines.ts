// Source-sampled lines: the tile blit's one-column / one-row fast path as the
// CDEFs draw it (slider BL4/BL5, progress BLIT3/BLIT4; qd-primitives L1–L3).
// Per source row (one-column source) or column (one-row source), from the start
// while inside the destination: when the source pixel's mask is set, a 1-pixel
// line across the destination in that pixel's colour (`colours`, the caller's
// colour-table source); clear rows are left alone.
import type { Pixmap, QdRect } from './types.js';
import { getPixel } from './pixel.js';
import { newPen, moveTo, lineTo } from './pen.js';

/** Draw `s` of `pm` into `d` of `port` as lines; `columnSource` selects rows (true) or columns. */
export function sourceLines(port: Pixmap, pm: Pixmap, colours: Pixmap, s: QdRect, d: QdRect, columnSource: boolean): void {
  const n = columnSource ? s.bottom - s.top : s.right - s.left;
  for (let j = 0; j < n; j++) {
    if (columnSource ? d.top + j >= d.bottom : d.left + j >= d.right) break;
    const sx = columnSource ? s.left : s.left + j, sy = columnSource ? s.top + j : s.top;
    const mask = getPixel(pm, sx, sy);
    if (!mask || mask.a === 0) continue;
    const pen = newPen(getPixel(colours, sx, sy) ?? mask);
    if (columnSource) { moveTo(pen, d.left, d.top + j); lineTo(port, pen, d.right - 1, d.top + j); }
    else { moveTo(pen, d.left + j, d.top); lineTo(port, pen, d.left + j, d.bottom - 1); }
  }
}
