// Vite's static asset handling only catches things it can statically
// resolve at build time (CSS `url()` in linked stylesheets, `<img src>`,
// imports). Our demo references many cicn / ppat PNGs through CSS
// `url()` calls inside CSS custom properties in inline `<style>` blocks
// — those don't get picked up. Same for the theme.json files fetched
// dynamically at runtime.
//
// Simpler than configuring publicDir for two specific subdirectories is
// just to copy them verbatim after the build. This keeps the relative
// `assets/themes/<name>/<file>` URLs the demo's CSS uses working as-is.

import { cp, mkdir, readdir, access } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const outAssets = resolve(root, 'dist/demo/assets');

async function exists(p) {
  try { await access(p); return true; } catch { return false; }
}
async function copy(src, dst) {
  await mkdir(dirname(dst), { recursive: true });
  await cp(src, dst, { recursive: true });
  console.log(`  copied ${src.replace(root + '/', '')} → ${dst.replace(root + '/', '')}`);
}

await mkdir(outAssets, { recursive: true });
// Reference screenshots fetched by <img src> in the demo.
await copy(
  resolve(root, 'demo/assets/references'),
  resolve(outAssets, 'references'),
);

// Bundled font referenced by the @font-face (the OFL Charcoal stand-in).
if (await exists(resolve(root, 'demo/assets/fonts'))) {
  await copy(resolve(root, 'demo/assets/fonts'), resolve(outAssets, 'fonts'));
}

// Canonical theme bundles (themes/<slug>/) — served at /themes/ in dev via
// the serveThemesPlugin in vite.config.js and copied verbatim here for the
// gh-pages deploy so loadTheme('/themes/<slug>/') works at production URLs.
// Copy EVERY bundle (any themes/<slug>/ with a theme.json), so the deployed
// demo matches the dev demo no matter which schemes are listed.
const outThemes = resolve(root, 'dist/demo/themes');
await mkdir(outThemes, { recursive: true });
const themesDir = resolve(root, 'themes');
for (const slug of await readdir(themesDir)) {
  if (!(await exists(resolve(themesDir, slug, 'theme.json')))) continue;
  await copy(resolve(themesDir, slug), resolve(outThemes, slug));
}

console.log('Demo assets copied.');
