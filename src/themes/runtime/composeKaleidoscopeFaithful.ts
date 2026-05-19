// Kaleidoscope-faithful per-segment chrome composer.
//
// Period principle (user clarified 2026-05-19): classic Mac OS chrome was
// always bitblt-tiled at native pixel size — QuickDraw stretching was both
// slow and visually wrong for the bitmap-authoring style of the era. Every
// segment of every edge is either:
//   a) ONE-OFF — drawn once at native cicn-pixel size, anchored to its
//      position in the flex layout (corners, named widgets, divider
//      decoration, parts-table-overlapping statics)
//   b) REPEATING FILL — the cicn slice tiles at native pixel size to fill
//      whatever rendered width flex hands the segment. May show a partial
//      tile at the trailing edge; that's the period-correct artifact.
//
// NEVER stretches. `border-image-repeat: repeat` (not `round`/`stretch`)
// is the critical CSS — it tiles at native source size, accepting partial
// tiles at the edge rather than scaling.
//
// Model:
//   - One edge strip per side (top/right/bottom/left) absolutely positioned
//     on the window root
//   - Each strip is a flexbox of segment divs derived from the wnd# recipe
//   - Pinned segments use `flex: 0 0 <span>px` (no grow, no stretch)
//   - Fill segments use `flex: <span> <span> auto` (grow proportional to
//     cicn span) and `border-image-repeat: repeat` for tiling
//   - All segments use `border-image` with slice values cropping the cicn
//     to the segment's cicn-edge band
//
// Recipe data is treated correctly per the WDEF research: it tells us
// WHERE the slice boundaries are AND which segments are static graphics
// vs tileable patterns. Both are honored here.

import type { WindowTypeEntry } from '../schema/types.js';

const FAITHFUL_ATTR = 'data-aaron-faithful-chrome' as const;
const BODY_PART = 'part-0';
const SIDES = ['top', 'right', 'bottom', 'left'] as const;
type Side = (typeof SIDES)[number];

export interface ComposeFaithfulOptions {
  cicnUrl: string;
  cicnWidth: number;
  cicnHeight: number;
}

export function composeKaleidoscopeFaithful(
  windowEl: HTMLElement,
  windowType: WindowTypeEntry,
  options: ComposeFaithfulOptions,
): void {
  clearKaleidoscopeFaithful(windowEl);
  const { cicnUrl, cicnWidth, cicnHeight } = options;
  if (cicnWidth <= 0 || cicnHeight <= 0) return;

  const parts = windowType.parts ?? {};
  const edges = windowType.edges ?? {};
  const bodyRect = parts[BODY_PART]?.rect;
  if (!bodyRect) return;
  const [bl, bt, br, bb] = bodyRect;
  const thickness: Record<Side, number> = {
    top: Math.max(1, bt),
    right: Math.max(1, cicnWidth - br),
    bottom: Math.max(1, cicnHeight - bb),
    left: Math.max(1, bl),
  };

  windowEl.setAttribute(FAITHFUL_ATTR, 'on');
  if (!windowEl.style.position || windowEl.style.position === 'static') {
    windowEl.style.position = 'relative';
  }
  windowEl.style.boxSizing = 'border-box';
  windowEl.style.paddingTop = `${thickness.top}px`;
  windowEl.style.paddingRight = `${thickness.right}px`;
  windowEl.style.paddingBottom = `${thickness.bottom}px`;
  windowEl.style.paddingLeft = `${thickness.left}px`;
  windowEl.style.setProperty('--aaron-frame-top-px', `${thickness.top}px`);
  windowEl.style.setProperty('--aaron-frame-right-px', `${thickness.right}px`);
  windowEl.style.setProperty('--aaron-frame-bottom-px', `${thickness.bottom}px`);
  windowEl.style.setProperty('--aaron-frame-left-px', `${thickness.left}px`);

  for (const side of SIDES) {
    const recipe = edges[side];
    if (!recipe || recipe.length === 0) continue;
    const strip = buildEdgeStrip({
      side,
      recipe,
      parts,
      cicnUrl,
      cicnWidth,
      cicnHeight,
      thickness,
    });
    windowEl.appendChild(strip);
  }
}

export function clearKaleidoscopeFaithful(windowEl: HTMLElement): void {
  if (windowEl.getAttribute(FAITHFUL_ATTR) !== 'on') return;
  windowEl.removeAttribute(FAITHFUL_ATTR);
  windowEl.style.paddingTop = '';
  windowEl.style.paddingRight = '';
  windowEl.style.paddingBottom = '';
  windowEl.style.paddingLeft = '';
  windowEl.style.removeProperty('--aaron-frame-top-px');
  windowEl.style.removeProperty('--aaron-frame-right-px');
  windowEl.style.removeProperty('--aaron-frame-bottom-px');
  windowEl.style.removeProperty('--aaron-frame-left-px');
  for (const node of windowEl.querySelectorAll(`[${FAITHFUL_ATTR}-edge]`)) {
    node.remove();
  }
}

// ─── Internals ─────────────────────────────────────────────────────────

interface BuildEdgeOptions {
  side: Side;
  recipe: Array<{ at: number; part: string }>;
  parts: Record<string, { rect: [number, number, number, number] }>;
  cicnUrl: string;
  cicnWidth: number;
  cicnHeight: number;
  thickness: Record<Side, number>;
}

function buildEdgeStrip(opts: BuildEdgeOptions): HTMLElement {
  const { side, recipe, parts, cicnUrl, cicnWidth, cicnHeight, thickness } = opts;
  const isVertical = side === 'left' || side === 'right';
  const axisMax = isVertical ? cicnHeight : cicnWidth;
  const sideThickness = thickness[side];

  const strip = document.createElement('div');
  strip.setAttribute(`${FAITHFUL_ATTR}-edge`, side);
  strip.setAttribute('aria-hidden', 'true');
  Object.assign(strip.style, {
    position: 'absolute',
    display: 'flex',
    flexDirection: isVertical ? 'column' : 'row',
    overflow: 'hidden',
    pointerEvents: 'none',
    imageRendering: 'pixelated',
  } as Partial<CSSStyleDeclaration>);
  // Top/bottom strips span full window width. Side strips inset between top
  // and bottom so the corners belong to top/bottom strips.
  if (side === 'top') {
    Object.assign(strip.style, { top: '0', left: '0', right: '0', height: `${sideThickness}px` });
  } else if (side === 'bottom') {
    Object.assign(strip.style, { bottom: '0', left: '0', right: '0', height: `${sideThickness}px` });
  } else if (side === 'left') {
    Object.assign(strip.style, { top: `${thickness.top}px`, bottom: `${thickness.bottom}px`, left: '0', width: `${sideThickness}px` });
  } else {
    Object.assign(strip.style, { top: `${thickness.top}px`, bottom: `${thickness.bottom}px`, right: '0', width: `${sideThickness}px` });
  }

  // Walk recipe pair-wise. Each consecutive (at_i, at_{i+1}) pair defines
  // a segment of cicn-span = at_{i+1} - at_i. Synthesize a sentinel at
  // axisMax so the last entry produces a real segment.
  const sorted = [...recipe].sort((a, b) => a.at - b.at);
  const sentinel = { at: axisMax, part: '__end__' };
  const cursor = [...sorted, sentinel];

  type Spec = { start: number; end: number; span: number; part: string; isNamedWidget: boolean };
  const specs: Spec[] = [];
  for (let i = 0; i < cursor.length - 1; i++) {
    const cur = cursor[i]!;
    const next = cursor[i + 1]!;
    const span = next.at - cur.at;
    if (span <= 0) continue;
    specs.push({
      start: cur.at,
      end: next.at,
      span,
      part: cur.part,
      isNamedWidget: cur.part !== BODY_PART && cur.part in parts,
    });
  }

  // Per-edge part-rect ranges — fills that overlap a part rect on this
  // edge band are static graphics (close box, etc.) and should pin, not
  // tile. Otherwise their pixels would multiply across the edge.
  const edgePartRanges = collectPartRangesOnEdge(parts, side, thickness, cicnWidth, cicnHeight);
  function overlapsPart(start: number, end: number): boolean {
    for (const [a, b] of edgePartRanges) if (start < b && end > a) return true;
    return false;
  }

  // Identify outermost fills as corner anchors.
  const firstFillIdx = specs.findIndex((s) => !s.isNamedWidget);
  let lastFillIdx = -1;
  for (let i = specs.length - 1; i >= 0; i--) {
    if (!specs[i]!.isNamedWidget) { lastFillIdx = i; break; }
  }

  specs.forEach((spec, i) => {
    const { start, end, span, part, isNamedWidget } = spec;
    const isCornerFill = !isNamedWidget && (i === firstFillIdx || i === lastFillIdx);
    const isStaticOverlap = !isNamedWidget && !isCornerFill && overlapsPart(start, end);
    const isPinned = isNamedWidget || isCornerFill || isStaticOverlap;

    // Slice math — keep the cicn cropping aligned to the edge's band.
    let sliceTop: number, sliceRight: number, sliceBottom: number, sliceLeft: number;
    if (side === 'top') {
      sliceTop = 0; sliceBottom = cicnHeight - sideThickness;
      sliceLeft = start; sliceRight = cicnWidth - end;
    } else if (side === 'bottom') {
      sliceTop = cicnHeight - sideThickness; sliceBottom = 0;
      sliceLeft = start; sliceRight = cicnWidth - end;
    } else if (side === 'left') {
      sliceTop = start; sliceBottom = cicnHeight - end;
      sliceLeft = 0; sliceRight = cicnWidth - sideThickness;
    } else {
      sliceTop = start; sliceBottom = cicnHeight - end;
      sliceLeft = cicnWidth - sideThickness; sliceRight = 0;
    }

    const seg = document.createElement('div');
    seg.setAttribute(
      `${FAITHFUL_ATTR}-segment`,
      isNamedWidget ? `widget:${part}` : isCornerFill ? 'corner' : isStaticOverlap ? 'static' : 'fill',
    );
    seg.style.imageRendering = 'pixelated';
    if (isPinned) {
      // Pinned: render the slice ONCE at native cicn-px size.
      seg.style.flex = `0 0 ${span}px`;
    } else {
      // Fill: grow proportional to cicn span, then tile the slice at
      // native size to fill. `repeat` (NOT `round`/`stretch`) — period-
      // correct behavior, accepts partial tile at trailing edge.
      seg.style.flex = `${span} ${span} auto`;
    }
    if (isVertical) seg.style.width = `${sideThickness}px`;
    else seg.style.height = `${sideThickness}px`;
    seg.style.borderStyle = 'solid';
    seg.style.borderColor = 'transparent';
    seg.style.borderWidth = '0';
    seg.style.borderImageSource = `url("${cicnUrl}")`;
    seg.style.borderImageSlice = `${sliceTop} ${sliceRight} ${sliceBottom} ${sliceLeft} fill`;
    seg.style.borderImageWidth = '0';
    seg.style.borderImageRepeat = isPinned ? 'stretch' : 'repeat';
    strip.appendChild(seg);
  });

  return strip;
}

/** Cicn axis-ranges occupied by part rects whose perpendicular range is
 *  inside this edge's band. Skips part-0 (body marker). */
function collectPartRangesOnEdge(
  parts: Record<string, { rect: [number, number, number, number] }>,
  side: Side,
  thickness: Record<Side, number>,
  cicnWidth: number,
  cicnHeight: number,
): Array<[number, number]> {
  const isVertical = side === 'left' || side === 'right';
  const bandStart = side === 'top' || side === 'left' ? 0
    : side === 'bottom' ? cicnHeight - thickness.bottom
    : cicnWidth - thickness.right;
  const bandEnd = side === 'top' ? thickness.top
    : side === 'left' ? thickness.left
    : side === 'bottom' ? cicnHeight
    : cicnWidth;
  const ranges: Array<[number, number]> = [];
  for (const [name, p] of Object.entries(parts)) {
    if (name === BODY_PART) continue;
    const [l, t, r, b] = p.rect;
    if (isVertical) {
      if (r <= bandStart || l >= bandEnd) continue;
      ranges.push([t, b]);
    } else {
      if (b <= bandStart || t >= bandEnd) continue;
      ranges.push([l, r]);
    }
  }
  return ranges;
}
