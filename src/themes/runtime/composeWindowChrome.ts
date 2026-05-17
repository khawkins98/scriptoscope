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
// Currently implements TOP side only. Bottom/left/right are #64.3 scope.

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
