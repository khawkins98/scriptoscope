import { ownerDisplayPolicyMatches } from '../tools/theme-loader/display-profile.js';
import type { ThemeManifest } from './types.js';
import { snapshotControlComposition, bodyPatternPhase, type ControlCompositionContext, type ControlCompositionSnapshot, type ControlRect } from './controlComposition.js';
import type { ControlBandPaint, ControlDiagnostics } from './controlDiagnostics.js';
import type { ChromeElement } from './types.js';
import { PixelBuffer } from './pixelBuffer.js';

export interface HeaderSurfaceOptions {
  /** Whole Appearance header surface; never a column or a label. */
  kind: 'window-header' | 'list-view-header';
  width: number;
  height: number;
  /** Raw UInt32 callback state: zero selects -9568, every nonzero value -9567. */
  drawState: number;
  compositionContext: ControlCompositionContext;
  diagnostics?: ControlDiagnostics;
}
export type HeaderSurfaceUnsupportedReason = 'unknown-clip' | 'special-window-origin' | 'missing-slice' | 'invalid-slice'
  | 'missing-body-request' | 'invalid-body-request' | 'cicn-body' | 'unknown-pattern-origin' | 'nonopaque-pattern'
  | 'ambiguous-body-selection' | 'missing-background-sample' | 'unverified-line-sampling' | 'unsafe-source-geometry' | 'nonbinary-mask';
export type HeaderSurfaceResult = { status: 'rendered'; buffer: PixelBuffer }
  | { status: 'unavailable'; reason: 'missing-face' }
  | { status: 'unsupported'; reason: HeaderSurfaceUnsupportedReason };

/** Diagnostic decisions are implementation observations, not original captures. */
export interface HeaderSurfaceTrace {
  readonly kind: HeaderSurfaceOptions['kind'];
  readonly drawState: number;
  readonly requestedRect: ControlRect;
  readonly paintRect: ControlRect;
  readonly context: ControlCompositionSnapshot;
  /** Returned pixels are always cropped to requestedRect, even with unbounded clip. */
  readonly effectiveClip: ControlRect | null;
  readonly admission: 'rendered' | 'unavailable' | 'unsupported' | 'error';
  /** Any admitted body/border pixel write, not final contribution attribution. */
  readonly painted?: boolean;
  readonly reason?: HeaderSurfaceUnsupportedReason | 'missing-face';
  readonly geometry: 'pach130-ordinary-full-color';
  readonly sourceSelection: 'current-manifest-compatibility';
  readonly backgroundPolicy?: 'raw-sample-current-display';
  /** Clipped union coverage before masked borders, not final visible contribution. */
  readonly patternBody?: { readonly phase: readonly [number, number]; readonly width: number; readonly height: number; readonly paintedPixels: number };
  readonly lineSampling?: 'not-required' | 'equivalent-current-display' | 'sampled-companion' | 'unverified';
}

export interface HeaderSurfacePlan {
  kind: HeaderSurfaceOptions['kind']; drawState: number;
  context: ControlCompositionSnapshot; requestedRect: ControlRect; paintRect: ControlRect;
  effectiveClip: ControlRect | null;
}
const signed = (value: number, name: string): void => {
  if (!Number.isInteger(value) || value < -32768 || value > 32767) throw new RangeError(`${name} must fit a signed 16-bit coordinate`);
};
export function planHeaderSurface(opts: HeaderSurfaceOptions): HeaderSurfacePlan {
  if (!opts || !['window-header', 'list-view-header'].includes(opts.kind)) throw new TypeError('Unknown header surface kind');
  if (![opts.width, opts.height].every(value => Number.isInteger(value) && value > 0)) throw new RangeError('Header dimensions must be positive integers');
  if (!Number.isInteger(opts.drawState) || opts.drawState < 0 || opts.drawState > 0xffffffff) throw new RangeError('Header drawState must be UInt32');
  if (!opts.compositionContext) throw new TypeError('Header compositionContext is required');
  const context = snapshotControlComposition(opts.compositionContext);
  const [x, y] = context.controlOrigin;
  const requestedRect = { x, y, w: opts.width, h: opts.height };
  const paintRect = { ...requestedRect, h: opts.height + (opts.kind === 'list-view-header' ? 1 : 0) };
  signed(x + opts.width, 'Header right'); signed(y + paintRect.h, 'Header bottom');
  let effectiveClip: ControlRect | null = requestedRect;
  if (context.clip.kind === 'unknown') effectiveClip = null;
  else if (context.clip.kind === 'rect') {
    const clip = context.clip.rect, left = Math.max(x, clip.x), top = Math.max(y, clip.y);
    effectiveClip = { x: left, y: top, w: Math.max(0, Math.min(x + opts.width, clip.x + clip.w) - left),
      h: Math.max(0, Math.min(y + opts.height, clip.y + clip.h) - top) };
  }
  return { kind: opts.kind, drawState: opts.drawState, context, requestedRect, paintRect, effectiveClip };
}

export function headerMetadataRejection(element: ChromeElement): HeaderSurfaceUnsupportedReason | null {
  if (!element.slice) return 'missing-slice';
  if (![element.slice.corner, element.slice.side].every(value => Number.isInteger(value) && value >= 0 && value <= 255)
    || typeof element.slice.tile !== 'boolean') return 'invalid-slice';
  const request = element.bodyRequest;
  if (!request) return 'missing-body-request';
  if (!Number.isInteger(request.mode) || request.mode < 0 || request.mode > 255
    || !Number.isInteger(request.resourceId) || request.resourceId < -32768 || request.resourceId > 32767) return 'invalid-body-request';
  return request.mode === 5 ? 'cicn-body' : null;
}

export function headerBackground(source: PixelBuffer, element: ChromeElement, owner?: ThemeManifest): readonly number[] | null {
  const samples = element.colorSamples, sample = samples?.background, anchor = element.bgAnchor;
  const triple = (value: readonly number[] | undefined, max: number): boolean => Array.isArray(value)
    && value.length === 3 && value.every(v => Number.isInteger(v) && v >= 0 && v <= max);
  return !element.colorSamplesUnavailableReason && samples?.model === 'kdef-2.3.1-color'
    && ownerDisplayPolicyMatches(owner, samples.displayPolicy) && sample
    && triple(sample.rgb16, 65535) && triple(sample.displayRgb, 255)
    && anchor && anchor.length === 2 && anchor.every(Number.isInteger)
    && anchor[0] >= 0 && anchor[0] < source.width && anchor[1] >= 0 && anchor[1] < source.height
    ? sample.displayRgb : null;
}

type Region = readonly [number, number, number, number, number, number, number, number];
/** PACH130 72a8..7620: square corners and independent bands in painter order.
 * No push-button/text/default-ring or rectangular nine-slice policy is reused. */
function headerRegions(source: PixelBuffer, element: ChromeElement, width: number, height: number): Region[] {
  const { corner: c, side: s, tile } = element.slice!;
  const cw = Math.min(c, source.width), ch = Math.min(c, source.height);
  const sw = Math.min(s, source.width), sh = Math.min(s, source.height);
  // False forces a source column/row even when c reaches the raster edge. Such
  // an actual out-of-bounds draw is rejected below, never silently skipped.
  const bw = tile ? source.width - 2 * c : 1;
  const bh = tile ? source.height - 2 * c : 1;
  return [
    [0, 0, cw, ch, 0, 0, cw, ch],
    [source.width - cw, 0, cw, ch, width - cw, 0, cw, ch],
    [c, 0, bw, sh, c, 0, width - 2 * c, sh],
    [0, source.height - ch, cw, ch, 0, height - ch, cw, ch],
    [source.width - cw, source.height - ch, cw, ch, width - cw, height - ch, cw, ch],
    [c, source.height - sh, bw, sh, c, height - sh, width - 2 * c, sh],
    [0, c, sw, bh, 0, c, sw, height - 2 * c],
    [source.width - sw, c, sw, bh, width - sw, c, sw, height - 2 * c],
  ];
}

/** Internal admitted solid/direct-pattern painter. Full-color, ordinary nonrecording display
 * policy only; optional original device caches are not reproduced. */
export async function paintHeaderSurface(source: PixelBuffer, element: ChromeElement, plan: HeaderSurfacePlan,
  background: readonly number[], owner?: ThemeManifest, loadSampled?: () => Promise<PixelBuffer>, pattern?: PixelBuffer): Promise<{ result: HeaderSurfaceResult; lineSampling: NonNullable<HeaderSurfaceTrace['lineSampling']>; painted: boolean; patternBody?: HeaderSurfaceTrace['patternBody']; sampledRegions?: readonly { region: number; branch: ControlBandPaint['branch'] }[] }> {
  const { w: width, h: height } = plan.requestedRect, paintHeight = plan.paintRect.h;
  const clip = plan.effectiveClip!;
  const x0 = Math.max(0, clip.x - plan.requestedRect.x), y0 = Math.max(0, clip.y - plan.requestedRect.y);
  const x1 = Math.min(width, x0 + clip.w), y1 = Math.min(height, y0 + clip.h);
  const regions = headerRegions(source, element, width, paintHeight);
  const visible = ([, , sw, sh, dx, dy, dw, dh]: Region): boolean => sw > 0 && sh > 0 && dw > 0 && dh > 0
    && Math.min(x1, dx + dw) > Math.max(x0, dx) && Math.min(y1, dy + dh) > Math.max(y0, dy);
  // 5cb8 selects sampled lines for either one-pixel source dimension, regardless
  // of cinf.tile. Decoder proof is current-display equality, not raw/device RGB.
  const needsSampling = regions.some(region => visible(region) && ((region[2] === 1 && region[6] > 1) || (region[3] === 1 && region[7] > 1)));
  if (regions.some(region => visible(region) && (region[0] < 0 || region[1] < 0
    || region[0] + region[2] > source.width || region[1] + region[3] > source.height)))
    return { result: { status: 'unsupported', reason: 'unsafe-source-geometry' }, lineSampling: needsSampling ? 'unverified' : 'not-required', painted: false };
  const matches = (value: ChromeElement['samplingEquivalence'] | ChromeElement['sampledBandAsset']): boolean =>
    value?.model === 'kaleidoscope-2.3.1-opaque-sampling-v1' && value.comparison === 'opaque-current-display-rgb'
    && ownerDisplayPolicyMatches(owner, value.displayPolicy) && value.width === source.width && value.height === source.height;
  const proof = element.samplingEquivalence;
  const equivalent = matches(proof) && proof?.status === 'equivalent' && proof.reason === 'all-opaque-display-rgb-equal';
  let lineSampling: NonNullable<HeaderSurfaceTrace['lineSampling']> = needsSampling ? equivalent ? 'equivalent-current-display' : 'unverified' : 'not-required';
  for (let i = 3; i < source.data.length; i += 4) if (source.data[i] !== 0 && source.data[i] !== 255)
    return { result: { status: 'unsupported', reason: 'nonbinary-mask' }, lineSampling, painted: false };
  let sampled: PixelBuffer | null = null;
  if (needsSampling && !equivalent) {
    const companion = element.sampledBandAsset;
    if (matches(companion) && companion && typeof companion.asset === 'string' && companion.asset.length > 0
      && /^cicn-sampled\/[^/]+\.png$/.test(companion.derivedPath) && loadSampled) {
      // The retained companion uses PACH5874/687e's full-color samples. It is
      // already in the owner's display policy; never transform it a second time.
      const decoded = await loadSampled();
      if (decoded.width === source.width && decoded.height === source.height) {
        let sameMask = true;
        for (let i = 3; i < source.data.length; i += 4) if (decoded.data[i] !== source.data[i]) { sameMask = false; break; }
        if (sameMask) sampled = decoded;
      }
    }
    if (!sampled) return { result: { status: 'unsupported', reason: 'unverified-line-sampling' }, lineSampling, painted: false };
    lineSampling = 'sampled-companion';
  }
  if (pattern) {
    if (plan.context.patternOrigin.status === 'unknown')
      return { result: { status: 'unsupported', reason: 'unknown-pattern-origin' }, lineSampling, painted: false };
    // FillCRect supplies opaque full-color pixels, not browser alpha blending.
    for (let i = 3; i < pattern.data.length; i += 4) if (pattern.data[i] !== 255)
      return { result: { status: 'unsupported', reason: 'nonopaque-pattern' }, lineSampling, painted: false };
  }
  const phase = pattern ? bodyPatternPhase(plan.context, element.bodyRequest!.mode, width, paintHeight) : null;
  let bodyPixels = 0;
  const sampledRegions: { region: number; branch: ControlBandPaint['branch'] }[] = [];
  const out = PixelBuffer.alloc(width, height), { corner: c, side: s } = element.slice!;
  let painted = false;
  // 71a2..7202 (pattern) / 721a..7260 (solid): shared original-Rect phase
  // for both insets, before any border. List-view uses extended bottom for P.
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    if ((x >= c && x < width - c && y >= s && y < paintHeight - s)
      || (x >= s && x < width - s && y >= c && y < paintHeight - c)) {
      if (pattern && phase) {
        const px = ((phase[0] + x) % pattern.width + pattern.width) % pattern.width;
        const py = ((phase[1] + y) % pattern.height + pattern.height) % pattern.height;
        out.setPixel(x, y, ...pattern.getPixel(px, py));
      } else out.setPixel(x, y, background[0]!, background[1]!, background[2]!, 255);
      bodyPixels++;
      painted = true;
    }
  }
  for (const [regionIndex, region] of regions.entries()) {
    if (!visible(region)) continue;
    const [sx, sy, sw, sh, dx, dy, dw, dh] = region;
    // Select from original dimensions before clipping, width expansion first.
    const branch = sw === 1 && dw > 1 ? 'horizontal-lines' : sh === 1 && dh > 1 ? 'vertical-lines' : 'copy';
    const pixels = branch !== 'copy' && sampled ? sampled : source;
    let regionPainted = false;
    for (let y = Math.max(y0, dy); y < Math.min(y1, dy + dh); y++) for (let x = Math.max(x0, dx); x < Math.min(x1, dx + dw); x++) {
      const pixel = pixels.getPixel(sx + (x - dx) % sw, sy + (y - dy) % sh);
      if (pixel[3]) {
        out.setPixel(x, y, ...pixel); // ordinary CopyMask preserves earlier paint beneath holes
        painted = true;
        regionPainted = true;
      }
    }
    if (regionPainted && pixels === sampled) sampledRegions.push({ region: regionIndex, branch });
  }
  return { result: { status: 'rendered', buffer: out }, lineSampling, painted, sampledRegions,
    ...(pattern && phase && bodyPixels ? { patternBody: { phase, width: pattern.width, height: pattern.height, paintedPixels: bodyPixels } } : {}) };
}
