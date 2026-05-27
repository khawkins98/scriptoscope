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
import { gammaCorrectRgba, gammaCorrectHex } from './mac-gamma.js';

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
