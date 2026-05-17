// Shared export set used by both the main entry (`./index.ts`) and the
// opt-out sub-entry (`./no-default.ts`). The two entries differ only in
// whether they call `enableBundledDefault()` as a side-effect.

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

// Theme runtime — loader, registry, renderer primitives, integration
// helpers, theme switcher, bundled-default helpers.
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
  applyChromeFromTheme,
  clearChromeFromTheme,
  attachThemeToWindow,
  enableThemeSwitching,
  applyControlChrome,
  wireControlStateMachine,
  type ThemeRegistry,
  type ThemeChangeListener,
  type ThemeChangeEventDetail,
  type ApplyChromeElementOptions,
  type ApplyWindowPartsOptions,
  type WindowPartInfo,
  type ApplyChromeFromThemeOptions,
  type ApplyChromeFromThemeResult,
  type AttachThemeToWindowOptions,
  type EnableThemeSwitchingOptions,
  type ApplyControlChromeOptions,
  type WireControlStateMachineOptions,
  type ControlState,
  type ControlCheckedState,
  type StateChromeMap,
} from './themes/runtime/index.js';

// Bundled-default helpers (Phase 4.5 / issue #39). The main entry calls
// `enableBundledDefault()` as a side-effect; this sub-entry does not.
export {
  BUNDLED_DEFAULT_SLUG,
  enableBundledDefault,
  loadBundledDefault,
  setBundledDefaultUrl,
  getBundledDefaultUrl,
} from './themes/runtime/bundledDefault.js';

// Phase 3 controls (#71+). Per-control classes + declarative scanner
// helpers. Push buttons #71, checkboxes + radios #72, text fields #73,
// more landing in subsequent tickets.
export {
  AaronButton,
  promoteButtons,
  AaronCheckbox,
  AaronRadio,
  promoteCheckboxes,
  promoteRadios,
  AaronField,
  promoteFields,
  installEngineBaseline,
  type AaronButtonOptions,
  type AaronCheckableOptions,
  type AaronFieldOptions,
} from './controls/index.js';
