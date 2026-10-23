import { existsSync } from 'node:fs';
import { test, expect, openHarness, attachObservations } from './fixtures.mjs';
import { SLICED, CANONICAL_WND } from './window-chrome-rules.mjs';

// The same source-addressed rule table as window-chrome-rules.test.mjs, run
// against the public source and built bundles (decode + compose in-page).
const archives = Object.fromEntries(SLICED.map(slug => [slug, ['scheme.sit', 'scheme.rsrc']
  .find(f => existsSync(new URL(`../../themes/${slug}/${f}`, import.meta.url)))]));
// Mutation bites run in-page too (window-widgets §7.1): each must fail a sample
// the unmutated table passes, in the bundle under test.
const BITES = [
  ['clampBudget', '1138', 'document-window'], ['pinLast', 'floppies', 'collapsed-document-window'],
  ['pinLast', 'animals', 'collapsed-no-title-utility'], ['nearEdge', '1138', 'titled-utility-window'],
  ['keepBezels', 'animals', 'document-window'], ['dropPlate', 'animals', 'document-window'], ['skipTT8', 'floppies', 'document-window'],
  ['reverseOrder', 'floppies', 'document-window'], ['opaque', '1138', 'document-window'], ['paintTrailing', '1138', 'document-window'],
  ['rectHit', 'animals', 'document-window'], ['noWD6', '1138', 'popup-window'], ['tt2aCondense', 'animals', 'movable-alert'],
];
for (const mode of ['source', 'built']) {
  test(`${mode}: wnd# window-widgets rules (layout, cells, title rect, WD4 pixels, HT hits) hold for every sliced corpus window at sampled sizes`, async ({ page, servers }, info) => {
    test.setTimeout(300_000);
    info.annotations.push({ type: 'fidelity-assertion', description: 'window.recipe-rules' });
    await openHarness(page, servers, mode);
    const result = await page.evaluate(async ({ mode, archives, bites }) => {
      const api = await import(mode === 'built' ? '/dist/scriptoscope.js' : '/src/index.ts');
      const rules = await import('/tests/rendering-options/window-chrome-rules.mjs');
      const out = {}, decoded = {};
      for (const [slug, file] of Object.entries(archives)) {
        const bytes = new Uint8Array(await (await fetch(`/themes/${slug}/${file}`)).arrayBuffer());
        decoded[slug] = await api.loadKaleidoscopeScheme(bytes, { encodeAssets: false });
        out[slug] = rules.checkTheme(decoded[slug], api);
      }
      const bitten = bites.map(([mutation, slug, key]) => {
        const filter = k => k === key;
        return { mutation, slug, key, clean: rules.checkTheme(decoded[slug], api, { filter }).failures.length,
          failures: rules.checkTheme(decoded[slug], api, { filter, mutation }).failures.length };
      });
      return { out, bitten };
    }, { mode, archives, bites: BITES });
    const totals = Object.fromEntries(Object.entries(result.out).map(([slug, r]) => [slug, r.totals]));
    await attachObservations(info, 'window-chrome-rules', `${mode}-recipe`, { mode, totals, bitten: result.bitten,
      failures: Object.values(result.out).flatMap(r => r.failures) });
    expect(Object.keys(result.out)).toEqual(SLICED);
    for (const [slug, r] of Object.entries(result.out)) {
      expect(r.failures, slug).toEqual([]);
      expect(r.totals.cells > 0 && r.totals.pixels > 0 && r.totals.hits > 0, slug).toBe(true);
      expect(r.totals.titleRects, slug).toBe(r.totals.compositions);
    }
    const sum = k => Object.values(totals).reduce((s, t) => s + t[k], 0);
    // AW8, LS9, TT8, TT10, AP1, WD4 order, Q3 unpainted, RM6 empty collapse boxes, HT8 mask-clear misses.
    for (const k of ['negativeBudget', 'shortSides', 'tt8', 'tt2Default', 'untitledPlates', 'popupSides', 'orderSensitive', 'unpaintedFrame', 'emptyCollapse', 'maskClearMisses']) expect(sum(k), k).toBeGreaterThan(0);
    expect(sum('pixelsForward')).toBeGreaterThan(1e6);
    expect(Object.entries(totals).filter(([, t]) => t.pixelsReverse > 0).map(([slug]) => slug).sort()).toEqual(['animals', 'monkey-paradise']);
    for (const b of result.bitten) {
      expect(b.clean, `${b.mutation} ${b.slug}/${b.key}: unmutated`).toBe(0);
      expect(b.failures, `${b.mutation} ${b.slug}/${b.key}: must fail`).toBeGreaterThan(0);
    }
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
