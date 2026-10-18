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

test('Windows95 button templates contain the complete centered label across states', async (t) => {
  const page = await fixture(t);
  const result = await page.evaluate(async () => {
    const { controls, loadTheme, rasterizeText } = window.controlFixture;
    const theme = await loadTheme('/themes/windows-95', { source: 'scheme.sit' });
    const outputs = await Promise.all([{}, { pressed: true }, { disabled: true }, { default: true }]
      .map(opts => controls.composeButton(theme, { label: 'Ag', ...opts })));
    const normal = outputs[0];
    const glyph = rasterizeText('Ag', 12, '#000000');
    const x = Math.round((normal.width - glyph.width) / 2);
    const y = Math.round((normal.height - glyph.height) / 2);
    let expectedInk = 0, presentInk = 0, top = Infinity, bottom = -1;
    for (let gy = 0; gy < glyph.height; gy++) for (let gx = 0; gx < glyph.width; gx++) {
      if (glyph.getPixel(gx, gy)[3] < 192) continue;
      expectedInk++;
      const p = normal.getPixel(x + gx, y + gy);
      if (p[0] < 64 && p[1] < 64 && p[2] < 64 && p[3] === 255) presentInk++;
      top = Math.min(top, y + gy); bottom = Math.max(bottom, y + gy);
    }
    // Explicit sizing remains the caller's choice, even if intentionally tiny.
    const explicit = await controls.composeButton(theme, { label: 'Ag', height: 6 });
    return { dimensions: outputs.map(b => [b.width, b.height]), expectedInk, presentInk,
      top, bottom, explicit: [explicit.width, explicit.height] };
  });
  assert.deepEqual(result.dimensions, Array(4).fill([68, 32]));
  assert.ok(result.expectedInk > 20, 'reference label contains a meaningful pixel sample');
  assert.equal(result.presentInk, result.expectedInk, 'all glyph ink, including ascenders/descenders, is present');
  assert.ok(result.top >= 8 && result.bottom <= 23, 'label is inside the 20px face with vertical clearance');
  assert.deepEqual(result.explicit, [68, 18]);
});

test('all 18 corpus buttons keep stable state geometry and honor explicit height', async (t) => {
  const page = await fixture(t);
  const rows = await page.evaluate(async () => {
    const { controls, loadTheme } = window.controlFixture;
    const manifest = await (await fetch('/themes-manifest.json')).json();
    const rows = [];
    for (const { slug, source } of manifest) {
      const theme = await loadTheme(`/themes/${slug}`, { source });
      const states = await Promise.all([{}, { pressed: true }, { disabled: true }, { default: true }]
        .map(opts => controls.composeButton(theme, { label: 'Ag', ...opts })));
      const explicit = await controls.composeButton(theme, { label: 'Ag', height: 22 });
      rows.push({ slug, sizes: states.map(b => [b.width, b.height]),
        explicit: [explicit.width, explicit.height] });
    }
    return rows;
  });
  assert.equal(rows.length, 18);
  for (const row of rows) {
    assert.deepEqual(row.sizes, Array(4).fill(row.sizes[0]), `${row.slug}: state changes must not move neighboring controls`);
    assert.ok(row.sizes[0][1] >= 20, `${row.slug}: readable outer height`);
    // Same ring footprint: setting 22 adds exactly 2px relative to a 20px face.
    if (['windows-95', 'windows-31', 'apple-lisa'].includes(row.slug)) {
      assert.equal(row.explicit[1] - row.sizes[0][1], 2, `${row.slug}: explicit height remains authoritative`);
    }
  }
});

test('showcase buttons and closed select are readable and pointer interaction does not resize them', async (t) => {
  const page = await fixture(t);
  const button = page.locator('.scriptoscope-button[aria-label="OK"]');
  const before = await button.boundingBox();
  await button.dispatchEvent('pointerdown');
  const pressed = await button.boundingBox();
  await button.dispatchEvent('pointerleave');
  assert.deepEqual(pressed, before);
  for (const label of ['OK', 'Cancel', 'Copy install snippet to clipboard']) {
    assert.equal(await page.locator(`.scriptoscope-button[aria-label="${label}"] canvas`).evaluate(c => c.height), 32);
  }
  const select = page.getByRole('combobox', { name: 'Format' });
  await select.selectOption({ label: '.rsrc' });
  await page.waitForFunction(() => document.querySelector('.scriptoscope-select .scriptoscope-button')?.getAttribute('aria-label') === '.rsrc  ▾');
  assert.equal(await page.locator('.scriptoscope-select canvas').evaluate(c => c.height), 32);
  assert.equal(await select.inputValue(), '.rsrc');
});

test('small bevel templates preserve full labels while explicit and empty sizes stay authored', async (t) => {
  const page = await fixture(t);
  const rows = await page.evaluate(async () => {
    const { controls, loadTheme, rasterizeText } = window.controlFixture;
    const rows = [];
    for (const slug of ['windows-95', 'animals', '1990']) {
      const theme = await loadTheme(`/themes/${slug}`);
      const options = { small: true, label: 'Ag' };
      const normal = await controls.composeBevelButton(theme, options);
      const pressed = await controls.composeBevelButton(theme, { ...options, pressed: true });
      const disabled = await controls.composeBevelButton(theme, { ...options, disabled: true });
      const explicit = await controls.composeBevelButton(theme, { ...options, height: 9 });
      const empty = await controls.composeBevelButton(theme, { small: true });
      let expectedInk = 0, presentInk = 0;
      if (slug === 'windows-95') {
        const glyph = rasterizeText('Ag', 12, '#000000');
        const x = Math.round((normal.width - glyph.width) / 2);
        const y = Math.round((normal.height - glyph.height) / 2);
        for (let gy = 0; gy < glyph.height; gy++) for (let gx = 0; gx < glyph.width; gx++) {
          if (glyph.getPixel(gx, gy)[3] < 192) continue;
          expectedInk++;
          const p = normal.getPixel(x + gx, y + gy);
          if (p[0] < 64 && p[1] < 64 && p[2] < 64 && p[3] === 255) presentInk++;
        }
      }
      rows.push({ slug, expectedInk, presentInk, sizes: [normal, pressed, disabled].map(b => [b.width, b.height]),
        explicit: explicit.height, empty: empty.height });
    }
    return rows;
  });
  for (const row of rows) {
    assert.deepEqual(row.sizes, Array(3).fill([33, 20]), row.slug);
    if (row.slug === 'windows-95') {
      assert.ok(row.expectedInk > 20);
      assert.equal(row.presentInk, row.expectedInk, 'bevel face preserves all centered label ink');
    }
    assert.equal(row.explicit, 9, `${row.slug}: compact caller override`);
    assert.ok(row.empty <= 9, `${row.slug}: empty template keeps its authored size`);
  }
});
