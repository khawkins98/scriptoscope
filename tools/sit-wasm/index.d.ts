// Type definitions for stuffit-wasm.
//
// Side effect to know about: to reuse the compiled WebAssembly module when it replaces its
// decoder instance, the wrapper assigns `WebAssembly.instantiateStreaming` for the length of
// one synchronous call each time it loads the decoder without a kept module, and puts back
// the function it found. The wrapped call passes its receiver, arguments and promise through.

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
 * The promise can reject:
 * - with an `Error` whose message starts `decodeArchive: ` when the decoder reports an error.
 *   That includes `decodeArchive: decoded output exceeds the 32 MiB limit`: the decoded forks
 *   of one archive, with their names and headers, may total at most 32 MiB.
 *   `decodeArchive: out of memory` means the input could not be copied into the decoder;
 * - with the runtime's own error (usually a `WebAssembly.RuntimeError`) when a decode crashes
 *   the decoder;
 * - with the instantiation error when the decoder cannot be loaded.
 *
 * The shared instance is replaced in two cases. After a decode that crashes the decoder, the
 * next call waits for a new instance. After a decode that leaves the instance's memory above
 * its limit, the next call starts loading a new instance and calls are served by the old one
 * until it has loaded; the new one starts at the initial memory size, which is not held in
 * between.
 *
 * If the very first instantiation fails, that failure is kept and every later call rejects
 * with it. A failed replacement is not kept, and none is attempted again for one second:
 * after a crash, calls in that second reject with the same instantiation error; an instance
 * that was only over its limit keeps serving.
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
