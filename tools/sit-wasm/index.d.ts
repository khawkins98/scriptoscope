// Type definitions for stuffit-wasm.

export interface ArchiveEntry {
  /** Original filename; may carry a folder prefix, e.g. "masswerk 7 Le/masswerk 7 Le". */
  name: string;
  /**
   * Mac OSType code packed big-endian into a u32 (e.g. 'APPL' → 0x4150504C), NOT a string.
   * Decode with `String.fromCharCode((v>>24)&255,(v>>16)&255,(v>>8)&255,v&255)`.
   */
  type: number;
  /** Mac creator OSType, u32 big-endian (see {@link ArchiveEntry.type}). */
  creator: number;
  /** Which fork these bytes are: 0 = data fork, 1 = resource fork. */
  forkType: 0 | 1;
  /** The fork's raw bytes. */
  bytes: Uint8Array;
}

/**
 * Decode a classic-Mac archive (StuffIt `.sit`, BinHex `.hqx`, MacBinary `.bin`, Compact Pro
 * `.cpt`) into its forks — one entry per fork. A non-archive input passes through as a single
 * data fork. Runs in the browser and in Node. The WASM module instantiates on first call and
 * is shared by later calls.
 *
 * The shared instance is replaced in two cases. After a decode that crashes the decoder (a
 * runtime abort or trap), that call rejects with the crash's own error and the next call
 * instantiates a new instance. After a decode that leaves the instance's memory above its
 * limit, the next call instantiates a new one first, so that call starts on an instance at
 * its initial memory size; memory is not held at that size in between.
 *
 * If the very first instantiation fails, that failure is kept and every later call rejects
 * with it. A failed replacement is not kept: after a crash the call that needed it rejects
 * with the instantiation error and the next call tries again; for an instance that was only
 * over its limit the call is served by that instance and a later call tries again.
 */
export function decodeArchive(bytes: Uint8Array | ArrayBuffer): Promise<ArchiveEntry[]>;

/**
 * Internal, for this package's own tests; not part of the supported API and may change or
 * go away in any release. Builds a separate `decodeArchive` with its own shared instance,
 * made by `glue` (called like the Emscripten factory: with the module options, resolving
 * to a module). It is a named export of this package and of any bundle chunk built from it.
 * @internal
 */
export function __createDecoderForTests(
  glue: (options: Record<string, unknown>) => Promise<unknown>,
): (bytes: Uint8Array | ArrayBuffer) => Promise<ArchiveEntry[]>;

/**
 * Convenience for classic Mac files that keep their payload in the resource fork (e.g.
 * Kaleidoscope schemes): returns the largest resource fork, skipping the special folder-icon
 * file (`Icon\r`). Throws if the archive has no resource fork.
 */
export function stuffItResourceFork(bytes: Uint8Array | ArrayBuffer): Promise<Uint8Array>;

/** Same selector, exposing the actual chosen entry without decoding a second time. */
export function stuffItResourceForkWithSelection(bytes: Uint8Array | ArrayBuffer): Promise<{
  bytes: Uint8Array;
  selection: { policy: 'largest-non-icon-resource-fork'; entryIndex: number; entryName: string;
    forkType: 0 | 1; fileType: number; creator: number };
}>;
