// Kaleidoscope chrome composer — implements docs/aaron-ui-raster-mapping-spec.md
// (spec B) §2 + §3, producing DOM that conforms to spec A §2.2.
//
// Architectural model (option B, post-#157):
//   - The TOP edge paints inside the .aaron-titlebar element directly.
//     The titlebar's height is sized via --aaron-frame-top-px so it
//     occupies exactly the chrome cicn's top-band height; the title
//     TEXT (.aaron-titlebar__title) overlays the chrome bitmap.
//   - BOTTOM / LEFT / RIGHT edges paint into the existing
//     .aaron-window__edge--{side} containers that AaronWindow creates.
//   - The window root is NOT padded. Earlier versions did this and
//     pushed the titlebar away from the chrome strip — bug fixed here.
//   - CSS variables --aaron-frame-{top,bottom,left,right}-px expose
//     the per-edge thicknesses to CSS so consumers (demo + AaronWindow
//     styles) can size containers consistently.
//
// Per-segment composition: the wnd# recipe defines slice boundaries per
// edge (spec B §2.4), and each segment renders its cicn slice via CSS
// `border-image`. Honors the author's segmentation — the author broke
// edges into small 1-2px segments where they wanted stretch-to-fill
// behavior (per K2 Speed Note in spec B §3.1).
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
const SEGMENT_ATTR = 'data-aaron-chrome-segment' as const;
const EDGE_ATTR = 'data-aaron-chrome-edge' as const;
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
  // No paddingTop/Right/Bottom/Left — the titlebar + edge containers
  // absorb the chrome via their own sizing (driven by the CSS vars
  // below). Earlier versions padded the window root, which pushed the
  // titlebar away from the top-edge chrome strip.
  windowEl.style.setProperty('--aaron-frame-top-px', `${thickness.top}px`);
  windowEl.style.setProperty('--aaron-frame-right-px', `${thickness.right}px`);
  windowEl.style.setProperty('--aaron-frame-bottom-px', `${thickness.bottom}px`);
  windowEl.style.setProperty('--aaron-frame-left-px', `${thickness.left}px`);

  const tileSides = options.tileSides === true;
  const shared = {
    parts, cicnUrl, cicnWidth, cicnHeight, thickness, tileSides,
  };

  // TOP edge → paint into the titlebar element (preserving the title
  // child + widget overlays). Per spec A §2.2 the titlebar is the
  // top-edge container.
  const titlebar = windowEl.querySelector<HTMLElement>('.aaron-titlebar');
  if (titlebar && edges.top && edges.top.length > 0) {
    paintEdge(titlebar, 'top', edges.top, shared);
  }

  // BOTTOM / LEFT / RIGHT edges → paint into the existing
  // .aaron-window__edge--{side} containers that AaronWindow creates.
  // If the consumer didn't use AaronWindow (or used a custom shape),
  // fall back to appending a fresh strip to the window root so chrome
  // still renders (legacy behavior for non-AaronWindow consumers).
  for (const side of ['bottom', 'left', 'right'] as const) {
    const recipe = edges[side];
    if (!recipe || recipe.length === 0) continue;
    let host = windowEl.querySelector<HTMLElement>(`.aaron-window__edge--${side}`);
    if (!host) {
      host = createFallbackEdgeContainer(side);
      windowEl.appendChild(host);
    }
    paintEdge(host, side, recipe, shared);
  }
}

export function clearKaleidoscopeChrome(windowEl: HTMLElement): void {
  if (windowEl.getAttribute(CHROME_ATTR) !== 'on') return;
  windowEl.removeAttribute(CHROME_ATTR);
  windowEl.style.removeProperty('--aaron-frame-top-px');
  windowEl.style.removeProperty('--aaron-frame-right-px');
  windowEl.style.removeProperty('--aaron-frame-bottom-px');
  windowEl.style.removeProperty('--aaron-frame-left-px');
  // Remove our segment divs (children we added). Leave the titlebar
  // and edge containers themselves intact — they belong to AaronWindow.
  for (const seg of windowEl.querySelectorAll(`[${SEGMENT_ATTR}]`)) {
    seg.remove();
  }
  // The composer marks the host containers (titlebar + edge divs) with
  // data-aaron-chrome-edge="{side}" while chrome is painted; strip that
  // marker now. Don't remove the containers themselves — they belong
  // to AaronWindow's DOM structure.
  for (const host of windowEl.querySelectorAll(`[${EDGE_ATTR}]`)) {
    host.removeAttribute(EDGE_ATTR);
    // Also undo the flex layout we wrote inline; safe to clear because
    // these containers don't lay anything out on their own when empty.
    if (host instanceof HTMLElement) {
      host.style.display = '';
      host.style.flexDirection = '';
      host.style.imageRendering = '';
    }
  }
}

// ─── Internals ─────────────────────────────────────────────────────────

interface SharedPaintCtx {
  parts: Record<string, { rect: [number, number, number, number] }>;
  cicnUrl: string;
  cicnWidth: number;
  cicnHeight: number;
  thickness: Record<Side, number>;
  tileSides: boolean;
}

function paintEdge(
  host: HTMLElement,
  side: Side,
  recipe: Array<{ at: number; part: string }>,
  ctx: SharedPaintCtx,
): void {
  const { parts, cicnUrl, cicnWidth, cicnHeight, thickness, tileSides } = ctx;
  const isVertical = side === 'left' || side === 'right';
  const axisMax = isVertical ? cicnHeight : cicnWidth;
  const sideThickness = thickness[side];

  // Mark the host with the edge attribute so the diagnostics page can
  // locate it by [data-aaron-chrome-edge="top"] etc.
  host.setAttribute(EDGE_ATTR, side);
  // The host's own layout (flex direction) needs to match the edge axis.
  // Don't clobber styles the host already needs — apply only the bits
  // necessary for laying segments end-to-end along the axis.
  host.style.display = 'flex';
  host.style.flexDirection = isVertical ? 'column' : 'row';
  host.style.imageRendering = 'pixelated';
  host.style.overflow = host.style.overflow || 'hidden';

  // Walk recipe pair-wise. Synthesize an end-of-edge sentinel so the
  // last entry produces a real segment ending at the cicn edge.
  const sorted = [...recipe].sort((a, b) => a.at - b.at);
  const sentinel = { at: axisMax, part: '__end__' };
  const cursor = [...sorted, sentinel];

  for (let i = 0; i < cursor.length - 1; i++) {
    const cur = cursor[i]!;
    const next = cursor[i + 1]!;
    const span = next.at - cur.at;
    if (span <= 0) continue;

    // K2 rule: part code 0 = null region. The fill author broke a wide
    // stretch into 1px-stretch + (N-1)px-null for speed. Don't draw.
    if (cur.part === BODY_PART) continue;

    const isNamedWidget = cur.part in parts && cur.part !== BODY_PART;

    // Hybrid threshold — see spec B §3.2.
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
    seg.setAttribute(SEGMENT_ATTR, isNamedWidget ? `widget:${cur.part}` : `fill:${cur.part}`);
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
    seg.style.borderImageRepeat = tileSides && !isTinyFill ? 'repeat' : 'stretch';
    host.appendChild(seg);
  }
}

function createFallbackEdgeContainer(side: Exclude<Side, 'top'>): HTMLElement {
  const el = document.createElement('div');
  el.className = `aaron-window__edge aaron-window__edge--${side}`;
  el.setAttribute('aria-hidden', 'true');
  el.style.position = 'absolute';
  el.style.pointerEvents = 'none';
  if (side === 'bottom') {
    el.style.left = '0'; el.style.right = '0'; el.style.bottom = '0';
    el.style.height = `var(--aaron-frame-bottom-px, 1px)`;
  } else if (side === 'left') {
    el.style.top = `var(--aaron-frame-top-px, 25px)`;
    el.style.bottom = `var(--aaron-frame-bottom-px, 1px)`;
    el.style.left = '0';
    el.style.width = `var(--aaron-frame-left-px, 1px)`;
  } else {
    el.style.top = `var(--aaron-frame-top-px, 25px)`;
    el.style.bottom = `var(--aaron-frame-bottom-px, 1px)`;
    el.style.right = '0';
    el.style.width = `var(--aaron-frame-right-px, 1px)`;
  }
  return el;
}
