/** Browser IO and detached ownership for engine/header.md F/ADM/OBS policy. */
import type { ChromeElement, LoadedTheme } from './types.js';
import type { ListHeaderOptions } from './controls.js';
import type { HeaderSurfaceOptions, HeaderSurfaceResult, HeaderSurfaceTrace, HeaderSurfaceUnsupportedReason } from './headerSurface.js';
import type { ControlResolutionStep, ControlTraceCollector } from './controlDiagnostics.js';
import type { Rgba } from './engine/qd/types.js';
import { withControlDiagnostics } from './controlDiagnostics.js';
import { snapshotControlComposition } from './controlComposition.js';
import { resolveInChain } from './baseChain.js';
import { assetUrl } from './loadTheme.js';
import { loadCicnBuffer } from './cicnImage.js';
import { PixelBuffer } from './pixelBuffer.js';
import { rasterizeText } from './textRaster.js';
import { assertDisplayProfileChain, ownerDisplayPolicyMatches, realizeRgb16 } from '../tools/theme-loader/display-profile.js';
import { headerResourceId, planHeaderSurface, planHeaderGeometry, headerMetadataRejection, drawHeaderSurface,
  planHeaderColumns, drawHeaderColumns, headerSourceRejection, type HeaderSurfacePlan } from './engine/families/header.js';

type Identity = Required<Pick<ControlResolutionStep, 'owner' | 'resource'>>;
type PatternBinding = { kind: 'missing' | 'ambiguous' } | { kind: 'selected'; asset: string; key: string; id: number; byteProvenance?: NonNullable<LoadedTheme['manifest']['patterns']>[string]['byteProvenance'] };
interface PreparedHeader {
  element: ChromeElement; identity: Identity; url: string;
  owner: Pick<LoadedTheme, 'baseUrl'> & { manifest: Pick<LoadedTheme['manifest'], 'displayProfile'> };
  pattern: PatternBinding;
}
function checkedUrl(owner: Pick<LoadedTheme, 'baseUrl'>, asset: string): string {
  if (typeof asset !== 'string' || !asset.trim()) throw new TypeError('Header asset identity must be a nonempty string');
  return assetUrl(owner as LoadedTheme, asset);
}
/** Keep only consumed descriptors; optional role environments are intentionally untouched. */
function snapshotElement(el: ChromeElement): ChromeElement {
  const keys = ['asset', 'width', 'height', 'sourceCicnId', 'sourceCinfId', 'slice', 'bodyRequest', 'bgAnchor', 'textAnchor', 'bodyPattern', 'bgPattern',
    'colorSamples', 'colorSamplesUnavailableReason', 'samplingEquivalence', 'sampledBandAsset', 'byteProvenance'] as const;
  return structuredClone(Object.fromEntries(keys.filter(key => Object.hasOwn(el, key)).map(key => [key, el[key]]))) as unknown as ChromeElement;
}
function bindPattern(owner: LoadedTheme, element: ChromeElement): PatternBinding {
  const id = element.bodyRequest?.resourceId;
  const entries = Object.entries(owner.manifest.patterns ?? {});
  const linked = [element.bodyPattern, element.bgPattern].map(key => entries.find(([k, p]) => k === key && p.sourcePpatId === id)).find(Boolean);
  const candidates = linked ? [linked] : entries.filter(([, p]) => p.sourcePpatId === id);
  if (candidates.length > 1) return { kind: 'ambiguous' };
  const entry = candidates[0];
  if (!entry) return { kind: owner.inspector?.ppatResources?.some(p => p.id === id) ? 'ambiguous' : 'missing' };
  const [key, p] = entry;
  if (typeof p.asset !== 'string' || !p.asset.trim()) return { kind: 'ambiguous' };
  return { kind: 'selected', asset: p.asset, key, id: id!, ...(p.byteProvenance ? { byteProvenance: structuredClone(p.byteProvenance) } : {}) };
}
/** F5/F6: common chain guard precedes root-first alias selection, then capture before IO. */
function prepareHeader(theme: LoadedTheme, id: number, trace?: ControlTraceCollector): PreparedHeader | null {
  let depth = -1;
  const selected = resolveInChain(theme, owner => {
    depth++;
    const where = { baseUrl: owner.baseUrl, chainDepth: depth };
    const common = { role: 'face', requestedId: id, basis: 'compatibility-policy', usage: 'admission', owner: where } as const;
    if (depth) trace?.record({ ...common, action: 'fallback', reason: 'base-inheritance' });
    const entry = Object.entries(owner.manifest.chromeElements ?? {}).find(([, el]) => Number.isInteger(el.sourceCicnId) && Math.abs(el.sourceCicnId!) === Math.abs(id));
    if (!entry) { trace?.record({ ...common, action: 'missing', reason: 'missing-resource' }); return null; }
    const element = snapshotElement(entry[1]);
    // The immutable registered capability itself must survive, not a cloned profile.
    const capturedOwner = { baseUrl: owner.baseUrl, manifest: owner.manifest.displayProfile === undefined ? {} : { displayProfile: owner.manifest.displayProfile } };
    const url = checkedUrl(capturedOwner, element.asset);
    const identity: Identity = { owner: where, resource: { type: 'cicn', signedId: element.sourceCicnId!,
      sourceCinfId: Number.isInteger(element.sourceCinfId) ? element.sourceCinfId! : null, manifestKey: entry[0], assetUrl: url,
      ...(element.byteProvenance ? { byteProvenance: element.byteProvenance } : {}) } };
    trace?.record({ ...common, ...identity, action: 'selected', reason: element.sourceCicnId! > 0 ? 'positive-id-alias' : 'resource-id' });
    return { element, identity, url, owner: capturedOwner, pattern: bindPattern(owner, element) };
  });
  return selected ?? null;
}
const triple = (value: readonly number[] | undefined, max: number): value is readonly [number, number, number] =>
  Array.isArray(value) && value.length === 3 && value.every(v => Number.isInteger(v) && v >= 0 && v <= max);
function backgroundColor(face: PreparedHeader, source: PixelBuffer): Rgba | null {
  const { element: el, owner } = face, samples = el.colorSamples, sample = samples?.background, anchor = el.bgAnchor;
  if (el.colorSamplesUnavailableReason || samples?.model !== 'kdef-2.3.1-color'
    || !ownerDisplayPolicyMatches(owner.manifest, samples.displayPolicy) || !sample
    || !triple(sample.rgb16, 65535) || !triple(sample.displayRgb, 255)
    || !Array.isArray(anchor) || anchor.length !== 2 || !anchor.every(Number.isInteger)
    || anchor[0] < 0 || anchor[1] < 0 || anchor[0] >= source.width || anchor[1] >= source.height) return null;
  const rgb = realizeRgb16(sample.rgb16, owner.manifest.displayProfile);
  return { r: rgb[0]!, g: rgb[1]!, b: rgb[2]!, a: 255 };
}
function samplingMatches(face: PreparedHeader, source: PixelBuffer, descriptor: ChromeElement['samplingEquivalence'] | ChromeElement['sampledBandAsset']): boolean {
  return descriptor?.model === 'kaleidoscope-2.3.1-opaque-sampling-v1' && descriptor.comparison === 'opaque-current-display-rgb'
    && descriptor.width === source.width && descriptor.height === source.height && ownerDisplayPolicyMatches(face.owner.manifest, descriptor.displayPolicy);
}
async function loadPattern(face: PreparedHeader, trace?: ControlTraceCollector): Promise<{ buffer: PixelBuffer | null; selection?: ControlResolutionStep; unsupported?: HeaderSurfaceUnsupportedReason }> {
  const request = face.element.bodyRequest!, binding = face.pattern;
  const common = { role: 'body-fill', requestedId: request.resourceId, bodyMode: request.mode, requestedResourceType: 'ppat',
    basis: 'compatibility-policy', usage: 'admission', owner: face.identity.owner } as const;
  if (binding.kind !== 'selected') {
    trace?.record({ ...common, action: 'missing', reason: binding.kind === 'ambiguous' ? 'ambiguous-body-selection' : 'same-face-owner-pattern-unavailable' });
    return { buffer: null, ...(binding.kind === 'ambiguous' ? { unsupported: 'ambiguous-body-selection' as const } : {}) };
  }
  const url = checkedUrl(face.owner, binding.asset);
  const selection: ControlResolutionStep = { ...common, action: 'selected', reason: 'same-owner-pattern-admission', resource: {
    type: 'ppat', signedId: binding.id, sourceCinfId: null, manifestKey: binding.key, assetUrl: url,
    ...(binding.byteProvenance ? { byteProvenance: binding.byteProvenance } : {}) } };
  const buffer = await loadCicnBuffer(url);
  trace?.record(selection);
  return { buffer, selection };
}
export async function composeEngineHeaderSurface(theme: LoadedTheme, opts: HeaderSurfaceOptions): Promise<HeaderSurfaceResult> {
  let result: HeaderSurfaceResult = { status: 'unavailable', reason: 'missing-face' };
  await withControlDiagnostics(opts?.diagnostics, 'header-surface', {
    state: opts?.drawState === 0 ? 'inactive' : 'active', pressed: false, disabled: false,
  }, async trace => {
    let plan: HeaderSurfacePlan | undefined;
    const finish = (value: HeaderSurfaceResult, extra: Partial<HeaderSurfaceTrace> = {}): PixelBuffer | null => {
      result = value;
      trace?.headerSurface({ ...plan!, admission: value.status, ...(value.status === 'rendered' ? {} : { reason: value.reason }),
        geometry: 'pach130-ordinary-full-color', sourceSelection: 'current-manifest-compatibility', ...extra });
      return value.status === 'rendered' ? value.buffer : null;
    };
    try {
      if (!opts || !['window-header', 'list-view-header'].includes(opts.kind)) throw new TypeError('Unknown header surface kind');
      if (!opts.compositionContext) throw new TypeError('Header compositionContext is required');
      plan = planHeaderSurface({ kind: opts.kind, width: opts.width, height: opts.height, drawState: opts.drawState,
        context: snapshotControlComposition(opts.compositionContext) });
      assertDisplayProfileChain(theme, theme.manifest.displayProfile);
      if (!plan.effectiveClip) return finish({ status: 'unsupported', reason: 'unknown-clip' });
      if (plan.kind === 'window-header' && plan.requestedRect.x === -1 && plan.requestedRect.y === -1)
        return finish({ status: 'unsupported', reason: 'special-window-origin' });
      const id = headerResourceId(plan.drawState), face = prepareHeader(theme, id, trace);
      if (!face) return finish({ status: 'unavailable', reason: 'missing-face' });
      const source = await loadCicnBuffer(face.url), el = face.element;
      const rejected = headerMetadataRejection(el);
      if (rejected) return finish({ status: 'unsupported', reason: rejected });
      const geometry = planHeaderGeometry(source, el.slice!, plan);
      const body = geometry.bodyVisible ? await loadPattern(face, trace) : { buffer: null };
      if (body.unsupported) return finish({ status: 'unsupported', reason: body.unsupported });
      if (body.buffer && plan.context.patternOrigin.status === 'unknown') return finish({ status: 'unsupported', reason: 'unknown-pattern-origin' });
      const background = geometry.bodyVisible && !body.buffer ? backgroundColor(face, source) : null;
      if (geometry.bodyVisible && !body.buffer && !background) return finish({ status: 'unsupported', reason: 'missing-background-sample' });
      const invalidSource = headerSourceRejection(source, geometry);
      if (invalidSource) return finish({ status: 'unsupported', reason: invalidSource });
      const proof = el.samplingEquivalence;
      const equivalent = geometry.needsSampling && samplingMatches(face, source, proof)
        && proof?.status === 'equivalent' && proof.reason === 'all-opaque-display-rgb-equal';
      let sampled: PixelBuffer | null = null, companionUrl: string | null = null;
      const companion = el.sampledBandAsset;
      if (geometry.needsSampling && !equivalent && companion && samplingMatches(face, source, companion)
        && typeof companion.asset === 'string' && companion.asset.length > 0
        && /^cicn-sampled\/[^/]+\.png$/.test(companion.derivedPath)) {
        companionUrl = checkedUrl(face.owner, companion.asset);
        sampled = await loadCicnBuffer(companionUrl);
      }
      const out = PixelBuffer.alloc(plan.requestedRect.w, plan.requestedRect.h);
      const painted = drawHeaderSurface(out, { source, plan, slice: el.slice!, mode: el.bodyRequest!.mode,
        background, pattern: body.buffer, sampled, samplingEquivalent: !!equivalent });
      if (painted.unsupported) return finish({ status: 'unsupported', reason: painted.unsupported }, { lineSampling: painted.lineSampling });
      // Publish completed observations only after the pure driver admitted every dependency.
      if (companion && companionUrl) for (const band of painted.sampledRegions) trace?.bandPaint({ ...face.identity,
        role: 'face', ...band, policy: 'sampled-companion', derived: { path: companion.derivedPath, assetUrl: companionUrl, model: companion.model, displayPolicy: companion.displayPolicy } });
      if (painted.patternBody && body.selection) trace?.record({ ...body.selection, usage: 'paint', reason: 'completed-header-pattern-inset-union' });
      if (painted.painted) trace?.record({ ...face.identity, role: 'face', requestedId: id, action: 'selected', basis: 'compatibility-policy', usage: 'paint', reason: 'admitted-header-surface-paint' });
      return finish({ status: 'rendered', buffer: out }, { painted: painted.painted, lineSampling: painted.lineSampling,
        ...(painted.patternBody ? { patternBody: painted.patternBody } : {}),
        ...(geometry.bodyVisible && !body.buffer ? { backgroundPolicy: 'raw-sample-current-display' } : {}) });
    } catch (error) {
      if (plan) trace?.headerSurface({ ...plan, admission: 'error', geometry: 'pach130-ordinary-full-color', sourceSelection: 'current-manifest-compatibility' });
      throw error;
    }
  });
  return result;
}
export async function composeEngineHeaderColumns(theme: LoadedTheme, opts: ListHeaderOptions = {}): Promise<PixelBuffer | null> {
  const columns = opts.columns?.map(column => ({ label: column.label, width: column.width })), height = opts.height;
  const face = prepareHeader(theme, headerResourceId(!!opts.inactive));
  if (!face) return null;
  const source = await loadCicnBuffer(face.url), el = face.element;
  const plan = planHeaderColumns({ source, ...(columns === undefined ? {} : { columns }), ...(height === undefined ? {} : { height }),
    ...(el.slice ? { slice: el.slice } : {}), ...(el.bgAnchor ? { bgAnchor: el.bgAnchor } : {}),
    ...(el.textAnchor ? { textAnchor: el.textAnchor } : {}), hasBgPattern: !!el.bgPattern });
  const glyphs = plan.columns.map(column => column.label ? rasterizeText(column.label, plan.fontSize, plan.foreground) : null);
  const out = PixelBuffer.alloc(plan.width, plan.height);
  drawHeaderColumns(out, { source, plan, glyphs });
  return out;
}
