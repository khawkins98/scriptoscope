#!/usr/bin/env node
// Shrink a region of a concept image to 1× and snap it to a palette, as the
// starting point for hand-cleaned pixel art (tools/theme-author/paint-over.js,
// docs/authoring-a-scheme.md §4.3).
//
// Usage:
//   npm run paint-over -- <concept.png> --crop x,y,w,h --scale 3 \
//       --palette authoring/schemes/halcyon/palette.mjs [--key '#c8d4e4'] \
//       [--method mode|mean] [--out bird.png] [--zoom 8]
//
// The concept must be a PNG; convert a JPEG first with
//   sips -s format png concept.jpg --out /tmp/concept.png
// --palette takes a palette.mjs (every '#rrggbb' string it exports, nested
// objects included) or a comma list of colours. Without it the 256-colour Mac
// system palette is used. Writes <out> at 1× and <out minus .png>@<zoom>x.png
// for looking at. Print the result as code with --emit.

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { decodePng } from './lib/png-decode.mjs';
import { encodePng } from './lib/png-encode.mjs';
import { paintOver } from '../tools/theme-author/paint-over.js';
import { SYSTEM_PALETTE_256 } from '../tools/theme-author/encode-icons.js';

const args = process.argv.slice(2);
const opt = (name, fallback) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : fallback; };
const file = args.find((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--'));
const cropArg = opt('crop');
if (!file || !cropArg) {
  console.error('Usage: npm run paint-over -- <concept.png> --crop x,y,w,h --scale N [--palette palette.mjs|#hex,…] [--key #hex] [--method mode|mean] [--out out.png] [--zoom 8] [--emit]');
  process.exit(2);
}
const [x, y, w, h] = cropArg.split(',').map(Number);
const scale = Number(opt('scale', '3'));
const zoom = Number(opt('zoom', '8'));
const out = resolve(opt('out', 'paint-over.png'));

const palette = await loadPalette(opt('palette'));
const image = decodePng(readFileSync(file));
const raster = paintOver(image, {
  crop: { x, y, w, h }, scale, palette,
  key: opt('key', null), keyTolerance: Number(opt('key-tolerance', '24')),
  method: /** @type {'mode'|'mean'} */ (opt('method', 'mode')),
});

writeFileSync(out, encodePng(raster.width, raster.height, raster.rgba));
const big = new Uint8Array(raster.width * zoom * raster.height * zoom * 4);
for (let py = 0; py < raster.height * zoom; py++) for (let px = 0; px < raster.width * zoom; px++) {
  const s = ((Math.floor(py / zoom) * raster.width) + Math.floor(px / zoom)) * 4;
  big.set(raster.rgba.subarray(s, s + 4), (py * raster.width * zoom + px) * 4);
}
const zoomed = out.replace(/\.png$/, '') + `@${zoom}x.png`;
writeFileSync(zoomed, encodePng(raster.width * zoom, raster.height * zoom, big));
console.log(`Wrote ${out} (${raster.width}×${raster.height}) and ${zoomed}`);
if (args.includes('--emit')) console.log(emit(raster));

async function loadPalette(spec) {
  if (!spec) return SYSTEM_PALETTE_256.map(([r, g, b]) => `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`);
  if (!spec.endsWith('.mjs')) return spec.split(',');
  const mod = await import(pathToFileURL(resolve(spec)).href);
  const found = new Set();
  const walk = (v) => {
    if (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v)) found.add(v.toLowerCase());
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  walk(mod);
  if (!found.size) throw new Error(`No '#rrggbb' colours exported by ${spec}`);
  return [...found];
}

// The raster as rows of single-character keys plus a legend, ready to paste
// into a sprite module and edit by hand.
function emit(r) {
  const keys = '.abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const legend = new Map();
  const rows = [];
  for (let yy = 0; yy < r.height; yy++) {
    let row = '';
    for (let xx = 0; xx < r.width; xx++) {
      const i = (yy * r.width + xx) * 4;
      if (r.rgba[i + 3] < 128) { row += '.'; continue; }
      const hex = `#${[0, 1, 2].map((k) => r.rgba[i + k].toString(16).padStart(2, '0')).join('')}`;
      if (!legend.has(hex)) legend.set(hex, keys[legend.size + 1] ?? '?');
      row += legend.get(hex);
    }
    rows.push(`  '${row}',`);
  }
  const leg = [...legend].map(([hex, k]) => `  ${k}: '${hex}',`).join('\n');
  return `const LEGEND = {\n${leg}\n};\nconst ROWS = [\n${rows.join('\n')}\n];`;
}
