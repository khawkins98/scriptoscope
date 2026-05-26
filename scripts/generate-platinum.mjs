// scripts/generate-platinum.mjs
// Generate the Apple Platinum (replica) theme bundle for ALL 13 canonical window
// types: draw each type's two min-size cicn sprites → write PNGs → assemble the
// manifest + meta → buildThemeJson → validateTheme → write the bundle.
//
// Each window type is ONE base sprite per state (active/inactive) + a wnd# slice
// recipe; the runtime compositor tiles it to any size. The document window is
// sliced from a real Platinum screenshot (slice-doc-window.mjs); the remaining
// types are drawn procedurally (draw-window.mjs) as a fallback; controls are
// grafted from apple-platinum-2 (graft-controls.mjs).
import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodePng } from './lib/png-encode.mjs';
import { drawWindow } from './generate-platinum/draw-window.mjs';
import { sliceWindow, SLICED_WINDOW_TYPES } from './generate-platinum/slice-doc-window.mjs';
import { graftControls, GRAFT_CONTROL_IDS } from './generate-platinum/graft-controls.mjs';
import { sliceControls } from './generate-platinum/slice-controls.mjs';
import { sliceIcons } from './generate-platinum/slice-icons.mjs';
import { buildAllWindowAssets, cicnFiles } from './generate-platinum/manifest.mjs';
import { buildControls } from './generate-platinum/build-controls.mjs';
import { CONTROL_IDS } from './generate-platinum/control-metrics.mjs';
import { WINDOW_TYPES } from './generate-platinum/window-types.mjs';
import { PALETTE } from './generate-platinum/palette.mjs';
import { buildThemeJson } from '../tools/theme-loader/buildThemeJson.js';
import { validateTheme } from '../tools/theme-loader/validateTheme.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dest = resolve(root, 'themes/apple-platinum-replica');
const cicnDir = resolve(dest, 'cicns');
mkdirSync(cicnDir, { recursive: true });

// Clear stale generated cicns so renamed/removed types don't linger.
for (const f of existsSync(cicnDir) ? readdirSync(cicnDir) : [])
  if (f.startsWith('cicn-')) rmSync(resolve(cicnDir, f));

// Controls we now GENERATE from the data-driven model (control-metrics.mjs +
// draw-control.mjs). These are EXCLUDED from the graft below so the generator is
// their single source — no shadowed/orphaned borrowed art for the same ids.
const GENERATED_CONTROLS = ['pushButton', 'defaultRing', 'scrollTrackV', 'scrollTrackH', 'scrollThumbV', 'scrollThumbH'];
const GENERATED_IDS = new Set(GENERATED_CONTROLS.flatMap((k) => Object.values(CONTROL_IDS[k])));

// Draw every type's sprites (the procedural fallback). document-window is then
// overridden by the screenshot slice below.
const drawnBySlug = {};
for (const cfg of WINDOW_TYPES) drawnBySlug[cfg.slug] = drawWindow(cfg, PALETTE);

// Override the document-window cicn with the screenshot-sliced raster — the real
// Platinum pixels (pillow buttons, diagonal sheen, fine pinstripe) that the
// procedural drawer only approximates. Same 98x23 geometry, so the recipe is
// unchanged; we swap only the active/inactive buffers and keep .geo.
// Override titled window types with screenshot-sliced rasters where a source
// exists (document-window, movable-modal, …). Same cicn geometry as the drawer,
// so the recipe is unchanged; only the active/inactive buffers swap. Types with
// no source keep the procedural draw.
for (const type of SLICED_WINDOW_TYPES) {
  if (!drawnBySlug[type]) continue;
  const sliced = sliceWindow(type, dest);
  if (!sliced) continue;
  drawnBySlug[type].active = sliced.active;
  drawnBySlug[type].inactive = sliced.inactive;
  console.log(`[apple-platinum-replica] ${type}: screenshot-sliced raster`);
}

const assets = buildAllWindowAssets(drawnBySlug);

// Write each raster asset's PNG. cicn files come from cicnFiles(); the ppat
// path is the manifest entry's `file`.
const imgByFile = {};
for (const cfg of WINDOW_TYPES) {
  const files = cicnFiles(cfg, cfg.wndId, cfg.wndId + 1);
  imgByFile[files.inactive] = drawnBySlug[cfg.slug].inactive;
  imgByFile[files.active] = drawnBySlug[cfg.slug].active;
}
for (const a of assets) {
  if (!a.file) continue;
  const img = imgByFile[a.file];
  writeFileSync(resolve(dest, a.file), encodePng(img.width, img.height, img.rgba));
}

// Deterministic build timestamp so re-runs are byte-identical when inputs are
// unchanged (the bundle is committed). Override with SOURCE_DATE_EPOCH; else a
// fixed stamp (the artifact's freshness is tracked by git, not this field).
const extractedAt = process.env.SOURCE_DATE_EPOCH
  ? new Date(Number(process.env.SOURCE_DATE_EPOCH) * 1000).toISOString()
  : '2026-05-24T00:00:00.000Z';
const counts = { total: assets.length, ok: assets.length, skipped: 0, errored: 0 };
writeFileSync(resolve(dest, 'extraction-manifest.json'),
  JSON.stringify({ source: 'generated', extractedAt, counts, assets }, null, 2));

const metaPath = resolve(dest, 'meta.json');
const meta = existsSync(metaPath) ? JSON.parse(readFileSync(metaPath, 'utf8')) : {};
// State the bundle's DUAL role explicitly: it is both a showcase scheme and the
// UNIVERSAL BASE theme every other scheme inherits from (loadTheme(url,{base}))
// for any chrome/control it doesn't ship. Not to be confused with the sparse
// 'apple-platinum-2' proxy-icon bundle, which itself defers here.
meta.note =
  'Apple Platinum (replica): clean-room, fully GENERATED reproduction of the ' +
  'Mac OS 8.5 Platinum look (scripts/generate-platinum.mjs). Dual role — a ' +
  'showcase scheme AND the universal BASE theme other schemes inherit for any ' +
  'chrome/control they don\'t ship. Control-completeness is guarded by ' +
  'scripts/generate-platinum/bundle.smoke.test.mjs. Distinct from ' +
  '"apple-platinum-2" (a sparse proxy-icon bundle that itself defers here).';
const theme = buildThemeJson({ source: 'apple-platinum-replica (generated)', extractedAt, counts, assets }, { meta });

// Graft real Platinum control geometry from apple-platinum-2 (it has the control
// cicns we lack; controls resolve by resource ID so they're found by slug-agnostic
// lookup). Copies the cicns into our cicns/ and merges their chromeElements.
// DEFER TO platinum-8 (owner decision, 2026-05-25): the real freeware Platinum
// scheme is the authority for the recognizable control look. Its controls are real,
// already-correct art at the canonical resource ids — graft them RAW (no purple→blue
// recolor / synthetic grip). All verified in the live playground (clean push-button
// faces, proper rounded-rect default ring, light-blue thumbs). apple-platinum-2 only
// still supplies the controls platinum-8 lacks (grow box, tabs) and checkbox/radio
// (platinum-8 has no art at the renderer's -9500/-9488 — those stay Apple-sliced).
const P8_GRAFT_IDS = new Set([
  -8277, -8278, -8279, -8280, -8285, -8286, -8287, -8288, // scrollbar tracks V+H
  -10205, -10206, -10207, -10208,                          // scroll thumbs
  -10238, -10239, -10240,                                  // push-button face (pressed/normal/inactive)
  -10231, -10232,                                          // default-button ring
]);
const aplat2 = resolve(root, 'themes/apple-platinum-2');
if (existsSync(aplat2)) {
  const aplat2Ids = new Set([...GRAFT_CONTROL_IDS].filter((id) => !P8_GRAFT_IDS.has(id) && !GENERATED_IDS.has(id)));
  const { grafted, copied, missing } = graftControls(aplat2, dest, aplat2Ids);
  theme.chromeElements = { ...(theme.chromeElements || {}), ...grafted };
  console.log(`[apple-platinum-replica] grafted ${copied} control cicns from apple-platinum-2` +
    (missing.length ? ` (missing ids: ${missing.join(', ')})` : ''));
}
const platinum8 = resolve(root, 'themes/platinum-8');
const p8Ids = new Set([...P8_GRAFT_IDS].filter((id) => !GENERATED_IDS.has(id)));
if (existsSync(platinum8) && p8Ids.size) {
  const { grafted, copied, missing } = graftControls(platinum8, dest, p8Ids, { recolor: false });
  theme.chromeElements = { ...(theme.chromeElements || {}), ...grafted };
  console.log(`[apple-platinum-replica] deferred ${copied} controls to platinum-8 (scrollbars+thumbs)` +
    (missing.length ? ` (missing ids: ${missing.join(', ')})` : ''));
}

// Slice real control glyphs (checkbox, radio, progress, slider, disclosure) from
// screenshots into cicns at the renderer's resource IDs — apple-platinum-2 keeps
// these at non-standard IDs, so the renderer never found them and fell back to the
// procedural baseline. Degrade gracefully: if a source screenshot is missing, warn
// and skip (the renderer keeps its baseline) rather than aborting the whole build.
try {
  const { sliced, count } = sliceControls(dest, dest);
  theme.chromeElements = { ...(theme.chromeElements || {}), ...sliced };
  console.log(`[apple-platinum-replica] sliced ${count} control glyphs from screenshots`);
} catch (err) {
  console.warn(`[apple-platinum-replica] WARN: control slice skipped (${err.message}); controls fall back to baseline`);
}

// Generate Platinum controls from the DATA-DRIVEN model: control-metrics.mjs
// (specs) + draw-control.mjs (generic bevel drawer) + the extracted
// platinum-palette.json colors (real indigo ring). This mirrors AppearanceLib's
// data/drawer split and SUPERSEDES the graft for the IDs it generates — one
// decode-grounded source instead of borrowed 1999 art. Scope (PB3): the
// graft-covered controls (push button, default ring, scrollbar track + thumb);
// checkbox/radio stay on their faithful screenshot slices until calibrated.
try {
  const gen = buildControls(dest, root, GENERATED_CONTROLS);
  const genIds = new Set(gen.ids);
  // Drop any prior graft/slice chromeElement for an id we now generate, then add ours.
  theme.chromeElements = Object.fromEntries(
    Object.entries(theme.chromeElements || {}).filter(([, el]) => !genIds.has(el.sourceCicnId)),
  );
  theme.chromeElements = { ...theme.chromeElements, ...gen.chromeElements };
  console.log(`[apple-platinum-replica] generated ${gen.ids.length} control cicns ` +
    `(${GENERATED_CONTROLS.join(', ')}) — supersedes graft`);
} catch (err) {
  console.error('control generation FAILED:', err.message);
  process.exit(1);
}

// Slice the Finder folder icons for the demo scene (icons/index.json).
try {
  const { count } = sliceIcons(dest);
  if (count) console.log(`[apple-platinum-replica] sliced ${count} folder icons → icons/`);
} catch (err) {
  console.warn(`[apple-platinum-replica] WARN: icon slice skipped (${err.message})`);
}

// Sliced document-window: the cicn carries a 2px raster frame (black outline +
// bevel — white highlight on the left, shadow on the right) that the 1px body
// edge dropped, leaving a step against the title-bar corners. Inset its part-0
// body rect 2px L/R so the body edges render the full raster frame. (Procedural
// types keep their 1px perimeter; the bottom stays 1px — the cicn has no 2px
// bottom band.)
{
  const wtd = theme.windowTypes?.['document-window'];
  const rect = wtd?.parts?.['part-0']?.rect;
  const dw = drawnBySlug['document-window']?.active?.width;
  if (rect && dw && existsSync(resolve(dest, 'sources/doc-window-macintosh-hd-active.png'))) { rect[0] = 2; rect[2] = dw - 2; }
}

try { validateTheme(theme); }
catch (err) { console.error('schema validation FAILED:', err.message); process.exit(1); }

writeFileSync(resolve(dest, 'theme.json'), JSON.stringify(theme, null, 2));
const wt = Object.keys(theme.windowTypes || {});
console.log(`[apple-platinum-replica] window types: ${wt.length} (${wt.join(', ')}); ` +
  `chrome elements: ${Object.keys(theme.chromeElements || {}).length}`);
