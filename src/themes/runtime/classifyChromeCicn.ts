// Classify a chrome cicn into one of three rendering kinds:
//
//   'titlebar-only' (Kind A) — thin horizontal strip; 3-slice on titlebar
//                              + 1px hairline frame on the window
//   'full-window'   (Kind B) — encodes the whole window frame; 9-slice
//                              on the window root
//   'fixed-bitmap'  (Kind C) — decoration doesn't tile; render at native
//                              size, fall back to closest-fit
//
// See docs/chrome-rendering-architecture.md for the full decision rules
// and per-scheme examples.

const cache = new Map<string, Promise<ChromeCicnKind>>();

export type ChromeCicnKind = 'titlebar-only' | 'full-window' | 'fixed-bitmap';

/**
 * Inspect the cicn at `url` and return its rendering kind.
 *
 * Heuristics:
 *   1. cicn-height ≤ 30  → titlebar-only
 *   2. cicn has a "body region" (4×4+ block of opaque near-white pixels
 *      surrounded by frame pixels) → full-window
 *   3. otherwise → fixed-bitmap
 *
 * Cached per URL.
 */
export function classifyChromeCicn(url: string): Promise<ChromeCicnKind> {
  const cached = cache.get(url);
  if (cached) return cached;
  const promise = classify(url);
  cache.set(url, promise);
  return promise;
}

async function classify(url: string): Promise<ChromeCicnKind> {
  try {
    const res = await fetch(url);
    if (!res.ok) return 'titlebar-only'; // safe default
    const bmp = await createImageBitmap(await res.blob());
    const w = bmp.width;
    const h = bmp.height;

    // Rule 1: short → titlebar-only.
    if (h <= 30) return 'titlebar-only';

    // Rule 2 + 3: look for a body region by sampling the cicn's center.
    // If the center area is mostly near-white / transparent (the "body"
    // backdrop), it's a full-window template — 9-slice will work.
    // If the center is mostly opaque non-white pixels, the cicn is a
    // fixed-bitmap decoration that won't tile cleanly.
    const canvas = new OffscreenCanvas(w, h);
    const ctx = canvas.getContext('2d');
    if (!ctx) return 'titlebar-only';
    ctx.drawImage(bmp, 0, 0);

    // Sample a 4×4 grid of points around the center quartile. If most are
    // body-like (transparent or near-white), it's full-window. Otherwise
    // it's fixed-bitmap.
    const cx0 = Math.floor(w * 0.35);
    const cx1 = Math.floor(w * 0.65);
    const cy0 = Math.floor(h * 0.45); // bias lower (titlebar is at top)
    const cy1 = Math.floor(h * 0.8);
    let bodyCount = 0;
    let total = 0;
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        const x = cx0 + Math.floor(((cx1 - cx0) * i) / 3);
        const y = cy0 + Math.floor(((cy1 - cy0) * j) / 3);
        const px = ctx.getImageData(x, y, 1, 1).data;
        if (isBodyLike(px[0]!, px[1]!, px[2]!, px[3]!)) bodyCount++;
        total++;
      }
    }
    // Need MOST of the center to be body-like to call it full-window.
    return bodyCount >= Math.floor(total * 0.65) ? 'full-window' : 'fixed-bitmap';
  } catch {
    return 'titlebar-only';
  }
}

/** "Body" pixel: transparent OR very light (white-ish background). */
function isBodyLike(r: number, g: number, b: number, a: number): boolean {
  if (a < 128) return true;
  if (r >= 220 && g >= 220 && b >= 220) return true;
  return false;
}

/** Test helper. */
export function _resetClassifyCacheForTests(): void {
  cache.clear();
}
