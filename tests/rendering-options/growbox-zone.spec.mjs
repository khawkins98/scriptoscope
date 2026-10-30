import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { test as demoTest } from './demo-fixtures.mjs';
import { expect } from '@playwright/test';
import { test as harnessTest, openHarness } from './fixtures.mjs';

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
    test(`${mode}: ${slug} vertical scrollbar down arrow (centre and far end) scrolls and does not resize (#524)`, async ({ page, demo, production }) => {
      await openShowcase(page, mode === 'source' ? demo : production, slug);
      const before = await snapshot(page);
      expect(before.bar, 'visible vertical window scrollbar').not.toBeNull();
      expect(before.position, 'picker starts in flow').toBe('static');
      expect(before.scrollTop).toBe(0);
      expect(before.userResize).toBe(0);

      const thickness = before.bar.w;
      expect(before.bar.h).toBeGreaterThan(2 * thickness);
      const x = before.bar.x + thickness / 2;
      // The far end first (2 px inside the bar's bottom edge): a clearance a
      // few px short puts this point under the resize zone while the centre
      // still lands on the bar.
      const yEnd = before.bar.y + before.bar.h - 2;
      const hitEnd = await hitAt(page, x, yEnd);
      await page.mouse.click(x, yEnd);
      await page.waitForTimeout(300);
      const end = await snapshot(page);
      const whyEnd = `${slug} down-arrow far end (${x.toFixed(1)}, ${yEnd.toFixed(1)}) hit ${hitEnd}`;
      expect(end.scrollTop, `${whyEnd}: content did not scroll`).toBeGreaterThan(0);
      expect(end.userResize, `${whyEnd}: dispatched scriptoscope:userresize`).toBe(0);
      expect(end.position, `${whyEnd}: in-flow host was handed off to absolute`).toBe('static');
      expect(end.chrome, `${whyEnd}: window chrome resized`).toEqual(before.chrome);
      await page.evaluate(sel => {
        const host = document.querySelector(sel);
        for (const e of [...host.querySelectorAll('*'), ...host.shadowRoot.querySelectorAll('*')]) e.scrollTop = 0;
      }, PICKER);
      await expect.poll(async () => (await snapshot(page)).scrollTop).toBe(0);

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

// Imperative windows (harness page, source and built runtime) with a single
// overflowing axis, so each bar runs the full content edge and its end arrow
// sits next to the bottom-right corner. Covers the horizontal bar's right arrow
// (the showcase has none) and a grow-box theme with a horizontal-only bar,
// whose right arrow sat under the gripper before #524. Each arrow is clicked at
// its centre and 2 px from its far end, so a corner clearance a few px short
// (the bar running into the resize zone) fails here even when the centre
// click still lands on the bar.
async function addWindow(page, mode, slug, axis, scale) {
  return page.evaluate(async ({ mode, slug, axis, scale }) => {
    const api = await import(mode === 'source' ? '/src/index.ts' : '/dist/scriptoscope.js');
    window.__growZone?.manager.remove(window.__growZone.host);
    window.__growZone?.host.remove();
    const theme = await api.loadTheme(`/themes/${slug}`);
    const manager = new api.WindowManager();
    const content = document.createElement('div');
    content.style.cssText = 'width:100%;height:100%;overflow:auto;box-sizing:border-box';
    const inner = document.createElement('div');
    inner.style.cssText = `width:${axis === 'horizontal' ? 900 : 50}px;height:${axis === 'vertical' ? 900 : 20}px;background:linear-gradient(45deg,red,blue)`;
    content.append(inner);
    const host = await manager.add(theme, { title: 'Zone', width: 200, height: 140, scale }, {}, { contentEl: content });
    document.body.append(host);
    manager.setPosition(host, 40, 40);
    host.style.zIndex = '1000';
    window.__growZone = { manager, host, content, resized: 0 };
    host.addEventListener('scriptoscope:userresize', () => window.__growZone.resized++);
    await new Promise(resolve => setTimeout(resolve, 300));
  }, { mode, slug, axis, scale });
}

function zoneState(page, axis) {
  return page.evaluate(axis => {
    const { host, content, resized } = window.__growZone;
    const rect = e => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, r: r.right, b: r.bottom, w: r.width, h: r.height }; };
    const bar = host.shadowRoot.querySelector(`[role="scrollbar"][aria-orientation="${axis}"]`);
    return {
      bar: bar && getComputedStyle(bar).visibility === 'visible' ? rect(bar) : null,
      chrome: rect(host.shadowRoot.querySelector('canvas.scriptoscope-chrome')),
      scroll: axis === 'vertical' ? content.scrollTop : content.scrollLeft,
      resized,
    };
  }, axis);
}

function zoneHit(page, x, y) {
  return page.evaluate(({ x, y }) => {
    const e = window.__growZone.host.shadowRoot.elementFromPoint(x, y);
    return e?.closest('[role="scrollbar"]') ? 'scrollbar' : e ? `${e.tagName.toLowerCase()}.${String(e.className).split(' ').join('.')}` : null;
  }, { x, y });
}

/** Click the end arrow of `axis` at `at` px from its far end and expect a scroll, not a resize. */
async function expectArrowScrolls(page, axis, at, label) {
  const before = await zoneState(page, axis);
  expect(before.bar, `${label}: visible ${axis} scrollbar`).not.toBeNull();
  const thickness = axis === 'vertical' ? before.bar.w : before.bar.h;
  const x = axis === 'vertical' ? before.bar.x + thickness / 2 : before.bar.r - at;
  const y = axis === 'vertical' ? before.bar.b - at : before.bar.y + thickness / 2;
  const hit = await zoneHit(page, x, y);
  await page.mouse.click(x, y);
  await page.waitForTimeout(150);
  const after = await zoneState(page, axis);
  const why = `${label}: click ${at} px from the ${axis} arrow's end (${x.toFixed(1)}, ${y.toFixed(1)}) hit ${hit}`;
  expect(hit, why).toBe('scrollbar');
  expect(after.scroll, `${why}: did not scroll`).toBeGreaterThan(before.scroll);
  expect(after.resized, `${why}: dispatched scriptoscope:userresize`).toBe(before.resized);
  expect(after.chrome, `${why}: window resized`).toEqual(before.chrome);
}

for (const mode of ['source', 'built']) {
  harnessTest(`${mode}: single-axis window scrollbar end arrows clear the resize zone (#524)`, async ({ page, servers }) => {
    await openHarness(page, servers, mode);
    // Thin frame + no grow box, thick frame + no grow box, thick bottom frame,
    // and the built-in grow box (procedural frame).
    for (const slug of ['windows-95', 'beos-r503', 'evolution', 'apple-platinum-2']) {
      for (const axis of ['vertical', 'horizontal']) {
        for (const scale of [1, 2]) {
          await addWindow(page, mode, slug, axis, scale);
          const label = `${slug} ${axis}-only scale ${scale}`;
          const { bar } = await zoneState(page, axis);
          const thickness = axis === 'vertical' ? bar.w : bar.h;
          await expectArrowScrolls(page, axis, 2, label);
          await page.evaluate(axis => { window.__growZone.content[axis === 'vertical' ? 'scrollTop' : 'scrollLeft'] = 0; }, axis);
          await expectArrowScrolls(page, axis, thickness / 2, label);
        }
      }
    }
  });
}

// Since #533 the resize button and scrollbars are kept across renders, so the
// corner rect must be re-applied on every render, not only when the controls
// are created. One live window is rethemed between a grow-box scheme and one
// without, and its scale is changed. Expected sizes are the reviewer's
// independent measurements of fresh windows (200 × 140 content, scale 1):
// the button is 22 × 22 on apple-platinum-2 and 21 × 40 on windows-95, and a
// single-axis bar stops 15 px short of the content corner. Scale 2 doubles.
const BUTTON = { 'apple-platinum-2': [22, 22], 'windows-95': [21, 40] };
const STEPS = [['apple-platinum-2', 1], ['windows-95', 1], ['windows-95', 2], ['apple-platinum-2', 2], ['apple-platinum-2', 1], ['windows-95', 1]];

for (const mode of ['source', 'built']) {
  harnessTest(`${mode}: retheme and rescale of a live window keep the resize zone and arrows in step (#524)`, async ({ page, servers }) => {
    await openHarness(page, servers, mode);
    for (const axis of ['vertical', 'horizontal']) {
      await addWindow(page, mode, STEPS[0][0], axis, STEPS[0][1]);
      await page.evaluate(() => { window.__growZone.corner = window.__growZone.host.shadowRoot.querySelector('button.scriptoscope-growbox'); });
      for (const [slug, scale] of STEPS) {
        await page.evaluate(async ({ mode, slug, scale }) => {
          const api = await import(mode === 'source' ? '/src/index.ts' : '/dist/scriptoscope.js');
          const { manager, host, content } = window.__growZone;
          // No public API changes a live window's scale; set the entry's
          // option (test-only) and let the retheme render apply it.
          manager.windows.find(w => w.host === host).opts.scale = scale;
          await manager.retheme(await api.loadTheme(`/themes/${slug}`));
          content.scrollTop = content.scrollLeft = 0;
          await new Promise(resolve => setTimeout(resolve, 300));
        }, { mode, slug, scale });
        const label = `${axis}-only after ${slug} scale ${scale}`;
        const state = await page.evaluate(() => {
          const { host, corner } = window.__growZone;
          const button = host.shadowRoot.querySelector('button.scriptoscope-growbox');
          const r = button.getBoundingClientRect();
          return { reused: button === corner, button: [r.width, r.height] };
        });
        expect(state.reused, `${label}: resize button reused`).toBe(true);
        expect(state.button, `${label}: resize button size`).toEqual(BUTTON[slug].map(n => n * scale));
        const { bar } = await zoneState(page, axis);
        expect(axis === 'vertical' ? bar.h : bar.w, `${label}: bar length`).toBe((axis === 'vertical' ? 125 : 185) * scale);
        const thickness = axis === 'vertical' ? bar.w : bar.h;
        await expectArrowScrolls(page, axis, 2, label);
        await page.evaluate(axis => { window.__growZone.content[axis === 'vertical' ? 'scrollTop' : 'scrollLeft'] = 0; }, axis);
        await expectArrowScrolls(page, axis, thickness / 2, label);
      }
    }
  });
}
