import { PixelBuffer, composeButton, renderWindow, prepareDisplayProfile, prepareCinfEnvironment,
  type ThemeInput, type RenderWindowOptions, type ButtonOptions, type DisplayProfileData,
  type CinfEnvironmentInput, type HeaderSurfaceOptions, type PreparedBitmapFont } from 'scriptoscope/renderer';
import { PixelBuffer as FullPixelBuffer, loadOwnedTheme } from 'scriptoscope';
export const shared: typeof FullPixelBuffer = PixelBuffer;
export const consumer = (theme: ThemeInput, window: RenderWindowOptions, button: ButtonOptions) =>
  Promise.all([renderWindow(theme, window), composeButton(theme, button)]);
export const preparation = (display: DisplayProfileData, cinf: CinfEnvironmentInput) =>
  Promise.all([prepareDisplayProfile(display), prepareCinfEnvironment(cinf)]);
export type Extra = [HeaderSurfaceOptions, PreparedBitmapFont];
export { loadOwnedTheme };
