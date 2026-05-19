import { PixelBuffer } from './pixelBuffer.js';

const cache = new Map<string, Promise<PixelBuffer>>();

/**
 * Load a cicn PNG into a PixelBuffer. Canvas is used ONLY to decode the
 * source image into raw RGBA — all compositing happens in PixelBuffer.
 * Results are cached per URL.
 */
export function loadCicnBuffer(url: string): Promise<PixelBuffer> {
  const hit = cache.get(url);
  if (hit) return hit;
  const p = (async () => {
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
  })();
  cache.set(url, p);
  return p;
}
