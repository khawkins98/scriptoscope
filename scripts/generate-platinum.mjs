// scripts/generate-platinum.mjs
// Generate the Apple Platinum (replica) theme bundle: draw → write PNGs →
// assemble manifest + meta → buildThemeJson → validateTheme → write bundle.
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodePng } from './lib/png-encode.mjs';
import { drawDocumentWindow } from './generate-platinum/draw-document-window.mjs';
import { buildDocumentWindowAssets } from './generate-platinum/manifest.mjs';
import { PALETTE } from './generate-platinum/palette.mjs';
import { buildThemeJson } from '../tools/theme-loader/buildThemeJson.js';
import { validateTheme } from '../tools/theme-loader/validateTheme.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dest = resolve(root, 'themes/apple-platinum-replica');
mkdirSync(resolve(dest, 'cicns'), { recursive: true });
mkdirSync(resolve(dest, 'ppats'), { recursive: true });

const drawn = drawDocumentWindow(PALETTE);
const assets = buildDocumentWindowAssets(drawn);

// Write each raster asset's PNG to the path recorded in its manifest entry.
const imgByFile = {
  'cicns/cicn-n14336-document-window-inactive.png': drawn.inactive,
  'cicns/cicn-n14335-active-document-window.png': drawn.active,
  'ppats/ppat-128-title-pinstripe.png': drawn.stipple,
};
for (const a of assets) {
  if (!a.file) continue;
  const img = imgByFile[a.file];
  writeFileSync(resolve(dest, a.file), encodePng(img.width, img.height, img.rgba));
}

const extractedAt = new Date().toISOString();
const counts = { total: assets.length, ok: assets.length, skipped: 0, errored: 0 };
writeFileSync(resolve(dest, 'extraction-manifest.json'),
  JSON.stringify({ source: 'generated', extractedAt, counts, assets }, null, 2));

const metaPath = resolve(dest, 'meta.json');
const meta = existsSync(metaPath) ? JSON.parse(readFileSync(metaPath, 'utf8')) : {};
const theme = buildThemeJson({ source: 'apple-platinum-replica (generated)', extractedAt, counts, assets }, { meta });

try { validateTheme(theme); }
catch (err) { console.error('schema validation FAILED:', err.message); process.exit(1); }

writeFileSync(resolve(dest, 'theme.json'), JSON.stringify(theme, null, 2));
console.log(`[apple-platinum-replica] window types: ${Object.keys(theme.windowTypes || {}).join(', ')}; ` +
  `chrome elements: ${Object.keys(theme.chromeElements || {}).length}`);
