// scripts/generate-platinum-atlas.mjs
// Emit the master sprite atlas PNG into the bundle. The atlas lays out all 26
// base sprites (13 types × active/inactive) with magenta slice lines + labels
// for hand-painting. After painting, feed it back through slice-atlas.mjs.
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodePng } from './lib/png-encode.mjs';
import { buildAtlas } from './generate-platinum/atlas.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dest = resolve(root, 'themes/apple-platinum-replica');
mkdirSync(dest, { recursive: true });

const { width, height, rgba, layout } = buildAtlas();
const out = resolve(dest, 'sprite-atlas.png');
writeFileSync(out, encodePng(width, height, rgba));
console.log(`[atlas] ${width}×${height}  ${layout.slots.length} sprites (${layout.slots.length / 2} types × 2 states) @ ${layout.scale}x → ${out.replace(root + '/', '')}`);
