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
  type InteractiveButtonOptions,
  type InteractiveDisclosureOptions,
  type InteractiveSliderOptions, type InteractiveScrollbarOptions,
  type TitleWidget, type TitleWidgetHandlers, type TitleWidgetHit,
} from './interactive.js';

// ── Declarative front door (data-scriptoscope-*) ──────────────────────────────────
// Additive re-exports of the declarative layer so consumers can `import { mountDeclarative } from
// 'scriptoscope'` directly from the bare-package path.
//
// Two import shapes are supported (both resolve to the same dist bundle; the difference is the
// types view + which symbols are visible):
//   `from 'scriptoscope'`             — the wide entry: imperative runtime + the declarative
//                                       symbols re-exported below. The right choice for most use.
//   `from 'scriptoscope/declarative'` — focused declarative entry. Exposes the full declarative
//                                       public surface (incl. `createThemeResolver`,
//                                       `ThemeResolver`, `ScriptoscopeWindowDeps`, `SizeMode`,
//                                       `ThemeBootstrapOpts` — not re-exported below). For
//                                       library authors who want only the declarative tree.
//
// Note: the consumer attribute namespace stays `data-scriptoscope-*` (and the CSS class prefix `.scriptoscope-*`
// and the `ScriptoscopeWindow` class name) even though the package name pivoted to scriptoscope — these
// are the stable internal API surface, treated like Lodash's `_` namespace. Renaming them is a
// future API-break-eligible change tracked separately, not coupled to the package rebrand.
export {
  mountDeclarative, mountOwnedDeclarative, type MountOptions,
  ScriptoscopeWindow, type ScriptoscopeWindowDeps,
  // Theme resolver — exposed so consumers can pre-load themes outside mountDeclarative.
  createThemeResolver, createOwnedThemeResolver, type ThemeResolver, type ThemeBootstrapOpts,
  promoteButton,
  promoteField, isFieldEligible,
  promoteTabs,
  attachThemeDropZone,
  type ThemeDropZoneOptions, type ThemeDropZoneHandle,
  parseWindowAttrs, parseButtonAttrs, resolveThemeRef, themeRefToUrl, isThemeUrl,
  type ParsedWindow, type ParsedButton, type SizeMode,
} from './declarative/index.js';
