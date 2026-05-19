// Apply a Kaleidoscope theme's window-type chrome to an AaronWindow's DOM.
//
// Implements:
//   - docs/aaron-ui-html-skeleton-spec.md (spec A) §2 — the DOM shape
//   - docs/aaron-ui-raster-mapping-spec.md (spec B) §4.1 — window mapping rule
//   - docs/aaron-ui-composer-spec.md (spec C) §6.2 — window composer
//
// Single composer path (composeKaleidoscopeChrome) per K2 rules. Hit-test
// overlays (applyWindowParts) attach to the titlebar for click-handler
// wiring per spec A §2.4.
//
// This is the WM↔runtime seam: applyChromeFromTheme reads the AaronWindow
// DOM shape (`.aaron-window` + `.aaron-titlebar`) and writes inline styles
// + Colr-flag data attributes (spec B §8). AaronWindow doesn't import the
// runtime; the runtime reaches into AaronWindow's DOM through the
// documented selectors.

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
  // Per spec B §3.3: honor cinf.tileSides when set on the chrome cicn.
  // Schema field name is `slice.tile` for back-compat; semantically it's
  // the cinf tileSides bit.
  const tileSides = chromeEntry.slice?.tile === true;

  // Reset titlebar inline styles from any prior themed state.
  titlebar.style.backgroundImage = '';
  titlebar.style.backgroundSize = '';

  // Stamp Colr scheme-global flags as data attributes on the window root
  // per spec B §8 + spec A §20. CSS keys off these for cross-family
  // behavior (scrollbar layout, menu overlay, etc.). Stamped on every
  // themed window — cheap, idempotent, removed by clearChromeFromTheme.
  stampColrFlags(windowEl, theme);

  // Single composer path — see spec B §4.1.
  // Requires the windowType to publish a `part-0` body rect; if absent
  // we leave the window engine-baseline styled (no themed chrome).
  if (cicnWidth > 0 && cicnHeight > 0 && windowType.parts?.['part-0']) {
    composeKaleidoscopeChrome(windowEl, windowType, {
      cicnUrl,
      cicnWidth,
      cicnHeight,
      tileSides,
    });
  } else {
    clearKaleidoscopeChrome(windowEl);
  }

  // Body background pattern — cinf.bgPatternId → ppat slug → CSS
  // background-image on .aaron-content. Per spec B §2.3 + §4.1.
  const content = windowEl.querySelector<HTMLElement>('.aaron-content');
  if (content) applyBodyPattern(content, theme, chromeEntry);

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
 * styles + removes part overlays + clears Colr-flag data attributes.
 * Safe to call on an unthemed window.
 */
export function clearChromeFromTheme(windowEl: HTMLElement): void {
  clearKaleidoscopeChrome(windowEl);
  clearColrFlags(windowEl);
  const content = windowEl.querySelector<HTMLElement>('.aaron-content');
  if (content) {
    content.style.backgroundImage = '';
    content.style.backgroundRepeat = '';
    content.style.imageRendering = '';
  }
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

// Colr scheme-global flag → DOM attribute mapping per spec B §8 + spec A §20.
// Stamped on the window root so CSS attribute selectors can drive
// cross-family behavior without per-control JS reads.
const COLR_FLAG_ATTRS = [
  ['unifiedScrollbarTrack', 'data-aaron-scrollbar-style', 'unified'],
  ['windowsStyleScrollbars', 'data-aaron-scrollbar-layout', 'paired'],
  ['stretchScrollbarThumbFromCenter', 'data-aaron-thumb-stretch', 'center'],
  ['menuHighlightOverlay', 'data-aaron-menu-overlay', 'true'],
  ['extendedScrollbarArrows', 'data-aaron-scrollbar-arrows', 'extended'],
] as const;

function stampColrFlags(windowEl: HTMLElement, theme: Theme): void {
  const opts = theme.options;
  for (const [flagKey, attr, attrValue] of COLR_FLAG_ATTRS) {
    if (opts?.[flagKey]) windowEl.setAttribute(attr, attrValue);
    else windowEl.removeAttribute(attr);
  }
}

function clearColrFlags(windowEl: HTMLElement): void {
  for (const [, attr] of COLR_FLAG_ATTRS) windowEl.removeAttribute(attr);
}

// Resolve cinf.bgPatternId → ppat asset URL → CSS background on the
// .aaron-content element. Per spec B §2.3 + §4.1. The bgPattern slug
// on the ChromeElementEntry was resolved at extraction time
// (buildThemeJson) to a key in theme.patterns.
function applyBodyPattern(
  content: HTMLElement,
  theme: Theme,
  chromeEntry: ChromeElementEntry,
): void {
  const slug = chromeEntry.bgPattern;
  const pat = slug ? theme.patterns?.[slug] : undefined;
  if (!pat?.asset) {
    content.style.backgroundImage = '';
    content.style.backgroundRepeat = '';
    return;
  }
  content.style.backgroundImage = `url("${pat.asset.replace(/"/g, '\\"')}")`;
  // Patterns are 8×8 or 16×16 tiles meant to repeat at native size
  // per K2; never stretch or scale. Pixel-art rendering keeps them crisp.
  content.style.backgroundRepeat = pat.repeat === 'horizontal' ? 'repeat-x'
    : pat.repeat === 'vertical' ? 'repeat-y' : 'repeat';
  content.style.imageRendering = 'pixelated';
}
