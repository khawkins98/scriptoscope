#!/usr/bin/env node
// Extract a Kaleidoscope scheme bundle straight from its binary resource fork.
// Thin Node shell over the portable conversion core (tools/theme-loader/convert.js):
// reads themes/<slug>/scheme.rsrc, runs convertChrome (decode → gamma → theme.json →
// headerColors → bodyBackground), then does the Node-only I/O — PNG-encodes each RGBA
// asset (zlib) and writes the themes/<slug>/ bundle. The browser loader runs the SAME
// convertChrome over a dropped Blob; this CLI just adds fs + zlib.
//
// Usage: node scripts/extract-scheme.mjs <slug> [<slug>...] | --all
//   reads  themes/<slug>/scheme.rsrc  (+ optional meta.json)
//   writes themes/<slug>/{cicns,ppats}/*.png, extraction-manifest.json, theme.json

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodePng } from './lib/png-encode.mjs';
import { convertChrome } from '../tools/theme-loader/convert.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');

const argv = process.argv.slice(2);
if (argv.length === 0) {
  console.error('Usage: node scripts/extract-scheme.mjs <slug> [<slug>...] | --all');
  process.exit(2);
}
const themesRoot = resolve(repoRoot, 'themes');
const slugs = argv.includes('--all')
  ? readdirSync(themesRoot).filter((s) => existsSync(resolve(themesRoot, s, 'scheme.rsrc')))
  : argv;
for (const s of slugs) extract(s);

function extract(slug) {
  const destDir = resolve(repoRoot, 'themes', slug);
  const rsrcPath = resolve(destDir, 'scheme.rsrc');
  if (!existsSync(rsrcPath)) {
    console.error(`Not found: ${rsrcPath}`);
    process.exit(1);
  }
  const metaPath = resolve(destDir, 'meta.json');
  const meta = existsSync(metaPath) ? JSON.parse(readFileSync(metaPath, 'utf8')) : {};
  const fork = new Uint8Array(readFileSync(rsrcPath));

  let result;
  try {
    result = convertChrome(fork, { meta, source: `${slug}/scheme.rsrc` });
  } catch (err) {
    console.error(`[${slug}] conversion FAILED:`, err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
  const { theme, assets, manifest } = result;

  // ── Node I/O: PNG-encode each RGBA asset (zlib) + write the bundle ──
  mkdirSync(resolve(destDir, 'cicns'), { recursive: true });
  mkdirSync(resolve(destDir, 'ppats'), { recursive: true });
  for (const a of assets) {
    writeFileSync(resolve(destDir, a.path), encodePng(a.width, a.height, a.rgba));
  }
  // extraction-manifest carries the wall-clock (the one non-deterministic field; lives
  // here, not in the deterministic theme.json).
  writeFileSync(
    resolve(destDir, 'extraction-manifest.json'),
    JSON.stringify({ source: manifest.source, extractedAt: new Date().toISOString(), counts: manifest.counts, assets: manifest.assets }, null, 2),
  );
  writeFileSync(resolve(destDir, 'theme.json'), JSON.stringify(theme, null, 2));

  const c = manifest.counts;
  console.log(
    `[${slug}] ok=${c.ok} (raster=${c.raster}, geometry=${c.geometry}) ` +
    `skipped=${c.skipped} errored=${c.errored} → ${Object.keys(theme.chromeElements || {}).length} chrome elements, ` +
    `${Object.keys(theme.windowTypes || {}).length} window types, headerColors=${!!theme.headerColors}`,
  );
}
