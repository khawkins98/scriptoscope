// Color extraction from cicn pixels — spec B §4.16-§4.18.
//
// Many Kaleidoscope schemes ship color-only cicns: cicn IDs in the
// dialog/alert/Finder ranges that are NOT rendered as bitmaps but
// SAMPLED at specific pixels to extract colors. Per K2 + the binary's
// cinf TMPL 129, the canonical sample coordinates are:
//
//   - cinf.bgPixel      → background color
//   - cinf.textPixel    → foreground / text color
//   - cinf.embossPixel  → emboss highlight color
//
// We surface these as bgAnchor / textAnchor / embossAnchor on
// ChromeElementEntry (the cinf-derived anchors).
//
// Discovered via the Kaleidoscope 1.8.2 kDEF disassembly — see
// docs/tracking/kdef-disassembly-findings.md §3 (§13.4 closure).
//
// This module is a small async helper: given a ChromeElementEntry,
// fetch its cicn PNG, read the anchored pixels via an OffscreenCanvas,
// return them as CSS color strings.

import type { ChromeElementEntry } from '../schema/types.js';

export interface ExtractedColors {
  bg?: string;
  fg?: string;
  emboss?: string;
}

/**
 * Sample bgAnchor / textAnchor / embossAnchor pixels from a chrome
 * element's cicn. Returns CSS color strings.
 *
 * No anchors set → returns `{}`. Asset fetch failure → returns `{}`.
 * Per spec B §9 fallback chain, callers should be resilient to empty
 * results.
 */
export async function extractColorsFromCicn(
  entry: ChromeElementEntry,
): Promise<ExtractedColors> {
  if (!entry.bgAnchor && !entry.textAnchor && !entry.embossAnchor) return {};
  if (!entry.asset) return {};
  try {
    const img = await fetchImage(entry.asset);
    const ctx = createSampleContext(img.width, img.height);
    if (!ctx) return {};
    ctx.drawImage(img, 0, 0);
    const out: ExtractedColors = {};
    if (entry.bgAnchor) {
      const c = sampleAt(ctx, entry.bgAnchor[0], entry.bgAnchor[1], img.width, img.height);
      if (c) out.bg = c;
    }
    if (entry.textAnchor) {
      const c = sampleAt(ctx, entry.textAnchor[0], entry.textAnchor[1], img.width, img.height);
      if (c) out.fg = c;
    }
    if (entry.embossAnchor) {
      const c = sampleAt(ctx, entry.embossAnchor[0], entry.embossAnchor[1], img.width, img.height);
      if (c) out.emboss = c;
    }
    return out;
  } catch {
    return {};
  }
}

// ─── Internals ─────────────────────────────────────────────────────────

async function fetchImage(url: string): Promise<HTMLImageElement | ImageBitmap> {
  // Prefer createImageBitmap (works in browser + jsdom-with-shim);
  // fall back to <img> for plain browser environments.
  if (typeof createImageBitmap === 'function' && typeof fetch === 'function') {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
    const blob = await res.blob();
    return await createImageBitmap(blob);
  }
  return await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`<img> load failed: ${url}`));
    img.src = url;
  });
}

function createSampleContext(w: number, h: number): CanvasRenderingContext2D | null {
  // OffscreenCanvas in modern browsers; <canvas> fallback in jsdom.
  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(w, h);
    return canvas.getContext('2d') as unknown as CanvasRenderingContext2D | null;
  }
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    return canvas.getContext('2d');
  }
  return null;
}

function sampleAt(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
): string | null {
  if (x < 0 || y < 0 || x >= w || y >= h) return null;
  const data = ctx.getImageData(x, y, 1, 1).data;
  const r = data[0]!, g = data[1]!, b = data[2]!, a = data[3]!;
  if (a === 0) return null;
  return a === 255
    ? `rgb(${r}, ${g}, ${b})`
    : `rgba(${r}, ${g}, ${b}, ${(a / 255).toFixed(3)})`;
}
