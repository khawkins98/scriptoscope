import { test, expect, openHarness, attachCase } from './fixtures.mjs';

for (const mode of ['source', 'built']) test(`${mode}: solid button faces use square corners, independent bands and inset-union body`, async ({ page, servers }, testInfo) => {
  await openHarness(page, servers, mode);
  let rows;
  try {
    rows = await page.evaluate(async mode => {
      const api = await import(mode === 'built' ? '/dist/scriptoscope.js' : '/src/index.ts');
      const rows = [], background = [27, 53, 79, 255];
      for (const [size, corner, side] of [[9, 4, 1], [21, 7, 14]]) for (const tile of [false, true]) {
        const source = api.PixelBuffer.alloc(size, size);
        for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) source.setPixel(x, y, x * 9, y * 9, 123, 255);
        source.setPixel(size - 1, size - 1, ...background);
        // A hole in an edge can reveal the earlier body or earlier edge. A hole
        // outside both body rectangles must remain transparent.
        if (size === 21) for (const [x, y] of [[8, 8], [8, 7], [10, 12], [10, 7], [7, 12]]) source.setPixel(x, y, 0, 0, 0, 0);
        const canvas = api.bufferToCanvas(source); document.body.append(canvas);
        const element = id => ({ sourceCicnId: id, asset: canvas.toDataURL(), width: size, height: size,
          slice: { corner, side, tile }, bgAnchor: [size - 1, size - 1] });
        for (const family of ['push', 'bevel']) for (const state of ['normal', 'pressed', 'disabled']) {
          const ids = family === 'push' ? [-10239, -10238, -10240] : [-10166, -10165, -10167];
          const theme = { baseUrl: location.origin, manifest: { chromeElements: Object.fromEntries(ids.map(id => [String(id), element(id)])) } };
          const opts = { label: '', minWidth: 53, height: 40, pressed: state === 'pressed', disabled: state === 'disabled' };
          const output = await api[family === 'push' ? 'composeButton' : 'composeBevelButton'](theme, opts);
          document.body.append(api.bufferToCanvas(output));
          const probes = size === 9 ? [
            // 0x10c18: corners are square4x4, not4x1 rectangular insets.
            { at: [2, 2], source: [2, 2] },
            { at: [51, 2], source: [7, 2] },
            { at: [2, 38], source: [2, 7] },
            // 0x10b72..10bb8: the transposed rectangle fills x1..4 at y>=4.
            { at: [2, 6], color: background },
            { at: [6, 2], color: background },
            { at: [26, 20], color: background },
          ] : [
            { at: [2, 2], source: [2, 2] },
            // c7/s14 on21px source: top middle starts x7, left middle y7.
            { at: [10, 2], source: [tile ? 10 : 7, 2] },
            { at: [2, 17], source: [2, tile ? 10 : 7] },
            // LEFT is later than BOTTOM (0x10e92 then10f0a), and RIGHT last.
            { at: [9, 30], source: [9, tile ? 9 : 7] },
            { at: [45, 30], source: [13, tile ? 9 : 7] },
            // This edge hole is inside the first body rectangle.
            { at: [8, 15], color: background },
            // Both edge samples are holes, outside the body union.
            { at: [10, 12], color: [0, 0, 0, 0] },
            { at: [26, 20], color: background },
          ];
          rows.push({ size, corner, side, tile, family, state, width: output.width, height: output.height,
            probes: probes.map(probe => ({ ...probe, expected: probe.color ?? [...source.getPixel(...probe.source)], actual: [...output.getPixel(...probe.at)] })) });
        }
      }
      return rows;
    }, mode);
    expect(rows).toHaveLength(24);
    for (const row of rows) {
      expect([row.width, row.height]).toEqual([53, 40]);
      for (const probe of row.probes) expect(probe.actual, `${JSON.stringify(row)} at ${probe.at}`).toEqual(probe.expected);
    }
  } catch (error) { await attachCase(page, testInfo, { mode, oracle: 'solid-face-independent-bands', rows }, error); throw error; }
});

for (const mode of ['source', 'built']) test(`${mode}: corpus faces retain authored corners across state and height`, async ({ page, servers }, testInfo) => {
  testInfo.annotations.push({ type: 'fidelity-assertion', description: 'face.corpus-square-corners' });
  await openHarness(page, servers, mode);
  let rows;
  try {
    rows = await page.evaluate(async mode => {
      const api = await import(mode === 'built' ? '/dist/scriptoscope.js' : '/src/index.ts');
      const rows = [];
      // Reviewed resource expectations, not a second copy of the resolver:
      // kDEF 0x7576/0x7582/0x758e selects disabled/pressed/normal IDs.
      // The normal Animals/Monkey label does not change that numeric branch.
      for (const slug of ['animals', 'monkey-paradise', 'apple-lisa']) {
        const theme = await api.loadTheme(`/themes/${slug}`, { source: 'scheme.sit' });
        try {
          for (const state of ['normal', 'pressed', 'disabled']) {
            const id = state === 'disabled' ? -10240 : state === 'pressed' ? -10238 : -10239;
            const element = Object.values(theme.manifest.chromeElements).find(el => el.sourceCicnId === id);
            if (!element?.slice) throw new Error(`${slug}/${id}: expected reviewed cinf face`);
            const patternedNormal = state === 'normal' && slug !== 'apple-lisa';
            if (patternedNormal) {
              if (element.bodyRequest?.mode !== 2 || element.bodyRequest.resourceId !== (slug === 'animals' ? -12239 : 128)
                || !element.bgPattern || element.slice.corner !== 2 || element.slice.side !== 2 || !element.slice.tile)
                throw new Error(`${slug}/${id}: expected canonical mode2 c2/s2 pattern face`);
            } else if (element.bgPattern) throw new Error(`${slug}/${id}: expected reviewed solid cinf face`);
            const art = await api.loadCicnBuffer(api.assetUrl(theme, element.asset));
            const c = element.slice.corner;
            for (const height of [undefined, 12, 20, 32]) {
              const output = await api.composeButton(theme, { label: '', minWidth: 80, height,
                pressed: state === 'pressed', disabled: state === 'disabled' });
              const faceHeight = height ?? art.height;
              // These three schemes own a default ring, and the public button
              // reserves the independently verified four-pixel ring footprint.
              const offset = 4, width = 80;
              let compared = 0, mismatched = 0;
              for (let y = 0; y < c; y++) for (let x = 0; x < c; x++) {
                for (const [sx, sy, dx, dy] of [[x, y, x, y], [art.width-c+x, y, width-c+x, y],
                  [x, art.height-c+y, x, faceHeight-c+y], [art.width-c+x, art.height-c+y, width-c+x, faceHeight-c+y]]) {
                  const expected = [...art.getPixel(sx, sy)], actual = [...output.getPixel(dx+offset, dy+offset)];
                  // The two patterned normal faces have opaque corners; their
                  // body pattern does not supply this corner-only expectation.
                  if (patternedNormal && expected[3] !== 255) throw new Error('Patterned normal corner must be opaque');
                  // Transparent decoded pixels may carry irrelevant hidden RGB;
                  // alpha and every opaque color sample are the contract.
                  compared++;
                  if (actual[3] !== expected[3] || expected[3] && actual.some((v, i) => v !== expected[i])) mismatched++;
                }
              }
              rows.push({ slug, state, id, requestedHeight: height ?? 'auto', size: [output.width, output.height],
                expectedSize: [width+8, faceHeight+8], compared, mismatched });
            }
          }
        } finally { theme.dispose?.(); }
      }
      return rows;
    }, mode);
    expect(rows).toHaveLength(36);
    for (const row of rows) {
      expect(row.size, JSON.stringify(row)).toEqual(row.expectedSize);
      expect(row.compared).toBeGreaterThan(0);
      expect(row.mismatched, `all four source corner blocks survive: ${JSON.stringify(row)}`).toBe(0);
    }
  } catch (error) { await attachCase(page, testInfo, { mode, oracle: 'corpus-corners', rows }, error); throw error; }
});
