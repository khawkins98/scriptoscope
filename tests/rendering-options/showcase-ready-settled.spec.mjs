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
// records, synchronously: the window-host animations still running, and what a click near
// the bottom of each on-screen window would hit. It also counts reveal animations started.
// The reveal is stretched tenfold (180 ms -> 1.8 s) so that the race does not depend on how
// long the boot's last steps take: a ready signal that does not wait for the reveal is
// caught on every run, not one in ten.
function probe() {
  const reveals = [];
  const animate = Element.prototype.animate;
  Element.prototype.animate = function (keyframes, options) {
    if (!this.hasAttribute?.('data-scriptoscope-window-host')) return animate.call(this, keyframes, options);
    reveals.push(performance.now());
    const stretched = typeof options === 'number' ? options * 10 : { ...options, duration: (options?.duration ?? 0) * 10 };
    return animate.call(this, keyframes, stretched);
  };
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
    await Promise.all(document.getAnimations().map(a => a.finished.catch(() => {})));
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    return window.__ready565.atReady.hits.map(({ index, x, y }) => hit({ index, x, y }));
  };
  window.__ready565 = { reveals, atReady: null, clicks: [], hit, points, settled };
  addEventListener('pointerdown', e => window.__ready565.clicks.push({
    x: e.clientX, y: e.clientY, onWindow: !!e.target.closest?.('[data-scriptoscope-window-host]') }), true);
  new MutationObserver((_, observer) => {
    const root = document.querySelector('#powers');
    if (!root?.classList.contains('scriptoscope-ready')) return;
    observer.disconnect();
    const hosts = [...root.querySelectorAll('[data-scriptoscope-window-host]')];
    window.__ready565.atReady = {
      at: performance.now(),
      running: hosts.flatMap(h => h.getAnimations()).filter(a => a.playState === 'running').length,
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
