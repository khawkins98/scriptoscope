// Node-only corpus inputs for the tab/header rule table: each archive's raw
// fork (parsed here), plus the shared decoder's rasters, patterns and raw
// background samples (input identity; the decoder is not under test).
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { loadKaleidoscopeScheme } from '../../tools/theme-loader/loadKaleidoscopeScheme.js';
import { detectContainer, unwrapToResourceFork } from '../../tools/theme-loader/containers.js';
import { stuffItResourceForkWithSelection } from '../../tools/sit-wasm/index.mjs';
import { parseResourceMap } from './checkable-rules.mjs';
import { ALL_ARCHIVES, parseCinf } from './tab-header-rules.mjs';

export const archiveFile = slug => ['scheme.sit', 'scheme.rsrc'].find(f => existsSync(new URL(`../../themes/${slug}/${f}`, import.meta.url)));
const sha = b => createHash('sha256').update(b).digest('hex');
export async function loadCorpus(slugs = ALL_ARCHIVES) {
  const corpus = new Map();
  for (const slug of slugs) {
    const bytes = readFileSync(new URL(`../../themes/${slug}/${archiveFile(slug)}`, import.meta.url));
    const fork = detectContainer(bytes) === 'stuffit' ? (await stuffItResourceForkWithSelection(bytes)).bytes : unwrapToResourceFork(bytes);
    const map = parseResourceMap(fork), ids = type => new Set(map.filter(r => r.type === type).map(r => r.id));
    const census = { cicn: ids('cicn'), cinf: ids('cinf'), ppat: ids('ppat') };
    const loaded = await loadKaleidoscopeScheme(bytes, { encodeAssets: false, provenance: true });
    const asset = path => loaded.assets.find(a => a.path === path);
    const cinfOf = id => { const r = map.find(r => r.type === 'cinf' && r.id === id); return r ? parseCinf(r.data) : null; };
    /** Raster, raw sample and sampling status for cicn `id`, joined by the
     * decoder's byte provenance to this parse's bytes for that id. */
    const art = id => {
      const own = map.find(r => r.type === 'cicn' && r.id === id);
      if (!own) return null;
      const prov = loaded.byteProvenance.resources.find(r => r.type === 'cicn' && r.signedId === id);
      if (!prov || prov.sha256 !== sha(own.data)) throw new Error(`${slug} cicn ${id}: decoder bytes differ from the fork`);
      const element = Object.values(loaded.manifest.chromeElements).find(e => e.byteProvenance?.cicnResourceIndex === prov.resourceIndex);
      const raster = element && asset(element.asset);
      if (!raster) throw new Error(`${slug} cicn ${id}: no decoded raster`);
      return { raster, element, cinf: cinfOf(id), bg: element.colorSamples?.background?.displayRgb ?? null, sampling: element.samplingEquivalence?.status ?? 'unknown' };
    };
    /** Decoded ppat `id`, joined by byte provenance to this parse's bytes (not by the decoder's id label). */
    const pattern = id => {
      const own = map.find(r => r.type === 'ppat' && r.id === id);
      if (!own) return null;
      const prov = loaded.byteProvenance.resources.find(r => r.type === 'ppat' && r.sha256 === sha(own.data) && r.signedId === id);
      if (!prov) throw new Error(`${slug} ppat ${id}: decoder bytes differ from the fork`);
      const p = Object.values(loaded.manifest.patterns ?? {}).find(p => p.byteProvenance?.ppatResourceIndex === prov.resourceIndex);
      return p ? asset(p.asset) ?? null : null;
    };
    corpus.set(slug, { slug, file: archiveFile(slug), census, map, loaded, art, pattern, cinfOf });
  }
  return corpus;
}
