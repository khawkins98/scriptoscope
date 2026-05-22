import { PixelBuffer } from './pixelBuffer.js';
import type { WindowType, Rect, EdgeStep } from './types.js';

/** Extract the integer part code from a `part-N` slug (−1 if malformed). */
function partCode(slug: string): number {
  const m = /^part-(\d+)$/.exec(slug);
  return m ? Number(m[1]) : -1;
}

/**
 * Grow-region (fill / stretch) part codes — segments that absorb the window's
 * extra width by stretching. Per K2 (architecture-spec §3–4): **everything is
 * stretch EXCEPT null (0) and the named widgets (1–4)** — i.e. 5/6/8/10/11/
 * 15/17/18. This is now safe to use in full because `composeWindowChrome` runs
 * the kDEF's SECOND pass: it clean-fills the background under any rectList
 * widget rect (so a fill segment carrying baked widget art doesn't smear/tile
 * the widget) and then stamps the widget once at native size on top. Without
 * that pass, a fill segment over a widget (1138's utility close/zoom boxes,
 * the doc window's zoom cluster inside the `p8` side fill) tiled the widget art
 * into duplicates.
 */
function isFillPart(code: number): boolean {
  return code >= 5;
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
   * Top edge only: desired OUTPUT width of the title plate. The kDEF inserts
   * the title's width at the title seam — so the plate segment grows to this
   * width (pushing the decorations + side fill right), and the rest of the
   * window growth goes to the other grow columns. 0 = no title (plate stays
   * native, growth distributes across the grow columns as before).
   */
  plateWidth: number;
  /**
   * Native walk-axis spans `[start, end]` of the rectList WIDGETS on this edge
   * (close/zoom/collapse boxes). A fill segment overlapping one is rendered as
   * CLEAN background (the fill column, not its own art) so the baked widget
   * isn't tiled/smeared — the widget is stamped once on top in pass 2. Empty on
   * edges with no widgets.
   */
  widgetSpans: Array<[number, number]>;
  /**
   * Top edge only: cicn x of the title text-colour MARKER (the 1px rectList
   * rect Kaleidoscope reads to place/colour the title — authoring doc's
   * "two-pixel horizontal line which includes the text color pixel"). This is
   * the plate column. −1 when absent (then the plate falls back to the title
   * region's left edge).
   */
  titleMarkerX: number;
}

/** How a slice's source pixels were laid into the output. */
export type SliceMode = 'fixed' | 'stretch' | 'tile' | 'gradient' | 'clean' | 'plate' | 'stamp';

/** A rectangle in pixel space. */
export interface PixRectXY { x: number; y: number; w: number; h: number; }

/**
 * One placed slice: the cicn SOURCE region, how it was rendered, and the
 * OUTPUT rect(s) it produced (one for stretch/fixed/etc., many for tile).
 * `x0/x1/out0/out1` are the walk-axis spans kept for widget position-mapping;
 * the rest powers the diagnostic slice inspector.
 */
interface PlacedSegment {
  x0: number; x1: number; out0: number; out1: number; fill: boolean;
  code: number;
  mode: SliceMode;
  src: PixRectXY;
  rects: PixRectXY[];
}

/**
 * Compose ONE window edge by walking its wnd# recipe — the literal kDEF
 * frame-draw (kdef-disassembly-findings §8, §9.5; kdef-layout-recipes §1).
 *
 * The recipe partitions the cicn edge into segments at the `at` offsets.
 * Each segment is a `CopyBits` from its own cicn span. Behaviour is decided
 * by CONTENT (`isStretchable`), per Kaleidoscope's "Creating Color Schemes"
 * doc ("draws the corners, then stretches the single row or column of pixels
 * between the various grow regions"):
 *   - GROW columns (UNIFORM along the walk axis — the "single row/column
 *     between the grow regions") sample-and-hold one line to absorb
 *     `geo.extra`, split proportionally to native length.
 *   - FIXED segments (corners, baked widgets, AND any segment with cross-axis
 *     structure — button rows, decorations, stepped bevels) copy 1:1, keeping
 *     their native size and staying anchored to their end as the window grows.
 *     Structured art is drawn ONCE, never repeated or smeared.
 *   - GRADIENT (p18) grows by sample-and-hold across its output span so the
 *     ramp scales smoothly.
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
): { start: number; end: number; fillSrcX: number; placed: PlacedSegment[] } | null {
  // axisMax = the recipe's last boundary; the entry AT it is a zero-width
  // sentinel that closes the final real segment.
  const lastAt = recipe.reduce((m, s) => Math.max(m, s.at), 0);
  const raw = recipeSegments(recipe, lastAt);
  if (raw.length === 0) return null;

  // ── the title PLATE column (top edge only). The kDEF stretches "the middle
  // column of pixels which includes the text color pixel" to make room for the
  // title (authoring doc) — i.e. the plate column is a RECORDED MARKER, not a
  // column we score from pixels. `geo.titleMarkerX` carries that marker (the
  // 1px rectList rect that sits at the title-bar text position; see
  // composeWindowChrome). Clamp it into the title region (p5/p6); if no marker
  // was found, fall back to the title region's left edge. The plate is the
  // title-region SEGMENT containing that column; it grows to the title width.
  // (Replaced a stddev+saturation column scorer + a dark-outlier bezel patch —
  // both were guessing the marker the scheme data already records.) ──
  let fillSrcX = -1;
  let plateX0 = -1, plateX1 = -1;
  if (geo.horizontal) {
    const titleSegs = raw.filter((r) => r.code === 5 || r.code === 6);
    if (titleSegs.length) {
      const tX0 = Math.min(...titleSegs.map((s) => s.x0));
      const tX1 = Math.max(...titleSegs.map((s) => s.x1));
      const markerX = geo.titleMarkerX >= 0 ? Math.min(Math.max(geo.titleMarkerX, tX0), tX1 - 1) : tX0;
      const seg = titleSegs.find((s) => markerX >= s.x0 && markerX < s.x1) ?? titleSegs[0]!;
      fillSrcX = markerX; plateX0 = seg.x0; plateX1 = seg.x1;
    } else {
      // No title region: stretch the widest fill segment's centre (rare).
      const fills = raw.filter((r) => r.fill);
      if (fills.length) {
        const f = fills.reduce((a, b) => (b.x1 - b.x0 > a.x1 - a.x0 ? b : a));
        fillSrcX = Math.floor((f.x0 + f.x1) / 2); plateX0 = f.x0; plateX1 = f.x1;
      }
    }
  }
  const usePlate = geo.plateWidth > 0 && plateX0 >= 0;

  // Segments stand ALONE — no coalescing. The kDEF draws each recipe segment
  // independently. Coalescing adjacent segments into one wide block would
  // mis-classify a thin grow column glued to a static panel.
  const segs: RecipeSegment[] = raw.map((s) => ({
    ...s,
    isPlate: usePlate && s.x0 === plateX0 && s.x1 === plateX1,
  }));

  const overlapsWidget = (s: RecipeSegment) => geo.widgetSpans.some(([a, b]) => s.x0 < b && s.x1 > a);

  // STRETCHABILITY is decided by CONTENT, not part code or width. Kaleidoscope
  // "stretches the single row or column of pixels between the grow regions":
  // sampling ONE line of the segment and repeating it across the grown output
  // is LOSSLESS only when every line along the walk axis is identical. So a
  // segment is a grow column iff it is UNIFORM along the walk axis; anything
  // with cross-axis structure (a button row, a baked decoration, a stepped
  // bevel) is STATIC art and must be drawn once (fixed).
  //
  // This is what the part code only approximated: in the corpus `p1` happens
  // to be the (uniform) border and `p8` the (structured) decorative panel —
  // the inverse of their names — but a thin `p8` (1138's flat side row) and a
  // wide uniform `p1` (BeOS's 65px bottom border) both break the name/width
  // proxy. Uniformity gets every case right (probed across the corpus: grow
  // columns score 100%, static panels ≤50%).
  const STRETCH_UNIFORMITY = 0.9;
  const COLOR_TOL = 16;
  const isStretchable = (s: RecipeSegment): boolean => {
    const len = s.x1 - s.x0;
    if (len <= 1) return true; // a single line is trivially uniform
    const mid = s.x0 + Math.floor(len / 2); // the line we'd actually sample
    const eq = (p: Uint8ClampedArray | number[], q: Uint8ClampedArray | number[]) =>
      Math.abs(p[0]! - q[0]!) <= COLOR_TOL && Math.abs(p[1]! - q[1]!) <= COLOR_TOL &&
      Math.abs(p[2]! - q[2]!) <= COLOR_TOL && Math.abs(p[3]! - q[3]!) <= COLOR_TOL;
    let match = 0;
    if (geo.horizontal) {
      for (let x = s.x0; x < s.x1; x++) {
        let ok = true;
        for (let y = geo.crossSrc; y < geo.crossSrc + geo.crossLen; y++)
          if (!eq(cicn.getPixel(x, y), cicn.getPixel(mid, y))) { ok = false; break; }
        if (ok) match++;
      }
    } else {
      for (let y = s.x0; y < s.x1; y++) {
        let ok = true;
        for (let x = geo.crossSrc; x < geo.crossSrc + geo.crossLen; x++)
          if (!eq(cicn.getPixel(x, y), cicn.getPixel(x, mid))) { ok = false; break; }
        if (ok) match++;
      }
    }
    return match / len >= STRETCH_UNIFORMITY;
  };

  // Per-segment growth behaviour:
  //   plate   — the title grow column (grows to the title width)
  //   stretch — uniform along the walk axis: a grow column (absorbs growth)
  //   fixed   — corner / baked widget / structured static art: drawn once
  type GrowMode = 'plate' | 'stretch' | 'fixed';
  const growModeOf = (s: RecipeSegment): GrowMode => {
    if (s.isPlate) return 'plate';
    if (s.code === 0) return 'fixed';      // corner
    if (overlapsWidget(s)) return 'fixed'; // baked close/zoom/shade box
    // (Removed the p5/p6 "bracket = fixed" rule: it over-fit evolution's bezel
    // and regressed 1138's pinstripe bar. The real recipe-walk lives in the
    // WDEF -14330 we don't have, so the honest fallback is the same uniformity
    // test for ALL non-corner/non-widget segments, p5/p6 included.)
    // p18 "gradient" is NOT special-cased: a vertical ramp is uniform along the
    // walk axis (→ stretch, lossless) while a structured p18 (evolution's
    // metallic links + corner blobs, coded p18 but full of cross-axis detail)
    // is NOT uniform (→ fixed, drawn once). Special-casing p18 as a scalable
    // gradient smeared evolution's 59px corner and let the wide links hog the
    // growth from the 1px grow gaps. Uniformity handles both correctly.
    return isStretchable(s) ? 'stretch' : 'fixed';
  };
  const modes = segs.map(growModeOf);
  const isGrow = (m: GrowMode) => m !== 'fixed';

  // Coverage fallback: a recipe of only wide static segments + corners has no
  // thin grow column, so nothing would absorb the window's extra width and the
  // edge would stop short. Promote the THINNEST interior (non-corner) segment
  // to a grow column so the edge spans the full width; the wide caps stay
  // anchored to their ends.
  if (geo.extra > 0 && !modes.some(isGrow)) {
    let pick = -1, pickLen = Infinity;
    segs.forEach((s, i) => {
      const len = s.x1 - s.x0;
      if (s.code !== 0 && len < pickLen) { pickLen = len; pick = i; }
    });
    if (pick >= 0) modes[pick] = 'stretch';
  }

  // Growth budget: the plate first absorbs (titleWidth − its native), clamped
  // to the window's total extra; the REST distributes across the grow columns
  // proportional to native length. (Only uniform grow columns absorb growth —
  // structured art, gradients-coded-as-links, and corners stay native.)
  const plateIdx = modes.indexOf('plate');
  const plateNative = plateIdx >= 0 ? segs[plateIdx]!.x1 - segs[plateIdx]!.x0 : 0;
  const plateExtra = plateIdx >= 0
    ? Math.max(0, Math.min(geo.plateWidth - plateNative, Math.max(0, geo.extra)))
    : 0;
  const otherExtra = Math.max(0, geo.extra - plateExtra);
  let totalGrowNative = 0;
  segs.forEach((s, i) => { if (modes[i] === 'stretch') totalGrowNative += s.x1 - s.x0; });
  let growsLeft = modes.filter((m) => m === 'stretch').length;
  let extraRem = otherExtra;

  // Output walk-axis position starts where the recipe starts (segs are
  // sorted, so segs[0].x0 is the first cicn-axis offset = output offset).
  let outPos = segs[0]!.x0;
  // TITLE REGION output span: the plate's span when we grow one, else the
  // p5/p6 grow span, else the whole grow span. The title centres here.
  let plateStart = -1, plateEnd = -1;
  let titleStart = -1, titleEnd = -1;
  let growStart = -1, growEnd = -1;
  const placed: PlacedSegment[] = [];
  // walk-axis span → full src/output rect (axis-agnostic).
  const srcRect = (a: number, len: number): PixRectXY =>
    geo.horizontal ? { x: a, y: geo.crossSrc, w: len, h: geo.crossLen } : { x: geo.crossSrc, y: a, w: geo.crossLen, h: len };
  const outRect = (a: number, len: number): PixRectXY =>
    geo.horizontal ? { x: a, y: geo.crossDst, w: len, h: geo.crossLen } : { x: geo.crossDst, y: a, w: geo.crossLen, h: len };

  for (let i = 0; i < segs.length; i++) {
    const seg = segs[i]!;
    const gm = modes[i]!;
    const nativeLen = seg.x1 - seg.x0;
    let outLen = nativeLen;
    let mode: SliceMode;
    let src: PixRectXY;
    const rects: PixRectXY[] = [];

    if (gm === 'plate') {
      // The title plate: grows to the title width and renders as the single
      // clean plate column stretched (sample-and-hold) — a uniform plate the
      // title sits on, decorations pushed right.
      outLen = nativeLen + plateExtra;
      plateStart = outPos; plateEnd = outPos + outLen;
      out.copyBits(cicn, { x: fillSrcX, y: geo.crossSrc, w: 1, h: geo.crossLen }, { x: outPos, y: geo.crossDst, w: outLen, h: geo.crossLen });
      mode = 'plate'; src = srcRect(fillSrcX, 1); rects.push(outRect(outPos, outLen));
      placed.push({ x0: seg.x0, x1: seg.x1, out0: outPos, out1: outPos + outLen, fill: true, code: seg.code, mode, src, rects });
      outPos += outLen;
      continue;
    }

    if (gm === 'stretch') {
      // last grow segment soaks up the rounding remainder so edges meet exactly
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
      if (overlapsWidget(seg) && fillSrcX >= 0 && geo.horizontal) {
        // A thin grow column over a rectList widget: render clean background
        // (the plate column), not the segment's art — the widget is stamped
        // once on top in pass 2. (Rare: widgets are wide → usually fixed.)
        out.copyBits(cicn, { x: fillSrcX, y: geo.crossSrc, w: 1, h: geo.crossLen }, { x: outPos, y: geo.crossDst, w: outLen, h: geo.crossLen });
        mode = 'clean'; src = srcRect(fillSrcX, 1); rects.push(outRect(outPos, outLen));
      } else {
        // GROW column: sample one mid-line of the thin span and sample-and-hold
        // it across the grown output — the kDEF's "stretch the single row or
        // column of pixels between the grow regions."
        const mid = seg.x0 + Math.floor(nativeLen / 2);
        if (geo.horizontal) {
          out.copyBits(cicn, { x: mid, y: geo.crossSrc, w: 1, h: geo.crossLen }, { x: outPos, y: geo.crossDst, w: outLen, h: geo.crossLen });
        } else {
          out.copyBits(cicn, { x: geo.crossSrc, y: mid, w: geo.crossLen, h: 1 }, { x: geo.crossDst, y: outPos, w: geo.crossLen, h: outLen });
        }
        mode = 'stretch'; src = srcRect(mid, 1); rects.push(outRect(outPos, outLen));
      }
      placed.push({ x0: seg.x0, x1: seg.x1, out0: outPos, out1: outPos + outLen, fill: true, code: seg.code, mode, src, rects });
      outPos += outLen;
      continue;
    }

    // FIXED: a corner or wide static art — copy 1:1, anchored to its position.
    if (geo.horizontal) {
      out.copyBits(cicn, { x: seg.x0, y: geo.crossSrc, w: nativeLen, h: geo.crossLen }, { x: outPos, y: geo.crossDst, w: outLen, h: geo.crossLen });
    } else {
      out.copyBits(cicn, { x: geo.crossSrc, y: seg.x0, w: geo.crossLen, h: nativeLen }, { x: geo.crossDst, y: outPos, w: geo.crossLen, h: outLen });
    }
    mode = 'fixed'; src = srcRect(seg.x0, nativeLen); rects.push(outRect(outPos, outLen));
    placed.push({ x0: seg.x0, x1: seg.x1, out0: outPos, out1: outPos + outLen, fill: false, code: seg.code, mode, src, rects });
    outPos += outLen;
  }

  // FAR-EDGE CAP (top/bottom only): some recipes stop short of the cicn's right
  // edge — the recipe extent (lastAt) is less than the cicn width, leaving the
  // far corner undescribed (BeOS's top recipe ends at x75 of a 92px cicn → a
  // 17px gap at the top-right). The body stretch makes outPos land exactly at
  // (fullWidth − capLen), so stamp the leftover cicn columns [lastAt, width]
  // there as a fixed corner cap. (Sides don't need this — their far corners
  // belong to the top/bottom edges.)
  if (geo.horizontal) {
    const capLen = cicn.width - lastAt;
    // Only when the cap region has real (opaque) art. A purely transparent cap
    // means the cicn just has trailing padding and `frame.right` is overstated
    // (BeOS) — stamping nothing would only mask the gap; leave it so the audit
    // keeps flagging the frame-geometry issue honestly.
    let capOpaque = false;
    for (let cx = lastAt; cx < cicn.width && !capOpaque; cx++)
      for (let cy = geo.crossSrc; cy < geo.crossSrc + geo.crossLen; cy++)
        if (cicn.getPixel(cx, cy)[3] > 16) { capOpaque = true; break; }
    if (capLen > 0 && capOpaque) {
      out.copyBits(cicn, { x: lastAt, y: geo.crossSrc, w: capLen, h: geo.crossLen }, { x: outPos, y: geo.crossDst, w: capLen, h: geo.crossLen });
      placed.push({ x0: lastAt, x1: cicn.width, out0: outPos, out1: outPos + capLen, fill: false, code: 0, mode: 'fixed', src: srcRect(lastAt, capLen), rects: [outRect(outPos, capLen)] });
      outPos += capLen;
    }
  }

  // Prefer the grown plate span, then the p5/p6 title region, then the fill.
  if (plateStart >= 0) return { start: plateStart, end: plateEnd, fillSrcX, placed };
  if (titleStart >= 0) return { start: titleStart, end: titleEnd, fillSrcX, placed };
  return growStart >= 0 ? { start: growStart, end: growEnd, fillSrcX, placed } : null;
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
  /**
   * Slice-by-slice placement map for the diagnostic inspector: every recipe
   * segment + stamped widget, with its cicn SOURCE rect, render mode, part
   * code/role, and the OUTPUT rect(s) it produced (one per tile repeat).
   * Empty for the seam-fallback / no-recipe path.
   */
  placement: PlacementSlice[];
}

/** One slice in the diagnostic placement map. */
export interface PlacementSlice {
  edge: 'top' | 'bottom' | 'left' | 'right' | 'widget';
  code: number;
  role: string;
  mode: SliceMode;
  src: PixRectXY;
  rects: PixRectXY[];
}

/** Human label for a part code, for the diagnostic. */
export function partRole(code: number): string {
  switch (code) {
    case 0: return 'corner/anchor';
    case 1: return 'border/widget';
    case 2: return 'close box';
    case 3: return 'zoom box';
    case 4: return 'shade/widget';
    case 5: case 6: return 'title region';
    case 8: return 'side fill';
    case 18: return 'gradient';
    default: return `fill p${code}`;
  }
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

  // rectList rects in the top band. WIDE ones (close/zoom/collapse boxes) are
  // widgets: the recipe walk clean-fills under them and pass 2 stamps each once.
  // A NARROW (≤2px) rect is NOT a widget — it's the title text-colour MARKER
  // (the plate column); record it and DON'T stamp it. part-0 is the body.
  const topWidgets: Array<{ l: number; t: number; r: number; b: number }> = [];
  let titleMarkerX = -1;
  for (const [slug, part] of Object.entries(windowType.parts)) {
    if (slug === 'part-0' || !part.rect) continue;
    const [l, t, r, b] = part.rect;
    if (!(t < frame.top && r > l && b > t)) continue;
    if (r - l <= 2) { if (titleMarkerX < 0) titleMarkerX = l; continue; }
    topWidgets.push({ l, t, r, b });
  }
  const topWidgetSpans = topWidgets.map((w) => [w.l, w.r] as [number, number]);

  // ── top edge: walk X across the full width, sampling cicn rows [0, top] ──
  let topFill: { start: number; end: number; fillSrcX: number; placed: PlacedSegment[] } | null = null;
  if (edges?.top?.length) {
    topFill = composeEdgeFromRecipe(out, cicn, edges.top, {
      horizontal: true, crossSrc: 0, crossLen: frame.top, crossDst: 0,
      extra: contentW - cicnBodyW, plateWidth: opts.titlePlateWidth ?? 0,
      widgetSpans: topWidgetSpans, titleMarkerX,
    });
  } else {
    composeTopEdgeFromSeam(out, cicn, windowType, frame.top, fullW);
  }

  // (bottom edge is drawn LAST — see below — so its corners overdraw any
  // overshoot from the left/right edges into the bottom-corner band.)
  let botFill: ReturnType<typeof composeEdgeFromRecipe> = null;

  // ── left edge: walk Y, sampling cicn cols [0, left] ──
  let leftFill: ReturnType<typeof composeEdgeFromRecipe> = null;
  if (frame.left > 0 && edges?.left?.length) {
    leftFill = composeEdgeFromRecipe(out, cicn, edges.left, {
      horizontal: false, crossSrc: 0, crossLen: frame.left, crossDst: 0,
      extra: contentH - cicnBodyH, plateWidth: 0, widgetSpans: [], titleMarkerX: -1,
    });
  } else if (frame.left > 0) {
    out.copyBits(cicn, { x: 0, y: bt, w: frame.left, h: 1 },
      { x: 0, y: frame.top, w: frame.left, h: contentH });
  }

  // ── right edge: walk Y, sampling cicn cols [W-right, W] ──
  let rightFill: ReturnType<typeof composeEdgeFromRecipe> = null;
  if (frame.right > 0 && edges?.right?.length) {
    rightFill = composeEdgeFromRecipe(out, cicn, edges.right, {
      horizontal: false, crossSrc: cicn.width - frame.right, crossLen: frame.right,
      crossDst: fullW - frame.right, extra: contentH - cicnBodyH, plateWidth: 0, widgetSpans: [], titleMarkerX: -1,
    });
  } else if (frame.right > 0) {
    out.copyBits(cicn, { x: cicn.width - frame.right, y: bt, w: frame.right, h: 1 },
      { x: fullW - frame.right, y: frame.top, w: frame.right, h: contentH });
  }

  // ── bottom edge: walk X, sampling cicn rows [H-bottom, H]. Drawn AFTER the
  // side edges so the bottom-left/right CORNERS (the recipe's end segments)
  // overdraw the side fill that the left/right edges stretch into the bottom
  // band — otherwise the bottom corners show plain side-fill stripes. ──
  if (frame.bottom > 0 && edges?.bottom?.length) {
    botFill = composeEdgeFromRecipe(out, cicn, edges.bottom, {
      horizontal: true, crossSrc: cicn.height - frame.bottom, crossLen: frame.bottom,
      crossDst: fullH - frame.bottom, extra: contentW - cicnBodyW, plateWidth: 0,
      widgetSpans: [], titleMarkerX: -1,
    });
  } else if (frame.bottom > 0) {
    out.copyBits(cicn, { x: 0, y: cicn.height - frame.bottom, w: cicn.width, h: frame.bottom },
      { x: 0, y: fullH - frame.bottom, w: fullW, h: frame.bottom });
  }

  // ── PASS 2: stamp the rectList widgets at native size ──
  // The kDEF draws the frame background (pass 1, above) then stamps the
  // close/zoom/collapse boxes on top. We stamp each top widget whose
  // background was clean-filled (it overlapped a fill segment) at its
  // growth-anchored output position — found by mapping its native x through
  // the recorded segment placement. Widgets sitting only in fixed/corner
  // segments are already drawn 1:1 by pass 1, so we skip them.
  const widgetSlices: PlacementSlice[] = [];
  if (topFill?.placed?.length) {
    const placed = topFill.placed;
    const mapX = (nx: number): number => {
      for (const p of placed) {
        if (nx >= p.x0 && nx <= p.x1) {
          const span = p.x1 - p.x0;
          return span > 0 ? p.out0 + ((nx - p.x0) * (p.out1 - p.out0)) / span : p.out0;
        }
      }
      return nx; // outside the recipe (before first / after last) → 1:1
    };
    for (const w of topWidgets) {
      const overFill = placed.some((p) => p.fill && w.l < p.x1 && w.r > p.x0);
      if (!overFill) continue; // drawn by pass 1's fixed copy
      const ww = w.r - w.l;
      const hh = w.b - w.t;
      const outX = Math.round(mapX(w.l));
      out.copyBits(cicn, { x: w.l, y: w.t, w: ww, h: hh }, { x: outX, y: w.t, w: ww, h: hh });
      widgetSlices.push({ edge: 'widget', code: -1, role: 'stamped widget', mode: 'stamp', src: { x: w.l, y: w.t, w: ww, h: hh }, rects: [{ x: outX, y: w.t, w: ww, h: hh }] });
    }
  }

  // ── aggregate the slice placement map (for the diagnostic inspector) ──
  const placement: PlacementSlice[] = [];
  const collect = (edge: PlacementSlice['edge'], r: { placed: PlacedSegment[] } | null) => {
    if (!r) return;
    for (const p of r.placed) placement.push({ edge, code: p.code, role: partRole(p.code), mode: p.mode, src: p.src, rects: p.rects });
  };
  collect('top', topFill);
  collect('bottom', botFill);
  collect('left', leftFill);
  collect('right', rightFill);
  placement.push(...widgetSlices);

  const titleRegion = topFill && topFill.end > topFill.start
    ? { x: topFill.start, w: topFill.end - topFill.start }
    : { x: 0, w: fullW };
  const titleFillSrcX = topFill ? topFill.fillSrcX : -1;
  return { buffer: out, frame, fullWidth: fullW, fullHeight: fullH, titleRegion, titleFillSrcX, placement };
}
