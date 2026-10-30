import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { expect } from '@playwright/test';
import { test as demoTest } from './demo-fixtures.mjs';
import { startServers } from './servers.mjs';

// #567: window scrollbar clicks are part-aware, as in the classic Control Manager
// (Inside Macintosh part codes: inUpButton 20, inDownButton 21, inPageUp 22,
// inPageDown 23, inThumb 129). An arrow steps one line, the track steps one page,
// holding either repeats (the track only while the thumb has not reached the
// pointer), the held part draws pressed and returns to normal on release or
// cancel, and the thumb still drags to the pointer fraction.
//
// The oracle is independent of the window wiring: the source engine's own
// composeScrollbarFrame (scrollbar §4.8 hit test and the pressed-part draw),
// loaded from the source server for every mode, for the bar's length and value.
// Line and page amounts are compatibility policy (the original left them to
// the application): a line is 24 px, and a page is the scroll element's client
// height less one line of overlap, for both the keys and the track.
const SLUGS = ['windows-95', 'beos-r503', 'apple-platinum-2', 'evolution'];
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

/** `window.__sp`: the bar under test, its scroll element, and the engine oracle. */
function installHelpers(page, source, slug) {
  return page.evaluate(async ({ source, slug }) => {
    const frames = (n = 3) => new Promise(r => { const step = () => (n-- <= 0 ? r() : requestAnimationFrame(step)); step(); });
    const index = await import(`${source}/src/index.ts`);
    const controls = await import(`${source}/src/controls.ts`);
    const oracleTheme = await index.loadTheme(`${source}/themes/${slug}`);
    const sp = window.__sp = {
      frames,
      bar: axis => sp.host.shadowRoot.querySelector(`[role=scrollbar][aria-orientation=${axis}]`),
      canvas: axis => sp.bar(axis).querySelector('canvas'),
      state(axis) {
        const s = sp.scrollEl, v = axis === 'vertical';
        return {
          pos: Math.round(v ? s.scrollTop : s.scrollLeft),
          max: v ? s.scrollHeight - s.clientHeight : s.scrollWidth - s.clientWidth,
          valuenow: sp.bar(axis).getAttribute('aria-valuenow'),
        };
      },
      /** The engine frame for this bar at scroll position `pos`, optionally pressed. */
      async oracle(axis, pos, pressedPart) {
        const c = sp.canvas(axis), v = axis === 'vertical';
        const { max } = sp.state(axis);
        const frame = await controls.composeScrollbarFrame(oracleTheme, {
          orientation: axis, length: v ? c.height : c.width, value: max > 0 ? Math.min(1, Math.max(0, pos / max)) : 0,
          ...(pressedPart ? { state: 'pressed', pressedPart } : {}),
        });
        if (!frame) throw new Error(`${slug}: no engine scrollbar (procedural fallback is out of this spec's scope)`);
        return frame;
      },
      async oraclePixels(axis, pos, pressedPart) {
        return controls.bufferToCanvas((await sp.oracle(axis, pos, pressedPart)).buffer).toDataURL();
      },
      /** The bar's canvas and position read together, and whether they equal the engine's frame. */
      async paintedAs(axis, pressedPart) {
        const pixels = sp.canvas(axis).toDataURL(), { pos } = sp.state(axis);
        return pixels === await sp.oraclePixels(axis, pos, pressedPart);
      },
      /** Buffer coordinate along the axis of the middle of the first run of `part` at `pos`. */
      async locate(axis, part, pos) {
        const frame = await sp.oracle(axis, pos), v = axis === 'vertical';
        const len = v ? frame.buffer.height : frame.buffer.width, mid = v ? frame.buffer.width >> 1 : frame.buffer.height >> 1;
        let start = -1, end = -1;
        for (let a = 0; a < len; a++) {
          const hit = v ? frame.partAt(mid, a) : frame.partAt(a, mid);
          if (hit === part) { if (start < 0) start = a; end = a; } else if (start >= 0) break;
        }
        if (start < 0) throw new Error(`${slug} ${axis}: no ${part} part at ${pos}`);
        return (start + end) >> 1;
      },
      /** The engine part under buffer coordinate `a` (bar centre line) at `pos`. */
      async partAt(axis, a, pos) {
        const frame = await sp.oracle(axis, pos), v = axis === 'vertical';
        return v ? frame.partAt(frame.buffer.width >> 1, a) : frame.partAt(a, frame.buffer.height >> 1);
      },
      /** Viewport point of buffer coordinate `a` on the bar's centre line. */
      client(axis, a) {
        const c = sp.canvas(axis), r = c.getBoundingClientRect(), v = axis === 'vertical';
        return v ? { x: r.left + r.width / 2, y: r.top + (a + 0.5) * r.height / c.height }
          : { x: r.left + (a + 0.5) * r.width / c.width, y: r.top + r.height / 2 };
      },
      async key(axis, key) {
        const bar = sp.bar(axis);
        bar.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
        await frames();
      },
      watchPointer(axis) {
        sp.pointerId = undefined;
        sp.bar(axis).addEventListener('pointerdown', e => { sp.pointerId = e.pointerId; }, { capture: true });
      },
    };
  }, { source, slug });
}

const state = (page, axis) => page.evaluate(axis => window.__sp.state(axis), axis);
const point = (page, axis, part, pos) => page.evaluate(async ([axis, part, pos]) => {
  const a = await window.__sp.locate(axis, part, pos);
  return { a, ...window.__sp.client(axis, a) };
}, [axis, part, pos]);
const paintedAs = (page, axis, part) => page.evaluate(([axis, part]) => window.__sp.paintedAs(axis, part), [axis, part]);
const settle = (page, ms) => page.evaluate(ms => new Promise(r => setTimeout(r, ms)), ms);

async function home(page, axis) {
  await page.evaluate(axis => window.__sp.key(axis, 'Home'), axis);
  expect((await state(page, axis)).pos).toBe(0);
}

async function expectSynced(page, axis, why) {
  await expect.poll(async () => {
    const s = await state(page, axis);
    return s.valuenow === String(Math.round(100 * s.pos / s.max));
  }, `${why}: aria-valuenow follows the scroll position`).toBe(true);
}

/** Release: the bar paints the normal frame for its position, and the position holds. */
async function expectReleased(page, axis, why) {
  await expect.poll(() => paintedAs(page, axis, undefined), `${why}: normal paint`).toBe(true);
  const at = (await state(page, axis)).pos;
  await settle(page, 700);
  expect((await state(page, axis)).pos, `${why}: no repeat after release`).toBe(at);
  expect(await paintedAs(page, axis, undefined), `${why}: still normal`).toBe(true);
  await expectSynced(page, axis, why);
}

/** Pressed pixels differ from normal for this part (so the pressed check can fail). */
async function pressedDistinct(page, axis, part) {
  const [n, p] = await page.evaluate(async ([axis, part]) => {
    const { pos } = window.__sp.state(axis);
    return [await window.__sp.oraclePixels(axis, pos), await window.__sp.oraclePixels(axis, pos, part)];
  }, [axis, part]);
  return p !== n;
}

async function exercise(page, axis, { why, longContent }) {
  const [fwdKey] = axis === 'vertical' ? ['PageDown'] : [null];
  const { max } = await state(page, axis);

  // Arrow click: exactly one line, both ways; normal paint after release.
  await home(page, axis);
  let p = await point(page, axis, 'down', 0);
  await page.mouse.click(p.x, p.y);
  expect((await state(page, axis)).pos, `${why}: down-arrow click steps one line`).toBe(LINE);
  await expectReleased(page, axis, `${why} down-arrow click`);
  p = await point(page, axis, 'up', LINE);
  await page.mouse.click(p.x, p.y);
  expect((await state(page, axis)).pos, `${why}: up-arrow click steps one line back`).toBe(0);
  await expectReleased(page, axis, `${why} up-arrow click`);
  if (axis === 'horizontal') return;

  // Arrow hold: repeats by whole lines and draws the arrow pressed while held.
  expect(await pressedDistinct(page, axis, 'down'), `${why}: the engine draws the down arrow pressed differently from normal`).toBe(true);
  p = await point(page, axis, 'down', 0);
  await page.mouse.move(p.x, p.y); await page.mouse.down();
  await expect.poll(() => paintedAs(page, axis, 'down'), `${why}: down arrow pressed while held`).toBe(true);
  await expect.poll(async () => (await state(page, axis)).pos, `${why}: holding the arrow repeats`).toBeGreaterThanOrEqual(3 * LINE);
  await expect.poll(() => paintedAs(page, axis, 'down'), `${why}: still pressed while repeating`).toBe(true);
  await page.mouse.up();
  const held = (await state(page, axis)).pos;
  expect(held === max || held % LINE === 0, `${why}: repeats are whole lines (${held})`).toBe(true);
  await expectReleased(page, axis, `${why} arrow hold`);

  // pointercancel and lost capture release the arrow and stop the repeat.
  for (const how of ['pointercancel', 'lostpointercapture']) {
    await home(page, axis);
    await page.evaluate(axis => window.__sp.watchPointer(axis), axis);
    p = await point(page, axis, 'down', 0);
    await page.mouse.move(p.x, p.y); await page.mouse.down();
    await expect.poll(() => paintedAs(page, axis, 'down'), `${why}: pressed before ${how}`).toBe(true);
    // Capture set at pointerdown is pending until the next pointer event; a move inside
    // the arrow makes it active, so releasing it fires lostpointercapture.
    await page.mouse.move(p.x + 1, p.y);
    if (how === 'lostpointercapture') expect(await page.evaluate(axis => window.__sp.bar(axis).hasPointerCapture(window.__sp.pointerId), axis), `${why}: the bar holds pointer capture`).toBe(true);
    await page.evaluate(([axis, how]) => {
      const bar = window.__sp.bar(axis), id = window.__sp.pointerId;
      if (how === 'pointercancel') bar.dispatchEvent(new PointerEvent('pointercancel', { pointerId: id, bubbles: true, composed: true }));
      else bar.releasePointerCapture(id);
    }, [axis, how]);
    // A released capture is dispatched before the next pointer event (Pointer Events
    // "process pending pointer capture"); a move back inside the arrow delivers it.
    if (how === 'lostpointercapture') await page.mouse.move(p.x, p.y);
    await expectReleased(page, axis, `${why} ${how} while held`);
    await page.mouse.up();
  }

  // Track click: one page, the same amount PageDown moves; back with pageUp.
  await home(page, axis);
  await page.evaluate(([axis, k]) => window.__sp.key(axis, k), [axis, fwdKey]);
  const pageStep = (await state(page, axis)).pos;
  // Compatibility policy (#567): one visible page (the scroll element's client height) minus one line of overlap.
  const client = await page.evaluate(() => window.__sp.scrollEl.clientHeight);
  expect(pageStep, `${why}: PageDown moves one page less one line of overlap`).toBe(Math.min(client - LINE, max));
  await home(page, axis);
  p = await point(page, axis, 'pageDown', 0);
  await page.mouse.click(p.x, p.y);
  expect((await state(page, axis)).pos, `${why}: pageDown click moves one page`).toBe(Math.min(pageStep, max));
  await expectReleased(page, axis, `${why} pageDown click`);
  const afterPage = (await state(page, axis)).pos;
  p = await point(page, axis, 'pageUp', afterPage);
  await page.mouse.click(p.x, p.y);
  expect((await state(page, axis)).pos, `${why}: pageUp click moves one page back`).toBe(Math.max(0, afterPage - pageStep));
  await expectReleased(page, axis, `${why} pageUp click`);

  // Track hold: pages until the thumb reaches the pointer, pressed while paging.
  await home(page, axis);
  // A scheme's decoded track may draw a held page part like the normal track; the
  // pressed-pixel check then cannot tell them apart, so record it instead of failing.
  if (!await pressedDistinct(page, axis, 'pageDown'))
    test.info().annotations.push({ type: 'pressed-track-indistinct', description: `${why}: the engine draws pageDown pressed like normal` });
  const target = await point(page, axis, 'pageDown', 0);
  // The classic stop, from the engine's own hit test: page while the pointer is in pageDown.
  const expected = await page.evaluate(async ([axis, a, step, max]) => {
    let pos = 0;
    while (await window.__sp.partAt(axis, a, pos) === 'pageDown' && pos < max) pos = Math.min(pos + step, max);
    return pos;
  }, [axis, target.a, pageStep, max]);
  if (longContent) {
    expect(expected, `${why}: the hold needs more than one page`).toBeGreaterThan(pageStep);
    expect(expected, `${why}: the thumb reaches the pointer before the end`).toBeLessThan(max);
  }
  await page.mouse.move(target.x, target.y); await page.mouse.down();
  await expect.poll(() => paintedAs(page, axis, 'pageDown'), `${why}: pageDown pressed while held`).toBe(true);
  await expect.poll(async () => (await state(page, axis)).pos, `${why}: track hold stops where the thumb reaches the pointer`).toBe(expected);
  await settle(page, 700);
  expect((await state(page, axis)).pos, `${why}: and stays there while still held`).toBe(expected);
  await page.mouse.up();
  await expectReleased(page, axis, `${why} track hold`);

  // Thumb drag: unchanged, the content follows the pointer fraction along the bar.
  await home(page, axis);
  const thumb = await point(page, axis, 'thumb', 0);
  const len = await page.evaluate(axis => window.__sp.canvas(axis).getBoundingClientRect().height, axis);
  const top = await page.evaluate(axis => window.__sp.canvas(axis).getBoundingClientRect().top, axis);
  await page.mouse.move(thumb.x, thumb.y); await page.mouse.down();
  // Whole-pixel pointer (some engines round input coordinates); allow one pointer pixel of content.
  const y = Math.round(top + len * 0.6), want = (y - top) / len * max, slack = max / len + 1;
  await page.mouse.move(thumb.x, y, { steps: 4 });
  await expect.poll(async () => Math.abs((await state(page, axis)).pos - want), `${why}: thumb drag follows the pointer`).toBeLessThanOrEqual(slack);
  await page.mouse.up();
  await expectReleased(page, axis, `${why} thumb drag`);
}

async function setup(page, servers, mode, slug) {
  await page.goto(`${servers[mode]}/tests/rendering-options/native-dom-page.html`);
  await installHelpers(page, servers.source, slug);
  await page.evaluate(async ({ mode, slug }) => {
    const api = await import(mode === 'source' ? '/src/index.ts' : '/dist/scriptoscope.js');
    const theme = await api.loadTheme(`/themes/${slug}`);
    const manager = new api.WindowManager();
    const content = document.createElement('div');
    content.style.cssText = 'width:100%;height:100%;overflow:auto;box-sizing:border-box';
    content.innerHTML = '<div style="width:900px;height:3000px"></div>';
    const host = await manager.add(theme, { title: 'Parts', width: 220, height: 160 }, {}, { contentEl: content });
    document.body.append(host);
    manager.setPosition(host, 40, 40);
    Object.assign(window.__sp, { manager, host, scrollEl: content });
    await window.__sp.frames(6);
  }, { mode, slug });
  await expect.poll(() => page.evaluate(() => ['vertical', 'horizontal'].every(a => window.__sp.bar(a)?.querySelector('canvas')))).toBe(true);
  // Activate first, so no activation re-render lands mid-press.
  const grip = await page.evaluate(() => {
    const r = window.__sp.host.shadowRoot.querySelector('.scriptoscope-movehandle').getBoundingClientRect();
    return { x: r.x + 40, y: r.y + r.height / 2 };
  });
  await page.mouse.click(grip.x, grip.y);
  await expect.poll(() => page.evaluate(() => window.__sp.host.shadowRoot.querySelector('.scriptoscope-window')?.dataset.scriptoscopeCurrentState)).toBe('active');
  await page.evaluate(() => window.__sp.frames(4));
}

for (const mode of ['source', 'built']) for (const slug of SLUGS) {
  test(`${mode} ${slug}: window scrollbar parts step, page, repeat and press (#567)`, async ({ page, servers }) => {
    test.slow();
    await setup(page, servers, mode, slug);
    await exercise(page, 'vertical', { why: `${mode} ${slug} vertical`, longContent: true });
    await exercise(page, 'horizontal', { why: `${mode} ${slug} horizontal` });
  });
}

for (const mode of ['source', 'built']) for (const slug of SLUGS) {
  test(`${mode} showcase ${slug}: the ResourceForkLib scrollbar parts step, page, repeat and press (#567)`, async ({ page, demo, production, servers }) => {
    test.slow();
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`${mode === 'source' ? demo : production}/showcase.html?theme=${slug}`);
    await expect(page.locator('#powers.scriptoscope-ready')).toBeVisible();
    const host = page.locator('[data-scriptoscope-window-host]', { has: page.getByRole('link', { name: 'Bring your own scheme' }) });
    await expect(host).toHaveCount(1);
    await expect.poll(() => host.evaluate(h => !!h.shadowRoot?.querySelector('[role=scrollbar][aria-orientation=vertical] canvas'))).toBe(true);
    await host.evaluate(h => { h.scrollIntoView({ block: 'center' }); });
    // Wait out the boot wipe (see scrollbar-scroll-sync.spec.mjs).
    await page.evaluate(() => Promise.all([...document.querySelectorAll('[data-scriptoscope-window-host]')]
      .flatMap(h => h.getAnimations()).map(a => a.finished.catch(() => {}))));
    await installHelpers(page, servers.source, slug);
    await host.evaluate(h => { window.__sp.host = h; window.__sp.scrollEl = h.querySelector('.scriptoscope-slot'); });
    // Activate and raise through keyboard focus (#550/#562): a title click can land on a
    // neighbouring card whose oversized frame (evolution) overlaps this one.
    await host.evaluate(h => h.shadowRoot.querySelector('.scriptoscope-movehandle').focus());
    await expect.poll(() => host.evaluate(h => h.shadowRoot.querySelector('.scriptoscope-window')?.dataset.scriptoscopeCurrentState)).toBe('active');
    // The bar is hit-testable at its centre, not under another window.
    expect(await host.evaluate(h => {
      const bar = h.shadowRoot.querySelector('[role=scrollbar][aria-orientation=vertical]'), r = bar.getBoundingClientRect();
      return h.shadowRoot.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2) === bar.querySelector('canvas');
    })).toBe(true);
    await page.evaluate(() => window.__sp.frames(4));
    await exercise(page, 'vertical', { why: `${mode} showcase ${slug}` });
  });
}
