import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { test, expect, openHarness } from './fixtures.mjs';
import { test as demoTest } from './demo-fixtures.mjs';

// #526 option (a): the host box is the window's outer box.
//  - The host's rect equals the visible chrome canvas in every placement mode.
//  - Measured/capped sizes (auto-captured rect, extra-*, px max-*) bound the
//    OUTER chrome: content = bound - frame.
//  - data-scriptoscope-width/height stay CONTENT dimensions.
// Everything is read from the public surface: the
// [data-scriptoscope-window-host] element, its open shadow root's
// canvas.scriptoscope-chrome, and the published light-DOM
// .scriptoscope-slot (SCRIPTOSCOPE_SLOT_CLASS) that fills the content area.
// Themes run thick to thin so a frame-thickness bug shows on the first ones.
const THEMES = ['dolphin-som', 'evolution', 'windows-95', 'apple-lisa'];
const TOL = 1;

/** Browser side: load runtime + declarative, keep loaded themes per page. */
async function boot(page, mode) {
  await page.evaluate(async ({ mode }) => {
    const api = await import(mode === 'source' ? '/src/index.ts' : '/dist/scriptoscope.js');
    const declarative = await import(mode === 'source' ? '/src/declarative/index.ts' : '/dist/declarative.js');
    const themes = new Map();
    const theme = slug => {
      if (!themes.has(slug)) themes.set(slug, api.loadTheme(`/themes/${slug}`));
      return themes.get(slug);
    };
    const settle = async () => {
      // Growth/auto-fit observers run on rAF and a short debounce.
      await new Promise(r => setTimeout(r, 400));
      for (let i = 0; i < 3; i++) await new Promise(r => requestAnimationFrame(r));
    };
    const rect = el => { const r = el.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height }; };
    const measure = (win, container) => {
      const host = win.host;
      const canvas = host.shadowRoot?.querySelector('canvas.scriptoscope-chrome');
      const slot = host.querySelector(':scope > .scriptoscope-slot');
      return { host: rect(host), canvas: canvas ? rect(canvas) : null,
        slot: slot ? rect(slot) : null, container: container ? rect(container) : null,
        position: getComputedStyle(host).position };
    };
    window.__hcb = { api, declarative, theme, settle, measure, manager: new api.WindowManager(), live: [] };
  }, { mode });
}

/** Promote one source element inside a fresh 400px container. */
function promoteCase(page, slug, { source, containerStyle = '' }) {
  return page.evaluate(async ({ slug, source, containerStyle }) => {
    const h = window.__hcb;
    for (const w of h.live.splice(0)) { w.win.unmount(); w.container.remove(); }
    const container = document.createElement('div');
    container.style.cssText = `width: 400px; margin: 24px; position: relative; ${containerStyle}`;
    container.innerHTML = source;
    document.body.prepend(container);
    const win = await h.declarative.ScriptoscopeWindow.promote(container.querySelector('[data-scriptoscope-window]'),
      { manager: h.manager, theme: await h.theme(slug) });
    h.live.push({ win, container });
    await h.settle();
    return h.measure(win, container);
  }, { slug, source, containerStyle });
}

const SHORT = '<p>Short body text.</p>';
const TALL = Array.from({ length: 40 }, (_, i) => `<p>Line ${i} of tall content.</p>`).join('');
const CASES = {
  auto: { source: `<article data-scriptoscope-window data-scriptoscope-title="Auto">${SHORT}</article>` },
  declared: { source: `<article data-scriptoscope-window data-scriptoscope-title="Declared" data-scriptoscope-width="300" data-scriptoscope-height="150">${SHORT}</article>` },
  absolute: { source: `<article data-scriptoscope-window data-scriptoscope-title="Absolute" data-scriptoscope-x="20" data-scriptoscope-y="20">${SHORT}</article>`, containerStyle: 'height: 320px;' },
  // Class-based consumer CSS (as on the showcase heavy cards): the class is
  // carried to the host, so the cap is visible on the host's computed style.
  capped: { source: `<style>.hcb-capped { max-height: 280px; overflow: auto; }</style><article class="hcb-capped" data-scriptoscope-window data-scriptoscope-title="Capped">${TALL}</article>` },
};

function expectSameBox(m, label) {
  expect.soft(m.canvas, `${label}: chrome canvas present`).not.toBeNull();
  if (!m.canvas) return;
  for (const k of ['left', 'top', 'width', 'height']) {
    expect.soft(Math.abs(m.host[k] - m.canvas[k]), `${label}: host.${k} ${m.host[k]} vs canvas.${k} ${m.canvas[k]}`).toBeLessThanOrEqual(TOL);
  }
}
function expectOuterBounded(m, label) {
  if (!m.canvas) return;
  expect.soft(m.canvas.width, `${label}: chrome width ${m.canvas.width} within 400px container`).toBeLessThanOrEqual(400 + TOL);
  expect.soft(m.canvas.right, `${label}: chrome right ${m.canvas.right} vs container right ${m.container.right}`).toBeLessThanOrEqual(m.container.right + TOL);
}

for (const mode of ['source', 'built']) {
  for (const slug of THEMES) {
    test(`${mode}: ${slug} host box is the outer chrome box (#526)`, async ({ page, servers }) => {
      await openHarness(page, servers, mode);
      await boot(page, mode);

      // (1)+(2) in-flow auto-sized: host == chrome, chrome outer-bounded by the container.
      const auto = await promoteCase(page, slug, CASES.auto);
      expect.soft(auto.position, 'auto window stays in flow').toBe('static');
      expectSameBox(auto, `${slug} in-flow auto`);
      expectOuterBounded(auto, `${slug} in-flow auto`);

      // (1)+(3) in-flow declared: host == chrome; declared size is the content area.
      const declared = await promoteCase(page, slug, CASES.declared);
      expectSameBox(declared, `${slug} in-flow declared`);
      expect.soft(declared.slot, 'published .scriptoscope-slot present').not.toBeNull();
      if (declared.slot) {
        expect.soft(Math.abs(declared.slot.width - 300), `${slug} declared content width ${declared.slot.width}`).toBeLessThanOrEqual(TOL);
        expect.soft(Math.abs(declared.slot.height - 150), `${slug} declared content height ${declared.slot.height}`).toBeLessThanOrEqual(TOL);
      }
      if (declared.canvas) {
        // The frame is drawn outside the declared content on every side that has one.
        expect.soft(declared.canvas.width, `${slug} declared chrome wider than content`).toBeGreaterThan(300);
        expect.soft(declared.canvas.height, `${slug} declared chrome taller than content`).toBeGreaterThan(150);
        if (declared.slot) {
          expect.soft(declared.slot.left >= declared.canvas.left - TOL && declared.slot.right <= declared.canvas.right + TOL
            && declared.slot.top >= declared.canvas.top - TOL && declared.slot.bottom <= declared.canvas.bottom + TOL,
          `${slug} declared content lies inside the chrome`).toBe(true);
        }
      }

      // (1) absolute (-x/-y): host == chrome.
      const absolute = await promoteCase(page, slug, CASES.absolute);
      expect.soft(absolute.position, 'x/y window is absolute').toBe('absolute');
      expectSameBox(absolute, `${slug} absolute`);

      // (4) a consumer px max-height caps the OUTER chrome.
      const capped = await promoteCase(page, slug, CASES.capped);
      expectSameBox(capped, `${slug} capped`);
      if (capped.canvas) expect.soft(capped.canvas.height, `${slug} capped chrome height ${capped.canvas.height}`).toBeLessThanOrEqual(280 + TOL);
      expectOuterBounded(capped, `${slug} capped`);
    });
  }

  // (5) retheme keeps invariants 1-2 after every switch, thin -> thick -> thin.
  test(`${mode}: retheme apple-lisa -> dolphin-som -> apple-lisa keeps host == outer chrome (#526)`, async ({ page, servers }) => {
    await openHarness(page, servers, mode);
    await boot(page, mode);
    const first = await promoteCase(page, 'apple-lisa', CASES.auto);
    expectSameBox(first, 'apple-lisa initial');
    expectOuterBounded(first, 'apple-lisa initial');
    for (const slug of ['dolphin-som', 'apple-lisa']) {
      const m = await page.evaluate(async ({ slug }) => {
        const h = window.__hcb;
        await h.manager.retheme(await h.theme(slug));
        await h.settle();
        return h.measure(h.live[0].win, h.live[0].container);
      }, { slug });
      expectSameBox(m, `after retheme to ${slug}`);
      expectOuterBounded(m, `after retheme to ${slug}`);
    }
  });
}

// (6) showcase end-to-end: no horizontal page overflow, and no window chrome
// overlaps the footer line. Mirrors showcase-chooser-focus.spec.mjs transports.
const showcaseTest = demoTest.extend({
  production: [async ({}, use) => {
    const base = resolve(process.env.SCRIPTOSCOPE_CHOOSER_DEMO_DIR ?? 'dist/demo');
    const mime = { '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.html': 'text/html', '.wasm': 'application/wasm', '.png': 'image/png', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf' };
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

for (const mode of ['source', 'production']) {
  for (const width of [1280, 1440]) {
    for (const slug of ['evolution', 'dolphin-som']) {
      showcaseTest(`${mode}: showcase ${width}x900 ${slug} has no window overhang (#526)`, async ({ page, demo, production }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(`${mode === 'source' ? demo : production}/showcase.html?theme=${slug}`);
        await expect(page.locator('#powers.scriptoscope-ready')).toBeVisible({ timeout: 30_000 });
        await expect(page.locator('#powers [data-scriptoscope-window-host]')).toHaveCount(8);
        // Let auto-fit observers and late images settle.
        await page.waitForTimeout(1000);
        const r = await page.evaluate(() => {
          // The footer "line" is the divider block: its border-top rule plus
          // the "Compatible with Kaleidoscope" text beneath it.
          const line = [...document.querySelectorAll('#powers .powers-divider')]
            .find(el => el.textContent.includes('Compatible with Kaleidoscope'));
          const box = el => { const b = el.getBoundingClientRect(); return { left: b.left, top: b.top, right: b.right, bottom: b.bottom }; };
          const footer = line ? box(line) : null;
          const overlaps = [], overhangs = [];
          for (const host of document.querySelectorAll('#powers [data-scriptoscope-window-host]')) {
            const canvas = host.shadowRoot?.querySelector('canvas.scriptoscope-chrome');
            if (!canvas) continue;
            const c = box(canvas), h = box(host);
            const name = host.id || host.className;
            if (footer && c.left < footer.right && c.right > footer.left && c.top < footer.bottom && c.bottom > footer.top) {
              overlaps.push({ name, canvas: c });
            }
            // Invariant 1 on the real page: chrome never paints outside its host.
            if (['left', 'top', 'right', 'bottom'].some(k => Math.abs(c[k] - h[k]) > 1)) overhangs.push({ name, host: h, canvas: c });
          }
          return { scrollWidth: document.scrollingElement.scrollWidth, innerWidth, footer, overlaps, overhangs };
        });
        expect.soft(r.footer, 'footer "Compatible with Kaleidoscope" divider found').not.toBeNull();
        expect.soft(r.scrollWidth, `page scrollWidth ${r.scrollWidth} vs innerWidth ${r.innerWidth}`).toBe(r.innerWidth);
        expect.soft(r.overlaps, 'window chrome overlapping the footer line').toEqual([]);
        expect.soft(r.overhangs, 'window chrome extending past its host box').toEqual([]);
      });
    }
  }
}
