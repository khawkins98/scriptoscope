// tools/theme-loader/convert.js
// THE portable Kaleidoscope→Aaron-UI conversion core. Pure: no fs, no zlib, no
// canvas — takes raw resource-fork bytes, returns the theme.json object + decoded
// RGBA assets (each tagged with its canonical bundle path). The same conversion the
// Node CLIs ran inline now lives here ONCE, so both `extract-scheme.mjs`/`extract-icons.mjs`
// (Node: fs + zlib PNG-encode) and `loadKaleidoscopeScheme.js` (browser: Blob +
// OffscreenCanvas) call it. Each shell just does its own bytes-in / image-out.
//
//   convertChrome(fork, {meta, source}) → { theme, assets:[{path,rgba,width,height}], manifest }
//   convertIcons(fork)                  → { assets, index }     (added in step 2b)
//   convertScheme(fork, {meta, source}) → { theme, assets:[...all], iconIndex }  (step 2c)

import { parseResourceFork } from './resource-fork.js';
import { decodeCicn } from './decoders/cicn.js';
import { decodePpat } from './decoders/ppat.js';
import { decodeCinf } from './decoders/cinf.js';
import { decodeWnd } from './decoders/wnd.js';
import { decodeClut, headerColorsFromClut } from './decoders/clut.js';
import { buildThemeJson } from './buildThemeJson.js';
import { validateTheme } from './validateTheme.js';
import { gammaCorrectRgba, gammaCorrectHex, macRgbToSrgb } from './mac-gamma.js';

// ── Icon palettes (pre-gamma'd to sRGB at module load, same display transform) ──
// Apple's canonical 16-colour 4-bit palette. Exact, fixed.
const PALETTE16 = [
  [0xff, 0xff, 0xff], [0xfc, 0xf3, 0x05], [0xff, 0x64, 0x03], [0xdd, 0x09, 0x07],
  [0xf2, 0x08, 0x84], [0x47, 0x00, 0xa5], [0x00, 0x00, 0xd3], [0x02, 0xab, 0xea],
  [0x1f, 0xb7, 0x14], [0x00, 0x64, 0x12], [0x56, 0x2c, 0x05], [0x90, 0x71, 0x3a],
  [0xc0, 0xc0, 0xc0], [0x80, 0x80, 0x80], [0x40, 0x40, 0x40], [0x00, 0x00, 0x00],
].map(macRgbToSrgb);

// Apple's canonical 256-colour SYSTEM palette ('clut' 8), RECONSTRUCTED in-code (so the
// portable core needs no file read — was scripts/lib/mac-system-palette.json): the 6×6×6
// RGB cube (levels {255,204,153,102,51,0}, 0-214, black omitted), then four 10-step ramps
// {238,221,187,170,136,119,85,68,34,17} in order red/green/blue/GREY (215-254), black at
// 255. Relocating black to 255 shifts the GREY ramp to 245-254 (idx245 = light grey — the
// bug a prior hand-built palette got wrong, blue trash can). Byte-identical to the old JSON.
const PALETTE256 = (() => {
  const L = [255, 204, 153, 102, 51, 0], pal = [];
  for (let x = 0; x < 215; x++) pal.push([L[(x / 36) | 0], L[((x / 6) | 0) % 6], L[x % 6]]);
  const R = [238, 221, 187, 170, 136, 119, 85, 68, 34, 17];
  for (const v of R) pal.push([v, 0, 0]);
  for (const v of R) pal.push([0, v, 0]);
  for (const v of R) pal.push([0, 0, v]);
  for (const v of R) pal.push([v, v, v]);
  pal.push([0, 0, 0]);
  return pal.map(macRgbToSrgb);
})();

/** Slugify a resource name for its PNG filename (same rule the old extractor used). */
export function slugify(name) {
  if (!name) return 'unnamed';
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'unnamed';
}
/** Resource id → filename token (negative ids → `n<abs>`). */
export const idStr = (id) => (id < 0 ? `n${-id}` : String(id));

/** Coerce ArrayBuffer/Uint8Array to a Uint8Array. */
function asBytes(fork) {
  return fork instanceof Uint8Array ? fork : new Uint8Array(fork);
}

/**
 * Decode the window CHROME (cicn/ppat/cinf/wnd# + the header/view cluts) into a
 * theme.json object + gamma-corrected RGBA assets. Mirrors exactly what
 * extract-scheme.mjs did inline (gamma → buildThemeJson → headerColors → bodyBackground
 * → validate); just returns assets as RGBA instead of writing PNGs.
 *
 * @param {Uint8Array|ArrayBuffer} fork  raw resource-fork bytes
 * @param {{ meta?: object, source?: string }} [opts]
 * @returns {{ theme: object, assets: {path:string,rgba:Uint8Array,width:number,height:number}[],
 *             manifest: { source:string, counts:object, assets:object[] } }}
 */
export function convertChrome(fork, { meta = {}, source = 'scheme.rsrc' } = {}) {
  const entries = parseResourceFork(asBytes(fork));
  const assets = [];      // { path, rgba, width, height } — gamma-applied
  const flatAssets = [];  // extraction-manifest (flat file names)
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
      gammaCorrectRgba(payload.rgba); // Mac→sRGB display transform (mac-gamma.js)
      assets.push({ path: `${sub}/${fname}`, rgba: payload.rgba, width: payload.width, height: payload.height });
      counts.ok++; counts.raster++;
      flatAssets.push({ ...base, status: 'ok', file: fname, width: payload.width, height: payload.height, debug: payload.debug });
      subAssets.push({ ...base, status: 'ok', file: `${sub}/${fname}`, width: payload.width, height: payload.height, debug: payload.debug });
    } else {
      counts.ok++; counts.geometry++;
      flatAssets.push({ ...base, status: 'ok', data: payload });
      subAssets.push({ ...base, status: 'ok', data: payload });
    }
  }

  const theme = buildThemeJson({ source, counts, assets: subAssets }, { meta });

  // Header colours from the window cluts (-14336 active / -14335 inactive), gamma'd
  // so procedural frames + contrast-sampled title text match the gamma'd rasters.
  const cl = (id) => {
    const r = entries.find((x) => x.type === 'clut' && x.id === id);
    if (!r) return null;
    const c = headerColorsFromClut(decodeClut(r.data));
    for (const k of Object.keys(c)) if (c[k] != null) c[k] = gammaCorrectHex(c[k]);
    return c;
  };
  const active = cl(-14336), inactive = cl(-14335);
  if (active || inactive) {
    theme.headerColors = {};
    if (active) theme.headerColors.active = active;
    if (inactive) theme.headerColors.inactive = inactive;
  }

  // Window body background: the Icon/List-View cinf's bgPatternId ppat (absent → white).
  const viewBg = (() => {
    for (const id of [-9551, -9550]) {
      const r = entries.find((x) => x.type === 'cinf' && x.id === id);
      if (!r) continue;
      try { const d = decodeCinf(r.data); if (d?.bgPatternId) return d.bgPatternId; } catch { /* skip */ }
    }
    return 0;
  })();
  if (viewBg) {
    const abs = Math.abs(viewBg);
    for (const v of Object.values(theme.patterns ?? {})) {
      const m = /ppat-n?-?(\d+)/.exec(v.asset ?? '');
      if (m && parseInt(m[1], 10) === abs) { theme.bodyBackground = { pattern: v.asset }; break; }
    }
  }

  validateTheme(theme); // throws on a malformed bundle; callers report/abort
  return { theme, assets, manifest: { source, counts, assets: flatAssets } };
}

// ── Icon decode (moved verbatim from extract-icons.mjs) ─────────────────────

/** 1-bit mask bitmap (rowBytes per row, MSB first) → Uint8Array(size²) of 0/1. */
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
/** 4-bit icon → RGBA via PALETTE16, alpha from `mask` (null → opaque). */
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
/** 8-bit icon → RGBA via PALETTE256, alpha from `mask` (null → opaque). */
function decodeIcon8(data, size, mask) {
  const rgba = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    const [r, g, b] = PALETTE256[data[i] ?? 0];
    const a = mask ? (mask[i] ? 255 : 0) : 255;
    rgba[i * 4] = r; rgba[i * 4 + 1] = g; rgba[i * 4 + 2] = b; rgba[i * 4 + 3] = a;
  }
  return rgba;
}
/** Key out a uniform corner background (border-flood) for a mask-less icon, so it's
 *  a cut-out shape not an opaque box. No-op if the corners differ. Mutates rgba alpha. */
function cornerFloodTransparency(rgba, size) {
  const at = (x, y) => (y * size + x) * 4;
  const bg = [rgba[0], rgba[1], rgba[2]];
  const corners = [[0, 0], [size - 1, 0], [0, size - 1], [size - 1, size - 1]];
  const isBg = (o) => rgba[o] === bg[0] && rgba[o + 1] === bg[1] && rgba[o + 2] === bg[2];
  for (const [x, y] of corners) if (!isBg(at(x, y))) return 0;
  const seen = new Uint8Array(size * size);
  const stack = [];
  for (const [x, y] of corners) { const p = y * size + x; if (!seen[p]) { seen[p] = 1; stack.push(p); } }
  let cleared = 0;
  while (stack.length) {
    const p = stack.pop(), x = p % size, y = (p / size) | 0, o = p * 4;
    if (!isBg(o)) continue;
    rgba[o + 3] = 0; cleared++;
    for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
      if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
      const np = ny * size + nx; if (!seen[np]) { seen[np] = 1; stack.push(np); }
    }
  }
  return cleared;
}

const ICON_TYPES = {
  icl4: { size: 32, maskType: 'ICN#', maskOff: 128, depth: 4 },
  ics4: { size: 16, maskType: 'ics#', maskOff: 32, depth: 4 },
  icl8: { size: 32, maskType: 'ICN#', maskOff: 128, depth: 8 },
  ics8: { size: 16, maskType: 'ics#', maskOff: 32, depth: 8 },
};

/**
 * Decode a scheme's icon-family glyphs (icl4/ics4/icl8/ics8) → RGBA assets + the
 * icons/index.json array. Mirrors extract-icons.mjs verbatim: every depth emitted
 * (dedup per type+id), gamma'd palettes, mask from ICN#/ics# (else corner-flood).
 *
 * @param {Uint8Array|ArrayBuffer} fork
 * @returns {{ assets: {path,rgba,width,height}[], index: object[], census: object }}
 */
export function convertIcons(fork) {
  const entries = parseResourceFork(asBytes(fork));
  const maskOf = (type, id) => { const r = entries.find((x) => x.type === type && x.id === id); return r ? r.data : null; };
  const assets = [];
  const index = [];
  const done = new Set();
  const census = { ics4: 0, ics8: 0, icl4: 0, icl8: 0 };
  for (const e of entries) if (e.type in census) census[e.type]++;

  for (const type of ['icl8', 'ics8', 'icl4', 'ics4']) {
    const cfg = ICON_TYPES[type];
    const need = cfg.depth === 4 ? (cfg.size * cfg.size) / 2 : cfg.size * cfg.size;
    for (const e of entries) {
      if (e.type !== type) continue;
      const key = `${type}:${e.id}`;
      if (done.has(key)) continue;
      if (e.data.length < need) continue;
      const maskData = maskOf(cfg.maskType, e.id);
      const mask = maskData && maskData.length >= cfg.maskOff * 2 ? decodeMaskBits(maskData, cfg.maskOff, cfg.size) : null;
      const rgba = cfg.depth === 4 ? decodeIcon4(e.data, cfg.size, mask) : decodeIcon8(e.data, cfg.size, mask);
      if (!mask) cornerFloodTransparency(rgba, cfg.size);
      let opaque = 0;
      for (let i = 0; i < cfg.size * cfg.size; i++) if (rgba[i * 4 + 3] > 127) opaque++;
      const coverage = +(opaque / (cfg.size * cfg.size)).toFixed(3);
      const fname = `${type}-${idStr(e.id)}.png`;
      assets.push({ path: `icons/${fname}`, rgba, width: cfg.size, height: cfg.size });
      index.push({ id: e.id, type, size: cfg.size, depth: cfg.depth, file: fname, name: e.name || null, masked: !!mask, coverage });
      done.add(key);
    }
  }
  index.sort((a, b) => (b.size - a.size) || (a.id - b.id));
  return { assets, index, census };
}

/**
 * Whole-scheme conversion in one call — chrome + icons — for the browser drop path.
 * (The Node CLIs call convertChrome / convertIcons separately to keep their no-cross-churn
 * file-write workflow.) Returns the theme.json object, ALL decoded RGBA assets (chrome +
 * icons) tagged with their bundle paths, and the icon index. The caller (a thin I/O shell)
 * turns the RGBA into PNGs (Node) or blob-URLs (browser) and resolves the theme's asset
 * refs + glyph map against them.
 *
 * @param {Uint8Array|ArrayBuffer} fork
 * @param {{ meta?: object, source?: string }} [opts]
 * @returns {{ theme: object, assets: {path,rgba,width,height}[], iconIndex: object[],
 *             manifest: object }}
 */
export function convertScheme(fork, { meta = {}, source = 'scheme.rsrc' } = {}) {
  const bytes = asBytes(fork); // parse once conceptually; chrome+icons each re-parse (cheap, KB)
  const chrome = convertChrome(bytes, { meta, source });
  const icons = convertIcons(bytes);
  return {
    theme: chrome.theme,
    assets: [...chrome.assets, ...icons.assets],
    iconIndex: icons.index,
    manifest: chrome.manifest,
  };
}
