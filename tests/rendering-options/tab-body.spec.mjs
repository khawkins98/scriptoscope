import { readFileSync } from 'node:fs';
import { test, expect, openHarness, attachCase, attachObservations } from './fixtures.mjs';
const pins = JSON.parse(readFileSync(new URL('../decoder-fixtures/tab-body-source-pins.json', import.meta.url)));

// Literal input/output rows, not a copy of the runtime strip assembler. M is a
// semantic sample marker: it repeats only when the declared full band tiles.
const overlapping = ['.LLAMBRR.', '.LLCMDRR.', '.LL.MERR.', '.LLFMGRR.', '.LLHMIRR.', '.LLJMKRR.'];
const firstColumn = ['.LLAAAAAARR.', '.LLCCCCCCRR.', '.LL......RR.', '.LLFFFFFFRR.', '.LLHHHHHHRR.', '.LLJJJJJJRR.'];
const repeatedBand = ['.LLAMBAMBRR.', '.LLCMDCMDRR.', '.LL.ME.MERR.', '.LLFMGFMGRR.', '.LLHMIHMIRR.', '.LLJMKJMKRR.'];
const partialInput = ['.LLAMBCRR.', '.LLDMEFRR.', '.LL.MGHRR.', '.LLIMJKRR.', '.LLLMNORR.', '.LLPMQRRR.'];
const partialOutput = ['.LLAMBCAMRR.', '.LLDMEFDMRR.', '.LL.MGH.MRR.', '.LLIMJKIMRR.', '.LLLMNOLMRR.', '.LLPMQRPMRR.'];
const positiveCenter = ['.LAMBR.', '.LMMMR.', '.LMMMR.', '.LMMMR.', '.LMGMR.', '.LMMMR.', '.LMMMR.', '.LMMMR.', '.LZMNR.'];
const filledCenter = ['.LAAAAAAR.', '.LGGGGGGR.', '.LGGGGGGR.', '.LGGGGGGR.', '.LGGGGGGR.', '.LGGGGGGR.', '.LGGGGGGR.', '.LGGGGGGR.', '.LZZZZZZR.'];

for (const mode of ['source', 'built']) test(`${mode}: tab body uses full-height ends, first-column or tiled bands and separate center`, async ({ page, servers }, info) => {
  await openHarness(page, servers, mode);
  let rows;
  try {
    rows = await page.evaluate(async ({ mode, overlapping, positiveCenter, partialInput }) => {
      const api = await import(mode === 'built' ? '/dist/scriptoscope.js' : '/src/index.ts');
      const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      const colors = Object.fromEntries([...alphabet].map((c, i) => [c, [i * 8 + 1, 200 - i * 4, 97, 255]]));
      colors.G = [48, 152, 48, 255];
      const rows = [];
      for (const kind of ['overlap-first', 'overlap-tile', 'partial-tile', 'center', 'masked-background', 'pattern-center', 'unknown-request']) {
        const isCenter = ['center', 'masked-background', 'pattern-center', 'unknown-request'].includes(kind);
        const input = isCenter ? positiveCenter : kind === 'partial-tile' ? partialInput : overlapping;
        const art = api.PixelBuffer.alloc(input[0].length, input.length);
        for (let y = 0; y < input.length; y++) for (let x = 0; x < input[y].length; x++) if (input[y][x] !== '.') art.setPixel(x, y, ...colors[input[y][x]]);
        if (kind === 'masked-background') art.setPixel(3, 4, ...colors.G.slice(0, 3), 0);
        const canvas = api.bufferToCanvas(art); document.body.append(canvas);
        const element = { sourceCicnId: -9975, sourceCinfId: -9975, asset: canvas.toDataURL(), width: art.width, height: art.height,
          slice: { corner: isCenter ? 2 : 3, side: isCenter ? 1 : 4, tile: kind.endsWith('tile') },
          bodyRequest: { mode: 0, resourceId: 0 }, bgAnchor: isCenter ? [3, 4] : [3, 0],
          samplingEquivalence: { model: 'kaleidoscope-2.3.1-opaque-sampling-v1', comparison: 'opaque-current-display-rgb', displayPolicy: 'mac-1.8-to-2.2-high-byte', width: art.width, height: art.height, status: 'equivalent', reason: 'all-opaque-display-rgb-equal' } };
        if (kind === 'masked-background') element.colorSamples = { model: 'kdef-2.3.1-color', displayPolicy: 'mac-1.8-to-2.2-high-byte', background: { rgb16: [8481, 34952, 8481], displayRgb: colors.G.slice(0, 3) }, text: null, emboss: null, embossDecision: 'unknown' }; // Declared transport-consumption fixture, not a decoder/RGB transform proof.
        if (kind === 'pattern-center') element.bodyRequest.resourceId = 17;
        if (kind === 'unknown-request') delete element.bodyRequest;
        // Metadata and pixels must travel with the selected owner, not the child.
        const owner = { baseUrl: location.origin, manifest: { chromeElements: { rear: element } } };
        const child = { baseUrl: location.origin, base: owner, manifest: { chromeElements: {} } };
        const output = await api.composeTab(child, { label: '', selected: false });
        if (output) document.body.append(api.bufferToCanvas(output));
        const pixels = output && Array.from({ length: output.height }, (_, y) => Array.from({ length: output.width }, (_, x) => {
          const p = [...output.getPixel(x, y)]; if (!p[3]) return '.';
          return Object.keys(colors).find(c => colors[c].every((v, i) => v === p[i])) ?? '?';
        }).join(''));
        rows.push({ kind, size: output && [output.width, output.height], pixels });
      }
      return rows;
    }, { mode, overlapping, positiveCenter, partialInput });
    expect(rows.map(r => r.kind)).toEqual(['overlap-first', 'overlap-tile', 'partial-tile', 'center', 'masked-background', 'pattern-center', 'unknown-request']);
    for (const row of rows) {
      // AD4 replaces unsupported legacy drawing; P2 absent pattern now erases.
      if (row.kind === 'unknown-request') { expect(row.size).toBeNull(); expect(row.pixels).toBeNull(); continue; }
      expect(row.size).toEqual(['center', 'masked-background', 'pattern-center', 'unknown-request'].includes(row.kind) ? [10, 9] : [12, 6]);
      expect(row.pixels, row.kind).toEqual(['center', 'masked-background', 'pattern-center'].includes(row.kind) ? filledCenter : row.kind === 'partial-tile' ? partialOutput : row.kind === 'overlap-tile' ? repeatedBand : firstColumn);
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
            load: owner.byteProvenance, expectedEntryBinding: entry.byteProvenance, columns, sides });
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
        const actual = row.load.resources.find(r => r.resourceIndex === row.expectedEntryBinding[field]);
        expect(actual).toMatchObject({ type, signedId: -9975, sha256: pin.resources.find(r => r.type === type).sha256 });
      }
      for (const pixel of [...row.columns, ...row.sides]) {
        expect(pixel.actual[3]).toBe(pixel.expected[3]);
        if (pixel.expected[3]) expect(pixel.actual).toEqual(pixel.expected);
      }
    }
    await attachObservations(info, 'tab-body', `${mode}-corpus`, { mode, pins, rows, limits: 'Exact empty-label decoded source strip retention against pinned expected art; expectedEntryBinding is catalog evidence, not an observed composeTab paint trace. Original selection, full-control layout and typography remain unknown.' });
  } catch (error) { await attachCase(page, info, { mode, pins, rows }, error); throw error; }
});

for (const mode of ['source', 'built']) test(`${mode}: AgjpQy rear tabs preserve the source-coordinate middle strip outside browser glyph ink`, async ({ page, servers }, info) => {
  info.annotations.push({ type: 'fidelity-assertion', description: 'tabs.full-raster-agjpqy' });
  await openHarness(page, servers, mode);
  const rows = await page.evaluate(async ({ mode, pins }) => {
    const api = await import(mode === 'built' ? '/dist/scriptoscope.js' : '/src/index.ts');
    const rows = [];
    for (const pin of pins.cases) {
      const theme = await api.loadTheme(`/themes/${pin.slug}`, { provenance: true });
      try {
        const entry = Object.values(theme.manifest.chromeElements).find(e => e.sourceCicnId === -9975);
        const source = await api.loadCicnBuffer(api.assetUrl(theme, entry.asset));
        const output = await api.composeTab(theme, { label: 'AgjpQy', selected: false });
        // Existing browser typography is explicitly excluded. This mask only
        // identifies pixels where that separate layer overwrites the body; it
        // does not generate expected body pixels or certify the original font.
        const mask = api.rasterizeText('AgjpQy', 8, '#ffffff');
        const gx = Math.round((output.width - mask.width) / 2), gy = Math.round((16 - mask.height) / 2) + 1;
        const c = pin.resources.find(r => r.type === 'cinf').corner;
        const checked = [], excluded = [];
        for (let y = 0; y < 16; y++) for (let x = 0; x < output.width; x++) {
          if (mask.getPixel(x - gx, y - gy)[3]) { excluded.push([x, y]); continue; }
          const sx = x < c ? x : x >= output.width - c ? source.width - (output.width - x) : c;
          checked.push({ at: [x, y], actual: [...output.getPixel(x, y)], expected: [...source.getPixel(sx, y)] });
        }
        rows.push({ slug: pin.slug, options: { label: 'AgjpQy', selected: false }, size: [output.width, output.height], corner: c,
          expectedEntryBinding: entry.byteProvenance, load: theme.byteProvenance, checked, excluded });
      } finally { theme.dispose(); }
    }
    return rows;
  }, { mode, pins });
  expect(rows.map(r => r.slug)).toEqual(['1138', '1990']);
  for (const row of rows) {
    expect(row.size[1]).toBe(16);
    expect(row.excluded.length).toBeGreaterThan(0);
    expect(row.checked.filter(p => p.at[0] >= row.corner && p.at[0] < row.size[0] - row.corner).length).toBeGreaterThan(100);
    const sourcePin = pins.cases.find(p => p.slug === row.slug);
    expect(row.load.input.sha256).toBe(sourcePin.archiveSha256);
    for (const [type, field] of [['cicn', 'cicnResourceIndex'], ['cinf', 'cinfResourceIndex']]) {
      expect(row.load.resources.find(r => r.resourceIndex === row.expectedEntryBinding[field])).toMatchObject({ type, signedId: -9975, sha256: sourcePin.resources.find(r => r.type === type).sha256 });
    }
    for (const pixel of row.checked) {
      expect(pixel.actual[3]).toBe(pixel.expected[3]);
      if (pixel.expected[3]) expect(pixel.actual).toEqual(pixel.expected);
    }
  }
  await attachObservations(info, 'tab-body', `${mode}-agjpqy`, { mode, rows, limits: 'Body coordinates outside current browser glyph ink against pinned expected art; expectedEntryBinding is catalog evidence, not an observed paint trace. Original selection, font, width policy, text transfer and label placement remain unverified.' });
});
