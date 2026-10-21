import { existsSync } from 'node:fs';
import { test, expect, openHarness, attachObservations } from './fixtures.mjs';
import { SLICED, CANONICAL_WND } from './window-chrome-rules.mjs';

// The same source-addressed rule table as window-chrome-rules.test.mjs, run
// against the public source and built bundles (decode + compose in-page).
const archives = Object.fromEntries(SLICED.map(slug => [slug, ['scheme.sit', 'scheme.rsrc']
  .find(f => existsSync(new URL(`../../themes/${slug}/${f}`, import.meta.url)))]));
for (const mode of ['source', 'built']) {
  test(`${mode}: wnd# recipe walk rules hold for every sliced corpus window at sampled sizes`, async ({ page, servers }, info) => {
    info.annotations.push({ type: 'fidelity-assertion', description: 'window.recipe-rules' });
    await openHarness(page, servers, mode);
    const result = await page.evaluate(async ({ mode, archives }) => {
      const api = await import(mode === 'built' ? '/dist/scriptoscope.js' : '/src/index.ts');
      const rules = await import('/tests/rendering-options/window-chrome-rules.mjs');
      const out = {};
      for (const [slug, file] of Object.entries(archives)) {
        const bytes = new Uint8Array(await (await fetch(`/themes/${slug}/${file}`)).arrayBuffer());
        out[slug] = rules.checkTheme(await api.loadKaleidoscopeScheme(bytes, { encodeAssets: false }), api);
      }
      return out;
    }, { mode, archives });
    await attachObservations(info, 'window-chrome-rules', `${mode}-recipe`, { mode,
      totals: Object.fromEntries(Object.entries(result).map(([slug, r]) => [slug, r.totals])), failures: Object.values(result).flatMap(r => r.failures) });
    expect(Object.keys(result)).toEqual(SLICED);
    for (const [slug, r] of Object.entries(result)) {
      expect(r.failures, slug).toEqual([]);
      expect(r.totals.cells * r.totals.halves, slug).toBeGreaterThan(0);
    }
    expect(Object.values(result).reduce((s, r) => s + r.totals.pixels, 0)).toBeGreaterThan(1e6);
    expect(Object.values(result).reduce((s, r) => s + r.totals.pixelsForward, 0)).toBeGreaterThan(1e6);
    expect(Object.entries(result).filter(([, r]) => r.totals.pixelsReverse > 0).map(([slug]) => slug).sort()).toEqual(['animals', 'monkey-paradise']);
  });

  test(`${mode}: public renderWindow selects the first wnd# the 0x356c ladder loads`, async ({ page, servers }, info) => {
    info.annotations.push({ type: 'fidelity-assertion', description: 'window.wnd-ladder' });
    await openHarness(page, servers, mode);
    const rows = await page.evaluate(async ({ mode, slugs, requests }) => {
      const api = await import(mode === 'built' ? '/dist/scriptoscope.js' : '/src/index.ts');
      const rules = await import('/tests/rendering-options/window-chrome-rules.mjs');
      const rows = [];
      for (const slug of slugs) {
        const theme = await api.loadTheme(`/themes/${slug}`, { provenance: true });
        const byIndex = new Map(theme.byteProvenance.resources.map(r => [r.resourceIndex, r]));
        const present = new Set(theme.byteProvenance.resources.filter(r => r.type === 'wnd#' && r.status === 'decoded').map(r => r.signedId));
        let seen = [];
        // Observe the actual object entering renderWindow's model branch.
        for (const type of Object.values(theme.manifest.windowTypes)) {
          const model = type.model;
          Object.defineProperty(type, 'model', { configurable: true, get() { seen.push(type); return model; } });
        }
        for (const [request, id] of Object.entries(requests)) {
          seen = [];
          await api.renderWindow(theme, { width: 120, height: 40, title: '', state: 'active', windowType: request });
          const selected = seen.at(-1);
          rows.push({ slug, request, expected: rules.ladderSelection(id, present),
            actual: byIndex.get(selected?.byteProvenance?.recipe?.resourceIndex)?.signedId ?? null });
        }
        theme.dispose?.();
      }
      return rows;
    }, { mode, slugs: SLICED, requests: CANONICAL_WND });
    await attachObservations(info, 'window-chrome-rules', `${mode}-ladder`, { mode, rows });
    expect(rows).toHaveLength(SLICED.length * Object.keys(CANONICAL_WND).length);
    expect(rows.filter(r => r.expected == null)).toEqual([]);
    expect(rows.filter(r => r.actual !== r.expected)).toEqual([]);
    expect(rows.filter(r => r.actual !== CANONICAL_WND[r.request]).length).toBeGreaterThan(0); // fallback steps exercised
  });
}
