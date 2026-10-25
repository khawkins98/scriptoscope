// Browser asset ownership shared by the separately deployed loader and runtime.
// Only the built-in encoder can promise its input pixels describe its image URL.
import { notifyAssetUrlReleased, onAssetUrlReleased } from './assetLifecycle.js';

const key = Symbol.for('scriptoscope.decodedRasterAssets.v1');
const rasters = globalThis[key] ??= new Map();
onAssetUrlReleased(url => rasters.delete(url));

/** Own the URLs from one decode, and optionally transfer its decoded arrays.
 * Custom encoders omit assets: their output may transform the input pixels. */
export function ownRasterAssets(urlByPath, assets = []) {
  for (const asset of assets) {
    const url = urlByPath.get(asset.path);
    if (typeof url === 'string' && url.startsWith('blob:')) rasters.set(url, { asset });
  }
  return () => {
    for (const url of new Set(urlByPath.values())) if (typeof url === 'string' && url.startsWith('blob:')) {
      URL.revokeObjectURL(url);
      notifyAssetUrlReleased(url);
    }
    urlByPath.clear();
  };
}

/** Match historical Canvas readback, including zero RGB under zero alpha.
 * Fractional alpha requires browser premultiplication and retains image decoding.
 * Arrays are private to the owner; renderers borrow them as immutable sources. */
export function decodedRaster(url) {
  const entry = rasters.get(url);
  if (!entry) return undefined;
  if ('pixels' in entry) return entry.pixels;
  const { width, height, rgba } = entry.asset;
  const data = new Uint8ClampedArray(rgba.buffer, rgba.byteOffset, rgba.byteLength);
  for (let i = 3; i < data.length; i += 4) if (data[i] !== 0 && data[i] !== 255) {
    // The PNG already exists; a fallback must not also pin unusable source bytes.
    rasters.delete(url);
    return undefined;
  }
  for (let i = 0; i < data.length; i += 4) if (data[i + 3] === 0) data.fill(0, i, i + 3);
  return entry.pixels = { width, height, data };
}
