import { onAssetUrlReleased } from '../tools/theme-loader/assetLifecycle.js';
import { decodedRaster } from '../tools/theme-loader/rasterAssets.js';
import { PixelBuffer } from './pixelBuffer.js';

const cache = new Map<string, Promise<PixelBuffer>>();
// A pending decode may still finish for its caller, but it must not keep a
// disposed theme alive in this shared cache. Completion never reinserts it.
onAssetUrlReleased((url) => { cache.delete(url); });

/**
 * Load a cicn PNG into a PixelBuffer. Canvas is used ONLY to decode the
 * source image into raw RGBA — all compositing happens in PixelBuffer.
 * Results are cached per URL.
 */
export function loadCicnBuffer(url: string): Promise<PixelBuffer> {
  const hit = cache.get(url);
  if (hit) return hit;
  const p = (async () => {
    const decoded = decodedRaster(url);
    if (decoded) return new PixelBuffer(decoded.width, decoded.height, decoded.data);
    const img = new Image();
    img.src = url;
    await img.decode();
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('loadCicnBuffer: no 2d context');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, 0, 0);
    const id = ctx.getImageData(0, 0, w, h);
    return new PixelBuffer(w, h, id.data);
  })().catch((error: unknown) => {
    if (cache.get(url) === p) cache.delete(url);
    throw error;
  });
  cache.set(url, p);
  return p;
}
