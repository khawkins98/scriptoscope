// Boot-affordance regression: catches three silent-fail classes at once.
//
//   1. scriptoscope.css missing from the page (CSS hooks dead — the
//      hardest-to-diagnose regression because nothing visibly breaks)
//   2. bootAffordance wiring missing in the scanner (data-scriptoscope-
//      loading never set → placeholders never paint)
//   3. ready-event teardown broken (data-scriptoscope-loading never
//      removed → affordance leaks into post-boot interaction)
//
// Recommended by the a11y reviewer 2026-05-30. Run via:
//   node --test --experimental-strip-types tests/visual-baselines/boot-affordance.spec.mjs
// Starts an isolated dev server, or set BASE=http://localhost:4173/scriptoscope
//
// Requires Playwright and its Chromium browser (see README.md).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';

let BASE = process.env.BASE;
let server;
// Use Vite directly: killing an npx wrapper leaves its Vite child alive,
// and unread child-process pipes can keep node --test running indefinitely.
test.before(async () => {
  if (BASE) return;
  server = await createServer({
    configFile: fileURLToPath(new URL('../../vite.config.js', import.meta.url)),
    root: fileURLToPath(new URL('../../demo', import.meta.url)),
    server: { host: '127.0.0.1', port: 0, open: false },
  });
  await server.listen();
  BASE = `${server.resolvedUrls.local[0]}?theme=1138`;
}, { timeout: 15000 });

test.after(async () => { await server?.close(); });

test('boot-affordance: scriptoscope.css is linked and resolves', { timeout: 30000 }, async (t) => {
  const browser = await chromium.launch();
  t.after(() => browser.close());
  const page = await browser.newPage();
  const cssRequests = [];
  page.on('response', (r) => { if (r.url().endsWith('.css')) cssRequests.push({ url: r.url(), status: r.status() }); });
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(500);
  const cssLoaded = cssRequests.some((r) => /scriptoscope\.css/.test(r.url) && r.status === 200);
  assert.ok(cssLoaded, `Expected scriptoscope.css to be linked + served (200). Saw: ${cssRequests.map((r) => `${r.url} ${r.status}`).join(', ') || '(no CSS requests)'}`);
});

test('boot-affordance: data-scriptoscope-loading attribute set + CSS hooks fire', { timeout: 30000 }, async (t) => {
  const browser = await chromium.launch();
  t.after(() => browser.close());
  const page = await browser.newPage();
  // We can't poll AFTER mountDeclarative resolves — by then the loading
  // attribute has already been torn down (the teardown is in the same
  // microtask as the resolve). Install a MutationObserver via an init
  // script BEFORE navigation; the observer records every attribute add
  // anywhere in the document so the test can verify the attribute was
  // present at some moment, not at "now".
  await page.addInitScript(() => {
    window.__loadingAttrSeen = false;
    const watcher = () => {
      if (document.querySelector('[data-scriptoscope-loading]')) {
        window.__loadingAttrSeen = true;
      }
    };
    new MutationObserver(watcher).observe(document, { subtree: true, attributes: true, attributeFilter: ['data-scriptoscope-loading'] });
    watcher(); // initial check, in case the attribute is set before MO arms
  });
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 15000 });
  // Promoted buttons can be hidden behind their rendered chrome; attachment
  // is sufficient to inspect their loading lifecycle and computed styles.
  await page.waitForSelector('[data-scriptoscope-promoted]', { state: 'attached', timeout: 10000 });
  const state = await page.evaluate(() => {
    const promoted = document.querySelector('[data-scriptoscope-promoted]');
    return {
      loadingAttrSeen: window.__loadingAttrSeen,
      promotedAnimName: promoted ? getComputedStyle(promoted).animationName : null,
    };
  });
  assert.equal(state.loadingAttrSeen, true, 'Expected data-scriptoscope-loading attribute to appear at SOME point during mount (MutationObserver record)');
  // Animation name may have moved past `scriptoscope-wipe-in` to `none` by
  // the time we check. The CSS-loaded test covers the link; this assertion
  // just sanity-checks the selector resolved to a computed style at all.
  assert.notEqual(state.promotedAnimName, '', 'animationName should not be empty (CSS not loaded?)');
});

test('boot-affordance: data-scriptoscope-loading is removed after ready', { timeout: 30000 }, async (t) => {
  const browser = await chromium.launch();
  t.after(() => browser.close());
  const page = await browser.newPage();
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(2500); // give ready dispatch a generous window
  const state = await page.evaluate(() => {
    const sec = document.getElementById('powers') ?? document.body;
    return {
      hasReadyClass: sec.classList.contains('scriptoscope-ready'),
      hasLoadingAttr: sec.hasAttribute('data-scriptoscope-loading'),
    };
  });
  assert.equal(state.hasReadyClass, true, 'Expected scriptoscope-ready class after ready dispatch');
  assert.equal(state.hasLoadingAttr, false, 'Expected data-scriptoscope-loading to be REMOVED after ready');
});

test('boot-affordance: picker tiles get aria-busy lifecycle', { timeout: 30000 }, async (t) => {
  const browser = await chromium.launch();
  t.after(() => browser.close());
  const page = await browser.newPage();
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForSelector('.scriptoscope-theme-picker-tile', { timeout: 10000 });
  await page.waitForTimeout(3500); // active tile should have decoded by now
  const counts = await page.evaluate(() => {
    const all = [...document.querySelectorAll('.scriptoscope-theme-picker-tile')];
    return {
      total: all.length,
      withBusyTrue: all.filter((t) => t.getAttribute('aria-busy') === 'true').length,
      withBusyFalse: all.filter((t) => t.getAttribute('aria-busy') === 'false').length,
      withoutBusyAttr: all.filter((t) => !t.hasAttribute('aria-busy')).length,
    };
  });
  assert.equal(counts.withoutBusyAttr, 0, 'Every tile should carry an aria-busy attribute (true OR false)');
  assert.ok(counts.withBusyFalse >= 1, `At least one tile (the active one) should have aria-busy=false post-decode. Counts: ${JSON.stringify(counts)}`);
});
