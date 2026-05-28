import { PixelBuffer } from './pixelBuffer.js';
import type { WindowType, WindowCinf, Rect, EdgeStep } from './types.js';

// ───────────────────────────────────────────────────────────────────────────
// Window-chrome compositor — the Kaleidoscope 2.3.1 kDEF window-frame model.
//
// A faithful replay of the 2.3.1 kDEF (a compact 68k WDEF). Canonical model:
// docs/spec/compositor-spec.md; instruction-level decode + addresses:
// docs/spec/kdef231-recipe-walk.md. Per window edge:
//
//   1. WALK the wnd# side-list into cells. Association is END-BASED (kdef
//      §0x5356): segment i is `[border[i-1], border[i])` tagged `part[i]`. The
//      segment loop starts at index 1 (kdef §0x4a64), so the leading
//      `[0, border[0])` region is the fixed CORNER, drawn 1:1.
//   2. CLASSIFY each cell by part code (jump table kdef §0x49d6 + §0x5178).
//   3. DISTRIBUTE slack EVENLY across the stretch cells, split symmetrically
//      about the title so the centred title stays centred (kdef §0x5178 ×2).
//   4. BLIT: code 18 = ONE scaled CopyBits (kdef §0x10320); everything else
//      TILES the src cell across the dst (kdef §0xfeae — always tiles; there is
//      no scaled CopyBits for ordinary fills).
//
// The close/zoom/shade widgets are baked into the cicn title bar and fall inside
// the FIXED title-bar cells, so step 4 draws them 1:1, anchored — no separate
// widget pass. TITLE TEXT is drawn in renderWindow.ts (centred on the content
// centre, in the header text colour) — not here.
//
// ─────────────────────────────────────────────────────────────────────────────
// NAVIGATION MAP
// ─────────────────────────────────────────────────────────────────────────────
// This file is the static-chrome composition engine. It does NOT touch the DOM;
// it produces pixel buffers and a placement map. renderWindow.ts wraps the
// output in DOM; interactive.ts wires events on that DOM.
//
// PUBLIC SURFACE:
//   composeWindowChrome(theme, opts) → ComposedChrome
//                              The one entry point. Loads the chrome cicn, walks
//                              the recipe, blits each cell, returns the rendered
//                              PixelBuffer + a placement map + the resolved frame
//                              dimensions. Used by renderWindow.ts.
//
//   ComposedChrome             The return shape — buffer, frame, placement
//                              (the per-cell slice records used by the slice
//                              inspector in the demo), growBox (optional sprite),
//                              titleRegion, fullWidth/Height.
//
//   PlacementSlice             One drawn cell's record (mode/dst rect/part/edge).
//                              Used by the demo's slice inspector for debug
//                              visualization.
//
//   SliceMode                  'fixed' | 'stretch' | 'tile' | 'scale' | 'collapse'
//                              | 'stamp'. The classifier's output enum.
//
//   Frame, frameFromBody       Frame thickness from the cicn's drawable extent
//                              vs the body rect. Used by renderWindow.ts to
//                              inset the content area.
//
//   partRole(code)             Human-readable label for a part code. Used by
//                              the demo's slice inspector + the diagnostic CLI.
//
// INTERNAL MACHINERY (in order top-to-bottom in the file):
//   partCode(slug)             Parse a `part-N` slug to integer N.
//   classify(code, …)          Map part code → CellClass via the kDEF jump table.
//   walkSide(edge, side, …)    End-based cell walk (kdef §0x5356).
//   distributeSlack(cells, …)  Symmetric slack distribution about title centre.
//   blitCell(cell, …)          Per-cell blit dispatch by SliceMode.
//   composeWindowChrome(…)     The orchestrator that calls walkSide → distribute
//                              → blitCell for each of {top, right, bottom, left}.
//
// CROSS-FILE RELATIONSHIPS:
//   composeCornerSprite.ts     The ALTERNATIVE compositor for "look-only"
//                              schemes that ship corner cicns + sprites but no
//                              wnd# recipe (apple-platinum-2, platinum-8,
//                              system7-nostalgia-silver, black-platinum).
//                              renderWindow.ts picks one based on windowType.model.
//   renderWindow.ts            Wraps composeWindowChrome's output in DOM
//                              (.aw-window > canvas + .aw-content + grow box).
//   types.ts                   ThemeManifest + Rect + EdgeStep + WindowType
//                              shapes consumed here.
//
// SPEC REFERENCES:
//   docs/spec/compositor-spec.md       The implemented model (the spec).
//   docs/spec/kdef231-recipe-walk.md   Decoded recipe walk (truth from binary).
//   docs/spec/kdef231-reference.md     Routine/address lookup table.
//   docs/spec/kdef-faithfulness-ledger.md  Every deliberate divergence.
//
// IMPLEMENTATION DISCIPLINE:
//   No per-theme branches (the kDEF didn't have any; we shouldn't either).
//   Verify against the 2.3.1 binary at /tmp/kaleido-trace/kdef231_decomp.c
//   when changing the part-code classifier or the cell-walk logic.
// ─────────────────────────────────────────────────────────────────────────────

/** Extract the integer part code from a `part-N` slug (−1 if malformed). */
function partCode(slug: string): number {
  const m = /^part-(-?\d+)$/.exec(slug);
  return m ? Number(m[1]) : -1;
}

/**
 * How a cell's part code is classified, mirroring the kDEF's `0x5178` width
 * pass (see kdef231-reference.md §4.2 — verified against `kdef231_decomp.c`):
 *   - 'grow'     budget participant; gets an even share of the slack (8/11/13/14)
 *   - 'tile'     budget participant rounded to a whole src multiple (12)
 *   - 'scale'    budget participant drawn as ONE scaled CopyBits (18)
 *   - 'fixed'    holds its src width, drawn 1:1
 *   - 'collapse' title bezel (5/6): src width when the title fits, else 0
 *   - 'zero'     COLLAPSES to width 0, draws nothing
 */
type CellClass = 'fixed' | 'grow' | 'tile' | 'scale' | 'collapse' | 'zero';

/**
 * Part-code classification — the decoded 2.3.1 width pass (`0x5178`), which
 * splits into THREE groups (NOT a simple fixed/stretch binary):
 *
 *   GROWERS — get a share of the slack budget:
 *     8, 11, 13, 14 → 'grow'  (even share; 13/14 a smaller remainder-only share)
 *     12            → 'tile'  (share rounded down to a whole src multiple)
 *     18            → 'scale' (share, drawn as one scaled CopyBits)
 *
 *   TITLE BEZEL: 5, 6 → 'collapse' (src width when the title fits, else 0).
 *
 *   EVERYTHING ELSE is routed through the `0x49d6` table and its result is
 *   read NOT as "tile" but as a WIDTH: a "stretch" verdict leaves the cell at
 *   width 0 (it yields its space to the growers / the separately-drawn widget),
 *   a "fixed" verdict gives it its src width. So:
 *     0                      → 'zero'  (0x49d6: stretch-always)
 *     2, 3, 4 (close/zoom/shade GAP)  → widget present ? 'fixed' : 'zero'
 *     15, 16, 17 (close/zoom/shade CELL) → widget present ? 'zero' : 'fixed'
 *     1, 7, 9, default       → 'fixed'
 *
 *   This is why 1984's title-tab shoulder must NOT be drawn: it lives in the
 *   close CELL (code 15), which — the close widget being present — COLLAPSES
 *   to 0 (the widget occupies that span). Tiling it (the old reading of
 *   "stretch") produced a row of arches; growing the genuine flat fill (code 8)
 *   is what fills the widened bar. (Was compositor-spec open issue #3.)
 *
 * CODE 10 is FLAG-GATED in the kDEF (`0x4a0c` returns the caller's flag byte):
 * it stretches when the title-fits flag is set. We classify it FIXED, which is
 * render-correct for this corpus: code-10 cells are either on a title-LESS
 * window's title edge (no label → title-fits false → fixed, and their code-10
 * band has the widget BAKED in, which a collapsing/growing cell would drop), or
 * on a non-title edge over a uniform bar (1984 doc-window bottom/right) where
 * fixed and grow render identically.
 *
 * `widgetPresent` is the cinf widget-state gate (we treat all named widgets as
 * present — the bundled corpus always ships the close/zoom/shade boxes).
 */
function classifyPart(code: number, widgetPresent: boolean): CellClass {
  switch (code) {
    case 8:
    case 11:
    case 13:
    case 14:
      return 'grow';
    case 12:
      return 'tile';
    case 18:
      return 'scale';
    case 5:
    case 6:
      return 'collapse'; // title bezel: src-width-or-collapse, never grows
    case 0:
      return 'zero'; // 0x49d6 stretch-always → collapses (growers fill the edge)
    case 2:
    case 3:
    case 4:
      // close/zoom/shade GAP: holds the widget when present (fixed), else
      // collapses (the 0x49d6 "stretch when absent" verdict = width 0)
      return widgetPresent ? 'fixed' : 'zero';
    case 15:
    case 16:
    case 17:
      // close/zoom/shade CELL: collapses when the widget is present (0x49d6
      // stretch-verdict → width 0 — the widget owns that span), else holds its
      // src width as plain background.
      return widgetPresent ? 'zero' : 'fixed';
    default:
      return 'fixed'; // 1, 7, 9, 10 (flag-gated → fixed here), and unknown codes
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
  // Each border thickness is the cicn dimension minus the body rect's far edge.
  // With a well-formed body rect (0 ≤ near < far ≤ cicnDim) every inset lands in
  // [0, cicnDim] and this clamp is a strict no-op — the five document-windows are
  // untouched. But several secondary window types pair a body rect with the WRONG
  // (mis-resolved) cicn — e.g. 1138 movable-modal's `[7,24,34,25]` against a 16×16
  // grow-box cicn — so `cicnW − right` goes NEGATIVE and `top` exceeds cicnH. Left
  // unclamped, a negative inset makes composeWindowChrome silently drop that edge
  // (the frame hangs open) and shrinks the buffer below the content rect; an inset
  // larger than the cicn samples out-of-bounds rows that blit as transparent/white
  // smears. Clamping to [0, cicnDim] guarantees a coherent (if minimal) frame —
  // content always fits, no edge samples OOB — degrading gracefully until the
  // cicn↔rect pairing DATA bug is fixed in the extractor. This is the kDEF
  // robustness gap, not the kDEF model: a real scheme never mismatched these.
  const clamp = (v: number, hi: number) => Math.max(0, Math.min(v, hi));
  return {
    left: clamp(left, cicnW),
    top: clamp(top, cicnH),
    right: clamp(cicnW - right, cicnW),
    bottom: clamp(cicnH - bottom, cicnH),
  };
}

/**
 * The cicn's DRAWABLE extent — the last column/row carrying opaque art, +1.
 *
 * The kDEF blits the template with its mask and walks each side recipe over
 * `[0, lastBorder)`, so columns/rows past the last drawn pixel are never part of
 * the window — they're slack in the resource bitmap. Most cicns end their art at
 * the bitmap edge (extent == raw dims, a no-op here), but a few carry a
 * transparent tail: beos's active document-window is a 92px-wide resource whose
 * frame ends at column 74 (its top/bottom recipes likewise stop at border 75).
 * Taking the raw 92 would inflate `frame.right` to 22px — vs the real 5px,
 * symmetric with the 5px left — and, because the bottom recipe stops at 75, leave
 * the bottom edge short of the corner (the bottom-right gap). Using the drawable
 * extent makes the structure rect match the frame the recipe actually draws.
 * Only ever shrinks; the origin stays at (0, 0).
 */
function drawableExtent(cicn: PixelBuffer): { w: number; h: number } {
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < cicn.height; y++) {
    for (let x = 0; x < cicn.width; x++) {
      if (cicn.getPixel(x, y)[3] > 16) {
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  return { w: maxX < 0 ? cicn.width : maxX + 1, h: maxY < 0 ? cicn.height : maxY + 1 };
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
}

interface RawCell {
  x0: number;
  x1: number;
  code: number;
  cls: CellClass;
}

/**
 * Turn an edge recipe into ordered, classified source cells along the axis.
 *
 * END-BASED association (kdef §0x5356): a side-list `(part, border)` entry
 * describes the cell that ENDS at `border`, spanning from the PREVIOUS border —
 * segment i is `[border[i-1], border[i])` tagged `part[i]`. The part code travels
 * with the border that closes its cell.
 *
 * LEADING CORNER: the kDEF's segment loop (kdef §0x4a64) starts at index 1, so
 * the pre-first-border region `[0, border[0])` is never a growing segment — it
 * is drawn 1:1 (the fixed corner). So when `border[0] > 0` (e.g. 1984's left
 * edge, `border[0]=27` — the rounded title-tab) the leading cell is FIXED
 * regardless of its part code; cells from `border[0]` onward classify by code.
 * When `border[0]=0` there is no leading region and the first cell is a normal
 * segment.
 *
 * `border[-1]` is 0 (the edge origin); entries whose border equals the previous
 * one (the `border 0` origin marker, coincident borders) collapse to zero width.
 */
function recipeCells(recipe: EdgeStep[], _axisMax: number, widgetPresent: boolean): RawCell[] {
  const sorted = [...recipe].sort((a, b) => a.at - b.at);
  const cells: RawCell[] = [];
  let prev = 0;
  for (let i = 0; i < sorted.length; i++) {
    const x0 = prev;
    const x1 = sorted[i]!.at;
    prev = x1;
    if (x1 <= x0) continue; // zero-width (border-0 origin / coincident borders)
    const code = partCode(sorted[i]!.part);
    // i===0 only emits when border[0] > 0 — that cell is the leading
    // `[0, border[0])` region → the fixed corner, drawn 1:1 (never grows).
    const cls: CellClass = i === 0 ? 'fixed' : classifyPart(code, widgetPresent);
    cells.push({ x0, x1, code, cls });
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
    if (c.cls === 'grow' || c.cls === 'tile' || c.cls === 'scale') numStretch++;
    else if (c.cls === 'zero') { /* collapses to 0 — neither fixed nor a grower */ }
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
    if (c.cls === 'grow' || c.cls === 'scale') {
      let cw = share + (rem > 0 ? 1 : 0);
      if (rem > 0) rem--;
      out.push(cw);
    } else if (c.cls === 'tile') {
      // round to a whole multiple of the src cell width so the tile lands clean
      let cw = share + (rem > 0 ? 1 : 0);
      if (rem > 0) rem--;
      if (w > 0) cw = Math.max(w, Math.round(cw / w) * w);
      out.push(cw);
    } else if (c.cls === 'zero') {
      out.push(0); // collapses — yields its span to the growers / the widget
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
function distributeSide(cells: RawCell[], outExtent: number, srcStart: number, titleWidthPx = 0): number[] {
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

  // Title region: the code-6 cells are fixed flanking bezels; the code-5 cell is
  // the title PLATE. The kDEF reserves the MEASURED title-text width for it
  // (0x4a64 measures via StringWidth → 0x5034 sets the title cell's DEST span to
  // that width), tiling the plate's src across it (the "pill"). So code-5 grows
  // to fit the title; code-6 keep their src width. With no title (titleWidthPx 0)
  // the plate stays at its src width. Clamp so an over-long title still leaves
  // the side a little room (the kDEF's title-fits gate, 0x4f58).
  let bezelSrc = 0;
  for (let i = tLo; i < tHi; i++) if (cells[i]!.code !== 5) bezelSrc += cells[i]!.x1 - cells[i]!.x0;
  const plateCap = Math.max(0, outExtent - srcStart - bezelSrc - 4);
  let titleW = 0;
  for (let i = tLo; i < tHi; i++) {
    const c = cells[i]!;
    const src = c.x1 - c.x0;
    const w = c.code === 5 ? Math.min(Math.max(src, titleWidthPx), plateCap) : src;
    widths[i] = w;
    titleW += w;
  }

  // Split the remaining output extent between the two halves. A half can only
  // absorb slack if it has at least one stretch cell; an all-fixed half holds
  // its source width and cedes the rest to the other half. So:
  //   • both halves stretch  → even split, title stays centred (e.g. 1138).
  //   • one half is all fixed → it keeps its src width, the title shifts toward
  //     it, and the stretching half fills everything else (e.g. 1990, whose
  //     chain stretch-cells all sit to the RIGHT of a left-third title — an even
  //     split would strand the fixed left half and leave a coverage gap).
  const usable = outExtent - srcStart - titleW;
  const halfInfo = (lo: number, hi: number): { src: number; nStretch: number } => {
    let src = 0, nStretch = 0;
    for (let i = lo; i < hi; i++) {
      const c = cells[i]!;
      // `src` is the half's natural (un-grown) width — what it occupies when it
      // has no grower. A 'zero' (collapsed) cell yields its span, so it adds 0;
      // otherwise the cell holds its src width.
      if (c.cls !== 'zero') src += c.x1 - c.x0;
      if (c.cls === 'grow' || c.cls === 'tile' || c.cls === 'scale') nStretch++;
    }
    return { src, nStretch };
  };
  const L = halfInfo(0, tLo), R = halfInfo(tHi, cells.length);
  let leftDst: number, rightDst: number;
  if (L.nStretch > 0 && R.nStretch === 0) {
    rightDst = Math.min(R.src, usable);
    leftDst = usable - rightDst;
  } else if (R.nStretch > 0 && L.nStretch === 0) {
    leftDst = Math.min(L.src, usable);
    rightDst = usable - leftDst;
  } else {
    leftDst = Math.floor(usable / 2);
    rightDst = usable - leftDst;
  }

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
  titleWidthPx = 0,
): { placed: PlacedCell[]; titleStart: number; titleEnd: number } | null {
  // The recipe's last `at` closes the final cell; it is the src extent the
  // recipe describes (often == cicn extent, sometimes short — we cap fill at
  // the cicn extent and let the far corner sit at the end).
  const lastAt = recipe.reduce((m, s) => Math.max(m, s.at), 0);
  const cells = recipeCells(recipe, lastAt, widgetPresent);
  if (cells.length === 0) return null;

  // Corners are intrinsic to the walk: the LEADING corner is `recipeCells`'
  // first cell `[0, border[0])` (fixed, 1:1); the TRAILING corner is the
  // far-edge cap below (`[lastAt, srcExtent)`, 1:1).

  // The first cell's x0 is the recipe's start offset; the region before it
  // maps 1:1, so output starts there too.
  const srcStart = cells[0]!.x0;
  const dstWidths = distributeSide(cells, geo.outExtent, srcStart, titleWidthPx);

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
  // Fill a dst band from a src band. The 2.3.1 kDEF default blit (`0xfeae`,
  // kdef231-recipe-walk.md Q5) ALWAYS TILES: it repeats the src cell at native
  // size, clipping the final partial tile. There is no scaled CopyBits for
  // ordinary fills (only part code 18 / `0x10320` scales, handled separately).
  // A 1px src band ⇒ a uniform fill; structured fills (camo / pipes) keep their
  // texture. cinf.tileSides does NOT gate this — `0xfeae` tiles regardless.
  const drawFill = (s0: number, s1: number, dPos: number, dLen: number): void => {
    const sLen = s1 - s0;
    if (sLen <= 0 || dLen <= 0) return;
    drawTile(s0, sLen, dPos, dLen);
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

    if (c.cls === 'zero') {
      // collapsed (0x49d6 stretch-verdict): width 0, draws nothing. The span is
      // owned by the separately-drawn widget / absorbed by the growers.
    } else if (c.cls === 'scale') {
      // code 18: a single scaled CopyBits — drawn ONCE, src band → dst band.
      drawStretch(c.x0, srcLen, outPos, dstLen);
    } else if (c.cls === 'fixed') {
      // 1:1 copy, anchored (corners, bezels, and the widgets — close/zoom/shade
      // ride the FIXED title-bar regions, so they're drawn here at native size).
      drawStretch(c.x0, srcLen, outPos, srcLen); // dstLen == srcLen here
    } else {
      // growing fill cell (8/11/12/13/14) AND the title plate (collapse code 5,
      // grown to the measured title width): tile the src band across the dst.
      // For an unexpanded collapse cell dstLen == srcLen, so this is a 1:1 copy.
      drawFill(c.x0, c.x1, outPos, dstLen);
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
  titleRegion: { x: number; w: number; midY?: number };
  /**
   * cicn SOURCE column whose colour is the title-text colour (the cinf
   * textPixel x), or −1 when the window ships no cinf (every corpus scheme).
   * renderWindow.ts uses the declared header text colour in that case.
   */
  titleFillSrcX: number;
  /** Slice-by-slice placement map for the diagnostic inspector. */
  placement: PlacementSlice[];
  /**
   * The grow box (resize control), as a SEPARATE sprite to be stacked ABOVE the
   * content layer — it sits just inside the bottom-right frame corner, over the
   * content, so the frame's bottom/right edge strips stay clean (the chrome
   * buffer is behind the content). renderWindow draws this as a top overlay.
   * Omitted when the window has no grow box.
   */
  growBox?: { buffer: PixelBuffer; x: number; y: number; w: number; h: number } | undefined;
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
  opts: { cinf?: WindowCinf | null; titleWidthPx?: number } = {},
): ComposedChrome {
  const body = windowType.parts['part-0'];
  if (!body) throw new Error('composeWindowChrome: windowType has no part-0 body rect');
  // The template's drawable extent, not its raw resource bounds — a transparent
  // tail past the art is not part of the window (see drawableExtent). For every
  // well-formed frame in the corpus this equals the raw dims (a no-op); it trims
  // only beos's padded active document-window (92→75 wide).
  const { w: drawW, h: drawH } = drawableExtent(cicn);
  const frame = frameFromBody(body.rect, drawW, drawH);

  const fullW = frame.left + contentW + frame.right;
  const fullH = frame.top + contentH + frame.bottom;
  const out = PixelBuffer.alloc(fullW, fullH);

  const cinf = opts.cinf ?? windowType.cinf ?? null;
  const edges = windowType.edges;

  // ── rect-list scan ────────────────────────────────────────────────────────
  // part-0 is the body. The remaining parts are the named widgets (close/zoom/
  // shade) and the title MARKER (a ≤2px-wide rect in the top band = the cinf
  // text-colour line). The kDEF draws the widgets as part of the FIXED title-bar
  // cells (1:1), so we don't carve/stamp them separately — we only need:
  //   • titleMarkerX — the marker column, for the title-text colour fallback.
  //   • widgetPresent — gates the 2/3/4 (gap) vs 15/16/17 (widget cell) codes
  //     (a window that ships widget rects has its named widgets present; the
  //     bundled corpus always does).
  let titleMarkerX = -1;
  let titleMarkerY0 = -1, titleMarkerY1 = -1;
  let hasWidgetRect = false;
  for (const [slug, part] of Object.entries(windowType.parts)) {
    if (slug === 'part-0' || !part.rect) continue;
    const [l, t, r, b] = part.rect;
    if (r <= l || b <= t) continue; // empty rect (e.g. beos part-3 [0,0,0,0])
    if (t < frame.top && r - l <= 2) {
      // The title MARKER: a ≤2px-wide vertical line in the title bar where the kDEF
      // samples the title-text colour (0x5530). The scheme draws it AT the title
      // text, so its column is the colour-sample x AND its y-span is the title
      // text's vertical band — the faithful vertical anchor (see titleRegion.midY).
      if (titleMarkerX < 0) { titleMarkerX = l; titleMarkerY0 = t; titleMarkerY1 = b; }
      continue;
    }
    hasWidgetRect = true;
  }
  const widgetPresent = hasWidgetRect || windowType.parts['part-1'] != null;

  // An edge is composed ONLY if its wnd# ships a side-list. The kDEF draws no
  // segments for a recipe-less side, so neither do we (it leaves that frame band
  // transparent) — e.g. a collapsed window with only a top recipe renders as just
  // its title bar. Every full window type ships all four recipes, so this only
  // affects the collapsed / topless utility types. (No bespoke "fill it anyway"
  // fallback — that was a non-kDEF override, now removed.)
  // Composition order matters at the CORNERS, where two edges' bands overlap.
  // The SIDE edges run the full height (including the title-bar and bottom-bar
  // rows); the TOP and BOTTOM bars span the full width (including the corners).
  // The horizontal bars own the corners, so they are drawn AFTER the sides —
  // otherwise a side edge overdraws the corner with its own 1:1 cicn-corner
  // block, which (e.g. 1984) re-introduces art the top edge had collapsed away.
  let topRes: ReturnType<typeof composeEdge> = null;
  let leftRes: ReturnType<typeof composeEdge> = null;
  let rightRes: ReturnType<typeof composeEdge> = null;
  let botRes: ReturnType<typeof composeEdge> = null;

  // ── left edge ───────────────────────────────────────────────────────────
  if (frame.left > 0 && edges?.left?.length) {
    leftRes = composeEdge(out, cicn, edges.left, {
      edge: 'left', horizontal: false, crossSrc: 0, crossLen: frame.left, crossDst: 0,
      outExtent: fullH, srcExtent: drawH,
    }, widgetPresent);
  }

  // ── right edge ──────────────────────────────────────────────────────────
  if (frame.right > 0 && edges?.right?.length) {
    rightRes = composeEdge(out, cicn, edges.right, {
      edge: 'right', horizontal: false, crossSrc: drawW - frame.right, crossLen: frame.right,
      crossDst: fullW - frame.right, outExtent: fullH, srcExtent: drawH,
    }, widgetPresent);
  }

  // ── top edge (drawn AFTER the sides so the title bar owns the top corners) ─
  if (edges?.top?.length) {
    topRes = composeEdge(out, cicn, edges.top, {
      edge: 'top', horizontal: true, crossSrc: 0, crossLen: frame.top, crossDst: 0,
      outExtent: fullW, srcExtent: drawW,
    }, widgetPresent, opts.titleWidthPx ?? 0);
  }

  // ── bottom edge (drawn AFTER the sides so it owns the bottom corners) ──────
  if (frame.bottom > 0 && edges?.bottom?.length) {
    botRes = composeEdge(out, cicn, edges.bottom, {
      edge: 'bottom', horizontal: true, crossSrc: drawH - frame.bottom, crossLen: frame.bottom,
      crossDst: fullH - frame.bottom, outExtent: fullW, srcExtent: drawW,
    }, widgetPresent);
  }

  // No separate widget pass: the close/zoom/shade widgets fall inside the FIXED
  // title-bar cells and are drawn 1:1 by the edge walk above.

  // ── aggregate the slice placement map (for the diagnostic) ────────────────
  const placement: PlacementSlice[] = [];
  // Grow + tile cells both blit via the kDEF tile path, so they report 'tile';
  // code 18 scales; bezels and collapsed (zero-width) cells report 'collapse';
  // the rest are fixed.
  const modeOf = (cls: CellClass): SliceMode =>
    cls === 'tile' || cls === 'grow' ? 'tile'
      : cls === 'scale' ? 'scale'
      : cls === 'collapse' || cls === 'zero' ? 'collapse'
      : 'fixed';
  const collect = (edge: PlacementSlice['edge'], res: typeof topRes): void => {
    if (!res) return;
    for (const p of res.placed) {
      placement.push({
        edge, code: p.code, role: partRole(p.code), mode: modeOf(p.cls),
        src: edge === 'top' || edge === 'bottom'
          ? { x: p.x0, y: edge === 'top' ? 0 : drawH - frame.bottom, w: p.x1 - p.x0, h: edge === 'top' ? frame.top : frame.bottom }
          : { x: edge === 'left' ? 0 : drawW - frame.right, y: p.x0, w: edge === 'left' ? frame.left : frame.right, h: p.x1 - p.x0 },
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

  const titleRegion = {
    ...(topRes && topRes.titleEnd > topRes.titleStart
      ? { x: topRes.titleStart, w: topRes.titleEnd - topRes.titleStart }
      : { x: 0, w: fullW }),
    // midY: the vertical centre of the title-text marker band, clamped into the
    // title bar. The faithful per-scheme vertical anchor for the title text — for
    // tall ornate bars (e.g. evolution) the text well sits well below the bar's
    // geometric centre, and this follows it. Absent → caller centres in frame.top.
    ...(titleMarkerY1 > titleMarkerY0
      ? { midY: Math.min(frame.top - 1, (titleMarkerY0 + titleMarkerY1) / 2) }
      : {}),
  };
  const titleFillSrcX = cinf?.textPixel ? cinf.textPixel[0] : titleMarkerX;
  return { buffer: out, frame, fullWidth: fullW, fullHeight: fullH, titleRegion, titleFillSrcX, placement };
}
