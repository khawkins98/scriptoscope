#!/usr/bin/env node
// Materialize canonical theme bundles under themes/<slug>/ from the existing
// extraction manifests in demo/assets/themes/<slug>/. Idempotent.
//
// Per-bundle inputs:
//   demo/assets/themes/<slug>/extraction-manifest.json   (extractor output)
//   demo/assets/themes/<slug>/*.png                       (extracted assets)
//   themes/<slug>/meta.json                               (hand-authored sidecar)
//
// Per-bundle outputs:
//   themes/<slug>/theme.json   (schema-conformant; passes parseTheme)
//   themes/<slug>/cicns/*.png  (cicn assets, copied with path remap)
//   themes/<slug>/ppats/*.png  (ppat assets, ditto)
//
// Each output theme.json is validated via the extractor's validateTheme()
// before being written. Build aborts on validation failure.
//
// Usage:
//   node scripts/build-theme-bundles.mjs            # builds both
//   node scripts/build-theme-bundles.mjs <slug>     # builds one

import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildThemeJson,
  validateTheme,
} from '../tools/scheme-extractor/lib/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');

const ALL_BUNDLES = ['masswerk-7-le', 'masswerk-dark-ergobox2'];

const requested = process.argv.slice(2);
const bundles = requested.length > 0 ? requested : ALL_BUNDLES;

for (const slug of bundles) {
  if (!ALL_BUNDLES.includes(slug)) {
    console.error(`Unknown bundle: ${slug}`);
    console.error(`Known: ${ALL_BUNDLES.join(', ')}`);
    process.exit(2);
  }
  buildBundle(slug);
}

function buildBundle(slug) {
  const srcDir = resolve(repoRoot, 'demo/assets/themes', slug);
  const destDir = resolve(repoRoot, 'themes', slug);

  if (!existsSync(srcDir)) {
    throw new Error(`Source not found: ${srcDir}`);
  }
  if (!existsSync(destDir)) {
    throw new Error(`Destination not initialized: ${destDir} (create meta.json + PROVENANCE.md first)`);
  }

  // Prepare asset subdirs.
  mkdirSync(resolve(destDir, 'cicns'), { recursive: true });
  mkdirSync(resolve(destDir, 'ppats'), { recursive: true });

  // Read the extractor's raw manifest.
  const manifest = JSON.parse(
    readFileSync(resolve(srcDir, 'extraction-manifest.json'), 'utf8'),
  );

  // Copy each raster asset into its subdir + remap the manifest's file paths.
  // The extractor emits flat `cicn-nXXXX-name.png` filenames; canonical bundles
  // organize them into `cicns/` and `ppats/` subdirs.
  let copiedCicns = 0;
  let copiedPpats = 0;
  const remappedAssets = manifest.assets.map(a => {
    if (a.status !== 'ok' || !a.file) return a;
    if (a.type === 'cicn') {
      copyFileSync(resolve(srcDir, a.file), resolve(destDir, 'cicns', a.file));
      copiedCicns++;
      return { ...a, file: `cicns/${a.file}` };
    }
    if (a.type === 'ppat') {
      copyFileSync(resolve(srcDir, a.file), resolve(destDir, 'ppats', a.file));
      copiedPpats++;
      return { ...a, file: `ppats/${a.file}` };
    }
    return a;
  });

  const remappedManifest = { ...manifest, assets: remappedAssets };

  // Merge in the bundle's sidecar metadata.
  const metaPath = resolve(destDir, 'meta.json');
  const meta = existsSync(metaPath) ? JSON.parse(readFileSync(metaPath, 'utf8')) : {};

  // Build the schema-conformant theme.json.
  const theme = buildThemeJson(remappedManifest, { meta });

  // Validate before writing — abort on schema violation.
  try {
    validateTheme(theme);
  } catch (e) {
    console.error(`[${slug}] schema validation FAILED:`, e.message);
    process.exit(1);
  }

  writeFileSync(
    resolve(destDir, 'theme.json'),
    JSON.stringify(theme, null, 2),
  );

  console.log(
    `[${slug}] built: theme.json (${Object.keys(theme.chromeElements || {}).length} chrome elements, ` +
      `${Object.keys(theme.windowTypes || {}).length} window types, ` +
      `${Object.keys(theme.patterns || {}).length} patterns) + ` +
      `${copiedCicns} cicns + ${copiedPpats} ppats`,
  );
}
