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
    // The chooser and the page share decoded schemes, so choosing one that is already loaded
    // makes no request to delay. Every scheme request passes through this route from the
    // start: it records the schemes let through while the page boots, then holds every later
    // one. A corpus scheme never let through is therefore still unloaded, and stays pending
    // whether the chooser's lazy icon load or the choice itself requests it first.
    const slugOf = url => /\/themes\/([^/]+)\//.exec(new URL(url).pathname)?.[1];
    let holding = false, release, wake = () => {};
    const gate = new Promise(resolve => release = resolve);
    const passed = new Set(), held = new Set();
    await page.route('**/themes/*/**', async route => {
      const slug = slugOf(route.request().url());
      if (!holding) { passed.add(slug); return route.continue(); }
      held.add(slug);
      wake();
      await gate;
      await route.continue();
    });
    const untilHeld = async slug => {
      while (!held.has(slug)) await new Promise(resolve => { wake = resolve; });
    };
    await page.goto(`${mode === 'source' ? demo : production}/showcase.html?theme=windows-95`);
    await expect(page.locator('#powers.scriptoscope-ready')).toBeVisible();
    holding = true;
    const slugs = await page.locator('[data-slug]').evaluateAll(tiles => [...new Set(tiles.map(tile => tile.dataset.slug))]);
    const slug = slugs.find(candidate => /^[\w-]+$/.test(candidate) && !passed.has(candidate));
    expect(slug, 'a corpus chooser scheme that was not loaded while the page booted').toBeTruthy();
    const first = page.locator(`[data-slug="${slug}"]`).first();
    await page.getByRole('button', { name: /Switch to bare HTML/ }).click();
    await expect(page.locator('#powers [data-scriptoscope-window-host]')).toHaveCount(0);
    await expect(page.locator('#powers.scriptoscope-ready')).toHaveCount(0);
    const unrelated = page.getByRole('link', { name: 'Skip to content', exact: true });
    try {
      await first.focus();
      await first.press('Enter');
      await untilHeld(slug);
      // This native link remains reachable outside the pending inert demo.
      await unrelated.focus();
      await expect(unrelated).toBeFocused();
      release();
      await expect(page.locator('#powers.scriptoscope-ready')).toBeVisible();
      await expect(page).toHaveURL(new RegExp(`theme=${slug}(?:&|$)`));
      await expect(page.locator('#install-teaser')).toHaveAttribute('data-scriptoscope-theme', slug);
      await expect(first).toHaveAttribute('aria-selected', 'true');
      await expect(page.locator('#powers [data-scriptoscope-window-host]')).toHaveCount(8);
      await expect(unrelated).toBeFocused();
    } finally { release(); }
  });
}
