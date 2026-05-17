// Barrel export for the theme runtime.

export { loadTheme, resolveAssetUrls } from './loadTheme.js';
export {
  themeRegistry,
  THEME_CHANGE_EVENT,
  type ThemeRegistry,
  type ThemeChangeListener,
  type ThemeChangeEventDetail,
} from './ThemeRegistry.js';
export {
  applyChromeElement,
  chromeElementCss,
  clearChromeElement,
  type ApplyChromeElementOptions,
} from './applyChromeElement.js';
export {
  applyWindowParts,
  clearWindowParts,
  windowPartsCss,
  type ApplyWindowPartsOptions,
  type WindowPartInfo,
} from './applyWindowParts.js';
export {
  applyChromeFromTheme,
  clearChromeFromTheme,
  type ApplyChromeFromThemeOptions,
  type ApplyChromeFromThemeResult,
} from './applyChromeFromTheme.js';
export {
  attachThemeToWindow,
  type AttachThemeToWindowOptions,
} from './attachThemeToWindow.js';
export {
  enableThemeSwitching,
  type EnableThemeSwitchingOptions,
} from './themeSwitcher.js';
export {
  BUNDLED_DEFAULT_SLUG,
  enableBundledDefault,
  loadBundledDefault,
  setBundledDefaultUrl,
  getBundledDefaultUrl,
} from './bundledDefault.js';
export {
  composeTopEdge,
  composeBottomEdge,
  composeLeftEdge,
  composeRightEdge,
  clearChromeSegments,
  recipeToSegments,
  findTitlePillBounds,
  type ComposeWindowChromeOptions,
} from './composeWindowChrome.js';
// Phase 3.1 — shared control infrastructure (#70). Per-control tickets
// (#71 onwards) call this; consumers can use it directly for custom
// controls outside the standard set.
export {
  applyControlChrome,
  wireControlStateMachine,
  type ApplyControlChromeOptions,
  type WireControlStateMachineOptions,
  type ControlState,
  type ControlCheckedState,
  type StateChromeMap,
  type TeardownFn,
} from './applyControlChrome.js';
