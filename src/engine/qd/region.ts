// Regions, the icon blit and the mask-clear region fill
// (docs/spec/engine/qd-primitives.md §4 "Icon blit" I1–I3, "Mask-clear region"
// R1–R2, "Pattern fills" F1–F2; scrollbar.md §3 draw order clip, AC4, AC5, TH7).
//
// A region is a per-pixel membership mask over a port (QuickDraw regions are
// sets of pixels; Inside Macintosh: Imaging With QuickDraw, "Regions"). Only
// the operations the scroll-bar draw needs exist: union a mapped icon mask,
// difference, and test.
//
// Engine pixmaps are decoded RGBA with the cicn mask in alpha (types.ts), so a
// mask region is "alpha > 0".
import type { Pixmap, QdPoint, QdRect } from './types.js';
import type { EngineTrace } from '../trace.js';
import { emptyRect } from './rect.js';
import { pixelIndex } from './pixel.js';
import { transferBits } from './transfer.js';

export interface Region {
  readonly width: number;
  readonly height: number;
  readonly bits: Uint8Array;
}

export function newRegion(port: { width: number; height: number }): Region {
  return { width: port.width, height: port.height, bits: new Uint8Array(port.width * port.height) };
}

export function regionHas(rgn: Region, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < rgn.width && y < rgn.height && rgn.bits[y * rgn.width + x] === 1;
}

/** Add every pixel of `r` (clipped to the region's extent). */
export function regionAddRect(rgn: Region, r: QdRect): void {
  for (let y = Math.max(0, r.top); y < Math.min(rgn.height, r.bottom); y++)
    for (let x = Math.max(0, r.left); x < Math.min(rgn.width, r.right); x++) rgn.bits[y * rgn.width + x] = 1;
}

/**
 * Union into `rgn` the icon mask of `srcRect` mapped onto `dstRect` (BitMapToRegion
 * then MapRgn): a destination pixel joins when the source pixel it maps to has
 * its mask set. The mapping is the transfer's sample-and-hold policy
 * (transfer.ts; qd-primitives §6 item 2, modern policy).
 */
export function regionAddMappedMask(rgn: Region, source: Pixmap, srcRect: QdRect, dstRect: QdRect): void {
  if (emptyRect(srcRect) || emptyRect(dstRect)) return;
  const sw = srcRect.right - srcRect.left, sh = srcRect.bottom - srcRect.top;
  const dw = dstRect.right - dstRect.left, dh = dstRect.bottom - dstRect.top;
  for (let row = 0; row < dh; row++) {
    const sy = srcRect.top + Math.floor((row * sh) / dh);
    for (let col = 0; col < dw; col++) {
      const si = pixelIndex(source, srcRect.left + Math.floor((col * sw) / dw), sy);
      if (si < 0 || source.data[si + 3] === 0) continue;
      const x = dstRect.left + col, y = dstRect.top + row;
      if (x >= 0 && y >= 0 && x < rgn.width && y < rgn.height) rgn.bits[y * rgn.width + x] = 1;
    }
  }
}

/** A cicn as the blits see it: decoded pixels, its pixel-map depth, and (for I3) its stored colours with the mask ignored. */
export interface IconSource {
  /** Decoded RGBA, mask in alpha. */
  readonly pixmap: Pixmap;
  /** The pixel map's depth in bits, or null when unknown. */
  readonly pixelSize: number | null;
  /** Every stored pixel opaque (alpha 255): the I3 CopyBits source. Null when unavailable. */
  readonly unmasked: Pixmap | null;
}

/**
 * Icon blit (`0xfdf8`, qd-primitives I1–I3) for a colour port with `lowDepth`
 * clear (I1 is not reachable under the declared defaults; the engine draws ≥ 8-bit
 * output). I2: a 1-bit pixel map → CopyMask with the icon's mask. I3: deeper →
 * CopyBits srcCopy, opaque, mask ignored. Without the unmasked pixels (or the
 * depth) the opaque copy cannot be made; that case is traced `unimplemented`
 * and drawn masked.
 */
export function iconBlit(port: Pixmap, icon: IconSource, srcRect: QdRect, dstRect: QdRect, trace?: EngineTrace, row?: string): void {
  if (emptyRect(srcRect) || emptyRect(dstRect)) return;
  if (icon.pixelSize === 1) {
    trace?.drawOps.push({ op: 'iconBlit', row: `${row ? `${row},` : ''}I2`, src: srcRect, dst: dstRect, transfer: 'copyMask' });
    transferBits(port, icon.pixmap, srcRect, dstRect, 'copyMask');
    return;
  }
  if (icon.pixelSize !== null && icon.unmasked) {
    trace?.drawOps.push({ op: 'iconBlit', row: `${row ? `${row},` : ''}I3`, src: srcRect, dst: dstRect, transfer: 'copyBits' });
    // Pixels mapped from outside the icon are undefined (S5): left untouched.
    transferBits(port, icon.unmasked, srcRect, dstRect, 'copyBits', 'untouched');
    return;
  }
  trace?.drawOps.push({ op: 'iconBlit', row: `${row ? `${row},` : ''}I3`, src: srcRect, dst: dstRect, transfer: 'copyMask',
    unimplemented: 'pixel depth or unmasked pixels unavailable; drawn masked' });
  transferBits(port, icon.pixmap, srcRect, dstRect, 'copyMask');
}

/** True when `r` lies wholly inside `pm`'s bounds (top-left at (0, 0)). */
export function insideBounds(pm: Pixmap, r: QdRect): boolean {
  return r.left >= 0 && r.top >= 0 && r.right <= pm.width && r.bottom <= pm.height;
}

/**
 * Mask-clear region (R1): `srcRect` minus the icon's mask, placed 1:1 (not
 * scaled) with `srcRect`'s top-left at `dst`, then region-filled with `pattern`
 * (F1–F2): port pixel (X, Y) shows pattern pixel ((X − phase.x) mod pw, (Y − phase.y) mod ph).
 */
export function fillMaskClearRegion(port: Pixmap, icon: Pixmap, srcRect: QdRect, dst: QdPoint, pattern: Pixmap,
  phase: QdPoint, trace?: EngineTrace, row?: string): void {
  if (emptyRect(srcRect) || pattern.width <= 0 || pattern.height <= 0) return;
  const mod = (a: number, n: number): number => ((a % n) + n) % n;
  trace?.drawOps.push({ op: 'fillRegion', row: `${row ? `${row},` : ''}R1,F1,F2`,
    src: srcRect, at: { x: dst.x, y: dst.y }, phase: { x: phase.x, y: phase.y } });
  for (let sy = srcRect.top; sy < srcRect.bottom; sy++) {
    for (let sx = srcRect.left; sx < srcRect.right; sx++) {
      const si = pixelIndex(icon, sx, sy);
      if (si >= 0 && icon.data[si + 3] !== 0) continue; // mask set: not in the region
      const x = dst.x + (sx - srcRect.left), y = dst.y + (sy - srcRect.top);
      const di = pixelIndex(port, x, y);
      if (di < 0) continue;
      const pi = pixelIndex(pattern, mod(x - phase.x, pattern.width), mod(y - phase.y, pattern.height));
      port.data[di] = pattern.data[pi]!; port.data[di + 1] = pattern.data[pi + 1]!;
      port.data[di + 2] = pattern.data[pi + 2]!; port.data[di + 3] = pattern.data[pi + 3]!;
    }
  }
}

/**
 * CopyBits srcCopy of `src` (whole) to `dst` at `at`, through a clip: only
 * pixels where `clip(x, y)` holds are written. Source pixels flagged in
 * `undefinedPixels` (offscreen pixels nothing drew, scrollbar §6 item 4) are
 * not written; the caller traces them.
 */
export function copyClipped(dst: Pixmap, src: Pixmap, at: QdPoint, clip: (x: number, y: number) => boolean,
  undefinedPixels?: Uint8Array): void {
  for (let y = 0; y < src.height; y++) {
    for (let x = 0; x < src.width; x++) {
      if (undefinedPixels && undefinedPixels[y * src.width + x]) continue;
      const px = at.x + x, py = at.y + y;
      if (!clip(px, py)) continue;
      const di = pixelIndex(dst, px, py);
      if (di < 0) continue;
      const si = (y * src.width + x) * 4;
      dst.data[di] = src.data[si]!; dst.data[di + 1] = src.data[si + 1]!;
      dst.data[di + 2] = src.data[si + 2]!; dst.data[di + 3] = src.data[si + 3]!;
    }
  }
}
