#!/usr/bin/env node
// Capture the diagnostic Scene · reference panel. These are browser regression
// fixtures, not an independent oracle for the original Kaleidoscope engine.
import { mkdir, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer as createSocketServer } from 'node:net';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const baselineDir = resolve(repoRoot, 'tests/visual-baselines/scenes');
export const freshDir = resolve(repoRoot, '.tmp/visual-baselines/fresh');
export const catalog = JSON.parse(readFileSync(resolve(repoRoot, 'demo/themes-manifest.json'), 'utf8'));

export function selectedThemes(slug) {
  const themes = slug ? catalog.filter(t => t.slug === slug) : catalog;
  if (!themes.length) throw new Error(`Unknown theme: ${slug}`);
  return themes;
}

export function parseArgs(args, { verify = false } = {}) {
  let slug, outDir, diffOnly = false;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--out-dir' && !verify && args[i + 1] && !args[i + 1].startsWith('--')) outDir = resolve(args[++i]);
    else if (arg === '--diff-only' && verify) diffOnly = true;
    else if (!arg.startsWith('--') && !slug) slug = arg;
    else throw new Error(`Unexpected argument: ${arg}`);
  }
  selectedThemes(slug);
  return { slug, outDir, diffOnly };
}

// Vite 7 treats port:0 as its default port. Ask the OS for an ephemeral port,
// then use strictPort so a rare bind race fails instead of silently choosing
// another server/port. We never probe or reuse an ambient :5173 instance.
async function availablePort() {
  const socket = createSocketServer();
  await new Promise((resolve, reject) => { socket.once('error', reject); socket.listen(0, '127.0.0.1', resolve); });
  const port = socket.address().port;
  await new Promise((resolve, reject) => socket.close(error => error ? reject(error) : resolve()));
  return port;
}

async function bounded(promise, ms, label) {
  let timer;
  try {
    return await Promise.race([promise, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    })]);
  } finally { clearTimeout(timer); }
}

/** Own an isolated Vite instance unless BASE explicitly names an existing site.
 * The verifier calls this in-process and writes directly to scratch, so neither
 * failed capture nor interruption can overwrite the committed fixtures. */
export async function captureVisualBaselines({ slug, outDir = baselineDir, base = process.env.BASE } = {}) {
  const themes = selectedThemes(slug);
  const timeout = Number(process.env.CAPTURE_TIMEOUT_MS ?? 30000);
  if (!Number.isFinite(timeout) || timeout <= 0) throw new Error('CAPTURE_TIMEOUT_MS must be a positive number');
  let chromium;
  try { ({ chromium } = await import('playwright')); }
  catch { throw new Error('Install optional browser tooling: npm install --no-save --package-lock=false playwright && npx playwright install chromium'); }

  let server, browser, interrupted = false;
  // Closing the browser interrupts pending navigation/waits. The outer finally
  // then closes Vite; there is no npm wrapper or detached Vite child to orphan.
  const interrupt = () => { interrupted = true; void browser?.close().catch(() => {}); };
  process.once('SIGINT', interrupt);
  process.once('SIGTERM', interrupt);
  let captured = 0;
  const failures = [];
  try {
    if (!base) {
      const { createServer } = await import('vite');
      server = await createServer({
        configFile: resolve(repoRoot, 'vite.config.js'), root: resolve(repoRoot, 'demo'),
        server: { host: '127.0.0.1', port: await availablePort(), strictPort: true, open: false },
      });
      await bounded(server.listen(), Math.min(timeout, 15000), 'Vite startup');
      base = server.resolvedUrls.local[0];
      console.log(`  isolated Vite: ${base}`);
    }
    const site = new URL(base);
    if (!site.pathname.endsWith('/') && !site.pathname.endsWith('.html')) site.pathname += '/';
    if (interrupted) throw new Error('Capture interrupted');
    browser = await chromium.launch({ timeout });
    console.log(`  Chromium: ${browser.version()}`);
    if (interrupted) throw new Error('Capture interrupted');
    const context = await browser.newContext({ viewport: { width: 1024, height: 720 }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    page.setDefaultTimeout(timeout);
    page.setDefaultNavigationTimeout(timeout);
    await mkdir(outDir, { recursive: true });
    for (const theme of themes) {
      if (interrupted) throw new Error('Capture interrupted');
      process.stdout.write(`  ${theme.slug.padEnd(28)} `);
      try {
        const url = new URL('diagnostic.html', site);
        url.searchParams.set('theme', theme.slug);
        await page.goto(url.href, { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(slug => document.querySelector('.ribbon-item.active')?.dataset.slug === slug, theme.slug);
        const scene = page.locator('#d-scene');
        await scene.waitFor({ state: 'visible' });
        // The diagnostic boot preloads title fonts BEFORE composition. Verify
        // fonts, completed scene canvases and reference images before capture.
        await page.waitForFunction(() => {
          const scene = document.querySelector('#d-scene');
          const canvases = [...(scene?.querySelectorAll('canvas') ?? [])];
          const images = [...(scene?.querySelectorAll('img') ?? [])];
          return document.fonts.status === 'loaded' && canvases.length > 0
            && canvases.every(c => c.width > 0 && c.height > 0)
            && images.every(img => img.complete && img.naturalWidth > 0);
        });
        const bytes = await scene.screenshot({ animations: 'disabled' });
        const out = resolve(outDir, `${theme.slug}.png`);
        await writeFile(out, bytes);
        console.log(`→ ${out} (${bytes.length} bytes)`);
        captured++;
      } catch (error) {
        if (interrupted) throw new Error('Capture interrupted');
        console.log(`✗ ${error.message.split('\n')[0]}`);
        failures.push(theme.slug);
      }
    }
    console.log(`\n-- captured ${captured} baseline(s), ${failures.length} failed --`);
    if (failures.length) throw new Error(`Capture failed for: ${failures.join(', ')}`);
  } finally {
    try { await browser?.close(); }
    finally {
      try { await server?.close(); }
      finally {
        process.removeListener('SIGINT', interrupt);
        process.removeListener('SIGTERM', interrupt);
      }
    }
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { await captureVisualBaselines(parseArgs(process.argv.slice(2))); }
  catch (error) { console.error(`✗ ${error.message}`); process.exitCode = 1; }
}
