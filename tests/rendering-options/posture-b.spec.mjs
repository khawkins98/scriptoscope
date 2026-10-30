import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { expect } from '@playwright/test';
import { test as demoTest } from './demo-fixtures.mjs';

// Posture B on the real showcase page (#536): in-flow by default, consumer
// position CSS respected, real-pointer drag hands off to absolute behind a
// chrome-sized placeholder, no ancestor min-height pin, px caps bound the
// OUTER chrome (#541), and the picker's No theme -> remount -> retheme chain
// repaints. Runs against the Vite demo (source) and dist/demo (built).
//
// The showcase's opt-in card cascade (`data-scriptoscope-cascade`, demo
// consumer code) places the four cards absolutely, so the in-flow checks use
// the Schemes Folder, Controls and "Use it on your page" windows.

const SLUG = '1138';
const IN_FLOW = { '.powers-picker': 'static', '.powers-hero-window': 'relative', '.powers-install-host': 'static' };

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
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    try { await use(`http://127.0.0.1:${server.address().port}/scriptoscope`); }
    finally { await new Promise(r => server.close(r)); }
  }, { scope: 'worker' }],
});

/** Every promoted host's box, for settle detection. */
const boxes = page => page.evaluate(() => [...document.querySelectorAll('#powers [data-scriptoscope-window-host]')]
  .map(h => { const r = h.getBoundingClientRect(); return [r.x, r.y, r.width, r.height].map(Math.round).join(','); }).join(';'));

async function openShowcase(page, base, slug = SLUG) {
  await page.setViewportSize({ width: 1280, height: 960 });
  await page.goto(`${base}/showcase.html?theme=${slug}`);
  await expect(page.locator('#powers.scriptoscope-ready')).toBeVisible();
  await expect(page.locator('#powers .scriptoscope-theme-picker-tile')).toHaveCount(18);
  // Content-fit and the cascade may adjust boxes after ready: wait for two equal reads a frame pair apart.
  await expect.poll(async () => {
    const a = await boxes(page);
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    return a !== '' && a === await boxes(page);
  }, { timeout: 10_000 }).toBe(true);
}

/** Host box, its chrome canvas box (the outer chrome), and position styles. */
const geometry = (page, selector) => page.locator(selector).first().evaluate(h => {
  const box = el => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; };
  const canvas = h.shadowRoot?.querySelector('canvas.scriptoscope-chrome');
  return { inline: h.style.position, left: h.style.left, top: h.style.top, computed: getComputedStyle(h).position,
    host: box(h), canvas: canvas ? box(canvas) : null };
});

function expectSameBox(a, b, why, tol = 1) {
  for (const k of ['x', 'y', 'width', 'height']) expect.soft(Math.abs(a[k] - b[k]), `${why}: ${k} ${a[k]} vs ${b[k]}`).toBeLessThanOrEqual(tol);
}

for (const mode of ['source', 'built']) {
  const baseOf = ({ demo, production }) => (mode === 'source' ? demo : production);

  test(`${mode}: showcase in-flow hosts keep consumer position, no ancestor pin, px caps bound the outer chrome (#536)`, async ({ page, demo, production }) => {
    await openShowcase(page, baseOf({ demo, production }));
    for (const [selector, consumerPosition] of Object.entries(IN_FLOW)) {
      const g = await geometry(page, selector);
      expect.soft(g.canvas, `${selector}: promoted with chrome`).not.toBeNull();
      // 0652704: inline position must be cleared so consumer-class CSS wins (Controls has `position: relative`).
      expect.soft(g.inline, `${selector}: inline position cleared`).toBe('');
      expect.soft(g.computed, `${selector}: consumer position respected`).toBe(consumerPosition);
      if (g.canvas) expectSameBox(g.host, g.canvas, `${selector}: host == outer chrome (#541)`);
    }
    // cf267ac removed the scanner's ancestor min-height pin; in-flow hosts size their parents naturally.
    for (const selector of ['.powers-inner', '.powers-picker-host', '.powers-tools-row']) {
      expect.soft(await page.locator(selector).evaluate(el => el.style.minHeight), `${selector}: no inline min-height pin`).toBe('');
    }
    // ba984fe / #541: the heavy cards' `max-height: 280px` bounds the painted chrome, and host == chrome.
    const heavy = page.locator('.powers-card-row.heavy .powers-card');
    await expect(heavy).toHaveCount(2);
    for (let i = 0; i < 2; i++) {
      const g = await heavy.nth(i).evaluate(h => {
        const r = h.getBoundingClientRect(), c = h.shadowRoot.querySelector('canvas.scriptoscope-chrome').getBoundingClientRect();
        return { host: { x: r.x, y: r.y, width: r.width, height: r.height }, canvas: { x: c.x, y: c.y, width: c.width, height: c.height } };
      });
      expect.soft(g.canvas.height, `heavy card ${i}: chrome height within its 280px cap`).toBeLessThanOrEqual(281);
      expectSameBox(g.host, g.canvas, `heavy card ${i}: host == outer chrome`);
    }
  });

  test(`${mode}: a real pointer drag hands an in-flow host off to absolute behind a chrome-sized placeholder (#536)`, async ({ page, demo, production }) => {
    await openShowcase(page, baseOf({ demo, production }));
    const selector = '.powers-hero-window';
    const host = page.locator(selector);
    await host.scrollIntoViewIfNeeded();
    const neighbours = () => page.evaluate(() => Object.fromEntries(['.powers-install-host', '#examples'].map(s => {
      const r = document.querySelector(s).getBoundingClientRect(); return [s, { x: r.x, y: r.y }];
    })));
    const before = await geometry(page, selector);
    const sideBefore = await neighbours();
    expect(before.inline, 'Controls starts in flow').toBe('');
    expect(await page.locator('[data-scriptoscope-placeholder]').count(), 'no placeholder before the drag').toBe(0);
    // Grab the move handle (the title-bar drag region) at its centre, clear of the title widgets.
    const grip = await host.evaluate(h => {
      const r = h.shadowRoot.querySelector('.scriptoscope-movehandle').getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    await page.mouse.move(grip.x, grip.y);
    await page.mouse.down();
    await page.mouse.move(grip.x + 30, grip.y + 60, { steps: 6 });
    await page.mouse.up();
    const after = await geometry(page, selector);
    // Fires the WindowManager pointer handler: a style poke would not move the painted chrome.
    expect(after.inline, 'host is absolute after the drag').toBe('absolute');
    expect(after.left, 'left committed').not.toBe('');
    expect(after.top, 'top committed').not.toBe('');
    expect(Math.round(after.canvas.x - before.canvas.x), 'chrome followed the pointer in x').toBe(30);
    expect(Math.round(after.canvas.y - before.canvas.y), 'chrome followed the pointer in y').toBe(60);
    expectSameBox(after.host, after.canvas, 'dragged host == outer chrome');
    // The vacated grid cell is reserved: the sibling window and the section below stay put.
    const sideAfter = await neighbours();
    for (const [s, p] of Object.entries(sideBefore)) {
      expect.soft(Math.abs(sideAfter[s].x - p.x) + Math.abs(sideAfter[s].y - p.y), `${s} did not move on drag-start`).toBeLessThanOrEqual(1);
    }
    const placeholders = await page.locator('[data-scriptoscope-placeholder]').evaluateAll(els => els.map(el => {
      const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, next: el.nextElementSibling?.className ?? null };
    }));
    expect(placeholders, 'exactly one placeholder, in the host\'s old slot').toHaveLength(1);
    expect(placeholders[0].next, 'placeholder sits immediately before the host').toBe(await host.evaluate(h => h.className));
    // #541: the placeholder is chrome-sized, at the host's old static position.
    expectSameBox(placeholders[0], before.canvas, 'placeholder == pre-drag outer chrome');
  });

  test(`${mode}: picker No theme -> tile remount -> second tile repaints every window (#536)`, async ({ page, demo, production }) => {
    await openShowcase(page, baseOf({ demo, production }));
    const chrome = () => page.locator('.powers-install-host').evaluate(h => {
      const c = h.shadowRoot?.querySelector('canvas.scriptoscope-chrome');
      return c ? { theme: h.dataset.scriptoscopeTheme, pixels: c.toDataURL() } : null;
    });
    await page.locator('[data-special="none"]').click();
    await expect(page.locator('#powers [data-scriptoscope-window-host]')).toHaveCount(0);
    await expect(page.locator('.scriptoscope-theme-picker-tile')).toHaveCount(18);
    // OFF-mode tile click remounts (the demo's capture listener).
    await page.locator('.scriptoscope-theme-picker-tile[data-slug="windows-31"]').click();
    await expect(page.locator('#powers.scriptoscope-ready')).toBeVisible();
    await expect.poll(async () => (await chrome())?.theme, 'remounted on windows-31').toBe('windows-31');
    const win31 = await chrome();
    // The 2026-05-31 half-stuck bug: after a remount, tile handlers closed over the dead mount,
    // so the URL and active tile changed but the chrome never repainted.
    await page.locator('.scriptoscope-theme-picker-tile[data-slug="evolution"]').click();
    await expect.poll(async () => (await chrome())?.theme, 'rethemed to evolution').toBe('evolution');
    await expect.poll(async () => (await chrome())?.pixels !== win31.pixels, 'chrome repainted after the second tile click').toBe(true);
    await expect(page.locator('#powers [data-scriptoscope-window-host]:not([data-scriptoscope-theme="evolution"])')).toHaveCount(0);
  });
}

// 0652704: persistence wrote (0,0) for in-flow hosts, so a reload yanked every window to the
// origin. Persistence now lives in the demo's consumer layout layer (#491), so this drives
// mountExplicitPage with persistKey in source mode (it is demo code, not a runtime export).
const LAYOUT_KEY = 'posture-b-roundtrip';
async function openPersisted(page, demo) {
  await page.setViewportSize({ width: 1280, height: 960 });
  await page.goto(`${demo}/install.html`);
  await page.evaluate(k => localStorage.removeItem(`scriptoscope:layout:${k}`), LAYOUT_KEY);
}
const TWO_IN_FLOW = '<article data-scriptoscope-window data-scriptoscope-window-id="a" data-scriptoscope-title="A">In flow A</article>'
  + '<article data-scriptoscope-window data-scriptoscope-window-id="b" data-scriptoscope-title="B">In flow B</article>';
const mountPersisted = (page, { html = TWO_IN_FLOW, theme = 'windows-95', width = 600 } = {}) => page.evaluate(async ({ key, html, theme, width }) => {
  const { mountExplicitPage } = await import('/explicit-host.mjs');
  const root = document.createElement('section');
  root.id = 'pb-root';
  root.style.cssText = `position:relative;width:${width}px;margin:40px`;
  root.innerHTML = html;
  document.body.prepend(root);
  window.__pb = await mountExplicitPage({ root, themeBaseUrl: '/themes', pageThemeDefault: theme, themes: [], bootAffordance: false, persistKey: key });
}, { key: LAYOUT_KEY, html, theme, width });
const persisted = page => page.evaluate(key => ({
  stored: JSON.parse(localStorage.getItem(`scriptoscope:layout:${key}`) ?? 'null'),
  hosts: [...document.querySelectorAll('#pb-root [data-scriptoscope-window-host]')].map(h => {
    const r = h.getBoundingClientRect();
    return { inline: h.style.position, left: h.style.left, top: h.style.top, x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) };
  }),
}), LAYOUT_KEY);
async function reloadPersisted(page, mount = {}) {
  await page.reload();
  await mountPersisted(page, mount);
  const count = (mount.html ?? TWO_IN_FLOW).match(/data-scriptoscope-window /g).length;
  await expect.poll(async () => (await persisted(page)).hosts.length).toBe(count);
  return persisted(page);
}
/** Each window's content box (its light-DOM slot) and frame extent (chrome canvas minus slot). */
const described = page => page.evaluate(() => [...document.querySelectorAll('#pb-root [data-scriptoscope-window-host]')].map(host => {
  const slot = host.querySelector(':scope > .scriptoscope-slot').getBoundingClientRect();
  const chrome = host.shadowRoot.querySelector('canvas.scriptoscope-chrome').getBoundingClientRect();
  return { width: Math.round(slot.width), height: Math.round(slot.height), ext: { x: Math.round(chrome.width - slot.width), y: Math.round(chrome.height - slot.height) } };
}));

test('source: persistKey round trip keeps in-flow windows in flow and restores a dragged one as absolute (#536)', async ({ page, demo }) => {
  await openPersisted(page, demo);
  await mountPersisted(page);
  await expect.poll(async () => (await persisted(page)).stored?.windows?.b, 'layout written after the first render').toBeTruthy();
  const first = await persisted(page);
  expect(first.hosts.map(h => h.inline), 'both windows start in flow').toEqual(['', '']);
  for (const id of ['a', 'b']) {
    expect(first.stored.windows[id].x, `in-flow ${id}: no persisted x`).toBeUndefined();
    expect(first.stored.windows[id].y, `in-flow ${id}: no persisted y`).toBeUndefined();
  }
  // Reload: both stay in flow (no origin yank). A's slot is unaffected by any size change.
  const reloaded = await reloadPersisted(page);
  expect(reloaded.hosts.map(h => h.inline), 'still in flow after reload').toEqual(['', '']);
  expect([reloaded.hosts[0].x, reloaded.hosts[0].y], 'A at its flow position').toEqual([first.hosts[0].x, first.hosts[0].y]);
  expect(reloaded.hosts[1].x, 'B at its flow column').toBe(first.hosts[1].x);
  expect(reloaded.hosts[1].y, 'B directly below A, not at the origin').toBe(reloaded.hosts[0].y + reloaded.hosts[0].height);

  // Drag B: it becomes absolute; its position persists and restores as absolute.
  const grip = await page.locator('#pb-root [data-scriptoscope-window-host]').nth(1).evaluate(h => {
    const r = h.shadowRoot.querySelector('.scriptoscope-movehandle').getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  await page.mouse.move(grip.x, grip.y);
  await page.mouse.down();
  await page.mouse.move(grip.x + 40, grip.y + 50, { steps: 5 });
  await page.mouse.up();
  await expect.poll(async () => Number.isFinite((await persisted(page)).stored?.windows?.b?.x), 'dragged position persisted').toBe(true);
  const dragged = await persisted(page);
  expect(dragged.hosts[1].inline).toBe('absolute');
  expect(dragged.stored.windows.a.x, 'A is still in flow, no x persisted').toBeUndefined();
  const restored = await reloadPersisted(page);
  expect(restored.hosts.map(h => h.inline), 'A in flow, B restored absolute').toEqual(['', 'absolute']);
  expect([restored.hosts[1].left, restored.hosts[1].top], 'B restored at its dragged position').toEqual([dragged.hosts[1].left, dragged.hosts[1].top]);
  expect([restored.hosts[0].x, restored.hosts[0].y], 'A unmoved').toEqual([first.hosts[0].x, first.hosts[0].y]);
});

// #558: the layout layer persists an auto-sized window's CONTENT size and restores it as a
// declared size. ScriptoscopeWindow's 40 px outer floor (MIN_H) used to be applied to it as if
// it were outer, so a 30 px content area came back as 40 px and every reload grew short windows.
test('source: persistKey reload keeps in-flow window sizes (#558)', async ({ page, demo }) => {
  await openPersisted(page, demo);
  await mountPersisted(page);
  await expect.poll(async () => (await persisted(page)).stored?.windows?.b, 'layout written after the first render').toBeTruthy();
  const first = await persisted(page);
  const reloaded = await reloadPersisted(page);
  expect(reloaded.hosts.map(h => [h.width, h.height]), 'reload restores the same window boxes').toEqual(first.hosts.map(h => [h.width, h.height]));
});

// #558, width and declared cases: a window in a 70 px column is raised to the 80 px OUTER floor
// and persists a content width below 80; a declared 60x20 content window persists below both
// floors. Reload must restore the same content and outer sizes, not re-floor them as outer.
test('source: persistKey reload keeps small declared and floored sizes (#558)', async ({ page, demo }) => {
  const mount = {
    width: 70,
    html: '<article data-scriptoscope-window data-scriptoscope-window-id="narrow" data-scriptoscope-title="N">n</article>'
      + '<article data-scriptoscope-window data-scriptoscope-window-id="small" data-scriptoscope-width="60" data-scriptoscope-height="20" data-scriptoscope-title="S">s</article>',
  };
  await openPersisted(page, demo);
  await mountPersisted(page, mount);
  await expect.poll(async () => (await persisted(page)).stored?.windows?.small, 'layout written after the first render').toBeTruthy();
  const first = await persisted(page);
  const firstState = await described(page);
  expect(first.hosts[0].width, 'narrow window raised to the 80 px outer floor').toBe(80);
  expect([firstState[1].width, firstState[1].height], 'declared content size kept').toEqual([60, 20]);
  const reloaded = await reloadPersisted(page, mount);
  expect(reloaded.hosts.map(h => [h.width, h.height]), 'reload restores the same window boxes').toEqual(first.hosts.map(h => [h.width, h.height]));
  expect((await described(page)).map(s => [s.width, s.height]), 'reload restores the same content sizes').toEqual(firstState.map(s => [s.width, s.height]));
});

// #558 / #542: a reload restores the saved OUTER width (`ow`) the way the cross-tab restore
// does, so a layout saved under a thin frame and reloaded under a thicker one keeps its
// footprint. Height stays a content size (flow absorbs it), matching the cross-tab path.
test('source: persistKey reload under a thicker scheme keeps the saved outer width (#558)', async ({ page, demo }) => {
  const mount = { html: TWO_IN_FLOW, width: 400 };
  await openPersisted(page, demo);
  await mountPersisted(page, { ...mount, theme: 'apple-lisa' });
  await expect.poll(async () => (await persisted(page)).stored?.windows?.b, 'layout written after the first render').toBeTruthy();
  const first = await persisted(page);
  const firstState = await described(page);
  const reloaded = await reloadPersisted(page, { ...mount, theme: 'dolphin-som' });
  const state = await described(page);
  expect(state[0].ext.x, 'dolphin-som has a different side frame than apple-lisa').not.toBe(firstState[0].ext.x);
  await expect.poll(async () => (await persisted(page)).hosts.map(h => h.width), 'saved outer widths restored').toEqual(first.hosts.map(h => h.width));
  expect((await described(page)).map(s => s.height), 'content heights restored').toEqual(firstState.map(s => s.height));
  expect(reloaded.hosts.map(h => h.inline), 'still in flow').toEqual(['', '']);
});
