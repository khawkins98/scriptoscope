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
  composeKaleidoscopeChrome,
  clearKaleidoscopeChrome,
  type ComposeChromeOptions,
} from './composeKaleidoscopeChrome.js';
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
export { loadThemeFromRsrc, type LoadThemeFromRsrcOptions } from './loadThemeFromRsrc.js';
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
// Conformance reporting — spec C §4.5 + spec B §12.
export {
  computeConformanceReport,
  classifyCicnFamily,
  type ExtendedConformanceReport,
  type FamilyCount,
} from './conformanceReport.js';
// Color extraction from cinf-anchored cicn pixels (spec B §4.16-§4.18).
// Surfaced as runtime helper; future spec-B implementations consume it.
export {
  extractColorsFromCicn,
  type ExtractedColors,
} from './extractColorsFromCicns.js';
// Attach helpers for cicn-driven controls.
export { attachThemeToCheckable } from './attachThemeToCheckable.js';
export { attachThemeToDisclosure } from './attachThemeToDisclosure.js';
