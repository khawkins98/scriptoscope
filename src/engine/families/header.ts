/** header.drawSurface / header.drawColumns, engine/header.md N1–N15 and C1–C8.
 * Native surface geometry and modern rectangular columns are separate drivers. */
import type { Pixmap, Rgba } from '../qd/types.js';
import type { ControlCompositionSnapshot, ControlRect } from '../../controlComposition.js';
import type { HeaderSurfaceUnsupportedReason } from '../../headerSurface.js';
import { bodyPatternPhase } from '../../controlComposition.js';
import { rectXYWH } from '../qd/rect.js';
import type { QdRect } from '../qd/types.js';
import { cinfBorderPlan, cinfBodyRects, bandVisible } from '../qd/cinfFrame.js';
import { getPixel } from '../../raster.js';
import { copyBits } from '../../raster.js';
import { tileBlit } from '../../raster.js';
import { sourceLines } from '../../raster.js';
import { eraseRect, fillPattern } from '../../raster.js';
import { PixelBuffer } from '../../pixelBuffer.js';
import { nineSlice, drawOver } from '../../raster.js';
import { HEADER_STATE, HEADER_BANDS, HEADER_COLUMNS as C, HEADER_DOMAIN as D } from '../tables/header.js';

export type HeaderKind = 'window-header' | 'list-view-header';
export interface HeaderSlice { readonly corner: number; readonly side: number; readonly tile: boolean }
export interface HeaderSurfaceInput {
  readonly kind: HeaderKind; readonly width: number; readonly height: number;
  readonly drawState: number; readonly context: ControlCompositionSnapshot;
}
export interface HeaderSurfacePlan {
  readonly kind: HeaderKind; readonly drawState: number; readonly context: ControlCompositionSnapshot;
  readonly requestedRect: ControlRect; readonly paintRect: ControlRect; readonly effectiveClip: ControlRect | null;
}
export type HeaderBandBranch = 'copy' | 'horizontal-lines' | 'vertical-lines';
export interface HeaderBand {
  readonly region: number; readonly source: ControlRect; readonly destination: ControlRect;
  readonly branch: HeaderBandBranch; readonly visible: boolean;
}
export interface HeaderGeometry {
  readonly bands: readonly HeaderBand[]; readonly bodyRects: readonly ControlRect[];
  readonly bodyVisible: boolean; readonly needsSampling: boolean; readonly unsafeSource: boolean;
}
export interface HeaderSurfacePaintInput {
  readonly source: Pixmap; readonly plan: HeaderSurfacePlan; readonly slice: HeaderSlice; readonly mode: number;
  readonly background?: Rgba | null; readonly pattern?: Pixmap | null; readonly sampled?: Pixmap | null;
  readonly samplingEquivalent?: boolean;
}
export interface HeaderSurfacePaintResult {
  readonly painted: boolean; readonly unsupported?: HeaderSurfaceUnsupportedReason;
  readonly lineSampling: 'not-required' | 'equivalent-current-display' | 'sampled-companion' | 'unverified';
  readonly sampledRegions: readonly { readonly region: number; readonly branch: HeaderBandBranch }[];
  readonly patternBody?: { readonly phase: readonly [number, number]; readonly width: number; readonly height: number; readonly paintedPixels: number };
}
export interface HeaderColumn { readonly label: string; readonly width: number }
export interface HeaderColumnsInput {
  readonly source: Pixmap; readonly slice?: { readonly corner?: number; readonly side?: number; readonly tile?: boolean };
  readonly bgAnchor?: readonly [number, number]; readonly textAnchor?: readonly [number, number]; readonly hasBgPattern: boolean;
  readonly columns?: readonly HeaderColumn[]; readonly height?: number;
}
export interface HeaderColumnsPlan {
  readonly width: number; readonly height: number; readonly corner: number; readonly side: number; readonly tile: boolean;
  readonly background: Rgba; readonly fontSize: number; readonly foreground: '#ffffff' | '#000000'; readonly columns: readonly HeaderColumn[];
}
export interface HeaderColumnsPaintInput { readonly source: Pixmap; readonly plan: HeaderColumnsPlan; readonly glyphs: readonly (Pixmap | null)[] }

export function headerResourceId(state: number | boolean): number {
  const zero = typeof state === 'boolean' ? state : state === 0;
  return HEADER_STATE.find(row => row.zero === zero)!.id;
}
/** ADM5/ADM6 structural admission applies even to empty effective clips. */
export function headerMetadataRejection(input: { slice?: HeaderSlice | null; bodyRequest?: { mode: number; resourceId: number } | null }): HeaderSurfaceUnsupportedReason | null {
  if (!input.slice) return 'missing-slice';
  if (![input.slice.corner, input.slice.side].every(v => Number.isInteger(v) && v >= 0 && v <= D.byteMax)
    || typeof input.slice.tile !== 'boolean') return 'invalid-slice';
  const request = input.bodyRequest;
  if (!request) return 'missing-body-request';
  if (!Number.isInteger(request.mode) || request.mode < 0 || request.mode > D.byteMax
    || !Number.isInteger(request.resourceId) || request.resourceId < D.min || request.resourceId > D.max) return 'invalid-body-request';
  return request.mode === 5 ? 'cicn-body' : null;
}
const box = (x: number, y: number, w: number, h: number): ControlRect => ({ x, y, w, h });
const nonempty = (r: ControlRect): boolean => r.w > 0 && r.h > 0;
function intersect(a: ControlRect, b: ControlRect): ControlRect {
  const x = Math.max(a.x, b.x), y = Math.max(a.y, b.y);
  return box(x, y, Math.max(0, Math.min(a.x + a.w, b.x + b.w) - x), Math.max(0, Math.min(a.y + a.h, b.y + b.h) - y));
}
const qd = (r: ControlRect) => rectXYWH(r.x, r.y, r.w, r.h);
const xywh = (r: QdRect): ControlRect => box(r.left, r.top, r.right - r.left, r.bottom - r.top);
/** Prepared unmasked integer insets: clipped union coverage before border writes. */
function headerBodyPixels(rects: readonly ControlRect[], clip: ControlRect): number {
  const first = rects[0] ? intersect(rects[0], clip) : box(0, 0, 0, 0);
  const second = rects[1] ? intersect(rects[1], clip) : box(0, 0, 0, 0);
  const overlap = intersect(first, second);
  return first.w * first.h + second.w * second.h - overlap.w * overlap.h;
}
function localClip(plan: HeaderSurfacePlan): ControlRect {
  const r = plan.effectiveClip;
  return r ? box(r.x - plan.requestedRect.x, r.y - plan.requestedRect.y, r.w, r.h) : box(0, 0, 0, 0);
}
export function planHeaderSurface(input: HeaderSurfaceInput): HeaderSurfacePlan {
  const { kind, width, height, drawState, context } = input;
  if (kind !== 'window-header' && kind !== 'list-view-header') throw new TypeError('Unknown header surface kind');
  if (![width, height].every(v => Number.isInteger(v) && v > 0)) throw new RangeError('Header dimensions must be positive integers');
  if (!Number.isInteger(drawState) || drawState < 0 || drawState > D.stateMax) throw new RangeError('Header drawState must be UInt32');
  const [x, y] = context.controlOrigin;
  const requestedRect = box(x, y, width, height), paintRect = box(x, y, width, height + (kind === 'list-view-header' ? 1 : 0));
  if (![x, y, x + width, y + paintRect.h].every(v => Number.isInteger(v) && v >= D.min && v <= D.max))
    throw new RangeError('Header edges must fit signed16 coordinates');
  const effectiveClip = context.clip.kind === 'unknown' ? null : context.clip.kind === 'rect'
    ? intersect(requestedRect, context.clip.rect) : requestedRect;
  return { kind, drawState, context, requestedRect, paintRect, effectiveClip };
}
export function planHeaderGeometry(source: Pick<Pixmap, 'width' | 'height'> & Partial<Pick<Pixmap, 'data'>>, slice: HeaderSlice, plan: HeaderSurfacePlan): HeaderGeometry {
  const { width: U, height: V } = source, { corner: c, side: s } = slice;
  const W = plan.paintRect.w, H = plan.paintRect.h, clip = localClip(plan);
  const destination = rectXYWH(0, 0, W, H);
  const regions = new Map(cinfBorderPlan(source, { cornerSize: c, sideThickness: s, tileSides: slice.tile }, destination).map(b => [b.piece, b]));
  const bands = HEADER_BANDS.map((row, region): HeaderBand => {
    const band = regions.get(row.piece)!, source = xywh(band.src), destination = xywh(band.dst);
    return { region, source, destination, visible: nonempty(source) && nonempty(destination) && nonempty(intersect(destination, clip)),
      branch: band.fast === 'T1' ? 'horizontal-lines' : band.fast === 'T2' ? 'vertical-lines' : 'copy' };
  });
  const bodyRects = cinfBodyRects(destination, c, s, true).map(xywh);
  const unsafeSource = bands.some(b => b.visible && (b.source.x < 0 || b.source.y < 0 || b.source.x + b.source.w > U || b.source.y + b.source.h > V));
  return { bands, bodyRects, bodyVisible: bodyRects.some(r => nonempty(intersect(r, clip))),
    // Dimension-only planning remains conservative. Actual prepared pixels make
    // ADM16 mask-before-color dependencies precise without restarting phase.
    needsSampling: bands.some(b => b.visible && b.branch !== 'copy'
      && (unsafeSource || !source.data || headerBandWrites(source as Pixmap, b, clip))), unsafeSource };
}
function headerBandWrites(source: Pixmap, band: HeaderBand, clip: ControlRect): boolean {
  return bandVisible({ width: clip.x + clip.w, height: clip.y + clip.h }, source,
    qd(band.source), qd(band.destination), band.branch, qd(clip));
}
/** Source rejection remains independent of the needed-only palette dependency. */
export function headerSourceRejection(source: Pixmap, geometry: HeaderGeometry): HeaderSurfaceUnsupportedReason | null {
  if (geometry.unsafeSource) return 'unsafe-source-geometry';
  for (let i = D.channels - 1; i < source.data.length; i += D.channels)
    if (source.data[i] !== 0 && source.data[i] !== D.byteMax) return 'nonbinary-mask';
  return null;
}

/** All admission precedes writes; dependencies have already been realized by the adapter. */
export function drawHeaderSurface(port: Pixmap, input: HeaderSurfacePaintInput): HeaderSurfacePaintResult {
  const { source, plan, slice, mode, background, pattern, sampled, samplingEquivalent } = input;
  const geometry = planHeaderGeometry(source, slice, plan), clip = localClip(plan);
  let lineSampling: HeaderSurfacePaintResult['lineSampling'] = !geometry.needsSampling ? 'not-required'
    : samplingEquivalent ? 'equivalent-current-display' : 'unverified';
  const reject = (unsupported: HeaderSurfaceUnsupportedReason): HeaderSurfacePaintResult => ({ painted: false, unsupported, lineSampling, sampledRegions: [] });
  if (!plan.effectiveClip) return reject('unknown-clip');
  if (plan.kind === 'window-header' && plan.requestedRect.x === -1 && plan.requestedRect.y === -1) return reject('special-window-origin');
  const sourceRejection = headerSourceRejection(source, geometry);
  if (sourceRejection) return reject(sourceRejection);
  if (geometry.needsSampling && !samplingEquivalent) {
    if (!sampled || sampled.width !== source.width || sampled.height !== source.height || sampled.data.length !== source.data.length) return reject('unverified-line-sampling');
    for (let i = D.channels - 1; i < source.data.length; i += D.channels)
      if (sampled.data[i] !== source.data[i]) return reject('unverified-line-sampling');
    lineSampling = 'sampled-companion';
  }
  if (geometry.bodyVisible) {
    if (pattern) {
      if (plan.context.patternOrigin.status === 'unknown') return reject('unknown-pattern-origin');
      if (!Number.isInteger(pattern.width) || !Number.isInteger(pattern.height) || pattern.width <= 0 || pattern.height <= 0
        || pattern.data.length !== pattern.width * pattern.height * D.channels) return reject('nonopaque-pattern');
      for (let i = D.channels - 1; i < pattern.data.length; i += D.channels) if (pattern.data[i] !== D.byteMax) return reject('nonopaque-pattern');
    } else if (!background) return reject('missing-background-sample');
  }
  // Shared primitives have allocation clipping. Paint to a detached plane, then
  // publish only the declared clip, preserving source phase and caller pixels.
  const work: Pixmap = { width: port.width, height: port.height, data: new Uint8ClampedArray(port.data) };
  const phase = pattern && geometry.bodyVisible ? bodyPatternPhase(plan.context, mode, plan.paintRect.w, plan.paintRect.h) : null;
  const bodyPixels = headerBodyPixels(geometry.bodyRects, clip);
  for (const body of geometry.bodyRects) {
    const r = intersect(body, clip);
    if (!nonempty(r)) continue;
    if (pattern && phase) fillPattern(work, qd(r), pattern, { x: -phase[0], y: -phase[1] });
    else eraseRect(work, qd(r), background!);
  }
  let painted = bodyPixels > 0;
  const sampledRegions: { region: number; branch: HeaderBandBranch }[] = [];
  for (const band of geometry.bands) {
    if (!band.visible) continue;
    const s = band.source, dest = band.destination;
    if (!headerBandWrites(source, band, clip)) continue;
    painted = true;
    if (band.branch === 'copy') tileBlit(work, source, qd(s), qd(dest), 1, 'copyMask');
    else {
      sourceLines(work, source, samplingEquivalent ? source : sampled!, qd(s), qd(dest), band.branch === 'horizontal-lines');
      if (!samplingEquivalent) sampledRegions.push({ region: band.region, branch: band.branch });
    }
  }
  copyBits(port, work, qd(clip), qd(clip));
  return { painted, lineSampling, sampledRegions,
    ...(phase && pattern && bodyPixels ? { patternBody: { phase, width: pattern.width, height: pattern.height, paintedPixels: bodyPixels } } : {}) };
}

export function planHeaderColumns(input: HeaderColumnsInput): HeaderColumnsPlan {
  const { source, slice, bgAnchor: bg, textAnchor: text } = input;
  const corner = slice?.corner ?? Math.max(C.minInset, Math.floor((Math.min(source.width, source.height) - C.insetSubtraction) / 2));
  const side = slice?.side ?? corner;
  const validBg = !input.hasBgPattern && bg && bg.every(Number.isInteger) && bg[0] >= 0 && bg[1] >= 0
    && bg[0] < source.width && bg[1] < source.height && getPixel(source, bg[0], bg[1])!.a > 0;
  const x = validBg ? bg[0] : text ? Math.max(0, Math.min(source.width - 1, text[0] - C.textSampleOffset)) : corner;
  const y = validBg ? bg[1] : text ? Math.max(0, Math.min(source.height - 1, text[1])) : corner;
  const background = getPixel(source, x, y) ?? { r: 0, g: 0, b: 0, a: 0 };
  const height = Math.max(C.minHeight, input.height ?? (source.height <= C.maxTemplateHeight ? source.height : C.defaultHeight));
  const columns = (input.columns ?? C.defaults).map(column => ({ ...column }));
  const luminance = background.r * C.luminance[0] + background.g * C.luminance[1] + background.b * C.luminance[2];
  return { width: columns.reduce((sum, col) => sum + col.width, 0), height, corner, side, tile: !!slice?.tile,
    background, fontSize: Math.max(C.minFont, Math.round(height * C.fontFactor)), foreground: luminance < C.contrastThreshold ? C.light : C.dark, columns };
}
/** Modern C4–C7 use the existing generic rectangular transfer/alpha helpers. */
function drawColumnCell(port: PixelBuffer, source: Pixmap, plan: HeaderColumnsPlan): void {
  nineSlice(port, source, { x: 0, y: 0, w: source.width, h: source.height },
    { l: plan.corner, r: plan.corner, t: plan.side, b: plan.side },
    { x: 0, y: 0, w: port.width, h: port.height }, plan.tile ? 'tile' : 'stretch');
  if (plan.background.a > 0) eraseRect(port, rectXYWH(plan.corner, plan.side, port.width - 2 * plan.corner, port.height - 2 * plan.side), plan.background);
}
export function drawHeaderColumns(port: Pixmap, input: HeaderColumnsPaintInput): void {
  let x = 0;
  for (const [index, column] of input.plan.columns.entries()) {
    const cell = PixelBuffer.alloc(column.width, input.plan.height);
    drawColumnCell(cell, input.source, input.plan);
    const glyph = input.glyphs[index];
    if (glyph) drawOver(cell, glyph, C.labelX, Math.round((cell.height - glyph.height) / 2));
    drawOver(port, cell, x, 0);
    x += column.width;
  }
}
