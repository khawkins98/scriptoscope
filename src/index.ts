export { bindButtonToContentPort, setButtonCompositionContext, type ButtonCompositionBinding, type ButtonBindingState } from './buttonComposition.js';
export type { ManagedControlPort, ManagedPortMeasurement } from './managedContentPort.js';
export type { ControlCompositionContext, ControlCompositionSnapshot, ControlPoint, ControlRect } from './controlComposition.js';
// Scriptoscope — a web-native runtime for classic-Mac Kaleidoscope schemes.
//
// Renders a scheme's window chrome 1:1 from its original binary resources by
// replaying the Kaleidoscope 2.3.1 kDEF (a 68k WDEF) on a pixel buffer; CSS does
// only positioning + integer upscale. Validated against the period reference
// images. Key artifacts (see docs/ — don't re-derive):
//   themes/<slug>/                       source-of-truth bundle (scheme.sit or scheme.rsrc + meta.json + PROVENANCE.md)
//   tools/theme-loader/                  in-browser .sit/.rsrc → LoadedTheme decoder
//   docs/spec/compositor-spec.md         the window-chrome model
//   docs/spec/kdef231-recipe-walk.md     the 2.3.1 kDEF decode (truth)

// Pre-1.0 — release version is tracked in package.json. Keep this constant aligned
// with the package.json `version` field.
export const VERSION = '0.3.0';

export { setDebug, isDebug, debug, type DebugOpts } from './debug.js';

export type {
  WindowState,
  Rect,
  WindowPart,
  WindowType,
  WindowCinf,
  ChromeElement,
  CicnSamplingEquivalence, CicnSampledBandAsset, CicnBodyBinding,
  Palette,
  ThemeManifest,
  LoadedTheme,
  ThemeInspector,
  ThemeProgressModel,
  ThemeScrollArrowMap,
} from './types.js';
export { loadTheme, assetUrl, findChromeElement, type ThemeMeta } from './loadTheme.js';
// In-browser .sit/.rsrc decoder — exposed so consumers can decode a dropped File / fetched
// bytes (the BYO theme path) without going through `loadTheme(url)`. Same code `loadTheme`
// runs internally; surfaced here so an npm consumer can reach it without importing a
// /tools/ path. Returns a `LoadedTheme` (encoded mode) or `{ manifest, assets, iconIndex }`
// (raw mode, when `encodeAssets: false` is set). Typing comes from the sibling
// `tools/theme-loader/loadKaleidoscopeScheme.d.ts` shim; src/loadKaleidoscopeScheme.ts
// adds the engine's default loader inputs (engine cinf ids).
export { loadKaleidoscopeScheme } from './loadKaleidoscopeScheme.js';
export { renderWindow, type RenderWindowOptions } from './renderWindow.js';
export type { ControlDiagnostics, ControlRenderTrace, ControlResolutionStep, TabBodyTrace } from './controlDiagnostics.js';
export type { HeaderSurfaceOptions, HeaderSurfaceResult, HeaderSurfaceUnsupportedReason, HeaderSurfaceTrace } from './headerSurface.js';

export {
  interactiveButton, interactiveCheckbox, radioGroup, interactiveDisclosure,
  interactiveSlider, interactiveScrollbar, WindowManager, titleWidgetHits,
  type InteractiveButtonOptions, type InteractiveCheckableOptions,
  type RadioGroupOptions, type InteractiveDisclosureOptions,
  type InteractiveSliderOptions, type InteractiveScrollbarOptions,
  type TitleWidget, type TitleWidgetHandlers, type TitleWidgetHit,
} from './interactive.js';
export { PixelBuffer, type PixRect } from './pixelBuffer.js';
export { loadCicnBuffer } from './cicnImage.js';
export { rasterizeText } from './textRaster.js';
export {
  platinumCheckable, platinumSlider, platinumButton, platinumScrollbar, platinumDisclosure,
  platinumBevelButton, platinumMenuBar, platinumMenu, platinumPopupMenu, platinumListHeader,
  type PlatinumCheckOptions, type PlatinumSliderOptions,
  type PlatinumButtonOptions, type PlatinumScrollbarOptions,
  type PlatinumBevelButtonOptions, type PlatinumMenuBarOptions, type PlatinumMenuOptions,
  type PlatinumPopupMenuOptions, type PlatinumListHeaderOptions, type PlatinumListHeaderColumn,
} from './platinum.js';
export {
  composeScrollbar,
  composeSlider,
  composeDisclosure,
  composeProgress,
  composeTab,
  composeButton,
  composeBevelButton,
  composeListHeader,
  composeHeaderSurface,
  composeCheckable,
  composeGrowBox,
  baselineButton,
  baselineCheckable,
  bufferToCanvas,
  type ButtonOptions,
  type BevelButtonOptions,
  type ListHeaderOptions, type ListHeaderColumn,
  type ScrollbarOptions,
  type SliderOptions,
  type DisclosureOptions,
  type ProgressOptions,
  type Orientation,
  type ControlState,
} from './controls.js';
export {
  composeWindowChrome,
  frameFromBody,
  partRole,
  type Frame,
  type ComposedChrome,
  type PlacementSlice,
  type SliceMode,
  type PixRectXY,
} from './composeChrome.js';

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
  mountDeclarative, type MountOptions,
  ScriptoscopeWindow, type ScriptoscopeWindowDeps,
  // Theme resolver — exposed so consumers can pre-load themes outside mountDeclarative.
  createThemeResolver, type ThemeResolver, type ThemeBootstrapOpts,
  promoteButton,
  promoteField, isFieldEligible,
  promoteTabs,
  attachThemeDropZone,
  type ThemeDropZoneOptions, type ThemeDropZoneHandle,
  parseWindowAttrs, parseButtonAttrs, resolveThemeRef, themeRefToUrl, isThemeUrl,
  type ParsedWindow, type ParsedButton, type SizeMode,
} from './declarative/index.js';

export type { ElementByteProvenance, PatternByteProvenance, ThemeByteProvenance, WindowByteProvenance } from './loadProvenance.js';

export { prepareDisplayProfile, DisplayProfileError, type DisplayProfile, type DisplayProfileData, type DisplayPolicy } from '../tools/theme-loader/display-profile.js';

export { prepareBitmapFont, type BitmapFontData, type BitmapGlyph, type PreparedBitmapFont, type BitmapTextPaint } from './preparedBitmapFont.js';

export { prepareCinfEnvironment, CinfEnvironmentError, type PreparedCinfEnvironment, type CinfEnvironmentInput, type CinfLookupView, type CinfProviderReference } from '../tools/theme-loader/cinf-environment.js';

export { prepareCicnTransferResults, CicnTransferError } from '../tools/theme-loader/cicn-transfer-results.js';
export type { CicnTransferData, PreparedCicnTransfers, CicnTransferOption, CicnTransferProvenance } from '../tools/theme-loader/cicn-transfer-results.js';
