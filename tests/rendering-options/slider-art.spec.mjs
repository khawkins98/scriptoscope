import { test, expect, openHarness, attachCase } from './fixtures.mjs';

for (const mode of ['source', 'built']) test(`${mode}: sliders retain and center complete authored thumb cells`, async ({ page, servers }, testInfo) => {
  await openHarness(page, servers, mode);
  let rows;
  try {
    rows = await page.evaluate(async mode => {
      const api = await import(mode === 'built' ? '/dist/scriptoscope.js' : '/src/index.ts');
      const rows = [], length = 64;
      const canvas = buffer => {
        const node = api.bufferToCanvas(buffer); document.body.append(node); return node.toDataURL();
      };
      const check = async (theme, name, orientation, track, sheet, trackColor) => {
        const horizontal = orientation === 'horizontal';
        const cellWidth = horizontal ? sheet.width : sheet.width / 4;
        const cellHeight = horizontal ? sheet.height / 4 : sheet.height;
        const cellCross = horizontal ? cellHeight : cellWidth;
        const trackCross = horizontal ? track.height : track.width;
        const cross = Math.max(cellCross, trackCross);
        for (const [state, stateCell] of [['normal', 1], ['pressed', 2], ['disabled', 3], ['inactive', 3]]) for (const value of [0, 0.5, 1]) {
          const output = await api.composeSlider(theme, { orientation, length, value, state });
          if (!output) throw new Error(`${name} ${orientation}: fixture must have groove and thumb art`);
          canvas(output);
          const axisPosition = Math.round(value * (length - (horizontal ? cellWidth : cellHeight)));
          const centeredCross = Math.floor((cross - cellCross) / 2);
          const origin = horizontal ? [axisPosition, centeredCross] : [centeredCross, axisPosition];
          let opaquePixels = 0, missingPixels = 0;
          const examples = [];
          for (let y = 0; y < cellHeight; y++) for (let x = 0; x < cellWidth; x++) {
            const expected = [...sheet.getPixel(x + (horizontal ? 0 : stateCell * cellWidth), y + (horizontal ? stateCell * cellHeight : 0))];
            // Full opaque source-cell retention is independent of unresolved
            // transparent-mask painter behavior; do not invent that contract.
            if (expected[3] !== 255) continue;
            opaquePixels++;
            const actual = [...output.getPixel(origin[0] + x, origin[1] + y)];
            if (actual.some((n, i) => n !== expected[i])) {
              missingPixels++;
              if (examples.length < 4) examples.push({ x, y, expected, actual });
            }
          }
          const grooveCross = Math.floor((cross - trackCross) / 2) + Math.floor(trackCross / 2);
          const freeAxis = value === 0 ? length - 1 : 0;
          const grooveSample = [...output.getPixel(...(horizontal ? [freeAxis, grooveCross] : [grooveCross, freeAxis]))];
          rows.push({ name, orientation, state, value, cellWidth, cellHeight, cross,
            width: output.width, height: output.height, opaquePixels, missingPixels, examples,
            grooveSample, trackColor });
        }
      };
      for (const [trackCross, thumbCross] of [[4, 9], [11, 6]]) for (const orientation of ['horizontal', 'vertical']) {
        const horizontal = orientation === 'horizontal';
        const track = api.PixelBuffer.alloc(horizontal ? 17 : trackCross, horizontal ? trackCross : 17);
        const trackColor = [63, 72, 81, 255];
        for (let y = 0; y < track.height; y++) for (let x = 0; x < track.width; x++) track.setPixel(x, y, ...trackColor);
        const width = horizontal ? 7 : thumbCross, height = horizontal ? thumbCross : 7;
        const sheet = api.PixelBuffer.alloc(horizontal ? width : width * 4, horizontal ? height * 4 : height);
        for (let state = 1; state < 4; state++) for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
          if (x === 2 && y === 2) continue; // deliberately unresolved transparent hole
          sheet.setPixel(x + (horizontal ? 0 : state * width), y + (horizontal ? state * height : 0), 20 + x * 13, 40 + y * 11, state * 60, 255);
        }
        const element = (id, buffer) => ({ sourceCicnId: id, asset: canvas(buffer), width: buffer.width, height: buffer.height,
          slice: { corner: 1, side: 1, tile: false } });
        const theme = { baseUrl: location.origin, manifest: { chromeElements: {
          track: element(horizontal ? -10131 : -10115, track), thumb: element(horizontal ? -10129 : -10113, sheet),
        } } };
        await check(theme, `synthetic-${trackCross}-${thumbCross}`, orientation, track, sheet, trackColor);
      }
      const theme = await api.loadTheme('/themes/windows-95', { source: 'scheme.sit' });
      try {
        for (const orientation of ['horizontal', 'vertical']) {
          const ids = orientation === 'horizontal' ? [-10131, -10129] : [-10115, -10113];
          const sources = await Promise.all(ids.map(async id => {
            const element = Object.values(theme.manifest.chromeElements).find(el => el.sourceCicnId === id);
            if (!element) throw new Error(`Missing authored Windows95 resource ${id}`);
            const buffer = await api.loadCicnBuffer(api.assetUrl(theme, element.asset)); canvas(buffer); return buffer;
          }));
          await check(theme, 'windows-95', orientation, ...sources, null);
        }
      } finally { theme.dispose?.(); }
      return rows;
    }, mode);
    expect(rows).toHaveLength(72);
    for (const row of rows) {
      expect(row.width, `${row.name}/${row.orientation} complete cross-axis`).toBe(row.orientation === 'horizontal' ? 64 : row.cross);
      expect(row.height, `${row.name}/${row.orientation} complete cross-axis`).toBe(row.orientation === 'horizontal' ? row.cross : 64);
      expect(row.opaquePixels, 'source state cell contains authored pixels').toBeGreaterThan(0);
      expect(row.missingPixels, `${JSON.stringify(row)}: every opaque source pixel survives centered placement`).toBe(0);
      if (row.trackColor) expect(row.grooveSample, 'groove stays centered outside the thumb').toEqual(row.trackColor);
    }
  } catch (error) { await attachCase(page, testInfo, { mode, oracle: 'complete-slider-thumb-cells', rows }, error); throw error; }
});
