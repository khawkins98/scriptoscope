import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { expect } from '@playwright/test';
import { test as demoTest } from './demo-fixtures.mjs';
import { startServers } from './servers.mjs';

// #549: the themed window scrollbar follows the scroll element's real position.
// Content can scroll without the bar (focus moving to an off-screen link,
// scrollIntoView, find-in-page, a programmatic scrollTop). The thumb and
// aria-valuenow must follow, and the next key step must start from there.
// Thumb position is checked in pixels: the bar's canvas after an external
// scroll must equal the canvas the bar itself paints for the same position
// (End / Home), and must differ from the opposite end's canvas.
const SLUGS = ['windows-95', 'apple-platinum-2'];
const LINE = 24;

const test = demoTest.extend({
  servers: [async ({}, use) => {
    const servers = await startServers();
    try { await use(servers); } finally { await servers.close(); }
  }, { scope: 'worker' }],
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

/** Installs `window.__sb` helpers for one host + its scroll element. */
function installHelpers(page) {
  return page.evaluate(() => {
    const frames = (n = 3) => new Promise(r => { const step = () => (n-- <= 0 ? r() : requestAnimationFrame(step)); step(); });
    window.__sb = {
      frames,
      bar: axis => window.__sb.host.shadowRoot.querySelector(`[role=scrollbar][aria-orientation=${axis}]`),
      state(axis) {
        const s = window.__sb.scrollEl, v = axis === 'vertical';
        const bar = window.__sb.bar(axis);
        return {
          pos: Math.round(v ? s.scrollTop : s.scrollLeft),
          max: v ? s.scrollHeight - s.clientHeight : s.scrollWidth - s.clientWidth,
          valuenow: bar.getAttribute('aria-valuenow'),
        };
      },
      pixels: axis => window.__sb.bar(axis).querySelector('canvas').toDataURL(),
      async key(axis, key) {
        const bar = window.__sb.bar(axis);
        bar.focus({ preventScroll: true });
        bar.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
        await frames();
      },
      /** Count bar repaints (canvas swaps) while `run` executes and the frames settle. */
      async paints(axis, run) {
        let n = 0;
        const mo = new MutationObserver(list => { n += list.filter(m => m.type === 'childList').length; });
        mo.observe(window.__sb.bar(axis), { childList: true });
        await run();
        await frames(4);
        mo.disconnect();
        return n;
      },
    };
  });
}

const state = (page, axis) => page.evaluate(axis => window.__sb.state(axis), axis);

/** After an external scroll to the far end: value 100, thumb painted at the end, keys step from the end. */
async function expectAtEnd(page, axis, why) {
  const [fwd, back] = axis === 'vertical' ? ['ArrowDown', 'ArrowUp'] : ['ArrowRight', 'ArrowLeft'];
  const s = await state(page, axis);
  expect(s.pos, `${why}: content at the far end`).toBe(s.max);
  await expect.poll(async () => (await state(page, axis)).valuenow, `${why}: aria-valuenow`).toBe('100');
  const external = await page.evaluate(axis => window.__sb.pixels(axis), axis);
  // The bar's own End paint for the same position; Home gives the opposite end.
  await page.evaluate(axis => window.__sb.key(axis, 'Home'), axis);
  await expect.poll(async () => (await state(page, axis)).valuenow).toBe('0');
  const atStart = await page.evaluate(axis => window.__sb.pixels(axis), axis);
  await page.evaluate(axis => window.__sb.key(axis, 'End'), axis);
  await expect.poll(async () => (await state(page, axis)).valuenow).toBe('100');
  const atEnd = await page.evaluate(axis => window.__sb.pixels(axis), axis);
  expect(atEnd, `${why}: thumb moves between the ends (the pixel check can fail)`).not.toBe(atStart);
  expect(external === atEnd, `${why}: thumb painted at the end after the external scroll`).toBe(true);
  await page.evaluate(([axis, k]) => window.__sb.key(axis, k), [axis, fwd]);
  expect((await state(page, axis)).pos, `${why}: ${fwd} at the end stays at max`).toBe(s.max);
  await page.evaluate(([axis, k]) => window.__sb.key(axis, k), [axis, back]);
  expect((await state(page, axis)).pos, `${why}: ${back} steps one line back from max`).toBe(s.max - LINE);
}

/** After an external scroll to any position (not necessarily the end): the value
 *  follows it, the thumb is painted where the bar itself paints that position, and
 *  the next keys step from there. A focus scroll clamps at max only when the scroll
 *  viewport happens to be tall enough, so this does not assume it (#526). */
async function expectSyncedAt(page, axis, why) {
  const [fwd, back] = axis === 'vertical' ? ['ArrowDown', 'ArrowUp'] : ['ArrowRight', 'ArrowLeft'];
  const s = await state(page, axis);
  expect(s.pos, `${why}: the external scroll moved the content`).toBeGreaterThan(LINE);
  expect(s.pos, `${why}: by a substantial fraction of the range`).toBeGreaterThanOrEqual(s.max / 2);
  const value = String(Math.round(100 * s.pos / s.max));
  await expect.poll(async () => (await state(page, axis)).valuenow, `${why}: aria-valuenow`).toBe(value);
  const external = await page.evaluate(axis => window.__sb.pixels(axis), axis);
  // The first key after the external scroll steps back from the real position.
  await page.evaluate(([axis, k]) => window.__sb.key(axis, k), [axis, back]);
  expect((await state(page, axis)).pos, `${why}: ${back} steps one line back from the scrolled-to position`).toBe(s.pos - LINE);
  // One step forward returns to it, painted by the bar itself: the external paint must match.
  await page.evaluate(([axis, k]) => window.__sb.key(axis, k), [axis, fwd]);
  expect((await state(page, axis)).pos, `${why}: ${fwd} returns to the scrolled-to position`).toBe(s.pos);
  await expect.poll(async () => (await state(page, axis)).valuenow).toBe(value);
  const own = await page.evaluate(axis => window.__sb.pixels(axis), axis);
  expect(external === own, `${why}: thumb painted where the bar paints the same position`).toBe(true);
  await page.evaluate(([axis, k]) => window.__sb.key(axis, k), [axis, fwd]);
  expect((await state(page, axis)).pos, `${why}: ${fwd} steps on from there`).toBe(Math.min(s.pos + LINE, s.max));
  // The pixel check can fail: the start position paints a different thumb.
  await page.evaluate(axis => window.__sb.key(axis, 'Home'), axis);
  await expect.poll(async () => (await state(page, axis)).valuenow).toBe('0');
  expect(await page.evaluate(axis => window.__sb.pixels(axis), axis), `${why}: thumb moves between positions`).not.toBe(external);
}

// The issue's reproduction: the showcase's ResourceForkLib card, Tab-driven focus scroll.
for (const mode of ['source', 'built']) for (const slug of SLUGS) {
  test(`${mode} showcase ${slug}: Tab-driven scroll moves the ResourceForkLib scrollbar (#549)`, async ({ page, demo, production }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`${mode === 'source' ? demo : production}/showcase.html?theme=${slug}`);
    await expect(page.locator('#powers.scriptoscope-ready')).toBeVisible();
    const host = page.locator('[data-scriptoscope-window-host]', { has: page.getByRole('link', { name: 'Bring your own scheme' }) });
    await expect(host).toHaveCount(1);
    await expect.poll(() => host.evaluate(h => !!h.shadowRoot?.querySelector('[role=scrollbar][aria-orientation=vertical] canvas'))).toBe(true);
    await host.evaluate(h => { h.scrollIntoView({ block: 'center' }); });
    // The showcase marks itself ready before its boot wipe (a clip-path animation on every
    // window host, demo/explicit-host.mjs) ends, and a click during the wipe can hit-test
    // through the card to the page. Click only once every window's wipe has finished.
    await page.evaluate(() => Promise.all([...document.querySelectorAll('[data-scriptoscope-window-host]')]
      .flatMap(h => h.getAnimations()).map(a => a.finished.catch(() => {}))));
    await installHelpers(page);
    await host.evaluate(h => { window.__sb.host = h; window.__sb.scrollEl = h.querySelector('.scriptoscope-slot'); });
    const grip = await host.evaluate(h => {
      const r = h.shadowRoot.querySelector('.scriptoscope-movehandle').getBoundingClientRect();
      return { x: r.x + 40, y: r.y + r.height / 2 };
    });
    await page.mouse.click(grip.x, grip.y);
    // #557: the activation render re-wires the scrollbar, and the re-wire reads the current
    // scrollTop. If it landed after the focus scroll below, an unsynced bar would look synced.
    // The committed window carries its state, and the re-wire runs in the same commit.
    await expect.poll(() => host.evaluate(h => h.shadowRoot.querySelector('.scriptoscope-window')?.dataset.scriptoscopeCurrentState),
      'activation render committed before focusing').toBe('active');
    expect((await state(page, 'vertical')).pos).toBe(0);
    await host.getByRole('link', { name: 'Bring your own scheme' }).focus();
    for (let i = 0; i < 8; i++) {
      if (await page.evaluate(() => document.activeElement?.textContent?.trim()) === 'Kaleidoscope Scheme Archive') break;
      await page.keyboard.press('Tab');
    }
    expect(await page.evaluate(() => document.activeElement?.textContent?.trim())).toBe('Kaleidoscope Scheme Archive');
    await page.evaluate(() => window.__sb.frames());
    await expectSyncedAt(page, 'vertical', `${slug} after Tab`);
  });
}

// Imperative windows on both runtime builds: programmatic, scrollIntoView, horizontal, listener reuse.
async function setup(page, servers, mode, slug, { smooth = false } = {}) {
  await page.goto(`${servers[mode]}/tests/rendering-options/native-dom-page.html`);
  await installHelpers(page);
  await page.evaluate(async ({ mode, slug, smooth }) => {
    const api = await import(mode === 'source' ? '/src/index.ts' : '/dist/scriptoscope.js');
    const theme = await api.loadTheme(`/themes/${slug}`);
    const manager = new api.WindowManager();
    const content = document.createElement('div');
    content.style.cssText = 'width:100%;height:100%;overflow:auto;box-sizing:border-box';
    if (smooth) content.style.scrollBehavior = 'smooth';
    content.innerHTML = '<div style="position:relative;width:900px;height:900px">'
      + '<a id="mid" href="#" style="position:absolute;left:10px;top:400px">middle</a>'
      + '<a id="far" href="#" style="position:absolute;right:0;bottom:0;scroll-margin:40px">far corner</a></div>';
    const host = await manager.add(theme, { title: 'Sync', width: 220, height: 140 }, {}, { contentEl: content });
    document.body.append(host);
    manager.setPosition(host, 40, 40);
    Object.assign(window.__sb, { api, manager, host, scrollEl: content });
    await window.__sb.frames(6);
  }, { mode, slug, smooth });
  await expect.poll(() => page.evaluate(() => ['vertical', 'horizontal'].every(a => window.__sb.bar(a)?.querySelector('canvas')))).toBe(true);
}

for (const mode of ['source', 'built']) for (const slug of SLUGS) {
  test(`${mode} ${slug}: programmatic scrollTop and scrollLeft move the thumbs (#549)`, async ({ page, servers }) => {
    await setup(page, servers, mode, slug);
    await page.evaluate(() => { const s = window.__sb.scrollEl; s.scrollTop = s.scrollHeight; });
    await expectAtEnd(page, 'vertical', `${slug} scrollTop`);
    await page.evaluate(() => { const s = window.__sb.scrollEl; s.scrollLeft = s.scrollWidth; });
    await expectAtEnd(page, 'horizontal', `${slug} scrollLeft`);
  });

  test(`${mode} ${slug}: scrollIntoView moves the thumbs and the next key steps from there (#549)`, async ({ page, servers }) => {
    await setup(page, servers, mode, slug);
    await page.evaluate(() => document.getElementById('mid').scrollIntoView({ block: 'center' }));
    await page.evaluate(() => window.__sb.frames());
    const mid = await state(page, 'vertical');
    expect(mid.pos).toBeGreaterThan(0);
    expect(mid.pos).toBeLessThan(mid.max);
    expect(mid.valuenow).toBe(String(Math.round(mid.pos / mid.max * 100)));
    await page.evaluate(() => window.__sb.key('vertical', 'ArrowDown'));
    expect((await state(page, 'vertical')).pos, 'ArrowDown from the scrolled-to position').toBe(mid.pos + LINE);
    await page.evaluate(() => document.getElementById('far').scrollIntoView({ block: 'end', inline: 'end' }));
    await page.evaluate(() => window.__sb.frames());
    await expectAtEnd(page, 'vertical', `${slug} scrollIntoView`);
    await expectAtEnd(page, 'horizontal', `${slug} scrollIntoView`);
  });

  test(`${mode} ${slug}: after many re-renders one scroll is one repaint and one key is one step (#549)`, async ({ page, servers }) => {
    await setup(page, servers, mode, slug);
    for (let i = 0; i < 6; i++) {
      await page.evaluate(i => {
        const { manager, host } = window.__sb;
        return i % 2 ? manager.refreshScrollbars(host) : manager.setContentSize(host, 220 + i * 2, 140 + i * 2);
      }, i);
      await page.evaluate(() => { window.__sb.scrollEl.scrollTop += 7; return window.__sb.frames(); });
    }
    await page.evaluate(() => window.__sb.frames(6));
    for (const axis of ['vertical', 'horizontal']) {
      const v = axis === 'vertical';
      const scroll = to => page.evaluate(([v, to]) => window.__sb.paints(v ? 'vertical' : 'horizontal', () => {
        const s = window.__sb.scrollEl; if (v) s.scrollTop = to; else s.scrollLeft = to;
      }), [v, to]);
      expect(await scroll(100), `${axis}: one external scroll, one repaint`).toBe(1);
      expect(await scroll(100), `${axis}: no movement, no repaint`).toBe(0);
      const key = v ? 'ArrowDown' : 'ArrowRight';
      const painted = await page.evaluate(([axis, key]) => window.__sb.paints(axis, () => window.__sb.key(axis, key)), [axis, key]);
      expect((await state(page, axis)).pos, `${axis}: one key is one step`).toBe(100 + LINE);
      expect(painted, `${axis}: one key, one repaint (no scroll-event feedback loop)`).toBe(1);
      await expect.poll(async () => (await state(page, axis)).valuenow).toBe(String(Math.round((100 + LINE) / (await state(page, axis)).max * 100)));
    }
  });
}

/** Scroll listeners on the scroll element, via CDP (sees listeners no DOM API exposes). */
async function scrollListeners(page) {
  const cdp = await page.context().newCDPSession(page);
  try {
    const { result } = await cdp.send('Runtime.evaluate', { expression: 'window.__sb.scrollEl' });
    const { listeners } = await cdp.send('DOMDebugger.getEventListeners', { objectId: result.objectId });
    return listeners.filter(l => l.type === 'scroll').length;
  } finally { await cdp.detach(); }
}

for (const mode of ['source', 'built']) for (const slug of SLUGS) {
  test(`${mode} ${slug}: key steps under consumer scroll-behavior: smooth start from the target (#549)`, async ({ page, servers }) => {
    await setup(page, servers, mode, slug, { smooth: true });
    expect(await page.evaluate(() => getComputedStyle(window.__sb.scrollEl).scrollBehavior)).toBe('smooth');
    // Five presses in one task: each step must read the previous step's target.
    await page.evaluate(() => {
      const bar = window.__sb.bar('vertical');
      for (let i = 0; i < 5; i++) bar.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
      return window.__sb.frames();
    });
    expect((await state(page, 'vertical')).pos, 'five ArrowDowns in one task').toBe(5 * LINE);
    await page.evaluate(() => { window.__sb.scrollEl.scrollTo({ top: 0, behavior: 'instant' }); return window.__sb.frames(); });
    for (let i = 0; i < 5; i++) await page.evaluate(async () => { await window.__sb.key('vertical', 'ArrowDown'); });
    expect((await state(page, 'vertical')).pos, 'five ArrowDowns two frames apart').toBe(5 * LINE);
  });

  test(`${mode} ${slug}: a key in the same task as an external scroll steps from the new position (#549)`, async ({ page, servers }) => {
    await setup(page, servers, mode, slug);
    // The scroll event for this write has not fired yet when the key arrives.
    await page.evaluate(() => {
      window.__sb.scrollEl.scrollTop = 300;
      window.__sb.bar('vertical').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
      return window.__sb.frames();
    });
    expect((await state(page, 'vertical')).pos).toBe(300 + LINE);
  });

  test(`${mode} ${slug}: re-renders and remove() leave no stale scroll listeners (#549)`, async ({ page, servers }) => {
    await setup(page, servers, mode, slug);
    expect(await scrollListeners(page), 'one per axis after the first render').toBe(2);
    for (let i = 0; i < 5; i++) await page.evaluate(async i => {
      const { manager, host } = window.__sb;
      await (i % 2 ? manager.refreshScrollbars(host) : manager.setContentSize(host, 220 + i * 2, 140 + i * 2));
      await window.__sb.frames();
    }, i);
    expect.soft(await scrollListeners(page), 'one per axis after 5 re-renders').toBe(2);
    await page.evaluate(() => { window.__sb.manager.remove(window.__sb.host); return window.__sb.frames(); });
    expect(await scrollListeners(page), 'none after remove()').toBe(0);
  });
}
