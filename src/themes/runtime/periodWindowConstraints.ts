// Derive period-authentic window size constraints from a Theme + windowType.
//
// Background: Kaleidoscope schemes were authored for Mac OS 8/9 windows that
// rendered at near-cicn-native dimensions. The format has no per-segment
// tile-vs-stretch metadata because the author assumed limited stretch ratios.
// When we render schemes at arbitrary web-window widths (2× or 3× native),
// the chrome distorts in ways the author never planned for.
//
// To stay true to the period look, this helper returns CSS-level min/max
// dimensions per scheme + windowType so the window can't grow into the
// pathological zone. The caps differ by composer kind:
//
//   - Composer (rich recipe — 1990, Acid, evolution):
//     min = cicn native; max = 1.5× native (chrome holds up; beyond this
//     fills tile-multiply and static graphics like 1990's plaque/star
//     repeat)
//   - 9-slice (simple recipe Kind B — ErgoBox, Big Blue, 1138):
//     min = cicn native; max = unbounded (CSS border-image scales cleanly
//     to any width)
//   - 3-slice titlebar (Kind A — 7 Le):
//     min = period default (120×60); max = unbounded
//
// See docs/chrome-rendering-architecture.md §7 for dispatch context.

import type { Theme } from '../schema/types.js';
import { recipeDensity } from './recipeDensity.js';

export interface PeriodWindowConstraints {
  /** Minimum window width in px. CSS `min-width`. */
  minWidth: number;
  /** Minimum window height in px. CSS `min-height`. */
  minHeight: number;
  /** Maximum window width in px, or undefined for unbounded. CSS `max-width`. */
  maxWidth?: number;
  /** Maximum window height in px, or undefined for unbounded. CSS `max-height`. */
  maxHeight?: number;
  /** Natural opening width in px — the size the author drew for. */
  naturalWidth: number;
  /** Natural opening height in px. */
  naturalHeight: number;
}

const PERIOD_MIN_WIDTH = 120;
const PERIOD_MIN_HEIGHT = 60;
const COMPOSER_MAX_SCALE = 1.5;

export function periodWindowConstraints(
  theme: Theme,
  windowTypeSlug = 'document-window',
): PeriodWindowConstraints | null {
  const wt = theme.windowTypes?.[windowTypeSlug];
  if (!wt) return null;
  const cicnUrl = wt.chrome?.active ?? wt.chrome?.inactive;
  if (!cicnUrl) return null;
  const chromeEntry = Object.values(theme.chromeElements ?? {}).find(
    (e) => e.asset === cicnUrl,
  );
  const cicnW = chromeEntry?.width ?? 0;
  const cicnH = chromeEntry?.height ?? 0;
  if (cicnW <= 0 || cicnH <= 0) return null;

  // Three cases drive the constraints (see header comment for rationale):
  // composer-route (rich recipe + body rect), 9-slice (Kind B simple), or
  // Kind A (thin titlebar).
  const isComposerRoute = recipeDensity(wt) === 'rich' && !!wt.parts?.['part-0'];
  const isTitlebarOnly = cicnH <= 30;

  const naturalWidth = Math.max(PERIOD_MIN_WIDTH, cicnW);
  const naturalHeight = Math.max(PERIOD_MIN_HEIGHT, cicnH);

  if (isComposerRoute) {
    return {
      minWidth: cicnW,
      minHeight: cicnH,
      maxWidth: Math.round(cicnW * COMPOSER_MAX_SCALE),
      maxHeight: Math.round(cicnH * COMPOSER_MAX_SCALE),
      naturalWidth,
      naturalHeight,
    };
  }
  if (isTitlebarOnly) {
    return {
      minWidth: PERIOD_MIN_WIDTH,
      minHeight: PERIOD_MIN_HEIGHT,
      naturalWidth: 320,
      naturalHeight: 200,
    };
  }
  // Kind B simple — 9-slice scales cleanly, only enforce min so corners
  // don't overlap.
  return {
    minWidth: cicnW,
    minHeight: cicnH,
    naturalWidth,
    naturalHeight,
  };
}

/** Apply constraints to an element as inline CSS min/max width+height. */
export function applyConstraintsToElement(
  el: HTMLElement,
  c: PeriodWindowConstraints,
): void {
  el.style.minWidth = `${c.minWidth}px`;
  el.style.minHeight = `${c.minHeight}px`;
  el.style.maxWidth = c.maxWidth != null ? `${c.maxWidth}px` : '';
  el.style.maxHeight = c.maxHeight != null ? `${c.maxHeight}px` : '';
}

/** Clear constraints inline styles from an element. */
export function clearConstraintsFromElement(el: HTMLElement): void {
  el.style.minWidth = '';
  el.style.minHeight = '';
  el.style.maxWidth = '';
  el.style.maxHeight = '';
}
