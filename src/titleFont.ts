// Title-font rasterisation shared by the sliced window path (renderWindow.ts)
// and the built-in frame facade (proceduralFrameChrome.ts). Runtime font
// policy, not a decoded rule: the original draws in the system font (Chicago);
// the runtime substitutes the bundled Charcoal faces.
import { PixelBuffer } from './pixelBuffer.js';

/** The ink-tight raster with its baseline row and the pen advance (StringWidth). */
export interface TitleRaster {
  buffer: PixelBuffer;
  /** Row of the alphabetic baseline inside `buffer`. */
  ascent: number;
  /** Pen advance in px (the StringWidth the frame measures). */
  advance: number;
}

/**
 * Rasterize the window title in a real FONT (the CSS "Charcoal" stack — a local
 * Charcoal if installed, else the bundled stand-in) via an offscreen canvas, so
 * the title reads as period anti-aliased type rather than the bitmap rasterizer.
 * Browser-only: returns null in a non-DOM context so the caller falls back to
 * rasterizeText (the crisp pixel path, used by node tooling).
 */
export function rasterizeTitleFont(text: string, px: number, hex: string): PixelBuffer | null {
  return rasterizeTitle(text, px, hex)?.buffer ?? null;
}

/** As {@link rasterizeTitleFont}, also returning the baseline row and advance. */
export function rasterizeTitle(text: string, px: number, hex: string): TitleRaster | null {
  if (typeof document === 'undefined' || !text) return null;
  // Charcoal 12 (Jeremy Sachs, CC BY-SA — a bitmap clone of Mac OS 8/9 Charcoal) is
  // crisp ONLY at its grid-native 16px: the finest design step (125 of 2000 em
  // units) maps to exactly 1px there, so every brick edge lands on a pixel. When
  // it's loaded we pin to 16px with ZERO tracking (off-grid advances would
  // re-introduce anti-aliasing) and an integer baseline — the native buffer then
  // upscales pixelated, keeping it blocky-crisp. Otherwise fall back to the
  // Charcoal stack (Virtue) at the requested px with a hair of tracking for air.
  const c12 = !!document.fonts?.check?.('16px "Charcoal 12"');
  const size = c12 ? 16 : px;
  const font = c12
    ? `16px "Charcoal 12", Charcoal, "Helvetica Neue", Arial, sans-serif`
    : `${px}px Charcoal, "Helvetica Neue", Arial, sans-serif`;
  const LS = c12 ? '0px' : '0.5px';
  const setLS = (c2d: CanvasRenderingContext2D): void => {
    try { (c2d as unknown as { letterSpacing: string }).letterSpacing = LS; } catch { /* unsupported */ }
  };
  const probe = document.createElement('canvas').getContext('2d');
  if (!probe) return null;
  probe.font = font;
  setLS(probe);
  const tm = probe.measureText(text);
  const w = Math.max(1, Math.ceil(tm.width) + 1);
  // Buffer sized tight to the text's ink box; the compositor centres this buffer in
  // the title bar (sgy, ~L220 below), so an ink-tight buffer lands the title without
  // any line-height fudge. Baseline at the ink ascent.
  const asc = Math.max(1, Math.ceil(tm.actualBoundingBoxAscent || size * 0.72));
  const desc = Math.max(0, Math.ceil(tm.actualBoundingBoxDescent || 0));
  const h = Math.max(1, asc + desc);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  ctx.font = font;
  setLS(ctx);
  ctx.fillStyle = hex;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(text, 0, asc);
  const img = ctx.getImageData(0, 0, w, h);
  const buf = PixelBuffer.alloc(w, h);
  buf.data.set(img.data);
  return { buffer: buf, ascent: asc, advance: Math.ceil(tm.width) };
}

