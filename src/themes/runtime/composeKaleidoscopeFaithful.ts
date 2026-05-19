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
  // All strips span the full window edge — top/bottom full width, left/right
  // full height. Strips OVERLAP at corners by design. This matches
  // Kaleidoscope's actual rendering: each recipe describes its edge band
  // INCLUDING the corner zones, and corners get drawn redundantly by both
  // perpendicular strips. They source the same cicn pixels so the redundant
  // paint looks like one corner. Without the overlap, the corner content
  // appeared at the top of the left strip (under the top strip's leftmost
  // segment), creating a visible duplication.
  if (side === 'top') {
    Object.assign(strip.style, { top: '0', left: '0', right: '0', height: `${sideThickness}px` });
  } else if (side === 'bottom') {
    Object.assign(strip.style, { bottom: '0', left: '0', right: '0', height: `${sideThickness}px` });
  } else if (side === 'left') {
    Object.assign(strip.style, { top: '0', bottom: '0', left: '0', width: `${sideThickness}px` });
  } else {
    Object.assign(strip.style, { top: '0', bottom: '0', right: '0', width: `${sideThickness}px` });
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

  // Tile-vs-pin classification driven by segment SPAN, not by part-name
  // labels. Empirically (and confirmed by the user's visual review): the
  // segments meant to tile are the 1-2 cicn-pixel-wide accent markers that
  // appear at regular intervals along the edge. Everything wider is a
  // discrete graphic the author drew once — either a static decoration
  // (the "1990" plaque) or a regular fill pattern that should appear at
  // its authored position, not multiply.
  //
  // Threshold 2: covers the 1-px part-1 accent markers in 1990's recipe
  // (referenced ~14× per edge for regular tab graphics) without sweeping
  // up larger fills. If a future scheme needs a different threshold,
  // promote this to per-windowType metadata.
  const TILE_SPAN_THRESHOLD = 2;

  specs.forEach((spec) => {
    const { start, end, span, part, isNamedWidget } = spec;
    const isPinned = span > TILE_SPAN_THRESHOLD;

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
      isPinned ? (isNamedWidget ? `widget:${part}` : 'pin') : `tile:${part}`,
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

