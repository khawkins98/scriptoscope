// Ambient typing shim for the browser shell over convert.js. The runtime
// (src/loadTheme.ts) imports this JS module; the rest of the toolchain
// (Node CLIs, tests) doesn't need TS types. We declare just enough surface
// area for the runtime call site — the wider LoadOptions are documented in
// the JSDoc on the JS file.

import type { LoadedTheme } from '../../src/types.js';

export interface LoadKaleidoscopeSchemeOptions {
  /** name/author/origin merged into the manifest (binary scheme doesn't carry these). */
  meta?: Record<string, unknown>;
  /** Source label for the manifest provenance (default 'resource-fork'). */
  source?: string;
  /** Encode RGBA → blob-URL assets (default: true in a browser w/ OffscreenCanvas). */
  encodeAssets?: boolean;
  /** Custom RGBA→URL encoder (default: OffscreenCanvas PNG blob URL). */
  assetUrlFactory?: (
    rgba: Uint8Array, width: number, height: number, path: string,
  ) => string | Promise<string>;
}

/**
 * Decode a Kaleidoscope scheme resource fork (or wrapping container —
 * MacBinary, AppleSingle/Double, BinHex, StuffIt) into a render-ready
 * in-memory LoadedTheme. Asset refs in the returned manifest are blob:
 * URLs (browser) or pass-through (Node + custom assetUrlFactory).
 */
export function loadKaleidoscopeScheme(
  input: Uint8Array | ArrayBuffer | Blob | string,
  options?: LoadKaleidoscopeSchemeOptions,
): Promise<LoadedTheme>;
