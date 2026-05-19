// Apply a Kaleidoscope theme's window-type chrome to an AaronWindow's DOM.
//
// Implements docs/aaron-ui-architecture-spec.md §7 — the DOM + CSS mapping.
// Single composer path (composeKaleidoscopeChrome) per the K2 rendering
// rules. Hit-test overlays (applyWindowParts) attach to the titlebar for
// future click-handler wiring per spec §8.
//
// This is the WM↔runtime seam: applyChromeFromTheme reads the AaronWindow
// DOM shape (`.aaron-window` + `.aaron-titlebar`) and writes inline styles.
// AaronWindow doesn't import the runtime; the runtime reaches into
// AaronWindow's DOM through the documented selectors.

import type {
  Theme,
  WindowTypeEntry,
  WindowChromeStates,
  ChromeElementEntry,
} from '../schema/types.js';
import {
  applyWindowParts,
  clearWindowParts,
  type WindowPartInfo,
} from './applyWindowParts.js';
import {
  composeKaleidoscopeChrome,
  clearKaleidoscopeChrome,
} from './composeKaleidoscopeChrome.js';

export interface ApplyChromeFromThemeOptions {
  /** Which window-type slug to apply. Defaults to `'document-window'`. */
  windowTypeSlug?: string;
  /** Override the chrome state. Default: derived from `data-state` attr. */
  state?: keyof WindowChromeStates;
  /** A11y mode for the wnd#-derived part overlays. */
  partsAria?: 'hidden' | 'button';
}

export interface ApplyChromeFromThemeResult {
  windowTypeSlug: string;
  state: keyof WindowChromeStates;
  chromeDimensions: { width: number; height: number };
  parts: WindowPartInfo[];
}

/**
 * Apply a theme's window-type chrome to an AaronWindow's root element.
 *
 * Idempotent — re-applying replaces prior chrome cleanly. Throws if the
 * window has no `.aaron-titlebar` or the requested chrome state has no
 * cicn URL in the theme.
 */
export function applyChromeFromTheme(
  windowEl: HTMLElement,
  theme: Theme,
  options: ApplyChromeFromThemeOptions = {},
): ApplyChromeFromThemeResult {
  const titlebar = windowEl.querySelector<HTMLElement>('.aaron-titlebar');
  if (!titlebar) {
    throw new Error('applyChromeFromTheme: windowEl has no .aaron-titlebar child');
  }

  const { windowType, slug: windowTypeSlug } = resolveWindowType(theme, options.windowTypeSlug);
  const state = options.state ?? deriveStateFromDom(windowEl, windowType.chrome);
  const cicnUrl = windowType.chrome[state];
  if (!cicnUrl) {
    throw new Error(
      `applyChromeFromTheme: theme.windowTypes["${windowTypeSlug}"].chrome["${state}"] is undefined`,
    );
  }

  const chromeEntry = findChromeElementByAsset(theme, cicnUrl) ?? { asset: cicnUrl };
  const cicnWidth = chromeEntry.width ?? 0;
  const cicnHeight = chromeEntry.height ?? 0;

  // Reset titlebar inline styles from any prior themed state.
  titlebar.style.backgroundImage = '';
  titlebar.style.backgroundSize = '';

  // Single composer path — see docs/aaron-ui-architecture-spec.md §4.
  // Requires the windowType to publish a `part-0` body rect; if absent
  // we leave the window engine-baseline styled (no themed chrome).
  if (cicnWidth > 0 && cicnHeight > 0 && windowType.parts?.['part-0']) {
    composeKaleidoscopeChrome(windowEl, windowType, {
      cicnUrl,
      cicnWidth,
      cicnHeight,
    });
  } else {
    clearKaleidoscopeChrome(windowEl);
  }

  // Hit-target overlays for wnd# parts (close, zoom, windowshade, etc.) —
  // invisible by default. The visible chrome comes from the composer
  // above; these overlays exist so future PRs can attach click handlers
  // (see spec §8).
  const partsAria = options.partsAria ?? 'hidden';
  let parts: WindowPartInfo[] = [];
  if (windowType.parts && Object.keys(windowType.parts).length > 0 && cicnWidth > 0 && cicnHeight > 0) {
    parts = applyWindowParts(titlebar, windowType, {
      chromeWidth: cicnWidth,
      chromeHeight: cicnHeight,
      aria: partsAria,
    });
  }

  return {
    windowTypeSlug,
    state,
    chromeDimensions: { width: cicnWidth, height: cicnHeight },
    parts,
  };
}

/**
 * Reverse the work of {@link applyChromeFromTheme}: clears inline chrome
 * styles + removes part overlays. Safe to call on an unthemed window.
 */
export function clearChromeFromTheme(windowEl: HTMLElement): void {
  clearKaleidoscopeChrome(windowEl);
  const titlebar = windowEl.querySelector<HTMLElement>('.aaron-titlebar');
  if (!titlebar) return;
  clearWindowParts(titlebar);
}

// ─── Internals ─────────────────────────────────────────────────────────

function resolveWindowType(
  theme: Theme,
  preferredSlug: string | undefined,
): { windowType: WindowTypeEntry; slug: string } {
  const slug = preferredSlug ?? 'document-window';
  const direct = theme.windowTypes?.[slug];
  if (direct) return { windowType: direct, slug };
  const entries = Object.entries(theme.windowTypes ?? {});
  if (entries.length === 0) {
    throw new Error(
      `applyChromeFromTheme: theme has no windowTypes (looking for "${slug}")`,
    );
  }
  const [fallbackSlug, fallbackEntry] = entries[0]!;
  return { windowType: fallbackEntry, slug: fallbackSlug };
}

function deriveStateFromDom(
  windowEl: HTMLElement,
  chrome: WindowChromeStates,
): keyof WindowChromeStates {
  const domState = windowEl.getAttribute('data-state') ?? 'active';
  const collapsed = domState === 'collapsed';
  const active = domState !== 'inactive' && domState !== 'collapsed-inactive';

  if (collapsed) {
    return active && chrome['collapsed-active'] !== undefined
      ? 'collapsed-active'
      : chrome['collapsed-inactive'] !== undefined
        ? 'collapsed-inactive'
        : active ? 'active' : 'inactive';
  }
  return active ? 'active' : 'inactive';
}

function findChromeElementByAsset(theme: Theme, assetUrl: string): ChromeElementEntry | null {
  if (!theme.chromeElements) return null;
  for (const entry of Object.values(theme.chromeElements)) {
    if (entry.asset === assetUrl) return entry;
  }
  return null;
}
