/** Optional observations of actual decoder input bytes, not pixel correctness. */
export interface ElementByteProvenance {
  readonly loadId: string;
  readonly manifestKey: string;
  readonly cicnResourceIndex: number;
  /** Static same-load pair only. Null means no successfully decoded local cinf;
   * an opted-in role view records its actual consumed cinf separately. */
  readonly cinfResourceIndex: number | null;
}
/** Generated catalog binding only; this does not establish paint usage. */
export interface PatternByteProvenance {
  readonly loadId: string;
  readonly manifestKey: string;
  readonly ppatResourceIndex: number;
}
/** Exact modern builder inputs, not historical selection or completed paint. */
export interface WindowByteProvenance {
  readonly loadId: string;
  readonly manifestKey: string;
  /** Synthesized corner geometry has no original wnd# recipe occurrence. */
  readonly recipe: Readonly<{ kind: 'wnd-resource'; resourceIndex: number } | { kind: 'corner-sprite-table'; key: string; trigger: 'no-emitted-wnd-window-types' }>;
  readonly chrome: Readonly<Partial<Record<'active' | 'inactive', number>>>;
  /** Null means no successful cinf was selected by the existing builder policy. */
  readonly cinfResourceIndex: number | null;
  readonly sprites: Readonly<Partial<Record<'pinstripe' | 'growBox', Readonly<{ type: 'cicn' | 'ppat'; resourceIndex: number }>>>>;
}
export interface ThemeByteProvenance {
  readonly version: 1;
  /** Per-load correlation only. Content hashes establish stable byte identity. */
  readonly loadId: string;
  /** Authoritative observation scope; older version1 records may omit ppat or wnd#. */
  readonly scope: { readonly resourceTypes: readonly ('cicn' | 'cinf' | 'ppat' | 'wnd#')[]; readonly evidence: 'decoder-input-bytes' };
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
    readonly type: 'cicn' | 'cinf' | 'ppat' | 'wnd#'; readonly signedId: number;
    readonly byteLength: number; readonly sha256: string;
    readonly status: 'decoded' | 'skipped' | 'error';
  }[];
}
