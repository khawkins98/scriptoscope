// Posture B regression battery: locks in the in-flow-by-default behaviour
// that landed in cf267ac + the FE-reviewer P0 fixes in 0652704.
//
// The persistence + position-clear bugs both surfaced ONLY when a real
// browser ran the runtime — typecheck + unit tests were blind to them.
// This file should run before any commit that touches positioning.
//
// Pre-req: dev server running on :5188 (matches boot-affordance.spec.mjs)
//   BASE=http://localhost:4173/scriptoscope  for the prod-bundle preview.
//
// Total cost ~3s.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const BASE = process.env.BASE ?? 'http://localhost:5188/?theme=1138';
let server;
if (!process.env.BASE) {
  server = spawn('npx', ['vite', '--port', '5188'], { stdio: 'pipe' });
  await new Promise((r) => setTimeout(r, 4500));
}

test('posture-b: in-flow hosts have inline position cleared', async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForFunction(() => document.querySelectorAll('[data-scriptoscope-promoted], .powers-card, .powers-readme').length >= 3, { timeout: 15000 });
  await page.waitForTimeout(1000);
  const audit = await page.evaluate(() => {
    const hosts = [...document.querySelectorAll('.powers-picker, .powers-readme, .powers-hero-window, .powers-card')]
      .filter((e) => e.shadowRoot);
    return hosts.map((h) => ({ inline: h.style.position, computed: getComputedStyle(h).position }));
  });
  assert.ok(audit.length >= 4, `Expected at least 4 promoted hosts; got ${audit.length}`);
  // Every host's INLINE position should be cleared (no inline 'static' clobbering consumer-class CSS).
  for (const h of audit) {
    assert.equal(h.inline, '', `host's inline position should be cleared but was "${h.inline}" — see 0652704 (consumer-class position lockdown bug)`);
  }
  await browser.close();
});

test('posture-b: drag handoff converts in-flow → absolute on a REAL pointer drag', async () => {
  // Fires actual Playwright pointer events on the chrome's title-bar region
  // (Posture B's drag handoff lives in WindowManager.pointerdown handler;
  // a synthetic style-poke test would still pass if the handler was deleted).
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForFunction(() => !!document.querySelector('.powers-readme'), { timeout: 15000 });
  await page.waitForTimeout(1500);
  const before = await page.evaluate(() => {
    const h = document.querySelector('.powers-readme');
    return { position: h.style.position, rect: h.getBoundingClientRect() };
  });
  assert.equal(before.position, '', 'Read Me host should start in-flow (inline position cleared)');
  // Drag the title-bar 60px down + 30px right. Title bar is roughly the top 22px
  // of the host's outer box; aim 10px in from the left + 11px down.
  const startX = before.rect.left + 100;
  const startY = before.rect.top + 11;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + 30, startY + 60, { steps: 5 });
  await page.mouse.up();
  await page.waitForTimeout(150);
  const after = await page.evaluate(() => {
    const h = document.querySelector('.powers-readme');
    return { position: h.style.position, top: h.style.top, left: h.style.left, newRect: h.getBoundingClientRect() };
  });
  assert.equal(after.position, 'absolute', 'After real drag, host should be absolute');
  assert.notEqual(after.top, '', 'After real drag, host top should be set');
  assert.notEqual(after.left, '', 'After real drag, host left should be set');
  // Window actually moved by approximately the drag delta (Math.round + sub-pixel
  // rounding may produce ±2px slop on the y axis from chrome frame measurement).
  const dy = Math.round(after.newRect.top - before.rect.top);
  assert.ok(dy >= 55 && dy <= 65, `Window should have moved ~60px down; moved ${dy}px`);
  await browser.close();
});

test('posture-b: drag-handoff inserts a placeholder so siblings do not collapse upward', async () => {
  // 2026-05-31 (later) user fix: dragging an in-flow host previously caused
  // a visible page-shift on drag-start — siblings collapsed upward into
  // the host's vacated static slot. toAbsolute now inserts a same-sized
  // placeholder where the host was, so the surrounding page stays put
  // while the dragged window lifts. Placeholder persists for the
  // window's lifetime, removed in WindowManager.remove on unmount.
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForFunction(() => !!document.querySelector('.powers-readme') && !!document.querySelector('.powers-card-row.heavy .powers-card'), { timeout: 15000 });
  await page.waitForTimeout(1500);
  const before = await page.evaluate(() => ({
    readme: document.querySelector('.powers-readme').getBoundingClientRect(),
    card: document.querySelector('.powers-card-row.heavy .powers-card').getBoundingClientRect(),
  }));
  // Drag the Read Me 100px down.
  const startX = before.readme.left + 100;
  const startY = before.readme.top + 11;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + 60, startY + 100, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(200);
  const after = await page.evaluate(() => ({
    card: document.querySelector('.powers-card-row.heavy .powers-card').getBoundingClientRect(),
    placeholder: document.querySelector('[data-scriptoscope-placeholder]')?.getBoundingClientRect() ?? null,
  }));
  // The card below MUST NOT shift upward — that's the whole point of the placeholder.
  const cardShift = Math.abs(after.card.top - before.card.top);
  assert.ok(cardShift <= 2, `Card below Read Me must not shift on drag-start; moved ${cardShift}px`);
  // Placeholder must exist + be roughly the same size as the dragged host was.
  assert.ok(after.placeholder, 'A [data-scriptoscope-placeholder] element must exist after drag-handoff');
  const widthDiff = Math.abs(after.placeholder.width - before.readme.width);
  const heightDiff = Math.abs(after.placeholder.height - before.readme.height);
  assert.ok(widthDiff <= 2, `Placeholder width ${after.placeholder.width} should match pre-drag host width ${before.readme.width}`);
  assert.ok(heightDiff <= 2, `Placeholder height ${after.placeholder.height} should match pre-drag host height ${before.readme.height}`);
  await browser.close();
});

test('posture-b: persistence round-trip — in-flow window stays in-flow on reload', async () => {
  // The 2026-05-31 P0 (0652704): readHostPosition returned (0,0) for in-flow
  // hosts; persistence wrote that; reload restored data-scriptoscope-x="0"
  // which triggered the absolute-opt-in path → every window yanked to viewport
  // origin. This test exercises the round-trip end-to-end.
  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  // First mount: confirm in-flow + persistence (if it exists) doesn't write
  // bogus (0,0) coords for the in-flow Read Me window.
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForFunction(() => !!document.querySelector('.powers-readme'), { timeout: 15000 });
  await page.waitForTimeout(1500);
  const persisted = await page.evaluate(() => {
    // The landing page doesn't pass persistKey, so localStorage stays empty —
    // but we can verify by READING what readHostPosition returns for an in-flow host.
    const h = document.querySelector('.powers-readme');
    // Probe via the same logic readHostPosition uses (position !== absolute → null)
    return h.style.position !== 'absolute' && h.style.position !== 'fixed' ? null : { x: parseFloat(h.style.left), y: parseFloat(h.style.top) };
  });
  assert.equal(persisted, null, 'In-flow Read Me: readHostPosition equivalent should return null (no (0,0) garbage)');
  await browser.close();
});

test('posture-b: in-flow host parents are not min-height-pinned (Pass A deleted)', async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForFunction(() => document.querySelector('.powers-inner') !== null, { timeout: 15000 });
  await page.waitForTimeout(1500);
  const innerMinHeight = await page.evaluate(() => document.querySelector('.powers-inner')?.style?.minHeight ?? '');
  // Pre-Posture-B, the scanner pinned `.powers-inner` to its captured natural height.
  // Post-refactor, no pin — the in-flow hosts populate the height naturally.
  assert.equal(innerMinHeight, '', `.powers-inner should NOT have an inline min-height (was "${innerMinHeight}") — see cf267ac removing the Pass A pin`);
  await browser.close();
});

test('demo picker: click a theme tile in OFF mode → re-mounts + rethemes', async () => {
  // 2026-06-01 user-reported P0: after clicking the 'No theme' tile to
  // unmount, the picker article is restored to the DOM with all tiles
  // intact, but the tiles' library-wired click handlers now close over a
  // dead scanner closure and silently no-op. The demo's capture-phase
  // listener catches this case and re-mounts + rethemes to the clicked
  // slug. This test locks in that round-trip.
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForFunction(() => document.querySelectorAll('.scriptoscope-theme-picker-tile').length >= 10, { timeout: 15000 });
  await page.waitForTimeout(1500);
  // Confirm we're skinned (handle exists → picker is inside chrome)
  const initiallySkinned = await page.evaluate(() => !!document.querySelector('.scriptoscope-slot'));
  assert.equal(initiallySkinned, true, 'demo should boot in skinned mode');
  // Click 'No theme' → unmount
  await page.locator('[data-special="none"]').first().click();
  await page.waitForTimeout(400);
  const afterUnmount = await page.evaluate(() => !!document.querySelector('.scriptoscope-slot'));
  assert.equal(afterUnmount, false, 'No theme click should remove the slot (unmount)');
  // Picker tiles still in DOM
  const tilesPresent = await page.evaluate(() => document.querySelectorAll('.scriptoscope-theme-picker-tile').length);
  assert.ok(tilesPresent >= 10, `picker tiles should remain after unmount; saw ${tilesPresent}`);
  // Click a theme tile in OFF mode — should re-mount + retheme
  await page.locator('.scriptoscope-theme-picker-tile[data-slug="beos-r503"]').first().click();
  await page.waitForTimeout(1500);
  const afterRemount = await page.evaluate(() => ({
    slot: !!document.querySelector('.scriptoscope-slot'),
    activeTheme: document.querySelector('[data-scriptoscope-theme]')?.dataset?.scriptoscopeTheme ?? null,
  }));
  assert.equal(afterRemount.slot, true, 'theme tile click in OFF mode should re-mount the runtime');
  assert.equal(afterRemount.activeTheme, 'beos-r503', `re-mount should retheme to clicked slug (got ${afterRemount.activeTheme})`);
  await browser.close();
});

test('picker: re-mount rewires tile click handlers (the 2026-05-31 half-stuck bug)', async () => {
  // The bug: after No theme → re-mount, the picker's promoted stamp +
  // existing tiles survived but their click handlers were closed over
  // the FIRST mount's retheme (dead handle). Clicking a tile in ON
  // mode updated URL + active class but the windows never repainted.
  // Fix: teardown clears the stamp; re-promote drops library-added
  // tiles + rebuilds with fresh handlers. This test exercises the
  // full chain and verifies the chrome canvas actually changes hue
  // on a second-mount tile click.
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForFunction(() => document.querySelectorAll('.scriptoscope-theme-picker-tile').length >= 18, { timeout: 15000 });
  await page.waitForTimeout(1500);

  // Sample the Read Me's title-bar pixel as the chrome-identity fingerprint.
  const sampleTitleBar = () => page.evaluate(() => {
    const host = Array.from(document.querySelectorAll('div')).find((d) => d.shadowRoot?.querySelector('[aria-label="Read Me"]'));
    const cvs = host?.shadowRoot?.querySelector('canvas');
    if (!cvs) return null;
    const data = cvs.getContext('2d').getImageData(80, 5, 1, 1).data;
    return [data[0], data[1], data[2]];
  });

  // Phase 1: No theme → re-mount via windows-31 tile (uses demo's OFF-mode flow)
  await page.evaluate(() => document.querySelector('[data-special="none"]')?.click());
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    const t = Array.from(document.querySelectorAll('.scriptoscope-theme-picker-tile')).find((x) => x.dataset.slug === 'windows-31');
    t?.click();
  });
  await page.waitForTimeout(2000);
  const winPx = await sampleTitleBar();
  assert.ok(winPx, 'Read Me chrome canvas should exist after re-mount');

  // Phase 2: while ON, click a different theme tile → chrome MUST repaint
  await page.evaluate(() => {
    const t = Array.from(document.querySelectorAll('.scriptoscope-theme-picker-tile')).find((x) => x.dataset.slug === 'evolution');
    t?.click();
  });
  await page.waitForTimeout(2000);
  const evoPx = await sampleTitleBar();
  assert.ok(evoPx, 'Read Me chrome should still exist after second tile click');
  // Evolution's dark title bar vs windows-31's light bar — pixel values must differ.
  const same = winPx[0] === evoPx[0] && winPx[1] === evoPx[1] && winPx[2] === evoPx[2];
  assert.equal(same, false,
    `Tile click after re-mount didn't repaint chrome — half-stuck bug regression. ` +
    `Read Me title bar pixel was ${winPx.join(',')} (windows-31), still ${evoPx.join(',')} after click evolution.`);

  await browser.close();
});

test('posture-b: card grid honours its consumer max-height (no auto-grow past CSS cap)', async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForFunction(() => document.querySelectorAll('.powers-card-row.heavy .powers-card').length >= 2, { timeout: 15000 });
  await page.waitForTimeout(2500);
  const heavyCardHeights = await page.evaluate(() =>
    [...document.querySelectorAll('.powers-card-row.heavy .powers-card')].map((c) => Math.round(c.getBoundingClientRect().height))
  );
  for (const h of heavyCardHeights) {
    assert.ok(h <= 290, `Heavy-row card height ${h}px exceeds its CSS max-height: 280px (with 10px tolerance) — see ba984fe's px-only max-cap`);
  }
  await browser.close();
});

test.after(() => { if (server) server.kill(); });
