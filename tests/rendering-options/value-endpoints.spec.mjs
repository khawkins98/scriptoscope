import { test, expect, openHarness, attachCase } from './fixtures.mjs';

for (const mode of ['source', 'built']) test(`${mode}: value endpoints clamp without changing track geometry`, async ({ page, servers }, testInfo) => {
  await openHarness(page, servers, mode);
  let rows;
  try {
    rows = await page.evaluate(async mode => {
      const api = await import(mode === 'built' ? '/dist/scriptoscope.js' : '/src/index.ts');
      const catalog = await (await fetch('/demo/themes-manifest.json')).json(), rows = [];
      const hash = async buffer => buffer ? [...new Uint8Array(await crypto.subtle.digest('SHA-256', buffer.data))].map(n => n.toString(16).padStart(2, '0')).join('') : null;
      for (const { slug, source } of catalog) {
        const theme = await api.loadTheme(`/themes/${slug}`, { source });
        try {
          for (const family of ['composeSlider', 'composeScrollbar', 'composeProgress']) {
            for (const orientation of family === 'composeProgress' ? ['horizontal'] : ['horizontal', 'vertical']) {
              const states = [];
              for (const value of [-1, 0, 0.5, 1, 2]) {
                const output = await api[family](theme, { length: 120, orientation, value });
                states.push(output ? { width: output.width, height: output.height, sha256: await hash(output) } : null);
              }
              rows.push({ slug, family, orientation, states });
            }
          }
        } finally { theme.dispose?.(); }
      }
      return rows;
    }, mode);
    for (const row of rows) {
      expect(row.states[0], `${row.slug}/${row.family}: lower values clamp to zero`).toEqual(row.states[1]);
      expect(row.states[4], `${row.slug}/${row.family}: higher values clamp to one`).toEqual(row.states[3]);
      const present = row.states.filter(Boolean);
      if (!present.length) continue; // explicitly absent themed art is caller fallback
      expect(present).toHaveLength(5);
      for (const state of present) {
        expect([state.width, state.height], `${row.slug}/${row.family}: changing value keeps the track footprint`).toEqual([present[0].width, present[0].height]);
        expect(row.orientation === 'vertical' ? state.height : state.width).toBe(120);
      }
      // The Windows95 source supplies these tracks/thumbs/fills. Equal endpoint
      // output here would silently ignore the value despite a stable rectangle.
      if (row.slug === 'windows-95') expect(present[1].sha256, `${row.family}: distinct supplied-art endpoints`).not.toBe(present[3].sha256);
    }
  } catch (error) { await attachCase(page, testInfo, { mode, oracle: 'normalized-value-endpoints', rows }, error); throw error; }
});
