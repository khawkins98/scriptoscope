#!/usr/bin/env node
// Write a per-theme `rasters.json` listing the cicn + ppat PNGs a bundle ships, so
// the demo's "All rasters" diagnostic foldout can enumerate them. Icons already have
// `icons/index.json` (richer — depth/coverage/name); cicns + ppats had no manifest, so
// the browser couldn't list them (no directory listing on static hosting). This closes
// that gap and keeps it repeatable: run in `build:themes` so every import regenerates it.
//
// Deterministic (sorted, no timestamp) → re-running on an unchanged bundle is a no-op
// diff. Ids/names are parsed from the extractor's filename convention:
//   cicn-n10231-unnamed.png        → id -10231, name "unnamed"
//   cicn-n10163-beveled-button-…   → id -10163, name "beveled-button-…"
//   ppat-3.png / ppat-<name>.png   → label "3" / "<name>"
//
// Usage:  node scripts/index-rasters.mjs [slug]

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const themesRoot = resolve(repoRoot, 'themes');
const only = process.argv[2];
const slugs = (only ? [only] : readdirSync(themesRoot)).filter((s) =>
  existsSync(resolve(themesRoot, s, 'theme.json')),
);

const listPng = (dir) =>
  existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.png')).sort() : [];

/** `cicn-n10231-unnamed.png` → { file, id:-10231, name:'unnamed' }. */
function parseCicn(file) {
  const m = /^cicn-([np])(\d+)(?:-(.*))?\.png$/.exec(file);
  if (!m) return { file, id: null, name: null };
  return { file, id: (m[1] === 'n' ? -1 : 1) * Number(m[2]), name: m[3] || null };
}

/** `ppat-3.png` / `ppat-<name>.png` → { file, label }. */
function parsePpat(file) {
  const m = /^ppat-(.+)\.png$/.exec(file);
  return { file, label: m ? m[1] : file.replace(/\.png$/, '') };
}

let total = 0;
for (const slug of slugs) {
  const dir = resolve(themesRoot, slug);
  const cicns = listPng(resolve(dir, 'cicns')).map(parseCicn);
  const ppats = listPng(resolve(dir, 'ppats')).map(parsePpat);
  if (!cicns.length && !ppats.length) continue;
  const out = { cicns, ppats };
  writeFileSync(resolve(dir, 'rasters.json'), JSON.stringify(out, null, 1) + '\n');
  total++;
  console.log(`  ${slug.padEnd(28)} ${cicns.length} cicns · ${ppats.length} ppats`);
}
console.log(`\n-- wrote rasters.json for ${total} theme(s) --`);
