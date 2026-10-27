import type { Pixmap, QdPoint, QdRect, Rgba, TileDirection, Transfer } from './engine/qd/types.js';
import type { EngineTrace } from './engine/trace.js';
import { emptyRect, offsetRect, rectXYWH } from './engine/qd/rect.js';
import { axis } from './engine/qd/axis.js';

export interface PixRect { x: number; y: number; w: number; h: number; }
export interface IconSource {
  readonly pixmap: Pixmap;
  readonly pixelSize: number | null;
  readonly unmasked: Pixmap | null;
  readonly fallback?: string;
  readonly origin?: { readonly top: number; readonly left: number } | null;
  readonly sampling?: 'equivalent' | 'different' | 'unknown' | null;
  readonly sampled?: Pixmap | null;
}
export type OutsideSource = 'transparent' | 'untouched';
export interface Region { readonly width: number; readonly height: number; readonly bits: Uint8Array; }

export function pixelIndex(p: Pick<Pixmap, 'width' | 'height'>, x: number, y: number): number {
  return x < 0 || y < 0 || x >= p.width || y >= p.height ? -1 : (y * p.width + x) * 4;
}
export function getPixel(p: Pixmap, x: number, y: number): Rgba | null {
  const i = pixelIndex(p, x, y);
  if (i < 0) return null;
  const d = p.data;
  return { r: d[i]!, g: d[i + 1]!, b: d[i + 2]!, a: d[i + 3]! };
}
export function readPixel(p: Pixmap, x: number, y: number): [number, number, number, number] {
  const i = pixelIndex(p, x, y);
  if (i < 0) return [0, 0, 0, 0];
  const d = p.data;
  return [d[i]!, d[i + 1]!, d[i + 2]!, d[i + 3]!];
}
export function setPixel(p: Pixmap, x: number, y: number, r: number, g: number, b: number, a: number): void {
  const i = pixelIndex(p, x, y);
  if (i < 0) return;
  const d = p.data;
  d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = a;
}
export function solidRect(p: Pixmap, box: QdRect, c: Pick<Rgba, 'r' | 'g' | 'b'>, a = 255): void {
  for (let y = box.top; y < box.bottom; y++) for (let x = box.left; x < box.right; x++) setPixel(p, x, y, c.r, c.g, c.b, a);
}
export function fillRect(p: Pixmap, box: PixRect, r: number, g: number, b: number, a = 255): void {
  solidRect(p, rectXYWH(box.x, box.y, box.w, box.h), { r, g, b }, a);
}
export function axisLine(p: Pixmap, c: Rgba, x0: number, y0: number, x1: number, y1: number): void {
  if (x0 !== x1 && y0 !== y1) throw new Error('lineTo: diagonal lines are not specified for the engine');
  const { r, g, b } = c;
  for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++)
    for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) setPixel(p, x, y, r, g, b, 255);
}

// Immediate writes preserve source alias order, including nonintegral addresses.
function blit(dst: Pixmap, src: Pixmap, S: QdRect, D: QdRect, masked: boolean, outside: OutsideSource,
  clip?: (x: number, y: number) => boolean, undefinedPixels?: Uint8Array, clipped = false): void {
  if (!clipped && (emptyRect(S) || emptyRect(D))) return;
  const sw = S.right - S.left, sh = S.bottom - S.top, dw = clipped ? src.width : D.right - D.left, dh = clipped ? src.height : D.bottom - D.top;
  const s = src.data, d = dst.data;
  for (let row = 0; row < dh; row++) {
    const sy = clipped ? row : S.top + Math.floor(row * sh / dh);
    for (let col = 0; col < dw; col++) {
      if (undefinedPixels?.[row * src.width + col] || clipped && !clip!(D.left + col, D.top + row)) continue;
      const di = pixelIndex(dst, D.left + col, D.top + row);
      if (di < 0) continue;
      const si = clipped ? (row * src.width + col) * 4 : pixelIndex(src, S.left + Math.floor(col * sw / dw), sy);
      if (si < 0) {
        if (!masked && outside === 'transparent') d[di] = d[di + 1] = d[di + 2] = d[di + 3] = 0;
      } else {
        const alpha = s[si + 3]!;
        if (masked && alpha === 0) continue;
        d[di] = s[si]!; d[di + 1] = s[si + 1]!; d[di + 2] = s[si + 2]!; d[di + 3] = clipped ? s[si + 3]! : alpha;
      }
    }
  }
}
export function transferBits(dst: Pixmap, src: Pixmap, S: QdRect, D: QdRect, mode: Transfer, outside: OutsideSource = 'transparent'): void {
  blit(dst, src, S, D, mode === 'copyMask', outside);
}
export function copyBits(dst: Pixmap, src: Pixmap, S: QdRect, D: QdRect): void { blit(dst, src, S, D, false, 'transparent'); }
export function copyMask(dst: Pixmap, src: Pixmap, S: QdRect, D: QdRect): void { blit(dst, src, S, D, true, 'transparent'); }
export function copyClipped(dst: Pixmap, src: Pixmap, at: QdPoint, clip: (x: number, y: number) => boolean, undefinedPixels?: Uint8Array): void {
  blit(dst, src, rectXYWH(0, 0, src.width, src.height), rectXYWH(at.x, at.y, src.width, src.height), false, 'transparent', clip, undefinedPixels, true);
}
export function scaleBlit(dst: Pixmap, src: Pixmap, S: QdRect, D: QdRect, mode: Transfer, trace?: EngineTrace): void {
  if (emptyRect(S) || emptyRect(D)) return;
  trace?.drawOps.push({ op: 'scale', src: S, dst: D, transfer: mode });
  transferBits(dst, src, S, D, mode);
}
export function cornerBlit(dst: Pixmap, src: Pixmap, S: QdRect, x: number, y: number, mode: Transfer, trace?: EngineTrace): void {
  const D = offsetRect(S, x - S.left, y - S.top);
  trace?.drawOps.push({ op: 'corner', src: S, dst: D, transfer: mode });
  scaleBlit(dst, src, S, D, mode, trace);
}
export function tileFastPathRow(S: QdRect, D: QdRect): 'T1' | 'T2' | null {
  return S.right - S.left === 1 && D.right - D.left > 1 ? 'T1' : S.bottom - S.top === 1 && D.bottom - D.top > 1 ? 'T2' : null;
}
export function tileBlit(dst: Pixmap, src: Pixmap, S: QdRect, D: QdRect, direction: TileDirection, mode: Transfer, trace?: EngineTrace): void {
  if (emptyRect(S) || emptyRect(D)) return;
  const sw = S.right - S.left, sh = S.bottom - S.top, vertical = sh !== D.bottom - D.top;
  const fastPath = tileFastPathRow(S, D);
  if (vertical && sw !== D.right - D.left) {
    trace?.drawOps.push({ op: 'tile', row: 'T4', src: S, dst: D, direction, transfer: mode, unspecified: 'vertical step with unequal cross widths' }); return;
  }
  trace?.drawOps.push({ op: 'tile', row: `T3,T4,${direction === 1 ? 'T5' : 'T6'}`, src: S, dst: D, direction, transfer: mode,
    axis: vertical ? 'vertical' : 'horizontal', ...(fastPath ? { fastPathDeferred: fastPath } : {}) });
  const ax = axis(!vertical), step = vertical ? sh : sw, forward = direction === 1, start = ax.a0(D), end = ax.a1(D);
  for (let cursor = forward ? start : end; forward ? cursor < end : cursor > start; cursor += forward ? step : -step) {
    const n = Math.min(step, forward ? end - cursor : cursor - start), ss = forward ? ax.a0(S) : ax.a1(S) - n, dd = forward ? cursor : cursor - n;
    transferBits(dst, src, ax.mk(ss, ss + n, ax.c0(S), ax.c1(S)), ax.mk(dd, dd + n, ax.c0(D), ax.c1(D)), mode);
  }
}
export function sourceLines(dst: Pixmap, mask: Pixmap, colours: Pixmap, S: QdRect, D: QdRect, horizontal: boolean): void {
  const n = horizontal ? S.bottom - S.top : S.right - S.left;
  for (let j = 0; j < n; j++) {
    if (horizontal ? D.top + j >= D.bottom : D.left + j >= D.right) break;
    const x = horizontal ? S.left : S.left + j, y = horizontal ? S.top + j : S.top, c = getPixel(mask, x, y);
    if (!c || c.a === 0) continue;
    axisLine(dst, getPixel(colours, x, y) ?? c, horizontal ? D.left : D.left + j, horizontal ? D.top + j : D.top,
      horizontal ? D.right - 1 : D.left + j, horizontal ? D.top + j : D.bottom - 1);
  }
}

const mod = (x: number, n: number): number => ((x % n) + n) % n;
function patternRect(dst: Pixmap, D: QdRect, pattern: Pixmap, phase: QdPoint, clear?: { src: Pixmap; S: QdRect }): void {
  if (emptyRect(clear?.S ?? D) || pattern.width <= 0 || pattern.height <= 0) return;
  const d = dst.data, s = pattern.data, box = clear?.S ?? D;
  for (let sy = box.top; sy < box.bottom; sy++) for (let sx = box.left; sx < box.right; sx++) {
    if (clear) { const i = pixelIndex(clear.src, sx, sy); if (i >= 0 && clear.src.data[i + 3] !== 0) continue; }
    const x = clear ? D.left + (sx - box.left) : sx, y = clear ? D.top + (sy - box.top) : sy;
    const di = pixelIndex(dst, x, y), si = pixelIndex(pattern, mod(x - phase.x, pattern.width), mod(y - phase.y, pattern.height));
    if (di < 0) continue;
    d[di] = s[si]!; d[di + 1] = s[si + 1]!; d[di + 2] = s[si + 2]!; d[di + 3] = s[si + 3]!;
  }
}
export function fillPattern(dst: Pixmap, D: QdRect, pattern: Pixmap, phase: QdPoint, trace?: EngineTrace, row?: string): void {
  if (emptyRect(D) || pattern.width <= 0 || pattern.height <= 0) return;
  trace?.drawOps.push({ op: 'fillPattern', ...(row ? { row } : {}), dst: D, phase: { x: phase.x, y: phase.y }, pattern: { width: pattern.width, height: pattern.height } });
  patternRect(dst, D, pattern, phase);
}
export function eraseRect(dst: Pixmap, D: QdRect, c: Rgba, trace?: EngineTrace, row?: string): void {
  if (emptyRect(D)) return;
  trace?.drawOps.push({ op: 'erase', ...(row ? { row } : {}), dst: D, rgb: { r: c.r, g: c.g, b: c.b } });
  solidRect(dst, D, c);
}
export function fillMaskClearRegion(dst: Pixmap, icon: Pixmap, S: QdRect, at: QdPoint, pattern: Pixmap, phase: QdPoint, trace?: EngineTrace, row?: string): void {
  if (emptyRect(S) || pattern.width <= 0 || pattern.height <= 0) return;
  trace?.drawOps.push({ op: 'fillRegion', row: `${row ? `${row},` : ''}R1,F1,F2`, src: S, at: { x: at.x, y: at.y }, phase: { x: phase.x, y: phase.y } });
  patternRect(dst, rectXYWH(at.x, at.y, S.right - S.left, S.bottom - S.top), pattern, phase, { src: icon, S });
}
export function newRegion(p: { width: number; height: number }): Region { return { width: p.width, height: p.height, bits: new Uint8Array(p.width * p.height) }; }
export function regionHas(r: Region, x: number, y: number): boolean { return x >= 0 && y >= 0 && x < r.width && y < r.height && r.bits[y * r.width + x] === 1; }
function maskRect(r: Region, box: QdRect, value: number): void {
  for (let y = Math.max(0, box.top); y < Math.min(r.height, box.bottom); y++)
    for (let x = Math.max(0, box.left); x < Math.min(r.width, box.right); x++) r.bits[y * r.width + x] = value;
}
export function regionAddRect(r: Region, box: QdRect): void { maskRect(r, box, 1); }
export function regionSubtractRect(r: Region, box: QdRect): void { maskRect(r, box, 0); }
export function regionAddMappedMask(r: Region, src: Pixmap, S: QdRect, D: QdRect): void {
  if (emptyRect(S) || emptyRect(D)) return;
  for (let row = 0; row < D.bottom - D.top; row++) for (let col = 0; col < D.right - D.left; col++) {
    const si = pixelIndex(src, S.left + Math.floor(col * (S.right - S.left) / (D.right - D.left)), S.top + Math.floor(row * (S.bottom - S.top) / (D.bottom - D.top)));
    const x = D.left + col, y = D.top + row;
    if (si >= 0 && src.data[si + 3] !== 0 && x >= 0 && y >= 0 && x < r.width && y < r.height) r.bits[y * r.width + x] = 1;
  }
}
export function insideBounds(p: Pixmap, r: QdRect): boolean { return r.left >= 0 && r.top >= 0 && r.right <= p.width && r.bottom <= p.height; }
export function iconBlit(dst: Pixmap, icon: IconSource, S: QdRect, D: QdRect, trace?: EngineTrace, row?: string): void {
  if (emptyRect(S) || emptyRect(D)) return;
  if (icon.pixelSize === 1) {
    trace?.drawOps.push({ op: 'iconBlit', row: `${row ? `${row},` : ''}I2`, src: S, dst: D, transfer: 'copyMask' });
    transferBits(dst, icon.pixmap, S, D, 'copyMask'); return;
  }
  if (icon.pixelSize !== null && icon.unmasked) {
    trace?.drawOps.push({ op: 'iconBlit', row: `${row ? `${row},` : ''}I3`, src: S, dst: D, transfer: 'copyBits' });
    transferBits(dst, icon.unmasked, S, D, 'copyBits', 'untouched'); return;
  }
  trace?.drawOps.push({ op: 'iconBlit', row: `${row ? `${row},` : ''}I3`, src: S, dst: D, transfer: 'copyMask',
    ...(icon.fallback ? { fallback: icon.fallback } : {}),
    ...(icon.fallback && icon.pixelSize !== null ? {} : { unimplemented: 'pixel depth or unmasked pixels unavailable; drawn masked' }) });
  transferBits(dst, icon.pixmap, S, D, 'copyMask');
}

export function drawOver(dst: Pixmap, src: Pixmap, dx: number, dy: number, clip?: PixRect): void {
  for (let y = 0; y < src.height; y++) for (let x = 0; x < src.width; x++) {
    if (clip && (dx + x < clip.x || dy + y < clip.y || dx + x >= clip.x + clip.w || dy + y >= clip.y + clip.h)) continue;
    const [r, g, b, a] = readPixel(src, x, y);
    if (a === 0) continue;
    if (a === 255) { setPixel(dst, dx + x, dy + y, r, g, b, 255); continue; }
    const [dr, dg, db, da] = readPixel(dst, dx + x, dy + y), sa = a / 255;
    setPixel(dst, dx + x, dy + y, Math.round(r * sa + dr * (1 - sa)), Math.round(g * sa + dg * (1 - sa)), Math.round(b * sa + db * (1 - sa)), Math.max(a, da));
  }
}
export function nineSlice(dst: Pixmap, src: Pixmap, S: PixRect, ins: { l: number; t: number; r: number; b: number }, D: PixRect, mode: 'stretch' | 'tile' = 'stretch'): void {
  const l = Math.max(0, Math.min(ins.l, Math.floor(S.w / 2))), r = Math.max(0, Math.min(ins.r, S.w - l));
  const t = Math.max(0, Math.min(ins.t, Math.floor(S.h / 2))), b = Math.max(0, Math.min(ins.b, S.h - t));
  const columns = [[0, 0, l, l], [l, l, S.w - l - r, D.w - l - r], [S.w - r, D.w - r, r, r]] as const;
  const rows = [[0, 0, t, t], [t, t, S.h - t - b, D.h - t - b], [S.h - b, D.h - b, b, b]] as const;
  // Preserve corners-before-bands ordering, including overlapping small targets.
  for (const [col, row] of [[0, 0], [2, 0], [0, 2], [2, 2], [1, 0], [1, 2], [0, 1], [2, 1], [1, 1]] as const) {
    const [sx, dx, w, W] = columns[col], [sy, dy, h, H] = rows[row];
    if (w <= 0 || h <= 0 || W <= 0 || H <= 0) continue;
    const source = rectXYWH(S.x + sx, S.y + sy, w, h), target = rectXYWH(D.x + dx, D.y + dy, W, H);
    if (mode !== 'tile' || col !== 1 && row !== 1) { copyBits(dst, src, source, target); continue; }
    for (let y = 0; y < H; y += h) for (let x = 0; x < W; x += w) {
      const rw = Math.min(w, W - x), rh = Math.min(h, H - y);
      copyBits(dst, src, rectXYWH(source.left, source.top, rw, rh), rectXYWH(D.x + (dx + x), D.y + (dy + y), rw, rh));
    }
  }
}
export function rasterToImageData(p: Pixmap): ImageData {
  const image = new ImageData(p.width, p.height); image.data.set(p.data); return image;
}
