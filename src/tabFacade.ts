// Public composeTab adapter, docs/spec/engine/tab.md F1–F6, AD1–AD6 and §5.
// Selection is captured synchronously before the first decode await.
import type { ChromeElement, LoadedTheme } from './types.js';
import type { TabOptions } from './controls.js';
import type { ControlTraceCollector, ControlResolutionStep, TabBodyTrace } from './controlDiagnostics.js';
import { withControlDiagnostics } from './controlDiagnostics.js';
import { assetUrl } from './loadTheme.js';
import { loadCicnBuffer } from './cicnImage.js';
import { PixelBuffer } from './pixelBuffer.js';
import { rasterizeText } from './textRaster.js';
import { ownerDisplayPolicyMatches, realizeRgb16 } from '../tools/theme-loader/display-profile.js';
import { drawTab, admitTabGeometry, tabBandPlan, tabCenter, tabNeedsSampledBands, validTabCompanion,
  type TabInput, type TabMetadata } from './engine/families/tab.js';
import { TAB_DOMAIN, TAB_FACADE, TAB_LABEL } from './engine/tables/tab.js';
import { emptyRect, rect } from './engine/qd/rect.js';
import { decodeCinfHeader } from './engine/qd/cinfFrame.js';
import { CINF_SAMPLE } from './engine/tables/cinfFrame.js';
import type { Rgba } from './engine/qd/types.js';

type Selection = { theme: LoadedTheme; key: string; element: ChromeElement; chainDepth: number };
type Identity = Pick<ControlResolutionStep, 'owner' | 'resource'>;
function identity(hit: Selection): Identity {
  const el = hit.element;
  return { owner: { baseUrl: hit.theme.baseUrl, chainDepth: hit.chainDepth },
    resource: { type: 'cicn', signedId: el.sourceCicnId!, sourceCinfId: Number.isInteger(el.sourceCinfId) ? el.sourceCinfId! : null,
      manifestKey: hit.key, assetUrl: assetUrl(hit.theme, el.asset),
      ...(el.byteProvenance ? { byteProvenance: structuredClone(el.byteProvenance) } : {}) } };
}
function selectTab(theme: LoadedTheme, selected: boolean, trace?: ControlTraceCollector): Selection | null {
  for (const [index, id] of TAB_FACADE.find(row => row.selected === selected)!.ids.entries()) {
    const step = { role: 'face', requestedId: id, basis: 'compatibility-policy', usage: 'paint' } as const;
    if (index) trace?.record({ ...step, action: 'fallback', reason: 'tab-small-to-large' });
    const seen = new Set<LoadedTheme>();
    let chainDepth = 0;
    for (let owner: LoadedTheme | undefined = theme; owner && !seen.has(owner); owner = owner.base, chainDepth++) {
      seen.add(owner);
      const where = { baseUrl: owner.baseUrl, chainDepth };
      if (chainDepth) trace?.record({ ...step, owner: where, action: 'fallback', reason: 'base-inheritance' });
      const entry = Object.entries(owner.manifest.chromeElements ?? {}).find(([, e]) => Number.isInteger(e.sourceCicnId) && Math.abs(e.sourceCicnId!) === Math.abs(id));
      if (!entry) { trace?.record({ ...step, owner: where, action: 'missing', reason: 'missing-resource' }); continue; }
      const hit = { theme: owner, key: entry[0], element: entry[1], chainDepth };
      trace?.record({ ...step, ...identity(hit), action: 'selected', reason: hit.element.sourceCicnId! > 0 ? 'positive-id-alias' : 'resource-id' });
      return hit;
    }
  }
  return null;
}
function opaqueBounds(source: PixelBuffer) {
  let left = source.width, right = -1, top = source.height, bottom = -1;
  for (let y = 0; y < source.height; y++) for (let x = 0; x < source.width; x++) {
    if (!source.getPixel(x, y)[3]) continue;
    left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
  }
  return { left, right, top, bottom };
}
function metadata(el: ChromeElement): TabMetadata | string {
  if (!el.slice) return 'missing-slice';
  if (!el.bodyRequest) return 'missing-body-request';
  return { corner: el.slice.corner, side: el.slice.side, tile: el.slice.tile,
    mode: el.bodyRequest.mode, patternId: el.bodyRequest.resourceId };
}
function finiteRgb(values: readonly number[] | undefined, maximum: number): values is readonly [number, number, number] {
  return Array.isArray(values) && values.length === 3 && Array.from(values).every(v => Number.isInteger(v) && v >= 0 && v <= maximum);
}
/** A matching-size/owner-display record is a finite declaration, not device proof. */
function samplingEquivalent(el: ChromeElement, owner: LoadedTheme, source: PixelBuffer): boolean {
  const proof = el.samplingEquivalence;
  return proof?.model === 'kaleidoscope-2.3.1-opaque-sampling-v1' && proof.comparison === 'opaque-current-display-rgb'
    && proof.status === 'equivalent' && proof.width === source.width && proof.height === source.height
    && ownerDisplayPolicyMatches(owner.manifest, proof.displayPolicy);
}
async function sampledCompanion(el: ChromeElement, owner: LoadedTheme, source: PixelBuffer): Promise<PixelBuffer | null> {
  const descriptor = el.sampledBandAsset;
  if (!descriptor || descriptor.model !== 'kaleidoscope-2.3.1-opaque-sampling-v1'
    || descriptor.comparison !== 'opaque-current-display-rgb' || descriptor.width !== source.width || descriptor.height !== source.height
    || !ownerDisplayPolicyMatches(owner.manifest, descriptor.displayPolicy)
    || typeof descriptor.asset !== 'string' || !descriptor.asset.trim()
    || typeof descriptor.derivedPath !== 'string' || !descriptor.derivedPath.trim()) return null;
  const sampled = await loadCicnBuffer(assetUrl(owner, descriptor.asset));
  return validTabCompanion(source, sampled) ? sampled : null;
}

type PatternBinding = { status: 'missing' } | { status: 'unsupported'; reason: string }
  | { status: 'ready'; url: string; resource: NonNullable<ControlResolutionStep['resource']> };
function bindPattern(owner: LoadedTheme, face: ChromeElement, id: number): PatternBinding {
  const entries = Object.entries(owner.manifest.patterns ?? {});
  const linked = [face.bodyPattern, face.bgPattern].map(key => entries.find(([k, p]) => k === key && p.sourcePpatId === id)).find(Boolean);
  const candidates = linked ? [linked] : entries.filter(([, p]) => p.sourcePpatId === id);
  if (candidates.length > 1) return { status: 'unsupported', reason: 'ambiguous-same-owner-ppat' };
  const entry = candidates[0];
  if (!entry) return owner.inspector?.ppatResources?.some(p => p.id === id)
    ? { status: 'unsupported', reason: 'undecoded-same-owner-ppat' } : { status: 'missing' };
  const [key, p] = entry;
  if (typeof p.asset !== 'string' || !p.asset.trim()) return { status: 'unsupported', reason: 'undecoded-same-owner-ppat' };
  const url = assetUrl(owner, p.asset);
  return { status: 'ready', url, resource: { type: 'ppat', signedId: id, sourceCinfId: null,
    manifestKey: key, assetUrl: url, ...(p.byteProvenance ? { byteProvenance: structuredClone(p.byteProvenance) } : {}) } };
}
/** Public labels deliberately retain the contrast/font policy from tab.md §5. */
function labelRaster(source: PixelBuffer, b: ReturnType<typeof opaqueBounds>, label: string) {
  const bh = b.bottom - b.top + 1;
  const pixel = source.getPixel(Math.floor((b.left + b.right) / 2), Math.floor((b.top + b.bottom) / 2));
  const lum = TAB_LABEL.luminance.reduce((sum, weight, i) => sum + weight * pixel[i]!, 0);
  const foreground = lum < TAB_LABEL.threshold ? TAB_LABEL.light : TAB_LABEL.dark;
  return { foreground, glyphs: label ? rasterizeText(label, Math.max(TAB_LABEL.minimumSize, Math.round(bh * TAB_LABEL.heightFactor)), foreground) : null };
}
function observeBands(input: TabInput, selected: Identity, el: ChromeElement, owner: LoadedTheme, trace?: ControlTraceCollector): void {
  if (!trace || !selected.owner || !selected.resource) return;
  const box = (r: TabInput['destination']) => ({ x: r.left, y: r.top, w: r.right - r.left, h: r.bottom - r.top });
  for (const [region, p] of tabBandPlan(input).entries()) {
    if (emptyRect(p.src) || emptyRect(p.dst)) continue;
    let opaque = false;
    for (let y = p.dst.top; y < p.dst.bottom && !opaque; y++) for (let x = p.dst.left; x < p.dst.right; x++) {
      const sx = p.src.left + ((x - p.dst.left) % (p.src.right - p.src.left));
      const sy = p.src.top + y - p.dst.top;
      if (input.source.data[(sy * input.source.width + sx) * TAB_DOMAIN.channels + TAB_DOMAIN.channels - 1]) { opaque = true; break; }
    }
    if (!opaque) continue;
    trace.bandPaint({ role: 'face', region, sourceRect: box(p.src), destinationRect: box(p.dst),
      owner: selected.owner, resource: selected.resource, branch: p.lines ? 'horizontal-lines' : 'copy',
      policy: p.lines ? input.samplingEquivalent ? 'equivalent-raster' : 'sampled-companion' : 'ordinary-raster',
      ...(p.lines && !input.samplingEquivalent && el.sampledBandAsset ? { derived: {
        path: el.sampledBandAsset.derivedPath, assetUrl: assetUrl(owner, el.sampledBandAsset.asset),
        model: el.sampledBandAsset.model, displayPolicy: el.sampledBandAsset.displayPolicy } } : {}) });
  }
}
/** MD1–MD5: retained same-ID header can supply omitted local fields. */
function prepareMetadata(el: ChromeElement, bytes: readonly number[] | undefined): ChromeElement | string {
  const id = el.sourceCicnId;
  if (el.sourceCinfId === null) {
    if (bytes !== undefined || [el.slice, el.bodyRequest, el.bgAnchor, el.textAnchor, el.embossAnchor,
      el.colorSamples, el.engineColorSamples].some(v => v != null)) return 'contradictory-no-cinf-declaration';
    return 'no-cinf-no-paint';
  }
  if (el.sourceCinfId !== undefined && (!Number.isInteger(el.sourceCinfId) || el.sourceCinfId !== id))
    return 'same-id-cinf-mismatch';
  if (bytes === undefined) return el;
  if (!(Array.isArray(bytes) || bytes instanceof Uint8Array) || !Array.from(bytes).every((v, i) => Object.hasOwn(bytes, i) && Number.isInteger(v) && v >= 0 && v <= TAB_DOMAIN.opaque)
    || bytes.length < CINF_SAMPLE.headerLength) return 'invalid-retained-cinf-header';
  const raw = decodeCinfHeader(bytes)!;
  const fields = { slice: { corner: raw.cornerSize, side: raw.sideThickness, tile: raw.tileSides !== 0 },
    bodyRequest: { mode: raw.patternAnchor, resourceId: raw.bgPatternId },
    bgAnchor: [raw.bgPixel.x, raw.bgPixel.y] as [number, number],
    textAnchor: [raw.textPixel.x, raw.textPixel.y] as [number, number],
    embossAnchor: [raw.embossPixel.x, raw.embossPixel.y] as [number, number] };
  if (el.slice !== undefined && (!el.slice || el.slice.corner !== fields.slice.corner || el.slice.side !== fields.slice.side || el.slice.tile !== fields.slice.tile)
    || el.bodyRequest !== undefined && (!el.bodyRequest || el.bodyRequest.mode !== fields.bodyRequest.mode || el.bodyRequest.resourceId !== fields.bodyRequest.resourceId))
    return 'retained-cinf-contradicts-prepared-fields';
  for (const key of ['bgAnchor', 'textAnchor', 'embossAnchor'] as const)
    if (el[key] !== undefined && (!Array.isArray(el[key]) || el[key]!.length !== 2 || Array.from(el[key]!).some((v, i) => v !== fields[key][i])))
      return `retained-cinf-contradicts-${key}`;
  return { ...el, ...fields };
}
/** OR1–OR5: prepared raster declaration does not prove original mask bounds. */
function admitOrigin(el: ChromeElement, source: PixelBuffer): string {
  const supplied = (key: 'cicnSource' | 'boundsOrigin') => Object.hasOwn(el, key) && el[key] !== undefined;
  if (!supplied('cicnSource') && !supplied('boundsOrigin')) return 'legacy-zero-origin-policy';
  if (supplied('cicnSource')) {
    const record = el.cicnSource, b = record?.bounds;
    if (!record || record.id !== el.sourceCicnId || !b || !Object.values(b).every(Number.isInteger)
      || b.left !== 0 || b.top !== 0 || b.right !== source.width || b.bottom !== source.height) return 'invalid-source-bounds';
  }
  if (supplied('boundsOrigin') && (!el.boundsOrigin || el.boundsOrigin.left !== 0 || el.boundsOrigin.top !== 0)) return 'invalid-source-origin';
  return 'declared-zero-origin';
}
function sampleColors(el: ChromeElement, owner: LoadedTheme, source: PixelBuffer, equivalent: boolean, strongValid: boolean) {
  let backgroundPolicy: 'none' | 'raw-sample' | 'decoded-anchor' = 'none';
  const read = (role: 'background' | 'text' | 'emboss'): Rgba | null => {
    const anchor = role === 'background' ? el.bgAnchor : role === 'text' ? el.textAnchor : el.embossAnchor;
    if (!Array.isArray(anchor) || anchor.length !== 2 || !Array.from(anchor).every(Number.isInteger) || anchor[0] < 0 || anchor[1] < 0
      || anchor[0] >= source.width || anchor[1] >= source.height) return null;
    if (role === 'emboss' && anchor[0] === 0 && anchor[1] === 0) return null;
    const strong = el.engineColorSamples;
    const strongSupplied = Object.hasOwn(el, 'engineColorSamples') && strong !== undefined;
    const local = el.colorSamples;
    const sample = strongSupplied ? strongValid && strong && strong.model === 'kdef-2.3.1-engine-points'
      && strong.width === source.width && strong.height === source.height && strong.asset === el.asset
      && ownerDisplayPolicyMatches(owner.manifest, strong.displayPolicy) ? strong.points?.[`${anchor[0]},${anchor[1]}`] : null
      : local?.model === 'kdef-2.3.1-color' && ownerDisplayPolicyMatches(owner.manifest, local.displayPolicy) ? local[role] : null;
    if (sample && finiteRgb(sample.rgb16, TAB_DOMAIN.rgb16Max)) {
      const realized = realizeRgb16(sample.rgb16, owner.manifest.displayProfile);
      // CS1 uses the established raw-sample seam. CS2 additionally validates
      // the declared realized tuple; neither tuple is transformed twice.
      if (finiteRgb(realized, TAB_DOMAIN.opaque) && (strongSupplied || finiteRgb(sample.displayRgb, TAB_DOMAIN.opaque)
        && realized.every((v, i) => v === sample.displayRgb[i]))) {
        if (role === 'background') backgroundPolicy = 'raw-sample';
        return { r: realized[0], g: realized[1], b: realized[2], a: TAB_DOMAIN.opaque };
      }
    }
    // A failed stronger/local declaration cannot be bypassed with decoded RGB.
    if (strongSupplied || local != null) return null;
    const pixel = source.getPixel(anchor[0], anchor[1]);
    if (!equivalent || pixel[3] !== TAB_DOMAIN.opaque) return null;
    if (role === 'background') backgroundPolicy = 'decoded-anchor';
    return { r: pixel[0], g: pixel[1], b: pixel[2], a: TAB_DOMAIN.opaque };
  };
  const backgroundRGB = read('background'), textRGB = read('text'), embossRGB = read('emboss');
  return { backgroundRGB, textRGB, embossRGB, backgroundPolicy: backgroundPolicy as 'none' | 'raw-sample' | 'decoded-anchor' };
}

export async function composeEngineTab(theme: LoadedTheme, opts: TabOptions): Promise<PixelBuffer | null> {
  const selected = !!opts.selected, label = opts.label ?? '';
  return withControlDiagnostics(opts.diagnostics, 'tab', { state: 'active', pressed: false, disabled: false, selected }, async trace => {
    const hit = selectTab(theme, selected, trace);
    const requestedId = TAB_FACADE.find(row => row.selected === selected)!.ids[0];
    let sourceWidth = 0, sourceHeight = 0, requestedWidth = 0;
    const chosen = hit ? identity(hit) : {};
    const unavailable = (outcome: Extract<TabBodyTrace, { path: 'unavailable' }>['outcome'], reason: string): null => {
      trace?.record({ role: 'face', requestedId: -Math.abs(chosen.resource?.signedId ?? requestedId), ...chosen,
        action: outcome === 'missing-art' ? 'missing' : 'rejected', basis: 'compatibility-policy', usage: 'admission', reason: `${outcome}:${reason}` });
      trace?.tabBody({ path: 'unavailable', basis: 'compatibility-policy', outcome, reason, sourceWidth, sourceHeight, requestedWidth });
      return null;
    };
    if (!hit) return unavailable('missing-art', 'all-public-candidates-absent');
    // Snapshot all finite owner/occurrence inputs before decode, retaining only
    // an already-validated strong identity fact across structured cloning.
    const original = hit.element, occurrence = original.cicnSource;
    const strongValid = !!occurrence && original.engineColorSamples?.source === occurrence
      && occurrence.id === original.sourceCicnId && (!original.byteProvenance || original.byteProvenance.cicnResourceIndex === occurrence.resourceIndex)
      && hit.theme.inspector?.cicnResources?.filter(r => r.id === occurrence.id).length === 1
      && hit.theme.inspector.cicnResources.find(r => r.id === occurrence.id) === occurrence;
    const owner: LoadedTheme = { ...hit.theme, manifest: { ...hit.theme.manifest,
      ...(hit.theme.manifest.displayProfile ? { displayProfile: hit.theme.manifest.displayProfile } : {}),
      patterns: structuredClone(hit.theme.manifest.patterns ?? {}) },
      ...(hit.theme.inspector ? { inspector: { ...hit.theme.inspector, ...(hit.theme.inspector.ppatResources ? { ppatResources: structuredClone(hit.theme.inspector.ppatResources) } : {}) } } : {}) };
    const frozen = structuredClone(original);
    const bytes = owner.manifest.engineCinfs?.[String(frozen.sourceCicnId)];
    const prepared = prepareMetadata(frozen, bytes === undefined ? undefined : structuredClone(bytes));
    const url = chosen.resource!.assetUrl;
    const source = await loadCicnBuffer(url);
    sourceWidth = source.width; sourceHeight = source.height; requestedWidth = source.width;
    const b = opaqueBounds(source);
    if (b.right < b.left || b.bottom < b.top) return unavailable('empty-art', 'selected-icon-has-no-opaque-pixels');
    if (prepared === 'no-cinf-no-paint') return unavailable('no-cinf-no-paint', 'declared-no-cinf');
    if (typeof prepared === 'string') return unavailable('unsupported-metadata', prepared);
    const el = prepared;
    if (el.width !== source.width || el.height !== source.height) return unavailable('unsupported-metadata', 'declared-dimensions-mismatch');
    const origin = admitOrigin(el, source);
    if (origin.startsWith('invalid-')) return unavailable('unsupported-metadata', origin);
    trace?.record({ role: 'face', requestedId: frozen.sourceCicnId!, ...chosen, action: 'selected', usage: 'admission',
      basis: 'compatibility-policy', reason: `${origin};prepared-binary-alpha-mask-policy` });
    const m = metadata(el);
    if (typeof m === 'string') return unavailable('unsupported-metadata', m);
    // Validate the body before invoking the public text rasterizer.
    const invalid = admitTabGeometry(source, rect(0, 0, source.height, source.width), m);
    if (invalid) return unavailable('unsupported-metadata', invalid);
    const { foreground, glyphs } = labelRaster(source, b, label);
    requestedWidth = Math.max(source.width, (glyphs?.width ?? 0) + 2 * m.corner + TAB_LABEL.padding);
    const input: TabInput = { source, destination: rect(0, 0, source.height, requestedWidth), metadata: m,
      samplingEquivalent: samplingEquivalent(el, owner, source) };
    const invalidOutput = admitTabGeometry(source, input.destination, m);
    if (invalidOutput) return unavailable('unsupported-metadata', invalidOutput);
    if (tabNeedsSampledBands(input) && !input.samplingEquivalent) {
      input.sampled = await sampledCompanion(el, owner, source);
      if (!input.sampled) return unavailable('unsupported-sampling', 'sampled-band-companion-or-equivalence-unavailable');
    }
    const colors = sampleColors(el, owner, source, !!input.samplingEquivalent, strongValid);
    Object.assign(input, colors);
    let pattern: PatternBinding = { status: 'missing' };
    if (!emptyRect(tabCenter(input)) && m.patternId !== 0) {
      pattern = bindPattern(owner, el, m.patternId);
      if (pattern.status === 'unsupported') return unavailable('unsupported-pattern', pattern.reason);
      trace?.record({ role: 'body-fill', requestedId: m.patternId, bodyMode: m.mode, requestedResourceType: 'ppat',
        owner: chosen.owner!, ...(pattern.status === 'ready' ? { resource: pattern.resource } : {}),
        action: pattern.status === 'ready' ? 'selected' : 'missing', basis: 'compatibility-policy', usage: 'paint',
        reason: pattern.status === 'ready' ? 'same-selected-face-owner-pattern' : 'missing-pattern-solid-erase' });
      if (pattern.status === 'ready') input.pattern = await loadCicnBuffer(pattern.url);
    }
    if (!emptyRect(tabCenter(input)) && !input.pattern && !input.backgroundRGB)
      return unavailable('unsupported-sampling', 'background-sample-unavailable-or-invalid');
    const out = PixelBuffer.alloc(requestedWidth, source.height);
    const body = drawTab(out, input);
    if (!body.drawn) return unavailable(body.unsupported!, body.reason!);
    observeBands(input, chosen, el, owner, trace);
    if (glyphs) out.drawOver(glyphs, Math.round((out.width - glyphs.width) / 2), Math.round((b.bottom - b.top + 1 - glyphs.height) / 2) + 1);
    trace?.textColors({ foreground, emboss: null, policy: 'contrast-fallback', embossDecision: 'unavailable', sampleFallbackReason: null,
      labelPainted: !!glyphs, deviceMode: 'full-color-policy', sourceManifestKey: hit.key, sourceOwnerDepth: hit.chainDepth });
    trace?.tabBody({ path: 'source-bands', basis: 'source-dispatch', center: body.center,
      backgroundPolicy: body.center === 'solid' ? colors.backgroundPolicy : 'none', sourceWidth, sourceHeight, requestedWidth,
      corner: m.corner, side: m.side, tile: m.tile, patternId: m.patternId,
      patternMissing: m.patternId !== 0 && body.center === 'solid', phase: body.phase, labelBasis: 'modern-contrast-policy' });
    if (colors.backgroundPolicy === 'raw-sample' && !el.engineColorSamples) trace?.record({ role: 'face', requestedId: frozen.sourceCicnId!, ...chosen,
      action: 'selected', usage: 'admission', basis: 'compatibility-policy', reason: 'declared-local-role-samples' });
    return out;
  });
}
