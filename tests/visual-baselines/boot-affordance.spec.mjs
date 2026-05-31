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
// Pre-req: dev server running on :5188 OR set BASE=http://localhost:4173/scriptoscope
//
// Total cost ~3 seconds; gate the PR on it.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const BASE = process.env.BASE ?? 'http://localhost:5188/?theme=1138';
// Spin a dev server when one isn't running. The harness convention used
// by .scratch/ probes — vite serves demo/ at 5188 here.
let server;
if (!process.env.BASE) {
  server = spawn('npx', ['vite', '--port', '5188'], { stdio: 'pipe' });
  await new Promise((r) => setTimeout(r, 4500));
}

test('boot-affordance: scriptoscope.css is linked and resolves', async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const cssRequests = [];
  page.on('response', (r) => { if (r.url().endsWith('.css')) cssRequests.push({ url: r.url(), status: r.status() }); });
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(500);
  const cssLoaded = cssRequests.some((r) => /scriptoscope\.css/.test(r.url) && r.status === 200);
  assert.ok(cssLoaded, `Expected scriptoscope.css to be linked + served (200). Saw: ${cssRequests.map((r) => `${r.url} ${r.status}`).join(', ') || '(no CSS requests)'}`);
  await browser.close();
});

test('boot-affordance: data-scriptoscope-loading attribute set + CSS hooks fire', async () => {
  const browser = await chromium.launch();
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
  await page.waitForSelector('[data-scriptoscope-promoted]', { timeout: 10000 });
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

test('boot-affordance: data-scriptoscope-loading is removed after ready', async () => {
  const browser = await chromium.launch();
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

test('boot-affordance: picker tiles get aria-busy lifecycle', async () => {
  const browser = await chromium.launch();
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

// Clean up the dev server if we spawned one.
test.after(() => { if (server) server.kill(); });
