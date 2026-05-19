// Kaleidoscope chrome composer — implements docs/aaron-ui-architecture-spec.md
// §4 (the K2 rendering rules from Kaleidoscope's own Scheme Reference).
//
// Per-segment composition: the wnd# recipe defines slice boundaries per
// edge, and each segment renders its cicn slice INDEPENDENTLY via CSS
// `border-image-repeat: stretch`. Honors the author's segmentation —
// the author broke edges into small 1-2px segments where they wanted
// stretch-to-fill behavior (a 1px slice stretched any width = solid
// uniform fill) and into wider segments for distinct graphics they
// accepted slight distortion on.
//
// Three K2 rules in §4:
//   1. STRETCH IS THE DEFAULT (Speed Note). border-image-repeat: stretch.
//   2. PART CODE 0 = NULL — does not draw. Skip the segment.
//   3. NAMED RECTLIST PARTS pin at native cicn-px size. Other parts
//      grow to fill remaining flex space, stretching their cicn slice.
//
// Frame thicknesses come from the body rect (`part-0`) per K2; we never
// pixel-scan.

import type { WindowTypeEntry } from '../schema/types.js';

const CHROME_ATTR = 'data-aaron-chrome' as const;
const BODY_PART = 'part-0';
const SIDES = ['top', 'right', 'bottom', 'left'] as const;
type Side = (typeof SIDES)[number];

export interface ComposeChromeOptions {
  cicnUrl: string;
  cicnWidth: number;
  cicnHeight: number;
}

export function composeKaleidoscopeChrome(
  windowEl: HTMLElement,
  windowType: WindowTypeEntry,
  options: ComposeChromeOptions,
): void {
  clearKaleidoscopeChrome(windowEl);
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

  windowEl.setAttribute(CHROME_ATTR, 'on');
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
      side, recipe, parts, cicnUrl, cicnWidth, cicnHeight, thickness,
    });
    windowEl.appendChild(strip);
  }
}

export function clearKaleidoscopeChrome(windowEl: HTMLElement): void {
  if (windowEl.getAttribute(CHROME_ATTR) !== 'on') return;
  windowEl.removeAttribute(CHROME_ATTR);
  windowEl.style.paddingTop = '';
  windowEl.style.paddingRight = '';
  windowEl.style.paddingBottom = '';
  windowEl.style.paddingLeft = '';
  windowEl.style.removeProperty('--aaron-frame-top-px');
  windowEl.style.removeProperty('--aaron-frame-right-px');
  windowEl.style.removeProperty('--aaron-frame-bottom-px');
  windowEl.style.removeProperty('--aaron-frame-left-px');
  for (const node of windowEl.querySelectorAll(`[${CHROME_ATTR}-edge]`)) {
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
  strip.setAttribute(`${CHROME_ATTR}-edge`, side);
  strip.setAttribute('aria-hidden', 'true');
  Object.assign(strip.style, {
    position: 'absolute',
    display: 'flex',
    flexDirection: isVertical ? 'column' : 'row',
    overflow: 'hidden',
    pointerEvents: 'none',
    imageRendering: 'pixelated',
  } as Partial<CSSStyleDeclaration>);
  // Strips span the full window edge — corners overlap by design (per
  // spec §7.2). The cicn's corner pixels render in both perpendicular
  // strips; they source the same pixels so the overlap is visually one
  // corner.
  if (side === 'top') {
    Object.assign(strip.style, { top: '0', left: '0', right: '0', height: `${sideThickness}px` });
  } else if (side === 'bottom') {
    Object.assign(strip.style, { bottom: '0', left: '0', right: '0', height: `${sideThickness}px` });
  } else if (side === 'left') {
    Object.assign(strip.style, { top: '0', bottom: '0', left: '0', width: `${sideThickness}px` });
  } else {
    Object.assign(strip.style, { top: '0', bottom: '0', right: '0', width: `${sideThickness}px` });
  }

  // Walk recipe pair-wise. Synthesize an end-of-edge sentinel so the last
  // entry produces a real segment ending at the cicn edge.
  const sorted = [...recipe].sort((a, b) => a.at - b.at);
  const sentinel = { at: axisMax, part: '__end__' };
  const cursor = [...sorted, sentinel];

  for (let i = 0; i < cursor.length - 1; i++) {
    const cur = cursor[i]!;
    const next = cursor[i + 1]!;
    const span = next.at - cur.at;
    if (span <= 0) continue;

    // K2 rule: part code 0 = null region, does not draw. Skip without
    // creating a DOM element. The flex layout naturally distributes the
    // space to neighbors (which the K2 docs encourage for the
    // "1px-stretch + remainder-null" performance pattern).
    if (cur.part === BODY_PART) continue;

    // Named widget (part in rectList, excluding body) → pin at native
    // size. Everything else → grow proportional to cicn span, stretch
    // the slice.
    const isNamedWidget = cur.part in parts && cur.part !== BODY_PART;

    // Per-edge slice math — hybrid policy.
    //
    // NAMED WIDGETS (rects in rectList): crop the full segment range
    // → segment renders at native cicn-px width via flex pinning.
    //
    // TINY FILLS (span ≤ TINY_STRETCH_THRESHOLD): treat as the K2
    // Speed Note's 1-pixel-stretch pattern. Crop to a single pixel
    // column at the segment start; border-image-repeat: stretch fills
    // the segment width with that column's color = uniform color bar.
    // Fast, period-correct, what the author signaled by making the
    // segment thin.
    //
    // WIDER FILLS (span > TINY_STRETCH_THRESHOLD): crop the FULL
    // segment range; let the cicn content stretch proportionally. The
    // author chose a wider segment because they wanted the graphic
    // content visible (e.g., 1990's "1990" plaque in a span-36 fill).
    // Distorts at large render sizes but preserves visual richness.
    const TINY_STRETCH_THRESHOLD = 2;
    const isTinyFill = !isNamedWidget && span <= TINY_STRETCH_THRESHOLD;
    const sliceSpanEnd = isTinyFill ? Math.min(cur.at + 1, axisMax) : next.at;

    let sliceTop: number, sliceRight: number, sliceBottom: number, sliceLeft: number;
    if (side === 'top') {
      sliceTop = 0; sliceBottom = cicnHeight - sideThickness;
      sliceLeft = cur.at; sliceRight = cicnWidth - sliceSpanEnd;
    } else if (side === 'bottom') {
      sliceTop = cicnHeight - sideThickness; sliceBottom = 0;
      sliceLeft = cur.at; sliceRight = cicnWidth - sliceSpanEnd;
    } else if (side === 'left') {
      sliceTop = cur.at; sliceBottom = cicnHeight - sliceSpanEnd;
      sliceLeft = 0; sliceRight = cicnWidth - sideThickness;
    } else {
      sliceTop = cur.at; sliceBottom = cicnHeight - sliceSpanEnd;
      sliceLeft = cicnWidth - sideThickness; sliceRight = 0;
    }

    const seg = document.createElement('div');
    seg.setAttribute(
      `${CHROME_ATTR}-segment`,
      isNamedWidget ? `widget:${cur.part}` : `fill:${cur.part}`,
    );
    seg.style.imageRendering = 'pixelated';
    if (isNamedWidget) {
      seg.style.flex = `0 0 ${span}px`;
    } else {
      seg.style.flex = `${span} ${span} auto`;
    }
    if (isVertical) seg.style.width = `${sideThickness}px`;
    else seg.style.height = `${sideThickness}px`;
    seg.style.borderStyle = 'solid';
    seg.style.borderColor = 'transparent';
    seg.style.borderWidth = '0';
    seg.style.borderImageSource = `url("${cicnUrl.replace(/"/g, '\\"')}")`;
    seg.style.borderImageSlice = `${sliceTop} ${sliceRight} ${sliceBottom} ${sliceLeft} fill`;
    seg.style.borderImageWidth = '0';
    // K2 Speed Note: stretch is the default. Each segment's cicn slice
    // stretches to fill the segment's rendered width. 1-2px slices
    // (the author's typical accent markers) stretch to a uniform bar
    // of that pixel's color — fast and visually clean. Wider slices
    // stretch noticeably; that's the author's accepted trade-off.
    seg.style.borderImageRepeat = 'stretch';
    strip.appendChild(seg);
  }

  return strip;
}
