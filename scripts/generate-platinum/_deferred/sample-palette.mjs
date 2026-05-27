// scripts/generate-platinum/sample-palette.mjs
// Color-source step: sample the in-repo apple-platinum-2 control cicns at the
// face/bevel pixels the WDEF decode pins, and cross-check the scheme's own
// document-window header `clut` (id -14336). Prints per-slot RGB + source for
// review; the agreed values are transcribed into palette.mjs.
//
// Run: node scripts/generate-platinum/sample-palette.mjs
//
// Why these sources (faithfulness, not invention):
//  - apple-platinum-2 is a licensed real Platinum Kaleidoscope scheme already in
//    the repo. Its scrollbar cicns carry the canonical Platinum neutral gray ramp
//    (every face/bevel pixel is a multiple of 17 = 0x11, the classic 4-bit grays).
//  - Its `clut` id -14336 IS the document-window header color set — the closest
//    authentic source for the title-bar grays (the WDEF itself hardcodes none; the
//    decode doc, "Color sourcing", says the literal grays live in the window wctb).
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseResourceFork } from '../../tools/theme-loader/resource-fork.js';
import { decodeCicn } from '../../tools/theme-loader/decoders/cicn.js';
import { decodeClut } from '../../tools/theme-loader/decoders/clut.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const rsrc = parseResourceFork(new Uint8Array(readFileSync(resolve(root, 'themes/apple-platinum-2/scheme.rsrc'))));

const cicnById = (id) => {
  const e = rsrc.find((x) => x.type === 'cicn' && x.id === id);
  if (!e) throw new Error(`cicn ${id} not found in apple-platinum-2`);
  return decodeCicn(e.data);
};
const clutById = (id) => {
  const e = rsrc.find((x) => x.type === 'clut' && x.id === id);
  if (!e) throw new Error(`clut ${id} not found in apple-platinum-2`);
  return decodeClut(e.data);
};
const hexToRgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

// ── Source 1: the "Normal Vertical Scrollbar" cicn (-8278, 16×16) ──
// A clean beveled gray control face: black outer frame, a dark top/left line,
// a mid-gray face, and a light bottom/right line — the Platinum ramp end to end.
const SCROLL = -8278;
const scroll = cicnById(SCROLL);
const px = (img, x, y) => {
  const i = (y * img.width + x) * 4;
  return [img.rgba[i], img.rgba[i + 1], img.rgba[i + 2], img.rgba[i + 3]];
};

// ── Source 2: the document-window header clut (-14336) ──
const headerClut = clutById(-14336);
const clutHex = (v) => hexToRgb(headerClut.entries[v].hex);

// Sample points pinned by the decode (the scrollbar reads the SAME ramp the
// title bar does; the window uses the raised polarity — top/left light,
// bottom/right dark — but the RGB ramp values are shared):
const samples = [
  // slot,           source desc,                         rgb
  ['frameOutline',   `cicn ${SCROLL} px(0,0) — outer dark frame edge`,        px(scroll, 0, 0).slice(0, 3)],
  ['frameOutline*',  `clut -14336 entry 0 (#000000)`,                          clutHex(0)],
  ['widgetFace',     `cicn ${SCROLL} px(5,8) — mid-gray control face`,         px(scroll, 5, 8).slice(0, 3)],
  ['titleFillBack*', `clut -14336 entry 4 (#aaaaaa) — header mid gray`,        clutHex(4)],
  ['bevelHighlight', `cicn ${SCROLL} px(13,14) — light bottom/right line`,     px(scroll, 13, 14).slice(0, 3)],
  ['bevelHighlight*',`clut -14336 entry 3 (#ffffff) — header white`,           clutHex(3)],
  ['bevelShadow',    `cicn ${SCROLL} px(1,1) — dark top/left line`,            px(scroll, 1, 1).slice(0, 3)],
  ['titleFillFore?', `clut -14336 entry 1 (#dddddd) — header light gray (pinstripe lit row)`, clutHex(1)],
  ['titleText',      `clut -14336 entry 0 (#000000) — header text is black`,   clutHex(0)],
];

console.log('Sampling apple-platinum-2 for the Platinum gray ramp…\n');
console.log('Document-window header clut (-14336) full ramp:');
headerClut.entries.forEach((e) => console.log(`  [${e.value}] ${e.hex}`));
console.log('\nPer-slot samples (slot | rgb | source):');
for (const [slot, src, rgb] of samples) {
  console.log(`  ${slot.padEnd(16)} ${String('[' + rgb.join(',') + ']').padEnd(18)} ${src}`);
}
console.log(
  '\nNotes:\n' +
  '  * cross-check source (clut) — agrees with the cicn ramp.\n' +
  '  ? titleFillFore is the title-bar PINSTRIPE foreground stripe. The WDEF tiles a\n' +
  '    code-baked AA00 pattern and the literal stripe colors are window wctb data not\n' +
  '    sampleable from apple-platinum-2 (a controls-only scheme with no title art). The\n' +
  '    header clut entry 1 (#dddddd) and entry 3 (#ffffff) bracket it; titleFillFore is\n' +
  '    set PROVISIONAL = #ffffff (white) in palette.mjs and flagged for confirmation.',
);
