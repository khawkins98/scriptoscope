// wnd# side-recipe chrome composition.
//
// Implements the renderer algorithm from docs/kaleidoscope-geometry-spec.md §3
// "Empirical semantics of recipe parts":
//
//   For each `{at, part}` entry in a side recipe:
//     segCicnStart = entry.at
//     segCicnEnd   = next entry's at, or cicnW for last
//
//     if part is a named part (in windowType.parts):
//       render its rect at NATIVE pixel size, positioned at recipe.at
//     elif part is "8" (universal stretchable fill) OR an unknown code:
//       tile cicn pixels at segment's x-range across segment's rendered width
//
// V1 (PR #65) tried per-segment tiling for ALL parts. V2 distinguishes named
// vs fill parts based on the canonical spec — named parts stay at native size
// so control glyphs (close, zoom, windowshade, divider) don't distort.
//
// Implements all four sides (#64.3). Top + bottom iterate the X axis;
// left + right iterate the Y axis. Same "named at native size at
// recipe.at" / "fill tiles cicn pixels" algorithm in each direction.

import type { WindowTypeEntry, EdgeRecipe, PartEntry } from '../schema/types.js';

const SEGMENT_ATTR = 'data-aaron-chrome-segment' as const;

export interface ComposeWindowChromeOptions {
  /** Native pixel width of the chrome cicn. */
  cicnWidth: number;
  /** Native pixel height of the chrome cicn. */
  cicnHeight: number;
  /** Cicn URL (absolute, post-loadTheme asset resolution). */
  cicnUrl: string;
}

/** Compose the top edge of a window-type chrome onto `titlebar`. */
export function composeTopEdge(
  titlebar: HTMLElement,
  windowType: WindowTypeEntry,
  options: ComposeWindowChromeOptions,
): void {
  clearChromeSegments(titlebar);

  const recipe = windowType.edges?.top;
  if (!recipe || recipe.length === 0) return;

  const { cicnWidth, cicnHeight, cicnUrl } = options;
  if (cicnWidth <= 0 || cicnHeight <= 0) return;

  const namedParts: Record<string, PartEntry> = windowType.parts ?? {};
  const cicnUrlCss = `url("${cicnUrl.replace(/"/g, '\\"')}")`;

  for (let i = 0; i < recipe.length; i++) {
    const entry = recipe[i]!;
    const segCicnStart = entry.at;
    const next = recipe[i + 1];
    const segCicnEnd = next ? next.at : cicnWidth;
    const segCicnWidth = segCicnEnd - segCicnStart;
    if (segCicnWidth <= 0) continue;

    const named: PartEntry | undefined = namedParts[entry.part];
    const div = titlebar.ownerDocument.createElement('div');
    div.setAttribute(SEGMENT_ATTR, 'top');
    div.setAttribute('data-segment-part', entry.part);
    div.style.position = 'absolute';
    div.style.pointerEvents = 'none';
    div.style.imageRendering = 'pixelated';
    div.style.backgroundImage = cicnUrlCss;
    div.style.backgroundSize = `${cicnWidth}px ${cicnHeight}px`;

    if (named) {
      // Named part — render the rect at NATIVE pixel size, positioned at
      // the recipe's `at` value (the "recipe.at is render position"
      // interpretation per spec §3 ambiguity-resolution recommendation).
      const [rectLeft, rectTop, rectRight, rectBottom] = named.rect;
      const rectW = rectRight - rectLeft;
      const rectH = rectBottom - rectTop;
      div.style.left = pct(segCicnStart, cicnWidth);
      div.style.top = pct(rectTop, cicnHeight);
      div.style.width = `${rectW}px`;
      div.style.height = `${rectH}px`;
      // Negative position crops the cicn so only the part's pixel region
      // shows through the native-sized overlay.
      div.style.backgroundPosition = `-${rectLeft}px -${rectTop}px`;
      div.style.backgroundRepeat = 'no-repeat';
      div.style.zIndex = '1'; // named parts paint over fills
    } else {
      // Fill (part 8, or unknown code) — tile cicn pixels at segment's
      // x-range across the segment's rendered width. Full titlebar height.
      div.style.left = pct(segCicnStart, cicnWidth);
      div.style.top = '0';
      div.style.width = pct(segCicnWidth, cicnWidth);
      div.style.height = '100%';
      div.style.backgroundPosition = `-${segCicnStart}px 0px`;
      div.style.backgroundRepeat = 'repeat-x';
      div.style.zIndex = '0';
    }

    titlebar.appendChild(div);
  }
}

/**
 * Compose the BOTTOM edge of a window-type chrome onto `container`.
 *
 * Same algorithm as composeTopEdge but mirrored vertically — the segment
 * background is sampled from the BOTTOM rows of the cicn (so the bottom
 * border decoration shows through). `container` is typically the
 * `.aaron-window__edge--bottom` div positioned at the window's bottom.
 *
 * The container is expected to be a thin horizontal strip; height is set
 * by the caller's CSS (e.g., 2-3px or a derived value).
 */
export function composeBottomEdge(
  container: HTMLElement,
  windowType: WindowTypeEntry,
  options: ComposeWindowChromeOptions,
): void {
  clearChromeSegments(container);
  const recipe = windowType.edges?.bottom;
  if (!recipe || recipe.length === 0) return;

  const { cicnWidth, cicnHeight, cicnUrl } = options;
  if (cicnWidth <= 0 || cicnHeight <= 0) return;

  const namedParts: Record<string, PartEntry> = windowType.parts ?? {};
  const cicnUrlCss = `url("${cicnUrl.replace(/"/g, '\\"')}")`;
  // Bottom strip in cicn-Y space. For schemes with a "bottom border"
  // named part, use its top edge; otherwise default to (cicnHeight - 2)
  // so the strip samples the cicn's bottom-most rows.
  const bottomStripStart = inferBottomStripStart(windowType, cicnHeight);

  for (let i = 0; i < recipe.length; i++) {
    const entry = recipe[i]!;
    const segCicnStart = entry.at;
    const next = recipe[i + 1];
    const segCicnEnd = next ? next.at : cicnWidth;
    const segCicnWidth = segCicnEnd - segCicnStart;
    if (segCicnWidth <= 0) continue;

    const named: PartEntry | undefined = namedParts[entry.part];
    const div = container.ownerDocument.createElement('div');
    div.setAttribute(SEGMENT_ATTR, 'bottom');
    div.setAttribute('data-segment-part', entry.part);
    div.style.position = 'absolute';
    div.style.pointerEvents = 'none';
    div.style.imageRendering = 'pixelated';
    div.style.backgroundImage = cicnUrlCss;
    div.style.backgroundSize = `${cicnWidth}px ${cicnHeight}px`;

    if (named) {
      const [rectLeft, rectTop, rectRight, rectBottom] = named.rect;
      const rectW = rectRight - rectLeft;
      const rectH = rectBottom - rectTop;
      div.style.left = pct(segCicnStart, cicnWidth);
      // Anchor to bottom: position relative to bottom of container so
      // the rect's bottom edge sits at the container's bottom edge.
      div.style.bottom = '0';
      div.style.width = `${rectW}px`;
      div.style.height = `${rectH}px`;
      div.style.backgroundPosition = `-${rectLeft}px -${rectTop}px`;
      div.style.backgroundRepeat = 'no-repeat';
      div.style.zIndex = '1';
    } else {
      // Fill: full container height (the bottom strip), tile horizontally,
      // sample from cicn's bottom rows.
      div.style.left = pct(segCicnStart, cicnWidth);
      div.style.top = '0';
      div.style.width = pct(segCicnWidth, cicnWidth);
      div.style.height = '100%';
      div.style.backgroundPosition = `-${segCicnStart}px -${bottomStripStart}px`;
      div.style.backgroundRepeat = 'repeat-x';
      div.style.zIndex = '0';
    }

    container.appendChild(div);
  }
}

/**
 * Compose the LEFT edge of a window-type chrome onto `container`.
 *
 * Vertical strip down the left side of the window. Recipe `at` values
 * are Y coordinates in cicn space; segments tile vertically (repeat-y).
 */
export function composeLeftEdge(
  container: HTMLElement,
  windowType: WindowTypeEntry,
  options: ComposeWindowChromeOptions,
): void {
  composeVerticalEdge(container, windowType, options, 'left');
}

/**
 * Compose the RIGHT edge of a window-type chrome onto `container`.
 *
 * Mirror of composeLeftEdge — samples from the cicn's right-most columns.
 */
export function composeRightEdge(
  container: HTMLElement,
  windowType: WindowTypeEntry,
  options: ComposeWindowChromeOptions,
): void {
  composeVerticalEdge(container, windowType, options, 'right');
}

function composeVerticalEdge(
  container: HTMLElement,
  windowType: WindowTypeEntry,
  options: ComposeWindowChromeOptions,
  side: 'left' | 'right',
): void {
  clearChromeSegments(container);
  const recipe = windowType.edges?.[side];
  if (!recipe || recipe.length === 0) return;

  const { cicnWidth, cicnHeight, cicnUrl } = options;
  if (cicnWidth <= 0 || cicnHeight <= 0) return;

  const namedParts: Record<string, PartEntry> = windowType.parts ?? {};
  const cicnUrlCss = `url("${cicnUrl.replace(/"/g, '\\"')}")`;
  // Sample column in cicn-X space. Left edge = column 0; right edge =
  // last column. A future refinement could derive a thicker strip if
  // a "side border" named part exists.
  const stripX = side === 'left' ? 0 : Math.max(0, cicnWidth - 1);

  for (let i = 0; i < recipe.length; i++) {
    const entry = recipe[i]!;
    const segCicnStart = entry.at; // Y coordinate
    const next = recipe[i + 1];
    const segCicnEnd = next ? next.at : cicnHeight;
    const segCicnHeight = segCicnEnd - segCicnStart;
    if (segCicnHeight <= 0) continue;

    const named: PartEntry | undefined = namedParts[entry.part];
    const div = container.ownerDocument.createElement('div');
    div.setAttribute(SEGMENT_ATTR, side);
    div.setAttribute('data-segment-part', entry.part);
    div.style.position = 'absolute';
    div.style.pointerEvents = 'none';
    div.style.imageRendering = 'pixelated';
    div.style.backgroundImage = cicnUrlCss;
    div.style.backgroundSize = `${cicnWidth}px ${cicnHeight}px`;

    if (named) {
      const [rectLeft, rectTop, rectRight, rectBottom] = named.rect;
      const rectW = rectRight - rectLeft;
      const rectH = rectBottom - rectTop;
      // Anchor to the appropriate horizontal edge of the container.
      if (side === 'left') div.style.left = '0';
      else div.style.right = '0';
      div.style.top = pct(segCicnStart, cicnHeight);
      div.style.width = `${rectW}px`;
      div.style.height = `${rectH}px`;
      div.style.backgroundPosition = `-${rectLeft}px -${rectTop}px`;
      div.style.backgroundRepeat = 'no-repeat';
      div.style.zIndex = '1';
    } else {
      // Fill: full container width (the side strip), tile vertically,
      // sample from cicn's edge column.
      if (side === 'left') div.style.left = '0';
      else div.style.right = '0';
      div.style.top = pct(segCicnStart, cicnHeight);
      div.style.width = '100%';
      div.style.height = pct(segCicnHeight, cicnHeight);
      div.style.backgroundPosition = `-${stripX}px -${segCicnStart}px`;
      div.style.backgroundRepeat = 'repeat-y';
      div.style.zIndex = '0';
    }

    container.appendChild(div);
  }
}

/**
 * Derive the cicn-Y coordinate where the "bottom strip" begins, used to
 * sample the bottom edge's fill background. Heuristic: if any named part
 * has its rect on the bottom row of the cicn (top within 3px of the
 * bottom), use that top; otherwise default to `cicnHeight - 2`.
 */
function inferBottomStripStart(
  windowType: WindowTypeEntry,
  cicnHeight: number,
): number {
  let best: number | null = null;
  for (const part of Object.values(windowType.parts ?? {})) {
    const [, top, , bottom] = part.rect;
    // Looking for thin horizontal strips near the cicn bottom.
    if (bottom - top <= 3 && top >= cicnHeight - 5) {
      if (best === null || top < best) best = top;
    }
  }
  return best ?? Math.max(0, cicnHeight - 2);
}

/** Remove every segment div this composer added. */
export function clearChromeSegments(container: HTMLElement): void {
  const existing = container.querySelectorAll(`[${SEGMENT_ATTR}]`);
  for (const el of Array.from(existing)) {
    el.parentNode?.removeChild(el);
  }
}

/**
 * Walk a recipe and return its segments as a pure data structure.
 * Useful for tests and for the title-pill detection (#64.2).
 */
export function recipeToSegments(
  recipe: EdgeRecipe[],
  cicnExtent: number,
): { cicnStart: number; cicnEnd: number; partSlug: string }[] {
  const segments: { cicnStart: number; cicnEnd: number; partSlug: string }[] = [];
  for (let i = 0; i < recipe.length; i++) {
    const entry = recipe[i]!;
    const start = entry.at;
    const next = recipe[i + 1];
    const end = next ? next.at : cicnExtent;
    if (end <= start) continue;
    segments.push({ cicnStart: start, cicnEnd: end, partSlug: entry.part });
  }
  return segments;
}

function pct(numerator: number, denominator: number): string {
  return `${Number(((numerator / denominator) * 100).toFixed(4))}%`;
}

/**
 * Find the "title pill" zone in a windowType's top recipe — the segment
 * (or contiguous run of segments) suitable for the window's title text.
 *
 * Algorithm (#64.2):
 *   1. Iterate recipe segments.
 *   2. A segment is a "fill" if its part code is NOT in `windowType.parts`.
 *      Fill segments accept tiling and don't carry decorative geometry.
 *   3. Coalesce adjacent fills into runs (a divider between two fills is
 *      a named part and breaks the run; consecutive fills of different
 *      codes — e.g. part 8 then part 5 — coalesce since both are fillable).
 *   4. Return the widest run as a percentage of cicn width.
 *
 * Returns null if the recipe is empty or has no fill segments.
 *
 * Used by the renderer to constrain the title text to a safe horizontal
 * zone so it doesn't overlap close-box / zoom-box / divider decorations.
 */
export function findTitlePillBounds(
  windowType: WindowTypeEntry,
  cicnWidth: number,
): { leftPct: number; rightPct: number } | null {
  const recipe = windowType.edges?.top;
  if (!recipe || recipe.length === 0 || cicnWidth <= 0) return null;
  const namedParts = windowType.parts ?? {};

  const segments = recipeToSegments(recipe, cicnWidth);

  // Coalesce runs of consecutive fill segments.
  type Run = { start: number; end: number };
  const runs: Run[] = [];
  let cur: Run | null = null;
  for (const seg of segments) {
    const isFill = !(seg.partSlug in namedParts);
    if (isFill) {
      if (cur === null) cur = { start: seg.cicnStart, end: seg.cicnEnd };
      else cur.end = seg.cicnEnd;
    } else if (cur !== null) {
      runs.push(cur);
      cur = null;
    }
  }
  if (cur !== null) runs.push(cur);
  if (runs.length === 0) return null;

  let widest = runs[0]!;
  for (const r of runs) {
    if (r.end - r.start > widest.end - widest.start) widest = r;
  }
  return {
    leftPct: (widest.start / cicnWidth) * 100,
    rightPct: ((cicnWidth - widest.end) / cicnWidth) * 100,
  };
}
