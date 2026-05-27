#!/usr/bin/env node
// Extract a scheme's icon-family resources (the scheme's own custom Finder
// icons) into themes/<slug>/icons/*.png + icons/index.json. Kept SEPARATE
// from extract-scheme.mjs so re-running it never rewrites the cicns/ppats
// PNGs (which would churn the bundle).
//
// Decodes the colour icons — 4-bit (icl4 32x32, ics4 16x16) against the fixed
// Apple 16-colour palette, AND 8-bit (icl8 / ics8) against the canonical Apple
// 256-colour SYSTEM palette — with alpha from the matching 1-bit mask resource
// (ICN# / ics#, same id — the second bitmap half is the mask). 4-bit is
// preferred where present (exact known palette); 8-bit fills any id a 4-bit
// icon didn't cover, so a scheme that ships ONLY 8-bit icons (e.g. Black
// Platinum) still yields its full glyph set instead of silently producing none.
//
// COMPLETENESS GUARD: if a scheme ships icon resources but extracts 0 glyphs,
// this exits non-zero with a loud warning (that gap is how Black Platinum's
// glyphs were silently missed). See docs/porting-a-kaleidoscope-scheme.md §3.5.
//
// Usage: node scripts/extract-icons.mjs <slug> [<slug>...] | --all

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseResourceFork } from '../tools/theme-loader/resource-fork.js';
import { macRgbToSrgb } from '../tools/theme-loader/mac-gamma.js';
import { encodePng } from './lib/png-encode.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');

// Apple's canonical 16-colour palette (the default 4-bit 'clut'). Exact, fixed.
// Pre-gamma'd to sRGB at module load (display transform — see lib/mac-gamma.mjs)
// so decodeIcon4 emits corrected pixels via a plain lookup.
const PALETTE16 = [
  [0xff, 0xff, 0xff], [0xfc, 0xf3, 0x05], [0xff, 0x64, 0x03], [0xdd, 0x09, 0x07],
  [0xf2, 0x08, 0x84], [0x47, 0x00, 0xa5], [0x00, 0x00, 0xd3], [0x02, 0xab, 0xea],
  [0x1f, 0xb7, 0x14], [0x00, 0x64, 0x12], [0x56, 0x2c, 0x05], [0x90, 0x71, 0x3a],
  [0xc0, 0xc0, 0xc0], [0x80, 0x80, 0x80], [0x40, 0x40, 0x40], [0x00, 0x00, 0x00],
].map(macRgbToSrgb);

// Apple's canonical 256-colour SYSTEM palette ('clut' 8) — schemes index ics8/icl8
// into this fixed table (they don't embed their own). RECONSTRUCTED canonically (not
// extracted): 0-214 = the 6×6×6 RGB cube (channels {255,204,153,102,51,0}, black
// omitted), 215-254 = four 10-step ramps {238,221,187,170,136,119,85,68,34,17} in
// order red/green/blue/GREY, 255 = black (relocating black to 255 shifts the GREY ramp
// to 245-254, so idx245 = light grey — the bug a prior hand-built version got wrong,
// blue trash can). See scripts/lib/mac-system-palette.json + its note. Pre-gamma'd to
// sRGB at module load (same display transform as PALETTE16).
const PALETTE256 = JSON.parse(readFileSync(resolve(__dirname, '../tools/theme-loader/mac-system-palette.json'), 'utf8')).palette.map(macRgbToSrgb);

// PNG (RGBA) encoder: scripts/lib/png-encode.mjs (shared — was triplicated inline).

const idStr = (id) => (id < 0 ? `n${-id}` : String(id));

// Decode a 1-bit mask bitmap (rowBytes per row, MSB first) → Uint8Array(size*size) of 0/1.
function decodeMaskBits(buf, off, size) {
  const rowBytes = size / 8;
  const out = new Uint8Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const byte = buf[off + y * rowBytes + (x >> 3)] ?? 0;
      out[y * size + x] = (byte >> (7 - (x & 7))) & 1;
    }
  }
  return out;
}

// Decode a 4-bit icon (size x size) against PALETTE16, masked by `mask`
// (Uint8Array of 0/1, or null → all opaque). Returns RGBA Uint8Array.
function decodeIcon4(data, size, mask) {
  const rgba = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    const byte = data[i >> 1] ?? 0;
    const idx = (i & 1) === 0 ? byte >> 4 : byte & 0x0f;
    const [r, g, b] = PALETTE16[idx];
    const a = mask ? (mask[i] ? 255 : 0) : 255;
    rgba[i * 4] = r; rgba[i * 4 + 1] = g; rgba[i * 4 + 2] = b; rgba[i * 4 + 3] = a;
  }
  return rgba;
}

// Decode an 8-bit icon (size x size, 1 byte/pixel) against the 256-colour system
// palette, masked by `mask`. Returns RGBA Uint8Array.
function decodeIcon8(data, size, mask) {
  const rgba = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    const [r, g, b] = PALETTE256[data[i] ?? 0];
    const a = mask ? (mask[i] ? 255 : 0) : 255;
    rgba[i * 4] = r; rgba[i * 4 + 1] = g; rgba[i * 4 + 2] = b; rgba[i * 4 + 3] = a;
  }
  return rgba;
}

// Fallback transparency for an icon that ships NO ICN#/ics# mask (it would otherwise
// render as a fully-opaque square — e.g. a Finder icon on a white box). If all four
// CORNERS are the same colour (a uniform background to key out), flood-fill that exact
// colour inward from the border and make it transparent. Border-connected only, so an
// enclosed same-colour region inside the shape (e.g. a white document face) stays
// opaque. No-op if the corners differ (full-bleed art with no background). Returns the
// number of pixels cleared (0 ⇒ left fully opaque). Mutates `rgba` alpha in place.
function cornerFloodTransparency(rgba, size) {
  const at = (x, y) => (y * size + x) * 4;
  const bg = [rgba[0], rgba[1], rgba[2]];
  const corners = [[0, 0], [size - 1, 0], [0, size - 1], [size - 1, size - 1]];
  const isBg = (o) => rgba[o] === bg[0] && rgba[o + 1] === bg[1] && rgba[o + 2] === bg[2];
  for (const [x, y] of corners) if (!isBg(at(x, y))) return 0; // corners not uniform → no background to key
  const seen = new Uint8Array(size * size);
  const stack = [];
  for (const [x, y] of corners) { const p = y * size + x; if (!seen[p]) { seen[p] = 1; stack.push(p); } }
  let cleared = 0;
  while (stack.length) {
    const p = stack.pop(), x = p % size, y = (p / size) | 0, o = p * 4;
    if (!isBg(o)) continue;          // a non-bg edge — the flood stops here
    rgba[o + 3] = 0; cleared++;       // background pixel → transparent
    for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
      if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
      const np = ny * size + nx; if (!seen[np]) { seen[np] = 1; stack.push(np); }
    }
  }
  return cleared;
}

function extract(slug) {
  const destDir = resolve(repoRoot, 'themes', slug);
  const rsrcPath = resolve(destDir, 'scheme.rsrc');
  if (!existsSync(rsrcPath)) { console.error(`Not found: ${rsrcPath}`); return; }
  const entries = parseResourceFork(new Uint8Array(readFileSync(rsrcPath)));

  // index masks by id
  const maskOf = (type, id) => {
    const r = entries.find((x) => x.type === type && x.id === id);
    return r ? r.data : null;
  };

  mkdirSync(resolve(destDir, 'icons'), { recursive: true });
  const index = [];
  const done = new Set(); // `${size}:${id}` already emitted (4-bit wins over 8-bit)

  // Glyph-resource census (for the completeness guard) — count what the scheme
  // SHIPS, so we can tell "nothing to extract" from "we missed it".
  const census = { ics4: 0, ics8: 0, icl4: 0, icl8: 0 };
  for (const e of entries) if (e.type in census) census[e.type]++;

  // Decode 4-bit FIRST (exact 16-colour palette), then 8-bit fills any id a
  // 4-bit icon didn't already cover (dedup by size+id) — so ics8-only schemes
  // still yield glyphs without duplicating the schemes that ship both depths.
  const TYPES = {
    icl4: { size: 32, maskType: 'ICN#', maskOff: 128, depth: 4 },
    ics4: { size: 16, maskType: 'ics#', maskOff: 32, depth: 4 },
    icl8: { size: 32, maskType: 'ICN#', maskOff: 128, depth: 8 },
    ics8: { size: 16, maskType: 'ics#', maskOff: 32, depth: 8 },
  };
  // Emit EVERY depth a scheme ships (icl4/ics4 + icl8/ics8). The diagnostic
  // inventory's job is to show ALL available assets, so we do NOT drop the
  // lower-depth duplicates — dedupe is per (type,id) only. The RENDERER picks the
  // highest depth per id when it builds the glyph map (loadTheme.loadGlyphMap), so
  // rendering uses 8-bit while the gallery still shows the 4-bit variant too.
  for (const type of ['icl8', 'ics8', 'icl4', 'ics4']) {
    const cfg = TYPES[type];
    const need = cfg.depth === 4 ? (cfg.size * cfg.size) / 2 : cfg.size * cfg.size;
    for (const e of entries) {
      if (e.type !== type) continue;
      const key = `${type}:${e.id}`;
      if (done.has(key)) continue; // same (type,id) already emitted
      if (e.data.length < need) continue;
      const maskData = maskOf(cfg.maskType, e.id);
      const mask = maskData && maskData.length >= cfg.maskOff * 2 ? decodeMaskBits(maskData, cfg.maskOff, cfg.size) : null;
      const rgba = cfg.depth === 4 ? decodeIcon4(e.data, cfg.size, mask) : decodeIcon8(e.data, cfg.size, mask);
      // No shipped ICN#/ics# mask → key out a uniform corner background (flood from
      // the border) so the icon reads as a cut-out shape, not an opaque white box.
      if (!mask) cornerFloodTransparency(rgba, cfg.size);
      // opaque coverage: full-bleed art (≈1.0) is usually a scheme logo/splash;
      // document/folder icons leave transparent margins. Lets the scene prefer
      // real "object" icons over the scheme's hero glyph.
      let opaque = 0;
      for (let i = 0; i < cfg.size * cfg.size; i++) if (rgba[i * 4 + 3] > 127) opaque++;
      const coverage = +(opaque / (cfg.size * cfg.size)).toFixed(3);
      const fname = `${type}-${idStr(e.id)}.png`;
      writeFileSync(resolve(destDir, 'icons', fname), encodePng(cfg.size, cfg.size, rgba));
      index.push({ id: e.id, type, size: cfg.size, depth: cfg.depth, file: fname, name: e.name || null, masked: !!mask, coverage });
      done.add(key);
    }
  }

  index.sort((a, b) => (b.size - a.size) || (a.id - b.id));
  writeFileSync(resolve(destDir, 'icons', 'index.json'), JSON.stringify(index, null, 2));

  // Completeness guard: a scheme that ships glyph resources MUST yield glyphs.
  // 0 extracted while resources exist = a real miss (corrupt data, or a depth/
  // format we don't decode) — fail loudly so it can't slip through silently.
  const totalRes = census.ics4 + census.ics8 + census.icl4 + census.icl8;
  const n = (t) => index.filter((i) => i.type === t).length;
  const miss = totalRes > 0 && index.length === 0;
  console.log(
    `[${slug}] ${index.length} icons → icons/  ` +
    `(icl4=${n('icl4')}, ics4=${n('ics4')}, icl8=${n('icl8')}, ics8=${n('ics8')}; ` +
    `shipped ics4=${census.ics4}/ics8=${census.ics8}/icl4=${census.icl4}/icl8=${census.icl8})` +
    (miss ? `  ⚠ MISSED: ${totalRes} icon resources shipped but 0 extracted` : ''),
  );
  if (miss) process.exitCode = 1;
}

const argv = process.argv.slice(2);
if (argv.length === 0) { console.error('Usage: node scripts/extract-icons.mjs <slug>... | --all'); process.exit(2); }
const themesRoot = resolve(repoRoot, 'themes');
const slugs = argv.includes('--all')
  ? readdirSync(themesRoot).filter((s) => existsSync(resolve(themesRoot, s, 'scheme.rsrc')))
  : argv;
for (const s of slugs) extract(s);
