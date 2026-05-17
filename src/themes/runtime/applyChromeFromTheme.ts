// Apply a complete window-type chrome from a parsed Theme to an AaronWindow's
// DOM. Composes the three Phase 4 renderer primitives:
//   - applyChromeElement (cinf 9-slice + ppat overlay) on the chrome cicn
//   - applyWindowParts (wnd#-derived hit-target overlays) on the titlebar
//   - background-image on the window root for the chrome state
//
// This is the WM↔runtime seam: applyChromeFromTheme reads the window's DOM
// shape (the `.aaron-window` + `.aaron-titlebar` contract from Phase 1) and
// writes inline styles. AaronWindow doesn't import the runtime; the runtime
// reaches into AaronWindow's DOM through the documented selectors. See
// docs/runtime-rendering-architecture.md §8 for the contract.

import type {
  Theme,
  WindowTypeEntry,
  WindowChromeStates,
  ChromeElementEntry,
} from '../schema/types.js';
import { applyChromeElement, clearChromeElement } from './applyChromeElement.js';
import { applyWindowParts, clearWindowParts, type WindowPartInfo } from './applyWindowParts.js';

export interface ApplyChromeFromThemeOptions {
  /**
   * Which window-type slug to apply. Defaults to `'document-window'`. If the
   * theme doesn't define that slug, falls back to the first windowType entry.
   */
  windowTypeSlug?: string;
  /**
   * Override the chrome state. Default: derived from the window's
   * `data-state` attribute (`active`, `inactive`, `collapsed`). When the
   * window is collapsed, prefers `collapsed-{active,inactive}` if the
   * scheme provides it.
   */
  state?: keyof WindowChromeStates;
  /**
   * A11y mode for the wnd#-derived part overlays. See `applyWindowParts`.
   */
  partsAria?: 'hidden' | 'button';
}

export interface ApplyChromeFromThemeResult {
  /** Slug of the windowType entry that was applied. */
  windowTypeSlug: string;
  /** Resolved chrome state (active/inactive/collapsed-*). */
  state: keyof WindowChromeStates;
  /** Native chrome cicn dimensions used for percent positioning. */
  chromeDimensions: { width: number; height: number };
  /** Mounted hit-target overlays from `applyWindowParts`. */
  parts: WindowPartInfo[];
}

/**
 * Apply a theme's window-type chrome to an AaronWindow's root element.
 *
 * Reads the DOM shape: looks up `.aaron-titlebar` inside `windowEl` and
 * paints it with the chrome cicn (background-image + cinf border-image +
 * optional ppat overlay) and the wnd# part-rect overlays.
 *
 * Idempotent: re-applying replaces the prior chrome cleanly. Safe to call
 * multiple times (e.g., on theme swap or window state change).
 *
 * @returns Metadata about what was applied. Callers wire event listeners
 *          to `result.parts[*].el` using `result.parts[*].partSlug`.
 *
 * @throws Error if `windowEl` has no `.aaron-titlebar` child, if the theme
 *         has no windowType matching the requested slug, or if the resolved
 *         chrome state has no cicn URL.
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

  // Find the chromeElement entry that owns this cicn URL — we need its
  // cinf slice data + optional bgPattern slug. Fall back to a minimal
  // entry if the catalog doesn't have a matching reference (older bundles).
  const chromeEntry = findChromeElementByAsset(theme, cicnUrl) ?? {
    asset: cicnUrl,
  };

  // Window-type chrome cicns rarely have cinf paired (cinf is per-control;
  // window chrome geometry lives in wnd# side recipes which we don't yet
  // honour for border composition). For the no-slice case, omit width/height
  // so applyChromeElement doesn't render at native cicn size (~74px) in
  // the top-left of a much wider titlebar — then force background-size
  // 100% 100% so the cicn stretches across the titlebar's full rendered
  // width. Pixelated image-rendering keeps the stretch crisp-ish.
  const titlebarEntry: ChromeElementEntry = chromeEntry.slice
    ? chromeEntry
    : stripDimensions(chromeEntry);
  applyChromeElement(titlebar, titlebarEntry, { theme });
  if (!chromeEntry.slice) {
    titlebar.style.backgroundSize = '100% 100%';
  }

  // Scheme-derived window border: slice 1px from the cicn's outermost
  // pixels and use as border-image on the window root. Gives every window
  // a thin themed border (frame color comes from the scheme's chrome
  // edges, not a CSS placeholder). The full wnd# side-recipe composition
  // for thicker per-side rendering is a future polish ticket.
  windowEl.style.borderImageSource = `url("${cicnUrl.replace(/"/g, '\\"')}")`;
  windowEl.style.borderImageSlice = '1';
  windowEl.style.borderImageWidth = '1';
  windowEl.style.borderImageRepeat = 'stretch';
  windowEl.style.borderStyle = 'solid';
  windowEl.style.borderWidth = '1px';
  windowEl.style.borderColor = 'transparent';
  windowEl.style.boxSizing = 'border-box';

  const partsAria = options.partsAria ?? 'hidden';
  let parts: WindowPartInfo[] = [];
  if (windowType.parts && Object.keys(windowType.parts).length > 0) {
    // Need chrome cicn dimensions for percent-positioning. Fall back to the
    // titlebar's current rendered size if the catalog doesn't carry them
    // (degraded but still functional for fixed-aspect renders).
    const width = chromeEntry.width ?? titlebar.clientWidth;
    const height = chromeEntry.height ?? titlebar.clientHeight;
    if (width > 0 && height > 0) {
      parts = applyWindowParts(titlebar, windowType, {
        chromeWidth: width,
        chromeHeight: height,
        aria: partsAria,
        // Pass the cicn so parts render as crisp glyphs (sliced from the
        // cicn at their rect) instead of distorting with the stretched
        // titlebar background. Close/zoom/windowshade icons stay sharp.
        glyphCicnUrl: cicnUrl,
      });
    }
  }

  return {
    windowTypeSlug,
    state,
    chromeDimensions: {
      width: chromeEntry.width ?? 0,
      height: chromeEntry.height ?? 0,
    },
    parts,
  };
}

/**
 * Reverse the work of {@link applyChromeFromTheme}: clears inline chrome
 * styles + removes part overlays from a window. Safe to call on a window
 * that hasn't been themed.
 */
export function clearChromeFromTheme(windowEl: HTMLElement): void {
  // Clear the scheme-derived window border applied to the root.
  for (const prop of [
    'borderImageSource',
    'borderImageSlice',
    'borderImageWidth',
    'borderImageRepeat',
    'borderStyle',
    'borderWidth',
    'borderColor',
    'boxSizing',
  ] as const) {
    windowEl.style[prop] = '';
  }
  const titlebar = windowEl.querySelector<HTMLElement>('.aaron-titlebar');
  if (!titlebar) return;
  clearWindowParts(titlebar);
  clearChromeElement(titlebar);
}

// ─── Internals ─────────────────────────────────────────────────────────

function resolveWindowType(
  theme: Theme,
  preferredSlug: string | undefined,
): { windowType: WindowTypeEntry; slug: string } {
  const slug = preferredSlug ?? 'document-window';
  const direct = theme.windowTypes?.[slug];
  if (direct) return { windowType: direct, slug };

  // Fall back to the first windowType in the catalog (best-effort).
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
        : active
          ? 'active'
          : 'inactive';
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

/**
 * Return a copy of `entry` with the `width` and `height` fields omitted.
 * Used for window-type chrome where we want the cicn to stretch across the
 * full titlebar rather than render at native pixel size.
 *
 * Hand-pluck the keys (rather than `{...entry, width: undefined}`) because
 * the schema has `exactOptionalPropertyTypes: true` — assigning `undefined`
 * to an optional field is a type error; only omission is permitted.
 */
function stripDimensions(entry: ChromeElementEntry): ChromeElementEntry {
  const { width: _w, height: _h, ...rest } = entry;
  return rest;
}
