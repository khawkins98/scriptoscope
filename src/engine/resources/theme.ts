// Theme → ResourceChain adapter (v2 PLAN §3; DECISIONS #5). Browser-side: it
// decodes rasters, so it is not re-exported from the engine index.
//
// The chain is synchronous; rasters load asynchronously. The caller passes the
// (type, id) set its decision tables can request (e.g. `scrollbarResourceIds`),
// and the adapter preloads exactly those the theme chain holds, one provider
// per scheme: the archive's own fork, then each base nearest first. Requests the
// tables then make are answered, and traced, by ResourceChain itself.
//
// Lookup is by the structured signed resource id (never an asset path):
//   cicn  chromeElements[*].sourceCicnId; pixels, plus `iconBlit` depth and
//         opaque companion when the loader produced them (qd-primitives I1–I3);
//   ppat  patterns[*].sourcePpatId;
//   ics#  inspector.iconMaskResources (a census entry holding the full 16 × 16
//         image + mask, tables/scrollbar.ts SCROLLBAR_ICON_DRAW) with its raw
//         planes from inspector.iconMaskPlanes (AI5);
//   ics8  the glyph map's raster for the id, when inspector.iconIndex lists an
//         `ics8` at that id (decoded with the ics# mask applied by the loader).
import type { LoadedTheme } from '../../types.js';
import type { Pixmap } from '../qd/types.js';
import type { IconSource } from '../qd/region.js';
import { ResourceChain, mapProvider, type ResourceProvider } from './chain.js';
import { loadCicnBuffer } from '../../cicnImage.js';
import { assetUrl } from '../../loadTheme.js';
import { SCROLLBAR_ICON_DRAW } from '../tables/scrollbar.js';

async function themeProvider(theme: LoadedTheme, tier: 'archive' | 'base', name: string,
  wanted: readonly { type: string; id: number }[]): Promise<ResourceProvider> {
  const elements = Object.values(theme.manifest.chromeElements ?? {});
  const patterns = Object.values(theme.manifest.patterns ?? {});
  const icons = theme.inspector?.iconIndex ?? [];
  const masks = theme.inspector?.iconMaskResources ?? [];
  const load = (asset: string): Promise<Pixmap> => loadCicnBuffer(assetUrl(theme, asset));
  const entries = await Promise.all(wanted.map(async ({ type, id }): Promise<[string, unknown] | null> => {
    const key = `${type}:${id}`;
    if (type === 'cicn') {
      const el = elements.find(e => e.sourceCicnId === id && e.asset);
      if (!el) return null;
      const [pixmap, companion] = await Promise.all([load(el.asset),
        el.iconBlit?.unmaskedAsset ? load(el.iconBlit.unmaskedAsset) : Promise.resolve(null)]);
      // The opaque companion must be the same occurrence as the element's asset:
      // equal size and equal colour wherever the mask is set. Otherwise (e.g. a
      // consumer replaced `asset`) it is dropped and the I3 copy is unavailable.
      const unmasked = companion && sameOccurrence(pixmap, companion) ? companion : null;
      const value: IconSource = { pixmap, pixelSize: el.iconBlit?.pixelSize ?? null, unmasked };
      return [key, value];
    }
    if (type === 'ppat') {
      const p = patterns.find(e => e.sourcePpatId === id && e.asset);
      return p ? [key, await load(p.asset)] : null;
    }
    if (type === 'ics#') {
      if (!masks.some(m => m.id === id && m.byteLength >= SCROLLBAR_ICON_DRAW.maskRecordBytes)) return null;
      const planes = theme.inspector?.iconMaskPlanes?.[String(id)];
      return planes ? [key, { planes }] : null;
    }
    if (type === 'ics8') {
      // The glyph map holds each id's deepest colour icon; it is the ics8 only
      // when this fork ships an ics8 at the id (never fall back to ics4, AI4).
      const url = icons.some(i => i.id === id && i.type === 'ics8') ? theme.glyphs?.[String(id)] : undefined;
      return url ? [key, await load(url)] : null;
    }
    return null;
  }));
  return mapProvider(name, tier, entries.filter((e): e is [string, unknown] => e !== null));
}

/** Build the archive → base ResourceChain for `theme`, preloading `wanted`. */
export async function themeResourceChain(theme: LoadedTheme, wanted: readonly { type: string; id: number }[]): Promise<ResourceChain> {
  const providers: ResourceProvider[] = [];
  const seen = new Set<LoadedTheme>();
  let depth = 0;
  for (let t: LoadedTheme | undefined = theme; t && !seen.has(t); t = t.base, depth++) {
    seen.add(t);
    const name = t.manifest.name ? String(t.manifest.name) : `theme-${depth}`;
    providers.push(await themeProvider(t, depth === 0 ? 'archive' : 'base', depth === 0 ? name : `${name}#base${depth}`, wanted));
  }
  return new ResourceChain(providers);
}

/** Same size, and identical RGB at every mask-set pixel of `masked`. */
function sameOccurrence(masked: Pixmap, unmasked: Pixmap): boolean {
  if (masked.width !== unmasked.width || masked.height !== unmasked.height) return false;
  const a = masked.data, b = unmasked.data;
  for (let i = 0; i < a.length; i += 4) {
    if (a[i + 3] === 0) continue;
    if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]) return false;
  }
  return true;
}
