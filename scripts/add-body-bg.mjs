#!/usr/bin/env node
// Patch each themes/<slug>/theme.json with a `bodyBackground` derived from
// the scheme's window-content background cinf (Icon View -9551, else List
// View -9550). Kaleidoscope draws the window body by tiling that cinf's
// bgPatternId ppat; when it's 0 the body is the OS default (white). This
// edits theme.json ONLY (no PNG re-encode), so it adds the field to the
// already-built bundles without churning their rasters. Idempotent.
//
// Usage: node scripts/add-body-bg.mjs [<slug>...]   (default: all)

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseResourceFork } from '../tools/theme-loader/resource-fork.js';
import { decodeCinf } from '../tools/theme-loader/decoders/cinf.js';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const themesRoot = resolve(repoRoot, 'themes');
const slugs = process.argv.slice(2).length
  ? process.argv.slice(2)
  : readdirSync(themesRoot).filter((s) => existsSync(resolve(themesRoot, s, 'theme.json')));

/** The relative asset path of the ppat with this resource id, or null. */
function ppatAsset(theme, id) {
  const abs = Math.abs(id);
  for (const v of Object.values(theme.patterns ?? {})) {
    const m = /ppat-n?-?(\d+)/.exec(v.asset ?? '');
    if (m && parseInt(m[1], 10) === abs) return v.asset;
  }
  return null;
}

for (const slug of slugs) {
  const dir = resolve(themesRoot, slug);
  const rsrcPath = resolve(dir, 'scheme.rsrc');
  const themePath = resolve(dir, 'theme.json');
  if (!existsSync(rsrcPath) || !existsSync(themePath)) continue;

  const entries = parseResourceFork(new Uint8Array(readFileSync(rsrcPath)));
  const cinf = (id) => {
    const r = entries.find((x) => x.type === 'cinf' && x.id === id);
    if (!r) return null;
    try { return decodeCinf(r.data); } catch { return null; }
  };
  const bg = cinf(-9551) ?? cinf(-9550); // Icon View, else List View

  const theme = JSON.parse(readFileSync(themePath, 'utf8'));
  if (bg && bg.bgPatternId && bg.bgPatternId !== 0) {
    const asset = ppatAsset(theme, bg.bgPatternId);
    if (asset) theme.bodyBackground = { pattern: asset };
    else delete theme.bodyBackground;
  } else {
    delete theme.bodyBackground; // bgPatternId 0 → OS default (white)
  }
  writeFileSync(themePath, JSON.stringify(theme, null, 2));
  console.log(`[${slug}] bodyBackground=${theme.bodyBackground ? theme.bodyBackground.pattern : '(none → white)'}`);
}
