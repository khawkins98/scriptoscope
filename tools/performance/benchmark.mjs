// Source runtime benchmark. Start `npm run dev` first, then `npm run bench:render`.
// Report-only: wall-clock ceilings are unsuitable across developer/CI machines.
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const origin = process.env.PERF_URL ?? 'http://127.0.0.1:5173';
const selection = process.env.PERF_THEMES ?? 'dolphin-som,platinum-8';
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } });
  if (process.env.PERF_PROGRESS === '1') page.on('console', message => {
    if (message.text().startsWith('[bench:render]')) process.stderr.write(`${message.text()}\n`);
  });
  // An isolated host avoids demo startup, animations and control polling in samples.
  await page.route('**/performance-benchmark', route => route.fulfill({
    contentType: 'text/html', body: `<!doctype html><html><head>
      <link rel="stylesheet" href="/scriptoscope.css">
      <style>
        @font-face { font-family: Charcoal; src: url('/assets/fonts/virtue.woff') format('woff'); }
        @font-face { font-family: 'Charcoal 12'; src: url('/assets/fonts/charcoal-12.woff') format('woff'); }
      </style></head><body></body></html>`,
  }));
  await page.goto(new URL('/performance-benchmark', origin).href);
  const results = await page.evaluate(async ({ entry, stages, selection }) => {
    const { loadOwnedTheme, renderWindow, WindowManager } = await import(entry);
    let slugs;
    if (selection === 'all') {
      const response = await fetch('/themes-manifest.json');
      if (!response.ok) throw new Error(`Theme manifest request failed: ${response.status}`);
      slugs = (await response.json()).map(theme => theme.slug);
    } else slugs = selection.split(',').map(slug => slug.trim()).filter(Boolean);
    if (!slugs.length) throw new Error('PERF_THEMES must select at least one theme');
    const stageSamples = {};
    if (stages) for (const name of ['prepareChrome', 'prepareRender', 'commitRender', 'applyHit', 'syncTargets', 'wireScrollbars', 'overlayWidgets', 'wireMoveResize']) {
      const original = WindowManager.prototype[name];
      WindowManager.prototype[name] = function (...args) {
        const start = performance.now();
        const record = () => (stageSamples[name] ??= []).push(performance.now() - start);
        try {
          const result = original.apply(this, args);
          if (result?.then) return result.finally(record);
          record(); return result;
        } catch (error) { record(); throw error; }
      };
    }
    await Promise.all([document.fonts.load('16px "Charcoal 12"'), document.fonts.load('12px Charcoal')]);
    const summary = samples => {
      const sorted = [...samples].sort((a, b) => a - b);
      return { medianMs: sorted[Math.floor(sorted.length / 2)], p95Ms: sorted[Math.ceil(sorted.length * .95) - 1], samplesMs: samples };
    };
    const results = [];
    for (const slug of slugs) {
      const theme = await loadOwnedTheme(`/themes/${slug}`);
      try {
        for (const [width, height] of [[480, 320], [1280, 800]]) {
          const opts = { width, height, title: 'Performance benchmark' };
          const render = [];
          const pixels = [];
          for (let i = 0; i < 45; i++) {
            const start = performance.now();
            const win = await renderWindow(theme, { ...opts, state: i % 2 ? 'active' : 'inactive' });
            if (i >= 5) render.push(performance.now() - start);
            if (i >= 43) {
              const canvas = win.querySelector('canvas');
              const image = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
              let hash = 2166136261;
              for (const byte of image.data) hash = Math.imul(hash ^ byte, 16777619);
              pixels.push({ state: i % 2 ? 'active' : 'inactive', width: canvas.width, height: canvas.height, hash: hash >>> 0 });
            }
          }
          const manager = new WindowManager();
          try {
            const first = await manager.add(theme, opts);
            document.body.append(first);
            const second = await manager.add(theme, opts);
            document.body.append(second);
            const focus = [];
            for (let i = 0; i < 45; i++) {
              // The change listener fires after each painted window commits. A
              // focus flip paints both windows; do not time only dispatchEvent.
              const start = performance.now();
              await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => reject(new Error('Focus did not commit both windows')), 10000);
                let commits = 0;
                manager.setChangeListener(() => {
                  if (++commits === 2) { clearTimeout(timeout); resolve(); }
                });
                (i % 2 ? first : second).dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
              });
              if (i >= 5) focus.push(performance.now() - start);
              // Let browser layout/paint run between interactions, outside commit timing.
              await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
            }
            results.push({ slug, width, height, render: summary(render), focusCommit: summary(focus), pixels,
              ...(stages ? { stages: Object.fromEntries(Object.entries(stageSamples).map(([name, samples]) => [name, summary(samples)])) } : {}) });
            for (const name of Object.keys(stageSamples)) delete stageSamples[name];
          } finally {
            manager.dispose();
            // Disposal releases manager state but deliberately leaves caller-owned
            // hosts mounted. Remove this case's hosts before measuring the next one.
            document.body.replaceChildren();
          }
        }
        console.info(`[bench:render] ${slug} complete`);
      } finally { theme.dispose(); }
    }
    return results;
  }, { entry: `/@fs${fileURLToPath(new URL('../../src/index.ts', import.meta.url))}`, stages: process.env.PERF_STAGES === '1', selection });
  console.log(JSON.stringify({ browser: browser.version(), platform: process.platform,
    cpu: os.cpus()[0]?.model, themes: selection, font: 'bundled Charcoal 12 / Virtue, loaded before timing', warmup: 5, samples: 40,
    note: 'Source rendering and synthetic pointer focus to both canvas commits; excludes loading and presentation, not INP.', results }, null, 2));
} finally { await browser.close(); }
