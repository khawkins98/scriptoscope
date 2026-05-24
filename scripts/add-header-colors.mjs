// Enrich each theme's theme.json with `headerColors`, decoded from the
// scheme's window-header cluts (-14335 active / -14336 inactive).
//
// Why a separate step: the window cicns carry no cinf, and the
// extraction manifests don't capture cluts — so the frame APPEARANCE
// colors (clut part codes per "Creating Color Schemes") live only in
// scheme.rsrc. This patches them in.
//
// NB: the clut part-2 "Text" entry is NOT surfaced — it's a frame tint, not
// the rendered title-text colour (the title text is the classic-Mac default;
// see kdef231-reference.md §1.4 / docs/tracking/title-text-color.md).
// Idempotent; safe to re-run. build-theme-bundles.mjs does the same for
// the themes that still have extraction manifests.
//
//   node scripts/add-header-colors.mjs          # all themes/<slug>/
//   node scripts/add-header-colors.mjs acid     # one

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseResourceFork } from '../tools/theme-loader/resource-fork.js';
import { decodeClut, headerColorsFromClut } from '../tools/theme-loader/decoders/clut.js';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const themesDir = resolve(repoRoot, 'themes');

const slugs = process.argv.slice(2);
const targets = slugs.length
  ? slugs
  : readdirSync(themesDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);

for (const slug of targets) {
  const dir = resolve(themesDir, slug);
  const rsrcPath = resolve(dir, 'scheme.rsrc');
  const themePath = resolve(dir, 'theme.json');
  if (!existsSync(rsrcPath) || !existsSync(themePath)) {
    console.log(`[${slug}] skip (missing scheme.rsrc or theme.json)`);
    continue;
  }
  const entries = parseResourceFork(new Uint8Array(readFileSync(rsrcPath)));
  const headerFor = (id) => {
    const e = entries.find((r) => r.type === 'clut' && r.id === id);
    return e ? headerColorsFromClut(decodeClut(e.data)) : null;
  };
  const active = headerFor(-14335);
  const inactive = headerFor(-14336);
  if (!active && !inactive) {
    console.log(`[${slug}] no header cluts`);
    continue;
  }
  const theme = JSON.parse(readFileSync(themePath, 'utf8'));
  theme.headerColors = {};
  if (active) theme.headerColors.active = active;
  if (inactive) theme.headerColors.inactive = inactive;
  writeFileSync(themePath, JSON.stringify(theme, null, 2));
  console.log(`[${slug}] headerColors: active.fill=${active?.fill} frame=${active?.frame}`);
}
