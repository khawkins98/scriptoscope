// Mobile demo regression: long code must scroll inside a window instead of
// widening its grid before promotion. Chrome stays at its native pixel scale.
// Uses the optional Playwright setup documented in this directory's README.
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


async function assertFits(page, label) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
  const geometry = await page.evaluate(() => ({
    viewport: innerWidth, pageWidth: document.documentElement.scrollWidth,
    chrome: [...document.querySelectorAll('*')].flatMap((host) => {
      const win = host.shadowRoot?.querySelector('.scriptoscope-window');
      if (!win || getComputedStyle(host).visibility !== 'visible') return [];
      const rect = win.getBoundingClientRect();
      const canvas = win.querySelector('canvas.scriptoscope-chrome');
      return [{ title: win.getAttribute('aria-label'), left: rect.left, right: rect.right,
        nativeWidth: canvas?.width, displayedWidth: canvas?.getBoundingClientRect().width }];
    }),
  }));
  assert.ok(geometry.pageWidth <= geometry.viewport + 1, `${label}: page overflow ${JSON.stringify(geometry)}`);
  assert.ok(geometry.chrome.length >= 3, `${label}: expected promoted windows`);
  for (const win of geometry.chrome) {
    assert.ok(win.left >= -1 && win.right <= geometry.viewport + 1, `${label}: chrome outside viewport ${JSON.stringify(win)}`);
    if (win.nativeWidth) assert.equal(win.displayedWidth, win.nativeWidth, `${label}: canvas was scaled`);
  }
  return geometry;
}

for (const width of [320, 390]) {
  for (const theme of ['1138', 'monkey-paradise', 'beos-r503', 'apple-platinum-2']) {
    test(`showcase fits ${width}px mobile with ${theme}, including upload modal`, { timeout: 30000 }, async (t) => {
      const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: true, deviceScaleFactor: 1 });
      t.after(() => context.close());
      const page = await context.newPage();
      await page.goto(`${base}?theme=${theme}`);
      await page.waitForSelector('.scriptoscope-ready');
      const geometry = await assertFits(page, `${width}/${theme}`);
      assert.equal(geometry.viewport, width, 'mobile layout viewport should not expand to accommodate overflow');
      await page.evaluate(() => document.querySelector('[data-special="load"]').click());
      await page.waitForSelector('#powers-byo-modal-wrap[data-scriptoscope-modal-open]');
      await assertFits(page, `${width}/${theme}/modal`);
      await page.keyboard.press('Escape');
      await page.waitForSelector('#powers-byo-modal-wrap[data-scriptoscope-modal-open]', { state: 'hidden' });
      if (theme === '1138') {
        await page.evaluate(() => document.querySelector('[data-special="none"]').click());
        await page.waitForFunction(() => !document.querySelector('#powers.scriptoscope-ready'));
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), width, 'bare HTML must fit too');
        await page.locator('#powers-skin-toggle').click();
        await page.waitForSelector('.scriptoscope-ready');
        assert.equal(await page.locator('#powers-skin-toggle').getAttribute('aria-pressed'), 'true');
        await assertFits(page, `${width}/${theme}/remount`);
      }
    });
  }
  test(`personal blog fits ${width}px mobile and keeps code locally scrollable`, { timeout: 30000 }, async (t) => {
    const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: true, deviceScaleFactor: 1 });
    t.after(() => context.close());
    const page = await context.newPage();
    await page.goto(`${base}personal.html`);
    await page.waitForSelector('.scriptoscope-ready');
    const geometry = await assertFits(page, `${width}/personal`);
    assert.equal(geometry.viewport, width);
    const code = await page.locator('.post pre').evaluate((el) => ({ client: el.clientWidth, scroll: el.scrollWidth, overflow: getComputedStyle(el).overflowX }));
    assert.ok(code.scroll > code.client, 'long code should retain its horizontal scroll range');
    assert.equal(code.overflow, 'auto');
  });
}
