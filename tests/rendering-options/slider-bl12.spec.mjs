import { test, expect, openHarness, attachCase } from './fixtures.mjs';

// slider.md BL12 test hook (§7): synthetic track cicns drawn by BL4 (a one-column middle, cinf byte 2 = 0, SL4),
// each colour entry a distinct colour (entry 0 black, 1 red, 2 green; 0/255 endpoints need no display fitting).
//   (a) entry values (0, 2, 2), every pixel value 2: BL8 tries the entry AT index 2 first, whose value is 2 -> entry 2
//       (green). A first-match / by-value lookup gives entry 1 (red).
//   (b) entry values (1, 2, 0), every pixel value 1: the last entry has value 0, so BL8 indexes by position -> entry 1
//       (red). A by-value lookup gives entry 0 (black).
// Line colours must follow BL8 (or the engine must trace the shortcut; the public API exposes no trace, so this
// binding checks the colour). The fork adds a gate/corner cinf at -10132 (G1 via variation bit 3) with a same-id cicn.
// The loader's own decoded colour for the same cicn is recorded to show each case discriminates the two rules.
const CASES = { a: { values: [0, 2, 2], pixel: 2, bl8: [0, 255, 0, 255], byValue: [255, 0, 0, 255] },
  b: { values: [1, 2, 0], pixel: 1, bl8: [255, 0, 0, 255], byValue: [0, 0, 0, 255] } };
for (const mode of ['source', 'built']) test(`${mode}: BL12 one-column track lines take the BL8 colour-table entry`, async ({ page, servers }, info) => {
  await openHarness(page, servers, mode);
  let rows;
  try {
    rows = await page.evaluate(async ({ mode, cases }) => {
      const api = await import(mode === 'source' ? '/src/index.ts' : '/dist/scriptoscope.js');
      const { forkOf } = await import('/tests/resource-provenance/fixtures.mjs');
      const colours = [[0, 0, 0], [255, 0, 0], [0, 255, 0]];
      // Indexed8 cicn, 7 x 3, complete mask, NIL bitmap (layout as tests/decoder-fixtures/slider-groove.mjs).
      const icon = (values, pixel) => {
        const width = 7, height = 3, n = values.length, table = 82 + height;
        const bytes = new Uint8Array(table + 8 + 8 * n + width * height), v = new DataView(bytes.buffer), word = (p, x) => v.setUint16(p, x);
        word(4, 0x8000 | width); word(10, height); word(12, width); word(32, 8); word(34, 1); word(36, 8);
        word(54, 1); word(60, height); word(62, width); bytes.fill(255, 82, table);
        word(table + 6, n - 1);
        values.forEach((value, i) => { word(table + 8 + i * 8, value); colours[i].forEach((c, j) => word(table + 10 + i * 8 + j * 2, c * 257)); });
        bytes.fill(pixel, table + 8 + 8 * n);
        return bytes;
      };
      const cinf = (...head) => new Uint8Array([...head, ...Array(18 - head.length).fill(0)]);
      const out = {};
      for (const [name, c] of Object.entries(cases)) {
        const art = icon(c.values, c.pixel);
        const theme = await api.loadKaleidoscopeScheme(forkOf([
          { type: 'cicn', id: -10132, data: art }, { type: 'cinf', id: -10132, data: cinf(1, 1, 0, 0) },
          { type: 'cicn', id: -10131, data: art }, { type: 'cinf', id: -10131, data: cinf(1, 1, 0, 0) },
        ]));
        try {
          const el = Object.values(theme.manifest.chromeElements).find(e => e.sourceCicnId === -10131);
          const decoded = [...(await api.loadCicnBuffer(api.assetUrl(theme, el.asset))).getPixel(3, 1)];
          const b = await api.composeSlider(theme, { length: 32, value: 0.5 });
          // Track 3 rows centred in the 16-px band (SL1: rows 6..8); middle [1, 31) drawn as lines (SL3/SL4/BL4).
          const middle = [];
          for (let y = 6; y < 9; y++) for (let x = 1; x < 31; x++) middle.push(JSON.stringify([...b.getPixel(x, y)]));
          out[name] = { decoded, middle: [...new Set(middle)].map(s => JSON.parse(s)) };
        } finally { theme.dispose(); }
      }
      return out;
    }, { mode, cases: CASES });
    for (const [name, c] of Object.entries(CASES)) {
      expect(rows[name].decoded, `${name}: the loader resolves by value (so the case discriminates)`).toEqual(c.byValue);
      expect(rows[name].middle, `${name}: BL4 lines in the BL8 entry colour`).toEqual([c.bl8]);
    }
  } catch (error) { await attachCase(page, info, { mode, rows }, error); throw error; }
});
