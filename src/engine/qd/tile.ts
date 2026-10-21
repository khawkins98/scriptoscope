// Tile blit (docs/spec/engine/qd-primitives.md §2 "Tile blit", §4 rows T1–T7,
// §5 tile index formula). Cited range `0xfeae..0x10262`.
//
// One source-sized tile per step along one axis:
//   T4  step axis: source height ≠ dst height → step vertically by the source
//       height; otherwise step horizontally by the source width. The direction
//       byte never selects the axis.
//   T5  direction 1 (forward): first tile at the dst top-left; the partial tile
//       at the far end keeps the source's leading columns/rows.
//   T6  direction 0 (reverse): first tile at the dst bottom-right; the partial
//       tile at the near end keeps the source's trailing columns/rows.
// Equivalently, dst index k reads source offset `k % sw` (forward) or
// `sw − 1 − ((dw − 1 − k) % sw)` (reverse); the two coincide when dw is a
// multiple of sw.
//
// Not implemented, pending spec answers (v2-lanes/L4/SPEC-QUESTIONS.md):
//   T1/T2 fast paths (§6 Q3: what "nonzero" means). Such calls take the general
//         path T3; the trace records the fast-path row the spec would take.
//   T7    clip-region cull: the engine has no clip region; the spec records it
//         as changing no pixels (an inference, §4 T7).
//   altSource (§6 Q1) is not accepted.
//   A vertical step whose cross widths differ (T4 states only the step axis;
//         every spec caller fixes the cross axis): drawn as nothing and traced
//         as `unspecified`.
//   The degenerate-rect guard's exact condition (§6 Q2): an empty source or
//         dst rect (EmptyRect) draws nothing.
import type { Pixmap, QdRect, TileDirection, Transfer } from './types.js';
import type { EngineTrace } from '../trace.js';
import { emptyRect } from './rect.js';
import { transferBits } from './transfer.js';

/**
 * Which transfer trap a tile (or scale) blit uses (§3 "Per-tile transfer"):
 * a port with custom bottleneck procedures (`grafProcs` non-nil) takes
 * CopyBits srcCopy, otherwise CopyMask.
 */
export function transferForPort(port: { readonly customBottlenecks: boolean }): Transfer {
  return port.customBottlenecks ? 'copyBits' : 'copyMask';
}

/** The fast-path row (T1/T2) the spec takes for these rects, or null for T3. */
export function tileFastPathRow(srcRect: QdRect, dstRect: QdRect): 'T1' | 'T2' | null {
  const sw = srcRect.right - srcRect.left, sh = srcRect.bottom - srcRect.top;
  const dw = dstRect.right - dstRect.left, dh = dstRect.bottom - dstRect.top;
  if (sw === 1 && dw > 1) return 'T1';
  if (sh === 1 && dh > 1) return 'T2';
  return null;
}

/**
 * The §5 tile index formula: the source offset that dst index `k` reads, for a
 * source run of `sw` and a dst run of `dw`.
 */
export function tileSourceOffset(k: number, sw: number, dw: number, direction: TileDirection): number {
  return direction === 1 ? k % sw : sw - 1 - ((dw - 1 - k) % sw);
}

/** Tile `srcRect` of `source` across `dstRect` of `port` (rows T3–T6). */
export function tileBlit(
  port: Pixmap,
  source: Pixmap,
  srcRect: QdRect,
  dstRect: QdRect,
  direction: TileDirection,
  transfer: Transfer,
  trace?: EngineTrace,
): void {
  if (emptyRect(srcRect) || emptyRect(dstRect)) return;
  const sw = srcRect.right - srcRect.left, sh = srcRect.bottom - srcRect.top;
  const dw = dstRect.right - dstRect.left, dh = dstRect.bottom - dstRect.top;
  const vertical = sh !== dh; // T4
  const fastPath = tileFastPathRow(srcRect, dstRect);
  const stepRow = direction === 1 ? 'T5' : 'T6';
  if (vertical && sw !== dw) {
    trace?.drawOps.push({ op: 'tile', row: 'T4', src: srcRect, dst: dstRect, direction, transfer, unspecified: 'vertical step with unequal cross widths' });
    return;
  }
  trace?.drawOps.push({
    op: 'tile', row: `T3,T4,${stepRow}`, src: srcRect, dst: dstRect, direction, transfer,
    axis: vertical ? 'vertical' : 'horizontal', ...(fastPath ? { fastPathDeferred: fastPath } : {}),
  });
  if (!vertical) {
    if (direction === 1) {
      for (let left = dstRect.left; left < dstRect.right; left += sw) {
        const seg = Math.min(sw, dstRect.right - left);
        transferBits(port, source,
          { top: srcRect.top, left: srcRect.left, bottom: srcRect.bottom, right: srcRect.left + seg },
          { top: dstRect.top, left, bottom: dstRect.bottom, right: left + seg }, transfer);
      }
    } else {
      for (let right = dstRect.right; right > dstRect.left; right -= sw) {
        const seg = Math.min(sw, right - dstRect.left);
        transferBits(port, source,
          { top: srcRect.top, left: srcRect.right - seg, bottom: srcRect.bottom, right: srcRect.right },
          { top: dstRect.top, left: right - seg, bottom: dstRect.bottom, right }, transfer);
      }
    }
    return;
  }
  if (direction === 1) {
    for (let top = dstRect.top; top < dstRect.bottom; top += sh) {
      const seg = Math.min(sh, dstRect.bottom - top);
      transferBits(port, source,
        { top: srcRect.top, left: srcRect.left, bottom: srcRect.top + seg, right: srcRect.right },
        { top, left: dstRect.left, bottom: top + seg, right: dstRect.right }, transfer);
    }
  } else {
    for (let bottom = dstRect.bottom; bottom > dstRect.top; bottom -= sh) {
      const seg = Math.min(sh, bottom - dstRect.top);
      transferBits(port, source,
        { top: srcRect.bottom - seg, left: srcRect.left, bottom: srcRect.bottom, right: srcRect.right },
        { top: bottom - seg, left: dstRect.left, bottom, right: dstRect.right }, transfer);
    }
  }
}
