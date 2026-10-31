#!/usr/bin/env node
// Build an authored Kaleidoscope scheme from code.
//
// Usage: npm run author -- <scheme dir> [--sheet] [--palette]
//        e.g. npm run author -- authoring/schemes/halcyon --sheet
//
// The scheme dir holds a `scheme.mjs` that exports `buildScheme()`, returning
// `{ resources }` (see tools/theme-author/ and docs/authoring-a-scheme.md).
// This script:
//   1. calls buildScheme() and serializes the resources into a resource fork;
//   2. reads those bytes back through the SAME conversion the browser runtime
//      uses (convertChrome), so anything the runtime would reject fails here first;
//   3. checks the authoring rules in tools/theme-author/check-scheme.js and
//      prints a short report;
//   4. only if there are no errors, writes <dir>/scheme.rsrc (the raw resource
//      fork, what Scriptoscope loads) and <dir>/scheme.bin (the same fork as a
//      MacBinary file with type 'Colr' / creator 'Acid', for a classic Mac).
// Exit code 1 on any error (nothing is written). Warnings do not fail the build.
//
// Review aids (docs/authoring-a-scheme.md §4.5), written even on errors:
//   --sheet    <dir>/sheet.png: every cicn and ppat at 4× by family, with an
//              8-bit simulation panel beside it (don't commit it)
//   --palette  prints the palette report for <dir>/palette.mjs: where each
//              colour lands at 8 bpp, collapses, and contrast for the title and
//              button colours the engine samples plus any pairs the palette
//              exports as CONTRAST = [[fg, bg, label, floor?], …]

import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { writeResourceFork } from '../tools/theme-author/resource-fork-writer.js';
import { writeMacBinary } from '../tools/theme-author/macbinary.js';
import { checkScheme, titleContrast } from '../tools/theme-author/check-scheme.js';
import { contactSheet } from '../tools/theme-author/contact-sheet.js';
import { paletteReport, formatPaletteReport } from '../tools/theme-author/palette-report.js';
import { encodePng } from './lib/png-encode.mjs';
import { convertChrome } from '../tools/theme-loader/convert.js';

const args = process.argv.slice(2);
const dir = args.find((a) => !a.startsWith('--'));
const wantSheet = args.includes('--sheet'), wantPalette = args.includes('--palette');
if (!dir) {
  console.error('Usage: npm run author -- <scheme dir containing scheme.mjs> [--sheet] [--palette]');
  process.exit(2);
}
const schemeDir = resolve(dir);
const entry = resolve(schemeDir, 'scheme.mjs');
if (!existsSync(entry)) {
  console.error(`No scheme.mjs in ${schemeDir}`);
  process.exit(2);
}

// Mistakes in scheme.mjs (a bad windowLayout spec, a fractional pixel, too
// many colours) throw with a message that says what to change; show that
// message rather than a stack trace. DEBUG=1 prints the stack too.
let resources, fork;
try {
  const { buildScheme } = await import(pathToFileURL(entry).href);
  ({ resources } = await buildScheme());
  fork = writeResourceFork(resources);
} catch (err) {
  console.error(`✗ Building ${entry} failed: ${err instanceof Error ? err.message : err}`);
  if (process.env.DEBUG && err instanceof Error) console.error(err.stack);
  process.exit(1);
}
const out = resolve(schemeDir, 'scheme.rsrc');

const metaPath = resolve(schemeDir, 'meta.json');
const meta = existsSync(metaPath) ? JSON.parse(readFileSync(metaPath, 'utf8')) : {};

let converted;
try {
  converted = convertChrome(fork, { meta, source: 'scheme.rsrc' });
} catch (err) {
  console.error(`✗ The runtime's loader rejected the scheme: ${err instanceof Error ? err.message : err}`);
  process.exit(1);
}

const { errors, warnings, summary } = checkScheme(resources, converted.theme);
for (const line of summary) console.log(`  ${line}`);
for (const w of warnings) console.log(`  ⚠ ${w}`);
for (const e of errors) console.log(`  ✗ ${e}`);
if (wantSheet) {
  const sheet = contactSheet(resources, { sim8: true });
  const sheetPath = resolve(schemeDir, 'sheet.png');
  writeFileSync(sheetPath, encodePng(sheet.width, sheet.height, sheet.rgba));
  console.log(`Wrote ${sheetPath} (${sheet.count} images, ${sheet.width}x${sheet.height}; web on the left, 8 bpp simulation on the right)`);
}
if (wantPalette) await printPaletteReport();
if (errors.length) { console.error(`✗ ${errors.length} error(s); ${out} was not written.`); process.exit(1); }
writeFileSync(out, fork);
console.log(`Wrote ${out} (${fork.length.toLocaleString()} bytes, ${resources.length} resources)`);
// The classic Mac file name comes from meta.json (max 31 characters).
const macName = String(meta.name ?? 'Untitled Scheme').slice(0, 31);
const bin = resolve(schemeDir, 'scheme.bin');
writeFileSync(bin, writeMacBinary({ name: macName, resourceFork: fork }));
console.log(`Wrote ${bin} (MacBinary "${macName}", type Colr, creator Acid)`);
console.log('✓ Loads through the runtime converter. Preview: npm run dev, then open /authoring-preview.html (or drop scheme.rsrc on the showcase).');

async function printPaletteReport() {
  const palettePath = resolve(schemeDir, 'palette.mjs');
  const mod = existsSync(palettePath) ? await import(pathToFileURL(palettePath).href) : {};
  const palette = Object.fromEntries(Object.entries(mod).filter(([k, v]) => k !== 'CONTRAST' && typeof v !== 'function'));
  // The colours the engine samples (title swatch on the bar, push label on its face)…
  // Windows that share a title pair are listed once.
  const titles = new Map();
  for (const t of titleContrast(resources)) {
    const key = `${t.state} ${t.text} ${t.bar}`;
    if (!titles.has(key)) titles.set(key, { ...t, others: 0 }); else titles.get(key).others++;
  }
  const pairs = [...titles.values()].map((t) => [t.text, t.bar, `${t.window}${t.others ? ` (+${t.others})` : ''} ${t.state} title`]);
  for (const line of summary) {
    const m = /^(push button|pressed push button): face (#\w+), text (#\w+)/.exec(line);
    if (m) pairs.push([m[3], m[2], `${m[1]} label`, 'label']);
  }
  // …plus whatever the palette declares.
  for (const p of mod.CONTRAST ?? []) pairs.push(p);
  console.log(`Palette report (${existsSync(palettePath) ? 'palette.mjs' : 'no palette.mjs; sampled colours only'}):`);
  for (const line of formatPaletteReport(paletteReport(palette, { pairs }))) console.log(`  ${line}`);
}
