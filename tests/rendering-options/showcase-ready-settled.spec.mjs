import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { expect } from '@playwright/test';
import { test as demoTest } from './demo-fixtures.mjs';

// #565: `.scriptoscope-ready` on the showcase root means "interactive". The demo's boot
// reveal (a clip-path animation on every window host, demo/explicit-host.mjs) hides the
// lower part of a window while it runs, and a click there falls through to the page.
// The class must therefore land only after every reveal has finished.
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

// Runs in the page before any demo script. At the moment `scriptoscope-ready` is added it
// records, synchronously: the window-host animations not yet finished, and what a click near
// the bottom of each on-screen window would hit. It also counts reveal animations started.
// The reveal is stretched tenfold (180 ms -> 1.8 s) so that the race does not depend on how
// long the boot's last steps take: a ready signal that does not wait for the reveal is
// caught on every run, not one in ten. `stall` then stops the reveal's clock ('slow' plays it
// at 1 %, 'paused' pauses it, 'zero' sets its playback rate to 0, which `finish()` rejects),
// as an off-screen iframe or other code would. `pulse` reports the
// document hidden for the length of one synchronous `visibilitychange` dispatch every 40 ms;
// `visibilityState` reads 'visible' at any other moment, so only a handler that reacts to
// the event (not a one-off visibility check) can finish the reveals.
function probe({ stall = null, pulse = false } = {}) {
  const reveals = [], animations = [];
  const animate = Element.prototype.animate;
  Element.prototype.animate = function (keyframes, options) {
    if (!this.hasAttribute?.('data-scriptoscope-window-host')) return animate.call(this, keyframes, options);
    reveals.push(performance.now());
    const stretched = typeof options === 'number' ? options * 10 : { ...options, duration: (options?.duration ?? 0) * 10 };
    const animation = animate.call(this, keyframes, stretched);
    if (stall === 'slow') animation.playbackRate = 0.01;
    if (stall === 'paused') animation.pause();
    if (stall === 'zero') animation.playbackRate = 0;
    animations.push(animation);
    return animation;
  };
  const unfinished = () => animations.filter(a => a.playState !== 'finished' && a.playState !== 'idle').length;
  let hidden = false, finishedByHidden = false;
  if (pulse) {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => hidden ? 'hidden' : 'visible' });
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
    const timer = setInterval(() => {
      if (!animations.length) return;
      const before = unfinished();
      hidden = true;
      try { document.dispatchEvent(new Event('visibilitychange')); } finally { hidden = false; }
      if (before && !unfinished()) finishedByHidden = true;
      if (window.__ready565.atReady) clearInterval(timer);
    }, 40);
  }
  const points = () => [...document.querySelectorAll('#powers [data-scriptoscope-window-host]')].flatMap((host, index) => {
    const r = host.getBoundingClientRect();
    const x = Math.round(r.x + r.width / 2), y = Math.round(r.y + r.height * 0.85);
    return x > 0 && x < innerWidth && y > 0 && y < innerHeight ? [{ index, x, y }] : [];
  });
  const hit = ({ index, x, y }) => {
    const el = document.elementFromPoint(x, y);
    const host = el?.closest('[data-scriptoscope-window-host]');
    return { index, x, y, onWindow: !!host,
      window: host ? [...document.querySelectorAll('#powers [data-scriptoscope-window-host]')].indexOf(host) : -1,
      target: el ? `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}.${[...el.classList].join('.')}` : null };
  };
  // What the same points hit once every window animation has finished (the settled page).
  const settled = async () => {
    // Bounded, so a stalled reveal fails the assertions instead of timing the test out.
    await Promise.race([Promise.all(document.getAnimations().map(a => a.finished.catch(() => {}))),
      new Promise(r => setTimeout(r, 3000))]);
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    return window.__ready565.atReady.hits.map(({ index, x, y }) => hit({ index, x, y }));
  };
  window.__ready565 = { reveals, atReady: null, clicks: [], hit, points, settled, finishedByHidden: () => finishedByHidden };
  addEventListener('pointerdown', e => window.__ready565.clicks.push({
    x: e.clientX, y: e.clientY, onWindow: !!e.target.closest?.('[data-scriptoscope-window-host]') }), true);
  new MutationObserver((_, observer) => {
    const root = document.querySelector('#powers');
    if (!root?.classList.contains('scriptoscope-ready')) return;
    observer.disconnect();
    const hosts = [...root.querySelectorAll('[data-scriptoscope-window-host]')];
    window.__ready565.atReady = {
      at: performance.now(),
      running: hosts.flatMap(h => h.getAnimations()).filter(a => a.playState !== 'finished' && a.playState !== 'idle').length,
      sinceLastReveal: performance.now() - reveals.at(-1),
      finishedByHidden,
      states: animations.map(a => a.playState),
      clips: hosts.map(h => getComputedStyle(h).clipPath),
      hits: points().map(hit),
    };
  }).observe(document, { subtree: true, attributes: true, attributeFilter: ['class'] });
}

for (const mode of ['source', 'built']) {
  test(`${mode} showcase: a window is clickable the moment scriptoscope-ready lands (#565)`, async ({ page, demo, production }) => {
    await page.addInitScript(probe);
    await page.goto(`${mode === 'source' ? demo : production}/showcase.html?theme=windows-95`);
    await page.waitForFunction(() => window.__ready565.atReady);
    // A real pointer click straight away, at the bottom of the first on-screen window.
    const target = await page.evaluate(() => window.__ready565.atReady.hits[0]);
    expect(target, 'an on-screen window to click').toBeTruthy();
    await page.mouse.click(target.x, target.y);
    const settled = await page.evaluate(() => window.__ready565.settled());
    const result = await page.evaluate(() => window.__ready565);
    expect(result.reveals.length, 'the showcase still plays its boot reveal').toBeGreaterThan(0);
    expect(result.atReady.running, 'no window reveal still running at ready').toBe(0);
    expect(result.atReady.hits.length).toBeGreaterThan(0);
    // Windows overlap in the card cascade, so the reference is the settled page, not the
    // window the point was taken from: at ready a click must hit what it hits once settled.
    expect(result.atReady.hits, 'clicks at ready hit what they hit once settled').toEqual(settled);
    for (const h of result.atReady.hits) expect(h, `click at ready lands on a window, not ${h.target}`).toMatchObject({ onWindow: true });
    expect(result.clicks.at(-1), 'the real click lands on a window').toMatchObject({ onWindow: true });
  });

  // A reveal whose clock stops (hidden tab, off-screen iframe, other code) must not hold
  // ready back: the boot finishes it once its wait has lasted twice the 180 ms reveal. The
  // bound allows for the boot steps between the last reveal starting and that wait.
  // The probe cannot see when that wait starts, so the bound is measured from the last
  // reveal start and has to absorb the boot tail too. 1000 ms was too tight on a loaded CI
  // runner (1006 ms, chromium-dpr2, run 41202348318; up to 1352 ms locally under 4x CDP CPU
  // throttling). 2000 ms still discriminates: without the fallback the 'slow' reveal (1.8 s
  // at 1 %) ends after 180 s, 90x the bound, and 'paused' and 'zero' never end, so ready
  // never lands and the 15 s wait below fails (7.5x the bound).
  const STALL_READY_BOUND_MS = 2000;
  for (const stall of ['slow', 'paused', 'zero']) {
    test(`${mode} showcase: a ${stall} reveal is finished and ready still lands within the fallback bound (#565)`, async ({ page, demo, production }) => {
      await page.addInitScript(probe, { stall });
      await page.goto(`${mode === 'source' ? demo : production}/showcase.html?theme=windows-95`);
      await page.waitForFunction(() => window.__ready565.atReady, null, { timeout: 15_000 });
      const settled = await page.evaluate(() => window.__ready565.settled());
      const result = await page.evaluate(() => window.__ready565);
      expect(result.reveals.length).toBeGreaterThan(0);
      expect(result.atReady.sinceLastReveal, 'ready within the 360 ms fallback (plus the boot tail)').toBeLessThan(STALL_READY_BOUND_MS);
      expect(result.atReady.running, 'every reveal finished at ready').toBe(0);
      for (const state of result.atReady.states) expect(['finished', 'idle'], 'reveal finished or cancelled').toContain(state);
      expect(new Set(result.atReady.clips), 'no window still clipped').toEqual(new Set(['none']));
      expect(result.atReady.hits.length).toBeGreaterThan(0);
      expect(result.atReady.hits).toEqual(settled);
      for (const h of result.atReady.hits) expect(h).toMatchObject({ onWindow: true });
    });
  }

  test(`${mode} showcase: the page becoming hidden mid-reveal finishes the reveals (#565)`, async ({ page, demo, production }) => {
    await page.addInitScript(probe, { pulse: true });
    await page.goto(`${mode === 'source' ? demo : production}/showcase.html?theme=windows-95`);
    await page.waitForFunction(() => window.__ready565.atReady);
    const settled = await page.evaluate(() => window.__ready565.settled());
    const result = await page.evaluate(() => window.__ready565);
    expect(result.atReady.finishedByHidden, 'a visibilitychange to hidden finished the running reveals').toBe(true);
    expect(result.atReady.running).toBe(0);
    expect(result.atReady.hits).toEqual(settled);
  });

  // The review's reproduction: Chromium does not advance animations in a cross-origin frame
  // that is not rendered, so without the fallback a below-the-fold embed never became ready.
  // On main it was ready in about 0.4 s; with the fallback, about 1 s (frame timers there are
  // throttled). The bound only separates "ready" from "held until scrolled into view".
  for (const placement of ['offscreen', 'display-none']) {
    test(`${mode} showcase in an unrendered ${placement} cross-origin iframe still becomes ready (#565)`, async ({ page, demo, production }) => {
      const src = `${mode === 'source' ? demo : production}/showcase.html?theme=windows-95`;
      const style = placement === 'offscreen' ? 'position:absolute;top:5000px;width:1200px;height:800px' : 'display:none;width:1200px;height:800px';
      await page.setContent(`<iframe src="${src}" style="${style}"></iframe>`);
      const frame = page.frameLocator('iframe');
      await expect(frame.locator('#powers [data-scriptoscope-window-host]').first()).toBeAttached({ timeout: 30_000 });
      await expect(frame.locator('#powers.scriptoscope-ready'), 'ready without being scrolled into view').toHaveCount(1, { timeout: 5_000 });
      await expect(frame.locator('#powers[data-scriptoscope-loading]')).toHaveCount(0);
    });
  }

  test(`${mode} showcase: reduced motion skips the boot reveal (#565)`, async ({ page, demo, production }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.addInitScript(probe);
    await page.goto(`${mode === 'source' ? demo : production}/showcase.html?theme=windows-95`);
    await page.waitForFunction(() => window.__ready565.atReady);
    const settled = await page.evaluate(() => window.__ready565.settled());
    const result = await page.evaluate(() => window.__ready565);
    expect(result.reveals, 'no reveal animation started').toEqual([]);
    expect(result.atReady.running).toBe(0);
    expect(result.atReady.hits.length).toBeGreaterThan(0);
    expect(result.atReady.hits).toEqual(settled);
    for (const h of result.atReady.hits) expect(h).toMatchObject({ onWindow: true });
  });
}
