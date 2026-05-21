#!/usr/bin/env node
// Headless window renderer + slice-placement dumper. Runs the REAL compositor
// (composeWindowChrome) in Node — no browser — so we can inspect a theme's
// window render + the slice provenance programmatically.
//
// Usage:
//   npm run build   # first, so dist/ is current
//   node scripts/render-window.mjs <slug> [windowType] [--w N] [--h N] [--title T] [--plate N]
//
// Writes under themes/<slug>/diag/:  <windowType>.png  +  <windowType>.json
// and prints a slice table to stdout.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { composeWindowChrome } from '../dist/aaron-ui.js';
import { encodePng, loadCicn, resolveWindow } from './diag-lib.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const argv = process.argv.slice(2);
if (!argv.length) {
  console.error('Usage: node scripts/render-window.mjs <slug> [windowType] [--w N] [--h N] [--title T] [--plate N]');
  process.exit(2);
}
const slug = argv[0];
const opts = { windowType: undefined, w: 240, h: 120, title: '', plate: 0 };
for (let i = 1; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--w') opts.w = +argv[++i];
  else if (a === '--h') opts.h = +argv[++i];
  else if (a === '--title') opts.title = argv[++i];
  else if (a === '--plate') opts.plate = +argv[++i];
  else if (!a.startsWith('--')) opts.windowType = a;
}
// No DOM here to rasterize text, so estimate the title-plate width from the
// title length (~6px/char + pad) unless --plate is given. 0 = raw recipe.
const plateWidth = opts.plate || (opts.title ? opts.title.length * 6 + 10 : 0);

const themeDir = resolve(repoRoot, 'themes', slug);
const manifest = JSON.parse(readFileSync(resolve(themeDir, 'theme.json'), 'utf8'));
const resolved = resolveWindow(manifest, opts.windowType);
if (!resolved) { console.error(`window type "${opts.windowType ?? '(default)'}" not found. Available: ${Object.keys(manifest.windowTypes || {}).join(', ')}`); process.exit(1); }
const { key: wtKey, wt } = resolved;
if (!wt?.chrome?.active) { console.error(`window type "${wtKey}" has no active chrome cicn`); process.exit(1); }

const cicn = loadCicn(themeDir, wt.chrome.active);
const composed = composeWindowChrome(cicn, wt, opts.w, opts.h, { titlePlateWidth: plateWidth });

const diagDir = resolve(themeDir, 'diag');
if (!existsSync(diagDir)) mkdirSync(diagDir, { recursive: true });
const pngOut = resolve(diagDir, `${wtKey}.png`);
writeFileSync(pngOut, encodePng(composed.fullWidth, composed.fullHeight, composed.buffer.data));
const jsonOut = resolve(diagDir, `${wtKey}.json`);
writeFileSync(jsonOut, JSON.stringify({
  theme: slug, windowType: wtKey, chrome: wt.chrome.active, cicn: { w: cicn.width, h: cicn.height },
  content: { w: opts.w, h: opts.h }, plateWidth, full: { w: composed.fullWidth, h: composed.fullHeight },
  frame: composed.frame, titleRegion: composed.titleRegion, titleFillSrcX: composed.titleFillSrcX,
  placement: composed.placement,
}, null, 2));

console.log(`[${slug}] ${wtKey}  cicn ${cicn.width}×${cicn.height} → full ${composed.fullWidth}×${composed.fullHeight}  frame T${composed.frame.top} L${composed.frame.left} R${composed.frame.right} B${composed.frame.bottom}  plate=${plateWidth}`);
console.log(`  ${composed.placement.length} slices:`);
for (const s of composed.placement) {
  const usage = s.mode === 'tile' ? `tiled ×${s.rects.length}` : s.mode;
  console.log(`    ${s.edge.padEnd(7)} p${String(s.code).padEnd(3)} ${s.role.padEnd(16)} src(${s.src.x},${s.src.y} ${s.src.w}×${s.src.h})  ${usage}`);
}
console.log(`  → ${pngOut.replace(repoRoot + '/', '')}  +  ${jsonOut.replace(repoRoot + '/', '')}`);
