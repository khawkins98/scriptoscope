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
 * data fork. Runs in the browser and in Node; the WASM module instantiates once on first call.
 */
export function decodeArchive(bytes: Uint8Array | ArrayBuffer): Promise<ArchiveEntry[]>;

/**
 * Convenience for classic Mac files that keep their payload in the resource fork (e.g.
 * Kaleidoscope schemes): returns the largest resource fork, skipping the special folder-icon
 * file (`Icon\r`). Throws if the archive has no resource fork.
 */
export function stuffItResourceFork(bytes: Uint8Array | ArrayBuffer): Promise<Uint8Array>;
