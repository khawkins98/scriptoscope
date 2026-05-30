#!/usr/bin/env node
// scripts/gen-themes-manifest.mjs
// Emit demo/themes-manifest.json — the gallery's theme list, DERIVED from each
// bundle (scheme.rsrc presence + meta.json provenance + whether a reference
// screenshot exists). The demo imports this instead of a hand-maintained THEMES
// array, so a freshly-imported scheme shows up in the ribbon with NO code edit.
//
//   node scripts/gen-themes-manifest.mjs
// Runs at the tail of build:themes and after `npm run import`.
//
// Label format (mirrors the ribbon's `name ✦ badge` parsing): ported schemes
// get "<name> (<author>, <year>)" — the corpus is 18-for-18 ported as of
// 2026-05-30, so no badge is needed to disambiguate (the "✦ real scheme"
// suffix was meaningful only when first-party-generated bundles like the
// retired apple-platinum-replica also lived in the corpus). Any future
// generated bundle gets "<name> ✦ generated" so the partition stays visible.
// Order: ported first (alphabetical by slug), generated last — keeps
// THEMES[0] (the ribbon's no-hash default) stable as new imports land.

import { readdirSync, existsSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const themesDir = resolve(root, 'themes');
const refsDir = resolve(root, 'demo/assets/references');

const entries = [];
for (const slug of readdirSync(themesDir).sort()) {
  const dir = resolve(themesDir, slug);
  // Shippable iff EITHER source-of-truth file is present (Option A: scheme.sit preferred, scheme.rsrc fallback).
  if (!existsSync(resolve(dir, 'scheme.sit')) && !existsSync(resolve(dir, 'scheme.rsrc'))) continue;
  let meta = {};
  try { meta = JSON.parse(readFileSync(resolve(dir, 'meta.json'), 'utf8')); } catch { /* no meta → derive from slug */ }

  const name = meta.name && !String(meta.name).includes('←') ? meta.name : slug;
  const kind = meta.origin?.kind;
  const ported = kind === 'kaleidoscope-port';
  const generated = kind === 'first-party-generated';
  const credit = ported && meta.author?.name
    ? ` (${meta.author.name}${meta.author.year ? `, ${meta.author.year}` : ''})`
    : '';
  const badge = generated ? ' ✦ generated' : '';
  const label = `${name}${credit}${badge}`;
  const ref = existsSync(resolve(refsDir, `${slug}.png`)) ? `${slug}.png` : null;
  // Source-of-truth hint: which file the runtime should fetch (scheme.sit > scheme.rsrc).
  // Lets `loadTheme` skip the .sit → .rsrc cascade for .rsrc-only bundles (avoids the
  // dev-console 404 noise on the 5 wayback-recovered ones), and gives the demo a way to
  // surface "via .sit" vs "via .rsrc" if it ever wants to.
  const source = existsSync(resolve(dir, 'scheme.sit')) ? 'scheme.sit'
    : existsSync(resolve(dir, 'scheme.rsrc')) ? 'scheme.rsrc' : null;
  if (!source) continue;
  const sourceBytes = statSync(resolve(dir, source)).size;

  entries.push({ slug, label, generated, source, sourceBytes, ...(ref ? { ref } : {}) });
}

// Real schemes first (already alpha from the sorted readdir), generated last.
entries.sort((a, b) => (a.generated === b.generated ? 0 : a.generated ? 1 : -1));
// Drop the internal `generated` flag from the emitted manifest (the badge carries it).
const manifest = entries.map(({ generated, ...rest }) => rest);

const out = resolve(root, 'demo/themes-manifest.json');
writeFileSync(out, JSON.stringify(manifest, null, 2) + '\n');
console.log(`themes-manifest: ${manifest.length} themes → demo/themes-manifest.json (first: ${manifest[0]?.slug})`);
