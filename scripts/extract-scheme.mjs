#!/usr/bin/env node
// Extract a Kaleidoscope scheme bundle straight from its binary resource
// fork (no macOS DeRez step). Mirrors tools/scheme-extractor/bin/extract.js
// but: (a) reads the raw resource fork via parseResourceFork, (b) imports
// the live decoders from tools/theme-loader, (c) writes PNGs into cicns/ +
// ppats/ subdirs and decodes the header cluts — producing the same bundle
// layout as the existing themes/<slug>/ dirs.
//
// Usage: node scripts/extract-scheme.mjs <slug>
//   reads  themes/<slug>/scheme.rsrc  (+ optional meta.json)
//   writes themes/<slug>/{cicns,ppats}/*.png, extraction-manifest.json, theme.json

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';
import { parseResourceFork } from '../tools/theme-loader/resource-fork.js';
import { decodeCicn } from '../tools/theme-loader/decoders/cicn.js';
import { decodePpat } from '../tools/theme-loader/decoders/ppat.js';
import { decodeCinf } from '../tools/theme-loader/decoders/cinf.js';
import { decodeWnd } from '../tools/theme-loader/decoders/wnd.js';
import { buildThemeJson } from '../tools/theme-loader/buildThemeJson.js';
import { validateTheme } from '../tools/theme-loader/validateTheme.js';
import { decodeClut, headerColorsFromClut } from '../tools/theme-loader/decoders/clut.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');

const argv = process.argv.slice(2);
if (argv.length === 0) {
  console.error('Usage: node scripts/extract-scheme.mjs <slug> [<slug>...] | --all');
  process.exit(2);
}
const themesRoot = resolve(repoRoot, 'themes');
const slugs = argv.includes('--all')
  ? readdirSync(themesRoot).filter((s) => existsSync(resolve(themesRoot, s, 'scheme.rsrc')))
  : argv;
for (const s of slugs) extract(s);

function extract(slug) {
const destDir = resolve(repoRoot, 'themes', slug);
const rsrcPath = resolve(destDir, 'scheme.rsrc');
if (!existsSync(rsrcPath)) {
  console.error(`Not found: ${rsrcPath}`);
  process.exit(1);
}

// ── minimal PNG (RGBA) encoder over node:zlib — avoids a pngjs dependency ──
const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return (buf) => {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) c = t[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
})();
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, 'latin1');
  const body = Buffer.concat([t, data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(CRC(body), 0);
  return Buffer.concat([len, body, crc]);
}
function encodePng(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  // filter byte 0 per scanline
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + y * stride, stride).copy(raw, y * (stride + 1) + 1);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

function slugify(name) {
  if (!name) return 'unnamed';
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'unnamed';
}
const idStr = (id) => (id < 0 ? `n${-id}` : String(id));

// ── decode the resource fork ──
const entries = parseResourceFork(new Uint8Array(readFileSync(rsrcPath)));
console.log(`Parsed ${entries.length} resources from ${slug}/scheme.rsrc`);

mkdirSync(resolve(destDir, 'cicns'), { recursive: true });
mkdirSync(resolve(destDir, 'ppats'), { recursive: true });

const flatAssets = []; // for extraction-manifest.json (flat file paths)
const subAssets = [];   // for buildThemeJson (cicns/ + ppats/ paths)
const counts = { total: 0, ok: 0, skipped: 0, errored: 0, raster: 0, geometry: 0 };

for (const e of entries) {
  if (!['cicn', 'ppat', 'cinf', 'wnd#'].includes(e.type)) continue;
  counts.total++;
  const base = { type: e.type, id: e.id, name: e.name || null };
  let payload = null, error = null;
  try {
    if (e.type === 'cicn') payload = decodeCicn(e.data);
    else if (e.type === 'ppat') payload = decodePpat(e.data);
    else if (e.type === 'cinf') payload = decodeCinf(e.data);
    else if (e.type === 'wnd#') payload = decodeWnd(e.data);
  } catch (err) { error = err instanceof Error ? err.message : String(err); }

  if (error) {
    counts.errored++;
    flatAssets.push({ ...base, status: 'error', error });
    subAssets.push({ ...base, status: 'error', error });
    continue;
  }
  if (!payload) {
    counts.skipped++;
    flatAssets.push({ ...base, status: 'skipped', reason: 'unsupported variant' });
    subAssets.push({ ...base, status: 'skipped', reason: 'unsupported variant' });
    continue;
  }
  if (e.type === 'cicn' || e.type === 'ppat') {
    const fname = `${e.type}-${idStr(e.id)}-${slugify(e.name)}.png`;
    const sub = e.type === 'cicn' ? 'cicns' : 'ppats';
    writeFileSync(resolve(destDir, sub, fname), encodePng(payload.width, payload.height, payload.rgba));
    counts.ok++; counts.raster++;
    flatAssets.push({ ...base, status: 'ok', file: fname, width: payload.width, height: payload.height, debug: payload.debug });
    subAssets.push({ ...base, status: 'ok', file: `${sub}/${fname}`, width: payload.width, height: payload.height, debug: payload.debug });
  } else {
    counts.ok++; counts.geometry++;
    flatAssets.push({ ...base, status: 'ok', data: payload });
    subAssets.push({ ...base, status: 'ok', data: payload });
  }
}

const extractedAt = new Date().toISOString();
writeFileSync(
  resolve(destDir, 'extraction-manifest.json'),
  JSON.stringify({ source: `${slug}/scheme.rsrc`, extractedAt, counts, assets: flatAssets }, null, 2),
);

// ── build theme.json ──
const metaPath = resolve(destDir, 'meta.json');
const meta = existsSync(metaPath) ? JSON.parse(readFileSync(metaPath, 'utf8')) : {};
const theme = buildThemeJson({ source: `${slug}/scheme.rsrc`, extractedAt, counts, assets: subAssets }, { meta });

// header colors from the window cluts (-14335 active / -14336 inactive)
const cl = (id) => {
  const r = entries.find((x) => x.type === 'clut' && x.id === id);
  return r ? headerColorsFromClut(decodeClut(r.data)) : null;
};
const active = cl(-14335), inactive = cl(-14336);
if (active || inactive) {
  theme.headerColors = {};
  if (active) theme.headerColors.active = active;
  if (inactive) theme.headerColors.inactive = inactive;
}

try { validateTheme(theme); } catch (err) {
  console.error(`[${slug}] schema validation FAILED:`, err.message);
  process.exit(1);
}
writeFileSync(resolve(destDir, 'theme.json'), JSON.stringify(theme, null, 2));

console.log(
  `[${slug}] ok=${counts.ok} (raster=${counts.raster}, geometry=${counts.geometry}) ` +
  `skipped=${counts.skipped} errored=${counts.errored} → ${Object.keys(theme.chromeElements || {}).length} chrome elements, ` +
  `${Object.keys(theme.windowTypes || {}).length} window types, headerColors=${!!theme.headerColors}`,
);
}
