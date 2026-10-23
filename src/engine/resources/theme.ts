// Theme → ResourceChain adapter (v2 PLAN §3; DECISIONS #5). Browser-side: it
// decodes rasters, so it is not re-exported from the engine index.
//
// Family-agnostic: it holds no family ids or tables. The chain is synchronous;
// rasters load asynchronously, so the caller (a family facade) passes the
// (type, id) set its decision tables can request (e.g. `scrollbarResourceIds`),
// and the adapter preloads exactly those the theme chain holds, one provider
// per scheme: the archive's own fork, then each base nearest first. Requests the
// tables then make are answered, and traced, by ResourceChain itself.
//
// Lookup is by the structured signed resource id (never an asset path):
//   cicn  chromeElements[*].sourceCicnId; pixels, plus `iconBlit` depth and
//         opaque companion when the loader produced them (qd-primitives I1–I3);
//   cinf  manifest.engineCinfs[id] raw bytes (loader option engineCinfIds, on by
//         default through loadTheme and the public loadKaleidoscopeScheme);
//   ppat  patterns[*].sourcePpatId;
//   ics#  its raw planes, inspector.iconMaskPlanes (present only for a full
//         16 × 16 image + mask record);
//   ics8  the glyph map's raster for the id, when inspector.iconIndex lists an
//         `ics8` at that id (decoded with the ics# mask applied by the loader).
//   actb / clut  inspector.colorTables[`type:id`] (entries in index order).
import type { LoadedTheme } from '../../types.js';
import type { Pixmap } from '../qd/types.js';
import type { ResourceSelection } from '../trace.js';
import { ResourceChain, mapProvider, type ResourceProvider } from './chain.js';
import { loadCicnBuffer } from '../../cicnImage.js';
import { ownerDisplayPolicyMatches, realizeRgb16 } from '../../../tools/theme-loader/display-profile.js';
import { decodeCinfHeader } from '../qd/cinfFrame.js';
import { CINF_SAMPLE } from '../tables/cinfFrame.js';
import type { QdPoint, QdRect } from '../qd/types.js';
import { assetUrl } from '../../loadTheme.js';
import { onAssetUrlReleased } from '../../../tools/theme-loader/assetLifecycle.js';
import { engineLineSampledCicnIds } from './ids.js';

/** Only line-sampled cicns load their sampler companion (loaderNeeds `lineSampledCicns`). */
const LINE_SAMPLED = new Set(engineLineSampledCicnIds());
import { cicnIconSource } from './iconSource.js';

async function themeProvider(theme: LoadedTheme, tier: 'archive' | 'base', name: string,
  wanted: readonly { type: string; id: number }[], chainDepth: number, life?: ChainLife, checkables = false, traceProvenance = false, declaredCinfs = false,
  clippedBodyId?: number): Promise<ResourceProvider> {
  const selections = new Map<string, ResourceSelection>();
  const unmaskedSources = traceProvenance ? new Map<string, { assetUrl: string; derivedPath?: string }>() : undefined;
  const owner = { baseUrl: theme.baseUrl, chainDepth };
  const elementEntries = Object.entries(theme.manifest.chromeElements ?? {});
  const elements = elementEntries.map(([, element]) => element);
  const patternEntries = Object.entries(theme.manifest.patterns ?? {});
  const icons = theme.inspector?.iconIndex ?? [];
  const validOccurrence = (r: { resourceIndex: number; byteLength: number }) => Number.isInteger(r.resourceIndex)
    && r.resourceIndex >= 0 && Number.isInteger(r.byteLength) && r.byteLength >= 0;
  // With a caller lifetime, no decode starts once it has ended (its signal
  // aborted, or the owner released one of this chain's asset URLs).
  const load = (asset: string): Promise<Pixmap> => {
    if (life?.ended()) return Promise.reject(abortError());
    return loadCicnBuffer(assetUrl(theme, asset));
  };
  const entry = async ({ type, id }: { type: string; id: number }): Promise<[string, unknown] | null> => {
    const key = `${type}:${id}`;
    if (type === 'cicn') {
      const unknown = (reason: string): [string, unknown] => {
        // The provider is known; an unavailable asset identity remains unknown.
        if (traceProvenance) selections.set(key, { owner });
        return [key, { status: 'unknown', reason }];
      };
      if (theme.inspector?.cicnResources) {
        const raw = theme.inspector.cicnResources.filter(r => r.id === id);
        const decoded = elements.filter(e => e.sourceCicnId === id && e.asset);
        if (raw.length > 1 || raw.length === 1 && (!validOccurrence(raw[0]!) || decoded.length !== 1))
          return unknown('ambiguous or undecoded raw cicn occurrence');
        if (raw.length === 0 && decoded.length) return unknown('cicn decoded asset contradicts raw census');
        const el = decoded[0], occurrence = raw[0];
        if (el && occurrence && (el.byteProvenance && el.byteProvenance.cicnResourceIndex !== occurrence.resourceIndex
          || el.cicnSource && (el.cicnSource.id !== id || el.cicnSource.resourceIndex !== occurrence.resourceIndex
            || el.cicnSource.byteLength !== occurrence.byteLength)))
          return unknown('decoded cicn occurrence contradicts raw census');
      }
      if (checkables && elements.filter(e => e.sourceCicnId === id).length > 1) return unknown('ambiguous cicn occurrence');
      const selected = elementEntries.find(([, e]) => e.sourceCicnId === id && e.asset);
      const el = selected?.[1];
      if (!el) {
        if (checkables && elements.some(e => e.sourceCicnId === id)) return unknown('cicn occurrence has no decoded asset');
        return null;
      }
      const status = el.samplingEquivalence?.status ?? null;
      if (traceProvenance) selections.set(key, { owner, resource: { type: 'cicn', signedId: el.sourceCicnId!,
        sourceCinfId: Number.isInteger(el.sourceCinfId) ? el.sourceCinfId! : null,
        manifestKey: selected![0], assetUrl: assetUrl(theme, el.asset),
        ...(el.byteProvenance ? { byteProvenance: { ...el.byteProvenance } } : {}) } });
      if (id === clippedBodyId) return [key, { status: 'clipped' }];
      const sampleAsset = el.asset;
      // Preserve the actual preparation binding before copying the finite values.
      // Paths/dimensions and even equal census scalars cannot identify a provider.
      const sampleSource = el.engineColorSamples?.source;
      const selectedSource = el.cicnSource;
      const boundOccurrence = () => selectedSource != null
        && el.cicnSource === selectedSource && el.sourceCicnId === id && el.asset === sampleAsset
        && (!el.byteProvenance || el.byteProvenance.cicnResourceIndex === selectedSource.resourceIndex)
        && theme.inspector?.cicnResources?.filter(r => r.id === id).length === 1
        && theme.inspector.cicnResources.find(r => r.id === id) === selectedSource;
      const bounds = selectedSource?.bounds;
      const finiteSamples = el.engineColorSamples ? structuredClone(el.engineColorSamples) : undefined;
      const companionAsset = el.iconBlit?.unmaskedAsset;
      const companionTransport = unmaskedSources && companionAsset
        ? { assetUrl: assetUrl(theme, companionAsset),
          ...(/^(?:blob:|https?:|data:)/.test(companionAsset) ? {} : { derivedPath: companionAsset }) } : undefined;
      const [pixmap, companion, sampled] = await Promise.all([load(el.asset),
        companionAsset ? load(companionAsset) : Promise.resolve(null),
        status === 'different' && el.sampledBandAsset && LINE_SAMPLED.has(id) ? load(el.sampledBandAsset.asset) : Promise.resolve(null)]);
      // Adapter policy, not a spec row (docs/v2/DECISIONS.md #7): the opaque
      // companion is used only when it is the same occurrence as the element's
      // asset (equal size, equal colour wherever the mask is set). Otherwise (e.g.
      // a consumer replaced `asset`) the icon falls back to the masked copy of the
      // current asset, and the fallback is recorded in the trace (iconSource.ts).
      // Line-colour inputs (slider BL8/BL12) and the bounds origin (BL11) ride along.
      const source = cicnIconSource(pixmap, el.iconBlit?.pixelSize ?? null, companion);
      if (source.unmasked && companionTransport) unmaskedSources!.set(key, companionTransport);
      return [key, { ...source,
        origin: selectedSource ? (boundOccurrence() && bounds
          && bounds.right - bounds.left === pixmap.width && bounds.bottom - bounds.top === pixmap.height
          ? { top: bounds.top, left: bounds.left } : null) : el.boundsOrigin ?? null,
        sampling: status, sampled,
        realizeRgb16: (rgb: readonly [number, number, number]) => {
          const [r, g, b] = realizeRgb16(rgb, theme.manifest.displayProfile);
          return { r: r!, g: g!, b: b!, a: CINF_SAMPLE.opaque };
        },
        sampleRgb16: (point: QdPoint) => {
          const samples = finiteSamples;
          if (!boundOccurrence() || sampleSource !== selectedSource || !samples || samples.model !== 'kdef-2.3.1-engine-points' || samples.asset !== sampleAsset
            || samples.width !== pixmap.width || samples.height !== pixmap.height
            || !ownerDisplayPolicyMatches(theme.manifest, samples.displayPolicy)) return null;
          return samples.points[`${point.x},${point.y}`]?.rgb16 ?? null;
        } }];
    }
    if (type === 'cinf') {
      if (declaredCinfs) return null;
      // Raw cinf bytes the loader kept for the engine's cinf ids (manifest.engineCinfs;
      // loadTheme and the public loadKaleidoscopeScheme ask for them by default). A
      // load without them has no engine cinfs: every cinf request is absent.
      const bytes = theme.manifest.engineCinfs?.[String(id)];
      if (traceProvenance && bytes) selections.set(key, { owner });
      return bytes ? [key, { bytes }] : null;
    }
    if (type === 'ppat') {
      const selected = patternEntries.find(([, e]) => e.sourcePpatId === id && e.asset);
      const p = selected?.[1];
      if (traceProvenance && p) selections.set(key, { owner, resource: { type: 'ppat', signedId: p.sourcePpatId!, sourceCinfId: null,
        manifestKey: selected![0], assetUrl: assetUrl(theme, p.asset),
        ...(p.byteProvenance ? { byteProvenance: { ...p.byteProvenance } } : {}) } });
      return p ? [key, await load(p.asset)] : null;
    }
    if (checkables && type === 'ics#') {
      const census = theme.inspector?.iconMaskResources;
      if (!census) return [key, { status: 'unknown', reason: 'ics# census unavailable' }];
      const matches = census.filter(r => r.id === id);
      if (!matches.length) return null;
      const planes = theme.inspector?.iconMaskPlanes?.[String(id)];
      if (matches.length !== 1 || !validOccurrence(matches[0]!) || matches[0]!.byteLength < 64 || !planes || planes.length !== 64)
        return [key, { status: 'unknown', reason: 'ambiguous, malformed or undecoded ics#' }];
      return [key, { planes: [...planes] }];
    }
    if (checkables && type === 'ics8') {
      const census = theme.inspector?.iconColorResources;
      if (!census) return [key, { status: 'unknown', reason: 'ics8 census unavailable' }];
      const matches = census.filter(r => r.type === type && r.id === id);
      if (!matches.length) return null;
      const candidates = icons.filter(r => r.id === id && r.type === type && r.resourceIndex === matches[0]!.resourceIndex);
      const icon = candidates[0];
      if (matches.length !== 1 || !validOccurrence(matches[0]!) || matches[0]!.byteLength < 256 || candidates.length !== 1 || !icon?.unmaskedUrl)
        return [key, { status: 'unknown', reason: 'ambiguous, malformed or undecoded ics8 occurrence' }];
      return [key, await load(icon.unmaskedUrl)];
    }
    if (type === 'ics#') {
      // The loader keeps planes only for a complete 16 × 16 record (image + mask).
      const planes = theme.inspector?.iconMaskPlanes?.[String(id)];
      return planes ? [key, { planes }] : null;
    }
    if (type === 'ics8') {
      // The glyph map holds each id's deepest colour icon; it is the ics8 only
      // when this fork ships an ics8 at the id (never fall back to ics4, AI4).
      const url = icons.some(i => i.id === id && i.type === 'ics8') ? theme.glyphs?.[String(id)] : undefined;
      return url ? [key, await load(url)] : null;
    }
    if (type === 'actb' || type === 'clut') {
      const table = theme.inspector?.colorTables?.[`${type}:${id}`];
      return table ? [key, table] : null;
    }
    return null;
  };
  const entries = await Promise.all(wanted.map(async request => {
    try { return await entry(request); }
    catch (error) {
      if (!checkables || life?.ended()) throw error;
      return [`${request.type}:${request.id}`, { status: 'unknown', reason: `resource decode failed: ${String(error)}` }] as [string, unknown];
    }
  }));
  return { ...mapProvider(name, tier, entries.filter((e): e is [string, unknown] => e !== null)),
    selection: (type, id) => selections.get(`${type}:${id}`),
    ...(unmaskedSources ? { unmaskedSource: (type: string, id: number) => unmaskedSources.get(`${type}:${id}`) } : {}) };
}

interface ChainLife { ended(): boolean; close(): void }

const abortError = (): Error => new DOMException('slider composition ended', 'AbortError');

/**
 * A caller lifetime for one chain build: it ends when `signal` aborts or when the
 * owner releases any asset URL of `theme` or its bases (a disposed theme revokes
 * them all at once). Adapter policy, no spec row.
 */
function chainLife(theme: LoadedTheme, signal: AbortSignal): ChainLife {
  const urls = new Set<string>();
  const seen = new Set<LoadedTheme>();
  for (let t: LoadedTheme | undefined = theme; t && !seen.has(t); t = t.base) {
    seen.add(t);
    for (const e of Object.values(t.manifest.chromeElements ?? {})) {
      for (const a of [e.asset, e.iconBlit?.unmaskedAsset, e.sampledBandAsset?.asset]) if (a) urls.add(assetUrl(t, a));
    }
    for (const p of Object.values(t.manifest.patterns ?? {})) if (p.asset) urls.add(assetUrl(t, p.asset));
    for (const g of Object.values(t.glyphs ?? {})) if (g) urls.add(g);
    for (const icon of t.inspector?.iconIndex ?? []) if (icon.unmaskedUrl) urls.add(assetUrl(t, icon.unmaskedUrl));
  }
  let released = false;
  const stop = onAssetUrlReleased(url => { if (urls.has(url)) released = true; });
  return { ended: () => signal.aborted || released, close: stop };
}

/**
 * Build the archive → base ResourceChain for `theme`, preloading `wanted`. With
 * `signal`, the build is bound to the caller's lifetime: once the signal aborts
 * or the theme's asset URLs are released, no further decode starts and the call
 * rejects with an `AbortError`. Without it (scroll bar, built-in frame) nothing
 * changes.
 */
export async function themeResourceChain(theme: LoadedTheme, wanted: readonly { type: string; id: number }[],
  opts: { signal?: AbortSignal; cinfProviders?: readonly ResourceProvider[]; cinfBodies?: readonly number[]; checkables?: boolean; traceProvenance?: boolean;
    bodyEnvironment?: { owner: LoadedTheme; width: number; height: number; clip?: QdRect;
      requests?: readonly { type: string; id: number }[] } } = {}): Promise<ResourceChain> {
  const providers: ResourceProvider[] = [];
  const bodyRequests = opts.bodyEnvironment ? new Map(opts.bodyEnvironment.requests?.map(r => [`${r.type}:${r.id}`, r])) : undefined;
  let bodyProvider: ResourceProvider | undefined;
  let clippedBodyId: number | undefined;
  // Preload typed body dependencies without issuing engine requests. Resource
  // order/NULL semantics remain owned by the synchronous painter at draw time.
  if (opts.cinfBodies) {
    const dependencies = new Map(wanted.map(r => [`${r.type}:${r.id}`, r]));
    let selected = null, headerFound = false;
    for (const id of opts.cinfBodies) {
      const seenBodies = new Set<LoadedTheme>();
      for (let t: LoadedTheme | undefined = theme; t && !seenBodies.has(t); t = t.base) {
        seenBodies.add(t);
        const bytes = t.manifest.engineCinfs?.[String(id)];
        if (bytes) { selected = decodeCinfHeader(bytes); headerFound = true; break; }
      }
      if (headerFound) break;
    }
    if (selected) {
      const type = selected.patternAnchor === 5 ? 'cicn' : 'ppat', id = selected.bgPatternId;
      (bodyRequests ?? dependencies).set(`${type}:${id}`, { type, id });
      if (opts.bodyEnvironment && type === 'cicn') {
        const { width, height, clip } = opts.bodyEnvironment, side = selected.sideThickness;
        if (Math.max(0, side, clip?.left ?? 0) >= Math.min(width, width - side, clip?.right ?? width)
          || Math.max(0, side, clip?.top ?? 0) >= Math.min(height, height - side, clip?.bottom ?? height)) clippedBodyId = id;
      }
    }
    wanted = [...dependencies.values()];
  }
  const seen = new Set<LoadedTheme>();
  const life = opts.signal ? chainLife(theme, opts.signal) : undefined;
  let depth = 0;
  try {
  for (let t: LoadedTheme | undefined = theme; t && !seen.has(t); t = t.base, depth++) {
    // A caller lifetime that ended stops before the next tier starts decoding.
    if (life?.ended()) throw abortError();
    seen.add(t);
    const name = t.manifest.name ? String(t.manifest.name) : `theme-${depth}`;
    const ownsBody = t === opts.bodyEnvironment?.owner;
    const requests = ownsBody ? [...new Map([...wanted, ...bodyRequests!.values()].map(r => [`${r.type}:${r.id}`, r])).values()] : wanted;
    const provider = await themeProvider(t, depth === 0 ? 'archive' : 'base', depth === 0 ? name : `${name}#base${depth}`,
      requests, depth, life, opts.checkables, opts.traceProvenance, opts.cinfProviders !== undefined,
      ownsBody && !wanted.some(r => r.type === 'cicn' && r.id === clippedBodyId) ? clippedBodyId : undefined);
    providers.push(provider);
    if (ownsBody) bodyProvider = provider;
  }
  if (life?.ended()) throw abortError();
  if (opts.bodyEnvironment && !bodyProvider) throw new Error('Selected push face owner unavailable');
  } finally { life?.close(); }
  // A declared cinf-only tier is authoritative: archive/base cinfs were
  // suppressed above, while all non-cinf resources retain their normal chain.
  return new ResourceChain([...(opts.traceProvenance ? providers : providers.map(({ selection: _selection, ...provider }) => provider)), ...(opts.cinfProviders ?? [])], bodyProvider);
}
