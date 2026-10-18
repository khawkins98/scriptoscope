/** Optional observations of actual decoder input bytes, not pixel correctness. */
export interface ElementByteProvenance {
  readonly loadId: string;
  readonly manifestKey: string;
  readonly cicnResourceIndex: number;
  /** Null means no successfully decoded cinf supplied this entry's metadata. */
  readonly cinfResourceIndex: number | null;
}
export interface ThemeByteProvenance {
  readonly version: 1;
  /** Per-load correlation only. Content hashes establish stable byte identity. */
  readonly loadId: string;
  readonly scope: { readonly resourceTypes: readonly ['cicn', 'cinf']; readonly evidence: 'decoder-input-bytes' };
  readonly input: { readonly container: string; readonly byteLength: number; readonly sha256: string };
  readonly fork: {
    readonly byteLength: number; readonly sha256: string;
    readonly selection: {
      readonly policy: 'largest-non-icon-resource-fork' | 'raw-resource-fork' | 'unverified-container-unwrapping';
      readonly entryIndex: number | null; readonly entryName: string | null;
      readonly forkType: number | null; readonly fileType: number | null; readonly creator: number | null;
    };
  };
  readonly resources: readonly {
    /** Occurrence in the parser's resource array, distinct even for duplicate IDs. */
    readonly resourceIndex: number;
    readonly type: 'cicn' | 'cinf'; readonly signedId: number;
    readonly byteLength: number; readonly sha256: string;
    readonly status: 'decoded' | 'skipped' | 'error';
  }[];
}
