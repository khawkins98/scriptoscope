// Kaleidoscope-faithful chrome composer.
//
// Synthesised from the WDEF research + Scheme Factory binary parse (2026-05-18,
// see LEARNINGS.md and docs/kaleidoscope-geometry-spec.md §11+§12):
// Kaleidoscope was a WDEF replacement that painted chrome via a simple
// 9-slice using body-rect-derived geometry. The wnd# recipe is primarily
// HIT-TEST data for the WDEF's wHit response, NOT paint data for the wDraw
// response. The earlier per-segment composer (composeRichRecipe) treated
// the recipe as paint and accumulated 4 stacked heuristics chasing visual
// artifacts that were really a sign of using the wrong abstraction.
//
// This module is that simpler model directly. Three rules:
//
//   1. Frame geometry comes from the body rect (`part-0`), not pixel scans.
//      Cross-corpus reliable: every scheme audited publishes part-0.
//   2. Render the cicn as CSS `border-image` 9-slice on the window root.
//      Corners pin native; edges + center use `border-image-repeat: stretch`.
//   3. Recipe data is not consulted for paint. It stays in theme.json
//      reserved for future hit-test wiring (mapping clicks to
//      `wInGoAway`/`wInZoomIn`/etc. for proper close/zoom button behavior).
//
// `stretch` (not `round` or `repeat`) is the trade-off chosen: preserves
// once-ness of static graphics like 1990's plaque/star at the cost of
// proportional distortion when the window is much larger than the cicn.
// This matches what Kaleidoscope would have done at unusual scales — its
// authors drew schemes assuming near-native render dimensions, and the
// format has no per-region tile-vs-stretch hint for window chrome
// (cinf doesn't exist for the -14xxx wnd# series).

import type { WindowTypeEntry } from '../schema/types.js';

const FAITHFUL_ATTR = 'data-aaron-faithful-chrome' as const;
const BODY_PART = 'part-0';

export interface ComposeFaithfulOptions {
  cicnUrl: string;
  cicnWidth: number;
  cicnHeight: number;
}

/**
 * Apply Kaleidoscope-faithful chrome composition to a window root element.
 *
 * Uses CSS `border-image` with 9-slice geometry derived from the body rect
 * (`part-0`). Idempotent — clears prior state before applying.
 *
 * Requires `windowType.parts['part-0']` to be present. Returns silently
 * (no-op) if not — caller should fall back to another composer.
 */
export function composeKaleidoscopeFaithful(
  windowEl: HTMLElement,
  windowType: WindowTypeEntry,
  options: ComposeFaithfulOptions,
): void {
  clearKaleidoscopeFaithful(windowEl);
  const { cicnUrl, cicnWidth, cicnHeight } = options;
  if (cicnWidth <= 0 || cicnHeight <= 0) return;

  const bodyRect = windowType.parts?.[BODY_PART]?.rect;
  if (!bodyRect) return;
  const [bl, bt, br, bb] = bodyRect;
  const top = Math.max(1, bt);
  const right = Math.max(1, cicnWidth - br);
  const bottom = Math.max(1, cicnHeight - bb);
  const left = Math.max(1, bl);

  windowEl.setAttribute(FAITHFUL_ATTR, 'on');
  const cicnUrlCss = `url("${cicnUrl.replace(/"/g, '\\"')}")`;
  windowEl.style.boxSizing = 'border-box';
  windowEl.style.borderStyle = 'solid';
  windowEl.style.borderColor = 'transparent';
  windowEl.style.borderTopWidth = `${top}px`;
  windowEl.style.borderRightWidth = `${right}px`;
  windowEl.style.borderBottomWidth = `${bottom}px`;
  windowEl.style.borderLeftWidth = `${left}px`;
  windowEl.style.borderImageSource = cicnUrlCss;
  windowEl.style.borderImageSlice = `${top} ${right} ${bottom} ${left} fill`;
  windowEl.style.borderImageWidth = `${top}px ${right}px ${bottom}px ${left}px`;
  windowEl.style.borderImageRepeat = 'stretch';
  windowEl.style.imageRendering = 'pixelated';

  // Stamp frame-thickness custom properties so consumer CSS can position
  // the titlebar overlay + content area inside the border.
  windowEl.style.setProperty('--aaron-frame-top-px', `${top}px`);
  windowEl.style.setProperty('--aaron-frame-right-px', `${right}px`);
  windowEl.style.setProperty('--aaron-frame-bottom-px', `${bottom}px`);
  windowEl.style.setProperty('--aaron-frame-left-px', `${left}px`);
}

export function clearKaleidoscopeFaithful(windowEl: HTMLElement): void {
  if (windowEl.getAttribute(FAITHFUL_ATTR) !== 'on') return;
  windowEl.removeAttribute(FAITHFUL_ATTR);
  for (const prop of [
    'borderStyle', 'borderColor',
    'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
    'borderImageSource', 'borderImageSlice', 'borderImageWidth', 'borderImageRepeat',
  ] as const) {
    windowEl.style[prop] = '';
  }
  windowEl.style.removeProperty('--aaron-frame-top-px');
  windowEl.style.removeProperty('--aaron-frame-right-px');
  windowEl.style.removeProperty('--aaron-frame-bottom-px');
  windowEl.style.removeProperty('--aaron-frame-left-px');
}
