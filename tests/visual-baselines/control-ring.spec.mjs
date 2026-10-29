// Browser regression for tiny, resizable button templates and readable labels.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
import { createServer as createPortReservation } from 'node:net';

let server, browser, base;
const root = fileURLToPath(new URL('../..', import.meta.url)).replace(/\/$/, '');
test.before(async () => {
  // Vite 7 treats port: 0 as its default port. Reserve an OS-assigned port
  // first, then fail safely if another process takes it before Vite listens.
  const reservation = createPortReservation();
  await new Promise((resolve) => reservation.listen(0, '127.0.0.1', resolve));
  const port = reservation.address().port;
  await new Promise((resolve, reject) => reservation.close((error) => error ? reject(error) : resolve()));
  server = await createServer({
    configFile: `${root}/vite.config.js`, root: `${root}/demo`,
    server: { host: '127.0.0.1', port, strictPort: true, open: false },
  });
  await server.listen();
  base = server.resolvedUrls.local[0];
  browser = await chromium.launch();
});
test.after(async () => {
  await browser?.close();
  await server?.close();
});

async function fixture(t) {
  const page = await browser.newPage();
  t.after(() => page.close());
  await page.goto(`${base}?theme=windows-95`);
  await page.waitForSelector('.scriptoscope-ready');
  await page.evaluate(async (root) => {
    await document.fonts.ready;
    const [controls, { loadTheme }, { rasterizeText }] = await Promise.all([
      import(`/@fs${root}/src/controls.ts`), import(`/@fs${root}/src/loadTheme.ts`),
      import(`/@fs${root}/src/textRaster.ts`),
    ]);
    window.controlFixture = { controls, loadTheme, rasterizeText };
  }, root);
  return page;
}

test('all 18 ring footprints use controlRect expanded by four and preserve source corners', async (t) => {
  const page = await fixture(t);
  const rows = await page.evaluate(async (root) => {
    const { controls, loadTheme } = window.controlFixture;
    const [{ loadCicnBuffer }, { assetUrl }] = await Promise.all([
      import(`/@fs${root}/src/cicnImage.ts`), import(`/@fs${root}/src/loadTheme.ts`),
    ]);
    const manifest = await (await fetch('/themes-manifest.json')).json();
    const rows = [];
    for (const { slug, source } of manifest) {
      const theme = await loadTheme(`/themes/${slug}`, { source });
      const element = id => Object.values(theme.manifest.chromeElements).find(e => Math.abs(e.sourceCicnId) === id);
      for (const [state, opts, id] of [['normal', {}, 10231], ['pressed', { pressed: true }, element(10230) ? 10230 : 10231], ['disabled', { disabled: true }, 10232]]) {
        const plain = await controls.composeButton(theme, { height: 22, minWidth: 56, ...opts });
        const output = await controls.composeButton(theme, { height: 22, minWidth: 56, default: true, ...opts });
        const el = element(id);
        const sourceRing = el ? await loadCicnBuffer(assetUrl(theme, el.asset)) : null;
        let samples = 0, mismatches = 0;
        const cinf = theme.manifest.engineCinfs?.[-id] ?? theme.manifest.engineCinfs?.[1];
        const admitted = !!cinf;
        if (sourceRing && admitted) {
          // Sample the native corner blocks, up to4×4. These outer corner
          // pixels lie outside the face and must retain their full-raster
          // coordinates, including transparent rim pixels. No production
          // nine-slice helper is used to calculate the expected pixels.
          const corner = cinf[0];
          for (let y = 0; y < Math.min(4, corner, sourceRing.height); y++) for (let x = 0; x < Math.min(4, corner, sourceRing.width); x++) {
            for (const [ox, oy, sx, sy] of [[x,y,x,y], [output.width-1-x,y,sourceRing.width-1-x,y], [x,output.height-1-y,x,sourceRing.height-1-y], [output.width-1-x,output.height-1-y,sourceRing.width-1-x,sourceRing.height-1-y]]) {
              const expected = sourceRing.getPixel(sx, sy);
              const actual = output.getPixel(ox, oy);
              samples++;
              if (expected.some((v, i) => v !== actual[i])) mismatches++;
            }
          }
        }
        rows.push({ slug, state, dimensions: [output.width, output.height], plain: [plain.width, plain.height], admitted, noPaint: output.data.every((v,i) => v === plain.data[i]), samples, mismatches });
      }
    }
    return rows;
  }, root);
  assert.equal(rows.length, 54);
  assert.equal(rows.filter(r => r.admitted).length, 34, 'push §6: same-ID ring metadata admission census');
  for (const row of rows) {
    assert.deepEqual(row.dimensions, [64, 30], `${row.slug}/${row.state}: 56×22 face plus4 per side`);
    assert.deepEqual(row.plain, row.dimensions, 'default state cannot shift neighbors');
    if (!row.admitted) assert.equal(row.noPaint, true, `${row.slug}/${row.state}: DR6 metadata miss paints nothing`);
    if (row.samples) assert.equal(row.mismatches, 0, `${row.slug}/${row.state}: full-raster corner pixels`);
  }
});

test('Windows95 and System7 tiny/automatic state rectangles use the same four-pixel outset', async (t) => {
  const page = await fixture(t);
  const rows = await page.evaluate(async () => {
    const { controls, loadTheme } = window.controlFixture;
    const rows = [];
    for (const slug of ['windows-95', 'system7-nostalgia-silver']) {
      const theme = await loadTheme(`/themes/${slug}`);
      for (const height of [undefined, 6, 22]) for (const opts of [{}, { pressed: true }, { disabled: true }, { default: true }, { default: true, pressed: true }, { default: true, disabled: true }]) {
        const output = await controls.composeButton(theme, { label: 'OK', ...(height == null ? {} : { height }), ...opts });
        rows.push({ slug, height: height ?? 'auto', size: [output.width, output.height] });
      }
    }
    return rows;
  });
  for (const row of rows) assert.deepEqual(row.size, [64, (row.height === 'auto' ? row.slug === 'windows-95' ? 20 : 16 : row.height) + 8], `${row.slug}/${row.height}`);
});

test('ring overlays face edges, omits source center, and requires the selected pressed face', async (t) => {
  const page = await fixture(t);
  const result = await page.evaluate(async (root) => {
    const { controls, loadTheme } = window.controlFixture;
    const { ringCinf } = await import(`/@fs${root}/tests/visual-baselines/optional-control-fixtures.mjs`);
    const source = await loadTheme('/themes/windows-95');
    const asset = (size, draw) => {
      const c = document.createElement('canvas'); c.width = c.height = size;
      const ctx = c.getContext('2d'); draw(ctx); return c.toDataURL();
    };
    const ring = color => ({ asset: asset(12, ctx => {
      ctx.fillStyle = color; ctx.fillRect(1, 1, 1, 1);
      ctx.fillStyle = '#ff00ff'; ctx.fillRect(4, 4, 1, 1);
      ctx.fillStyle = '#00ff00'; ctx.fillRect(5, 5, 2, 2);
    }), width: 12, height: 12, slice: { corner: 5, side: 5, tile: false } });
    const theme = { base: source, baseUrl: `${source.baseUrl}/synthetic-rings`, manifest: { ...source.manifest, patterns: {}, engineCinfs: { '-10231': ringCinf(5,5,false), '-10230': ringCinf(5,5,false) }, chromeElements: {
      activeRing: { ...ring('#ff0000'), sourceCicnId: -10231 },
      pressedRing: { ...ring('#0000ff'), sourceCicnId: -10230 },
    } } };
    const opts = { height: 6, minWidth: 24 };
    const plain = await controls.composeButton(theme, opts);
    const normal = await controls.composeButton(theme, { ...opts, default: true });
    const pressed = await controls.composeButton(theme, { ...opts, default: true, pressed: true });
    const withoutPressed = { ...source, inspector: { ...source.inspector, cicnResources: source.inspector.cicnResources.filter(r => r.id !== -10238) },
      manifest: { ...source.manifest, chromeElements: Object.fromEntries(Object.entries(source.manifest.chromeElements).filter(([,e]) => e.sourceCicnId !== -10238)) } };
    const missing = await controls.composeButton({ ...theme, base: withoutPressed }, { ...opts, default: true, pressed: true });
    const { '-10230': omittedMetadata, ...noPressedMetadata } = theme.manifest.engineCinfs;
    const noMetadataTheme = { ...theme, manifest: { ...theme.manifest, engineCinfs: noPressedMetadata } };
    const pressedPlain = await controls.composeButton(noMetadataTheme, { ...opts, pressed: true });
    const noMetadata = await controls.composeButton(noMetadataTheme, { ...opts, default: true, pressed: true });
    const defaultMetadata = await controls.composeButton({ ...noMetadataTheme, manifest: { ...noMetadataTheme.manifest,
      engineCinfs: { ...noPressedMetadata, 1: ringCinf(5,5,false) } } }, { ...opts, default: true, pressed: true });
    return { noMetadata: noMetadata.data.every((v,i) => v === pressedPlain.data[i]), defaultMetadata: defaultMetadata.getPixel(1,1),
      missing: missing === null, dimensions: [normal.width, normal.height], margin: normal.getPixel(0, 0),
      plain: plain.getPixel(16, 7), overlap: normal.getPixel(4, 4), center: normal.getPixel(16, 7),
      active: normal.getPixel(1, 1), pressed: pressed.getPixel(1, 1) };
  }, root);
  assert.equal(result.noMetadata, true, 'DR6: pressed art without metadata paints nothing and suppresses normal-ring retry');
  assert.deepEqual(result.defaultMetadata, [0, 0, 255, 255], 'DR5: explicit cinf 1 admits the pressed ring');
  assert.equal(result.missing, true, 'PB6/PB8: ring art cannot replace absent pressed face');
  assert.deepEqual(result.dimensions, [32, 14]);
  assert.deepEqual(result.margin, [0, 0, 0, 0], 'transparent source rim is not cropped');
  assert.deepEqual(result.plain, [202, 202, 202, 255], 'authored face interior is present beneath the ring');
  assert.deepEqual(result.overlap, [255, 0, 255, 255], 'ring edge draws after face');
  assert.deepEqual(result.center, [202, 202, 202, 255], 'ring body flag is false, so opaque center is omitted');
  assert.deepEqual(result.active, [255, 0, 0, 255]);
  assert.deepEqual(result.pressed, [0, 0, 255, 255], 'pressed default selects -10230');
});

test('default rings preserve metric-positioned declared label ink across admitted corpus faces', async (t) => {
  const page = await fixture(t);
  const rows = await page.evaluate(async (root) => {
    const { controls, loadTheme } = window.controlFixture;
    const { prepareBitmapFont } = await import(`/@fs${root}/src/index.ts`);
    const { labelStrike, labelInk } = await import(`/@fs${root}/tests/visual-baselines/optional-control-fixtures.mjs`);
    const manifest = await (await fetch('/themes-manifest.json')).json();
    const rows = [];
    for (const { slug, source } of manifest) {
      const theme = await loadTheme(`/themes/${slug}`, { source });
      for (const size of [12, 16]) {
        const strike = labelStrike(size), bitmapFont = await prepareBitmapFont(strike);
        for (const height of [undefined, 23]) for (const [id, state] of [[-10239, {}], [-10238, { pressed: true }], [-10240, { disabled: true }]]) {
          const opts = { label: 'Ag', bitmapFont, fg: '#ff00ff', ...(height ? { height } : {}), ...state };
          const plain = await controls.composeButton(theme, opts);
          const out = await controls.composeButton(theme, { ...opts, default: true });
          const admitted = !!(theme.manifest.engineCinfs?.[id] ?? theme.manifest.engineCinfs?.[0]);
          const points = labelInk(out.width, out.height, strike);
          const inkAt = (buffer, x, y) => { const p = buffer.getPixel(x,y); return p[0] === 255 && p[1] === 0 && p[2] === 255 && p[3] === 255; };
          rows.push({ slug, height: height ?? 'auto', size, id, admitted, expected: points.length,
            plainMissing: points.filter(([x,y]) => !inkAt(plain,x,y)).length,
            missing: points.filter(([x,y]) => !inkAt(out,x,y)).length });
        }
      }
    }
    return rows;
  }, root);
  assert.equal(rows.length, 216);
  assert.equal(rows.filter(r => r.admitted).length, 156, '13 metadata-admitted face families × 12 cases');
  for (const row of rows) {
    if (!row.admitted) {
      // PB9/§6: no claim about source label colors after metadata NULLs.
      // A ring can still paint: foreground presence is deliberately not asserted.
      continue;
    }
    assert.ok(row.expected > 20);
    assert.equal(row.plainMissing, 0, `${row.slug}/${row.height}/${row.size}/${row.id}: advance and metric baseline`);
    assert.equal(row.missing, 0, `${row.slug}/${row.height}/${row.size}/${row.id}: ring does not erase foreground`);
  }
});

test('square corners and overlapping ring bands follow original coordinates and masked painter order', async (t) => {
  const page = await fixture(t);
  const results = await page.evaluate(async (root) => {
    const { controls, loadTheme } = window.controlFixture;
    const { ringCinf } = await import(`/@fs${root}/tests/visual-baselines/optional-control-fixtures.mjs`);
    const base = await loadTheme('/themes/windows-95');
    const makeImage = (size, pixel) => {
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
      const ctx = canvas.getContext('2d'), data = ctx.createImageData(size, size);
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) data.data.set(pixel(x, y), (y * size + x) * 4);
      ctx.putImageData(data, 0, 0); return canvas.toDataURL();
    };
    const results = [];
    for (const [corner, side, repeat, mask] of [[7,14,true,false], [7,14,false,false], [7,14,true,true], [3,1,true,false], [12,1,false,false]]) {
      const ring = { sourceCicnId: -10231, width: 21, height: 21, slice: { corner: 2, side: 3, tile: !repeat }, asset: makeImage(21, (x,y) => [x,y,100,mask && x === 13 && y === 9 ? 0 : 255]) };
      const theme = { base, baseUrl: `${base.baseUrl}/synthetic-ring-bands`, manifest: { ...base.manifest, patterns: {}, engineCinfs: { '-10231': ringCinf(corner,side,repeat) }, chromeElements: { ring } } };
      const out = await controls.composeButton(theme, { default: true, height: 32, minWidth: 45 });
      results.push({ size: [out.width, out.height], corner: out.getPixel(2,2),
        top: out.getPixel(20,2), topEdge: out.getPixel(20,0), left: out.getPixel(0,17), right: out.getPixel(52,17),
        leftOverlap: out.getPixel(8,30), rightOverlap: out.getPixel(45,30), center: out.getPixel(26,20) });
    }
    return results;
  }, root);
  for (const row of results) assert.deepEqual(row.size, [53,40]);
  const [repeat, single, masked, narrow, overlappingCorners] = results;
  // E4: top run starts at 7, source run is [7,14): 7+(20-7)%7=13.
  // Left run at y17 maps to 7+(17-7)%7=10. E2 paints left/right
  // after bottom; its masked (13,9) hole must retain bottom's (10,11).
  assert.deepEqual(repeat.top, [13,2,100,255]);
  assert.deepEqual(repeat.left, [0,10,100,255]);
  assert.deepEqual(repeat.right, [20,10,100,255]);
  assert.deepEqual(repeat.leftOverlap, [8,9,100,255], 'left band paints after bottom');
  assert.deepEqual(repeat.rightOverlap, [13,9,100,255], 'right band paints last');
  assert.deepEqual(single.top, [7,2,100,255], 'non-repeat uses first source column');
  assert.deepEqual(single.left, [0,7,100,255], 'non-repeat uses first source row');
  assert.deepEqual(single.right, [20,7,100,255]);
  assert.deepEqual(masked.rightOverlap, [10,11,100,255], 'transparent right sample preserves earlier bottom');
  assert.deepEqual(narrow.corner, [2,2,100,255], 'corner is square3×3 even when edge thickness is1');
  assert.deepEqual(repeat.center, [202,202,202,255], 'ring does not paint its source center');
  assert.deepEqual(overlappingCorners.topEdge, [12,0,100,255], 'non-repeat first column remains valid when source corners overlap');
  assert.deepEqual(overlappingCorners.left, [0,12,100,255], 'non-repeat first row remains valid when source corners overlap');
});

test('unused ring-state assets do not decode or block plain and active buttons', async (t) => {
  const page = await fixture(t);
  const requested = [];
  page.on('request', request => { if (request.url().includes('unused-ring')) requested.push(request.url()); });
  const sizes = await page.evaluate(async () => {
    const { controls, loadTheme } = window.controlFixture;
    const source = await loadTheme('/themes/windows-95');
    const elements = { ...source.manifest.chromeElements };
    for (const [key, el] of Object.entries(elements)) {
      if (el.sourceCicnId === -10232) elements[key] = { ...el, asset: '/unused-ring-disabled.png' };
    }
    elements.pressedRing = { sourceCicnId: -10230, width: 16, height: 16, asset: '/unused-ring-pressed.png' };
    const theme = { ...source, manifest: { ...source.manifest, chromeElements: elements } };
    const plain = await controls.composeButton(theme, { label: 'OK' });
    const active = await controls.composeButton(theme, { label: 'OK', default: true });
    return [plain, active].map(b => [b.width, b.height]);
  });
  assert.deepEqual(sizes, [[64,28], [64,28]]);
  assert.deepEqual(requested, [], 'only the selected ring state is loaded');
});
