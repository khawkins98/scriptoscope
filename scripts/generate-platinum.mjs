// scripts/generate-platinum.mjs
// Generate the Apple Platinum (replica) theme bundle for ALL 13 canonical window
// types: draw each type's two min-size cicn sprites → write PNGs → assemble the
// manifest + meta → buildThemeJson → validateTheme → write the bundle.
//
// Each window type is ONE base sprite per state (active/inactive) + a wnd# slice
// recipe; the runtime compositor tiles it to any size. The placeholder art is a
// rough scaffold — hand-paint it via the atlas (see scripts/generate-platinum/
// atlas.mjs + SPRITE-GUIDE.md). Re-running this OVERWRITES hand-painted cicns.
import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodePng } from './lib/png-encode.mjs';
import { drawWindow } from './generate-platinum/draw-window.mjs';
import { drawDocumentWindow } from './generate-platinum/draw-document-window.mjs';
import { sliceDocWindow } from './generate-platinum/slice-doc-window.mjs';
import { buildAllWindowAssets, cicnFiles } from './generate-platinum/manifest.mjs';
import { WINDOW_TYPES } from './generate-platinum/window-types.mjs';
import { PALETTE } from './generate-platinum/palette.mjs';
import { buildThemeJson } from '../tools/theme-loader/buildThemeJson.js';
import { validateTheme } from '../tools/theme-loader/validateTheme.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dest = resolve(root, 'themes/apple-platinum-replica');
const cicnDir = resolve(dest, 'cicns');
mkdirSync(cicnDir, { recursive: true });
mkdirSync(resolve(dest, 'ppats'), { recursive: true });

// Clear stale generated cicns so renamed/removed types don't linger.
for (const f of existsSync(cicnDir) ? readdirSync(cicnDir) : [])
  if (f.startsWith('cicn-')) rmSync(resolve(cicnDir, f));

// Draw every type's sprites. The stipple ppat is shared (from the doc-window).
const drawnBySlug = {};
for (const cfg of WINDOW_TYPES) drawnBySlug[cfg.slug] = drawWindow(cfg, PALETTE);
const stipple = drawDocumentWindow(PALETTE).stipple;

// Override the document-window cicn with the screenshot-sliced raster — the real
// Platinum pixels (pillow buttons, diagonal sheen, fine pinstripe) that the
// procedural drawer only approximates. Same 98x23 geometry, so the recipe is
// unchanged; we swap only the active/inactive buffers and keep .geo.
const docSrc = resolve(dest, 'sources/doc-window-infinite-hd.png');
if (existsSync(docSrc)) {
  const sliced = sliceDocWindow(docSrc);
  drawnBySlug['document-window'].active = sliced.active;
  drawnBySlug['document-window'].inactive = sliced.inactive;
  console.log('[apple-platinum-replica] document-window: screenshot-sliced raster');
} else {
  console.warn('[apple-platinum-replica] WARN: doc-window source missing, using procedural draw');
}

const assets = buildAllWindowAssets(drawnBySlug, { stipple });

// Write each raster asset's PNG. cicn files come from cicnFiles(); the ppat
// path is the manifest entry's `file`.
const imgByFile = {};
for (const cfg of WINDOW_TYPES) {
  const files = cicnFiles(cfg, cfg.wndId, cfg.wndId + 1);
  imgByFile[files.inactive] = drawnBySlug[cfg.slug].inactive;
  imgByFile[files.active] = drawnBySlug[cfg.slug].active;
}
imgByFile['ppats/ppat-128-title-pinstripe.png'] = stipple;
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
const wt = Object.keys(theme.windowTypes || {});
console.log(`[apple-platinum-replica] window types: ${wt.length} (${wt.join(', ')}); ` +
  `chrome elements: ${Object.keys(theme.chromeElements || {}).length}`);
