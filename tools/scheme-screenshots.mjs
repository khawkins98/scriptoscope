#!/usr/bin/env node
// Per-scheme screenshot generator for fidelity iteration.
//
// Iterates every bundled theme, loads the main demo with ?theme=<slug>,
// and writes a screenshot to docs/screenshots/<slug>.png. Use these as
// the visual baseline when iterating on the renderer — diff the per-PR
// output against the previously-committed baselines to see what changed.
//
// Usage:
//   node tools/scheme-screenshots.mjs                    # all schemes
//   node tools/scheme-screenshots.mjs 1984 1990          # subset
//   node tools/scheme-screenshots.mjs --base http://...  # different host
//
// Requires the dev server running (npm run dev) or pass --base.

import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const outDir = resolve(repoRoot, 'docs/screenshots');

const ALL_SCHEMES = [
  'masswerk-7-le',
  'masswerk-dark-ergobox2',
  '1138',
  '1984',
  '1990',
  'evolution',
];

const args = process.argv.slice(2);
let baseUrl = 'http://localhost:5173';
const slugs = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--base') baseUrl = args[++i];
  else slugs.push(args[i]);
}
const targets = slugs.length > 0 ? slugs : ALL_SCHEMES;

mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 } });
  for (const slug of targets) {
    if (!ALL_SCHEMES.includes(slug)) {
      console.warn(`[skip] unknown scheme: ${slug}`);
      continue;
    }
    const page = await ctx.newPage();
    const url = `${baseUrl}/?theme=${slug}`;
    console.log(`[${slug}] ${url}`);
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.waitForTimeout(800); // settle for async classifier + geometry
    const outPath = resolve(outDir, `${slug}.png`);
    await page.screenshot({ path: outPath, fullPage: false });
    console.log(`  → ${outPath}`);
    await page.close();
  }
} finally {
  await browser.close();
}
