import { test, expect, openHarness, attachCase } from './fixtures.mjs';

// Authored thumb-cell retention on the v2 slider engine (docs/spec/engine/slider.md):
// - Windows95 (a G1 archive): the thumb cell is drawn 1:1 into Th, masked (TH3, TH4, BL1), at
//   Th.start = c + trunc(T · offset / range) horizontally and c + trunc(T · (range − offset) / range)
//   vertically (§5.2), with c = 2 (cinf −10132 / −10116 byte 0) and tA = 11, so T = 64 − 11 − 4 = 49.
//   Cells: 0 inactive/disabled, 1 normal, 2 pressed (TH3 cell map). R is length × 16 (cross 16, §5.1 group 2).
// - The two engineered manifests ship slider cicns but no slider cinf, so the gate hands the control off to the
//   System slider (G1/G2, §4.1; #407 S1): composeSlider returns null and callers draw the Platinum substitute.
for (const mode of ['source', 'built']) test(`${mode}: sliders retain complete authored thumb cells, or hand off without a slider cinf`, async ({ page, servers }, testInfo) => {
  testInfo.annotations.push({ type: 'fidelity-assertion', description: 'slider.decoded-opaque-retention' });
  await openHarness(page, servers, mode);
  let rows;
  try {
    rows = await page.evaluate(async mode => {
      const api = await import(mode === 'built' ? '/dist/scriptoscope.js' : '/src/index.ts');
      const rows = [], length = 64, handoffs = [];
      const canvas = buffer => {
        const node = api.bufferToCanvas(buffer); document.body.append(node); return node.toDataURL();
      };
      for (const [trackCross, thumbCross] of [[4, 9], [11, 6]]) for (const orientation of ['horizontal', 'vertical']) {
        const horizontal = orientation === 'horizontal';
        const track = api.PixelBuffer.alloc(horizontal ? 17 : trackCross, horizontal ? trackCross : 17);
        for (let y = 0; y < track.height; y++) for (let x = 0; x < track.width; x++) track.setPixel(x, y, 63, 72, 81, 255);
        const width = horizontal ? 7 : thumbCross, height = horizontal ? thumbCross : 7;
        const sheet = api.PixelBuffer.alloc(horizontal ? width : width * 4, horizontal ? height * 4 : height);
        for (let state = 1; state < 4; state++) for (let y = 0; y < height; y++) for (let x = 0; x < width; x++)
          sheet.setPixel(x + (horizontal ? 0 : state * width), y + (horizontal ? state * height : 0), 20 + x * 13, 40 + y * 11, state * 60, 255);
        const element = (id, buffer) => ({ sourceCicnId: id, asset: canvas(buffer), width: buffer.width, height: buffer.height,
          slice: { corner: 1, side: 1, tile: false } });
        const theme = { baseUrl: location.origin, manifest: { chromeElements: {
          track: element(horizontal ? -10131 : -10115, track), thumb: element(horizontal ? -10129 : -10113, sheet),
        } } };
        for (const state of ['normal', 'pressed', 'disabled', 'inactive']) {
          const output = await api.composeSlider(theme, { orientation, length, value: 0.5, state });
          handoffs.push({ name: `synthetic-${trackCross}-${thumbCross}`, orientation, state, isNull: output === null });
        }
      }
      const theme = await api.loadTheme('/themes/windows-95', { source: 'scheme.sit' });
      try {
        for (const orientation of ['horizontal', 'vertical']) {
          const horizontal = orientation === 'horizontal';
          const element = Object.values(theme.manifest.chromeElements).find(el => el.sourceCicnId === (horizontal ? -10129 : -10113));
          if (!element) throw new Error('Missing authored Windows95 thumb');
          const sheet = await api.loadCicnBuffer(api.assetUrl(theme, element.asset));
          const tA = horizontal ? sheet.width : sheet.height, c = 2, T = length - tA - 2 * c;
          for (const [state, cell] of [['normal', 1], ['pressed', 2], ['disabled', 0], ['inactive', 0]]) for (const value of [0, 0.5, 1]) {
            const output = await api.composeSlider(theme, { orientation, length, value, state });
            canvas(output);
            const offset = Math.round(100 * value), start = c + Math.trunc(T * (horizontal ? offset : 100 - offset) / 100);
            let opaquePixels = 0, missingPixels = 0;
            const examples = [];
            for (let a = 0; a < tA; a++) for (let k = 0; k < 16; k++) {
              const [sx, sy] = horizontal ? [a, 16 * cell + k] : [16 * cell + k, a];
              const expected = [...sheet.getPixel(sx, sy)];
              if (expected[3] !== 255) continue;   // BL1: a mask-clear thumb pixel shows what is below
              opaquePixels++;
              const actual = [...output.getPixel(...(horizontal ? [start + a, k] : [k, start + a]))];
              if (actual.some((n, i) => n !== expected[i])) { missingPixels++; if (examples.length < 4) examples.push({ a, k, expected, actual }); }
            }
            rows.push({ orientation, state, value, start, width: output.width, height: output.height, opaquePixels, missingPixels, examples });
          }
        }
      } finally { theme.dispose?.(); }
      return { rows, handoffs };
    }, mode);
    expect(rows.handoffs).toHaveLength(16);
    for (const h of rows.handoffs) expect(h.isNull, `${h.name}/${h.orientation}/${h.state}: G2 hand-off (no slider cinf)`).toBe(true);
    expect(rows.rows).toHaveLength(24);
    // §5.2 starts at value 0 / 0.5 / 1: horizontal 2, 26, 51; vertical (minimum at the bottom) 51, 26, 2.
    expect(rows.rows.map(r => r.start)).toEqual([...Array(4).fill([2, 26, 51]).flat(), ...Array(4).fill([51, 26, 2]).flat()]);
    for (const row of rows.rows) {
      expect([row.width, row.height], `${row.orientation} R`).toEqual(row.orientation === 'horizontal' ? [64, 16] : [16, 64]);
      expect(row.opaquePixels, 'source state cell contains authored pixels').toBeGreaterThan(0);
      expect(row.missingPixels, `${JSON.stringify(row)}: every opaque source pixel lands 1:1 in Th`).toBe(0);
    }
  } catch (error) { await attachCase(page, testInfo, { mode, oracle: 'complete-slider-thumb-cells', rows }, error); throw error; }
});
