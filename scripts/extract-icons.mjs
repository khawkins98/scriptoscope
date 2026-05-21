#!/usr/bin/env node
// Extract a scheme's icon-family resources (the scheme's own custom Finder
// icons) into themes/<slug>/icons/*.png + icons/index.json. Kept SEPARATE
// from extract-scheme.mjs so re-running it never rewrites the cicns/ppats
// PNGs (which would churn the bundle).
//
// Decodes the 4-bit color icons (icl4 32x32, ics4 16x16) against the fixed
// Apple 16-colour palette, with alpha from the matching 1-bit mask resource
// (ICN# / ics#, same id — the second bitmap half is the mask). 4-bit is the
// sweet spot: real colour, but an EXACT known palette (8-bit would need the
// system clut, which schemes don't embed).
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

  for (const e of entries) {
    let size, maskType, maskByteOff;
    if (e.type === 'icl4') { size = 32; maskType = 'ICN#'; maskByteOff = 128; }
    else if (e.type === 'ics4') { size = 16; maskType = 'ics#'; maskByteOff = 32; }
    else continue;
    // 4-bit data must be at least size*size/2 bytes
    if (e.data.length < (size * size) / 2) continue;
    const maskData = maskOf(maskType, e.id);
    const mask = maskData && maskData.length >= maskByteOff * 2 ? decodeMaskBits(maskData, maskByteOff, size) : null;
    const rgba = decodeIcon4(e.data, size, mask);
    // opaque coverage: full-bleed art (≈1.0) is usually a scheme logo/splash;
    // document/folder icons leave transparent margins. Lets the scene prefer
    // real "object" icons over the scheme's hero glyph.
    let opaque = 0;
    for (let i = 0; i < size * size; i++) if (rgba[i * 4 + 3] > 127) opaque++;
    const coverage = +(opaque / (size * size)).toFixed(3);
    const fname = `${e.type}-${idStr(e.id)}.png`;
    writeFileSync(resolve(destDir, 'icons', fname), encodePng(size, size, rgba));
    index.push({ id: e.id, type: e.type, size, file: fname, name: e.name || null, masked: !!mask, coverage });
  }

  index.sort((a, b) => (b.size - a.size) || (a.id - b.id));
  writeFileSync(resolve(destDir, 'icons', 'index.json'), JSON.stringify(index, null, 2));
  console.log(`[${slug}] ${index.length} icons → icons/  (icl4=${index.filter((i) => i.type === 'icl4').length}, ics4=${index.filter((i) => i.type === 'ics4').length})`);
}

const argv = process.argv.slice(2);
if (argv.length === 0) { console.error('Usage: node scripts/extract-icons.mjs <slug>... | --all'); process.exit(2); }
const themesRoot = resolve(repoRoot, 'themes');
const slugs = argv.includes('--all')
  ? readdirSync(themesRoot).filter((s) => existsSync(resolve(themesRoot, s, 'scheme.rsrc')))
  : argv;
for (const s of slugs) extract(s);
