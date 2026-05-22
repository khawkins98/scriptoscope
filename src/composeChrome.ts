import { PixelBuffer } from './pixelBuffer.js';
import type { WindowType, WindowCinf, Rect, EdgeStep } from './types.js';

// ───────────────────────────────────────────────────────────────────────────
// Window-chrome compositor — the Kaleidoscope 2.3.1 kDEF window-frame model.
//
// Built to docs/tracking/compositor-spec.md (THE canonical model), which is
// itself built from the 2.3.1 kDEF decode (docs/tracking/kdef231-recipe-walk.md).
// The pipeline mirrors the kDEF exactly:
//
//   classify (part-code jump table §"Part-code classification")
//     → distribute slack EVENLY across stretch cells, split symmetrically
//       about the title  (§"Draw + distribution" / kdef §0x5178 ×2)
//     → place each cell's SRC band → DST band  (kdef §0x5356)
//     → blit: code 18 = ONE scaled CopyBits; code 12 = whole-multiple tile;
//       everything else = stretch-or-tile per cinf.tileSides  (kdef §0xfeae)
//
//   WIDGET CARVING (the key fix): close/zoom/shade widgets are BAKED into the
//   cicn inside stretch cells (e.g. 1138's close box lives in the code-0 left
//   cell, its zoom/shade in the code-8 pinstripe). We must NOT tile/scale that
//   baked art. Instead we carve each rect-list widget rect out of the stretch
//   cell — fill the segments AROUND it (stretch/tile per cinf), then stamp the
//   widget ONCE from its rect-list rect, anchored (left widgets keep their x;
//   right widgets ride the right edge as the fill before them grows).
//
//   TITLE TEXT is drawn separately in renderWindow.ts (centred on the content
//   centre, in the cinf textPixel / header text colour) — not here.
// ───────────────────────────────────────────────────────────────────────────

/** Extract the integer part code from a `part-N` slug (−1 if malformed). */
function partCode(slug: string): number {
  const m = /^part-(-?\d+)$/.exec(slug);
  return m ? Number(m[1]) : -1;
}

/** How a cell's part code is classified per the spec table. */
type CellClass = 'fixed' | 'stretch' | 'tile' | 'scale' | 'collapse';

/**
 * Part-code classification — the decoded 2.3.1 jump table (`0x49d6`) plus the
 * `0x5178` fill chains, per compositor-spec.md "Part-code classification":
 *
 *   1, 5, 6, 7, 9, 10, default → FIXED (drawn 1:1).
 *     5/6 are the title bezel: fixed when the title fits, collapse to 0 when
 *     it doesn't; they never grow. We mark them 'collapse' so they hold their
 *     src width but never participate in the slack budget.
 *   0, 8, 11, 13, 14 → STRETCH (even share of slack).
 *   15, 16, 17 → stretch iff the matching widget is PRESENT; else fixed.
 *   2, 3, 4 → close/zoom/shade GAP cells — fixed when widget present;
 *     stretch (the gap fills) when absent.
 *   12 → TILE (dst rounded to a whole multiple of src width).
 *   18 → SCALE (a single scaled CopyBits, drawn once).
 *
 * `widgetPresent` is the cinf widget-state gate (we treat all named widgets as
 * present — the bundled corpus always ships the close/zoom/shade boxes).
 */
function classifyPart(code: number, widgetPresent: boolean): CellClass {
  switch (code) {
    case 0:
    case 8:
    case 11:
    case 13:
    case 14:
      return 'stretch';
    case 12:
      return 'tile';
    case 18:
      return 'scale';
    case 5:
    case 6:
      return 'collapse'; // title bezel: fixed-or-collapse, never grows
    case 2:
    case 3:
    case 4:
      // gap beside a widget: stretches only when the widget is ABSENT
      return widgetPresent ? 'fixed' : 'stretch';
    case 15:
    case 16:
    case 17:
      // the widget cell: stretches only when the widget is PRESENT
      return widgetPresent ? 'stretch' : 'fixed';
    default:
      return 'fixed'; // 1, 7, 9, 10, and any unknown code
  }
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

/** A rectangle in pixel space (for the diagnostic placement map). */
export interface PixRectXY { x: number; y: number; w: number; h: number; }

/** How a slice's source pixels were laid into the output. */
export type SliceMode = 'fixed' | 'stretch' | 'tile' | 'scale' | 'collapse' | 'stamp';

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
    case 0: return 'corner/stretch';
    case 1: return 'fixed divider';
    case 2: return 'close gap';
    case 3: return 'zoom gap';
    case 4: return 'shade gap';
    case 5: case 6: return 'title bezel';
    case 7: return 'fixed';
    case 8: return 'side fill';
    case 11: return 'stretch';
    case 12: return 'tile';
    case 13: case 14: return 'stretch';
    case 15: return 'close cell';
    case 16: return 'zoom cell';
    case 17: return 'shade cell';
    case 18: return 'scale band';
    default: return `p${code}`;
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Per-edge walk
// ───────────────────────────────────────────────────────────────────────────

/**
 * Geometry for walking ONE window edge. The kDEF draws the four edges by the
 * same algorithm; this is the per-edge parameterisation.
 *
 * The "walk axis" is the long axis of the edge (X for top/bottom, Y for
 * left/right). The "cross axis" is the frame-thickness direction.
 */
interface EdgeGeometry {
  edge: 'top' | 'bottom' | 'left' | 'right';
  /** true = walk along X (top/bottom); false = walk along Y (left/right). */
  horizontal: boolean;
  /** cicn cross-axis origin (which rows / cols of the cicn this edge samples). */
  crossSrc: number;
  /** frame thickness (rows for top/bottom, cols for left/right). */
  crossLen: number;
  /** output cross-axis position to draw the edge strip at. */
  crossDst: number;
  /** total OUTPUT extent along the walk axis (full width / full height). */
  outExtent: number;
  /** the cicn template extent along the walk axis (full cicn width / height). */
  srcExtent: number;
  /** tile (true) vs stretch (false) the fill cells — cinf.tileSides. */
  tile: boolean;
  /**
   * Fixed corner size at the LEADING (`[0]`) and TRAILING (`[1]`) ends of the
   * walk axis (px). The leading `corner[0]` and trailing `corner[1]` px of the
   * edge are drawn 1:1 from the cicn (the rounded/jointed corner art) and never
   * stretched; only the interior between them takes the recipe's growth. For
   * top/bottom this is the adjacent side thickness; for left/right it's the
   * adjacent top/bottom thickness. The kDEF's `cornerSize`.
   */
  corner: [number, number];
  /**
   * Rect-list WIDGET spans `[start, end]` along the walk axis (close/zoom/
   * shade boxes), in cicn coordinates. A fill cell overlapping one is drawn
   * AROUND the widget; the widget itself is stamped once (carving). Title
   * markers (≤2px) are NOT here. Empty on edges with no widgets.
   */
  widgetSpans: Array<[number, number]>;
}

interface RawCell {
  x0: number;
  x1: number;
  code: number;
  cls: CellClass;
}

/** Turn an edge recipe into ordered, classified source cells along the axis. */
function recipeCells(recipe: EdgeStep[], axisMax: number, widgetPresent: boolean): RawCell[] {
  const sorted = [...recipe].sort((a, b) => a.at - b.at);
  const cells: RawCell[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const x0 = sorted[i]!.at;
    const x1 = i + 1 < sorted.length ? sorted[i + 1]!.at : axisMax;
    if (x1 <= x0) continue; // zero-width sentinel / coincident borders
    const code = partCode(sorted[i]!.part);
    cells.push({ x0, x1, code, cls: classifyPart(code, widgetPresent) });
  }
  return cells;
}

/**
 * Distribute the growth slack EVENLY across the stretch cells of one half,
 * remainder spread left-to-right — the kDEF `0x5178` budget pass. Returns the
 * per-cell DST width for the given index range `[lo, hi)`.
 *
 * budget = (dst extent of the half) − Σ(fixed/collapse/scale src widths)
 * each stretch cell gets floor(budget/numStretch), first `budget%numStretch`
 * cells get +1. Tile cells round their share down to a whole src multiple.
 */
function distributeHalf(cells: RawCell[], lo: number, hi: number, dstExtent: number): number[] {
  const out: number[] = [];
  let fixedSum = 0;
  let numStretch = 0;
  for (let i = lo; i < hi; i++) {
    const c = cells[i]!;
    const w = c.x1 - c.x0;
    if (c.cls === 'stretch' || c.cls === 'tile' || c.cls === 'scale') numStretch++;
    else fixedSum += w; // fixed + collapse hold their src width
  }
  // collapse cells (title bezel) hold src width here; the title-fits gate is
  // assumed (the renderer only ever sizes wider than the cicn template).
  let budget = dstExtent - fixedSum;
  if (budget < 0) budget = 0;
  const share = numStretch > 0 ? Math.floor(budget / numStretch) : 0;
  let rem = numStretch > 0 ? budget % numStretch : 0;
  for (let i = lo; i < hi; i++) {
    const c = cells[i]!;
    const w = c.x1 - c.x0;
    if (c.cls === 'stretch' || c.cls === 'scale') {
      let cw = share + (rem > 0 ? 1 : 0);
      if (rem > 0) rem--;
      out.push(cw);
    } else if (c.cls === 'tile') {
      // round to a whole multiple of the src cell width so the tile lands clean
      let cw = share + (rem > 0 ? 1 : 0);
      if (rem > 0) rem--;
      if (w > 0) cw = Math.max(w, Math.round(cw / w) * w);
      out.push(cw);
    } else {
      out.push(w); // fixed / collapse keep their src width
    }
  }
  return out;
}

/**
 * Compute the per-cell DST widths for a whole side, split SYMMETRICALLY about
 * the title region (the contiguous run of collapse cells, codes 5/6). Each
 * half distributes its own slack independently so the centred title stays
 * centred. When there is no title region, the whole side is one half.
 */
function distributeSide(cells: RawCell[], outExtent: number, srcStart: number): number[] {
  // The title-region cells are the collapse run (codes 5/6).
  let tLo = -1, tHi = -1;
  for (let i = 0; i < cells.length; i++) {
    if (cells[i]!.cls === 'collapse') { if (tLo < 0) tLo = i; tHi = i + 1; }
  }
  const widths = new Array<number>(cells.length).fill(0);

  if (tLo < 0) {
    // No title: one half spanning the whole side.
    const ws = distributeHalf(cells, 0, cells.length, outExtent - srcStart);
    for (let i = 0; i < cells.length; i++) widths[i] = ws[i]!;
    return widths;
  }

  // Title bezel keeps its src width and anchors the split.
  let titleW = 0;
  for (let i = tLo; i < tHi; i++) titleW += cells[i]!.x1 - cells[i]!.x0;
  for (let i = tLo; i < tHi; i++) widths[i] = cells[i]!.x1 - cells[i]!.x0;

  // The title's centre sits at the centre of the output side. Each half
  // (left of the bezel, right of it) gets half the remaining output extent.
  const usable = outExtent - srcStart - titleW;
  const leftDst = Math.floor(usable / 2);
  const rightDst = usable - leftDst;

  const lw = distributeHalf(cells, 0, tLo, leftDst);
  for (let i = 0; i < tLo; i++) widths[i] = lw[i]!;
  const rw = distributeHalf(cells, tHi, cells.length, rightDst);
  for (let i = tHi; i < cells.length; i++) widths[i] = rw[i - tHi]!;
  return widths;
}

interface PlacedCell {
  /** cicn source walk-axis span. */
  x0: number; x1: number;
  /** output walk-axis span. */
  out0: number; out1: number;
  code: number;
  cls: CellClass;
}

/**
 * Compose ONE window edge by walking its `wnd#` recipe per the spec model.
 * Returns the placed cells (for widget mapping + the diagnostic) plus the
 * title region's output span (for centring the title).
 */
function composeEdge(
  out: PixelBuffer,
  cicn: PixelBuffer,
  recipe: EdgeStep[],
  geo: EdgeGeometry,
  widgetPresent: boolean,
): { placed: PlacedCell[]; titleStart: number; titleEnd: number } | null {
  // The recipe's last `at` closes the final cell; it is the src extent the
  // recipe describes (often == cicn extent, sometimes short — we cap fill at
  // the cicn extent and let the far corner sit at the end).
  const lastAt = recipe.reduce((m, s) => Math.max(m, s.at), 0);
  const cells = recipeCells(recipe, lastAt, widgetPresent);
  if (cells.length === 0) return null;

  // ── corner preservation ───────────────────────────────────────────────────
  // Split a FIXED corner block off the leading/trailing ends so the rounded /
  // jointed corner art (1990's camo joints, evolution's pipe elbows, 1138's
  // rounded bezel) is drawn 1:1 and never stretched. We split only if the end
  // cell is a growing cell (stretch/tile/scale) wider than the corner; the
  // corner block becomes a fixed cell, the remainder keeps the original code.
  const splitLeadingCorner = (cw: number): void => {
    if (cw <= 0) return;
    const c = cells[0]!;
    if (c.cls === 'fixed' || c.cls === 'collapse') return;
    const w = c.x1 - c.x0;
    if (w <= cw) return;
    cells.splice(0, 1,
      { x0: c.x0, x1: c.x0 + cw, code: c.code, cls: 'fixed' },
      { x0: c.x0 + cw, x1: c.x1, code: c.code, cls: c.cls });
  };
  const splitTrailingCorner = (cw: number): void => {
    if (cw <= 0) return;
    const c = cells[cells.length - 1]!;
    if (c.cls === 'fixed' || c.cls === 'collapse') return;
    const w = c.x1 - c.x0;
    if (w <= cw) return;
    cells.splice(cells.length - 1, 1,
      { x0: c.x0, x1: c.x1 - cw, code: c.code, cls: c.cls },
      { x0: c.x1 - cw, x1: c.x1, code: c.code, cls: 'fixed' });
  };
  splitLeadingCorner(geo.corner[0]);
  splitTrailingCorner(geo.corner[1]);

  // The first cell's x0 is the recipe's start offset; the region before it
  // maps 1:1, so output starts there too.
  const srcStart = cells[0]!.x0;
  const dstWidths = distributeSide(cells, geo.outExtent, srcStart);

  const placed: PlacedCell[] = [];
  let titleStart = -1, titleEnd = -1;
  let outPos = srcStart;

  // ── helpers: blit a SRC band → DST band on this edge ──────────────────────
  // stretch: nearest-neighbour scale the whole src band to the dst band.
  const drawStretch = (sx0: number, sLen: number, dPos: number, dLen: number): void => {
    if (sLen <= 0 || dLen <= 0) return;
    if (geo.horizontal) {
      out.copyBits(cicn, { x: sx0, y: geo.crossSrc, w: sLen, h: geo.crossLen },
        { x: dPos, y: geo.crossDst, w: dLen, h: geo.crossLen });
    } else {
      out.copyBits(cicn, { x: geo.crossSrc, y: sx0, w: geo.crossLen, h: sLen },
        { x: geo.crossDst, y: dPos, w: geo.crossLen, h: dLen });
    }
  };
  // tile: step the dst by the src cell size, copying one src-sized tile at a
  // time, clamping the final partial tile (kDEF 0xfeae).
  const drawTile = (sx0: number, sLen: number, dPos: number, dLen: number): void => {
    if (sLen <= 0 || dLen <= 0) return;
    for (let off = 0; off < dLen; off += sLen) {
      const seg = Math.min(sLen, dLen - off);
      if (geo.horizontal) {
        out.copyBits(cicn, { x: sx0, y: geo.crossSrc, w: seg, h: geo.crossLen },
          { x: dPos + off, y: geo.crossDst, w: seg, h: geo.crossLen });
      } else {
        out.copyBits(cicn, { x: geo.crossSrc, y: sx0, w: geo.crossLen, h: seg },
          { x: geo.crossDst, y: dPos + off, w: geo.crossLen, h: seg });
      }
    }
  };
  // Pick the most-UNIFORM source line within [s0,s1) along the walk axis: the
  // line with the fewest cross-axis transitions (the clean pinstripe / fill
  // cross-section). Stretch-holding this avoids smearing 2D corner/feature art
  // — the emergent behaviour the kDEF gets free because its template fill cells
  // are authored ~1px wide; our decoder split them into wide bands, so we
  // re-find the clean column. (Pure 1px bands trivially return their one line.)
  const sampleLine = (cicn2: PixelBuffer, s0: number, s1: number): number => {
    if (s1 - s0 <= 1) return s0;
    let best = s0, bestTrans = Infinity;
    for (let s = s0; s < s1; s++) {
      let trans = 0, prev = -1;
      for (let t = 1; t < geo.crossLen - 1; t++) {
        const px = geo.horizontal ? cicn2.getPixel(s, geo.crossSrc + t) : cicn2.getPixel(geo.crossSrc + t, s);
        const bit = px[3] < 64 ? -1 : (0.3 * px[0] + 0.59 * px[1] + 0.11 * px[2]) < 128 ? 0 : 1;
        if (prev !== -1 && bit !== prev) trans++;
        prev = bit;
      }
      if (trans < bestTrans) { bestTrans = trans; best = s; }
    }
    return best;
  };
  // Fill a dst band from a src band per cinf.tileSides:
  //   tile  → repeat the WHOLE src band at its native size (keeps a wide motif).
  //   stretch → sample-and-hold the cell's most-uniform line across the dst
  //             (keeps pinstripes/fills clean; no 2D smear).
  const drawFill = (s0: number, s1: number, dPos: number, dLen: number): void => {
    const sLen = s1 - s0;
    if (sLen <= 0 || dLen <= 0) return;
    if (geo.tile) {
      drawTile(s0, sLen, dPos, dLen);
    } else {
      const line = sampleLine(cicn, s0, s1);
      drawStretch(line, 1, dPos, dLen);
    }
  };

  // ── walk the cells ────────────────────────────────────────────────────────
  for (let i = 0; i < cells.length; i++) {
    const c = cells[i]!;
    const srcLen = c.x1 - c.x0;
    const dstLen = dstWidths[i]!;

    if (c.cls === 'collapse') {
      if (titleStart < 0) titleStart = outPos;
      titleEnd = outPos + dstLen;
    }

    // Carve any rect-list widgets that fall inside this cell out of the fill.
    const widgetsHere = geo.widgetSpans
      .filter(([a, b]) => a < c.x1 && b > c.x0)
      .map(([a, b]) => [Math.max(a, c.x0), Math.min(b, c.x1)] as [number, number])
      .sort((p, q) => p[0] - q[0]);

    if (c.cls === 'scale') {
      // code 18: a single scaled CopyBits — drawn ONCE, src band → dst band.
      // (Carving doesn't apply: scale bands are decorative, not widgets.)
      drawStretch(c.x0, srcLen, outPos, dstLen);
    } else if (c.cls === 'fixed' || c.cls === 'collapse') {
      // 1:1 copy, anchored to its position (corners, bezels, present widgets).
      drawStretch(c.x0, srcLen, outPos, srcLen); // dstLen == srcLen here
    } else if (widgetsHere.length === 0) {
      // plain fill cell: stretch (sample-and-hold) or tile per cinf.
      drawFill(c.x0, c.x1, outPos, dstLen);
    } else {
      // ── WIDGET CARVING ──────────────────────────────────────────────────
      // Split the cell into fill segments around each widget. Each fill
      // segment fills (stretch/tile) the SLACK proportionally to its own src
      // width; the widgets keep native width. As the cell grows, the slack
      // lands in the fill segments — so left widgets stay left and right
      // widgets ride the right edge. The widget pixels themselves are stamped
      // ONCE in pass 2 (here we just leave clean fill beneath them).
      const cellSlack = dstLen - srcLen; // extra width this cell absorbs
      // src widths of the fill gaps between/around widgets
      const gaps: Array<{ s0: number; s1: number }> = [];
      let cursor = c.x0;
      for (const [a, b] of widgetsHere) {
        if (a > cursor) gaps.push({ s0: cursor, s1: a });
        cursor = Math.max(cursor, b);
      }
      if (cursor < c.x1) gaps.push({ s0: cursor, s1: c.x1 });
      const gapSrcTotal = gaps.reduce((n, g) => n + (g.s1 - g.s0), 0);

      // Distribute the slack across the gaps proportionally (remainder L→R),
      // then walk widget+gap in source order placing each at the running outPos.
      let slackLeft = cellSlack;
      const gapExtra = new Map<number, number>();
      gaps.forEach((g, gi) => {
        const sw = g.s1 - g.s0;
        const ex = gi === gaps.length - 1
          ? slackLeft
          : gapSrcTotal > 0 ? Math.round((cellSlack * sw) / gapSrcTotal) : 0;
        gapExtra.set(gi, Math.max(0, ex));
        slackLeft -= Math.max(0, ex);
      });

      let local = outPos;
      // Interleave gaps and widgets in source order.
      const events: Array<{ kind: 'gap'; idx: number } | { kind: 'widget'; a: number; b: number }> = [];
      let gPtr = 0;
      for (const [a, b] of widgetsHere) {
        // any gap that starts before this widget
        while (gPtr < gaps.length && gaps[gPtr]!.s0 < a) { events.push({ kind: 'gap', idx: gPtr }); gPtr++; }
        events.push({ kind: 'widget', a, b });
      }
      while (gPtr < gaps.length) { events.push({ kind: 'gap', idx: gPtr }); gPtr++; }

      // The clean fill cross-section for this cell (used to back the widgets):
      // the most-uniform line across all gaps, so the carved-out region reads
      // as continuous frame, not white or a feature smear.
      const cleanS0 = gaps.length ? gaps[gaps.length - 1]!.s0 : c.x0;
      const cleanS1 = gaps.length ? gaps[gaps.length - 1]!.s1 : c.x1;
      const cleanLine = sampleLine(cicn, cleanS0, cleanS1);
      for (const ev of events) {
        if (ev.kind === 'gap') {
          const g = gaps[ev.idx]!;
          const sw = g.s1 - g.s0;
          const dw = sw + (gapExtra.get(ev.idx) ?? 0);
          drawFill(g.s0, g.s1, local, dw);
          local += dw;
        } else {
          // Clean fill beneath the widget rect (the cell's uniform line), so
          // pass 2 stamps the widget onto frame, not white / a smear.
          const ww = ev.b - ev.a;
          drawStretch(cleanLine, 1, local, ww);
          local += ww;
        }
      }
    }

    placed.push({ x0: c.x0, x1: c.x1, out0: outPos, out1: outPos + dstLen, code: c.code, cls: c.cls });
    outPos += dstLen;
  }

  // ── far-edge cap (top/bottom): if the recipe stopped short of the cicn
  // width but there is opaque art past it, stamp it at the far end. ──────────
  if (geo.horizontal && lastAt < geo.srcExtent) {
    const capLen = geo.srcExtent - lastAt;
    let capOpaque = false;
    for (let cx = lastAt; cx < geo.srcExtent && !capOpaque; cx++)
      for (let cy = geo.crossSrc; cy < geo.crossSrc + geo.crossLen; cy++)
        if (cicn.getPixel(cx, cy)[3] > 16) { capOpaque = true; break; }
    if (capLen > 0 && capOpaque && outPos < geo.outExtent) {
      const cap = Math.min(capLen, geo.outExtent - outPos);
      drawStretch(lastAt, capLen, outPos, cap);
      placed.push({ x0: lastAt, x1: geo.srcExtent, out0: outPos, out1: outPos + cap, code: 0, cls: 'fixed' });
      outPos += cap;
    }
  }

  return { placed, titleStart, titleEnd };
}

/**
 * Fallback for window types that ship no edge recipe: stamp the cicn's end
 * caps and stretch the middle column across the gap. Rare (every corpus scheme
 * ships recipes); kept so any scheme still renders a frame.
 */
function composeSeamFallback(
  out: PixelBuffer,
  cicn: PixelBuffer,
  top: number,
  fullW: number,
): void {
  const cap = Math.min(Math.round(cicn.width / 3), Math.round(fullW / 2));
  out.copyBits(cicn, { x: 0, y: 0, w: cap, h: top }, { x: 0, y: 0, w: cap, h: top });
  out.copyBits(cicn, { x: cicn.width - cap, y: 0, w: cap, h: top }, { x: fullW - cap, y: 0, w: cap, h: top });
  const midW = fullW - cap * 2;
  if (midW > 0) {
    const sx = Math.floor(cicn.width / 2);
    out.copyBits(cicn, { x: sx, y: 0, w: 1, h: top }, { x: cap, y: 0, w: midW, h: top });
  }
}

export interface ComposedChrome {
  buffer: PixelBuffer;
  frame: Frame;
  /** Full footprint size (content rect + chrome margins), in cicn px. */
  fullWidth: number;
  fullHeight: number;
  /**
   * Output X-span of the title region — the run of title-bezel cells (codes
   * 5/6). The title is centred on the CONTENT centre (renderWindow.ts), not on
   * this span; it is reported for diagnostics + as a fallback. Full-width when
   * the top edge has no title region.
   */
  titleRegion: { x: number; w: number };
  /**
   * cicn SOURCE column whose colour is the title-text colour (the cinf
   * textPixel x), or −1 when the window ships no cinf (every corpus scheme).
   * renderWindow.ts uses the declared header text colour in that case.
   */
  titleFillSrcX: number;
  /** Slice-by-slice placement map for the diagnostic inspector. */
  placement: PlacementSlice[];
}

/**
 * Compose a window's chrome into a pixel buffer at NATIVE resolution. The
 * content rect (contentW × contentH) is left transparent so real DOM content
 * shows through when the buffer is blitted behind it.
 *
 * Faithful to the kDEF window draw: all four edges are walked by the one
 * `composeEdge` routine (classify → distribute → place → blit). The cicn is the
 * minimum-window template; part-0's inset gives the per-edge frame thickness.
 */
export function composeWindowChrome(
  cicn: PixelBuffer,
  windowType: WindowType,
  contentW: number,
  contentH: number,
  opts: { cinf?: WindowCinf | null } = {},
): ComposedChrome {
  const body = windowType.parts['part-0'];
  if (!body) throw new Error('composeWindowChrome: windowType has no part-0 body rect');
  const frame = frameFromBody(body.rect, cicn.width, cicn.height);
  const [, bt, ,] = body.rect; // cicn body rect top (for the no-recipe side fill)

  const fullW = frame.left + contentW + frame.right;
  const fullH = frame.top + contentH + frame.bottom;
  const out = PixelBuffer.alloc(fullW, fullH);

  const cinf = opts.cinf ?? windowType.cinf ?? null;
  const tile = (cinf?.tileSides ?? 0) !== 0;
  const edges = windowType.edges;
  // Corner block size: the cinf cornerSize when present, else the adjacent
  // frame thickness (the corner is the side×top intersection — that art block
  // stays fixed). The window ships no cinf in the corpus, so this is the frame.
  const cTop = cinf?.cornerSize ?? frame.top;
  const cBot = cinf?.cornerSize ?? frame.bottom;
  const cLeft = cinf?.cornerSize ?? frame.left;
  const cRight = cinf?.cornerSize ?? frame.right;

  // ── rect-list classification ──────────────────────────────────────────────
  // part-0 is the body. The remaining parts are widgets (close/zoom/shade) and
  // the title MARKER. A ≤2px-wide rect in the top band is the marker (the cinf
  // text-colour line, NOT a widget — never carved/stamped). Wider rects are
  // widgets. We collect widgets per edge band by where their rect sits.
  interface WRect { l: number; t: number; r: number; b: number; }
  const topWidgets: WRect[] = [];
  const botWidgets: WRect[] = [];
  const leftWidgets: WRect[] = [];
  const rightWidgets: WRect[] = [];
  let titleMarkerX = -1;
  for (const [slug, part] of Object.entries(windowType.parts)) {
    if (slug === 'part-0' || !part.rect) continue;
    const [l, t, r, b] = part.rect;
    if (r <= l || b <= t) continue; // empty rect (e.g. beos part-3 [0,0,0,0])
    const w = r - l, h = b - t;
    // Which band does this rect belong to?
    if (t < frame.top && r > l) {
      // top band
      if (w <= 2) { if (titleMarkerX < 0) titleMarkerX = l; continue; }
      topWidgets.push({ l, t, r, b });
    } else if (b > cicn.height - frame.bottom) {
      botWidgets.push({ l, t, r, b });
    } else if (l < frame.left) {
      if (h > 2) leftWidgets.push({ l, t, r, b });
    } else if (r > cicn.width - frame.right) {
      if (h > 2) rightWidgets.push({ l, t, r, b });
    }
  }
  const topWidgetSpans = topWidgets.map((w) => [w.l, w.r] as [number, number]);

  // Widget-present gate: a window that ships widget rects has its named
  // widgets present (corpus is always so). Gate the 2/3/4 vs 15/16/17 codes.
  const widgetPresent = topWidgets.length > 0 || windowType.parts['part-1'] != null;

  // ── top edge ────────────────────────────────────────────────────────────
  let topRes: ReturnType<typeof composeEdge> = null;
  if (edges?.top?.length) {
    topRes = composeEdge(out, cicn, edges.top, {
      edge: 'top', horizontal: true, crossSrc: 0, crossLen: frame.top, crossDst: 0,
      outExtent: fullW, srcExtent: cicn.width, tile, widgetSpans: topWidgetSpans,
    }, widgetPresent);
  } else {
    composeSeamFallback(out, cicn, frame.top, fullW);
  }

  // ── left edge ───────────────────────────────────────────────────────────
  let leftRes: ReturnType<typeof composeEdge> = null;
  if (frame.left > 0 && edges?.left?.length) {
    leftRes = composeEdge(out, cicn, edges.left, {
      edge: 'left', horizontal: false, crossSrc: 0, crossLen: frame.left, crossDst: 0,
      outExtent: fullH, srcExtent: cicn.height, tile,
      widgetSpans: leftWidgets.map((w) => [w.t, w.b] as [number, number]),
    }, widgetPresent);
  } else if (frame.left > 0) {
    out.copyBits(cicn, { x: 0, y: bt, w: frame.left, h: 1 }, { x: 0, y: frame.top, w: frame.left, h: contentH });
  }

  // ── right edge ──────────────────────────────────────────────────────────
  let rightRes: ReturnType<typeof composeEdge> = null;
  if (frame.right > 0 && edges?.right?.length) {
    rightRes = composeEdge(out, cicn, edges.right, {
      edge: 'right', horizontal: false, crossSrc: cicn.width - frame.right, crossLen: frame.right,
      crossDst: fullW - frame.right, outExtent: fullH, srcExtent: cicn.height, tile,
      widgetSpans: rightWidgets.map((w) => [w.t, w.b] as [number, number]),
    }, widgetPresent);
  } else if (frame.right > 0) {
    out.copyBits(cicn, { x: cicn.width - frame.right, y: bt, w: frame.right, h: 1 }, { x: fullW - frame.right, y: frame.top, w: frame.right, h: contentH });
  }

  // ── bottom edge (drawn AFTER sides so its corners overdraw any side
  // overshoot into the bottom-corner band). ─────────────────────────────────
  let botRes: ReturnType<typeof composeEdge> = null;
  if (frame.bottom > 0 && edges?.bottom?.length) {
    botRes = composeEdge(out, cicn, edges.bottom, {
      edge: 'bottom', horizontal: true, crossSrc: cicn.height - frame.bottom, crossLen: frame.bottom,
      crossDst: fullH - frame.bottom, outExtent: fullW, srcExtent: cicn.width, tile,
      widgetSpans: botWidgets.map((w) => [w.l, w.r] as [number, number]),
    }, widgetPresent);
  } else if (frame.bottom > 0) {
    out.copyBits(cicn, { x: 0, y: cicn.height - frame.bottom, w: cicn.width, h: frame.bottom }, { x: 0, y: fullH - frame.bottom, w: fullW, h: frame.bottom });
  }

  // ── PASS 2: stamp the carved rect-list widgets ONCE, anchored ─────────────
  // For each widget whose background was carved (it overlapped a stretch/tile/
  // scale cell), map its native walk-axis position through that cell's growth
  // and stamp the widget art there at native size. Widgets that sat only in
  // fixed cells are already drawn 1:1 by pass 1.
  const widgetSlices: PlacementSlice[] = [];
  const stampTopBottom = (res: typeof topRes, widgets: WRect[], crossDstOff: (w: WRect) => number): void => {
    if (!res?.placed?.length) return;
    for (const w of widgets) {
      const cell = res.placed.find((p) => w.l < p.x1 && w.r > p.x0);
      if (!cell || cell.cls === 'fixed' || cell.cls === 'collapse') continue; // drawn 1:1 already
      const span = cell.x1 - cell.x0;
      // Anchor: left of the cell midpoint keeps left x; right of it rides the
      // right edge (the fill before it absorbed the slack).
      const grew = (cell.out1 - cell.out0) - span;
      const midSrc = (cell.x0 + cell.x1) / 2;
      const ww = w.r - w.l, hh = w.b - w.t;
      const outX = (w.l + w.r) / 2 <= midSrc
        ? cell.out0 + (w.l - cell.x0)
        : cell.out0 + (w.l - cell.x0) + grew;
      const dx = Math.round(outX);
      const dy = crossDstOff(w);
      out.copyBits(cicn, { x: w.l, y: w.t, w: ww, h: hh }, { x: dx, y: dy, w: ww, h: hh });
      widgetSlices.push({ edge: 'widget', code: -1, role: 'stamped widget', mode: 'stamp', src: { x: w.l, y: w.t, w: ww, h: hh }, rects: [{ x: dx, y: dy, w: ww, h: hh }] });
    }
  };
  // top widgets: cross (y) is unchanged (top band starts at 0).
  stampTopBottom(topRes, topWidgets, (w) => w.t);
  // bottom widgets: cross (y) shifts to the output bottom band.
  stampTopBottom(botRes, botWidgets, (w) => fullH - (cicn.height - w.t));

  // side widgets (left/right): map along Y through the side cell growth.
  const stampSide = (res: typeof leftRes, widgets: WRect[], crossDstOff: number): void => {
    if (!res?.placed?.length) return;
    for (const w of widgets) {
      const cell = res.placed.find((p) => w.t < p.x1 && w.b > p.x0);
      if (!cell || cell.cls === 'fixed' || cell.cls === 'collapse') continue;
      const span = cell.x1 - cell.x0;
      const grew = (cell.out1 - cell.out0) - span;
      const midSrc = (cell.x0 + cell.x1) / 2;
      const ww = w.r - w.l, hh = w.b - w.t;
      const outY = (w.t + w.b) / 2 <= midSrc ? cell.out0 + (w.t - cell.x0) : cell.out0 + (w.t - cell.x0) + grew;
      out.copyBits(cicn, { x: w.l, y: w.t, w: ww, h: hh }, { x: crossDstOff + (w.l - (crossDstOff === 0 ? 0 : cicn.width - frame.right)), y: Math.round(outY), w: ww, h: hh });
    }
  };
  stampSide(leftRes, leftWidgets, 0);
  stampSide(rightRes, rightWidgets, fullW - frame.right);

  // ── aggregate the slice placement map (for the diagnostic) ────────────────
  const placement: PlacementSlice[] = [];
  const modeOf = (cls: CellClass): SliceMode =>
    cls === 'tile' ? (tile ? 'tile' : 'stretch')
      : cls === 'scale' ? 'scale'
      : cls === 'stretch' ? (tile ? 'tile' : 'stretch')
      : cls === 'collapse' ? 'collapse'
      : 'fixed';
  const collect = (edge: PlacementSlice['edge'], res: typeof topRes): void => {
    if (!res) return;
    for (const p of res.placed) {
      placement.push({
        edge, code: p.code, role: partRole(p.code), mode: modeOf(p.cls),
        src: edge === 'top' || edge === 'bottom'
          ? { x: p.x0, y: edge === 'top' ? 0 : cicn.height - frame.bottom, w: p.x1 - p.x0, h: edge === 'top' ? frame.top : frame.bottom }
          : { x: edge === 'left' ? 0 : cicn.width - frame.right, y: p.x0, w: edge === 'left' ? frame.left : frame.right, h: p.x1 - p.x0 },
        rects: edge === 'top' || edge === 'bottom'
          ? [{ x: p.out0, y: edge === 'top' ? 0 : fullH - frame.bottom, w: p.out1 - p.out0, h: edge === 'top' ? frame.top : frame.bottom }]
          : [{ x: edge === 'left' ? 0 : fullW - frame.right, y: p.out0, w: edge === 'left' ? frame.left : frame.right, h: p.out1 - p.out0 }],
      });
    }
  };
  collect('top', topRes);
  collect('bottom', botRes);
  collect('left', leftRes);
  collect('right', rightRes);
  placement.push(...widgetSlices);

  const titleRegion = topRes && topRes.titleEnd > topRes.titleStart
    ? { x: topRes.titleStart, w: topRes.titleEnd - topRes.titleStart }
    : { x: 0, w: fullW };
  const titleFillSrcX = cinf?.textPixel ? cinf.textPixel[0] : titleMarkerX;
  return { buffer: out, frame, fullWidth: fullW, fullHeight: fullH, titleRegion, titleFillSrcX, placement };
}
