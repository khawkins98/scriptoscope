import { PixelBuffer } from './pixelBuffer.js';
import type { WindowType, Rect } from './types.js';

/** Frame thicknesses, derived from the body part rect (part-0). */
export interface Frame {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export function frameFromBody(bodyRect: Rect, cicnW: number, cicnH: number): Frame {
  const [left, top, right, bottom] = bodyRect;
  return { left, top, right: cicnW - right, bottom: cicnH - bottom };
}

/**
 * The horizontal seam: the widest gap between substantial titlebar
 * widgets (parts other than part-0, ignoring ≤2px hairline dividers).
 * Left of the seam = left cap (close cluster); right = right cap
 * (zoom / windowshade cluster); the seam itself is the fill zone.
 */
export function titlebarSeam(parts: WindowType['parts'], cicnW: number): [number, number] {
  const spans: Array<[number, number]> = [];
  for (const [slug, part] of Object.entries(parts)) {
    if (slug === 'part-0') continue;
    const [l, , r] = part.rect;
    const x0 = Math.min(l, r);
    const x1 = Math.max(l, r);
    if (x1 - x0 <= 2) continue; // hairline divider, not a widget cluster
    spans.push([x0, x1]);
  }
  if (spans.length === 0) return [Math.round(cicnW / 3), Math.round((cicnW * 2) / 3)];
  spans.sort((a, b) => a[0] - b[0]);
  let best: [number, number] = [0, 0];
  let bestW = -1;
  let cursor = 0;
  for (const [l, r] of spans) {
    if (l - cursor > bestW) {
      bestW = l - cursor;
      best = [cursor, l];
    }
    cursor = Math.max(cursor, r);
  }
  if (cicnW - cursor > bestW) best = [cursor, cicnW];
  if (best[1] - best[0] <= 0) {
    const mid = Math.round(cicnW / 2);
    return [mid, mid + 1];
  }
  return best;
}

/**
 * Find the fill-source column for the titlebar pinstripe: within the
 * seam zone, the column with the most vertical light/dark transitions
 * across the titlebar band. That column is the vertical cross-section of
 * the racing stripe; CopyBits-stretched horizontally it reproduces the
 * horizontal pinstripe (the mechanism confirmed empirically).
 *
 * NOTE: this is an approximation of the kDEF recipe-walk's fill-column
 * selection (the still-open §13.1 question). It picks the right column
 * for the bundled corpus; resolving the exact recipe indexing needs the
 * 68k trace.
 */
export function findStripeColumn(cicn: PixelBuffer, x0: number, x1: number, top: number): number {
  let bestX = x0;
  let bestTrans = -1;
  for (let x = x0; x < x1; x++) {
    let trans = 0;
    let prev = -1;
    for (let y = 2; y < top - 2; y++) {
      const lum = cicn.getPixel(x, y)[0];
      const bit = lum < 160 ? 0 : 1;
      if (prev !== -1 && bit !== prev) trans++;
      prev = bit;
    }
    if (trans > bestTrans) {
      bestTrans = trans;
      bestX = x;
    }
  }
  return bestX;
}

export interface ComposedChrome {
  buffer: PixelBuffer;
  frame: Frame;
  /** Full footprint size (content rect + chrome margins), in cicn px. */
  fullWidth: number;
  fullHeight: number;
}

/**
 * Compose a window's chrome into a pixel buffer at NATIVE resolution.
 * The content rect (contentW × contentH) is left transparent so real DOM
 * content shows through when the buffer is blitted behind it.
 *
 * Model (faithful to the kDEF, per kdef-disassembly-findings §13.2):
 *   - widget caps: CopyBits the cicn's end regions 1:1 (no scale)
 *   - titlebar fill: CopyBits a 1px stripe column, stretched across the gap
 *   - side/bottom frame: CopyBits a 1px frame slice, stretched along the edge
 */
export function composeWindowChrome(
  cicn: PixelBuffer,
  windowType: WindowType,
  contentW: number,
  contentH: number,
): ComposedChrome {
  const body = windowType.parts['part-0'];
  if (!body) throw new Error('composeWindowChrome: windowType has no part-0 body rect');
  const frame = frameFromBody(body.rect, cicn.width, cicn.height);

  const fullW = frame.left + contentW + frame.right;
  const fullH = frame.top + contentH + frame.bottom;
  const out = PixelBuffer.alloc(fullW, fullH);

  // ── titlebar (top strip) ──
  const [seamL, seamR] = titlebarSeam(windowType.parts, cicn.width);
  const capLw = seamL;
  const capRw = cicn.width - seamR;
  // left cap (left frame + close cluster), 1:1
  out.copyBits(cicn, { x: 0, y: 0, w: capLw, h: frame.top }, { x: 0, y: 0, w: capLw, h: frame.top });
  // right cap (zoom / windowshade cluster + right frame), 1:1
  out.copyBits(
    cicn,
    { x: seamR, y: 0, w: capRw, h: frame.top },
    { x: fullW - capRw, y: 0, w: capRw, h: frame.top },
  );
  // fill: 1px stripe column stretched across the gap
  const stripeX = findStripeColumn(cicn, seamL, seamR, frame.top);
  const midX = capLw;
  const midW = fullW - capLw - capRw;
  if (midW > 0) {
    out.copyBits(cicn, { x: stripeX, y: 0, w: 1, h: frame.top }, { x: midX, y: 0, w: midW, h: frame.top });
  }

  // ── side edges (sample a 1px frame slice from the body row, stretch down) ──
  const bodyRow = frame.top;
  if (frame.left > 0) {
    out.copyBits(
      cicn,
      { x: 0, y: bodyRow, w: frame.left, h: 1 },
      { x: 0, y: frame.top, w: frame.left, h: contentH },
    );
  }
  if (frame.right > 0) {
    out.copyBits(
      cicn,
      { x: cicn.width - frame.right, y: bodyRow, w: frame.right, h: 1 },
      { x: fullW - frame.right, y: frame.top, w: frame.right, h: contentH },
    );
  }
  // ── bottom edge (sample the cicn's bottom rows, stretch across) ──
  if (frame.bottom > 0) {
    out.copyBits(
      cicn,
      { x: 0, y: cicn.height - frame.bottom, w: cicn.width, h: frame.bottom },
      { x: 0, y: frame.top + contentH, w: fullW, h: frame.bottom },
    );
  }

  return { buffer: out, frame, fullWidth: fullW, fullHeight: fullH };
}
