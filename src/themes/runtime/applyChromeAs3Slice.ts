// 3-slice chrome rendering via CSS border-image.
//
// Replaces the per-segment proportional composer (composeWindowChrome.ts)
// after empirical findings that the per-segment approach scatters named
// parts across the titlebar instead of pinning them to corners — the
// Kaleidoscope design intent.
//
// The right rendering for a chrome cicn is a 3-slice template:
//   ┌────────────┬─────────────────────┬────────────┐
//   │ left slice │  middle (tile/stretch) │ right slice │
//   └────────────┴─────────────────────┴────────────┘
//
// - LEFT slice: cicn pixels [0..stretchStart], pinned to titlebar left
//   edge at NATIVE pixel size. Carries the close-box artwork + any
//   left-anchored decoration.
// - MIDDLE: cicn pixels [stretchStart..stretchEnd], tiled or stretched
//   to absorb the slack as the titlebar grows wider than the cicn.
//   This is the "title pill" zone — where the title text sits.
// - RIGHT slice: cicn pixels [stretchEnd..cicnWidth], pinned to right.
//   Carries zoom-box + any right-anchored decoration.
//
// CSS border-image does this natively. We compute the slice values from
// the wnd# recipe's widest fill-segment run (same algorithm as
// findTitlePillBounds) and stamp inline border-image styles on the
// edge element.
//
// Vertical edges (left/right of window) use the same approach with axes
// swapped — top slice + middle stretch + bottom slice down a thin column.

import type { WindowTypeEntry, EdgeRecipe, PartEntry } from '../schema/types.js';

export interface ChromeSliceOptions {
  cicnUrl: string;
  cicnWidth: number;
  cicnHeight: number;
}

const CHROME_3SLICE_ATTR = 'data-aaron-chrome-3slice' as const;

/**
 * Compute the cicn-pixel coordinates of the stretchable middle region
 * for a given recipe. The "middle" is the widest contiguous run of fill
 * segments (recipe entries whose part code is not in `namedParts`).
 *
 * Returns null when the recipe has no fill segments (everything is named)
 * or is empty.
 */
export function computeStretchZone(
  recipe: EdgeRecipe[],
  namedParts: Record<string, PartEntry>,
  cicnExtent: number,
): { start: number; end: number } | null {
  if (recipe.length === 0 || cicnExtent <= 0) return null;

  type Run = { start: number; end: number };
  const runs: Run[] = [];
  let cur: Run | null = null;
  for (let i = 0; i < recipe.length; i++) {
    const entry = recipe[i]!;
    const start = entry.at;
    const next = recipe[i + 1];
    const end = next ? next.at : cicnExtent;
    if (end <= start) continue;
    const isFill = !(entry.part in namedParts);
    if (isFill) {
      if (cur === null) cur = { start, end };
      else cur.end = end;
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
  return widest;
}

/**
 * Apply the chrome cicn as a 3-slice border-image on the TITLEBAR.
 *
 * Geometry:
 *   - border-width: 0 rightSlicePx 0 leftSlicePx  (no top/bottom border)
 *   - border-image-slice: 0 rightSliceCicnPx 0 leftSliceCicnPx fill
 *   - border-image-width: corresponding pixels
 *   - border-image-repeat: round  (tiles the middle without distortion)
 *
 * The `fill` keyword on border-image-slice makes the cicn's center region
 * paint into the element's content box, so the middle stretch zone shows
 * behind the title text.
 *
 * The element MUST have `box-sizing: content-box` or border-style:solid
 * so the border space actually exists. We set both inline.
 */
export function applyTitlebarAs3Slice(
  titlebar: HTMLElement,
  windowType: WindowTypeEntry,
  options: ChromeSliceOptions,
): { leftSlicePx: number; rightSlicePx: number } | null {
  const recipe = windowType.edges?.top;
  if (!recipe || recipe.length === 0) {
    clear3Slice(titlebar);
    return null;
  }
  const { cicnWidth, cicnHeight, cicnUrl } = options;
  if (cicnWidth <= 0 || cicnHeight <= 0) {
    clear3Slice(titlebar);
    return null;
  }

  const stretch = computeStretchZone(recipe, windowType.parts ?? {}, cicnWidth);
  // Fallback when the recipe has no fill — render the whole cicn as the
  // left slice (effectively native-size pinned to left, no tiling). Rare
  // but possible for very minimal recipes.
  const leftSlice = stretch ? stretch.start : Math.floor(cicnWidth / 2);
  const rightSlice = stretch ? cicnWidth - stretch.end : cicnWidth - leftSlice;

  applyBorderImageHorizontal(titlebar, cicnUrl, {
    cicnWidth,
    cicnHeight,
    leftSlice,
    rightSlice,
  });
  return { leftSlicePx: leftSlice, rightSlicePx: rightSlice };
}

/**
 * Apply the chrome cicn as a 3-slice border-image on the BOTTOM edge
 * container. Same horizontal slicing as titlebar; the cicn's bottom
 * rows show through the border-image's CENTER fill.
 *
 * The bottom edge container is typically a thin horizontal strip
 * (e.g., 3-6px); we render the full cicn into it via border-image and
 * let overflow:hidden clip to just the bottom portion. To position the
 * relevant cicn rows correctly, the container's height + the border
 * widths together must align with the cicn aspect ratio.
 *
 * Pragmatic approach: render the cicn at a "bottom strip height" equal
 * to (cicnHeight - bottomStripStart), so the container shows just the
 * cicn's bottom rows.
 */
export function applyBottomEdgeAs3Slice(
  container: HTMLElement,
  windowType: WindowTypeEntry,
  options: ChromeSliceOptions,
): void {
  const recipe = windowType.edges?.bottom;
  if (!recipe || recipe.length === 0) {
    clear3Slice(container);
    return;
  }
  const { cicnWidth, cicnHeight, cicnUrl } = options;
  if (cicnWidth <= 0 || cicnHeight <= 0) {
    clear3Slice(container);
    return;
  }

  const stretch = computeStretchZone(recipe, windowType.parts ?? {}, cicnWidth);
  const leftSlice = stretch ? stretch.start : Math.floor(cicnWidth / 2);
  const rightSlice = stretch ? cicnWidth - stretch.end : cicnWidth - leftSlice;

  // For the bottom edge container, we want to display only the cicn's
  // BOTTOM rows. We use a CSS trick: set background-image on a child
  // element that's positioned to align the cicn's bottom edge with the
  // container's bottom edge.
  //
  // Three child divs handle the 3-slice: left corner, middle tile, right
  // corner. All three use the same cicn URL, sized to native (cicnW ×
  // cicnH), positioned so that the bottom rows align with the container.
  applyHorizontalStripFromCicnBottom(container, cicnUrl, {
    cicnWidth,
    cicnHeight,
    leftSlice,
    rightSlice,
  });
}

/**
 * Apply the chrome cicn as a 3-slice vertical strip on the LEFT or RIGHT
 * edge container. The container is a thin vertical strip; the cicn's
 * leftmost (or rightmost) columns show through.
 */
export function applyVerticalEdgeAs3Slice(
  container: HTMLElement,
  windowType: WindowTypeEntry,
  options: ChromeSliceOptions,
  side: 'left' | 'right',
): void {
  const recipe = windowType.edges?.[side];
  if (!recipe || recipe.length === 0) {
    clear3Slice(container);
    return;
  }
  const { cicnWidth, cicnHeight, cicnUrl } = options;
  if (cicnWidth <= 0 || cicnHeight <= 0) {
    clear3Slice(container);
    return;
  }

  const stretch = computeStretchZone(recipe, windowType.parts ?? {}, cicnHeight);
  // For sparse side recipes, fall back to a small top + bottom slice so
  // the middle can absorb most of the side.
  const topSlice = stretch ? stretch.start : Math.min(2, Math.floor(cicnHeight / 4));
  const bottomSlice = stretch
    ? cicnHeight - stretch.end
    : Math.min(2, Math.floor(cicnHeight / 4));

  applyVerticalStripFromCicnEdge(container, cicnUrl, {
    cicnWidth,
    cicnHeight,
    topSlice,
    bottomSlice,
    side,
  });
}

function applyBorderImageHorizontal(
  el: HTMLElement,
  cicnUrl: string,
  cfg: { cicnWidth: number; cicnHeight: number; leftSlice: number; rightSlice: number },
): void {
  clear3Slice(el);
  el.setAttribute(CHROME_3SLICE_ATTR, 'top');
  const { cicnUrl: _u } = { cicnUrl };
  void _u;
  // Set CSS — using `box-sizing: border-box` so the border eats into the
  // visible element size rather than expanding it.
  const cicnUrlCss = `url("${cicnUrl.replace(/"/g, '\\"')}")`;
  el.style.boxSizing = 'border-box';
  el.style.borderStyle = 'solid';
  el.style.borderColor = 'transparent';
  el.style.borderTopWidth = '0';
  el.style.borderBottomWidth = '0';
  el.style.borderLeftWidth = `${cfg.leftSlice}px`;
  el.style.borderRightWidth = `${cfg.rightSlice}px`;
  el.style.borderImageSource = cicnUrlCss;
  el.style.borderImageSlice = `0 ${cfg.rightSlice} 0 ${cfg.leftSlice} fill`;
  el.style.borderImageWidth = `0 ${cfg.rightSlice}px 0 ${cfg.leftSlice}px`;
  // `round` tiles whole-number copies of the middle slice and resizes them
  // slightly so they fit. `repeat` tiles with possible partial cuts at the
  // ends. `stretch` distorts. For period chrome the natural answer is to
  // tile — pinstripes look fine tiled, distorted ones look weird.
  el.style.borderImageRepeat = 'round';
  // image-rendering: pixelated preserves the crisp 1-bit appearance of
  // classic Mac chrome — without it, browsers smooth the cicn upscale and
  // it looks blurry. Targets the source image rendering.
  el.style.imageRendering = 'pixelated';
}

/**
 * Render a horizontal strip from the cicn's bottom rows using 3 inner
 * absolutely-positioned divs. border-image doesn't help here because the
 * container is only ~3-6px tall (much smaller than the cicn's 25px), and
 * we want to show ONLY the cicn's bottom strip — not the entire cicn
 * scaled into a thin border-image.
 */
function applyHorizontalStripFromCicnBottom(
  container: HTMLElement,
  cicnUrl: string,
  cfg: { cicnWidth: number; cicnHeight: number; leftSlice: number; rightSlice: number },
): void {
  clear3Slice(container);
  container.setAttribute(CHROME_3SLICE_ATTR, 'bottom');
  const cicnUrlCss = `url("${cicnUrl.replace(/"/g, '\\"')}")`;
  // Bottom strip thickness: from container CSS (e.g., 3px). The cicn rows
  // that show are (cicnHeight - container.clientHeight)..cicnHeight. We
  // align via background-position: 0 (cicnHeight - stripH) using inline
  // styles per-segment, but since strip height comes from CSS we use
  // background-position-y: bottom.
  const baseStyle = (el: HTMLElement): void => {
    el.style.position = 'absolute';
    el.style.top = '0';
    el.style.bottom = '0';
    el.style.backgroundImage = cicnUrlCss;
    el.style.backgroundSize = `${cfg.cicnWidth}px ${cfg.cicnHeight}px`;
    el.style.backgroundPositionY = 'bottom';
    el.style.imageRendering = 'pixelated';
    el.style.pointerEvents = 'none';
  };
  const left = container.ownerDocument.createElement('div');
  left.setAttribute('data-3slice-piece', 'left');
  baseStyle(left);
  left.style.left = '0';
  left.style.width = `${cfg.leftSlice}px`;
  left.style.backgroundPositionX = '0';
  left.style.backgroundRepeat = 'no-repeat';
  container.appendChild(left);

  const middle = container.ownerDocument.createElement('div');
  middle.setAttribute('data-3slice-piece', 'middle');
  baseStyle(middle);
  middle.style.left = `${cfg.leftSlice}px`;
  middle.style.right = `${cfg.rightSlice}px`;
  // Position the cicn so its stretch-zone start aligns with this div's left.
  middle.style.backgroundPositionX = `-${cfg.leftSlice}px`;
  middle.style.backgroundRepeat = 'repeat-x';
  container.appendChild(middle);

  const right = container.ownerDocument.createElement('div');
  right.setAttribute('data-3slice-piece', 'right');
  baseStyle(right);
  right.style.right = '0';
  right.style.width = `${cfg.rightSlice}px`;
  right.style.backgroundPositionX = `-${cfg.cicnWidth - cfg.rightSlice}px`;
  right.style.backgroundRepeat = 'no-repeat';
  container.appendChild(right);
}

/**
 * Render a vertical strip from the cicn's left or right columns using
 * 3 inner divs (top corner / middle tile / bottom corner). Symmetric to
 * the bottom-strip helper.
 */
function applyVerticalStripFromCicnEdge(
  container: HTMLElement,
  cicnUrl: string,
  cfg: {
    cicnWidth: number;
    cicnHeight: number;
    topSlice: number;
    bottomSlice: number;
    side: 'left' | 'right';
  },
): void {
  clear3Slice(container);
  container.setAttribute(CHROME_3SLICE_ATTR, cfg.side);
  const cicnUrlCss = `url("${cicnUrl.replace(/"/g, '\\"')}")`;
  const bgX = cfg.side === 'left' ? '0' : `-${cfg.cicnWidth - 1}px`;
  // Sample 1 column wide for sides — schemes vary, but 1px is the
  // conservative default. The container's CSS width controls visible
  // thickness; the strip just repeats this single sampled column.
  const baseStyle = (el: HTMLElement): void => {
    el.style.position = 'absolute';
    el.style.left = '0';
    el.style.right = '0';
    el.style.backgroundImage = cicnUrlCss;
    el.style.backgroundSize = `${cfg.cicnWidth}px ${cfg.cicnHeight}px`;
    el.style.backgroundPositionX = bgX;
    el.style.imageRendering = 'pixelated';
    el.style.pointerEvents = 'none';
  };
  const top = container.ownerDocument.createElement('div');
  top.setAttribute('data-3slice-piece', 'top');
  baseStyle(top);
  top.style.top = '0';
  top.style.height = `${cfg.topSlice}px`;
  top.style.backgroundPositionY = '0';
  top.style.backgroundRepeat = 'no-repeat';
  container.appendChild(top);

  const middle = container.ownerDocument.createElement('div');
  middle.setAttribute('data-3slice-piece', 'middle');
  baseStyle(middle);
  middle.style.top = `${cfg.topSlice}px`;
  middle.style.bottom = `${cfg.bottomSlice}px`;
  middle.style.backgroundPositionY = `-${cfg.topSlice}px`;
  middle.style.backgroundRepeat = 'repeat-y';
  container.appendChild(middle);

  const bottom = container.ownerDocument.createElement('div');
  bottom.setAttribute('data-3slice-piece', 'bottom');
  baseStyle(bottom);
  bottom.style.bottom = '0';
  bottom.style.height = `${cfg.bottomSlice}px`;
  bottom.style.backgroundPositionY = `-${cfg.cicnHeight - cfg.bottomSlice}px`;
  bottom.style.backgroundRepeat = 'no-repeat';
  container.appendChild(bottom);
}

/** Clear 3-slice rendering from an element: remove inline border styles
 *  and any inner 3-slice piece divs. */
export function clear3Slice(el: HTMLElement): void {
  el.removeAttribute(CHROME_3SLICE_ATTR);
  // Border styles (titlebar path).
  for (const prop of [
    'borderStyle', 'borderColor',
    'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
    'borderImageSource', 'borderImageSlice', 'borderImageWidth', 'borderImageRepeat',
  ] as const) {
    el.style[prop] = '';
  }
  // Inner pieces (bottom/left/right paths).
  for (const piece of Array.from(el.querySelectorAll('[data-3slice-piece]'))) {
    piece.parentNode?.removeChild(piece);
  }
}
