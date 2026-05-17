// Aaron UI library entry point.
//
// Exports the public API surface downstream consumers import from. As
// Phase 1 fills in (drag, resize, z-order, declarative scanner), additional
// classes appear here. See GitHub Phase 1 milestone for the breakdown.

export const VERSION = '0.0.0';

export { AaronWindow } from './window-manager/AaronWindow.js';
export type { AaronWindowOptions, ResizeDirection } from './window-manager/AaronWindow.js';
export { windowManager } from './window-manager/WindowManager.js';
export type { WindowManager } from './window-manager/WindowManager.js';
export {
  scanForWindows,
  promoteElement,
  parseOptions,
  startScanner,
  stopScanner,
} from './window-manager/scanner.js';

// Theme schema (Phase 4.1 / issue #35) — types + runtime validator for
// theme.json bundles per docs/kaleidoscope-geometry-spec.md §7.
export {
  THEME_SCHEMA_VERSION,
  parseTheme,
  ThemeValidationError,
  type Theme,
  type ThemeAuthor,
  type ThemeOrigin,
  type ThemeOptions,
  type WindowTypeEntry,
  type WindowChromeStates,
  type PartEntry,
  type WindowEdges,
  type EdgeRecipe,
  type ChromeElementEntry,
  type SliceSpec,
  type PatternEntry,
} from './themes/schema/index.js';

// Theme runtime (Phase 4.4 / issue #38) — loadTheme() + ThemeRegistry singleton.
// Fetches a bundle, validates via parseTheme, resolves asset URLs, applies the
// Colr palette to :root, and broadcasts aaron:themechange. Foundation for the
// per-window rendering tickets (#40 cinf 9-slice, #41 ppat overlay, #42 wnd#
// parts) that consume the parsed Theme via the registry.
export {
  loadTheme,
  resolveAssetUrls,
  themeRegistry,
  THEME_CHANGE_EVENT,
  applyChromeElement,
  chromeElementCss,
  clearChromeElement,
  applyWindowParts,
  clearWindowParts,
  windowPartsCss,
  type ThemeRegistry,
  type ThemeChangeListener,
  type ThemeChangeEventDetail,
  type ApplyChromeElementOptions,
  type ApplyWindowPartsOptions,
  type WindowPartInfo,
} from './themes/runtime/index.js';
