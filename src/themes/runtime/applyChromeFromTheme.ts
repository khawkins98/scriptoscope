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
import { clearChromeSegments } from './composeWindowChrome.js';
import {
  applyTitlebarAs3Slice,
  applyBottomEdgeAs3Slice,
  applyVerticalEdgeAs3Slice,
  clear3Slice,
} from './applyChromeAs3Slice.js';
import { composeTopRecipe, composeBottomRecipe, composeSideRecipe, clearRecipeSegments } from './composeRecipeBased.js';
import { applyWindowAs9Slice, clearWindow9Slice } from './applyChromeAs9Slice.js';
import { deriveFrameColor, deriveFrameGeometry } from './deriveFrameColor.js';
import { classifyChromeCicn } from './classifyChromeCicn.js';

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

  // Render the titlebar chrome via one of three paths:
  //
  // Path A (preferred — #64.1 V2): wnd# side-recipe composition.
  //   When the windowType has a top side recipe AND the chromeEntry has
  //   native pixel dimensions, compose per spec §3's empirical algorithm:
  //   named parts at native rect size at recipe positions, part 8 as
  //   tiled fill, other special codes as part-8 fallback.
  //
  // Path B: cinf 9-slice (rare for window chrome).
  //
  // Path C: stretched-cicn fallback for bundles without recipe data.
  const hasTopRecipe = !!(
    windowType.edges?.top && windowType.edges.top.length > 0
  );
  const hasNativeDimensions =
    chromeEntry.width != null && chromeEntry.height != null;

  if (hasTopRecipe && hasNativeDimensions) {
    // Path A — classifier picks 3-slice (Kind A) or 9-slice (Kind B).
    //
    // See docs/chrome-rendering-architecture.md for the full decision
    // rules. Kind A = thin titlebar-only cicn (e.g., 7 Le 74×25);
    // Kind B = full-window cicn that encodes the entire frame
    // (e.g., ErgoBox 132×64, Big Blue 89×82); Kind C = decorative
    // fixed bitmap that can't tile (Acid, evolution) — falls back
    // to Kind A treatment for now.
    titlebar.style.backgroundImage = '';
    titlebar.style.backgroundSize = '';
    const composeOpts = {
      cicnWidth: chromeEntry.width as number,
      cicnHeight: chromeEntry.height as number,
      cicnUrl,
    };

    // Phase 4a: try the recipe-driven per-segment composer FIRST. If it
    // succeeds (windowType has a usable top recipe + parts), we use it
    // — it's the faithful Kaleidoscope rendering: named parts pinned at
    // cicn-pixel positions from the appropriate side edge; fills tile
    // between. Falls back to the classifier+3/9-slice path if the
    // recipe is absent or empty.
    const recipeResult = composeTopRecipe(titlebar, windowType, composeOpts);

    if (recipeResult.applied) {
      // Recipe drew the top. Clear any prior 3-slice border-image on
      // the titlebar (recipe paints absolute children, not border-image).
      clear3Slice(titlebar);
      // Phase 4b/4c: bottom + side edges via recipe too, if the
      // [data-aaron-edge] containers are present.
      const bottomContainer = windowEl.querySelector<HTMLElement>('[data-aaron-edge="bottom"]');
      const leftContainer = windowEl.querySelector<HTMLElement>('[data-aaron-edge="left"]');
      const rightContainer = windowEl.querySelector<HTMLElement>('[data-aaron-edge="right"]');
      if (bottomContainer) composeBottomRecipe(bottomContainer, windowType, composeOpts);
      if (leftContainer) composeSideRecipe(leftContainer, windowType, composeOpts, 'left');
      if (rightContainer) composeSideRecipe(rightContainer, windowType, composeOpts, 'right');

      // Kind B (full-window cicn — e.g., ErgoBox) handles the entire
      // frame via 9-slice border-image on the window root: the top
      // border IS the titlebar visual; sides + bottom carry the bevel.
      // For Kind B we CLEAR the recipe segments (they'd double-render
      // on top of the 9-slice's top border) and let 9-slice own the
      // whole frame.
      // For Kind A (titlebar-only cicn), the recipe segments ARE the
      // titlebar chrome; no 9-slice runs.
      void classifyChromeCicn(cicnUrl).then((kind) => {
        if (kind === 'full-window') {
          // Clear the recipe segments from titlebar + edge containers —
          // 9-slice handles everything.
          clearRecipeSegments(titlebar);
          if (bottomContainer) clearRecipeSegments(bottomContainer);
          if (leftContainer) clearRecipeSegments(leftContainer);
          if (rightContainer) clearRecipeSegments(rightContainer);
          void applyWindowAs9Slice(windowEl, windowType, composeOpts);
        } else {
          clearWindow9Slice(windowEl);
        }
      });
    } else {
      // No recipe → keep the classifier-dispatched 3-slice / 9-slice
      // fallback for schemes that don't ship wnd# data.
      void classifyChromeCicn(cicnUrl).then((kind) => {
        if (kind === 'full-window') {
          clear3Slice(titlebar);
          clearAllEdges(windowEl);
          void applyWindowAs9Slice(windowEl, windowType, composeOpts);
        } else {
          clearWindow9Slice(windowEl);
        }
      });
    }
    const slice = recipeResult.applied ? null : applyTitlebarAs3Slice(titlebar, windowType, composeOpts);
    // Title-pill positioning (#64.2) — with the 3-slice model the pill
    // is exactly the middle border-image region, i.e. titlebar pixel
    // bounds [leftSlicePx .. titlebarWidth - rightSlicePx]. Stamp the
    // slice values as CSS custom properties for the consumer's title CSS.
    // Title pill bounds: from the recipe path's middle fill zone, or
    // from the 3-slice's right/left slice if the recipe didn't apply.
    const pillL = recipeResult.applied ? recipeResult.titlePillLeftPx : slice?.leftSlicePx ?? null;
    const pillR = recipeResult.applied ? recipeResult.titlePillRightPx : slice?.rightSlicePx ?? null;
    if (pillL != null && pillR != null) {
      titlebar.style.setProperty('--aaron-title-pill-left', `${pillL}px`);
      titlebar.style.setProperty('--aaron-title-pill-right', `${pillR}px`);
    } else {
      titlebar.style.removeProperty('--aaron-title-pill-left');
      titlebar.style.removeProperty('--aaron-title-pill-right');
    }
    // Derive frame color + per-side geometry from the cicn at runtime.
    // Stamp custom properties on the window root so consumer CSS can
    // size + color the edge containers. Different schemes have very
    // different border thicknesses (7 Le is 1px hairlines; ErgoBox is
    // 6px beveled gradients baked into the cicn) — derivation makes
    // both render correctly without per-scheme hardcoding.
    void deriveFrameColor(cicnUrl).then((color) => {
      if (color) windowEl.style.setProperty('--aaron-cicn-frame-color', color);
      else windowEl.style.removeProperty('--aaron-cicn-frame-color');
    });
    void deriveFrameGeometry(cicnUrl).then((geom) => {
      if (!geom) return;
      windowEl.style.setProperty('--aaron-frame-bottom-px', `${geom.bottom}px`);
      windowEl.style.setProperty('--aaron-frame-left-px', `${geom.left}px`);
      windowEl.style.setProperty('--aaron-frame-right-px', `${geom.right}px`);
    });
    // Render side + bottom edges with the same 3-slice approach used by
    // the titlebar — sampled from the cicn's bottom rows / leftmost /
    // rightmost columns. Consumer CSS sizes the containers using the
    // --aaron-frame-*-px custom properties stamped above.
    apply3SliceEdgeIfPresent(windowEl, windowType, 'bottom', composeOpts);
    apply3SliceEdgeIfPresent(windowEl, windowType, 'left', composeOpts);
    apply3SliceEdgeIfPresent(windowEl, windowType, 'right', composeOpts);
  } else if (chromeEntry.slice) {
    // Path B.
    clearChromeSegments(titlebar);
    clear3Slice(titlebar);
    applyChromeElement(titlebar, chromeEntry, { theme });
    titlebar.style.removeProperty('--aaron-title-pill-left');
    titlebar.style.removeProperty('--aaron-title-pill-right');
    clearAllEdges(windowEl);
  } else {
    // Path C.
    clearChromeSegments(titlebar);
    clear3Slice(titlebar);
    const titlebarEntry: ChromeElementEntry = stripDimensions(chromeEntry);
    applyChromeElement(titlebar, titlebarEntry, { theme });
    titlebar.style.backgroundSize = '100% 100%';
    titlebar.style.removeProperty('--aaron-title-pill-left');
    titlebar.style.removeProperty('--aaron-title-pill-right');
    clearAllEdges(windowEl);
  }

  // Hit-target overlays for wnd# parts (close, zoom, windowshade, etc.) —
  // invisible by default. The actual visible glyphs are part of the
  // stretched titlebar background; these overlays exist so future PRs
  // can attach click handlers. Per the 2026-05-17 gap analysis, the
  // crisp-glyph mode from PR #60 was removed because it double-rendered
  // controls (once stretched in the bg, once crisp as overlay).
  const partsAria = options.partsAria ?? 'hidden';
  let parts: WindowPartInfo[] = [];
  if (windowType.parts && Object.keys(windowType.parts).length > 0) {
    const width = chromeEntry.width ?? titlebar.clientWidth;
    const height = chromeEntry.height ?? titlebar.clientHeight;
    if (width > 0 && height > 0) {
      parts = applyWindowParts(titlebar, windowType, {
        chromeWidth: width,
        chromeHeight: height,
        aria: partsAria,
        // No glyphCicnUrl: parts are transparent hit-target overlays only.
        // See gap analysis for why glyph slicing was reverted.
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
  const titlebar = windowEl.querySelector<HTMLElement>('.aaron-titlebar');
  if (!titlebar) return;
  clearWindowParts(titlebar);
  clearChromeSegments(titlebar);
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

/** Apply 3-slice chrome to the `[data-aaron-edge="<side>"]` container,
 *  if the recipe + container are both present. Skips silently otherwise. */
function apply3SliceEdgeIfPresent(
  windowEl: HTMLElement,
  windowType: WindowTypeEntry,
  side: 'bottom' | 'left' | 'right',
  options: { cicnWidth: number; cicnHeight: number; cicnUrl: string },
): void {
  const container = windowEl.querySelector<HTMLElement>(`[data-aaron-edge="${side}"]`);
  if (!container) return;
  const recipe = windowType.edges?.[side];
  if (!recipe || recipe.length === 0) {
    clear3Slice(container);
    return;
  }
  if (side === 'bottom') applyBottomEdgeAs3Slice(container, windowType, options);
  else applyVerticalEdgeAs3Slice(container, windowType, options, side);
}

/** Clear 3-slice rendering from all three side edges (Path B / Path C). */
function clearAllEdges(windowEl: HTMLElement): void {
  for (const side of ['bottom', 'left', 'right'] as const) {
    const container = windowEl.querySelector<HTMLElement>(`[data-aaron-edge="${side}"]`);
    if (container) {
      clear3Slice(container);
      clearChromeSegments(container);
    }
  }
}
