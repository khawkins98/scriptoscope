// Scale blit and corner 1:1 (docs/spec/engine/qd-primitives.md §2–§3).
//
// Scale blit (`0x10320..0x10402`): exactly one transfer `srcRect → dstRect`, so
// the source is scaled when the rects differ. What selects CopyBits versus
// CopyMask, and the colour its RGBForeColor call sets, are open (§6 Q4): the
// caller passes the transfer explicitly and no foreground colour is modelled.
//
// Corner 1:1 (`0x102d0`): offsets `srcRect` by `(dstX, dstY)` minus its own
// top-left and calls the scale blit, so the corner is placed at 1:1 size.
import type { Pixmap, QdRect, Transfer } from './types.js';
import type { EngineTrace } from '../trace.js';
import { emptyRect, offsetRect } from './rect.js';
import { transferBits } from './transfer.js';

export function scaleBlit(port: Pixmap, source: Pixmap, srcRect: QdRect, dstRect: QdRect, transfer: Transfer, trace?: EngineTrace): void {
  if (emptyRect(srcRect) || emptyRect(dstRect)) return;
  trace?.drawOps.push({ op: 'scale', src: srcRect, dst: dstRect, transfer });
  transferBits(port, source, srcRect, dstRect, transfer);
}

export function cornerBlit(port: Pixmap, source: Pixmap, srcRect: QdRect, dstX: number, dstY: number, transfer: Transfer, trace?: EngineTrace): void {
  const dstRect = offsetRect(srcRect, dstX - srcRect.left, dstY - srcRect.top);
  trace?.drawOps.push({ op: 'corner', src: srcRect, dst: dstRect, transfer });
  scaleBlit(port, source, srcRect, dstRect, transfer);
}
