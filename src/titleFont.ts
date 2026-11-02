// Title-font rasterisation shared by the sliced window path (renderWindow.ts)
// and the built-in frame facade (proceduralFrameChrome.ts). Runtime font
// policy, not a decoded rule: the original draws in the system font (Chicago);
// the runtime substitutes the bundled Charcoal faces.
import { PixelBuffer } from './pixelBuffer.js';
import { TITLE_TEXT } from './engine/tables/window.js';

/** Metrics retain the consumer's nominal baseline, independently of raster storage. */
export interface TitleMetrics {
  ascent: number;
  advance: number;
  fontAscent: number;
  fontDescent: number;
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

const TILE_WIDTH = 4096, TILE_HEIGHT = 32;
type TitleClip = { x: number; y: number; w: number; h: number };

function unavailable(reason: string): never {
  const error = new Error(`Title coverage unavailable: ${reason}`);
  error.name = 'TitleCoverageUnavailableError';
  throw error;
}

function measurementContext(): CanvasRenderingContext2D | null {
  if (typeof document === 'undefined') return null;
  try {
    const canvas = document.createElement('canvas');
    // Metrics need no pixel backing store.
    canvas.height = 0; canvas.width = 0;
    return canvas.getContext('2d');
  } catch (error) {
    unavailable(error instanceof Error ? error.message : 'host context failure');
  }
}

function coordinate(value: number): number {
  if (!Number.isFinite(value) || Math.abs(value) > Number.MAX_SAFE_INTEGER) unavailable('unusable coordinate');
  return value;
}

/** Integer storage translations must retain the original subpixel phase. */
function translated(value: number, origin: number): number {
  const result = coordinate(value - origin);
  if (result - Math.floor(result) !== value - Math.floor(value)) unavailable('unrepresentable raster phase');
  return result;
}

function metrics(ctx: CanvasRenderingContext2D, text: string, style: TitleFontStyle): TitleMetrics {
  const tm = ctx.measureText(text);
  const ascent = Math.max(1, Math.ceil(tm.actualBoundingBoxAscent || style.size * .72));
  const descent = Math.max(0, Math.ceil(tm.actualBoundingBoxDescent || 0));
  return { ascent, advance: Math.ceil(tm.width),
    fontAscent: Math.ceil(tm.fontBoundingBoxAscent || ascent),
    fontDescent: Math.ceil(tm.fontBoundingBoxDescent || descent) };
}

/** P1: signed complete-request bounds plus the declared em and pixel allowance. */
function envelope(tm: TextMetrics, style: TitleFontStyle, x: number, baseline: number) {
  const values = [tm.width, tm.actualBoundingBoxLeft, tm.actualBoundingBoxRight,
    tm.actualBoundingBoxAscent, tm.actualBoundingBoxDescent, style.size];
  if (values.some(v => !Number.isFinite(v)) || tm.width < 0 || style.size <= 0 ||
      tm.actualBoundingBoxLeft + tm.actualBoundingBoxRight < 0 ||
      tm.actualBoundingBoxAscent + tm.actualBoundingBoxDescent < 0) unavailable('unusable actual bounds');
  const padding = style.size + 1;
  const left = coordinate(Math.floor(x - tm.actualBoundingBoxLeft - padding));
  const right = coordinate(Math.ceil(x + tm.actualBoundingBoxRight + padding));
  const top = coordinate(Math.floor(baseline - tm.actualBoundingBoxAscent - padding));
  const bottom = coordinate(Math.ceil(baseline + tm.actualBoundingBoxDescent + padding));
  const width = coordinate(right - left), height = coordinate(bottom - top);
  if (!Number.isSafeInteger(Math.ceil(width / TILE_WIDTH) * Math.ceil(height / TILE_HEIGHT))) unavailable('unusable traversal');
  return { left, right, top, bottom };
}

function scratch(width: number, height: number, style: TitleFontStyle) {
  const canvas = document.createElement('canvas');
  // Drop the default backing store before widening; every resize stays bounded.
  canvas.height = 0;
  canvas.width = width; canvas.height = height;
  if (canvas.width !== width || canvas.height !== height) unavailable('scratch allocation');
  const ctx = canvas.getContext('2d');
  if (!ctx) unavailable('scratch context');
  setStyle(ctx, style);
  ctx.textBaseline = 'alphabetic';
  return ctx;
}

/** TF2–TF5: resolve the full request; unknown coverage throws before any smaller candidate. */
export function resolveTitleStyle(text: string, px: number,
  clipForAdvance: (advance: number) => { x?: number; y?: number; w: number; h: number },
  opts: TitleFontOptions = {}): { style: TitleFontStyle; omitInk: boolean } {
  const preferred = preferredStyle(px, opts);
  const probe = measurementContext();
  if (!probe || !text) return { style: preferred, omitInk: false };
  // A single fixed raster is reused across every tile and candidate.
  let tile: CanvasRenderingContext2D | undefined;
  const fits = (style: TitleFontStyle): boolean => {
    setStyle(probe, style);
    const tm = probe.measureText(text);
    const clip = clipForAdvance(coordinate(Math.ceil(tm.width)));
    if (clip.w <= 0 || clip.h <= 0) return style === preferred;
    const x = coordinate(clip.x ?? 0), top = coordinate(clip.y ?? 0);
    const bottom = coordinate(top + clip.h);
    coordinate(clip.w); coordinate(clip.h);
    const ascent = Math.max(1, Math.ceil(tm.actualBoundingBoxAscent || style.size * .72));
    const baseline = coordinate(Math.max(bottom - TITLE_TEXT.TX8.baselineAbove, top + ascent));
    const bounds = envelope(tm, style, x, baseline);
    if (bounds.top >= top && bounds.bottom <= bottom) return true;
    tile ??= scratch(TILE_WIDTH, TILE_HEIGHT, style);
    setStyle(tile, style);
    // Only exterior rows can disprove fit. Every tile shapes the identical full request.
    const regions: [number, number][] = [[bounds.top, Math.min(bounds.bottom, Math.ceil(top))],
      [Math.max(bounds.top, Math.floor(bottom)), bounds.bottom]];
    for (const [first, last] of regions) {
      for (let y = first; y < last;) {
        const h = Math.min(TILE_HEIGHT, last - y);
        for (let left = bounds.left; left < bounds.right;) {
          const w = Math.min(TILE_WIDTH, bounds.right - left);
          tile.clearRect(0, 0, TILE_WIDTH, TILE_HEIGHT);
          tile.fillText(text, translated(x, left), translated(baseline, y));
          const image = tile.getImageData(0, 0, w, h);
          if (image.data.length !== w * h * 4) unavailable('incomplete readback');
          for (let row = 0; row < h; row++) {
            if (y + row >= top && y + row + 1 <= bottom) continue;
            for (let column = 0; column < w; column++) {
              if (image.data[(row * w + column) * 4 + 3] !== 0) return false;
            }
          }
          left += w;
        }
        y += h;
      }
    }
    return true;
  };
  try {
    if (fits(preferred)) return { style: preferred, omitInk: false };
    for (let size = Math.floor(preferred.size); size > 0; size--) {
      if (size === preferred.size) continue;
      const style = { ...preferred, size };
      if (fits(style)) return { style, omitInk: false };
    }
    return { style: preferred, omitInk: true };
  } catch (error) {
    if (error instanceof Error && error.name === 'TitleCoverageUnavailableError') throw error;
    unavailable(error instanceof Error ? error.message : 'host observation failure');
  }
}

/** Measurement never allocates a requested-title pixel surface. */
export function measureTitle(text: string, px: number, opts: TitleFontOptions = {}): TitleMetrics | null {
  if (typeof document === 'undefined' || !text) return null;
  const probe = measurementContext();
  if (!probe) return null;
  const style = opts.style ?? preferredStyle(px, opts);
  setStyle(probe, style);
  return metrics(probe, text, style);
}

/** Paint at the public pen/baseline through scratch bounded by the destination. */
export function paintTitle(target: PixelBuffer, text: string, px: number, hex: string,
  x: number, baseline: number, clip: TitleClip, opts: TitleFontOptions = {}): boolean {
  if (typeof document === 'undefined' || !text) return false;
  const probe = measurementContext();
  if (!probe) return false;
  try {
    const left = coordinate(Math.max(0, Math.floor(clip.x)));
    const top = coordinate(Math.max(0, Math.floor(clip.y)));
    const right = coordinate(Math.min(target.width, Math.ceil(clip.x + clip.w)));
    const bottom = coordinate(Math.min(target.height, Math.ceil(clip.y + clip.h)));
    if (right <= left || bottom <= top) return true;
    const style = opts.style ?? preferredStyle(px, opts);
    const ctx = scratch(right - left, bottom - top, style);
    ctx.fillStyle = hex;
    ctx.fillText(text, translated(x, left), translated(baseline, top));
    const img = ctx.getImageData(0, 0, right - left, bottom - top);
    if (img.data.length !== (right - left) * (bottom - top) * 4) unavailable('incomplete publication readback');
    target.drawOver(new PixelBuffer(right - left, bottom - top, img.data), left, top, clip);
    return true;
  } catch (error) {
    if (error instanceof Error && error.name === 'TitleCoverageUnavailableError') throw error;
    unavailable(error instanceof Error ? error.message : 'host publication failure');
  }
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
