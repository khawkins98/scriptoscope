// scripts/slice-platinum-atlas.mjs
// Slice a painted master atlas PNG back into the per-type cicn PNGs in the
// bundle, at their correct native dimensions. Uses the SAME layout coords the
// atlas was generated with (atlas-layout.mjs), so painted art lands exactly.
//
// Usage:
//   node scripts/slice-platinum-atlas.mjs [atlas.png] [--dry]
// Default atlas path: themes/apple-platinum-replica/sprite-atlas.png
// --dry: report what would be written without touching files.
//
// NOTE: this writes ONLY the cicn PNGs — the theme.json / wnd# recipes are
// independent of the pixels and don't need regenerating. After slicing, run
// `npm run lint:themes` to validate.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodePng } from './lib/png-encode.mjs';
import { decodePng } from './diag-lib.mjs';
import { sliceAtlas } from './generate-platinum/slice-atlas.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dest = resolve(root, 'themes/apple-platinum-replica');

const argv = process.argv.slice(2);
const dry = argv.includes('--dry');
const atlasPath = argv.find((a) => !a.startsWith('--')) ?? resolve(dest, 'sprite-atlas.png');

const atlas = decodePng(readFileSync(resolve(atlasPath)));
const sprites = sliceAtlas(atlas);

let written = 0;
for (const s of sprites) {
  const outPath = resolve(dest, s.file);
  if (dry) { console.log(`  would write ${s.file}  (${s.width}×${s.height})`); continue; }
  writeFileSync(outPath, encodePng(s.width, s.height, s.rgba));
  written++;
}
console.log(`[slice-atlas] ${dry ? 'dry-run' : `wrote ${written}`} of ${sprites.length} cicn sprites from ${atlasPath.replace(root + '/', '')}`);
