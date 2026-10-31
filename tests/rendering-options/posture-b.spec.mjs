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

// #578: layout writes are debounced 250 ms. A reload inside that window used to drop the drag's
// commit and restore an older snapshot (in the flake, one taken mid-drag from the hot loop's
// left/top, so B came back short of where it was dropped). The layer now flushes on pagehide,
// so reloading straight after pointerup, with no wait for the write, must restore the drop.
test('source: persistKey reload straight after a drag restores the dropped position (#578)', async ({ page, demo }) => {
  await openPersisted(page, demo);
  await mountPersisted(page);
  await expect.poll(async () => (await persisted(page)).stored?.windows?.b, 'layout written after the first render').toBeTruthy();
  const grip = await page.locator('#pb-root [data-scriptoscope-window-host]').nth(1).evaluate(h => {
    const r = h.shadowRoot.querySelector('.scriptoscope-movehandle').getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  await page.mouse.move(grip.x, grip.y);
  await page.mouse.down();
  await page.mouse.move(grip.x + 40, grip.y + 50, { steps: 5 });
  await page.mouse.up();
  const dropped = (await persisted(page)).hosts[1];
  expect(dropped.inline).toBe('absolute');
  const restored = await reloadPersisted(page);
  expect(restored.hosts[1].inline, 'B restored absolute').toBe('absolute');
  expect([restored.hosts[1].left, restored.hosts[1].top], 'B restored where it was dropped').toEqual([dropped.left, dropped.top]);
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

// #581: pressing a background window's frame activates it, and the activation render schedules a
// debounced layout write. A drag held past the 250 ms debounce used to snapshot the hot loop's
// mid-drag left/top. Pointerup's commit replaced it, but a cancelled drag commits nothing (#563),
// so the mid-drag position stayed persisted and reached other tabs through the storage event.
// While the window holds a pointer capture the layer now saves the position it had when the
// capture began, and the capture's end schedules a fresh write.
const TWO_PLACED = '<article data-scriptoscope-window data-scriptoscope-window-id="a" data-scriptoscope-x="0" data-scriptoscope-y="0" data-scriptoscope-width="200" data-scriptoscope-height="80" data-scriptoscope-title="A">Placed A</article>'
  + '<article data-scriptoscope-window data-scriptoscope-window-id="b" data-scriptoscope-x="300" data-scriptoscope-y="0" data-scriptoscope-width="200" data-scriptoscope-height="80" data-scriptoscope-title="B">Placed B</article>';
/** A second page in the same context: shares localStorage, so it receives the storage events. */
async function openWatcher(page, demo) {
  const other = await page.context().newPage();
  await other.setViewportSize({ width: 1280, height: 960 });
  await other.goto(`${demo}/install.html`);
  await mountPersisted(other, { html: TWO_PLACED });
  await expect.poll(async () => (await persisted(other)).hosts.length).toBe(2);
  // Every value of A's position that this page received from another tab.
  await other.evaluate(key => {
    window.__seen = [];
    addEventListener('storage', e => { if (e.key === `scriptoscope:layout:${key}`) { const a = JSON.parse(e.newValue ?? 'null')?.windows?.a; window.__seen.push(a && [a.x, a.y]); } });
  }, LAYOUT_KEY);
  return other;
}
/** Press A's move handle while B is the active window, move it, and hold until a write lands. */
async function pressBackgroundA(page) {
  const hosts = page.locator('#pb-root [data-scriptoscope-window-host]');
  const clear = () => page.evaluate(key => localStorage.removeItem(`scriptoscope:layout:${key}`), LAYOUT_KEY);
  // Activate B and wait for that write, then clear the key so the next write is the drag's own.
  await clear();
  await hosts.nth(1).locator('.scriptoscope-slot').click();
  await expect.poll(async () => { const w = (await persisted(page)).stored?.windows; return w && w.b.z > w.a.z; }, 'B activated and saved in front').toBe(true);
  await clear();
  const before = (await persisted(page)).hosts[0];
  const grip = await hosts.first().evaluate(h => {
    const r = h.shadowRoot.querySelector('.scriptoscope-movehandle').getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  await page.evaluate(() => addEventListener('pointerdown', e => { window.__pid = e.pointerId; }, { capture: true, once: true }));
  await page.mouse.move(grip.x, grip.y);
  await page.mouse.down();
  await page.mouse.move(grip.x + 40, grip.y + 50, { steps: 5 });
  // Crossing the debounce: the activation render's write lands while the pointer is still down.
  await expect.poll(async () => (await persisted(page)).stored?.windows?.a, 'a write landed mid-drag').toBeTruthy();
  const during = await persisted(page);
  expect([during.hosts[0].left, during.hosts[0].top], 'A followed the pointer').not.toEqual([before.left, before.top]);
  return { before, during };
}
const xy = h => [parseFloat(h.left), parseFloat(h.top)];

test('source: persistKey cancelled drag keeps the pre-drag position on reload and in other tabs (#581)', async ({ page, demo }) => {
  await openPersisted(page, demo);
  await mountPersisted(page, { html: TWO_PLACED });
  await expect.poll(async () => (await persisted(page)).stored?.windows?.b, 'layout written after the first render').toBeTruthy();
  const other = await openWatcher(page, demo);
  const { before, during } = await pressBackgroundA(page);
  expect([during.stored.windows.a.x, during.stored.windows.a.y], 'the mid-drag write saved the pre-drag position').toEqual(xy(before));
  // Cancel the drag (#563), then let the pointer go. Storage is cleared in the same task as the
  // cancel, so whatever lands next is the post-cancel write, however long the steps below take.
  await page.evaluate(key => {
    localStorage.removeItem(`scriptoscope:layout:${key}`);
    const host = document.querySelector('#pb-root [data-scriptoscope-window-host]');
    host.shadowRoot.firstElementChild.dispatchEvent(new PointerEvent('pointercancel', { pointerId: window.__pid, pointerType: 'mouse', bubbles: true, composed: true }));
  }, LAYOUT_KEY);
  await page.mouse.up();
  const cancelled = (await persisted(page)).hosts[0];
  expect([cancelled.left, cancelled.top], 'the cancel put A back').toEqual([before.left, before.top]);
  // The capture's end schedules a write of the restored position.
  await expect.poll(async () => (await persisted(page)).stored?.windows?.a, 'a write landed after the cancel').toBeTruthy();
  expect([(await persisted(page)).stored.windows.a.x, (await persisted(page)).stored.windows.a.y], 'persisted at the pre-drag position').toEqual(xy(before));
  // The other tab heard every write and never moved A off its pre-drag place.
  // (null entries are this test's own removeItem calls.)
  const heard = () => other.evaluate(() => window.__seen.filter(Boolean));
  await expect.poll(async () => (await heard()).length, 'the other tab heard the mid-drag and post-cancel writes').toBeGreaterThanOrEqual(2);
  expect(await heard(), 'other tab: only the pre-drag position').toEqual((await heard()).map(() => xy(before)));
  const seen = (await persisted(other)).hosts[0];
  expect([seen.left, seen.top], 'other tab keeps A at its pre-drag position').toEqual([before.left, before.top]);
  await other.close();
  const restored = await reloadPersisted(page, { html: TWO_PLACED });
  expect([restored.hosts[0].left, restored.hosts[0].top], 'reload restores the pre-drag position').toEqual([before.left, before.top]);
});

test('source: persistKey another tab never sees a mid-drag position, only the drop (#581)', async ({ page, demo }) => {
  await openPersisted(page, demo);
  await mountPersisted(page, { html: TWO_PLACED });
  await expect.poll(async () => (await persisted(page)).stored?.windows?.b, 'layout written after the first render').toBeTruthy();
  const other = await openWatcher(page, demo);
  const { before } = await pressBackgroundA(page);
  // (null entries are this test's own removeItem calls.)
  await expect.poll(() => other.evaluate(() => window.__seen.filter(Boolean).length), 'the other tab heard the mid-drag write').toBeGreaterThanOrEqual(1);
  expect(await other.evaluate(() => window.__seen.filter(Boolean)), 'mid-drag: the other tab only saw the pre-drag position').toEqual([xy(before)]);
  await page.mouse.up();
  const dropped = (await persisted(page)).hosts[0];
  await expect.poll(async () => { const a = (await persisted(page)).stored?.windows?.a; return a && [a.x, a.y]; }, 'the drop persisted').toEqual(xy(dropped));
  await expect.poll(async () => { const h = (await persisted(other)).hosts[0]; return [h.left, h.top]; }, 'other tab follows the drop').toEqual([dropped.left, dropped.top]);
  const positions = (await other.evaluate(() => window.__seen.filter(Boolean))).map(p => JSON.stringify(p));
  expect(positions.every(p => p === JSON.stringify(xy(before)) || p === JSON.stringify(xy(dropped))), `other tab saw only the pre-drag and dropped positions: ${positions}`).toBe(true);
  await other.close();
});

// Mobile browsers can discard a backgrounded tab without pagehide, so hiding the page flushes too.
test('source: persistKey flushes a pending layout write when the page becomes hidden (#581)', async ({ page, demo }) => {
  await openPersisted(page, demo);
  await mountPersisted(page, { html: TWO_PLACED });
  await expect.poll(async () => (await persisted(page)).stored?.windows?.b, 'layout written after the first render').toBeTruthy();
  // One task: a keyboard move schedules a write, the page hides, and storage is read at once,
  // well inside the 250 ms debounce, so only the flush can have written it.
  const result = await page.evaluate(key => {
    const k = `scriptoscope:layout:${key}`;
    localStorage.removeItem(k);
    const host = document.querySelector('#pb-root [data-scriptoscope-window-host]');
    host.shadowRoot.querySelector('.scriptoscope-movehandle').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, composed: true }));
    const pending = localStorage.getItem(k);
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    const a = JSON.parse(localStorage.getItem(k) ?? 'null')?.windows?.a;
    return { pending, left: host.style.left, stored: a && a.x };
  }, LAYOUT_KEY);
  expect(result.pending, 'the write was still pending before the page hid').toBeNull();
  expect(result.stored, 'hiding the page flushed the moved position').toBe(parseFloat(result.left));
});

// #581 review: a collapse drops the grow box while it holds the capture (#563 cancels the grow).
// lostpointercapture then goes to the document, not through the host, so a host-only release
// left the window held for good and every later write saved the stale pre-grow position.
test('source: persistKey a collapse during a grow drag does not pin later drags to a stale position (#581)', async ({ page, demo }) => {
  await openPersisted(page, demo);
  await mountPersisted(page, { html: TWO_PLACED });
  await expect.poll(async () => (await persisted(page)).stored?.windows?.b, 'layout written after the first render').toBeTruthy();
  // A bare second page: it only writes the key, so no layout of its own answers back.
  const other = await page.context().newPage();
  await other.goto(`${demo}/install.html`);
  const hosts = page.locator('#pb-root [data-scriptoscope-window-host]');
  const corner = await hosts.first().evaluate(h => {
    const r = h.shadowRoot.querySelector('button.scriptoscope-growbox').getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  await page.mouse.move(corner.x, corner.y);
  await page.mouse.down();
  await page.mouse.move(corner.x + 20, corner.y + 20, { steps: 2 });
  // Another tab collapses A; the storage event applies it here mid-grow and drops the grow box.
  await other.evaluate(key => {
    const k = `scriptoscope:layout:${key}`;
    const value = JSON.parse(localStorage.getItem(k));
    value.windows.a.collapsed = true;
    localStorage.setItem(k, JSON.stringify(value));
  }, LAYOUT_KEY);
  await expect.poll(() => hosts.first().evaluate(h => !!h.shadowRoot.querySelector('button.scriptoscope-growbox')), 'collapse dropped the grow box').toBe(false);
  await page.mouse.up();
  // Now drag A by its title bar and drop it.
  const grip = await hosts.first().evaluate(h => {
    const r = h.shadowRoot.querySelector('.scriptoscope-movehandle').getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  await page.mouse.move(grip.x, grip.y);
  await page.mouse.down();
  await page.mouse.move(grip.x + 60, grip.y + 30, { steps: 5 });
  await page.mouse.up();
  const dropped = (await persisted(page)).hosts[0];
  expect(xy(dropped), 'A moved').not.toEqual([0, 0]);
  await expect.poll(async () => { const a = (await persisted(page)).stored?.windows?.a; return a && [a.x, a.y]; }, 'the drop persisted').toEqual(xy(dropped));
  await other.close();
});

// #584: two pages with the same persistKey both mount the layout. Each tab used to save its whole
// snapshot, so a write from a tab that had not yet applied another tab's change (its first write
// after loading, or one pending when the change arrived) carried the older rows back over the
// newer ones, and the first tab's window jumped back. A tab now writes only the windows it changed
// since they were last in sync with storage, and a page that finishes loading applies any write
// that landed while it loaded.
const LAYOUT = `scriptoscope:layout:${LAYOUT_KEY}`;
const GROW = h => !!h.shadowRoot.querySelector('button.scriptoscope-growbox');
/** Counts each page's layout writes (setItem calls for the key) in window.__writes. */
const countWrites = context => context.addInitScript(k => {
  window.__writes = 0;
  const set = Storage.prototype.setItem;
  Storage.prototype.setItem = function (name, value) { if (name === k) window.__writes++; return set.call(this, name, value); };
}, LAYOUT);
/** A second page in the same context, navigated but not mounted. */
async function openSecond(page, demo) {
  const other = await page.context().newPage();
  await other.setViewportSize({ width: 1280, height: 960 });
  await other.goto(`${demo}/install.html`);
  return other;
}
async function mountSecond(page, demo) {
  const other = await openSecond(page, demo);
  await mountPersisted(other, { html: TWO_PLACED });
  await expect.poll(async () => (await persisted(other)).hosts.length).toBe(2);
  return other;
}
/** Reads repeatedly for `ms`, several 250 ms debounces, and requires `expected` every time. */
async function holds(read, expected, message, ms = 1000) {
  const end = Date.now() + ms;
  do expect(await read(), message).toEqual(expected); while (Date.now() < end);
}
const stored = (page, id = 'a') => page.evaluate(({ k, id }) => { const w = JSON.parse(localStorage.getItem(k) ?? 'null')?.windows?.[id]; return w && [w.x, w.y]; }, { k: LAYOUT, id });
const hostAt = async (page, i = 0) => xy((await persisted(page)).hosts[i]);
async function dragA(page, dx, dy) {
  const grip = await page.locator('#pb-root [data-scriptoscope-window-host]').first().evaluate(h => {
    const r = h.shadowRoot.querySelector('.scriptoscope-movehandle').getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  await page.mouse.move(grip.x, grip.y);
  await page.mouse.down();
  await page.mouse.move(grip.x + dx, grip.y + dy, { steps: 5 });
  await page.mouse.up();
  return hostAt(page);
}
const settledAt = (pages, at, message) => holds(async () => [await stored(pages[0]), ...await Promise.all(pages.map(p => hostAt(p)))], [at, ...pages.map(() => at)], message);

test('source: persistKey a drag reaches a second mounted tab and is not written back over (#584)', async ({ page, demo }) => {
  await openPersisted(page, demo);
  await mountPersisted(page, { html: TWO_PLACED });
  await expect.poll(async () => (await persisted(page)).stored?.windows?.b, 'layout written after the first render').toBeTruthy();
  // Page 2 reads the stored layout, then its theme load is held so that page 1's drop lands
  // before page 2 has any window to apply it to.
  const other = await openSecond(page, demo);
  let release, requested = false;
  const gate = new Promise(r => { release = r; });
  await other.route('**/themes/**', async route => { requested = true; await gate; await route.continue(); });
  const mounting = mountPersisted(other, { html: TWO_PLACED });
  await expect.poll(() => requested, 'page 2 read the layout and started loading').toBe(true);
  const dropped = await dragA(page, 60, 30);
  expect(dropped, 'A moved').not.toEqual([0, 0]);
  await expect.poll(() => stored(page), 'the drop persisted').toEqual(dropped);
  release();
  await mounting;
  await other.unroute('**/themes/**');
  await expect.poll(async () => (await persisted(other)).hosts.length).toBe(2);
  await expect.poll(() => hostAt(other), 'page 2 shows the drop that landed while it loaded').toEqual(dropped);
  await settledAt([page, other], dropped, 'page 2 does not write its loaded position back over the drop');
  // A later drag in page 1 reaches page 2 and stays put in both.
  const again = await dragA(page, 30, 20);
  await expect.poll(() => hostAt(other), 'page 2 follows the next drop').toEqual(again);
  await settledAt([page, other], again, 'no echo moves A afterwards');
  await other.close();
});

test('source: persistKey a collapse from a mounted second tab during a grow drag keeps the later drop (#584)', async ({ page, demo }) => {
  await openPersisted(page, demo);
  await mountPersisted(page, { html: TWO_PLACED });
  await expect.poll(async () => (await persisted(page)).stored?.windows?.b, 'layout written after the first render').toBeTruthy();
  const other = await mountSecond(page, demo);
  // A first drop that page 2 applies, so page 2's A is in sync with a row it did not mount from.
  const first = await dragA(page, 20, 10);
  await expect.poll(() => hostAt(other), 'page 2 follows the first drop').toEqual(first);
  const hosts = page.locator('#pb-root [data-scriptoscope-window-host]');
  const corner = await hosts.first().evaluate(h => {
    const r = h.shadowRoot.querySelector('button.scriptoscope-growbox').getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  await page.mouse.move(corner.x, corner.y);
  await page.mouse.down();
  await page.mouse.move(corner.x + 20, corner.y + 20, { steps: 2 });
  // In one page-2 task: A is collapsed through storage (page 2 itself has not applied it), then
  // page 2 moves B and its pending write is flushed by hiding the page. That write must keep A's
  // stored collapse instead of saving page 2's expanded A.
  const b = await other.evaluate(k => {
    const v = JSON.parse(localStorage.getItem(k)); v.windows.a.collapsed = true; localStorage.setItem(k, JSON.stringify(v));
    const host = document.querySelectorAll('#pb-root [data-scriptoscope-window-host]')[1];
    host.shadowRoot.querySelector('.scriptoscope-movehandle').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, composed: true }));
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    delete document.visibilityState;
    return [parseFloat(host.style.left), parseFloat(host.style.top)];
  }, LAYOUT);
  await expect.poll(() => stored(page, 'b'), 'page 2 saved its move of B').toEqual(b);
  await expect.poll(() => hostAt(page, 1), 'page 1 follows B').toEqual(b);
  await holds(() => hosts.first().evaluate(GROW), false, 'A stays collapsed in page 1: the grow box is gone');
  await page.mouse.up();
  const dropped = await dragA(page, 60, 30);
  expect(dropped, 'A moved').not.toEqual(first);
  await expect.poll(() => stored(page), 'the drop persisted').toEqual(dropped);
  await expect.poll(() => hostAt(other), 'page 2 follows the drop').toEqual(dropped);
  await settledAt([page, other], dropped, 'no echo moves A back');
  expect(await page.evaluate(k => JSON.parse(localStorage.getItem(k)).windows.a.collapsed, LAYOUT), 'A is still stored collapsed').toBe(true);
  await other.close();
});

test('source: persistKey applying the stored or another tab\'s layout writes nothing back (#584)', async ({ page, demo }) => {
  await countWrites(page.context());
  await openPersisted(page, demo);
  await mountPersisted(page, { html: TWO_PLACED });
  await expect.poll(async () => (await persisted(page)).stored?.windows?.b, 'layout written after the first render').toBeTruthy();
  // Page 2 mounts from the stored layout; a bare third page then writes the key, and both mounted
  // pages apply that as a remote update.
  const other = await mountSecond(page, demo);
  const writer = await openSecond(page, demo);
  const count = p => p.evaluate(() => window.__writes);
  const before = await count(page);
  const written = await writer.evaluate(k => {
    const v = JSON.parse(localStorage.getItem(k));
    Object.assign(v.windows.a, { collapsed: true, x: 40, y: 120 });
    const raw = JSON.stringify(v); localStorage.setItem(k, raw); return raw;
  }, LAYOUT);
  for (const p of [page, other]) {
    await expect.poll(() => p.locator('#pb-root [data-scriptoscope-window-host]').first().evaluate(GROW), 'collapse applied').toBe(false);
    await expect.poll(() => hostAt(p), 'position applied').toEqual([40, 120]);
  }
  await holds(async () => [await count(page), await count(other), await page.evaluate(k => localStorage.getItem(k), LAYOUT)],
    [before, 0, written], 'neither mounted page saves the layout it applied');
  await writer.close();
  await other.close();
});
