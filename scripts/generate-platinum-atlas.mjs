// scripts/generate-platinum-atlas.mjs
// Emit the two sprite atlases into the bundle:
//   • sprite-atlas.png        — the 1× PAINTABLE surface (magenta gutters, no
//                               labels/lines). Paint this at native scale (zoom
//                               in your editor), then feed it back through
//                               slice-atlas.mjs for a clean 1:1 cut.
//   • sprite-atlas-guide.png  — the 4× annotated REFERENCE MAP (labels + magenta
//                               slice lines). Read-only; shows where the cuts fall.
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodePng } from './lib/png-encode.mjs';
import { buildPaintableAtlas, buildGuideAtlas } from './generate-platinum/atlas.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dest = resolve(root, 'themes/apple-platinum-replica');
mkdirSync(dest, { recursive: true });
const rel = (p) => p.replace(root + '/', '');

const paint = buildPaintableAtlas();
const paintOut = resolve(dest, 'sprite-atlas.png');
writeFileSync(paintOut, encodePng(paint.width, paint.height, paint.rgba));
console.log(`[atlas] paintable ${paint.width}×${paint.height}  ${paint.layout.slots.length} sprites @ 1x → ${rel(paintOut)}`);

const guide = buildGuideAtlas();
const guideOut = resolve(dest, 'sprite-atlas-guide.png');
writeFileSync(guideOut, encodePng(guide.width, guide.height, guide.rgba));
console.log(`[atlas] guide map ${guide.width}×${guide.height}  labelled + slice lines @ ${guide.layout.scale}x → ${rel(guideOut)}`);
