// The two transfer traps every blit ends in (docs/spec/engine/qd-primitives.md
// §3): CopyBits `$A8EC` srcCopy and CopyMask `$A817`.
//
// Scaling. When srcRect and dstRect differ in size, both map each destination
// pixel to a source pixel by sample-and-hold: dst offset `k` along an axis of
// dst length `dw` reads src offset `floor(k · sw / dw)`. This is the mapping the
// runtime's PixelBuffer.copyBits has always used; the spec does not state
// CopyBits' exact scaling rule (spec question L4-Q4), so the engine keeps it
// unchanged rather than inventing another.
//
// Out-of-range source pixels read as transparent black; out-of-range
// destination pixels are clipped. Empty rects transfer nothing (EmptyRect).
import type { Pixmap, QdRect, Transfer } from './types.js';
import { pixelIndex } from './pixel.js';
import { emptyRect } from './rect.js';

/**
 * How a destination pixel that maps outside the source's bounds is treated:
 * `transparent` (default, the behaviour above) or `untouched`, for callers
 * whose spec calls such pixels undefined (qd-primitives S5; scrollbar §5.4):
 * the destination keeps its pixel and the caller traces it `unspecified`.
 */
export type OutsideSource = 'transparent' | 'untouched';

/** Copy `srcRect` of `src` into `dstRect` of `dst` with the given transfer. */
export function transferBits(dst: Pixmap, src: Pixmap, srcRect: QdRect, dstRect: QdRect, transfer: Transfer,
  outside: OutsideSource = 'transparent'): void {
  if (emptyRect(srcRect) || emptyRect(dstRect)) return;
  const sw = srcRect.right - srcRect.left;
  const sh = srcRect.bottom - srcRect.top;
  const dw = dstRect.right - dstRect.left;
  const dh = dstRect.bottom - dstRect.top;
  const masked = transfer === 'copyMask';
  const s = src.data;
  const d = dst.data;
  for (let row = 0; row < dh; row++) {
    const sy = srcRect.top + Math.floor((row * sh) / dh);
    for (let col = 0; col < dw; col++) {
      const di = pixelIndex(dst, dstRect.left + col, dstRect.top + row);
      if (di < 0) continue;
      const si = pixelIndex(src, srcRect.left + Math.floor((col * sw) / dw), sy);
      if (si < 0) {
        // Outside the source: transparent black. CopyMask treats it as masked.
        if (!masked && outside === 'transparent') { d[di] = 0; d[di + 1] = 0; d[di + 2] = 0; d[di + 3] = 0; }
        continue;
      }
      const a = s[si + 3]!;
      if (masked && a === 0) continue;
      d[di] = s[si]!;
      d[di + 1] = s[si + 1]!;
      d[di + 2] = s[si + 2]!;
      d[di + 3] = a;
    }
  }
}

/** CopyBits `$A8EC`, srcCopy: opaque, alpha included. */
export function copyBits(dst: Pixmap, src: Pixmap, srcRect: QdRect, dstRect: QdRect): void {
  transferBits(dst, src, srcRect, dstRect, 'copyBits');
}

/** CopyMask `$A817`: masked-out (alpha 0) source pixels leave `dst` unchanged. */
export function copyMask(dst: Pixmap, src: Pixmap, srcRect: QdRect, dstRect: QdRect): void {
  transferBits(dst, src, srcRect, dstRect, 'copyMask');
}
