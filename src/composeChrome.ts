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
  /** The title PLATE segment: grows to the title width and renders as the
   *  clean plate column stretched (not tiled). Set on the top edge only. */
  isPlate?: boolean;
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
 * Geometry for walking ONE window edge. The kDEF draws each of the four
 * frame edges (top/bottom/left/right) by the same algorithm — this
 * struct is the per-edge parameterization.
 *
 * The "walk axis" is the long axis of the edge (X for top/bottom, Y for
 * left/right). The "cross axis" is the frame thickness direction.
 */
interface EdgeGeometry {
  /** true = walk along X (top/bottom); false = walk along Y (left/right). */
  horizontal: boolean;
  /** cicn cross-axis origin: which rows (top/bottom) or cols (left/right) of the cicn this edge samples. */
  crossSrc: number;
  /** frame thickness on this edge (rows for top/bottom, cols for left/right). */
  crossLen: number;
  /** output cross-axis position to draw the edge strip at. */
  crossDst: number;
  /**
   * Extra output pixels the grow segments must absorb along the walk
   * axis = (output body span) − (cicn body span). For top/bottom this is
   * contentW − cicnBodyW; for left/right, contentH − cicnBodyH.
   */
  extra: number;
  /**
   * Top edge ONLY: TILE the grow motif (repeat the native span 1:1) so a
   * multi-px titlebar pinstripe/box pattern reproduces correctly. The
   * SIDES and BOTTOM instead stretch the single row/column "between the
   * grow regions" (§8.1) — sample-and-hold one mid-line across the whole
   * grow span. Tiling a multi-px side fill (e.g. BeOS's 5px slice) repeats
   * its notch into railroad ticks; stretching one line gives a smooth border.
   */
  tileMotif: boolean;
  /**
   * Top edge only: desired OUTPUT width of the title plate. The kDEF inserts
   * the title's width at the title seam — so the plate segment grows to this
   * width (pushing the decorations + side fill right), and the rest of the
   * window growth goes to the other fill segments. 0 = no title (plate stays
   * native, growth distributes evenly as before).
   */
  plateWidth: number;
}

/**
 * Compose ONE window edge by walking its wnd# recipe — the literal kDEF
 * frame-draw (kdef-disassembly-findings §8, §9.5; kdef-layout-recipes §1).
 *
 * The recipe partitions the cicn edge into segments at the `at` offsets.
 * Each segment is a `CopyBits` from its own cicn span:
 *   - FIXED segments (corners, edges, baked-in widget columns, border
 *     pieces — any part code NOT in the grow set) copy 1:1, so they keep
 *     their native size and stay anchored to their end of the window as
 *     it grows.
 *   - GROW segments (the "single row/column between grow regions" — part
 *     codes 5/6/8) stretch their own pixels via sample-and-hold to
 *     absorb `geo.extra`, split proportionally to native length.
 *
 * Output position starts at the recipe's first `at` (positions before
 * the body map 1:1, so output-pos == cicn-pos there) and accumulates as
 * each segment is placed — exactly the kDEF's "insert N pixels at the
 * grow regions" behavior. Masking is automatic: the cicn PNGs carry the
 * Kaleidoscope mask as alpha, and copyBits preserves alpha, so
 * non-rectangular/bulbous frames clip themselves.
 *
 * PORTING NOTE: this is axis-agnostic. `horizontal` swaps which rect
 * dimension is the walk axis vs. the fixed cross-axis. The same routine
 * handles all four edges; only `EdgeGeometry` differs per edge.
 */
function composeEdgeFromRecipe(
  out: PixelBuffer,
  cicn: PixelBuffer,
  recipe: EdgeStep[],
  geo: EdgeGeometry,
): { start: number; end: number; fillSrcX: number } | null {
  // axisMax = the recipe's last boundary; the entry AT it is a zero-width
  // sentinel that closes the final real segment.
  const lastAt = recipe.reduce((m, s) => Math.max(m, s.at), 0);
  const raw = recipeSegments(recipe, lastAt);
  if (raw.length === 0) return null;

  // ── pick the title PLATE (top edge only): the clean fill column the title
  // text is stretched over. The title region (code 5/6) holds the plate AND
  // decorations — 1138's central pyramid, 1990's coloured LED dots — so a
  // fixed slice number lands on the decoration. Score each title-region
  // segment's centre column by (stddev of luminance + mean saturation): the
  // plate is the CLEAN column (low variance, low saturation), decorations are
  // structured/colourful. The winning SEGMENT becomes the plate, which grows
  // to the title width; everything after it shifts right. Fall back to the
  // side fill (code 8) when a scheme ships no title region. ──
  let fillSrcX = -1;
  let plateX0 = -1, plateX1 = -1;
  if (geo.horizontal) {
    const colNoise = (xc: number): number => {
      const y0 = geo.crossSrc + 2;
      const y1 = geo.crossSrc + Math.max(3, geo.crossLen - 2);
      let n = 0, sumL = 0, sumL2 = 0, sumSat = 0;
      for (let y = y0; y < y1; y++) {
        const [r, g, b, a] = cicn.getPixel(xc, y);
        if (a < 200) continue;
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        sumL += lum; sumL2 += lum * lum;
        sumSat += Math.max(r, g, b) - Math.min(r, g, b);
        n++;
      }
      if (n === 0) return Infinity;
      const variance = sumL2 / n - (sumL / n) ** 2;
      return Math.sqrt(Math.max(0, variance)) + sumSat / n;
    };
    const titleSegs = raw.filter((r) => r.code === 5 || r.code === 6);
    const cands = titleSegs.length ? titleSegs : raw.filter((r) => r.fill);
    let best = Infinity;
    for (const r of cands) {
      const xc = Math.floor((r.x0 + r.x1) / 2);
      const score = colNoise(xc);
      if (score < best) { best = score; fillSrcX = xc; plateX0 = r.x0; plateX1 = r.x1; }
    }
  }
  const usePlate = geo.plateWidth > 0 && plateX0 >= 0;

  // Coalesce adjacent grow segments into one block. The recipe fragments
  // the fill zone into several 1–3px sub-segments (part 5/6/8), but it is
  // one continuous repeating-background region (the titlebar pinstripe /
  // motif). Keeping it whole lets us TILE its motif as a unit rather than
  // stretch each sub-segment, which is what gives correct repetition. The
  // plate segment is kept STANDALONE (never merged) so it can grow alone.
  const segs: RecipeSegment[] = [];
  for (const s of raw) {
    const isPlate = usePlate && s.x0 === plateX0 && s.x1 === plateX1;
    const prev = segs[segs.length - 1];
    if (prev && prev.fill && s.fill && prev.x1 === s.x0 && !prev.isPlate && !isPlate) prev.x1 = s.x1;
    else segs.push({ ...s, isPlate });
  }

  // No-fill fallback: some edges (e.g. BeOS's bottom `0 1 18 1`) ship no
  // grow code (5/6/8) at all, so nothing would stretch and the edge stops
  // at its native length — leaving the rest of a wider window uncovered.
  // Designate the widest interior, non-corner (code≠0) segment as the
  // stretch zone so the edge spans the full window; the trailing caps
  // (e.g. a bottom-right resize box) stay anchored to their end.
  if (geo.extra > 0 && !segs.some((s) => s.fill)) {
    let widest = -1;
    let widestLen = 0;
    for (let i = 0; i < segs.length; i++) {
      const s = segs[i]!;
      if (s.code === 0) continue; // corners stay fixed
      const len = s.x1 - s.x0;
      if (len > widestLen) { widestLen = len; widest = i; }
    }
    if (widest >= 0) segs[widest]!.fill = true;
  }

  // Growth budget: the plate first absorbs (titleWidth − its native), clamped
  // to the window's total extra; the REST distributes across the other fill
  // segments. (When there's no plate this is the plain even distribution.)
  const plateSeg = segs.find((s) => s.isPlate);
  const plateNative = plateSeg ? plateSeg.x1 - plateSeg.x0 : 0;
  const plateExtra = plateSeg ? Math.max(0, Math.min(geo.plateWidth - plateNative, Math.max(0, geo.extra))) : 0;
  const otherExtra = Math.max(0, geo.extra - plateExtra);
  const totalGrowNative = segs.reduce((s, g) => (g.fill && !g.isPlate ? s + (g.x1 - g.x0) : s), 0);
  let growsLeft = segs.filter((g) => g.fill && !g.isPlate).length;
  let extraRem = otherExtra;

  // Output walk-axis position starts where the recipe starts (segs are
  // sorted, so segs[0].x0 is the first cicn-axis offset = output offset).
  let outPos = segs[0]!.x0;
  // TITLE REGION output span: the plate's span when we grow one, else the
  // p5/p6 fill span, else the whole fill span. The title centres here.
  let plateStart = -1, plateEnd = -1;
  let titleStart = -1, titleEnd = -1;
  let growStart = -1, growEnd = -1;

  for (const seg of segs) {
    const nativeLen = seg.x1 - seg.x0;
    let outLen = nativeLen;
    if (seg.isPlate) {
      // The title plate: grows to the title width and renders as the single
      // clean plate column stretched (sample-and-hold) — a uniform plate the
      // title sits on, decorations pushed right.
      outLen = nativeLen + plateExtra;
      plateStart = outPos; plateEnd = outPos + outLen;
      out.copyBits(cicn, { x: fillSrcX, y: geo.crossSrc, w: 1, h: geo.crossLen }, { x: outPos, y: geo.crossDst, w: outLen, h: geo.crossLen });
      outPos += outLen;
      continue;
    }
    if (seg.fill) {
      // last grow segment soaks up the rounding remainder so edges tile exactly
      const share =
        growsLeft === 1
          ? extraRem
          : totalGrowNative > 0
            ? Math.round((otherExtra * nativeLen) / totalGrowNative)
            : 0;
      extraRem -= share;
      growsLeft--;
      outLen = nativeLen + share;
      if (growStart < 0) growStart = outPos;
      growEnd = outPos + outLen;
      if (seg.code === 5 || seg.code === 6) {
        if (titleStart < 0) titleStart = outPos;
        titleEnd = outPos + outLen;
      }
      if (geo.tileMotif) {
        // TOP edge: TILE the motif — repeat the native span 1:1 across the
        // grown output (NOT sample-and-hold, which smears a multi-px
        // pinstripe/box pattern into bands). For a 1px fill column this is
        // identical to a stretch, so plain pinstripe themes are unaffected.
        for (let off = 0; off < outLen; off += nativeLen) {
          const w = Math.min(nativeLen, outLen - off);
          out.copyBits(cicn, { x: seg.x0, y: geo.crossSrc, w, h: geo.crossLen }, { x: outPos + off, y: geo.crossDst, w, h: geo.crossLen });
        }
      } else {
        // SIDES / BOTTOM: stretch the single row/column "between the grow
        // regions" (§8.1). Sample one mid-line of the grow span and
        // sample-and-hold it across the whole grown output — a uniform
        // border, never the repeated notch that tiling a multi-px slice
        // (e.g. BeOS's 5px side fill) produces.
        const mid = seg.x0 + Math.floor(nativeLen / 2);
        if (geo.horizontal) {
          out.copyBits(cicn, { x: mid, y: geo.crossSrc, w: 1, h: geo.crossLen }, { x: outPos, y: geo.crossDst, w: outLen, h: geo.crossLen });
        } else {
          out.copyBits(cicn, { x: geo.crossSrc, y: mid, w: geo.crossLen, h: 1 }, { x: geo.crossDst, y: outPos, w: geo.crossLen, h: outLen });
        }
      }
      outPos += outLen;
      continue;
    }
    // FIXED segment: copy 1:1.
    if (geo.horizontal) {
      out.copyBits(cicn, { x: seg.x0, y: geo.crossSrc, w: nativeLen, h: geo.crossLen }, { x: outPos, y: geo.crossDst, w: outLen, h: geo.crossLen });
    } else {
      out.copyBits(cicn, { x: geo.crossSrc, y: seg.x0, w: geo.crossLen, h: nativeLen }, { x: geo.crossDst, y: outPos, w: geo.crossLen, h: outLen });
    }
    outPos += outLen;
  }
  // Prefer the grown plate span, then the p5/p6 title region, then the fill.
  if (plateStart >= 0) return { start: plateStart, end: plateEnd, fillSrcX };
  if (titleStart >= 0) return { start: titleStart, end: titleEnd, fillSrcX };
  return growStart >= 0 ? { start: growStart, end: growEnd, fillSrcX } : null;
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
  /**
   * Output X-span of the top edge's grow/fill zone — the region the kDEF
   * "stretches to make room for the title". The title is centered HERE (not
   * on the full width), so it lands on the repeating fill area and is
   * offset correctly past the baked widgets, per-theme. Full-width fallback
   * when the top edge has no grow zone (e.g. acid).
   */
  titleRegion: { x: number; w: number };
  /**
   * cicn SOURCE column of the titlebar's fill pattern (the side-fill p8, else
   * the widest grow segment) — the column to re-tile behind the title text so
   * it sits on the bar's own repeating pattern, not a flat erase box. −1 when
   * the top edge has no fill (no recipe / no grow zone).
   */
  titleFillSrcX: number;
}

/**
 * Compose a window's chrome into a pixel buffer at NATIVE resolution.
 * The content rect (contentW × contentH) is left transparent so real DOM
 * content shows through when the buffer is blitted behind it.
 *
 * Faithful to the kDEF window draw (kdef-layout-recipes §1): all FOUR
 * frame edges are drawn by walking their wnd# recipe via the one
 * `composeEdgeFromRecipe` routine. Top/bottom span the full width
 * (corners included as their fixed end-segments); left/right fill the
 * vertical span between. Where a window type ships no edge recipe, fall
 * back to a seam-based top + 1px side/bottom stretch.
 *
 * Geometry: the cicn is the minimum-window template. Its body inset
 * (part-0) gives the per-edge frame thickness; that thickness is the
 * cross-axis source/extent for each edge (it captures even thick bulbous
 * frames, e.g. evolution's 53px top). The walk axis maps the cicn body
 * span to the larger content span, stretching grow segments to fill.
 */
export function composeWindowChrome(
  cicn: PixelBuffer,
  windowType: WindowType,
  contentW: number,
  contentH: number,
  opts: { titlePlateWidth?: number } = {},
): ComposedChrome {
  const body = windowType.parts['part-0'];
  if (!body) throw new Error('composeWindowChrome: windowType has no part-0 body rect');
  const frame = frameFromBody(body.rect, cicn.width, cicn.height);
  const [bl, bt, br, bb] = body.rect; // cicn body rect [left, top, right, bottom]
  const cicnBodyW = br - bl; // cicn body width (the stretchable horizontal span)
  const cicnBodyH = bb - bt; // cicn body height (stretchable vertical span)

  const fullW = frame.left + contentW + frame.right;
  const fullH = frame.top + contentH + frame.bottom;
  const out = PixelBuffer.alloc(fullW, fullH);

  const edges = windowType.edges;

  // ── top edge: walk X across the full width, sampling cicn rows [0, top] ──
  let topFill: { start: number; end: number; fillSrcX: number } | null = null;
  if (edges?.top?.length) {
    topFill = composeEdgeFromRecipe(out, cicn, edges.top, {
      horizontal: true, crossSrc: 0, crossLen: frame.top, crossDst: 0,
      extra: contentW - cicnBodyW, tileMotif: true, plateWidth: opts.titlePlateWidth ?? 0,
    });
  } else {
    composeTopEdgeFromSeam(out, cicn, windowType, frame.top, fullW);
  }

  // ── bottom edge: walk X, sampling cicn rows [H-bottom, H] ──
  if (frame.bottom > 0 && edges?.bottom?.length) {
    composeEdgeFromRecipe(out, cicn, edges.bottom, {
      horizontal: true, crossSrc: cicn.height - frame.bottom, crossLen: frame.bottom,
      crossDst: fullH - frame.bottom, extra: contentW - cicnBodyW, tileMotif: false, plateWidth: 0,
    });
  } else if (frame.bottom > 0) {
    out.copyBits(cicn, { x: 0, y: cicn.height - frame.bottom, w: cicn.width, h: frame.bottom },
      { x: 0, y: fullH - frame.bottom, w: fullW, h: frame.bottom });
  }

  // ── left edge: walk Y, sampling cicn cols [0, left] ──
  if (frame.left > 0 && edges?.left?.length) {
    composeEdgeFromRecipe(out, cicn, edges.left, {
      horizontal: false, crossSrc: 0, crossLen: frame.left, crossDst: 0,
      extra: contentH - cicnBodyH, tileMotif: false, plateWidth: 0,
    });
  } else if (frame.left > 0) {
    out.copyBits(cicn, { x: 0, y: bt, w: frame.left, h: 1 },
      { x: 0, y: frame.top, w: frame.left, h: contentH });
  }

  // ── right edge: walk Y, sampling cicn cols [W-right, W] ──
  if (frame.right > 0 && edges?.right?.length) {
    composeEdgeFromRecipe(out, cicn, edges.right, {
      horizontal: false, crossSrc: cicn.width - frame.right, crossLen: frame.right,
      crossDst: fullW - frame.right, extra: contentH - cicnBodyH, tileMotif: false, plateWidth: 0,
    });
  } else if (frame.right > 0) {
    out.copyBits(cicn, { x: cicn.width - frame.right, y: bt, w: frame.right, h: 1 },
      { x: fullW - frame.right, y: frame.top, w: frame.right, h: contentH });
  }

  const titleRegion = topFill && topFill.end > topFill.start
    ? { x: topFill.start, w: topFill.end - topFill.start }
    : { x: 0, w: fullW };
  const titleFillSrcX = topFill ? topFill.fillSrcX : -1;
  return { buffer: out, frame, fullWidth: fullW, fullHeight: fullH, titleRegion, titleFillSrcX };
}
