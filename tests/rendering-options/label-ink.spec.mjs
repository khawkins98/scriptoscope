import { test, expect, openHarness, attachCase } from './fixtures.mjs';

for (const mode of ['source', 'built']) test(`${mode}: explicit 20px faces preserve complete centered glyph ink across corpus states`, async ({ page, servers }, testInfo) => {
  await openHarness(page, servers, mode);
  let rows;
  try {
    rows = await page.evaluate(async mode => {
      const api = await import(mode === 'built' ? '/dist/scriptoscope.js' : '/src/index.ts');
      const { labelOracle, inkBounds, foregroundBounds } = await import('/tests/rendering-options/label-oracle.mjs');
      const catalog = await (await fetch('/demo/themes-manifest.json')).json();
      const label = 'AgjpQy', fg = '#f300d9';
      const rows = [];
      for (const { slug, source } of catalog) {
        const theme = await api.loadTheme(`/themes/${slug}`, { source });
        try {
          for (const family of ['composeButton', 'composeBevelButton']) for (const state of [{}, { pressed: true }, { disabled: true }, { default: true }]) {
            if (family === 'composeBevelButton' && state.default) continue;
            // Freeze from public inputs before drawing the output. Ring resource
            // presence reserves four pixels on every side even without default.
            const inset = family === 'composeButton' && [-10232, -10230, -10231].some(id => {
              for (let owner = theme; owner; owner = owner.base)
                if (Object.values(owner.manifest.chromeElements ?? {}).some(e => e.sourceCicnId === id && e.asset)) return true;
              return false;
            }) ? 4 : 0;
            const oracle = labelOracle(family, label, 12, 180 + 2 * inset, 20 + 2 * inset, inset);
            const output = await api[family](theme, { label, fg, height: 20, minWidth: 180, ...state });
            if (!output) { rows.push({ slug, family, state, unavailable: true }); continue; }
            const opaqueInk = oracle.foreground.length, clippedInk = oracle.clippedInk;
            const preservedInk = oracle.foreground.filter(([x, y]) => output.getPixel(x, y).every((value, i) => value === [243, 0, 217, 255][i])).length;
            const row = { slug, family, state, width: output.width, height: output.height, opaqueInk, preservedInk, clippedInk,
              geometry: { expected: inkBounds(oracle.foreground), actual: foregroundBounds(output, [243, 0, 217, 255]) } };
            rows.push(row);
            // Preserve a failing raw sample without retaining hundreds of canvases.
            if (clippedInk || !opaqueInk || preservedInk !== opaqueInk) {
              const heading = document.createElement('h2'); heading.textContent = JSON.stringify(row);
              document.body.append(heading, oracle.canvas, api.bufferToCanvas(output));
            }
          }
        } finally { theme.dispose?.(); }
      }
      return rows;
    }, mode);
    for (const row of rows.filter(r => !r.unavailable)) {
      expect(row.geometry.actual, `${row.slug}/${row.family}: expected family geometry`).toEqual(row.geometry.expected);
      expect(row.opaqueInk, `${row.slug}/${row.family}: meaningful glyph sample`).toBeGreaterThan(20);
      expect(row.clippedInk, `${row.slug}/${row.family}: no input ink clipped`).toBe(0);
      expect(row.preservedInk, `${row.slug}/${row.family}/${JSON.stringify(row.state)}: every opaque glyph pixel preserved`).toBe(row.opaqueInk);
    }
  } catch (error) { await attachCase(page, testInfo, { mode, oracle: 'complete-explicit-label', rows }, error); throw error; }
});
