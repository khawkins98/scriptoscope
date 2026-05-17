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

import { cp, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const outAssets = resolve(root, 'dist/demo/assets');

async function copy(src, dst) {
  await mkdir(dirname(dst), { recursive: true });
  await cp(src, dst, { recursive: true });
  console.log(`  copied ${src.replace(root + '/', '')} → ${dst.replace(root + '/', '')}`);
}

await mkdir(outAssets, { recursive: true });
await copy(
  resolve(root, 'demo/assets/themes'),
  resolve(outAssets, 'themes'),
);
await copy(
  resolve(root, 'demo/assets/references'),
  resolve(outAssets, 'references'),
);

// Canonical theme bundles (themes/<slug>/) — served at /themes/ in dev via
// the serveThemesPlugin in vite.config.js and copied verbatim here for the
// gh-pages deploy so loadTheme('/themes/<slug>/') works at production URLs.
const outThemes = resolve(root, 'dist/demo/themes');
await mkdir(outThemes, { recursive: true });
for (const slug of ['masswerk-7-le', 'masswerk-dark-ergobox2']) {
  await copy(
    resolve(root, 'themes', slug),
    resolve(outThemes, slug),
  );
}

console.log('Demo assets copied.');
