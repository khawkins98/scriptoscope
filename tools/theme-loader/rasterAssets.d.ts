export interface DecodedRasterAsset { path: string; width: number; height: number; rgba: Uint8Array }
export interface OwnedRaster {
  readonly key: string;
  decoded(): { width: number; height: number; data: Uint8ClampedArray } | undefined;
  imageUrl(): Promise<string>;
}
export interface RasterAssetOwner {
  capture(path: string): OwnedRaster;
  readonly lifetime: string;
  readonly disposed: boolean;
  imageUrl(ref: string): Promise<string>;
  imageUrls(): Promise<Map<string, string>>;
  releasePixels(): void;
  usage(): { rasters: number; pixelBytes: number; images: number; pending: number };
  dispose(): void;
}
export function createRasterAssetOwner(assets: readonly DecodedRasterAsset[], encode: (rgba: Uint8Array, width: number, height: number, path: string) => string | Promise<string>, authoritative?: boolean): RasterAssetOwner;
export function bindRasterOwner(source: object, owner: RasterAssetOwner): void;
export function rasterOwner(source: object): RasterAssetOwner | undefined;
