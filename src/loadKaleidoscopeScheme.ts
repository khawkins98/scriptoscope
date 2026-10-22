// Public entry for the in-browser .sit/.rsrc decoder: the conversion core's
// loadKaleidoscopeScheme with the engine's loader inputs on by default, so a
// dropped or fetched archive answers the engine's cinf requests from raw bytes
// (slider G1/CF1) and carries the icon-blit metadata (depth and opaque
// companion) for the cicns the engine draws with the icon blit, the same as
// loadTheme. The conversion module itself stays default-off, so lint and local
// bakes are unchanged. An explicit `engineCinfIds` or `iconBlitCicnIds`
// (including []) overrides the default.
import {
  loadKaleidoscopeScheme as loadKaleidoscopeSchemeCore, type LoadKaleidoscopeSchemeOptions,
} from '../tools/theme-loader/loadKaleidoscopeScheme.js';
import type { LoadedTheme } from './types.js';
import { engineCinfIds, engineIconBlitCicnIds } from './engine/resources/ids.js';

const ENGINE_CINF_IDS = engineCinfIds();
const ICON_BLIT_CICN_IDS = engineIconBlitCicnIds();

export function loadKaleidoscopeScheme(
  input: Uint8Array | ArrayBuffer | Blob | string,
  options: LoadKaleidoscopeSchemeOptions = {},
): Promise<LoadedTheme> {
  return loadKaleidoscopeSchemeCore(input, { iconBlitCicnIds: ICON_BLIT_CICN_IDS, engineCinfIds: ENGINE_CINF_IDS, ...options });
}
