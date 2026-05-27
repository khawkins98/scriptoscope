#!/usr/bin/env node
// scripts/gen-themes-manifest.mjs
// Emit demo/themes-manifest.json — the gallery's theme list, DERIVED from each
// bundle (theme.json presence + meta.json provenance + whether a reference
// screenshot exists). The demo imports this instead of a hand-maintained THEMES
// array, so a freshly-imported scheme shows up in the ribbon with NO code edit.
//
//   node scripts/gen-themes-manifest.mjs
// Runs at the tail of build:themes and after `npm run import`.
//
// Label format (mirrors the ribbon's `name ✦ badge` parsing): real ported schemes
// get "<name> (<author>, <year>) ✦ real scheme"; generated bundles "<name> ✦ generated".
// Order: real schemes first (alphabetical by slug), generated bundles last — so a new
// import slots in deterministically and THEMES[0] (the ribbon's no-hash default) is stable.

import { readdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const themesDir = resolve(root, 'themes');
const refsDir = resolve(root, 'demo/assets/references');

const entries = [];
for (const slug of readdirSync(themesDir).sort()) {
  const dir = resolve(themesDir, slug);
  if (!existsSync(resolve(dir, 'theme.json'))) continue; // a real, extracted bundle
  let meta = {};
  try { meta = JSON.parse(readFileSync(resolve(dir, 'meta.json'), 'utf8')); } catch { /* no meta → derive from slug */ }

  const name = meta.name && !String(meta.name).includes('←') ? meta.name : slug;
  const kind = meta.origin?.kind;
  const ported = kind === 'kaleidoscope-port';
  const generated = kind === 'first-party-generated';
  const credit = ported && meta.author?.name
    ? ` (${meta.author.name}${meta.author.year ? `, ${meta.author.year}` : ''})`
    : '';
  const badge = ported ? ' ✦ real scheme' : generated ? ' ✦ generated' : '';
  const label = `${name}${credit}${badge}`;
  const ref = existsSync(resolve(refsDir, `${slug}.png`)) ? `${slug}.png` : null;

  entries.push({ slug, label, generated, ...(ref ? { ref } : {}) });
}

// Real schemes first (already alpha from the sorted readdir), generated last.
entries.sort((a, b) => (a.generated === b.generated ? 0 : a.generated ? 1 : -1));
// Drop the internal `generated` flag from the emitted manifest (the badge carries it).
const manifest = entries.map(({ generated, ...rest }) => rest);

const out = resolve(root, 'demo/themes-manifest.json');
writeFileSync(out, JSON.stringify(manifest, null, 2) + '\n');
console.log(`themes-manifest: ${manifest.length} themes → demo/themes-manifest.json (first: ${manifest[0]?.slug})`);
