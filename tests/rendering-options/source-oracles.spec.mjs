import { test, expect, openHarness, attachCase } from './fixtures.mjs';

for (const mode of ['source', 'built']) {
  test(`${mode}: Windows95 empty faces use the authored background sample`, async ({ page, servers }, testInfo) => {
    await openHarness(page, servers, mode);
    let results;
    try {
      results = await page.evaluate(async mode => {
        const api = await import(mode === 'built' ? '/dist/scriptoscope.js' : '/src/index.ts');
        const theme = await api.loadTheme('/themes/windows-95', { source: 'scheme.sit' });
        try {
          const rows = [];
          for (const disabled of [false, true]) {
            const id = disabled ? -10240 : -10239;
            const source = Object.values(theme.manifest.chromeElements).find(el => el.sourceCicnId === id);
            if (!source?.bgAnchor) throw new Error(`Missing authored background anchor for ${id}`);
            const art = await api.loadCicnBuffer(api.assetUrl(theme, source.asset));
            const output = await api.composeButton(theme, { label: '', height: 20, disabled });
            const expected = [...art.getPixel(...source.bgAnchor)];
            const actual = [...output.getPixel(Math.floor(output.width / 2), Math.floor(output.height / 2))];
            for (const [name, buffer] of [['source', art], ['output', output]]) {
              const canvas = document.createElement('canvas'); canvas.width = buffer.width; canvas.height = buffer.height;
              canvas.getContext('2d').putImageData(buffer.toImageData(), 0, 0); canvas.dataset.oracle = `${id}-${name}`; document.body.append(canvas);
            }
            rows.push({ id, anchor: source.bgAnchor, expected, actual });
          }
          return rows;
        } finally { theme.dispose?.(); }
      }, mode);
      for (const row of results) {
        // This oracle comes from the source cinf sample (kDEF background RGB),
        // not a current-renderer snapshot or the renderer's sampling helper.
        expect(row.expected[3], `${row.id} authored sample is opaque`).toBe(255);
        expect(row.actual, `${row.id} interior matches source at ${row.anchor}`).toEqual(row.expected);
      }
    } catch (error) { await attachCase(page, testInfo, { mode, oracle: 'windows95-background', results }, error); throw error; }
  });

  test(`${mode}: asymmetric slice sentinels survive resizing and default rings reserve geometry`, async ({ page, servers }, testInfo) => {
    await openHarness(page, servers, mode);
    let results;
    try {
      results = await page.evaluate(async mode => {
        const api = await import(mode === 'built' ? '/dist/scriptoscope.js' : '/src/index.ts');
        const cornerColors = [[230, 10, 20, 255], [20, 220, 30, 255], [30, 40, 230, 255], [220, 40, 210, 255]];
        const makeArt = (size, ring = false) => {
          const canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
          const ctx = canvas.getContext('2d'); ctx.fillStyle = ring ? '#786432' : '#cacaca';
          const rim = ring ? 1 : 0; ctx.fillRect(rim, rim, size - rim * 2, size - rim * 2);
          for (let i = 0; i < 4; i++) {
            ctx.fillStyle = `rgb(${cornerColors[i].slice(0, 3).join(',')})`;
            ctx.fillRect(i % 2 ? size - 1 - rim : rim, i >= 2 ? size - 1 - rim : rim, 1, 1);
          }
          if (!ring) for (let i = 0; i < 4; i++) {
            ctx.fillStyle = `rgb(${cornerColors[i].slice(0, 3).join(',')})`; ctx.fillRect(i + 1, 0, 1, 1);
          }
          document.body.append(canvas); return canvas.toDataURL();
        };
        const face = makeArt(6), ring = makeArt(10, true);
        const ce = (id, asset, size) => ({ sourceCicnId: id, asset, width: size, height: size,
          slice: { corner: size === 10 ? 2 : 1, side: size === 10 ? 2 : 1, tile: true }, bgAnchor: [3, 3], textAnchor: [3, 3] });
        const theme = { baseUrl: location.origin, manifest: { chromeElements: {
          face: ce(-10239, face, 6), ring: ce(-10231, ring, 10),
        } } };
        const rows = [];
        for (const height of [5, 6, 20, 21]) for (const isDefault of [false, true]) {
          const output = await api.composeButton(theme, { label: '', height, default: isDefault });
          const canvas = document.createElement('canvas'); canvas.width = output.width; canvas.height = output.height;
          canvas.getContext('2d').putImageData(output.toImageData(), 0, 0); document.body.append(canvas);
          const inset = 4; // kDEF0x7698..76a2 expands the control rectangle4px
          const at = (x, y) => [...output.getPixel(x, y)];
          rows.push({ height, isDefault, width: output.width, actualHeight: output.height,
            corners: [at(inset, inset), at(output.width-inset-1, inset), at(inset, output.height-inset-1), at(output.width-inset-1, output.height-inset-1)],
            topEdge: Array.from({ length: 10 }, (_, i) => at(inset + 1 + i, inset)),
            ringCorners: [at(1, 1), at(output.width-2, 1), at(1, output.height-2), at(output.width-2, output.height-2)],
            outerCorners: [at(0, 0), at(output.width-1, 0), at(0, output.height-1), at(output.width-1, output.height-1)] });
        }
        return { rows, cornerColors };
      }, mode);
      for (const row of results.rows) {
        expect(row.width).toBe(64); // public minimum56 plus documented4px ring rect expansion
        expect(row.actualHeight).toBe(row.height + 8);
        expect(row.corners, 'face corner source pixels survive slicing').toEqual(results.cornerColors);
        expect(row.topEdge, 'tiled edge repeats the authored interior strip without stretching').toEqual(Array.from({ length: 10 }, (_, i) => results.cornerColors[i % 4]));
        expect(row.ringCorners).toEqual(row.isDefault ? results.cornerColors : Array(4).fill([0, 0, 0, 0]));
        expect(row.outerCorners, 'authored transparent ring rim must not be cropped').toEqual(Array(4).fill([0, 0, 0, 0]));
      }
    } catch (error) { await attachCase(page, testInfo, { mode, oracle: 'slice-sentinels', results }, error); throw error; }
  });
}
