// Derive window-frame geometry at runtime from the chrome cicn.
//
// The theme palette pre-fills generic values; the cicn pixels are the
// ground truth. We sample:
//   - The first opaque outer pixel → frame *color* (for backstop fill)
//   - The opaque-pixel run inward from each edge → frame *thickness*
//     (1-2px for thin schemes like 7 Le; 5-6px for beveled schemes like
//     ErgoBox where the cicn carries the full bordered window)
//
// Both are cached per cicn URL — sampling is async (image load + canvas
// readback) but the answer is stable for the life of the bundled image.

export interface FrameGeometry {
  /** First opaque outer pixel color, e.g. '#000000'. Null if all transparent. */
  color: string | null;
  /** Thickness in cicn pixels: how far inward the contiguous opaque
   * "border" extends from each edge before reaching the body. */
  top: number;
  right: number;
  bottom: number;
  left: number;
}

const colorCache = new Map<string, Promise<string | null>>();
const geometryCache = new Map<string, Promise<FrameGeometry | null>>();

/**
 * Sample the cicn at `url` and return the first opaque pixel found in
 * its outer column or row, as a CSS color string (`#rrggbb` for opaque
 * grayscale/color, `rgba(...)` otherwise).
 *
 * Returns null if the image can't load or has no opaque outer pixel.
 *
 * Sampling order: left column top→bottom, then right column. Stops on
 * first opaque (alpha=255) pixel found. This favors the frame line over
 * any anti-aliased / transparent corner pixels.
 */
export function deriveFrameColor(url: string): Promise<string | null> {
  const cached = colorCache.get(url);
  if (cached) return cached;
  const promise = sampleColor(url);
  colorCache.set(url, promise);
  return promise;
}

/**
 * Scan the cicn from each edge inward and return the per-side thickness
 * of the contiguous opaque "border" region. Stops counting when it
 * encounters either a fully-transparent pixel OR a near-white pixel
 * (heuristic: the body content area starts at near-white in most
 * Kaleidoscope schemes; sufficient for both canonical bundles).
 *
 * Sampling location: each side's MIDDLE pixel (mid-row for left/right,
 * mid-column for top/bottom). Picks middle to avoid corner artifacts
 * (transparent rounded corners, decorative widgets at top edge).
 */
export function deriveFrameGeometry(url: string): Promise<FrameGeometry | null> {
  const cached = geometryCache.get(url);
  if (cached) return cached;
  const promise = sampleGeometry(url);
  geometryCache.set(url, promise);
  return promise;
}

async function sampleColor(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const bmp = await createImageBitmap(await res.blob());
    const canvas = new OffscreenCanvas(bmp.width, bmp.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(bmp, 0, 0);

    for (const x of [0, bmp.width - 1]) {
      for (let y = 0; y < bmp.height; y++) {
        const px = ctx.getImageData(x, y, 1, 1).data;
        if (px[3] === 255) return rgbToHex(px[0]!, px[1]!, px[2]!);
      }
    }
    return null;
  } catch {
    return null;
  }
}

async function sampleGeometry(url: string): Promise<FrameGeometry | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const bmp = await createImageBitmap(await res.blob());
    const canvas = new OffscreenCanvas(bmp.width, bmp.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(bmp, 0, 0);

    const w = bmp.width;
    const h = bmp.height;
    const midX = Math.floor(w / 2);
    const midY = Math.floor(h / 2);

    // Top thickness isn't used by the window-frame painter (the titlebar
    // handles its own chrome via the 3-slice border-image). Just 0.
    const top = 0;

    // Scan from each edge inward at the mid-axis. The scan returns the
    // count of contiguous "border" pixels before hitting a body pixel
    // (transparent or near-white).
    //
    // For full-window cicns (e.g., ErgoBox 132×64), this gives the true
    // beveled-border thickness — 6 for both left/right + bottom.
    //
    // For titlebar-only cicns (e.g., 7 Le 74×25), the scan goes all the
    // way across because there's no body region inside the cicn. Cap at
    // a maximum reasonable thickness (= 1/4 of the perpendicular extent
    // OR 8px, whichever is larger), and clamp anything over the cap to
    // 1 — interpreted as "no rich side border, use a single-pixel
    // hairline."
    const maxFromEdge = (extent: number): number => Math.max(8, Math.floor(extent / 4));
    const capH = maxFromEdge(w);
    const capV = maxFromEdge(h);

    const left = clampScan(countBorderPixels(ctx, 0, midY, +1, 0, w), capH);
    const right = clampScan(countBorderPixels(ctx, w - 1, midY, -1, 0, w), capH);
    const bottom = clampScan(countBorderPixels(ctx, midX, h - 1, 0, -1, h), capV);

    let color: string | null = null;
    for (const y of [midY, 0, h - 1]) {
      const px = ctx.getImageData(0, y, 1, 1).data;
      if (px[3] === 255) { color = rgbToHex(px[0]!, px[1]!, px[2]!); break; }
    }

    return { color, top, right, bottom, left };
  } catch {
    return null;
  }
}

/** Clamp the scan: if it returned more than the cap, the cicn likely
 *  has no body region (titlebar-only) — fall back to 1px. Otherwise
 *  return as-is. Floor of 1 to ensure we always render *some* frame. */
function clampScan(measured: number, cap: number): number {
  if (measured === 0) return 1;
  if (measured > cap) return 1;
  return measured;
}

/**
 * Walk one pixel at a time from (sx, sy) in direction (dx, dy). Return
 * how many consecutive "border" pixels were found before hitting a
 * "body" pixel (transparent or near-white).
 */
function countBorderPixels(
  ctx: OffscreenCanvasRenderingContext2D,
  sx: number,
  sy: number,
  dx: number,
  dy: number,
  maxSteps: number,
): number {
  let count = 0;
  let x = sx;
  let y = sy;
  for (let i = 0; i < maxSteps; i++) {
    const px = ctx.getImageData(x, y, 1, 1).data;
    if (isBody(px[0]!, px[1]!, px[2]!, px[3]!)) break;
    count++;
    x += dx;
    y += dy;
  }
  return count;
}

/**
 * Heuristic "is this a body pixel rather than a border pixel":
 *   - Fully transparent (alpha < 255) → body
 *   - Near-white (r,g,b all ≥ 240) → body
 *
 * Both canonical bundles use white (#fff or transparent) for the
 * window content interior, so this catches the "border ends here"
 * transition reliably for them.
 */
function isBody(r: number, g: number, b: number, a: number): boolean {
  if (a < 255) return true;
  if (r >= 240 && g >= 240 && b >= 240) return true;
  return false;
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')}`;
}

/** Test helper: reset all caches. */
export function _resetFrameColorCacheForTests(): void {
  colorCache.clear();
  geometryCache.clear();
}
