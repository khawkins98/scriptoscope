#!/usr/bin/env node
// Extract a scheme's icon-family glyphs (icl4/ics4/icl8/ics8) into
// themes/<slug>/icons/*.png + icons/index.json. Thin Node shell over the portable
// conversion core (tools/theme-loader/convert.js → convertIcons): the decode +
// gamma + corner-flood masks live there (shared with the browser loader); this CLI
// just PNG-encodes each RGBA (zlib) and writes. Kept SEPARATE from extract-scheme.mjs
// so re-running it never rewrites the cicns/ppats PNGs.
//
// COMPLETENESS GUARD: if a scheme ships icon resources but extracts 0 glyphs, exit
// non-zero with a loud warning (how Black Platinum's glyphs were silently missed).
// See docs/porting-a-kaleidoscope-scheme.md §3.5.
//
// Usage: node scripts/extract-icons.mjs <slug> [<slug>...] | --all

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodePng } from './lib/png-encode.mjs';
import { convertIcons } from '../tools/theme-loader/convert.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');

function extract(slug) {
  const destDir = resolve(repoRoot, 'themes', slug);
  const rsrcPath = resolve(destDir, 'scheme.rsrc');
  if (!existsSync(rsrcPath)) { console.error(`Not found: ${rsrcPath}`); return; }

  const { assets, index, census } = convertIcons(new Uint8Array(readFileSync(rsrcPath)));

  mkdirSync(resolve(destDir, 'icons'), { recursive: true });
  for (const a of assets) writeFileSync(resolve(destDir, a.path), encodePng(a.width, a.height, a.rgba));
  writeFileSync(resolve(destDir, 'icons', 'index.json'), JSON.stringify(index, null, 2));

  // Completeness guard: a scheme that ships glyph resources MUST yield glyphs.
  const totalRes = census.ics4 + census.ics8 + census.icl4 + census.icl8;
  const n = (t) => index.filter((i) => i.type === t).length;
  const miss = totalRes > 0 && index.length === 0;
  console.log(
    `[${slug}] ${index.length} icons → icons/  ` +
    `(icl4=${n('icl4')}, ics4=${n('ics4')}, icl8=${n('icl8')}, ics8=${n('ics8')}; ` +
    `shipped ics4=${census.ics4}/ics8=${census.ics8}/icl4=${census.icl4}/icl8=${census.icl8})` +
    (miss ? `  ⚠ MISSED: ${totalRes} icon resources shipped but 0 extracted` : ''),
  );
  if (miss) process.exitCode = 1;
}

const argv = process.argv.slice(2);
if (argv.length === 0) { console.error('Usage: node scripts/extract-icons.mjs <slug>... | --all'); process.exit(2); }
const themesRoot = resolve(repoRoot, 'themes');
const slugs = argv.includes('--all')
  ? readdirSync(themesRoot).filter((s) => existsSync(resolve(themesRoot, s, 'scheme.rsrc')))
  : argv;
for (const s of slugs) extract(s);
