// Recipe-driven per-segment chrome composer — what Kaleidoscope itself
// did. Replaces the CSS border-image shortcut for the top edge with a
// faithful walk of wnd#.edges.top + parts rects.
//
// Per docs/kaleidoscope-geometry-spec.md §3 and the chrome-rendering-
// architecture doc:
//
//   For each {at, part} entry in the recipe:
//     - If `part` is in windowType.parts (a NAMED part):
//         Cut the part's cicn rect at native pixel size.
//         Paint at PIXEL position `at` from the appropriate side edge:
//           - cicn center.x < cicnWidth/2 → anchor LEFT
//           - else                       → anchor RIGHT
//     - If `part` is unknown (a FILL — typically part-8):
//         Sample cicn pixels in [at_i, at_{i+1}] × [0, cicnHeight]
//         and tile horizontally between adjacent named parts.
//
// Key correction over PR #65/#68 V1/V2: those used PROPORTIONAL
// positioning (`left: X%`). As windows grew, close-boxes drifted
// inward. The fix is pixel-anchored positioning from the matching
// screen edge — close stays pinned to left, zoom pinned to right,
// middle fills absorb the slack.

import type { WindowTypeEntry } from '../schema/types.js';

const SEGMENT_ATTR = 'data-aaron-recipe-segment' as const;

export interface ComposeRecipeOptions {
  cicnUrl: string;
  cicnWidth: number;
  cicnHeight: number;
}

interface NamedPlacement {
  /** Recipe `at` value (cicn-pixel position along the side axis). */
  at: number;
  /** Part rect [left, top, right, bottom] in cicn pixels. */
  rect: [number, number, number, number];
  /** Anchor side: left/right for horizontal edges. */
  anchor: 'left' | 'right';
  /** Pixel offset from the anchor side. */
  offsetPx: number;
  /** Native rendered width (rect right - left). */
  width: number;
  /** Native rendered height (rect bottom - top). */
  height: number;
}

/**
 * Compose the TOP edge of a window-type's chrome onto `titlebar`,
 * driven by the wnd# recipe. Replaces composeTopEdge from PR #68 +
 * the border-image shortcuts from PRs #87/#90.
 */
export interface TopRecipeResult {
  /** True if the recipe was rendered. */
  applied: boolean;
  /** Pixel offset from titlebar's left for the title pill, or null. */
  titlePillLeftPx: number | null;
  /** Pixel offset from titlebar's right for the title pill, or null. */
  titlePillRightPx: number | null;
}

const EMPTY_RESULT: TopRecipeResult = { applied: false, titlePillLeftPx: null, titlePillRightPx: null };

export function composeTopRecipe(
  titlebar: HTMLElement,
  windowType: WindowTypeEntry,
  options: ComposeRecipeOptions,
): TopRecipeResult {
  clearRecipeSegments(titlebar);
  const recipe = windowType.edges?.top;
  if (!recipe || recipe.length === 0) return EMPTY_RESULT;
  const { cicnWidth, cicnHeight, cicnUrl } = options;
  if (cicnWidth <= 0 || cicnHeight <= 0) return EMPTY_RESULT;

  const namedParts = windowType.parts ?? {};
  const halfW = cicnWidth / 2;

  // First pass: identify named placements (with their pixel anchors).
  const namedPlacements: NamedPlacement[] = [];
  for (const entry of recipe) {
    const part = namedParts[entry.part];
    if (!part) continue;
    const [rl, rt, rr, rb] = part.rect;
    const centerX = (rl + rr) / 2;
    const anchor: 'left' | 'right' = centerX < halfW ? 'left' : 'right';
    const partWidth = rr - rl;
    namedPlacements.push({
      at: entry.at,
      rect: [rl, rt, rr, rb],
      anchor,
      offsetPx: anchor === 'left' ? entry.at : Math.max(0, cicnWidth - entry.at - partWidth),
      width: partWidth,
      height: rb - rt,
    });
  }

  // If the recipe has no named parts, treat the whole top edge as one
  // big fill — render the cicn as a horizontally-tiled background.
  if (namedPlacements.length === 0) {
    appendFill(titlebar, cicnUrl, cicnWidth, cicnHeight, 0, cicnWidth, 'top');
    return { applied: true, titlePillLeftPx: 0, titlePillRightPx: 0 };
  }

  // Sort named placements by left-anchored screen offset, then by
  // right-anchored offset from end — this gives us the visual order
  // along the titlebar.
  const leftAnchored = namedPlacements
    .filter((p) => p.anchor === 'left')
    .sort((a, b) => a.offsetPx - b.offsetPx);
  const rightAnchored = namedPlacements
    .filter((p) => p.anchor === 'right')
    .sort((a, b) => b.offsetPx - a.offsetPx); // smallest right-offset = rightmost in screen

  // Cicn-pixel span of left-anchored cluster: from cicn-0 to the
  // rightmost left-anchored named part's right edge.
  let leftClusterCicnEnd = 0;
  for (const p of leftAnchored) {
    leftClusterCicnEnd = Math.max(leftClusterCicnEnd, p.at + p.width);
  }
  // Cicn-pixel span of right-anchored cluster: from the leftmost
  // right-anchored named part's left edge to cicn end.
  let rightClusterCicnStart = cicnWidth;
  for (const p of rightAnchored) {
    rightClusterCicnStart = Math.min(rightClusterCicnStart, p.at);
  }

  // Render named placements with their pixel anchors.
  for (const p of namedPlacements) {
    appendNamedPart(titlebar, cicnUrl, cicnWidth, cicnHeight, p, 'top');
  }

  // The middle fill spans from leftClusterCicnEnd to rightClusterCicnStart
  // in cicn space → on the rendered titlebar, from leftClusterCicnEnd
  // pixels (from left) to rightClusterCicnEnd cicn-distance (from right
  // mirror = cicnWidth - rightClusterCicnStart).
  const middleFillCicnStart = leftClusterCicnEnd;
  const middleFillCicnEnd = rightClusterCicnStart;
  if (middleFillCicnEnd > middleFillCicnStart) {
    appendMiddleFill(
      titlebar, cicnUrl, cicnWidth, cicnHeight,
      middleFillCicnStart, middleFillCicnEnd, 'top',
    );
  }

  // Title pill bounds = the middle fill zone in titlebar-pixel space.
  // (Same semantics as the old findTitlePillBounds — the title text
  // sits in this zone, between the left-anchored and right-anchored
  // named-part clusters.)
  return {
    applied: true,
    titlePillLeftPx: leftClusterCicnEnd,
    titlePillRightPx: Math.max(0, cicnWidth - rightClusterCicnStart),
  };
}

function appendNamedPart(
  container: HTMLElement,
  cicnUrl: string,
  cicnWidth: number,
  cicnHeight: number,
  p: NamedPlacement,
  side: 'top' | 'bottom' | 'left' | 'right',
): void {
  const div = container.ownerDocument.createElement('div');
  div.setAttribute(SEGMENT_ATTR, `${side}-named`);
  div.style.position = 'absolute';
  div.style.pointerEvents = 'none';
  div.style.imageRendering = 'pixelated';
  if (p.anchor === 'left') {
    div.style.left = `${p.offsetPx}px`;
  } else {
    div.style.right = `${p.offsetPx}px`;
  }
  if (side === 'top') div.style.top = `${p.rect[1]}px`;
  else if (side === 'bottom') div.style.bottom = `${cicnHeight - p.rect[3]}px`;
  div.style.width = `${p.width}px`;
  div.style.height = `${p.height}px`;
  div.style.backgroundImage = `url("${cicnUrl.replace(/"/g, '\\"')}")`;
  div.style.backgroundSize = `${cicnWidth}px ${cicnHeight}px`;
  // Negative bg-position so the rect's pixels show through the
  // native-sized div.
  div.style.backgroundPosition = `-${p.rect[0]}px -${p.rect[1]}px`;
  div.style.backgroundRepeat = 'no-repeat';
  div.style.zIndex = '2';
  container.appendChild(div);
}

function appendFill(
  container: HTMLElement,
  cicnUrl: string,
  cicnWidth: number,
  cicnHeight: number,
  cicnStart: number,
  _cicnEnd: number,
  side: 'top' | 'bottom' | 'left' | 'right',
): void {
  const div = container.ownerDocument.createElement('div');
  div.setAttribute(SEGMENT_ATTR, `${side}-fill`);
  div.style.position = 'absolute';
  div.style.pointerEvents = 'none';
  div.style.imageRendering = 'pixelated';
  div.style.left = '0';
  div.style.right = '0';
  if (side === 'top') {
    div.style.top = '0';
    div.style.height = `${cicnHeight}px`;
  } else if (side === 'bottom') {
    div.style.bottom = '0';
    div.style.height = `${cicnHeight}px`;
  }
  div.style.backgroundImage = `url("${cicnUrl.replace(/"/g, '\\"')}")`;
  div.style.backgroundSize = `${cicnWidth}px ${cicnHeight}px`;
  div.style.backgroundPosition = `-${cicnStart}px 0px`;
  div.style.backgroundRepeat = 'repeat-x';
  div.style.zIndex = '1';
  container.appendChild(div);
}

function appendMiddleFill(
  container: HTMLElement,
  cicnUrl: string,
  cicnWidth: number,
  cicnHeight: number,
  cicnStart: number,
  cicnEnd: number,
  side: 'top' | 'bottom' | 'left' | 'right',
): void {
  const div = container.ownerDocument.createElement('div');
  div.setAttribute(SEGMENT_ATTR, `${side}-middle-fill`);
  div.style.position = 'absolute';
  div.style.pointerEvents = 'none';
  div.style.imageRendering = 'pixelated';
  // The middle fill stretches between the left and right named-part
  // clusters. Pin its left at cicnStart px from container left, and
  // its right at (cicnWidth - cicnEnd) px from container right.
  div.style.left = `${cicnStart}px`;
  div.style.right = `${cicnWidth - cicnEnd}px`;
  if (side === 'top') {
    div.style.top = '0';
    div.style.height = `${cicnHeight}px`;
  } else if (side === 'bottom') {
    div.style.bottom = '0';
    div.style.height = `${cicnHeight}px`;
  }
  div.style.backgroundImage = `url("${cicnUrl.replace(/"/g, '\\"')}")`;
  div.style.backgroundSize = `${cicnWidth}px ${cicnHeight}px`;
  // Sample cicn pixels at the fill segment's X range, tiled.
  div.style.backgroundPosition = `-${cicnStart}px 0px`;
  div.style.backgroundRepeat = 'repeat-x';
  div.style.zIndex = '1';
  container.appendChild(div);
}

/**
 * Compose the BOTTOM edge — mirror of composeTopRecipe with vertical
 * positioning flipped (named parts anchor to container bottom; fills
 * sample from the cicn's bottom rows so the bottom strip's frame line
 * shows in the rendered bottom edge container).
 *
 * Same horizontal anchoring logic for named parts: left-half cicn →
 * anchor LEFT, right-half → anchor RIGHT.
 */
export function composeBottomRecipe(
  container: HTMLElement,
  windowType: WindowTypeEntry,
  options: ComposeRecipeOptions,
): { applied: boolean } {
  clearRecipeSegments(container);
  const recipe = windowType.edges?.bottom;
  if (!recipe || recipe.length === 0) return { applied: false };
  const { cicnWidth, cicnHeight, cicnUrl } = options;
  if (cicnWidth <= 0 || cicnHeight <= 0) return { applied: false };

  const namedParts = windowType.parts ?? {};
  const halfW = cicnWidth / 2;

  const namedPlacements: NamedPlacement[] = [];
  for (const entry of recipe) {
    const part = namedParts[entry.part];
    if (!part) continue;
    const [rl, rt, rr, rb] = part.rect;
    const centerX = (rl + rr) / 2;
    const anchor: 'left' | 'right' = centerX < halfW ? 'left' : 'right';
    const partWidth = rr - rl;
    namedPlacements.push({
      at: entry.at,
      rect: [rl, rt, rr, rb],
      anchor,
      offsetPx: anchor === 'left' ? entry.at : Math.max(0, cicnWidth - entry.at - partWidth),
      width: partWidth,
      height: rb - rt,
    });
  }

  if (namedPlacements.length === 0) {
    // Full-edge fill — bottom strip of cicn tiled across container.
    appendBottomStripFill(container, cicnUrl, cicnWidth, cicnHeight, 0, cicnWidth);
    return { applied: true };
  }

  let leftClusterCicnEnd = 0;
  for (const p of namedPlacements.filter((p) => p.anchor === 'left')) {
    leftClusterCicnEnd = Math.max(leftClusterCicnEnd, p.at + p.width);
  }
  let rightClusterCicnStart = cicnWidth;
  for (const p of namedPlacements.filter((p) => p.anchor === 'right')) {
    rightClusterCicnStart = Math.min(rightClusterCicnStart, p.at);
  }

  for (const p of namedPlacements) {
    appendNamedPart(container, cicnUrl, cicnWidth, cicnHeight, p, 'bottom');
  }
  if (rightClusterCicnStart > leftClusterCicnEnd) {
    appendBottomStripMiddleFill(
      container, cicnUrl, cicnWidth, cicnHeight,
      leftClusterCicnEnd, rightClusterCicnStart,
    );
  }
  return { applied: true };
}

function appendBottomStripFill(
  container: HTMLElement,
  cicnUrl: string,
  cicnWidth: number,
  cicnHeight: number,
  cicnStart: number,
  _cicnEnd: number,
): void {
  const div = container.ownerDocument.createElement('div');
  div.setAttribute(SEGMENT_ATTR, 'bottom-fill');
  div.style.position = 'absolute';
  div.style.left = '0';
  div.style.right = '0';
  div.style.top = '0';
  div.style.bottom = '0';
  div.style.backgroundImage = `url("${cicnUrl.replace(/"/g, '\\"')}")`;
  div.style.backgroundSize = `${cicnWidth}px ${cicnHeight}px`;
  // Align the cicn so its BOTTOM aligns with the container's bottom
  // (we want to sample cicn's bottom rows, not its top).
  div.style.backgroundPosition = `-${cicnStart}px bottom`;
  div.style.backgroundRepeat = 'repeat-x';
  div.style.imageRendering = 'pixelated';
  div.style.pointerEvents = 'none';
  div.style.zIndex = '1';
  container.appendChild(div);
}

function appendBottomStripMiddleFill(
  container: HTMLElement,
  cicnUrl: string,
  cicnWidth: number,
  cicnHeight: number,
  cicnStart: number,
  cicnEnd: number,
): void {
  const div = container.ownerDocument.createElement('div');
  div.setAttribute(SEGMENT_ATTR, 'bottom-middle-fill');
  div.style.position = 'absolute';
  div.style.left = `${cicnStart}px`;
  div.style.right = `${cicnWidth - cicnEnd}px`;
  div.style.top = '0';
  div.style.bottom = '0';
  div.style.backgroundImage = `url("${cicnUrl.replace(/"/g, '\\"')}")`;
  div.style.backgroundSize = `${cicnWidth}px ${cicnHeight}px`;
  div.style.backgroundPosition = `-${cicnStart}px bottom`;
  div.style.backgroundRepeat = 'repeat-x';
  div.style.imageRendering = 'pixelated';
  div.style.pointerEvents = 'none';
  div.style.zIndex = '1';
  container.appendChild(div);
}

/**
 * Compose a VERTICAL edge (left or right) of a windowType's chrome.
 *
 * Mirror of composeTopRecipe with axes swapped: the recipe `at` values
 * are Y coordinates in cicn space (positions down the side, not across
 * the top). Named parts anchor to TOP / BOTTOM of the container based
 * on cicn-Y half. Fills tile vertically (repeat-y), sampling cicn's
 * leftmost or rightmost columns depending on the side.
 *
 * Container is the [data-aaron-edge="left"|"right"] strip; consumer
 * CSS sizes it (width = --aaron-frame-{left,right}-px derived from
 * cicn at runtime).
 */
export function composeSideRecipe(
  container: HTMLElement,
  windowType: WindowTypeEntry,
  options: ComposeRecipeOptions,
  side: 'left' | 'right',
): { applied: boolean } {
  clearRecipeSegments(container);
  const recipe = windowType.edges?.[side];
  if (!recipe || recipe.length === 0) return { applied: false };
  const { cicnWidth, cicnHeight, cicnUrl } = options;
  if (cicnWidth <= 0 || cicnHeight <= 0) return { applied: false };

  const namedParts = windowType.parts ?? {};
  const halfH = cicnHeight / 2;

  // For vertical edges, named parts are placed at recipe.at (Y coord)
  // and anchored TOP / BOTTOM based on which half of cicn-Y their rect
  // sits in. The horizontal alignment is to the container's LEFT (for
  // left edge) or RIGHT (for right edge) — i.e., the part renders flush
  // with the visible side of the window.
  interface VerticalPlacement {
    at: number;
    rect: [number, number, number, number];
    anchor: 'top' | 'bottom';
    offsetPx: number;
    width: number;
    height: number;
  }
  const placements: VerticalPlacement[] = [];
  for (const entry of recipe) {
    const part = namedParts[entry.part];
    if (!part) continue;
    const [rl, rt, rr, rb] = part.rect;
    const centerY = (rt + rb) / 2;
    const anchor: 'top' | 'bottom' = centerY < halfH ? 'top' : 'bottom';
    const partHeight = rb - rt;
    placements.push({
      at: entry.at,
      rect: [rl, rt, rr, rb],
      anchor,
      offsetPx: anchor === 'top' ? entry.at : Math.max(0, cicnHeight - entry.at - partHeight),
      width: rr - rl,
      height: partHeight,
    });
  }

  if (placements.length === 0) {
    // Full-edge fill — tile cicn's edge column vertically.
    appendSideFill(container, cicnUrl, cicnWidth, cicnHeight, 0, cicnHeight, side);
    return { applied: true };
  }

  let topClusterEnd = 0;
  for (const p of placements.filter((p) => p.anchor === 'top')) {
    topClusterEnd = Math.max(topClusterEnd, p.at + p.height);
  }
  let bottomClusterStart = cicnHeight;
  for (const p of placements.filter((p) => p.anchor === 'bottom')) {
    bottomClusterStart = Math.min(bottomClusterStart, p.at);
  }

  for (const p of placements) {
    const div = container.ownerDocument.createElement('div');
    div.setAttribute(SEGMENT_ATTR, `${side}-named`);
    div.style.position = 'absolute';
    div.style.pointerEvents = 'none';
    div.style.imageRendering = 'pixelated';
    if (side === 'left') div.style.left = '0';
    else div.style.right = '0';
    if (p.anchor === 'top') div.style.top = `${p.offsetPx}px`;
    else div.style.bottom = `${p.offsetPx}px`;
    div.style.width = `${p.width}px`;
    div.style.height = `${p.height}px`;
    div.style.backgroundImage = `url("${cicnUrl.replace(/"/g, '\\"')}")`;
    div.style.backgroundSize = `${cicnWidth}px ${cicnHeight}px`;
    div.style.backgroundPosition = `-${p.rect[0]}px -${p.rect[1]}px`;
    div.style.backgroundRepeat = 'no-repeat';
    div.style.zIndex = '2';
    container.appendChild(div);
  }

  if (bottomClusterStart > topClusterEnd) {
    appendSideMiddleFill(
      container, cicnUrl, cicnWidth, cicnHeight,
      topClusterEnd, bottomClusterStart, side,
    );
  }
  return { applied: true };
}

function appendSideFill(
  container: HTMLElement,
  cicnUrl: string,
  cicnWidth: number,
  cicnHeight: number,
  cicnStart: number,
  _cicnEnd: number,
  side: 'left' | 'right',
): void {
  const div = container.ownerDocument.createElement('div');
  div.setAttribute(SEGMENT_ATTR, `${side}-fill`);
  div.style.position = 'absolute';
  div.style.top = '0';
  div.style.bottom = '0';
  if (side === 'left') div.style.left = '0';
  else div.style.right = '0';
  // Full container width (the side strip), sample full cicn height
  // tiled vertically.
  div.style.width = '100%';
  div.style.backgroundImage = `url("${cicnUrl.replace(/"/g, '\\"')}")`;
  div.style.backgroundSize = `${cicnWidth}px ${cicnHeight}px`;
  // Sample the appropriate edge column.
  const xPos = side === 'left' ? '0' : `-${cicnWidth - 1}px`;
  div.style.backgroundPosition = `${xPos} -${cicnStart}px`;
  div.style.backgroundRepeat = 'repeat-y';
  div.style.imageRendering = 'pixelated';
  div.style.pointerEvents = 'none';
  div.style.zIndex = '1';
  container.appendChild(div);
}

function appendSideMiddleFill(
  container: HTMLElement,
  cicnUrl: string,
  cicnWidth: number,
  cicnHeight: number,
  cicnStart: number,
  cicnEnd: number,
  side: 'left' | 'right',
): void {
  const div = container.ownerDocument.createElement('div');
  div.setAttribute(SEGMENT_ATTR, `${side}-middle-fill`);
  div.style.position = 'absolute';
  if (side === 'left') div.style.left = '0';
  else div.style.right = '0';
  div.style.width = '100%';
  // The middle fill stretches between top and bottom clusters in
  // cicn-Y space. Pin its top + bottom in container Y pixels.
  div.style.top = `${cicnStart}px`;
  div.style.bottom = `${cicnHeight - cicnEnd}px`;
  div.style.backgroundImage = `url("${cicnUrl.replace(/"/g, '\\"')}")`;
  div.style.backgroundSize = `${cicnWidth}px ${cicnHeight}px`;
  const xPos = side === 'left' ? '0' : `-${cicnWidth - 1}px`;
  div.style.backgroundPosition = `${xPos} -${cicnStart}px`;
  div.style.backgroundRepeat = 'repeat-y';
  div.style.imageRendering = 'pixelated';
  div.style.pointerEvents = 'none';
  div.style.zIndex = '1';
  container.appendChild(div);
}

export function clearRecipeSegments(container: HTMLElement): void {
  const existing = container.querySelectorAll(`[${SEGMENT_ATTR}]`);
  for (const el of Array.from(existing)) {
    el.parentNode?.removeChild(el);
  }
}
