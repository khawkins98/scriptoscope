import { test, expect, openHarness, attachCase } from './fixtures.mjs';

for (const mode of ['source', 'built']) test(`${mode}: explicit 20px faces preserve complete centered glyph ink across corpus states`, async ({ page, servers }, testInfo) => {
  await openHarness(page, servers, mode);
  let rows;
  try {
    rows = await page.evaluate(async mode => {
      const api = await import(mode === 'built' ? '/dist/scriptoscope.js' : '/src/index.ts');
      const catalog = await (await fetch('/demo/themes-manifest.json')).json();
      const label = 'AgjpQy', fg = '#f300d9';
      // Explicit20 selects12px text by the documented proportional label rule.
      // This is an input mask, never a golden copied from a composed button.
      const mask = api.rasterizeText(label, 12, fg), rows = [];
      for (const { slug, source } of catalog) {
        const theme = await api.loadTheme(`/themes/${slug}`, { source });
        try {
          for (const family of ['composeButton', 'composeBevelButton']) for (const state of [{}, { pressed: true }, { disabled: true }, { default: true }]) {
            if (family === 'composeBevelButton' && state.default) continue;
            const output = await api[family](theme, { label, fg, height: 20, minWidth: 180, ...state });
            if (!output) { rows.push({ slug, family, state, unavailable: true }); continue; }
            const x = Math.round((output.width - mask.width) / 2), y = Math.round((output.height - mask.height) / 2);
            let opaqueInk = 0, preservedInk = 0, clippedInk = 0;
            for (let gy = 0; gy < mask.height; gy++) for (let gx = 0; gx < mask.width; gx++) {
              const source = mask.getPixel(gx, gy);
              if (source[3] > 0 && (x + gx < 0 || x + gx >= output.width || y + gy < 0 || y + gy >= output.height)) clippedInk++;
              if (source[3] !== 255) continue;
              opaqueInk++;
              if (output.getPixel(x + gx, y + gy).every((value, i) => value === source[i])) preservedInk++;
            }
            const row = { slug, family, state, width: output.width, height: output.height, opaqueInk, preservedInk, clippedInk };
            rows.push(row);
            // Preserve a failing raw sample without retaining hundreds of canvases.
            if (clippedInk || !opaqueInk || preservedInk !== opaqueInk) {
              const heading = document.createElement('h2'); heading.textContent = JSON.stringify(row);
              document.body.append(heading, api.bufferToCanvas(mask), api.bufferToCanvas(output));
            }
          }
        } finally { theme.dispose?.(); }
      }
      return rows;
    }, mode);
    for (const row of rows.filter(r => !r.unavailable)) {
      expect(row.opaqueInk, `${row.slug}/${row.family}: meaningful glyph sample`).toBeGreaterThan(20);
      expect(row.clippedInk, `${row.slug}/${row.family}: no input ink clipped`).toBe(0);
      expect(row.preservedInk, `${row.slug}/${row.family}/${JSON.stringify(row.state)}: every opaque glyph pixel preserved`).toBe(row.opaqueInk);
    }
  } catch (error) { await attachCase(page, testInfo, { mode, oracle: 'complete-explicit-label', rows }, error); throw error; }
});
