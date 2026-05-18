// Rich-recipe chrome composer. See docs/chrome-rendering-architecture.md §7.2.
//
// For Kind B schemes whose wnd# recipe density exceeds what CSS border-image
// (9-slice) can represent (see ./recipeDensity.ts), this composer paints each
// edge as a flexbox of per-segment divs:
//   - named-part widgets pinned at native cicn-pixel size
//   - fill segments using border-image to crop+tile a single cicn slice
//
// Edges sit as absolutely-positioned siblings inside the window root. The
// window's existing titlebar/content layout is preserved underneath; padding
// is set on the window root to keep content from sliding under the chrome.
//
// Visual conformance check: the segment positions painted here must match the
// bands drawn by the `Edge segments` overlay in demo/diagnostics.html (#110).

import type { WindowTypeEntry } from '../schema/types.js';
import { deriveFrameGeometry } from './deriveFrameColor.js';

const RICH_FRAME_ATTR = 'data-aaron-rich-recipe' as const;

// Convention: `part-0` is the body-rect marker (not a widget).
// Verified across the corpus (7 Le, ErgoBox, Big Blue, 1138, 1990 all use
// part-0 for the body rect and at the start of each side recipe to mark the
// corner-fill zone). Treating it as a widget would crop the body bitmap into
// the edge strip, which is never what we want.
const BODY_PART = 'part-0';
const SIDES = ['top', 'right', 'bottom', 'left'] as const;
type Side = (typeof SIDES)[number];

export interface ComposeRichRecipeOptions {
  cicnUrl: string;
  cicnWidth: number;
  cicnHeight: number;
}

/**
 * Compose the rich-recipe chrome onto a window root. Idempotent — clears
 * any prior composer output before rendering.
 *
 * No-op if the cicn has invalid dimensions or the frame geometry can't be
 * derived (caller should fall back to the 9-slice path in that case, but
 * this function safely yields a clean window).
 */
export async function composeRichRecipe(
  windowEl: HTMLElement,
  windowType: WindowTypeEntry,
  options: ComposeRichRecipeOptions,
): Promise<void> {
  clearRichRecipe(windowEl);
  const { cicnUrl, cicnWidth, cicnHeight } = options;
  if (cicnWidth <= 0 || cicnHeight <= 0) return;
  const parts = windowType.parts ?? {};
  const edges = windowType.edges ?? {};

  // Edge thicknesses come from the body rect (`part-0`) when present — it
  // gives exact cicn-pixel inset on each side. Falls back to a pixel scan
  // (deriveFrameGeometry) if part-0 isn't published, which can underestimate
  // for cicns with a 1-px transparent column outside the decoration (1990's
  // left edge returns 1 from the scan but 36 from part-0). Body rect wins.
  const bodyRect = parts[BODY_PART]?.rect;
  let thickness: Record<Side, number>;
  if (bodyRect) {
    const [bl, bt, br, bb] = bodyRect;
    thickness = {
      top: Math.max(1, bt),
      right: Math.max(1, cicnWidth - br),
      bottom: Math.max(1, cicnHeight - bb),
      left: Math.max(1, bl),
    };
  } else {
    const geom = await deriveFrameGeometry(cicnUrl);
    if (!geom) return;
    thickness = {
      top: Math.max(1, geom.top || Math.floor(cicnHeight / 4)),
      right: Math.max(1, geom.right),
      bottom: Math.max(1, geom.bottom),
      left: Math.max(1, geom.left),
    };
  }

  // Make windowEl a positioning context + reserve space for the chrome edges.
  // Stamp custom properties matching the 9-slice path so consumer CSS sees the
  // same affordances regardless of which composer ran.
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
  windowEl.setAttribute(RICH_FRAME_ATTR, 'on');

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

/**
 * Remove rich-recipe composition from a window root. Restores box-sizing
 * and padding to their pre-compose state and removes all edge strips.
 */
export function clearRichRecipe(windowEl: HTMLElement): void {
  if (windowEl.getAttribute(RICH_FRAME_ATTR) === 'on') {
    windowEl.removeAttribute(RICH_FRAME_ATTR);
    windowEl.style.paddingTop = '';
    windowEl.style.paddingRight = '';
    windowEl.style.paddingBottom = '';
    windowEl.style.paddingLeft = '';
    windowEl.style.removeProperty('--aaron-frame-top-px');
    windowEl.style.removeProperty('--aaron-frame-right-px');
    windowEl.style.removeProperty('--aaron-frame-bottom-px');
    windowEl.style.removeProperty('--aaron-frame-left-px');
  }
  for (const node of windowEl.querySelectorAll(`[${RICH_FRAME_ATTR}-edge]`)) {
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
  // Vertical edges sit between top + bottom edges so corners belong to top/bottom.
  const inset = {
    top: side === 'top' ? '0' : side === 'bottom' ? 'auto' : `${thickness.top}px`,
    right: side === 'right' ? '0' : side === 'left' ? 'auto' : '0',
    bottom: side === 'bottom' ? '0' : side === 'top' ? 'auto' : `${thickness.bottom}px`,
    left: side === 'left' ? '0' : side === 'right' ? 'auto' : '0',
  };

  const strip = document.createElement('div');
  strip.setAttribute(`${RICH_FRAME_ATTR}-edge`, side);
  strip.setAttribute('aria-hidden', 'true');
  Object.assign(strip.style, {
    position: 'absolute',
    top: inset.top,
    right: inset.right,
    bottom: inset.bottom,
    left: inset.left,
    display: 'flex',
    flexDirection: isVertical ? 'column' : 'row',
    overflow: 'hidden',
    pointerEvents: 'none',
    imageRendering: 'pixelated',
  } as Partial<CSSStyleDeclaration>);
  if (isVertical) {
    strip.style.width = `${sideThickness}px`;
  } else {
    strip.style.height = `${sideThickness}px`;
  }

  // Walk recipe entries pair-wise. Each pair defines one segment whose content
  // type is the LOWER entry's part. Synthesize an end-of-edge sentinel so the
  // last entry produces a real segment ending at the cicn edge.
  const sorted = [...recipe].sort((a, b) => a.at - b.at);
  const sentinel = { at: axisMax, part: '__edge_end__' };
  const cursor = [...sorted, sentinel];

  // Build segment specs first so we can identify the first + last fill
  // segments (corner anchors). Corners pin at native cicn-px size like
  // CSS border-image; only interior fills grow with window resize.
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
      // Treat part-0 (body marker) as fill — see BODY_PART comment above.
      isNamedWidget: cur.part !== BODY_PART && cur.part in parts,
    });
  }
  // Pin the first + last FILL segments as corners. Named widgets already
  // pin (below), so we don't need to mark them — find the outermost
  // fills and flag them.
  const firstFillIdx = specs.findIndex((s) => !s.isNamedWidget);
  let lastFillIdx = -1;
  for (let i = specs.length - 1; i >= 0; i--) {
    if (!specs[i]!.isNamedWidget) { lastFillIdx = i; break; }
  }

  specs.forEach((spec, i) => {
    const { start, end, span, part, isNamedWidget } = spec;
    const isCornerFill = !isNamedWidget && (i === firstFillIdx || i === lastFillIdx);

    const seg = document.createElement('div');
    seg.style.imageRendering = 'pixelated';
    seg.setAttribute(
      `${RICH_FRAME_ATTR}-segment`,
      isNamedWidget ? `widget:${part}` : isCornerFill ? 'corner' : 'fill',
    );

    // The actual pixels for any segment come from the cicn at the segment's
    // EDGE position — not from a named part's rect. The part rect is metadata
    // for hit-testing (which we may wire later); using it for rendering would
    // paint top-edge widget pixels onto the bottom edge whenever a bottom
    // recipe references a part whose rect lives in the top of the cicn (the
    // 1990 case — part-1's rect is at y=11..19, referenced 7× on the bottom
    // recipe). What differs between widget vs fill is only the FLEX behavior:
    //   widget → pin at native cicn-px width (no stretch)
    //   fill   → grow proportional to cicn-span so the window-resize math
    //            distributes available space the way the author intended.
    const sliceTop = isVertical ? start : 0;
    const sliceBottom = isVertical
      ? cicnHeight - end
      : cicnHeight - sideThickness;
    const sliceLeft = isVertical ? 0 : start;
    const sliceRight = isVertical ? cicnWidth - sideThickness : cicnWidth - end;
    // Flex behavior:
    //   widget or corner → pin at native cicn-px (no stretch — preserves
    //                      the author's discrete graphics + corner anchors)
    //   interior fill    → grow proportional to cicn span (absorbs window
    //                      resize, mirroring how border-image stretches
    //                      its center fill zone)
    if (isNamedWidget || isCornerFill) {
      seg.style.flex = `0 0 ${span}px`;
    } else {
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
    seg.style.borderImageRepeat = 'round';
    strip.appendChild(seg);
  });

  return strip;
}
