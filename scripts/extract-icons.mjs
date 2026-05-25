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
import { deflateSync } from 'node:zlib';
import { parseResourceFork } from '../tools/theme-loader/resource-fork.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');

// Apple's canonical 16-colour palette (the default 4-bit 'clut'). Exact, fixed.
const PALETTE16 = [
  [0xff, 0xff, 0xff], [0xfc, 0xf3, 0x05], [0xff, 0x64, 0x03], [0xdd, 0x09, 0x07],
  [0xf2, 0x08, 0x84], [0x47, 0x00, 0xa5], [0x00, 0x00, 0xd3], [0x02, 0xab, 0xea],
  [0x1f, 0xb7, 0x14], [0x00, 0x64, 0x12], [0x56, 0x2c, 0x05], [0x90, 0x71, 0x3a],
  [0xc0, 0xc0, 0xc0], [0x80, 0x80, 0x80], [0x40, 0x40, 0x40], [0x00, 0x00, 0x00],
];

// Apple's canonical 256-colour SYSTEM palette ('clut' 8) — schemes index ics8/
// icl8 into this fixed table (they don't embed their own). It is the 6×6×6 RGB
// cube (channels {255,204,153,102,51,0}, index 0 = white … 215 = black) followed
// by 4×10 single-channel ramps (red, green, blue, GREY) over the off-cube steps
// {238,221,187,170,136,119,85,68,34,17}. The grey ramp + cube greys give a full
// 17-step grayscale, which is what the (greyscale) control/widget glyphs use.
const PALETTE256 = (() => {
  const pal = [];
  const cube = [0xff, 0xcc, 0x99, 0x66, 0x33, 0x00];
  for (const r of cube) for (const g of cube) for (const b of cube) pal.push([r, g, b]); // 0..215
  const ramp = [0xee, 0xdd, 0xbb, 0xaa, 0x88, 0x77, 0x55, 0x44, 0x22, 0x11];
  for (const v of ramp) pal.push([v, 0, 0]); // 216..225 red
  for (const v of ramp) pal.push([0, v, 0]); // 226..235 green
  for (const v of ramp) pal.push([0, 0, v]); // 236..245 blue
  for (const v of ramp) pal.push([v, v, v]); // 246..255 grey
  return pal;
})();

// ── minimal RGBA PNG encoder (same approach as extract-scheme.mjs) ──
const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return (buf) => { let c = 0xffffffff; for (let i = 0; i < buf.length; i++) c = t[(c ^ buf[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
})();
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(CRC(body), 0);
  return Buffer.concat([len, body, crc]);
}
function encodePng(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) { raw[y * (stride + 1)] = 0; Buffer.from(rgba.buffer, rgba.byteOffset + y * stride, stride).copy(raw, y * (stride + 1) + 1); }
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

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
  for (const type of ['icl4', 'ics4', 'icl8', 'ics8']) {
    const cfg = TYPES[type];
    const need = cfg.depth === 4 ? (cfg.size * cfg.size) / 2 : cfg.size * cfg.size;
    for (const e of entries) {
      if (e.type !== type) continue;
      const key = `${cfg.size}:${e.id}`;
      if (done.has(key)) continue; // a 4-bit icon already covered this id+size
      if (e.data.length < need) continue;
      const maskData = maskOf(cfg.maskType, e.id);
      const mask = maskData && maskData.length >= cfg.maskOff * 2 ? decodeMaskBits(maskData, cfg.maskOff, cfg.size) : null;
      const rgba = cfg.depth === 4 ? decodeIcon4(e.data, cfg.size, mask) : decodeIcon8(e.data, cfg.size, mask);
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
