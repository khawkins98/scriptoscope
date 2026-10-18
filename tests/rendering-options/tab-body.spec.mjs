import { readFileSync } from 'node:fs';
import { test, expect, openHarness, attachCase, attachObservations } from './fixtures.mjs';
const pins = JSON.parse(readFileSync(new URL('../decoder-fixtures/tab-body-source-pins.json', import.meta.url)));

// Literal input/output rows, not a copy of the runtime strip assembler. M is a
// semantic sample marker: it repeats only when the declared full band tiles.
const overlapping = ['.LLAMBRR.', '.LLCMDRR.', '.LL.MERR.', '.LLFMGRR.', '.LLHMIRR.', '.LLJMKRR.'];
const firstColumn = ['.LLAAAAAARR.', '.LLCCCCCCRR.', '.LL......RR.', '.LLFFFFFFRR.', '.LLHHHHHHRR.', '.LLJJJJJJRR.'];
const repeatedBand = ['.LLAMBAMBRR.', '.LLCMDCMDRR.', '.LL.ME.MERR.', '.LLFMGFMGRR.', '.LLHMIHMIRR.', '.LLJMKJMKRR.'];
const positiveCenter = ['.LAMBR.', '.LMMMR.', '.LMMMR.', '.LMMMR.', '.LMGMR.', '.LMMMR.', '.LMMMR.', '.LMMMR.', '.LZMNR.'];
const filledCenter = ['.LAAAAAAR.', '.LGGGGGGR.', '.LGGGGGGR.', '.LGGGGGGR.', '.LGGGGGGR.', '.LGGGGGGR.', '.LGGGGGGR.', '.LGGGGGGR.', '.LZZZZZZR.'];

for (const mode of ['source', 'built']) test(`${mode}: tab body uses full-height ends, first-column or tiled bands and separate center`, async ({ page, servers }, info) => {
  await openHarness(page, servers, mode);
  let rows;
  try {
    rows = await page.evaluate(async ({ mode, overlapping, positiveCenter }) => {
      const api = await import(mode === 'built' ? '/dist/scriptoscope.js' : '/src/index.ts');
      const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      const colors = Object.fromEntries([...alphabet].map((c, i) => [c, [i * 8 + 1, 200 - i * 4, 97, 255]]));
      const rows = [];
      for (const kind of ['overlap-first', 'overlap-tile', 'center']) {
        const input = kind === 'center' ? positiveCenter : overlapping;
        const art = api.PixelBuffer.alloc(input[0].length, input.length);
        for (let y = 0; y < input.length; y++) for (let x = 0; x < input[y].length; x++) if (input[y][x] !== '.') art.setPixel(x, y, ...colors[input[y][x]]);
        const canvas = api.bufferToCanvas(art); document.body.append(canvas);
        const element = { sourceCicnId: -9975, sourceCinfId: -9975, asset: canvas.toDataURL(), width: art.width, height: art.height,
          slice: { corner: kind === 'center' ? 2 : 3, side: kind === 'center' ? 1 : 4, tile: kind === 'overlap-tile' },
          bodyRequest: { mode: 0, resourceId: 0 }, bgAnchor: kind === 'center' ? [3, 4] : [3, 0] };
        // Metadata and pixels must travel with the selected owner, not the child.
        const owner = { baseUrl: location.origin, manifest: { chromeElements: { rear: element } } };
        const child = { baseUrl: location.origin, base: owner, manifest: { chromeElements: {} } };
        const output = await api.composeTab(child, { label: '', selected: false });
        document.body.append(api.bufferToCanvas(output));
        const pixels = Array.from({ length: output.height }, (_, y) => Array.from({ length: output.width }, (_, x) => {
          const p = [...output.getPixel(x, y)]; if (!p[3]) return '.';
          return Object.keys(colors).find(c => colors[c].every((v, i) => v === p[i])) ?? '?';
        }).join(''));
        rows.push({ kind, size: [output.width, output.height], pixels });
      }
      return rows;
    }, { mode, overlapping, positiveCenter });
    expect(rows.map(r => r.kind)).toEqual(['overlap-first', 'overlap-tile', 'center']);
    for (const row of rows) {
      expect(row.size).toEqual(row.kind === 'center' ? [10, 9] : [12, 6]);
      expect(row.pixels, row.kind).toEqual(row.kind === 'center' ? filledCenter : row.kind === 'overlap-tile' ? repeatedBand : firstColumn);
    }
    await attachObservations(info, 'tab-body', `${mode}-literal`, { mode, rows, limits: 'Literal source-model body rows only; no original device, font, transfer or selection claim.' });
  } catch (error) { await attachCase(page, info, { mode, rows, overlapping, firstColumn, repeatedBand, filledCenter }, error); throw error; }
});

for (const mode of ['source', 'built']) test(`${mode}: pinned 1138 and 1990 rear tabs retain full source strips without repeating semantic marker column`, async ({ page, servers }, info) => {
  await openHarness(page, servers, mode);
  let rows;
  try {
    rows = await page.evaluate(async ({ mode, pins }) => {
      const api = await import(mode === 'built' ? '/dist/scriptoscope.js' : '/src/index.ts');
      const rows = [];
      for (const pin of pins.cases) {
        const owner = await api.loadTheme(`/themes/${pin.slug}`, { provenance: true });
        try {
          const entry = Object.values(owner.manifest.chromeElements).find(e => e.sourceCicnId === -9975);
          const source = await api.loadCicnBuffer(api.assetUrl(owner, entry.asset));
          const output = await api.composeTab(owner, { label: '', selected: false });
          const c = pin.resources.find(r => r.type === 'cinf').corner;
          const columns = [];
          for (let y = 0; y < 16; y++) for (let x = c; x < output.width - c; x++) columns.push({ at: [x, y], actual: [...output.getPixel(x, y)], expected: [...source.getPixel(c, y)] });
          const sides = [];
          for (let y = 0; y < 16; y++) for (let x = 0; x < c; x++) for (const [sx, dx] of [[x, x], [source.width - c + x, output.width - c + x]]) sides.push({ actual: [...output.getPixel(dx, y)], expected: [...source.getPixel(sx, y)] });
          rows.push({ slug: pin.slug, size: [output.width, output.height], sourceSize: [source.width, source.height], slice: entry.slice,
            load: owner.byteProvenance, selected: entry.byteProvenance, columns, sides });
        } finally { owner.dispose(); }
      }
      return rows;
    }, { mode, pins });
    expect(rows.map(r => r.slug)).toEqual(['1138', '1990']);
    for (const row of rows) {
      const pin = pins.cases.find(p => p.slug === row.slug), icon = pin.resources.find(r => r.type === 'cicn'), cinf = pin.resources.find(r => r.type === 'cinf');
      expect(row.load.input.sha256).toBe(pin.archiveSha256);
      expect(row.sourceSize).toEqual([icon.bounds[3], icon.bounds[2]]);
      expect(row.size).toEqual([row.slug === '1138' ? 26 : 34, 16]);
      expect(row.slice).toMatchObject({ corner: cinf.corner, side: cinf.side, tile: false });
      for (const [type, field] of [['cicn', 'cicnResourceIndex'], ['cinf', 'cinfResourceIndex']]) {
        const actual = row.load.resources.find(r => r.resourceIndex === row.selected[field]);
        expect(actual).toMatchObject({ type, signedId: -9975, sha256: pin.resources.find(r => r.type === type).sha256 });
      }
      for (const pixel of [...row.columns, ...row.sides]) {
        expect(pixel.actual[3]).toBe(pixel.expected[3]);
        if (pixel.expected[3]) expect(pixel.actual).toEqual(pixel.expected);
      }
    }
    await attachObservations(info, 'tab-body', `${mode}-corpus`, { mode, pins, rows, limits: 'Exact empty-label decoded source strip retention; original full-control layout and typography remain unknown.' });
  } catch (error) { await attachCase(page, info, { mode, pins, rows }, error); throw error; }
});
