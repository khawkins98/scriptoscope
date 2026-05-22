// Aaron UI v2 — clean-break rebuild.
//
// A web-native runtime for classic-Mac Kaleidoscope schemes. We start
// from zero and scale up a working implementation, learning the right
// HTML/CSS structure empirically against the reference images and the
// extracted theme bundles, rather than locking structure in early.
//
// Preserved from v1 (do not re-derive — see docs/):
//   themes/<slug>/                            extracted bundles
//                                             (theme.json + cicns/*.png)
//   tools/theme-loader/                       .rsrc → theme.json decoder
//   docs/kaleidoscope-to-html-mapping.md      mapping reference
//   docs/tracking/kdef-disassembly-findings.md   binary archaeology
//   docs/aaron-ui-*-spec.md                   the v1 specs (reference)

export const VERSION = '2.0.0-dev';

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
export { PixelBuffer, type PixRect } from './pixelBuffer.js';
export { loadCicnBuffer } from './cicnImage.js';
export { rasterizeText } from './textRaster.js';
export {
  platinumCheckable, platinumSlider, platinumButton, platinumScrollbar, platinumDisclosure,
  type PlatinumCheckOptions, type PlatinumSliderOptions,
  type PlatinumButtonOptions, type PlatinumScrollbarOptions,
} from './platinum.js';
export {
  composeScrollbar,
  composeSlider,
  composeDisclosure,
  composeProgress,
  composeTab,
  composeButton,
  composeCheckable,
  composeGrowBox,
  baselineButton,
  baselineCheckable,
  bufferToCanvas,
  type ButtonOptions,
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
