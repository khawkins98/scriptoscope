export interface DecodedRasterAsset {
  path: string;
  width: number;
  height: number;
  rgba: Uint8Array;
}
/** Transfer owned decoder arrays only for an encoder with known pixel semantics. */
export function ownRasterAssets(urlByPath: Map<string, string>, assets?: readonly DecodedRasterAsset[]): () => void;
/** Borrow immutable source pixels; undefined retains the external image path. */
export function decodedRaster(url: string): { width: number; height: number; data: Uint8ClampedArray } | undefined;
