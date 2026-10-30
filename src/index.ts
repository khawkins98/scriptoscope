export * from './renderer.js';
export { baselineButton, baselineCheckable } from './controls.js';
export { bindButtonToContentPort, setButtonCompositionContext, type ButtonCompositionBinding, type ButtonBindingState } from './buttonComposition.js';
export type { ManagedControlPort, ManagedPortMeasurement } from './managedContentPort.js';
export { loadTheme, loadOwnedTheme, type ThemeMeta, type ThemeLoadOptions } from './loadTheme.js';
// In-browser .sit/.rsrc decoder — exposed so consumers can decode a dropped File / fetched
// bytes (the BYO theme path) without going through `loadTheme(url)`. Same code `loadTheme`
// runs internally; surfaced here so an npm consumer can reach it without importing a
// /tools/ path. Returns a `LoadedTheme` (encoded mode) or `{ manifest, assets, iconIndex }`
// (raw mode, when `encodeAssets: false` is set). Typing comes from the sibling
// `tools/theme-loader/loadKaleidoscopeScheme.d.ts` shim; src/loadKaleidoscopeScheme.ts
// adds the engine's default loader inputs (engine cinf ids).
export { loadKaleidoscopeScheme, loadOwnedKaleidoscopeScheme } from './loadKaleidoscopeScheme.js';

export {
  interactiveButton, interactiveDisclosure,
  interactiveSlider, interactiveScrollbar, WindowManager, titleWidgetHits, ProgressIdle, progressTickCount,
  type ManagedWindowState, type OuterSize, type ChromeExtent,
  type InteractiveButtonOptions,
  type InteractiveDisclosureOptions,
  type InteractiveSliderOptions, type InteractiveScrollbarOptions,
  type TitleWidget, type TitleWidgetHandlers, type TitleWidgetHit,
} from './interactive.js';

export {
  ScriptoscopeWindow, type ScriptoscopeWindowDeps,
  // Explicit theme loading and promotion.
  createThemeResolver, createOwnedThemeResolver, type ThemeResolver, type ThemeBootstrapOpts,
  promoteButton, promoteGuardedButton, restoreButton, disposePromotedButtonFace,
  promoteControl, promoteGuardedControl, restoreControl,
  promoteField, restoreField, isFieldEligible,
  promoteTabs, restoreTabs,
  attachThemeDropZone,
  type ThemeDropZoneOptions, type ThemeDropZoneHandle,
  parseWindowAttrs, parseButtonAttrs, resolveThemeRef, themeRefToUrl, isThemeUrl,
  type ParsedWindow, type ParsedButton, type SizeMode,
} from './declarative/index.js';
