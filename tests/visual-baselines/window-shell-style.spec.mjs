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

test('window shell shadow belongs to windows, not promoted control art', async (t) => {
  const page = await fixture(t);
  for (const slug of ['windows-95', 'system7-nostalgia-silver']) {
    await page.goto(`${base}?theme=${slug}`);
    await page.waitForSelector('.scriptoscope-ready');
    const result = await page.evaluate(async (root) => {
      const controls = [...document.querySelectorAll('.scriptoscope-button, .scriptoscope-select, .scriptoscope-checkbox, .scriptoscope-radio')];
      const shadows = controls.map(el => ({ name: el.className, shadow: getComputedStyle(el).boxShadow }));
      const hosts = [...document.querySelectorAll('[data-scriptoscope-window-host]')];
      const { WindowManager } = await import(`/@fs${root}/src/interactive.ts`);
      const { loadTheme } = await import(`/@fs${root}/src/loadTheme.ts`);
      const theme = await loadTheme('/themes/windows-95');
      const manager = new WindowManager();
      const host = await manager.add(theme, { title: 'Imperative', width: 200, height: 100 });
      document.body.append(host);
      const imperative = { marker: host.hasAttribute('data-scriptoscope-window-host'), shadow: getComputedStyle(host).boxShadow };
      manager.remove(host);
      return { shadows, windows: hosts.map(el => ({ root: !!el.shadowRoot, shadow: getComputedStyle(el).boxShadow })), imperative };
    }, root);
    assert.ok(result.shadows.length >= 6, `${slug}: meaningful promoted controls`);
    for (const control of result.shadows) assert.equal(control.shadow, 'none', `${slug}: ${control.name}`);
    assert.ok(result.windows.length >= 3, `${slug}: real window hosts`);
    for (const host of result.windows) {
      assert.equal(host.root, true);
      assert.equal(host.shadow, 'rgba(0, 0, 0, 0.35) 2px 2px 0px 0px');
    }
    assert.equal(result.imperative.marker, true);
    assert.equal(result.imperative.shadow, 'rgba(0, 0, 0, 0.35) 2px 2px 0px 0px');
    await page.emulateMedia({ media: 'print' });
    assert.equal(await page.locator('[data-scriptoscope-window-host]').first().evaluate(el => getComputedStyle(el).boxShadow), 'none');
    await page.emulateMedia({ media: 'screen' });
  }
});
