// Kaleidoscope chrome composer — implements docs/aaron-ui-raster-mapping-spec.md
// (spec B) §2 + §3, producing DOM that conforms to spec A §2.2.
//
// Per-segment composition: the wnd# recipe defines slice boundaries per
// edge (spec B §2.4), and each segment renders its cicn slice INDEPENDENTLY
// via CSS `border-image-repeat`. Honors the author's segmentation — the
// author broke edges into small 1-2px segments where they wanted stretch-
// to-fill behavior (a 1px slice stretched any width = solid uniform fill,
// per K2 Speed Note in spec B §3.1) and into wider segments for distinct
// graphics they accepted slight distortion on.
//
// Key spec rules implemented here:
//   - Spec B §2.5 — slice-vs-stamp boundary: part 0 skipped; named widgets
//     pinned at native; all other parts get their cicn slice stretched.
//   - Spec B §3.1 — stretch is the default (K2 Speed Note).
//   - Spec B §3.2 — hybrid threshold: span ≤ 2 → 1-pixel-stretch; span > 2
//     → full-slice stretch. Threshold is explicitly tunable per spec.
//   - Spec B §3.3 — cinf.tileSides override: when set, switch to
//     border-image-repeat: repeat.
//
// Frame thicknesses come from the body rect (`part-0`) per K2; we never
// pixel-scan.
//
// Open questions parked against kDEF disassembly (spec B §13):
//   - §13.1 — divider sandwich parts 5/6 — currently treated as
//     universal-stretch (part-8)
//   - §13.2 — threshold value (currently 2px, empirical)

import type { WindowTypeEntry } from '../schema/types.js';

const CHROME_ATTR = 'data-aaron-chrome' as const;
const BODY_PART = 'part-0';
const SIDES = ['top', 'right', 'bottom', 'left'] as const;
type Side = (typeof SIDES)[number];

export interface ComposeChromeOptions {
  cicnUrl: string;
  cicnWidth: number;
  cicnHeight: number;
  /** Per spec B §3.3 — cinf.tileSides override. When true, segments use
   *  `border-image-repeat: repeat` (tile cicn pixels at native size)
   *  instead of `stretch`. Default: false (stretch per K2 Speed Note). */
  tileSides?: boolean;
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

  const tileSides = options.tileSides === true;
  for (const side of SIDES) {
    const recipe = edges[side];
    if (!recipe || recipe.length === 0) continue;
    const strip = buildEdgeStrip({
      side, recipe, parts, cicnUrl, cicnWidth, cicnHeight, thickness, tileSides,
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
  tileSides: boolean;
}

function buildEdgeStrip(opts: BuildEdgeOptions): HTMLElement {
  const { side, recipe, parts, cicnUrl, cicnWidth, cicnHeight, thickness, tileSides } = opts;
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
    // Per spec B §3.1 (K2 Speed Note): stretch is the default. Each
    // segment's cicn slice stretches to fill the segment's rendered
    // width. 1-2px slices (the author's typical accent markers) stretch
    // to a uniform bar of that pixel's color — fast and visually clean.
    // Wider slices stretch noticeably; the author's accepted trade-off.
    //
    // Per spec B §3.3: when cinf.tileSides is set, switch to repeat —
    // tile the cicn slice at native pixel size across the segment.
    // Tiny fills still stretch (they're 1-pixel uniform bars; tiling is
    // visually identical but pays a tile-math cost for nothing).
    seg.style.borderImageRepeat = tileSides && !isTinyFill ? 'repeat' : 'stretch';
    strip.appendChild(seg);
  }

  return strip;
}
