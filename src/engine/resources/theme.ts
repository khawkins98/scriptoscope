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
import { ResourceChain, mapProvider, type ResourceProvider } from './chain.js';
import { loadCicnBuffer } from '../../cicnImage.js';
import { ownerDisplayPolicyMatches, realizeRgb16 } from '../../../tools/theme-loader/display-profile.js';
import { decodeCinfHeader } from '../qd/cinfFrame.js';
import { CINF_SAMPLE } from '../tables/cinfFrame.js';
import type { QdPoint } from '../qd/types.js';
import { assetUrl } from '../../loadTheme.js';
import { onAssetUrlReleased } from '../../../tools/theme-loader/assetLifecycle.js';
import { engineLineSampledCicnIds } from './ids.js';

/** Only line-sampled cicns load their sampler companion (loaderNeeds `lineSampledCicns`). */
const LINE_SAMPLED = new Set(engineLineSampledCicnIds());
import { cicnIconSource } from './iconSource.js';

async function themeProvider(theme: LoadedTheme, tier: 'archive' | 'base', name: string,
  wanted: readonly { type: string; id: number }[], life?: ChainLife): Promise<ResourceProvider> {
  const elements = Object.values(theme.manifest.chromeElements ?? {});
  const patterns = Object.values(theme.manifest.patterns ?? {});
  const icons = theme.inspector?.iconIndex ?? [];
  // With a caller lifetime, no decode starts once it has ended (its signal
  // aborted, or the owner released one of this chain's asset URLs).
  const load = (asset: string): Promise<Pixmap> => {
    if (life?.ended()) return Promise.reject(abortError());
    return loadCicnBuffer(assetUrl(theme, asset));
  };
  const entry = async ({ type, id }: { type: string; id: number }): Promise<[string, unknown] | null> => {
    const key = `${type}:${id}`;
    if (type === 'cicn') {
      const el = elements.find(e => e.sourceCicnId === id && e.asset);
      if (!el) return null;
      const status = el.samplingEquivalence?.status ?? null;
      const sampleAsset = el.asset;
      const finiteSamples = el.engineColorSamples ? structuredClone(el.engineColorSamples) : undefined;
      const [pixmap, companion, sampled] = await Promise.all([load(el.asset),
        el.iconBlit?.unmaskedAsset ? load(el.iconBlit.unmaskedAsset) : Promise.resolve(null),
        status === 'different' && el.sampledBandAsset && LINE_SAMPLED.has(id) ? load(el.sampledBandAsset.asset) : Promise.resolve(null)]);
      // Adapter policy, not a spec row (docs/v2/DECISIONS.md #7): the opaque
      // companion is used only when it is the same occurrence as the element's
      // asset (equal size, equal colour wherever the mask is set). Otherwise (e.g.
      // a consumer replaced `asset`) the icon falls back to the masked copy of the
      // current asset, and the fallback is recorded in the trace (iconSource.ts).
      // Line-colour inputs (slider BL8/BL12) and the bounds origin (BL11) ride along.
      return [key, { ...cicnIconSource(pixmap, el.iconBlit?.pixelSize ?? null, companion),
        origin: el.boundsOrigin ?? null, sampling: status, sampled,
        realizeRgb16: (rgb: readonly [number, number, number]) => {
          const [r, g, b] = realizeRgb16(rgb, theme.manifest.displayProfile);
          return { r: r!, g: g!, b: b!, a: CINF_SAMPLE.opaque };
        },
        sampleRgb16: (point: QdPoint) => {
          const samples = finiteSamples;
          if (!samples || samples.model !== 'kdef-2.3.1-engine-points' || samples.asset !== sampleAsset
            || samples.width !== pixmap.width || samples.height !== pixmap.height
            || !ownerDisplayPolicyMatches(theme.manifest, samples.displayPolicy)) return null;
          return samples.points[`${point.x},${point.y}`]?.rgb16 ?? null;
        } }];
    }
    if (type === 'cinf') {
      // Raw cinf bytes the loader kept for the engine's cinf ids (manifest.engineCinfs;
      // loadTheme and the public loadKaleidoscopeScheme ask for them by default). A
      // load without them has no engine cinfs: every cinf request is absent.
      const bytes = theme.manifest.engineCinfs?.[String(id)];
      return bytes ? [key, { bytes }] : null;
    }
    if (type === 'ppat') {
      const p = patterns.find(e => e.sourcePpatId === id && e.asset);
      return p ? [key, await load(p.asset)] : null;
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
  const entries = await Promise.all(wanted.map(entry));
  return mapProvider(name, tier, entries.filter((e): e is [string, unknown] => e !== null));
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
  opts: { signal?: AbortSignal; cinfBodies?: readonly number[] } = {}): Promise<ResourceChain> {
  const providers: ResourceProvider[] = [];
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
      dependencies.set(`${type}:${id}`, { type, id });
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
    providers.push(await themeProvider(t, depth === 0 ? 'archive' : 'base', depth === 0 ? name : `${name}#base${depth}`, wanted, life));
  }
  if (life?.ended()) throw abortError();
  } finally { life?.close(); }
  return new ResourceChain(providers);
}
