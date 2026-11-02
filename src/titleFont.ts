// Title-font rasterisation shared by the sliced window path (renderWindow.ts)
// and the built-in frame facade (proceduralFrameChrome.ts). Runtime font
// policy, not a decoded rule: the original draws in the system font (Chicago);
// the runtime substitutes the bundled Charcoal faces.
import { PixelBuffer } from './pixelBuffer.js';
import { TITLE_TEXT } from './engine/tables/window.js';

/** The ink-tight raster with its baseline row and the pen advance (StringWidth). */
export interface TitleRaster {
  buffer: PixelBuffer;
  /** Row of the alphabetic baseline inside `buffer`. */
  ascent: number;
  /** Pen advance in px (the StringWidth the frame measures). */
  advance: number;
  /** The font's ascent and descent (not the ink box): the metrics a frame's baseline rule uses. */
  fontAscent: number;
  fontDescent: number;
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

/** A resolved substitute style; supplying it prevents later preferred-size pinning. */
export interface TitleFontStyle {
  family: string;
  size: number;
  bold: boolean;
  spacing: string;
}
type TitleFontOptions = { exactPx?: boolean; bold?: boolean; style?: TitleFontStyle | undefined };

function preferredStyle(px: number, opts: TitleFontOptions): TitleFontStyle {
  // Charcoal 12 (Jeremy Sachs, CC BY-SA) prefers its crisp 16px grid, zero tracking; exactPx skips the pin.
  const c12 = !opts.exactPx && typeof document !== 'undefined' && !!document.fonts?.check?.('16px "Charcoal 12"');
  return {
    family: `${c12 ? '"Charcoal 12", ' : ''}Charcoal, "Helvetica Neue", Arial, sans-serif`,
    size: c12 ? 16 : px, bold: opts.bold ?? false, spacing: c12 ? '0px' : '0.5px',
  };
}

function setStyle(ctx: CanvasRenderingContext2D, style: TitleFontStyle): void {
  ctx.font = `${style.bold ? 'bold ' : ''}${style.size}px ${style.family}`;
  try { (ctx as unknown as { letterSpacing: string }).letterSpacing = style.spacing; } catch { /* unsupported */ }
}

/** TF2–TF5: fit the full title once, before advance/layout or horizontal truncation. */
export function resolveTitleStyle(text: string, px: number, clipForAdvance: (advance: number) => { w: number; h: number }, opts: TitleFontOptions = {}): { style: TitleFontStyle; omitInk: boolean } {
  const preferred = preferredStyle(px, opts);
  const probe = typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d');
  if (!probe || !text) return { style: preferred, omitInk: false };
  const fits = (style: TitleFontStyle): boolean => {
    setStyle(probe, style);
    const tm = probe.measureText(text);
    const clip = clipForAdvance(Math.ceil(tm.width));
    // Keep an already empty preferred slot; smaller empty slots cannot establish a fit.
    if (clip.w <= 0 || clip.h <= 0) return style === preferred;
    if (tm.actualBoundingBoxAscent === 0 && tm.actualBoundingBoxDescent === 0) return true;
    const ascent = Math.max(1, Math.ceil(tm.actualBoundingBoxAscent || style.size * 0.72));
    // Ink can end above the baseline (negative descent), unlike the allocated raster box.
    const descent = Math.ceil(tm.actualBoundingBoxDescent || 0);
    // F11 keeps the decoded baseline, moving down only by the ascent overflow.
    return Math.max(clip.h - TITLE_TEXT.TX8.baselineAbove, ascent) + descent <= clip.h;
  };
  if (fits(preferred)) return { style: preferred, omitInk: false };
  for (let size = Math.floor(preferred.size); size > 0; size--) {
    if (size === preferred.size) continue;
    const style = { ...preferred, size };
    if (fits(style)) return { style, omitInk: false };
  }
  return { style: preferred, omitInk: true };
}

/** As {@link rasterizeTitleFont}, also returning the baseline row and advance. */
export function measureTitle(text: string, px: number, opts: TitleFontOptions = {}): Pick<TitleRaster, 'ascent' | 'advance'> | null {
  return prepareTitle(text, px, '#000000', opts, true);
}

export function rasterizeTitle(text: string, px: number, hex: string, opts: TitleFontOptions = {}): TitleRaster | null {
  return prepareTitle(text, px, hex, opts, false) as TitleRaster | null;
}

function prepareTitle(text: string, px: number, hex: string, opts: TitleFontOptions, measureOnly: boolean): TitleRaster | Pick<TitleRaster, 'ascent' | 'advance'> | null {
  if (typeof document === 'undefined' || !text) return null;
  const style = opts.style ?? preferredStyle(px, opts);
  const size = style.size;
  const probe = document.createElement('canvas').getContext('2d');
  if (!probe) return null;
  setStyle(probe, style);
  const tm = probe.measureText(text);
  const w = Math.max(1, Math.ceil(tm.width) + 1);
  // Buffer sized tight to the text's ink box; the compositor centres this buffer in
  // the title bar (sgy, ~L220 below), so an ink-tight buffer lands the title without
  // any line-height fudge. Baseline at the ink ascent.
  const asc = Math.max(1, Math.ceil(tm.actualBoundingBoxAscent || size * 0.72));
  const desc = Math.max(0, Math.ceil(tm.actualBoundingBoxDescent || 0));
  const h = Math.max(1, asc + desc);
  if (measureOnly) return { ascent: asc, advance: Math.ceil(tm.width) };
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  setStyle(ctx, style);
  ctx.fillStyle = hex;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(text, 0, asc);
  const img = ctx.getImageData(0, 0, w, h);
  const buf = PixelBuffer.alloc(w, h);
  buf.data.set(img.data);
  const fontAscent = Math.ceil(tm.fontBoundingBoxAscent || asc);
  const fontDescent = Math.ceil(tm.fontBoundingBoxDescent || desc);
  return { buffer: buf, ascent: asc, advance: Math.ceil(tm.width), fontAscent, fontDescent };
}


/** TX5 / TruncString at end: retain the ellipsis even when no prefix fits. */
export function truncateTitle(text: string, room: number, measure: (text: string) => number): string {
  if (measure(text) <= room) return text;
  const glyphs = Array.from(text);
  for (let n = glyphs.length - 1; n > 0; n--) {
    const candidate = `${glyphs.slice(0, n).join('')}…`;
    if (measure(candidate) <= room) return candidate;
  }
  return '…';
}
