// Ambient typing shim for the browser shell over convert.js. The runtime
// (src/loadTheme.ts) imports this JS module; the rest of the toolchain
// (Node CLIs, tests) doesn't need TS types. We declare just enough surface
// area for the runtime call site — the wider LoadOptions are documented in
// the JSDoc on the JS file.

import type { LoadedTheme } from '../../src/types.js';

export interface LoadKaleidoscopeSchemeOptions {
  /** Explicit standalone group2 slider layout cinf lookup; absent preserves compatibility. */
  /** Authoritative ordered cinf-only providers for the engine group2 slider. */
  sliderLayoutEnvironment?: import('./cinf-environment.js').PreparedCinfEnvironment;
  /** Explicit standalone push/bevel body cinf lookup; absent preserves compatibility. */
  cinfEnvironment?: import('./cinf-environment.js').PreparedCinfEnvironment;
  cicnTransfer?: import('./cicn-transfer-results.js').CicnTransferOption;
  /** Opaque ics8 companions for exactly these signed identities; [] opts out.
   * The generic core defaults to none; public engine wrappers supply their table. */
  unmaskedIconIds?: readonly number[];
  /** cicn ids an engine caller draws with the icon blit (qd-primitives I1–I3):
   * their elements gain `iconBlit` (pixel depth and, above 1 bit, an opaque companion). */
  iconBlitCicnIds?: readonly number[];
  /** cinf ids an engine caller reads raw bytes of (slider gate, corner, slicing):
   * the manifest gains `engineCinfs` (id string → the first such cinf's bytes). */
  engineCinfIds?: readonly number[];
  displayProfile?: import('./display-profile.js').DisplayProfile;
  /** Opt-in actual input/fork/cicn/cinf byte evidence; requires Web Crypto. */
  provenance?: boolean;
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
