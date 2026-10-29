// Rendering and preparation API; shares its implementation with the full package.

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
export const VERSION = '0.7.0';

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
  ThemeScrollArrowMap,
} from './types.js';
export { assetUrl, findChromeElement, themeImageUrl, type OwnedTheme, type ThemeInput } from './ownedTheme.js';
export { renderWindow, type RenderWindowOptions } from './renderWindow.js';
export type { ControlDiagnostics, ControlRenderTrace, ControlResolutionStep, TabBodyTrace } from './controlDiagnostics.js';
export type { HeaderSurfaceOptions, HeaderSurfaceResult, HeaderSurfaceUnsupportedReason, HeaderSurfaceTrace } from './headerSurface.js';
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
  composeProgressFrame,
  composeTab,
  composeButton,
  composeBevelButton,
  composeListHeader,
  composeHeaderSurface,
  composeCheckable,
  composeGrowBox,
  bufferToCanvas,
  type ButtonOptions,
  type BevelButtonOptions,
  type ListHeaderOptions, type ListHeaderColumn,
  type ScrollbarOptions,
  type SliderOptions,
  type DisclosureOptions,
  type ProgressOptions,
  type ProgressFrame,
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

export type { ElementByteProvenance, PatternByteProvenance, ThemeByteProvenance, WindowByteProvenance } from './loadProvenance.js';

export { prepareDisplayProfile, DisplayProfileError, type DisplayProfile, type DisplayProfileData, type DisplayPolicy } from '../tools/theme-loader/display-profile.js';

export { prepareBitmapFont, type BitmapFontData, type BitmapGlyph, type PreparedBitmapFont, type BitmapTextPaint } from './preparedBitmapFont.js';

export { prepareCinfEnvironment, CinfEnvironmentError, type PreparedCinfEnvironment, type CinfEnvironmentInput, type CinfLookupView, type CinfProviderReference } from '../tools/theme-loader/cinf-environment.js';

export { prepareCicnTransferResults, CicnTransferError } from '../tools/theme-loader/cicn-transfer-results.js';
export type { CicnTransferData, PreparedCicnTransfers, CicnTransferOption, CicnTransferProvenance } from '../tools/theme-loader/cicn-transfer-results.js';
export type { CheckableOptions } from './checkableFacade.js';
