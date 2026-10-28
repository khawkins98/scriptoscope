// Slicing a source rect S into a destination D along one axis (the kDEF slicer
// `0xb44c..0xba0c`, specified in docs/spec/engine/scrollbar.md §5.9; first used
// by the scroll-bar thumb and track, reusable by any family whose spec cites it).
//
// Equal-size S and D: one 1:1 copy. Otherwise pieces spanning the full cross of S
// and of D (the cross axis scales):
//   mode > 0  halves (3 pieces; the middle one column of S, only when s < w);
//   mode ≤ 0  caps, cap k = `modeZeroCap` for mode 0 (the caller's table value),
//             else k = −mode (5 pieces; pieces 2 and 4 one column, only when s < w).
// A one-column source piece whose cross size matches the destination's is drawn
// as one line per cross row in that pixel's colour, skipping mask-clear rows
// (`0xb362..0xb432`; qd-primitives L1–L3); every other piece is a masked scale
// blit (SC3). With a region, each piece's mask mapped into its destination is
// unioned into it (`0xb332..0xb360`).
import type { Pixmap, QdRect } from './types.js';
import type { EngineTrace } from '../trace.js';
import { emptyRect } from './rect.js';
import { scaleBlit } from '../../raster.js';
import { sourceLines } from '../../raster.js';
import { regionAddMappedMask, type Region } from '../../raster.js';
import { axis, alongLength } from './axis.js';

export interface SlicePiece {
  src: QdRect;
  dst: QdRect;
  /** One-column source with matching cross size: drawn as lines. */
  line: boolean;
  /** `1:1`, `halves-1..3` or `caps-1..5`. */
  piece: string;
}

/** The §5.9 pieces of S → D for slice `mode`, with `modeZeroCap` as the mode-0 cap. */
export function slicePieces(horizontal: boolean, S: QdRect, D: QdRect, mode: number, modeZeroCap: number): SlicePiece[] {
  const ax = axis(horizontal);
  const sw = S.right - S.left, sh = S.bottom - S.top, dw = D.right - D.left, dh = D.bottom - D.top;
  if (sw === dw && sh === dh) return [{ src: S, dst: D, line: false, piece: '1:1' }];
  const s = alongLength(ax, S), w = alongLength(ax, D), m = Math.min(s, w), a = m >> 1;
  const sc0 = ax.c0(S), sc1 = ax.c1(S), dc0 = ax.c0(D), dc1 = ax.c1(D);
  const crossMatch = sc1 - sc0 === dc1 - dc0;
  const Ss = ax.a0(S), Se = ax.a1(S), Ds = ax.a0(D), De = ax.a1(D);
  const p = (piece: string, d0: number, d1: number, s0: number, s1: number): SlicePiece =>
    ({ piece, dst: ax.mk(d0, d1, dc0, dc1), src: ax.mk(s0, s1, sc0, sc1), line: s1 - s0 === 1 && crossMatch });
  const out: SlicePiece[] = [];
  if (mode > 0) {
    out.push(p('halves-1', Ds, Ds + a, Ss, Ss + a));
    if (s < w) out.push(p('halves-2', Ds + a, De - (m - a), Ss + a, Ss + a + 1));
    out.push(p('halves-3', De - (m - a), De, Se - (m - a), Se));
    return out;
  }
  const k = mode === 0 ? modeZeroCap : -mode;
  const mid = (Ds + De) >> 1;
  const q1 = s > w ? Math.trunc((s - w + 1) / 2) : 0, q2 = s > w ? Math.trunc((s - w) / 2) : 0;
  out.push(p('caps-1', Ds, Ds + k, Ss, Ss + k));
  if (s < w) out.push(p('caps-2', Ds + k, mid - a + k, Ss + k - 1, Ss + k));
  out.push(p('caps-3', mid - a + k, mid + (m - a) - k + 1, Ss + k + q1, Se - k + 1 - q2));
  if (s < w) out.push(p('caps-4', mid + (m - a) - k + 1, De - k + 1, Se - k, Se - k + 1));
  out.push(p('caps-5', De - k + 1, De, Se - k + 1, Se));
  return out;
}

export interface SliceOptions {
  /** The mode-0 cap from the caller's decision table. */
  modeZeroCap: number;
  /** Trace row prefix (the caller's spec row ids). */
  row: string;
  /** Union each piece's mapped mask into this region. */
  region?: Region;
  trace?: EngineTrace;
}

/** Draw the pieces of `src`'s S into D of `port`. */
export function drawSlices(port: Pixmap, horizontal: boolean, src: Pixmap, S: QdRect, D: QdRect, mode: number, opts: SliceOptions): void {
  const { row, region, trace } = opts;
  for (const pc of slicePieces(horizontal, S, D, mode, opts.modeZeroCap)) {
    if (emptyRect(pc.dst) || emptyRect(pc.src)) continue;
    if (region) regionAddMappedMask(region, src, pc.src, pc.dst);
    if (!pc.line) {
      trace?.drawOps.push({ op: 'slice', row, piece: pc.piece, src: pc.src, dst: pc.dst, transfer: 'copyMask' });
      scaleBlit(port, src, pc.src, pc.dst, 'copyMask');
      continue;
    }
    trace?.drawOps.push({ op: 'sliceLines', row: `${row},L1,L2`, piece: pc.piece, src: pc.src, dst: pc.dst });
    sourceLines(port, src, src, pc.src, pc.dst, horizontal);
  }
}
