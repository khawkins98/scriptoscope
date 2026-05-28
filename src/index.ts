// Scriptoscope — a web-native runtime for classic-Mac Kaleidoscope schemes.
//
// Renders a scheme's window chrome 1:1 from its original binary resources by
// replaying the Kaleidoscope 2.3.1 kDEF (a 68k WDEF) on a pixel buffer; CSS does
// only positioning + integer upscale. Validated against the period reference
// images. Key artifacts (see docs/ — don't re-derive):
//   themes/<slug>/                       extracted bundles (theme.json + cicns/*.png)
//   tools/theme-loader/                  .rsrc → theme.json decoder
//   docs/spec/compositor-spec.md         the window-chrome model
//   docs/spec/kdef231-recipe-walk.md     the 2.3.1 kDEF decode (truth)

// Pre-1.0 — release version is tracked in package.json. Keep this constant aligned
// with the package.json `version` field.
export const VERSION = '0.0.1';

export { setDebug, isDebug, debug, type DebugOpts } from './debug.js';

export type {
  WindowState,
  Rect,
  WindowPart,
  WindowType,
  WindowCinf,
  ChromeElement,
  Palette,
  ThemeManifest,
  LoadedTheme,
} from './types.js';
export { loadTheme, assetUrl, findChromeElement } from './loadTheme.js';
export { renderWindow, type RenderWindowOptions } from './renderWindow.js';
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
export {
  composeCornerSpriteChrome,
  type CornerSpriteOptions,
} from './composeCornerSprite.js';

// ── Declarative front door (data-aaron-*) ──────────────────────────────────
// Additive re-exports of the declarative layer so consumers can `import { mountDeclarative } from
// 'scriptoscope'` rather than reach into a subpath. The declarative entry (`src/declarative/index.ts`)
// remains the canonical place to import from for tree-shakers and library authors; this just keeps
// the bare-package import path covering the public surface.
//
// Note: the consumer attribute namespace stays `data-aaron-*` (and the CSS class prefix `.aw-*`
// and the `AaronWindow` class name) even though the package name pivoted to scriptoscope — these
// are the stable internal API surface, treated like Lodash's `_` namespace. Renaming them is a
// future API-break-eligible change tracked separately, not coupled to the package rebrand.
export {
  mountDeclarative, type MountOptions,
  AaronWindow,
  promoteButton,
  promoteField, isFieldEligible,
  promoteTabs,
  parseWindowAttrs, parseButtonAttrs, resolveThemeRef, themeRefToUrl, isThemeUrl,
  type ParsedWindow, type ParsedButton,
} from './declarative/index.js';
