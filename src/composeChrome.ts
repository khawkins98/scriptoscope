import { PixelBuffer } from './pixelBuffer.js';
import type { WindowType, Rect, EdgeStep } from './types.js';

/** Extract the integer part code from a `part-N` slug (−1 if malformed). */
function partCode(slug: string): number {
  const m = /^part-(\d+)$/.exec(slug);
  return m ? Number(m[1]) : -1;
}

/**
 * Grow-region (fill) part codes — segments that stretch to absorb the
 * window's extra width. Per the period authoring doc the sides are
 * "the single row or column of pixels between the grow regions."
 *
 * Observed vocabulary across 7 Le + ErgoBox: the divider/stripe codes
 * 5, 6, 8 are the grow regions. Everything else is fixed and stamped
 * 1:1 — including edge pieces like p10 / p4 (which carry the corner
 * border and must NOT stretch, or the black corner smears into a
 * block). The K2 Scheme Reference would give the authoritative code
 * set; revisit if a scheme reveals another grow code.
 */
function isFillPart(code: number): boolean {
  return code === 5 || code === 6 || code === 8;
}

interface RecipeSegment {
  /** cicn source span along the edge axis. */
  x0: number;
  x1: number;
  code: number;
  fill: boolean;
}

/** Turn an edge recipe into ordered source segments along the axis. */
function recipeSegments(recipe: EdgeStep[], axisMax: number): RecipeSegment[] {
  const sorted = [...recipe].sort((a, b) => a.at - b.at);
  const segs: RecipeSegment[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const x0 = sorted[i]!.at;
    const x1 = i + 1 < sorted.length ? sorted[i + 1]!.at : axisMax;
    if (x1 <= x0) continue;
    const code = partCode(sorted[i]!.part);
    segs.push({ x0, x1, code, fill: isFillPart(code) });
  }
  return segs;
}

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

/**
 * Compose the top edge by walking the wnd# recipe — the literal kDEF
 * behavior (kdef-disassembly-findings §8, §9.5): each segment is a
 * `CopyBits` from its own cicn span. Fixed segments (corners, edges,
 * baked-in widget columns, the p10/p4 border pieces) copy 1:1, which
 * edge-anchors the widgets as the window grows. Grow segments (codes
 * 5/6/8 — the "single column between grow regions") stretch their own
 * pixels via sample-and-hold to absorb the window's extra width, split
 * proportionally to native grow width.
 *
 * No heuristics: the column(s) each grow segment stretches come straight
 * from the recipe, not a scan. The divider sandwich (p5/p6) widens
 * slightly but sits behind the centered title; the stripe (p8) is
 * column-invariant under horizontal stretch so it stays crisp.
 */
function composeTopEdgeFromRecipe(
  out: PixelBuffer,
  cicn: PixelBuffer,
  recipe: EdgeStep[],
  top: number,
  fullW: number,
): void {
  const segs = recipeSegments(recipe, cicn.width);
  const totalGrowNative = segs.reduce((s, g) => (g.fill ? s + (g.x1 - g.x0) : s), 0);
  const extra = Math.max(0, fullW - cicn.width);
  let growsLeft = segs.filter((g) => g.fill).length;
  let extraRem = extra;
  let outX = 0;
  for (const seg of segs) {
    const nativeW = seg.x1 - seg.x0;
    let outW = nativeW;
    if (seg.fill) {
      const share =
        growsLeft === 1
          ? extraRem
          : totalGrowNative > 0
            ? Math.round((extra * nativeW) / totalGrowNative)
            : 0;
      extraRem -= share;
      growsLeft--;
      outW = nativeW + share;
    }
    out.copyBits(
      cicn,
      { x: seg.x0, y: 0, w: nativeW, h: top },
      { x: outX, y: 0, w: outW, h: top },
    );
    outX += outW;
  }
}

/**
 * Fallback when a window type ships no edge recipe: stamp the cicn's end
 * regions as caps and stretch a single stripe column across the gap.
 */
function composeTopEdgeFromSeam(
  out: PixelBuffer,
  cicn: PixelBuffer,
  windowType: WindowType,
  top: number,
  fullW: number,
): void {
  const [seamL, seamR] = titlebarSeam(windowType.parts, cicn.width);
  const capLw = seamL;
  const capRw = cicn.width - seamR;
  out.copyBits(cicn, { x: 0, y: 0, w: capLw, h: top }, { x: 0, y: 0, w: capLw, h: top });
  out.copyBits(
    cicn,
    { x: seamR, y: 0, w: capRw, h: top },
    { x: fullW - capRw, y: 0, w: capRw, h: top },
  );
  const stripeX = findStripeColumn(cicn, seamL, seamR, top);
  const midW = fullW - capLw - capRw;
  if (midW > 0) {
    out.copyBits(cicn, { x: stripeX, y: 0, w: 1, h: top }, { x: capLw, y: 0, w: midW, h: top });
  }
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
  if (windowType.edges?.top && windowType.edges.top.length > 0) {
    composeTopEdgeFromRecipe(out, cicn, windowType.edges.top, frame.top, fullW);
  } else {
    composeTopEdgeFromSeam(out, cicn, windowType, frame.top, fullW);
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
