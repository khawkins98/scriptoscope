import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { test as demoTest } from './demo-fixtures.mjs';
import { expect } from '@playwright/test';

// #524: on schemes without a grow-box resource, the resize hit zone must not
// cover the window scrollbar's drawn end arrow. The arrow is located only from
// the visible scrollbar element (its rect; arrow at the end, length = bar
// thickness). The grow-box button's geometry is never read.

const test = demoTest.extend({
  production: [async ({}, use) => {
    const base = resolve('dist/demo');
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

const PICKER = '.powers-picker';

async function openShowcase(page, url, slug) {
  await page.addInitScript(() => {
    window.__userResize = [];
    window.addEventListener('scriptoscope:userresize', e => window.__userResize.push({ target: e.target?.className ?? null }), true);
  });
  await page.goto(`${url}/showcase.html?theme=${slug}`);
  await expect(page.locator('#powers.scriptoscope-ready')).toBeVisible();
  const host = page.locator(`${PICKER}[data-scriptoscope-theme="${slug}"]`);
  await expect(host).toHaveCount(1);
  await host.scrollIntoViewIfNeeded();
  // Wait for tiles to populate (content overflows) and for auto-fit to settle.
  await expect.poll(() => snapshot(page)).toMatchObject({ scrollable: true });
  let prev = '';
  await expect.poll(async () => {
    const s = JSON.stringify((await snapshot(page)).chrome);
    const stable = s === prev; prev = s; return stable;
  }, { intervals: [250] }).toBe(true);
  return host;
}

/** Composed-tree observation of the picker window; no grow-box reads. */
function snapshot(page) {
  return page.evaluate(sel => {
    const host = document.querySelector(sel);
    const root = host.shadowRoot;
    const rect = e => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; };
    const descendants = [...host.querySelectorAll('*'), ...(root ? root.querySelectorAll('*') : [])];
    const scrollers = descendants.filter(e => e.scrollHeight > e.clientHeight + 1 && getComputedStyle(e).overflowY !== 'visible');
    const bar = root?.querySelector('[role="scrollbar"][aria-orientation="vertical"]');
    const chrome = root?.querySelector('canvas.scriptoscope-chrome');
    return {
      position: getComputedStyle(host).position,
      host: rect(host),
      chrome: chrome ? rect(chrome) : null,
      bar: bar && getComputedStyle(bar).visibility === 'visible' ? rect(bar) : null,
      barValue: bar?.getAttribute('aria-valuenow') ?? null,
      scrollable: scrollers.length > 0,
      scrollTop: descendants.reduce((sum, e) => sum + e.scrollTop, 0),
      placeholders: document.querySelectorAll('[data-scriptoscope-placeholder]').length,
      userResize: window.__userResize.length,
    };
  }, PICKER);
}

/** Diagnostic only: which shadow element receives the point. */
function hitAt(page, x, y) {
  return page.evaluate(({ sel, x, y }) => {
    const e = document.querySelector(sel).shadowRoot?.elementFromPoint(x, y);
    return e ? `${e.tagName.toLowerCase()}.${String(e.className).split(' ').join('.')}` : null;
  }, { sel: PICKER, x, y });
}

for (const mode of ['source', 'production']) {
  // windows-95 and beos-r503 ship no grow-box resource; apple-platinum-2 does
  // (positive control for the method on the same page).
  for (const slug of ['windows-95', 'beos-r503', 'apple-platinum-2']) {
    test(`${mode}: ${slug} vertical scrollbar down arrow scrolls and does not resize (#524)`, async ({ page, demo, production }) => {
      await openShowcase(page, mode === 'source' ? demo : production, slug);
      const before = await snapshot(page);
      expect(before.bar, 'visible vertical window scrollbar').not.toBeNull();
      expect(before.position, 'picker starts in flow').toBe('static');
      expect(before.scrollTop).toBe(0);
      expect(before.userResize).toBe(0);

      const thickness = before.bar.w;
      expect(before.bar.h).toBeGreaterThan(2 * thickness);
      const x = before.bar.x + thickness / 2;
      const y = before.bar.y + before.bar.h - thickness / 2;
      const hit = await hitAt(page, x, y);
      await page.mouse.click(x, y);
      await page.waitForTimeout(300);
      const after = await snapshot(page);
      const why = `${slug} down-arrow centre (${x.toFixed(1)}, ${y.toFixed(1)}) hit ${hit}`;

      expect.soft(after.scrollTop, `${why}: content did not scroll`).toBeGreaterThan(before.scrollTop);
      expect.soft(after.userResize, `${why}: dispatched scriptoscope:userresize`).toBe(0);
      expect.soft(after.position, `${why}: in-flow host was handed off to absolute`).toBe('static');
      expect.soft(after.placeholders, `${why}: handoff placeholder inserted`).toBe(before.placeholders);
      expect.soft(after.chrome, `${why}: window chrome resized`).toEqual(before.chrome);
      expect.soft({ w: after.host.w, h: after.host.h }, `${why}: host resized`).toEqual({ w: before.host.w, h: before.host.h });
    });

    test(`${mode}: ${slug} bottom-right corner pixel still resizes (#524)`, async ({ page, demo, production }) => {
      await openShowcase(page, mode === 'source' ? demo : production, slug);
      const before = await snapshot(page);
      const x = Math.ceil(before.chrome.x + before.chrome.w) - 1;
      const y = Math.ceil(before.chrome.y + before.chrome.h) - 1;
      const hit = await hitAt(page, x, y);
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(x - 20, y + 15, { steps: 4 });
      await page.mouse.move(x - 40, y + 30, { steps: 4 });
      await page.mouse.up();
      await page.waitForTimeout(300);
      const after = await snapshot(page);
      const why = `${slug} corner (${x}, ${y}) hit ${hit}`;
      expect(after.userResize, `${why}: no scriptoscope:userresize`).toBeGreaterThan(0);
      expect(after.chrome.h, `${why}: height unchanged`).toBeGreaterThan(before.chrome.h + 10);
      expect(after.chrome.w, `${why}: width unchanged`).toBeLessThan(before.chrome.w - 10);
    });
  }
}
