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

test('Windows95 faces use authored cinf background samples in every state', async (t) => {
  const page = await fixture(t);
  const rows = await page.evaluate(async () => {
    const { controls, loadTheme } = window.controlFixture;
    const theme = await loadTheme('/themes/windows-95');
    const rows = [];
    for (const [state, id, opts] of [['active', 10239, {}], ['active', 10239, { default: true }], ['pressed', 10238, { pressed: true }], ['inactive', 10240, { disabled: true }]]) {
      const el = Object.values(theme.manifest.chromeElements).find(e => Math.abs(e.sourceCicnId) === id);
      const face = await controls.loadPushButtonFace(theme, state);
      const out = await controls.composeButton(theme, { label: 'OK', height: 20, ...opts });
      // Source-authored sample, independently read from the face. x=16 sits
      // beyond the pressed 6px border + 4px ring margin and before label ink.
      rows.push({ expected: face.getPixel(...el.bgAnchor), actual: out.getPixel(16, 16), size: [out.width, out.height] });
    }
    return rows;
  });
  for (const row of rows) {
    assert.deepEqual(row.expected, [202, 202, 202, 255], 'original Windows95 source color');
    assert.deepEqual(row.actual, row.expected, 'face interior uses bgPixel, not white bevel');
    assert.deepEqual(row.size, [64, 28]);
  }
});

test('signed face states inherit matching occurrence metadata without cross-state fallback', async (t) => {
  const page = await fixture(t);
  const result = await page.evaluate(async () => {
    const { controls, loadTheme } = window.controlFixture;
    const source = await loadTheme('/themes/windows-95');
    const states = [[-10239, {}], [-10238, { pressed: true }], [-10240, { disabled: true }]];
    const rows = [];
    for (const [id, opts] of states) {
      const otherFaces = Object.fromEntries(Object.entries(source.manifest.chromeElements).filter(([,e]) => e.sourceCicnId !== id));
      // Retain original raw/decoded occurrence identities. Remove the requested
      // art from both catalogs, rather than relabeling another state's image.
      const child = { ...source, baseUrl: `${source.baseUrl}/child`, base: source,
        inspector: { ...source.inspector, cicnResources: source.inspector.cicnResources.filter(r => r.id !== id) },
        manifest: { ...source.manifest, chromeElements: otherFaces } };
      let trace;
      const actual = await controls.composeButton(child, { label: 'Ag', height: 23, ...opts, diagnostics: { onComplete: t => { trace = t; } } });
      const expected = await controls.composeButton(source, { label: 'Ag', height: 23, ...opts });
      const missing = await controls.composeButton({ ...child, base: undefined }, opts);
      const el = Object.values(source.manifest.chromeElements).find(e => e.sourceCicnId === id);
      rows.push({ id, identity: el.cicnSource.id, index: el.cicnSource.resourceIndex,
        same: actual.data.every((v,i) => v === expected.data[i]), missing: missing === null,
        selected: trace.steps.filter(step => step.action === 'selected' && step.role === 'face' && step.usage === 'paint' && step.resource?.signedId === id),
        signature: [...actual.data] });
    }
    return rows;
  });
  for (const row of result) {
    assert.equal(row.identity, row.id, 'raw occurrence and decoded signed ID agree');
    assert.equal(row.same, true, `${row.id}: inherited face keeps its own cinf geometry/samples`);
    assert.equal(row.missing, true, `${row.id}: PB8 forbids another face-state retry`);
    assert.ok(row.selected.length > 0, `${row.id}: diagnostic identifies actual face selection`);
    for (const step of row.selected) {
      assert.equal(step.resource.sourceCinfId, row.id);
      assert.equal(step.owner.chainDepth, 1, 'selected face belongs to base');
    }
  }
  assert.deepEqual(result.map(r => r.index), [238, 237, 239], 'distinct original occurrence identities');
  assert.equal(result[0].signature.some((v,i) => v !== result[1].signature[i]), true, 'active/pressed fixture discriminates state');
  assert.equal(result[0].signature.some((v,i) => v !== result[2].signature[i]), true, 'active/inactive fixture discriminates state');
});

test('solid bevel and list faces use their own authored background samples', async (t) => {
  const page = await fixture(t);
  const rows = await page.evaluate(async (root) => {
    const { controls, loadTheme } = window.controlFixture;
    const { loadCicnBuffer } = await import(`/@fs${root}/src/cicnImage.ts`);
    const { assetUrl } = await import(`/@fs${root}/src/loadTheme.ts`);
    const theme = await loadTheme('/themes/windows-95');
    const rows = [];
    for (const [id, render] of [
      [10166, () => controls.composeBevelButton(theme, { height: 20, minWidth: 50 })],
      [10165, () => controls.composeBevelButton(theme, { height: 20, minWidth: 50, pressed: true })],
      [10167, () => controls.composeBevelButton(theme, { height: 20, minWidth: 50, disabled: true })],
      [9567, () => controls.composeListHeader(theme, { height: 20, columns: [{ label: '', width: 50 }] })],
    ]) {
      const el = Object.values(theme.manifest.chromeElements).find(e => Math.abs(e.sourceCicnId) === id);
      const source = await loadCicnBuffer(assetUrl(theme, el.asset));
      const output = await render();
      rows.push({ id, pattern: el.bgPattern, expected: source.getPixel(...el.bgAnchor), actual: output.getPixel(25, 10) });
    }
    return rows;
  }, root);
  for (const row of rows) {
    assert.equal(row.pattern, null);
    assert.equal(row.expected[3], 255);
    assert.deepEqual(row.actual, row.expected, `resource -${row.id} uses its own background sample`);
  }
});
