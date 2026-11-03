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
interface TitleRequest {
  context?: CanvasRenderingContext2D;
  last?: { text: string; style: TitleFontStyle; metrics: TextMetrics };
}
/** One render owns this lazy probe; keep no font or prefix cache across requests. */
export const createTitleRequest = (): TitleRequest => ({});
type TitleFontOptions = { exactPx?: boolean; bold?: boolean; style?: TitleFontStyle | undefined; request?: TitleRequest };

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
const QUERY_WIDTH = TILE_WIDTH - 2, QUERY_HEIGHT = TILE_HEIGHT - 2;
type TitleClip = { x: number; y: number; w: number; h: number };

function unavailable(reason: string): never {
  const error = new Error(`Title coverage unavailable: ${reason}`);
  error.name = 'TitleCoverageUnavailableError';
  throw error;
}

function measurement<T>(operation: () => T): T {
  try {
    return operation();
  } catch (error) {
    if (error instanceof Error && error.name === 'TitleCoverageUnavailableError') throw error;
    unavailable(error instanceof Error ? error.message : 'host measurement failure');
  }
}

function measurementContext(request?: TitleRequest): CanvasRenderingContext2D | null {
  if (request?.context) return request.context;
  if (typeof document === 'undefined') return null;
  try {
    const canvas = document.createElement('canvas');
    // Metrics need no pixel backing store.
    canvas.height = 0; canvas.width = 0;
    const context = canvas.getContext('2d');
    if (request && context) request.context = context;
    return context;
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

function advance(width: number): number {
  coordinate(width);
  if (width < 0) unavailable('unusable advance');
  return coordinate(Math.ceil(width));
}

function nominalAscent(actualAscent: number, style: TitleFontStyle): number {
  coordinate(actualAscent); coordinate(style.size);
  if (style.size <= 0) unavailable('unusable font size');
  return coordinate(Math.max(1, Math.ceil(actualAscent || style.size * .72)));
}

function textMetrics(ctx: CanvasRenderingContext2D, text: string, style: TitleFontStyle, request?: TitleRequest): TextMetrics {
  setStyle(ctx, style);
  const last = request?.last;
  if (last?.text === text && last.style.family === style.family && last.style.size === style.size &&
      last.style.bold === style.bold && last.style.spacing === style.spacing) return last.metrics;
  const measured = ctx.measureText(text);
  if (request) request.last = { text, style: { ...style }, metrics: measured };
  return measured;
}

function metrics(ctx: CanvasRenderingContext2D, text: string, style: TitleFontStyle, request?: TitleRequest): TitleMetrics {
  const tm = textMetrics(ctx, text, style, request);
  const ascent = nominalAscent(tm.actualBoundingBoxAscent, style);
  coordinate(tm.actualBoundingBoxDescent);
  if (coordinate(tm.actualBoundingBoxAscent + tm.actualBoundingBoxDescent) < 0) unavailable('unusable actual bounds');
  // Font bounds may be absent or zero; other unusable reports must not select a fallback.
  if (tm.fontBoundingBoxAscent !== undefined) coordinate(tm.fontBoundingBoxAscent);
  if (tm.fontBoundingBoxDescent !== undefined) coordinate(tm.fontBoundingBoxDescent);
  const descent = Math.max(0, Math.ceil(tm.actualBoundingBoxDescent || 0));
  return { ascent, advance: advance(tm.width),
    fontAscent: coordinate(Math.ceil(tm.fontBoundingBoxAscent || ascent)),
    fontDescent: coordinate(Math.ceil(tm.fontBoundingBoxDescent || descent)) };
}

/** P1: signed complete-request bounds plus the declared em and pixel allowance. */
function envelope(tm: TextMetrics, style: TitleFontStyle, x: number, baseline: number) {
  const values = [tm.width, tm.actualBoundingBoxLeft, tm.actualBoundingBoxRight,
    tm.actualBoundingBoxAscent, tm.actualBoundingBoxDescent, style.size];
  if (values.some(v => !Number.isFinite(v)) || tm.width < 0 || style.size <= 0 ||
      tm.actualBoundingBoxLeft + tm.actualBoundingBoxRight < 0 ||
      tm.actualBoundingBoxAscent + tm.actualBoundingBoxDescent < 0) unavailable('unusable actual bounds');
  values.forEach(coordinate);
  const metricLeft = coordinate(x - tm.actualBoundingBoxLeft);
  const metricRight = coordinate(x + tm.actualBoundingBoxRight);
  const metricTop = coordinate(baseline - tm.actualBoundingBoxAscent);
  const metricBottom = coordinate(baseline + tm.actualBoundingBoxDescent);
  if (metricLeft > metricRight || metricTop > metricBottom) unavailable('unusable actual bounds');
  const padding = style.size + 1;
  const left = coordinate(Math.floor(metricLeft - padding));
  const right = coordinate(Math.ceil(metricRight + padding));
  const top = coordinate(Math.floor(metricTop - padding));
  const bottom = coordinate(Math.ceil(metricBottom + padding));
  const width = coordinate(right - left), height = coordinate(bottom - top);
  const columns = Math.ceil(width / QUERY_WIDTH), rows = Math.ceil(height / QUERY_HEIGHT);
  if (width <= 0 || height <= 0 || !Number.isSafeInteger(columns * rows)) unavailable('unusable traversal');
  return { left, right, top, bottom, columns, rows, metricLeft, metricRight, metricTop, metricBottom };
}

/** Exact per-axis projection construction; query ownership is independent of paint overlap. */
function paintInterval(first: number, last: number, metricFirst: number, metricLast: number, limit: number) {
  const extent = coordinate(last - first);
  const midpoint = coordinate(first + extent / 2);
  if (midpoint - first !== extent / 2) unavailable('unrepresentable query midpoint');
  const anchor = Math.max(metricFirst, Math.min(metricLast, midpoint));
  const origin = coordinate(Math.min(first, Math.floor(anchor)) - 1);
  const end = coordinate(Math.max(last, Math.ceil(anchor)) + 1);
  const size = coordinate(end - origin);
  if (!Number.isSafeInteger(size) || size <= 0 || size > limit ||
      origin >= first || end <= last || origin >= anchor || end <= anchor) unavailable('unusable paint window');
  return { origin, size };
}

function scratch(width: number, height: number, style: TitleFontStyle) {
  const canvas = document.createElement('canvas');
  // Drop the default backing store before widening; every resize stays bounded.
  canvas.height = 0;
  canvas.width = width; canvas.height = height;
  if (canvas.width !== width || canvas.height !== height) unavailable('scratch allocation');
  // Use the host's default canvas backend, not `willReadFrequently`. In WebKit
  // that hint switches to a different text rasteriser, so coverage queried here
  // would no longer match the glyphs a plain host canvas draws (P1-G).
  const ctx = canvas.getContext('2d');
  if (!ctx) unavailable('scratch context');
  setStyle(ctx, style);
  ctx.textBaseline = 'alphabetic';
  return { canvas, ctx };
}

/** TF2–TF5: resolve the full request; unknown coverage throws before any smaller candidate. */
export function resolveTitleStyle(text: string, px: number,
  clipForAdvance: (advance: number) => { x?: number; y?: number; w: number; h: number },
  opts: TitleFontOptions = {}): { style: TitleFontStyle; omitInk: boolean } {
  const preferred = measurement(() => preferredStyle(px, opts));
  const probe = measurementContext(opts.request);
  if (!probe || !text) return { style: preferred, omitInk: false };
  // A single fixed raster is reused across every tile and candidate.
  let tile: ReturnType<typeof scratch> | undefined;
  const fits = (style: TitleFontStyle): boolean => {
    const tm = textMetrics(probe, text, style, opts.request);
    const clip = clipForAdvance(advance(tm.width));
    if (clip.w <= 0 || clip.h <= 0) return style === preferred;
    const x = coordinate(clip.x ?? 0), top = coordinate(clip.y ?? 0);
    const bottom = coordinate(top + clip.h);
    coordinate(clip.w); coordinate(clip.h);
    const ascent = nominalAscent(tm.actualBoundingBoxAscent, style);
    const baseline = coordinate(Math.max(bottom - TITLE_TEXT.TX8.baselineAbove, top + ascent));
    const bounds = envelope(tm, style, x, baseline);
    if (bounds.top >= top && bounds.bottom <= bottom) return true;
    tile ??= scratch(TILE_WIDTH, TILE_HEIGHT, style);
    // The disjoint envelope partition owns every absolute exterior pixel once.
    // P1 query equivalence remains a supported-placement premise, not a culling proof.
    for (let rowIndex = 0; rowIndex < bounds.rows; rowIndex++) {
      const first = coordinate(bounds.top + coordinate(rowIndex * QUERY_HEIGHT));
      const last = coordinate(first + Math.min(QUERY_HEIGHT, bounds.bottom - first));
      if (first >= top && last <= bottom) continue;
      const vertical = paintInterval(first, last, bounds.metricTop, bounds.metricBottom, TILE_HEIGHT);
      for (let columnIndex = 0; columnIndex < bounds.columns; columnIndex++) {
        const left = coordinate(bounds.left + coordinate(columnIndex * QUERY_WIDTH));
        const right = coordinate(left + Math.min(QUERY_WIDTH, bounds.right - left));
        const horizontal = paintInterval(left, right, bounds.metricLeft, bounds.metricRight, TILE_WIDTH);
        const pen = translated(x, horizontal.origin), baselineRow = translated(baseline, vertical.origin);
        // Resize the same canvas, dropping its backing height before changing width.
        // No intermediate store exceeds the fixed bound, even at a partial corner.
        if (tile.canvas.width !== horizontal.size || tile.canvas.height !== vertical.size) {
          tile.canvas.height = 0;
          tile.canvas.width = horizontal.size; tile.canvas.height = vertical.size;
          if (tile.canvas.width !== horizontal.size || tile.canvas.height !== vertical.size) unavailable('scratch allocation');
        }
        setStyle(tile.ctx, style);
        tile.ctx.textBaseline = 'alphabetic';
        tile.ctx.clearRect(0, 0, horizontal.size, vertical.size);
        tile.ctx.fillText(text, pen, baselineRow);
        const w = right - left, h = last - first;
        const image = tile.ctx.getImageData(left - horizontal.origin, first - vertical.origin, w, h);
        if (image.data.length !== w * h * 4) unavailable('incomplete readback');
        for (let row = 0; row < h; row++) {
          const absoluteRow = coordinate(first + row);
          if (absoluteRow >= top && absoluteRow + 1 <= bottom) continue;
          for (let column = 0; column < w; column++) {
            if (image.data[(row * w + column) * 4 + 3] !== 0) return false;
          }
        }
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
  const probe = measurementContext(opts.request);
  if (!probe) return null;
  return measurement(() => {
    const style = opts.style ?? preferredStyle(px, opts);
    return metrics(probe, text, style, opts.request);
  });
}

/** Paint at the public pen/baseline through scratch bounded by the destination. */
export function paintTitle(target: PixelBuffer, text: string, px: number, hex: string,
  x: number, baseline: number, clip: TitleClip, opts: TitleFontOptions = {}): boolean {
  if (typeof document === 'undefined' || !text) return false;
  const probe = measurementContext(opts.request);
  if (!probe) return false;
  try {
    const left = coordinate(Math.max(0, Math.floor(clip.x)));
    const top = coordinate(Math.max(0, Math.floor(clip.y)));
    const right = coordinate(Math.min(target.width, Math.ceil(clip.x + clip.w)));
    const bottom = coordinate(Math.min(target.height, Math.ceil(clip.y + clip.h)));
    if (right <= left || bottom <= top) return true;
    const style = opts.style ?? preferredStyle(px, opts);
    const { ctx } = scratch(right - left, bottom - top, style);
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
  const measured = (value: string) => measurement(() => {
    const width = measure(value);
    coordinate(width);
    if (width < 0) unavailable('unusable advance');
    return width;
  });
  if (measured(text) <= room) return text;
  const glyphs = Array.from(text);
  for (let n = glyphs.length - 1; n > 0; n--) {
    const candidate = `${glyphs.slice(0, n).join('')}…`;
    if (measured(candidate) <= room) return candidate;
  }
  measured('…');
  return '…';
}
