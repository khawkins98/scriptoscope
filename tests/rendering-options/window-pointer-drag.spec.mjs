import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { expect } from '@playwright/test';
import { test as demoTest } from './demo-fixtures.mjs';
import { test as harnessTest, openHarness } from './fixtures.mjs';

// #561: like the classic Mac DragWindow, a title-bar press that never changes
// the window's position is no move. A zero-movement press, or jitter under half
// a CSS pixel, must not hand an in-flow host off to absolute, insert the drag
// placeholder, write left/top or fire onChange; the window still activates. A
// real drag still hands off and moves, committing once.
// #563: the title-bar drag and the grow box capture the pointer. pointercancel
// or a lost capture mid-drag reverts: the outline goes, the geometry is the
// pre-drag geometry, nothing commits and no event fires, and a later unrelated
// pointerup does nothing. A captured drag keeps tracking over an element that
// swallows pointermove.

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

const SLUGS = ['windows-95', 'apple-platinum-2'];

// Installed in every page: geometry/state reads plus synthetic cancel helpers.
// The pointer id comes from the real pointerdown, so a cancel targets that pointer.
const PROBE = () => {
  window.__pid = undefined;
  window.__userResize = [];
  addEventListener('pointerdown', e => { window.__pid = e.pointerId; }, true);
  addEventListener('scriptoscope:userresize', e => window.__userResize.push(e.detail), true);
  window.__read = host => {
    const box = el => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; };
    const root = host.shadowRoot;
    const grip = root.querySelector('.scriptoscope-movehandle');
    const corner = root.querySelector('button.scriptoscope-growbox');
    return {
      inline: host.style.position, left: host.style.left, top: host.style.top,
      position: getComputedStyle(host).position, host: box(host),
      chrome: box(root.querySelector('canvas.scriptoscope-chrome')),
      grip: grip && box(grip), corner: corner && box(corner),
      state: root.querySelector('[data-scriptoscope-current-state]')?.dataset.scriptoscopeCurrentState,
      placeholders: document.querySelectorAll('[data-scriptoscope-placeholder]').length,
      outlines: host.querySelectorAll(':scope > div[style*="dotted"]').length,
      userResize: window.__userResize.length,
    };
  };
  // Dispatched at the capture target (the window or the grow box), as a browser does.
  window.__cancel = (host, part, type = 'pointercancel') => {
    const target = part === 'grow' ? host.shadowRoot.querySelector('button.scriptoscope-growbox') : host.shadowRoot.firstElementChild;
    if (type === 'lostpointercapture') { target.releasePointerCapture?.(window.__pid); return; }
    target.dispatchEvent(new PointerEvent(type, { pointerId: window.__pid, pointerType: 'mouse', bubbles: true, composed: true }));
  };
};

const settle = page => page.evaluate(async () => {
  await new Promise(r => setTimeout(r, 300));
  for (let i = 0; i < 2; i++) await new Promise(r => requestAnimationFrame(r));
});
const centre = b => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });

/** Press at `p`, optionally jitter by `jitter` px, release. */
async function press(page, p, jitter = 0) {
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  if (jitter) {
    await page.mouse.move(p.x + jitter, p.y + jitter);
    await page.mouse.move(p.x - jitter, p.y);
  }
  await page.mouse.up();
  await settle(page);
}

/** Geometry, flow state and events must match `before`. */
function expectUnchanged(after, before, why, { flow = true } = {}) {
  if (flow) {
    expect.soft(after.inline, `${why}: inline position`).toBe(before.inline);
    expect.soft(after.position, `${why}: computed position (handoff)`).toBe(before.position);
    expect.soft(after.placeholders, `${why}: placeholder inserted`).toBe(before.placeholders);
    expect.soft([after.left, after.top], `${why}: left/top written`).toEqual([before.left, before.top]);
  }
  expect.soft(after.host, `${why}: host box`).toEqual(before.host);
  expect.soft(after.chrome, `${why}: chrome box`).toEqual(before.chrome);
  expect.soft(after.outlines, `${why}: ghost outline left behind`).toBe(0);
  expect.soft(after.userResize, `${why}: userresize`).toBe(before.userResize);
}

/** Start a drag at `p`, move by (dx, dy), cancel it with `type`, then release and click elsewhere. */
async function cancelledDrag(page, read, cancel, p, { dx = 30, dy = 20, type = 'pointercancel', elsewhere } = {}) {
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.mouse.move(p.x + dx / 2, p.y + dy / 2, { steps: 2 });
  await page.mouse.move(p.x + dx, p.y + dy, { steps: 2 });
  const during = await read();
  await cancel(type);
  await settle(page);
  const cancelled = await read();
  // The browser still has the button down: this release, and an unrelated click, must do nothing.
  await page.mouse.move(p.x + dx + 10, p.y + dy + 10);
  await page.mouse.up();
  await page.mouse.click(elsewhere.x, elsewhere.y);
  await settle(page);
  return { during, cancelled, later: await read() };
}

// ── Showcase: real in-flow declarative windows (Posture B) ───────────────────
const WINDOWS = ['.powers-picker', '.powers-hero-window'];

async function openShowcase(page, base, slug) {
  await page.addInitScript(PROBE);
  await page.goto(`${base}/showcase.html?theme=${slug}`);
  await expect(page.locator('#powers.scriptoscope-ready')).toBeVisible();
  for (const sel of WINDOWS) await expect(page.locator(`${sel}[data-scriptoscope-theme="${slug}"]`)).toHaveCount(1);
  await page.locator(WINDOWS[0]).scrollIntoViewIfNeeded();
  let prev = '';
  await expect.poll(async () => {
    const s = JSON.stringify(await Promise.all(WINDOWS.map(sel => readShowcase(page, sel)))); const same = s === prev; prev = s; return same;
  }, { intervals: [250] }).toBe(true);
}
const readShowcase = (page, sel) => page.locator(sel).first().evaluate(h => window.__read(h));

for (const mode of ['source', 'production']) {
  for (const slug of SLUGS) {
    test(`${mode}: ${slug} showcase title-bar press without movement or with 0.4 px jitter only activates (#561)`, async ({ page, demo, production }) => {
      await openShowcase(page, mode === 'source' ? demo : production, slug);
      for (const jitter of [0, 0.4]) {
        // Alternate between the two windows so each press activates an inactive one.
        for (const [sel, other] of [[WINDOWS[0], WINDOWS[1]], [WINDOWS[1], WINDOWS[0]], [WINDOWS[0], WINDOWS[1]]]) {
          const before = await readShowcase(page, sel);
          expect(before.position, `${sel} starts in flow`).not.toBe('absolute');
          await press(page, centre(before.grip), jitter);
          const after = await readShowcase(page, sel);
          const why = `${slug} ${sel} ${jitter ? `${jitter} px jitter` : 'zero-movement'} press`;
          expectUnchanged(after, before, why);
          expect.soft(after.state, `${why}: window activates`).toBe('active');
          expect.soft((await readShowcase(page, other)).state, `${why}: other window deactivates`).toBe('inactive');
        }
      }
    });

    test(`${mode}: ${slug} showcase title-bar drag hands off and moves; a cancelled drag or grow reverts (#561, #563)`, async ({ page, demo, production }) => {
      await openShowcase(page, mode === 'source' ? demo : production, slug);
      const [picker, hero] = WINDOWS;
      const elsewhere = await page.evaluate(() => { const r = document.querySelector('#powers').getBoundingClientRect(); return { x: r.x + 4, y: r.y + 4 }; });

      // Cancelled title-bar drag: the window returns to its pre-drag place.
      let before = await readShowcase(page, hero);
      let run = await cancelledDrag(page, () => readShowcase(page, hero), type => page.locator(hero).first().evaluate((h, t) => window.__cancel(h, 'title', t), type), centre(before.grip), { elsewhere });
      expect(Math.round(run.during.chrome.x - before.chrome.x), `${slug}: hero followed the pointer before the cancel`).toBe(30);
      expectUnchanged(run.cancelled, before, `${slug} hero cancelled drag`, { flow: false });
      expectUnchanged(run.later, before, `${slug} hero release + click after the cancel`, { flow: false });

      // Cancelled grow: the outline goes, the size is unchanged, no userresize.
      before = await readShowcase(page, picker);
      run = await cancelledDrag(page, () => readShowcase(page, picker), type => page.locator(picker).first().evaluate((h, t) => window.__cancel(h, 'grow', t), type), centre(before.corner), { dx: -40, dy: 30, elsewhere });
      expect(run.during.outlines, `${slug}: picker grow outline shown before the cancel`).toBe(1);
      expectUnchanged(run.cancelled, before, `${slug} picker cancelled grow`, { flow: false });
      expectUnchanged(run.later, before, `${slug} picker release + click after the cancel`, { flow: false });

      // A real drag still hands an in-flow host off and moves it.
      before = await readShowcase(page, picker);
      const p = centre(before.grip);
      await page.mouse.move(p.x, p.y);
      await page.mouse.down();
      await page.mouse.move(p.x + 30, p.y + 20, { steps: 6 });
      await page.mouse.up();
      await settle(page);
      const after = await readShowcase(page, picker);
      expect(after.inline, `${slug}: dragged picker is absolute`).toBe('absolute');
      expect(Math.round(after.chrome.x - before.chrome.x), `${slug}: picker moved in x`).toBe(30);
      expect(Math.round(after.chrome.y - before.chrome.y), `${slug}: picker moved in y`).toBe(20);
      expect(after.userResize, `${slug}: no userresize from a move`).toBe(0);
    });
  }
}

// ── Harness: an in-flow declarative window and an imperative absolute window ─
const SOURCE = `<article data-scriptoscope-window data-scriptoscope-title="In flow">
  <p>Press the title bar without moving.</p>
</article>`;

async function setup(page, servers, mode, slug) {
  await openHarness(page, servers, mode);
  await page.evaluate(PROBE);
  await page.evaluate(async ({ mode, slug, source }) => {
    const api = await import(mode === 'source' ? '/src/index.ts' : '/dist/scriptoscope.js');
    const declarative = await import(mode === 'source' ? '/src/declarative/index.ts' : '/dist/declarative.js');
    const theme = await api.loadTheme(`/themes/${slug}`);
    const manager = new api.WindowManager();
    const changes = new Map();
    manager.setChangeListener(host => changes.set(host, (changes.get(host) ?? 0) + 1));
    const container = document.createElement('div');
    container.style.cssText = 'width: 420px; margin: 24px;';
    container.innerHTML = source;
    document.body.prepend(container);
    const flow = (await declarative.ScriptoscopeWindow.promote(container.querySelector('[data-scriptoscope-window]'), { manager, theme })).host;
    const content = document.createElement('div');
    content.textContent = 'Imperative';
    const abs = await manager.add(theme, { title: 'Absolute', width: 220, height: 140 }, {}, { contentEl: content });
    document.body.prepend(abs);
    manager.setPosition(abs, 640, 40);
    // Swallows pointermove before it reaches document: only a captured drag tracks across it.
    const blocker = document.createElement('div');
    blocker.style.cssText = 'position: fixed; left: 0; top: 500px; width: 100vw; height: 300px; z-index: 0; background: #eee;';
    blocker.addEventListener('pointermove', e => e.stopPropagation());
    document.body.append(blocker);
    await new Promise(r => setTimeout(r, 400));
    changes.clear();
    window.__h = { manager, changes, hosts: { flow, abs } };
  }, { mode, slug, source: SOURCE });
}
const read = (page, which) => page.evaluate(w => {
  const host = window.__h.hosts[w];
  return { ...window.__read(host), changes: window.__h.changes.get(host) ?? 0 };
}, which);
// Activate through keyboard focus (#562), then zero the counters: activation re-renders and
// notifies onChange, so a position commit is only observable on an already-active window.
const activate = async (page, which) => {
  await page.evaluate(w => window.__h.hosts[w].shadowRoot.querySelector('.scriptoscope-movehandle').focus(), which);
  await settle(page);
  expect((await read(page, which)).state, `${which} activated by focus`).toBe('active');
  await page.evaluate(() => window.__h.changes.clear());
};
const cancelOf = (page, which, part) => type => page.evaluate(({ w, part, type }) => window.__cancel(window.__h.hosts[w], part, type), { w: which, part, type });

for (const mode of ['source', 'built']) {
  for (const slug of SLUGS) {
    harnessTest(`${mode}: ${slug} title-bar press without movement neither hands off nor commits, but activates (#561)`, async ({ page, servers }) => {
      await setup(page, servers, mode, slug);
      for (const jitter of [0, 0.4]) {
        for (const [which, other] of [['flow', 'abs'], ['abs', 'flow'], ['flow', 'abs']]) {
          const before = await read(page, which);
          await press(page, centre(before.grip), jitter);
          const after = await read(page, which);
          const why = `${slug} ${which} ${jitter ? `${jitter} px jitter` : 'zero-movement'} press`;
          expectUnchanged(after, before, why);
          expect.soft(after.state, `${why}: window activates`).toBe('active');
          expect.soft((await read(page, other)).state, `${why}: other window deactivates`).toBe('inactive');
          // Pressed again while active: no render, so any onChange would be a position commit.
          await page.evaluate(() => window.__h.changes.clear());
          await press(page, centre(before.grip), jitter);
          const again = await read(page, which);
          expectUnchanged(again, before, `${why} on the active window`);
          expect.soft(again.changes, `${why} on the active window: onChange (position commit)`).toBe(0);
        }
      }
      expect((await read(page, 'flow')).position, `${slug}: in-flow window stays in flow`).toBe('static');
    });

    harnessTest(`${mode}: ${slug} real title-bar drag and keyboard move still hand off and commit once (#561)`, async ({ page, servers }) => {
      await setup(page, servers, mode, slug);
      await activate(page, 'flow');
      const before = await read(page, 'flow');
      expect(before.position).toBe('static');
      const p = centre(before.grip);
      await page.mouse.move(p.x, p.y);
      await page.mouse.down();
      await page.mouse.move(p.x + 0.6, p.y);
      await page.mouse.move(p.x + 25, p.y + 15, { steps: 4 });
      await page.mouse.up();
      await settle(page);
      const dragged = await read(page, 'flow');
      expect(dragged.position, `${slug}: dragged host handed off`).toBe('absolute');
      expect(dragged.placeholders, `${slug}: placeholder inserted`).toBe(before.placeholders + 1);
      expect(Math.round(dragged.chrome.x - before.chrome.x)).toBe(25);
      expect(Math.round(dragged.chrome.y - before.chrome.y)).toBe(15);
      expect(dragged.changes, `${slug}: drag commits once`).toBe(1);

      // Keyboard move (unchanged by #561): one handoff-free 8 px step on the absolute window, one commit.
      await activate(page, 'abs');
      const abs = await read(page, 'abs');
      await page.evaluate(() => {
        const btn = window.__h.hosts.abs.shadowRoot.querySelector('.scriptoscope-movehandle');
        btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      });
      await settle(page);
      const moved = await read(page, 'abs');
      expect(Math.round(moved.chrome.x - abs.chrome.x), `${slug}: keyboard step`).toBe(8);
      expect(moved.changes, `${slug}: keyboard move commits once`).toBe(1);
    });

    harnessTest(`${mode}: ${slug} cancelled title-bar drag and grow revert; captured drags track outside the window (#563)`, async ({ page, servers }) => {
      await setup(page, servers, mode, slug);
      const elsewhere = { x: 1200, y: 300 };
      for (const which of ['flow', 'abs']) {
        await activate(page, which);
        for (const type of ['pointercancel', 'lostpointercapture']) {
          let before = await read(page, which);
          let run = await cancelledDrag(page, () => read(page, which), cancelOf(page, which, 'title'), centre(before.grip), { type, elsewhere });
          const why = `${slug} ${which} title drag ended by ${type}`;
          expect(Math.round(run.during.chrome.x - before.chrome.x), `${why}: followed the pointer first`).toBe(30);
          expectUnchanged(run.cancelled, before, why, { flow: false });
          expectUnchanged(run.later, before, `${why}, then release + click`, { flow: false });
          expect.soft(run.later.changes, `${why}: onChange`).toBe(0);

          before = await read(page, which);
          run = await cancelledDrag(page, () => read(page, which), cancelOf(page, which, 'grow'), centre(before.corner), { type, elsewhere });
          const grow = `${slug} ${which} grow ended by ${type}`;
          expect(run.during.outlines, `${grow}: outline shown first`).toBe(1);
          expectUnchanged(run.cancelled, before, grow, { flow: false });
          expectUnchanged(run.later, before, `${grow}, then release + click`, { flow: false });
          expect.soft(run.later.changes, `${grow}: onChange`).toBe(0);
        }
      }

      // The grow box's outline keeps following over the blocker (window still at the top).
      await activate(page, 'abs');
      let before = await read(page, 'abs');
      let p = centre(before.corner);
      const down = 600 - p.y;
      await page.mouse.move(p.x, p.y);
      await page.mouse.down();
      await page.mouse.move(p.x + 10, p.y + 10, { steps: 2 });
      await page.mouse.move(p.x + 30, p.y + down, { steps: 3 });
      const growing = await page.evaluate(() => {
        const o = window.__h.hosts.abs.querySelector(':scope > div[style*="dotted"]'); return o && { w: parseFloat(o.style.width), h: parseFloat(o.style.height) };
      });
      await page.mouse.up();
      await settle(page);
      expect(growing, `${slug}: grow outline present over the blocker`).not.toBeNull();
      expect(Math.round(growing.h - before.host.h), `${slug}: grow outline tracks over the blocker`).toBe(Math.round(down));
      expect(Math.round(growing.w - before.host.w)).toBe(30);
      // Then drag its title bar down over the blocker: still tracking mid-drag.
      await page.evaluate(() => window.__h.changes.clear());
      before = await read(page, 'abs');
      p = centre(before.grip);
      const into = 560 - p.y;
      await page.mouse.move(p.x, p.y);
      await page.mouse.down();
      await page.mouse.move(p.x, p.y + into / 2, { steps: 3 });
      await page.mouse.move(p.x - 40, p.y + into, { steps: 3 });
      const mid = await read(page, 'abs');
      await page.mouse.up();
      await settle(page);
      expect(Math.round(mid.chrome.y - before.chrome.y), `${slug}: title drag tracks over the blocker`).toBe(Math.round(into));
      expect(Math.round(mid.chrome.x - before.chrome.x), `${slug}: title drag tracks over the blocker in x`).toBe(-40);
      expect((await read(page, 'abs')).changes, `${slug}: drag commits once`).toBe(1);
    });
  }
}
