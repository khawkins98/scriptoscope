#!/usr/bin/env node
// 8-bit simulation of a PNG: what classic Kaleidoscope on an 8 bpp screen
// would show for the same art. Thin wrapper over tools/theme-author/sim8.js.
//
// Usage: node scripts/sim8.mjs in.png out.png [--dpr 2] [--zoom 4] [--capture] [--exact]
//   --dpr N    take every Nth pixel first (the authoring previews are DPR-2 captures)
//   --zoom N   nearest-neighbour upscale the result
//   --capture  show entries at the levels the committed classic/*.png captures use
//              (default: as the web runtime shows stored colours)
//   --exact    exact nearest entry instead of the 4-bit inverse-table model
// The input is taken as on-screen colours (a web preview or screenshot).
import { readFileSync, writeFileSync } from 'node:fs';
import { decodePng } from './lib/png-decode.mjs';
import { encodePng } from './lib/png-encode.mjs';
import { simulate8bit } from '../tools/theme-author/sim8.js';

const args = process.argv.slice(2);
const opt = (name, dflt) => { const i = args.indexOf(name); return i < 0 ? dflt : Number(args[i + 1]); };
const files = args.filter((a, i) => !a.startsWith('--') && !['--dpr', '--zoom'].includes(args[i - 1]));
if (files.length !== 2) {
  console.error('Usage: node scripts/sim8.mjs in.png out.png [--dpr 2] [--zoom 4] [--capture] [--exact]');
  process.exit(2);
}
const [src, dst] = files;
const dpr = opt('--dpr', 1), zoom = opt('--zoom', 1);

let img = decodePng(readFileSync(src));
if (dpr > 1) img = scale(img, 1 / dpr);
const sim = simulate8bit(img, { output: args.includes('--capture') ? 'capture' : 'web', itabRes: args.includes('--exact') ? 0 : 4 });
const out = zoom > 1 ? scale(sim, zoom) : sim;
writeFileSync(dst, encodePng(out.width, out.height, out.rgba));
console.log(`${dst}: ${out.width}x${out.height}, ${sim.colorsBefore} colours before, ${sim.colorsAfter} after`);

/** Nearest-neighbour resample by `f` (0.5 = every 2nd pixel, 4 = 4× upscale). */
function scale({ width, height, rgba }, f) {
  const w = Math.max(1, Math.floor(width * f)), h = Math.max(1, Math.floor(height * f));
  const o = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const sx = Math.min(width - 1, Math.floor(x / f)), sy = Math.min(height - 1, Math.floor(y / f));
    o.set(rgba.subarray((sy * width + sx) * 4, (sy * width + sx) * 4 + 4), (y * w + x) * 4);
  }
  return { width: w, height: h, rgba: o };
}
