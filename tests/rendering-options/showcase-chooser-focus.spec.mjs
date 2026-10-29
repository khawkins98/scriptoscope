import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { test as demoTest } from './demo-fixtures.mjs';
import { expect } from '@playwright/test';

// The override accepts an opaque compiled demo for black-box regression checks.
const test = demoTest.extend({
  production: [async ({}, use) => {
    const base = resolve(process.env.SCRIPTOSCOPE_CHOOSER_DEMO_DIR ?? 'dist/demo');
    const mime = { '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.html': 'text/html', '.wasm': 'application/wasm', '.png': 'image/png' };
    const server = createServer(async (req, res) => {
      try {
        const url = new URL(req.url, 'http://localhost');
        if (!url.pathname.startsWith('/scriptoscope/')) throw Error('Outside demo');
        const file = resolve(base, '.' + decodeURIComponent(url.pathname.slice('/scriptoscope'.length)));
        if (!file.startsWith(base + sep) || !(await stat(file)).isFile()) throw Error('Not a file');
        res.setHeader('Content-Type', mime[extname(file)] ?? 'application/octet-stream');
        createReadStream(file).pipe(res);
      } catch { res.writeHead(404); res.end('Not found'); }
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    try { await use(`http://127.0.0.1:${server.address().port}/scriptoscope`); }
    finally { await new Promise(resolve => server.close(resolve)); }
  }, { scope: 'worker' }],
});

for (const mode of ['source', 'production']) {
  test(`${mode}: delayed bare chooser preserves later unrelated native focus`, async ({ page, demo, production }) => {
    await page.goto(`${mode === 'source' ? demo : production}/showcase.html?theme=windows-95`);
    await expect(page.locator('#powers.scriptoscope-ready')).toBeVisible();
    const first = page.locator('[data-slug="1984"]');
    await expect(first).toHaveAttribute('aria-busy', 'false');
    await page.getByRole('button', { name: /Switch to bare HTML/ }).click();
    await expect(page.locator('#powers [data-scriptoscope-window-host]')).toHaveCount(0);
    await expect(page.locator('#powers.scriptoscope-ready')).toHaveCount(0);

    let release, started;
    const requested = new Promise(resolve => started = resolve);
    const gate = new Promise(resolve => release = resolve);
    await page.route('**/themes/1984/**', async route => {
      started();
      await gate;
      await route.continue();
    });
    const unrelated = page.getByRole('link', { name: 'Skip to content', exact: true });
    try {
      await first.focus();
      await first.press('Enter');
      await requested;
      // This native link remains reachable outside the pending inert demo.
      await unrelated.focus();
      await expect(unrelated).toBeFocused();
      release();
      await expect(page.locator('#powers.scriptoscope-ready')).toBeVisible();
      await expect(page).toHaveURL(/theme=1984(?:&|$)/);
      await expect(page.locator('#install-teaser')).toHaveAttribute('data-scriptoscope-theme', '1984');
      await expect(first).toHaveAttribute('aria-selected', 'true');
      await expect(page.locator('#powers [data-scriptoscope-window-host]')).toHaveCount(8);
      await expect(unrelated).toBeFocused();
    } finally { release(); }
  });
}
