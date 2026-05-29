#!/usr/bin/env node
// scripts/capture-visual-baselines.mjs
//
// Re-capture the per-theme "Scene" panel baselines under tests/visual-baselines/scenes/.
// One PNG per theme, taken from the demo's gallery row at a fixed viewport + state — the
// committed art the maintainer eyeballs to spot a render regression. (Owner-directed: a
// proper pixel-diff harness can come later; for now this is a manual sanity-check fixture.)
//
//   node scripts/capture-visual-baselines.mjs            # capture every theme
//   node scripts/capture-visual-baselines.mjs <slug>     # one theme
//
// Requires Playwright (transitively present via the gstack browse skill — we don't take a
// hard devDependency to keep CI light). A missing Playwright prints a one-liner explaining
// how to install it locally and exits 1.

import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outRoot = resolve(repoRoot, 'tests/visual-baselines/scenes');

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  console.error('✗ Playwright not available. Install with:  npm i -D playwright && npx playwright install chromium');
  process.exit(1);
}

const onlySlug = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : null;
const catalog = JSON.parse(readFileSync(resolve(repoRoot, 'demo/themes-manifest.json'), 'utf8'));
const slugs = onlySlug ? catalog.filter((t) => t.slug === onlySlug) : catalog;

await mkdir(outRoot, { recursive: true });

// Boot a dev server unless one is already running on 5173.
let viteProc = null;
async function ensureDev() {
  try {
    const r = await fetch('http://localhost:5173/');
    if (r.ok) return; // already running
  } catch { /* no server yet */ }
  console.log('  starting vite dev server…');
  viteProc = spawn('npm', ['run', 'dev'], { cwd: repoRoot, stdio: ['ignore', 'pipe', 'pipe'] });
  // Wait up to 15s for the port to come up.
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 500));
    try { const r = await fetch('http://localhost:5173/'); if (r.ok) return; } catch { /* keep waiting */ }
  }
  throw new Error('vite dev server did not come up on :5173');
}

await ensureDev();

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1024, height: 720 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();

let captured = 0;
for (const t of slugs) {
  const slug = t.slug;
  process.stdout.write(`  ${slug.padEnd(28)} `);
  await page.goto(`http://localhost:5173/?theme=${slug}`, { waitUntil: 'networkidle' });
  // The Scene section in the detail panel — `#d-scene`, the "Scene · reference" row.
  // Wait for it to be present + for its live canvas to be non-zero (the renderer
  // paints to canvas, not DOM; a 0×0 canvas means the scene is still composing).
  const scene = page.locator('#d-scene');
  await scene.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
  await page.waitForFunction(() => {
    const c = document.querySelector('#d-scene canvas');
    return c && c.width > 0 && c.height > 0;
  }, null, { timeout: 10000 }).catch(() => {});
  const buf = await scene.screenshot();
  const out = resolve(outRoot, `${slug}.png`);
  await writeFile(out, buf);
  console.log(`→ ${out.replace(repoRoot + '/', '')} (${buf.length} bytes)`);
  captured++;
}

await browser.close();
if (viteProc) viteProc.kill();
console.log(`\n-- captured ${captured} baseline(s) --`);
