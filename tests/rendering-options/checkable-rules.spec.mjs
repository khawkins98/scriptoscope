import { existsSync, readFileSync } from 'node:fs';
import { test, expect, openHarness, attachObservations } from './fixtures.mjs';
import { detectContainer, unwrapToResourceFork } from '../../tools/theme-loader/containers.js';
import { stuffItResourceForkWithSelection } from '../../tools/sit-wasm/index.mjs';
import { CICN_LANE, ICON_ONLY, PUBLIC_ROWS, censusFromFork, checkRow, nativeFor, selectCheckable } from './checkable-rules.mjs';

// The checkable rule table of checkable-rules.test.mjs, run against the public
// source and built composeCheckable. Expectations are computed here in Node
// from each archive's own resource map; the page only reports which archive
// rasters equal the public output.
const SLUGS = [...CICN_LANE, ...ICON_ONLY];
const archives = Object.fromEntries(SLUGS.map(slug => [slug, ['scheme.sit', 'scheme.rsrc'].find(f => existsSync(new URL(`../../themes/${slug}/${f}`, import.meta.url)))]));
const expected = {};
for (const slug of SLUGS) {
  const bytes = readFileSync(new URL(`../../themes/${slug}/${archives[slug]}`, import.meta.url));
  const fork = detectContainer(bytes) === 'stuffit' ? (await stuffItResourceForkWithSelection(bytes)).bytes : unwrapToResourceFork(bytes);
  const census = censusFromFork(fork);
  expected[slug] = PUBLIC_ROWS.map(row => selectCheckable(nativeFor(row.kind, row.options), census));
}

for (const mode of ['source', 'built']) {
  test(`${mode}: public composeCheckable draws the art the 2.3.1 CICN/icon lanes select, for every archive`, async ({ page, servers }, info) => {
    info.annotations.push({ type: 'fidelity-assertion', description: 'checkable.selection-rules' });
    await openHarness(page, servers, mode);
    const observed = await page.evaluate(async ({ mode, archives, rows }) => {
      const api = await import(mode === 'built' ? '/dist/scriptoscope.js' : '/src/index.ts');
      const inLane = id => id >= -9504 && id <= -9481, inIcons = id => id >= -10240 && id <= -10214;
      const out = {};
      for (const [slug, file] of Object.entries(archives)) {
        // Candidate rasters from the shared decoder (input identity, not under test).
        const raw = await api.loadKaleidoscopeScheme(new Uint8Array(await (await fetch(`/themes/${slug}/${file}`)).arrayBuffer()), { encodeAssets: false, provenance: true });
        const byIndex = new Map(raw.byteProvenance.resources.map(r => [r.resourceIndex, r]));
        const asset = path => raw.assets.find(a => a.path === path);
        const candidates = [
          ...Object.values(raw.manifest.chromeElements).map(e => [byIndex.get(e.byteProvenance?.cicnResourceIndex), asset(e.asset)])
            .filter(([r, a]) => r?.type === 'cicn' && inLane(r.signedId) && a).map(([r, a]) => ({ lane: 'cicn', id: r.signedId, a })),
          ...raw.iconIndex.filter(e => inIcons(e.id) && /^ics[48]$/.test(e.type)).map(e => ({ lane: 'icon', id: e.id, type: e.type, a: asset(`icons/${e.file}`) })).filter(c => c.a),
        ];
        const same = (a, b) => {
          if (a.width !== b.width || a.height !== b.height) return false;
          for (let i = 0; i < b.data.length; i += 4) {
            if (a.rgba[i + 3] !== b.data[i + 3]) return false;
            if (b.data[i + 3] && (a.rgba[i] !== b.data[i] || a.rgba[i + 1] !== b.data[i + 1] || a.rgba[i + 2] !== b.data[i + 2])) return false;
          }
          return true;
        };
        const theme = await api.loadTheme(`/themes/${slug}`);
        out[slug] = [];
        for (const { kind, options } of rows) {
          const buffer = await api.composeCheckable(theme, kind, options);
          out[slug].push(buffer ? { isNull: false, size: [buffer.width, buffer.height], matches: candidates.filter(c => same(c.a, buffer)).map(({ lane, id, type }) => ({ lane, id, type })) } : { isNull: true, matches: [] });
        }
        theme.dispose?.();
      }
      return out;
    }, { mode, archives, rows: PUBLIC_ROWS });
    const results = SLUGS.flatMap(slug => PUBLIC_ROWS.map((row, i) => ({ slug, row, expected: expected[slug][i], observed: observed[slug][i], ...checkRow(expected[slug][i], observed[slug][i]) })));
    await attachObservations(info, 'checkable-rules', mode, { mode, results });
    expect(Object.keys(observed)).toEqual(SLUGS);
    expect(results).toHaveLength(216);
    expect(results.filter(r => r.failure).map(r => `${r.slug}/${r.row.kind}/${JSON.stringify(r.row.options)}: ${r.failure}`)).toEqual([]);
    expect(results.filter(r => r.skipped)).toEqual([]);
    // Discrimination census: rows whose output equals more than one archive
    // raster cannot tell those resources apart, so they are counted, not hidden.
    const shared = results.filter(r => !r.discriminating).map(r => `${r.slug}/${r.row.kind}/${r.row.options.disabled ? 'disabled' : 'normal'}/${r.row.options.mixed ? 'mixed' : r.row.options.checked ? 'on' : 'off'}`);
    await attachObservations(info, 'checkable-rules', `${mode}-shared`, { shared });
    expect(results.length - shared.length).toBeGreaterThan(150);
  });
}
