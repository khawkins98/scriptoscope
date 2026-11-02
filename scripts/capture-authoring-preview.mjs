#!/usr/bin/env node
// Capture an authored scheme's review previews: preview.png (the default
// layout at DPR 2) and preview-sizes.png (authoring/preview-layouts/sizes.html
// at DPR 1), at the same viewport for every scheme so they compare side by side.
//
// Usage (with `npm run dev` running):
//   npm run capture:authoring -- authoring/schemes/kingfisher [--base http://localhost:5173]
//   npm run capture:authoring -- authoring/schemes/kingfisher --document --out /tmp/document.png
//       [--width 380 --height 210] (CONTENT pixels; screenshot contains the full outer frame)
//   Add --concept for a composed control scene with progress and active scrollbars.
//
// The viewport fits the widened layouts (frames with 60px+ top bands need
// about 960px). Waits for the page's data-preview-ready flag and fails on a
// load error rather than saving a screenshot of the error message.

import { resolve, relative } from 'node:path';
import { existsSync } from 'node:fs';
import { chromium } from 'playwright';

const args = process.argv.slice(2);
const dir = args.find((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--'));
const base = args.includes('--base') ? args[args.indexOf('--base') + 1] : 'http://localhost:5173';
const opt = (name, fallback) => args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : fallback;
const conceptScene = args.includes('--concept');
const documentOnly = args.includes('--document') || conceptScene;
if (!dir || !existsSync(resolve(dir, 'scheme.rsrc'))) {
  console.error('Usage: npm run capture:authoring -- <scheme dir with scheme.rsrc> [--base http://localhost:5173]');
  process.exit(2);
}
const scheme = '/' + relative(process.cwd(), resolve(dir, 'scheme.rsrc')).split('\\').join('/');

const shots = documentOnly ? [
  { file: opt('out', 'document.png'), query: `&document=1${conceptScene ? '&composition=concept' : ''}&width=${encodeURIComponent(opt('width', '380'))}&height=${encodeURIComponent(opt('height', '210'))}`, viewport: { width: 2200, height: 2200 }, dpr: 1 },
] : [
  { file: 'preview.png', query: '', viewport: { width: 960, height: 1080 }, dpr: 2, fullPage: true },
  { file: 'preview-sizes.png', query: '&layout=/authoring/preview-layouts/sizes.html', viewport: { width: 960, height: 880 }, dpr: 1 },
];

const browser = await chromium.launch();
try {
  for (const s of shots) {
    const page = await browser.newPage({ viewport: s.viewport, deviceScaleFactor: s.dpr });
    await page.goto(`${base}/authoring-preview.html?scheme=${encodeURIComponent(scheme)}${s.query}`);
    await page.waitForFunction(() => document.documentElement.dataset.previewReady, null, { timeout: 30000 });
    const state = await page.evaluate(() => document.documentElement.dataset.previewReady);
    if (state !== 'true') throw new Error(`${s.file}: ${await page.textContent('#status')}`);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(300); // let the last ResizeObserver fit settle
    const out = resolve(dir, s.file);
    if (documentOnly) await page.locator('[data-scriptoscope-window-host]').screenshot({ path: out });
    else await page.screenshot({ path: out, fullPage: !!s.fullPage });
    console.log(`Wrote ${out}${documentOnly ? ' (document outer frame @1x)' : ` (${s.viewport.width}x${s.viewport.height} viewport @${s.dpr}x${s.fullPage ? ', full page' : ''})`}`);
    await page.close();
  }
} finally {
  await browser.close();
}
