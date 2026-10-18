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

for (const mode of ['source', 'built']) test(`${mode}: ring state and asymmetric corner/edge rules follow source coordinates`, async ({ page, servers }, testInfo) => {
  await openHarness(page, servers, mode);
  let rows;
  try {
    rows = await page.evaluate(async mode => {
      const api = await import(mode === 'built' ? '/dist/scriptoscope.js' : '/src/index.ts');
      const art = (size, offset = 0) => {
        const buffer = api.PixelBuffer.alloc(size, size);
        for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) buffer.setPixel(x, y, offset + x * 5, y * 7, 91, 255);
        const canvas = api.bufferToCanvas(buffer); document.body.append(canvas);
        return { buffer, asset: canvas.toDataURL() };
      };
      const face = art(6), rows = [];
      const element = (id, source, corner, side, tile = false) => ({ sourceCicnId: id,
        asset: source.asset, width: source.buffer.width, height: source.buffer.height,
        slice: { corner, side, tile }, bgAnchor: [3, 3] });
      for (const [size, corner, side, tile] of [[10, 3, 1, false], [21, 7, 14, true], [21, 7, 14, false], [21, 12, 14, false]]) {
        const ring = art(size);
        const theme = { baseUrl: location.origin, manifest: { chromeElements: {
          face: element(-10239, face, 1, 1), ring: element(-10231, ring, corner, side, tile),
        } } };
        const output = await api.composeButton(theme, { label: '', height: 40, default: true });
        document.body.append(api.bufferToCanvas(output));
        // kDEF square corner keeps source(2,2), independent of side thickness.
        const probes = [{ target: [2, 2], source: [2, 2] }];
        if (size === 21) {
          // The authored middle strip is7px (21−2×7). At y17 the
          // repeat variant samples10; nonrepeat samples the first middle
          // row/column even when 12px source corners overlap in a21px image.
          const sourceY = tile ? 10 : corner;
          probes.push({ target: [17, 0], source: [sourceY, 0] }, { target: [0, 17], source: [0, sourceY] }, { target: [output.width - 1, 17], source: [20, sourceY] });
        }
        rows.push({ kind: 'geometry', size, corner, side, tile, probes: probes.map(probe => ({ ...probe,
          expected: ring.buffer.getPixel(...probe.source), actual: output.getPixel(...probe.target) })) });
      }
      const active = art(10, 10), pressed = art(10, 50), disabled = art(10, 90);
      const theme = { baseUrl: location.origin, manifest: { chromeElements: {
        face: element(-10239, face, 1, 1), active: element(-10231, active, 3, 1),
        pressed: element(-10230, pressed, 3, 1), disabled: element(-10232, disabled, 3, 1),
      } } };
      for (const [state, opts, expectedArt] of [['normal', {}, active], ['pressed', { pressed: true }, pressed], ['disabled', { disabled: true }, disabled]]) {
        const output = await api.composeButton(theme, { label: '', height: 40, default: true, ...opts });
        document.body.append(api.bufferToCanvas(output));
        rows.push({ kind: 'state', state, expected: expectedArt.buffer.getPixel(2, 2), actual: output.getPixel(2, 2) });
      }
      delete theme.manifest.chromeElements.pressed;
      const fallback = await api.composeButton(theme, { label: '', height: 40, default: true, pressed: true });
      document.body.append(api.bufferToCanvas(fallback));
      rows.push({ kind: 'state', state: 'pressed-missing', expected: active.buffer.getPixel(2, 2), actual: fallback.getPixel(2, 2) });
      return rows;
    }, mode);
    for (const row of rows) {
      if (row.kind === 'geometry') for (const probe of row.probes) expect(probe.actual, JSON.stringify({ ...row, probes: probe })).toEqual(probe.expected);
      else expect(row.actual, `default ring state ${row.state}`).toEqual(row.expected);
    }
  } catch (error) { await attachCase(page, testInfo, { mode, oracle: 'ring-state-asymmetric-slices', rows }, error); throw error; }
});
