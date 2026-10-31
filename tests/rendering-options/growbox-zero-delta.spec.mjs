import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { test as demoTest } from './demo-fixtures.mjs';
import { expect } from '@playwright/test';
import { test as harnessTest, openHarness } from './fixtures.mjs';
import { pressAt, movePressed } from './subpixel-pointer.mjs';

// #552: like GrowWindow, a grow-box press that never changes the integer
// content size is no resize. A zero-movement press, or sub-pixel jitter
// (0.4 px, under the half-content-pixel rounding threshold), must leave the
// host in flow, insert no placeholder, keep its size, emit no
// scriptoscope:userresize and leave auto-fit on. A real drag still resizes
// and emits userresize exactly once.

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
const SLUGS = ['windows-95', 'beos-r503', 'apple-platinum-2'];

function snapshot(page) {
  return page.evaluate(sel => {
    const host = document.querySelector(sel);
    const rect = e => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; };
    const corner = host.shadowRoot.querySelector('button.scriptoscope-growbox');
    return {
      position: getComputedStyle(host).position,
      styleWidth: host.style.width, styleHeight: host.style.height,
      host: rect(host),
      chrome: rect(host.shadowRoot.querySelector('canvas.scriptoscope-chrome')),
      corner: rect(corner),
      placeholders: document.querySelectorAll('[data-scriptoscope-placeholder]').length,
      outlines: host.querySelectorAll(':scope > div[style*="dotted"]').length,
      userResize: window.__userResize.length,
    };
  }, PICKER);
}

async function settled(page) {
  let prev = '';
  await expect.poll(async () => {
    const s = JSON.stringify(await snapshot(page)); const stable = s === prev; prev = s; return stable;
  }, { intervals: [250] }).toBe(true);
  return snapshot(page);
}

async function openShowcase(page, url, slug) {
  await page.addInitScript(() => {
    window.__userResize = [];
    window.addEventListener('scriptoscope:userresize', e => window.__userResize.push(e.detail), true);
  });
  await page.goto(`${url}/showcase.html?theme=${slug}`);
  await expect(page.locator('#powers.scriptoscope-ready')).toBeVisible();
  const host = page.locator(`${PICKER}[data-scriptoscope-theme="${slug}"]`);
  await expect(host).toHaveCount(1);
  await host.scrollIntoViewIfNeeded();
  return settled(page);
}

/** Press the grow box at its centre, optionally jitter by `jitter` px, release. */
async function press(page, corner, jitter = 0) {
  const p = { x: corner.x + corner.w / 2, y: corner.y + corner.h / 2 };
  await pressAt(page, p);
  // Sub-pixel moves need a mouse that keeps fractional clientX; elsewhere they are the
  // pressed pointer's own PointerEvents (#588, subpixel-pointer.mjs).
  if (jitter) await movePressed(page, p, [[jitter, jitter], [-jitter, 0]]);
  await page.mouse.up();
  await page.waitForTimeout(300);
}

function expectUnchanged(after, before, why) {
  expect.soft(after.userResize, `${why}: dispatched scriptoscope:userresize`).toBe(before.userResize);
  expect.soft(after.position, `${why}: in-flow host handed off`).toBe(before.position);
  expect.soft(after.placeholders, `${why}: placeholder inserted`).toBe(before.placeholders);
  expect.soft(after.outlines, `${why}: ghost outline left behind`).toBe(0);
  expect.soft({ w: after.host.w, h: after.host.h, x: after.host.x, y: after.host.y }, `${why}: host box changed`)
    .toEqual({ w: before.host.w, h: before.host.h, x: before.host.x, y: before.host.y });
  expect.soft(after.chrome, `${why}: chrome changed`).toEqual(before.chrome);
  expect.soft([after.styleWidth, after.styleHeight], `${why}: host inline size changed`).toEqual([before.styleWidth, before.styleHeight]);
}

for (const mode of ['source', 'production']) {
  for (const slug of SLUGS) {
    test(`${mode}: ${slug} showcase grow-box press without movement or with 0.4 px jitter is no resize (#552)`, async ({ page, demo, production }) => {
      const before = await openShowcase(page, mode === 'source' ? demo : production, slug);
      expect(before.position, 'picker starts in flow').toBe('static');
      expect(before.userResize).toBe(0);

      await press(page, before.corner);
      const zero = await snapshot(page);
      expectUnchanged(zero, before, `${slug} zero-movement press`);

      await press(page, before.corner, 0.4);
      const jitter = await snapshot(page);
      expectUnchanged(jitter, before, `${slug} 0.4 px jitter press`);

      expect.soft(jitter.userResize).toBe(0);
    });

    test(`${mode}: ${slug} showcase grow-box drag resizes and emits userresize once (#552)`, async ({ page, demo, production }) => {
      const before = await openShowcase(page, mode === 'source' ? demo : production, slug);
      const x = before.corner.x + before.corner.w / 2, y = before.corner.y + before.corner.h / 2;
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(x - 20, y + 15, { steps: 4 });
      await page.mouse.move(x - 40, y + 30, { steps: 4 });
      await page.mouse.up();
      const after = await settled(page);
      expect(after.userResize, `${slug}: userresize count`).toBe(1);
      expect(after.position).toBe('absolute');
      expect(after.placeholders).toBe(before.placeholders + 1);
      expect(Math.round(after.chrome.h - before.chrome.h)).toBe(30);
      expect(Math.round(after.chrome.w - before.chrome.w)).toBe(-40);
    });
  }
}

// Imperative windows (harness page, source and built runtime). manager.add
// places them absolutely; scale 2 doubles the rounding threshold.
async function addWindow(page, mode, slug, scale, height = 140) {
  return page.evaluate(async ({ mode, slug, scale, height }) => {
    const api = await import(mode === 'source' ? '/src/index.ts' : '/dist/scriptoscope.js');
    if (window.__zd) { window.__zd.manager.remove(window.__zd.host); window.__zd.host.remove(); }
    const theme = await api.loadTheme(`/themes/${slug}`);
    const manager = new api.WindowManager();
    const content = document.createElement('div');
    content.textContent = 'Zero delta';
    const host = await manager.add(theme, { title: 'Grow', width: 200, height, scale }, {}, { contentEl: content });
    document.body.prepend(host);
    host.style.zIndex = '1000';
    window.__zd = { manager, host, resized: [], changes: 0 };
    manager.onChange = () => window.__zd.changes++;
    host.addEventListener('scriptoscope:userresize', e => window.__zd.resized.push(e.detail));
    await new Promise(resolve => setTimeout(resolve, 300));
  }, { mode, slug, scale, height });
}

function state(page) {
  return page.evaluate(() => {
    const { host, resized, changes } = window.__zd;
    const r = host.getBoundingClientRect();
    const c = host.shadowRoot.querySelector('button.scriptoscope-growbox').getBoundingClientRect();
    return {
      position: getComputedStyle(host).position, host: { x: r.x, y: r.y, w: r.width, h: r.height },
      corner: { x: c.x, y: c.y, w: c.width, h: c.height },
      placeholders: document.querySelectorAll('[data-scriptoscope-placeholder]').length,
      resized: resized.length, detail: resized.at(-1) ?? null, changes,
    };
  });
}

for (const mode of ['source', 'built']) {
  harnessTest(`${mode}: imperative grow-box press without movement is no resize; a drag resizes once (#552)`, async ({ page, servers }) => {
    await openHarness(page, servers, mode);
    for (const slug of SLUGS) {
      for (const scale of [1, 2]) {
        const label = `${slug} scale ${scale}`;
        await addWindow(page, mode, slug, scale);
        const before = await state(page);
        for (const jitter of [0, 0.4]) {
          await press(page, before.corner, jitter);
          const after = await state(page);
          const why = `${label} ${jitter ? `${jitter} px jitter` : 'zero-movement'} press`;
          expect.soft(after.resized, `${why}: userresize`).toBe(0);
          expect.soft(after.position, `${why}: position`).toBe(before.position);
          expect.soft(after.placeholders, `${why}: placeholder`).toBe(before.placeholders);
          expect.soft(after.host, `${why}: host box`).toEqual(before.host);
          expect.soft(after.changes, `${why}: onChange`).toBe(0);
        }
        const x = before.corner.x + before.corner.w / 2, y = before.corner.y + before.corner.h / 2;
        // 0.6 content px rounds to 1: just over the threshold, so it is a resize.
        await pressAt(page, { x, y });
        await movePressed(page, { x, y }, [[0.6 * scale, 0]]);
        await page.mouse.up();
        await page.waitForTimeout(300);
        const nudged = await state(page);
        expect.soft(nudged.resized, `${label}: 0.6 x scale move userresize count`).toBe(1);
        expect.soft(nudged.detail, `${label}: 0.6 x scale move content size`).toEqual({ w: 201, h: 140 });
        await addWindow(page, mode, slug, scale);
        await page.mouse.move(x, y);
        await page.mouse.down();
        await page.mouse.move(x + 15 * scale, y + 10 * scale, { steps: 3 });
        await page.mouse.move(x + 30 * scale, y + 20 * scale, { steps: 3 });
        await page.mouse.up();
        await page.waitForTimeout(300);
        const dragged = await state(page);
        expect(dragged.resized, `${label}: drag userresize count`).toBe(1);
        expect(dragged.detail, `${label}: drag content size`).toEqual({ w: 230, h: 160 });
        expect(Math.round(dragged.host.w - before.host.w)).toBe(30 * scale);
        expect(Math.round(dragged.host.h - before.host.h)).toBe(20 * scale);
      }
    }
  });

  harnessTest(`${mode}: dragging inward at the minimum size is no resize (#552)`, async ({ page, servers }) => {
    await openHarness(page, servers, mode);
    for (const slug of SLUGS) {
      await addWindow(page, mode, slug, 1);
      // At the minimum content height, then back in flow so a handoff is observable.
      await page.evaluate(async () => {
        const { host, manager } = window.__zd;
        await manager.setContentSize(host, 200, 40);
        host.style.position = 'static'; host.style.left = host.style.top = '';
        window.__zd.changes = 0;
        await new Promise(resolve => setTimeout(resolve, 200));
      });
      const before = await state(page);
      expect(before.position, `${slug}: in flow`).toBe('static');
      const x = before.corner.x + before.corner.w / 2, y = before.corner.y + before.corner.h / 2;
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(x, y - 10, { steps: 2 });
      await page.mouse.move(x, y - 20, { steps: 2 });
      await page.mouse.up();
      await page.waitForTimeout(300);
      const after = await state(page);
      expect.soft(after.resized, `${slug}: userresize`).toBe(0);
      expect.soft(after.position, `${slug}: handed off`).toBe('static');
      expect.soft(after.placeholders, `${slug}: placeholder`).toBe(before.placeholders);
      expect.soft(after.host, `${slug}: host box`).toEqual(before.host);
    }
  });

  harnessTest(`${mode}: a window declared below the minimum is not snapped up by the pointer (#552)`, async ({ page, servers }) => {
    await openHarness(page, servers, mode);
    for (const scale of [1, 2]) {
      const label = `height 30 scale ${scale}`;
      await addWindow(page, mode, 'windows-95', scale, 30);
      const height = () => page.evaluate(() => window.__zd.manager.windows.find(w => w.host === window.__zd.host).opts.height);
      expect(await height(), `${label}: declared height`).toBe(30);
      const before = await state(page);
      const x = before.corner.x + before.corner.w / 2, y = before.corner.y + before.corner.h / 2;
      const drag = async (dy, subpixel = false) => {
        if (subpixel) {
          await pressAt(page, { x, y });
          await movePressed(page, { x, y }, [[0, dy / 2], [0, dy]]);
        } else {
          await page.mouse.move(x, y);
          await page.mouse.down();
          await page.mouse.move(x, y + dy / 2);
          await page.mouse.move(x, y + dy);
        }
        await page.mouse.up();
        await page.waitForTimeout(300);
      };
      await drag(0.4 * scale, true);
      expect.soft((await state(page)).resized, `${label}: 0.4 x scale jitter userresize`).toBe(0);
      expect.soft(await height(), `${label}: height after jitter`).toBe(30);
      await drag(-10 * scale);
      expect.soft((await state(page)).resized, `${label}: inward drag userresize`).toBe(0);
      expect.soft(await height(), `${label}: height after inward drag`).toBe(30);
      await drag(5 * scale);
      const after = await state(page);
      expect.soft(after.resized, `${label}: outward drag userresize count`).toBe(1);
      expect.soft(after.detail?.h, `${label}: outward drag height`).toBe(35);
      expect.soft(await height(), `${label}: height after outward drag`).toBe(35);
    }
  });

  harnessTest(`${mode}: keyboard grow clamped at the minimum is no resize (#552)`, async ({ page, servers }) => {
    await openHarness(page, servers, mode);
    await addWindow(page, mode, 'windows-95', 1);
    const result = await page.evaluate(async () => {
      const { host, manager } = window.__zd;
      const corner = host.shadowRoot.querySelector('button.scriptoscope-growbox');
      // Shrink to the minimum height, then one more step is clamped (no change).
      manager.windows.find(w => w.host === host).opts.height = 40;
      corner.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
      await new Promise(resolve => setTimeout(resolve, 200));
      return { resized: window.__zd.resized.length, changes: window.__zd.changes };
    });
    expect(result).toEqual({ resized: 0, changes: 0 });
  });
}

// Declarative in-flow window with no declared size (harness page): the
// Posture-B handoff and the auto-fit latch are both observable. After a
// zero-movement or jitter press, later content growth must still auto-fit.
const SOURCE = `<article data-scriptoscope-window data-scriptoscope-title="Grow box">
  <p>Press the grow box without moving.</p>
</article>`;

for (const mode of ['source', 'built']) {
  for (const slug of SLUGS) {
    harnessTest(`${mode}: ${slug} declarative grow-box press without movement keeps flow and auto-fit (#552)`, async ({ page, servers }) => {
      await openHarness(page, servers, mode);
      const read = () => page.evaluate(() => {
        const { host, resized } = window.__zdd;
        const r = host.getBoundingClientRect();
        const c = host.shadowRoot.querySelector('button.scriptoscope-growbox').getBoundingClientRect();
        return { position: getComputedStyle(host).position, host: { x: r.x, y: r.y, w: r.width, h: r.height },
          corner: { x: c.x, y: c.y, w: c.width, h: c.height },
          placeholders: document.querySelectorAll('[data-scriptoscope-placeholder]').length, resized: resized.length };
      });
      const settle = () => page.evaluate(async () => {
        await new Promise(r => setTimeout(r, 400));
        for (let i = 0; i < 3; i++) await new Promise(r => requestAnimationFrame(r));
      });
      await page.evaluate(async ({ mode, slug, source }) => {
        const api = await import(mode === 'source' ? '/src/index.ts' : '/dist/scriptoscope.js');
        const declarative = await import(mode === 'source' ? '/src/declarative/index.ts' : '/dist/declarative.js');
        const container = document.createElement('div');
        container.style.cssText = 'width: 560px; margin: 24px;';
        container.innerHTML = source;
        document.body.prepend(container);
        const manager = new api.WindowManager();
        const win = await declarative.ScriptoscopeWindow.promote(container.querySelector('[data-scriptoscope-window]'),
          { manager, theme: await api.loadTheme(`/themes/${slug}`) });
        window.__zdd = { win, host: win.host, resized: [] };
        win.host.addEventListener('scriptoscope:userresize', e => window.__zdd.resized.push(e.detail));
      }, { mode, slug, source: SOURCE });
      await settle();
      const before = await read();
      expect(before.position, `${slug}: starts in flow`).toBe('static');
      for (const jitter of [0, 0.4]) {
        await press(page, before.corner, jitter);
        await settle();
        const after = await read();
        const why = `${slug} ${jitter ? `${jitter} px jitter` : 'zero-movement'} press`;
        expect.soft(after.resized, `${why}: userresize`).toBe(0);
        expect.soft(after.position, `${why}: handed off`).toBe('static');
        expect.soft(after.placeholders, `${why}: placeholder`).toBe(before.placeholders);
        expect.soft(after.host, `${why}: host box`).toEqual(before.host);
      }
      await page.evaluate(() => {
        window.__zdd.host.querySelector('p').insertAdjacentHTML('afterend', `<p>${'Content added after the press. '.repeat(30)}</p>`);
      });
      await settle();
      const grown = await read();
      expect(grown.host.h, `${slug}: content growth no longer auto-fits after the press`).toBeGreaterThan(before.host.h + 30);
      expect(grown.resized).toBe(0);
    });
  }
}
