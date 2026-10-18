/** Internal portable data shared with the manifest loader. */
export declare const WINDOW_TYPE_IDENTITIES: readonly {
  readonly id: number;
  readonly alternateIds?: readonly number[];
  readonly canonicalSlug: string;
  readonly preferredManifestSlug: string;
  readonly legacySlugs: readonly string[];
  readonly collapsedId?: number;
}[];
