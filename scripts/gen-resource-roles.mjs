#!/usr/bin/env node
// Write a per-theme `resource-roles.json`: every shipped resource id → its DECODED
// role, so the renderer (and humans) don't re-guess a resource's purpose from its
// filename slug. The recurring trap this closes: the SAME id means different things
// across schemes (e.g. -10078 = "french-blue" hue in apple-platinum-2 but the
// "track-active" role in 1990) AND across the cicn/ics4 dual channel (e.g. -10239
// cicn = push-button face, -10239 ics4 = checkbox glyph). Inferring roles from one
// scheme's slugs on a SUBSET of ids is how the progress bar got modelled wrong three
// times — so this makes the id→role mapping DATA, derived from a rubric + the
// scheme's actual resource set.
//
// Output per theme:
//   { theme, progress:{…resolved model…}, scrollArrows:{…}, resources:[ {id,type,slug,family,role} … ] }
// The `progress` + `scrollArrows` summaries resolve the per-scheme model (the two
// families that historically bit us); `resources` is the full classified list.
//
// Deterministic (sorted, no timestamp). Run in build:themes so every import regen's it.
// Usage:  node scripts/gen-resource-roles.mjs [slug]

// The rubric itself lives in tools/theme-loader/classifyResources.js and is shared
// with the runtime inspector (`loadKaleidoscopeScheme`), so the bake and the browser
// classify through ONE copy. This script only lists the baked files and writes JSON.

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildResourceRoles, parseCicnFilename, parsePpatFilename } from '../tools/theme-loader/classifyResources.js';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const themesRoot = resolve(repoRoot, 'themes');
const only = process.argv[2];
const slugs = (only ? [only] : readdirSync(themesRoot)).filter((s) =>
  existsSync(resolve(themesRoot, s, 'theme.json')),
);

const listPng = (dir) => (existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.png')).sort() : []);

let total = 0;
for (const slug of slugs) {
  const dir = resolve(themesRoot, slug);
  // Sign prefix is optional — the extractor writes positive ids without a prefix
  // (e.g. `cicn-0-…` / `cicn-128-…`); parseCicnFilename handles both.
  const cicns = listPng(resolve(dir, 'cicns')).map(parseCicnFilename);
  const ppats = listPng(resolve(dir, 'ppats')).map(parsePpatFilename);
  let iconIndex = [];
  const iconIndexPath = resolve(dir, 'icons', 'index.json');
  if (existsSync(iconIndexPath)) {
    try { iconIndex = JSON.parse(readFileSync(iconIndexPath, 'utf8')); } catch { /* ignore */ }
  }

  const roles = buildResourceRoles(slug, cicns, ppats, iconIndex);
  if (!roles.resources.length) continue;

  const out = {
    _generator: 'scripts/gen-resource-roles.mjs',
    _note: 'Per-theme resource id → DECODED role. Roles come from a rubric + the actual resource set, NOT guessed from filename slugs. The same id differs across schemes and across the cicn/ics4 dual channel. See docs/spec/kdef231-reference.md.',
    ...roles,
  };
  writeFileSync(resolve(dir, 'resource-roles.json'), JSON.stringify(out, null, 1) + '\n');
  total++;
  console.log(`  ${slug.padEnd(28)} ${out.resources.length} resources · progress=${out.progress.model} · arrows=${out.scrollArrows ? 'yes' : 'no'}`);
}
console.log(`\n-- wrote resource-roles.json for ${total} theme(s) --`);
