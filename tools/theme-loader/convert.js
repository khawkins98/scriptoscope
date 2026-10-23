import { finiteCicnTransfer, CicnTransferError } from './cicn-transfer-results.js';
// tools/theme-loader/convert.js
// THE portable Kaleidoscope→Scriptoscope conversion core. Pure: no fs, no zlib, no
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
import { realizeRgb16 as mapEngineRgb16 } from './display-profile.js';
import { decodeWnd } from './decoders/wnd.js';
import { decodeClut, headerColorsFromClut } from './decoders/clut.js';
import { decodeColr } from './decoders/colr.js';
import { buildThemeJson } from './buildThemeJson.js';
import { validateTheme } from './validateTheme.js';
import { gammaCorrectRgba, gammaCorrectHex, macRgbToSrgb } from './mac-gamma.js';
import { displayRealizer, directRgb8Realizer, displayPolicy, DisplayProfileError } from './display-profile.js';

// ── Icon palettes (pre-gamma'd to sRGB at module load, same display transform) ──
// Apple's canonical 16-colour 4-bit palette. Exact, fixed.
const RAW_PALETTE16 = [
  [0xff, 0xff, 0xff], [0xfc, 0xf3, 0x05], [0xff, 0x64, 0x03], [0xdd, 0x09, 0x07],
  [0xf2, 0x08, 0x84], [0x47, 0x00, 0xa5], [0x00, 0x00, 0xd3], [0x02, 0xab, 0xea],
  [0x1f, 0xb7, 0x14], [0x00, 0x64, 0x12], [0x56, 0x2c, 0x05], [0x90, 0x71, 0x3a],
  [0xc0, 0xc0, 0xc0], [0x80, 0x80, 0x80], [0x40, 0x40, 0x40], [0x00, 0x00, 0x00],
];
const PALETTE16 = RAW_PALETTE16.map(macRgbToSrgb);

// Apple's canonical 256-colour SYSTEM palette ('clut' 8), RECONSTRUCTED in-code (so the
// portable core needs no file read — was scripts/lib/mac-system-palette.json): the 6×6×6
// RGB cube (levels {255,204,153,102,51,0}, 0-214, black omitted), then four 10-step ramps
// {238,221,187,170,136,119,85,68,34,17} in order red/green/blue/GREY (215-254), black at
// 255. Relocating black to 255 shifts the GREY ramp to 245-254 (idx245 = light grey — the
// bug a prior hand-built palette got wrong, blue trash can). Byte-identical to the old JSON.
const RAW_PALETTE256 = (() => {
  const L = [255, 204, 153, 102, 51, 0], pal = [];
  for (let x = 0; x < 215; x++) pal.push([L[(x / 36) | 0], L[((x / 6) | 0) % 6], L[x % 6]]);
  const R = [238, 221, 187, 170, 136, 119, 85, 68, 34, 17];
  for (const v of R) pal.push([v, 0, 0]);
  for (const v of R) pal.push([0, v, 0]);
  for (const v of R) pal.push([0, 0, v]);
  for (const v of R) pal.push([v, v, v]);
  pal.push([0, 0, 0]);
  return pal;
})();
const PALETTE256 = RAW_PALETTE256.map(macRgbToSrgb);

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
export function convertChrome(fork, { meta = {}, source = 'scheme.rsrc', resourceObserver, displayProfile, cinfBinding, sliderLayoutBinding, cicnTransferBinding, iconBlitCicnIds, engineCinfIds } = {}) {
  const realizeRgb16 = displayRealizer(displayProfile);
  const realizeDirectRgb8 = directRgb8Realizer(displayProfile);
  const policy = displayPolicy(displayProfile);
  const entries = parseResourceFork(asBytes(fork));
  const assets = [];      // { path, rgba, width, height } — gamma-applied
  const flatAssets = [];  // extraction-manifest (flat file names)
  const subAssets = [];   // for buildThemeJson (cicns/ + ppats/ paths)
  const counts = { total: 0, ok: 0, skipped: 0, errored: 0, raster: 0, geometry: 0, color: 0 };
  const headerCluts = new Map();

  for (const [resourceIndex, e] of entries.entries()) {
    counts.total++;
    const base = { type: e.type, id: e.id, name: e.name || null };
    // The diagnostic manifest inventories the entire fork, not just resources
    // handled by this pass. Icon extraction is a separate convertIcons call.
    if (e.type === 'clut' && (e.id === -14336 || e.id === -14335)) {
      // These palettes already supply headerColors below. Record that work as
      // successful color extraction rather than silently omitting it (or
      // claiming it was skipped). Preserve header-decoder failure behavior.
      const decoded = decodeClut(e.data, { realizeRgb16 });
      headerCluts.set(e.id, decoded);
      counts.ok++; counts.color++;
      flatAssets.push({ ...base, status: 'ok', data: decoded });
      continue;
    }
    if (!['cicn', 'ppat', 'cinf', 'wnd#', 'Colr'].includes(e.type)) {
      counts.skipped++;
      flatAssets.push({ ...base, status: 'skipped', reason: 'not extracted by convertChrome' });
      continue;
    }
    const byteReference = resourceObserver?.begin(e, resourceIndex);
    if (byteReference) base.byteReference = byteReference;
    let payload = null, error = null;
    try {
      if (e.type === 'cicn') payload = decodeCicn(e.data, { retainKdefColorSampler: true, realizeRgb16, displayPolicy: policy, finiteTransfer: finiteCicnTransfer(cicnTransferBinding, resourceIndex, e.data) });
      else if (e.type === 'ppat') payload = decodePpat(e.data, { realizeRgb16, realizeDirectRgb8 });
      else if (e.type === 'cinf') payload = decodeCinf(e.data);
      else if (e.type === 'wnd#') payload = decodeWnd(e.data);
      // Colr: scheme-global flags (stretchScrollbarThumbFromCenter,
      // minimumKVersion, hasAccentColors, …). Downstream `buildThemeJson` reads
      // `manifest.assets.find(a => a.type === 'Colr' && a.status === 'ok')` and
      // wires the result into `theme.options` + `theme.origin`, so just decoding
      // here is enough to unlock the schema slots that were already reserved.
      else if (e.type === 'Colr') payload = decodeColr(e.data);
    } catch (err) { if (err instanceof DisplayProfileError || err instanceof CicnTransferError) throw err; error = err instanceof Error ? err.message : String(err); }

    resourceObserver?.end(byteReference, error ? 'error' : payload ? 'decoded' : 'skipped');
    if (error) {
      if (displayProfile && ['cicn', 'ppat'].includes(e.type)) throw new DisplayProfileError(`Cannot prepare ${e.type} ${e.id}: ${error}`, 'UNSUPPORTED_SOURCE_COLOR');
      counts.errored++;
      flatAssets.push({ ...base, status: 'error', error });
      subAssets.push({ ...base, status: 'error', error });
      continue;
    }
    if (!payload) {
      if (displayProfile && ['cicn', 'ppat'].includes(e.type)) throw new DisplayProfileError(`Unsupported ${e.type} ${e.id} under display profile`, 'UNSUPPORTED_SOURCE_COLOR');
      counts.skipped++;
      flatAssets.push({ ...base, status: 'skipped', reason: 'unsupported variant' });
      subAssets.push({ ...base, status: 'skipped', reason: 'unsupported variant' });
      continue;
    }
    if (e.type === 'cicn' || e.type === 'ppat') {
      const fname = `${e.type}-${idStr(e.id)}-${slugify(e.name)}.png`;
      const sub = e.type === 'cicn' ? 'cicns' : 'ppats';
      resourceObserver?.bindAsset(byteReference, `${sub}/${fname}`);
      if (!realizeRgb16) gammaCorrectRgba(payload.rgba); // Mac→sRGB display transform (mac-gamma.js)
      assets.push({ path: `${sub}/${fname}`, rgba: payload.rgba, width: payload.width, height: payload.height });
      let sampledBandAsset;
      if (payload.sampledBandRgba) {
        const derivedPath = `cicn-sampled/${fname}`;
        if (!realizeRgb16) gammaCorrectRgba(payload.sampledBandRgba);
        assets.push({ path: derivedPath, rgba: payload.sampledBandRgba, width: payload.width, height: payload.height });
        sampledBandAsset = { model: 'kaleidoscope-2.3.1-opaque-sampling-v1',
          comparison: 'opaque-current-display-rgb', displayPolicy: policy,
          width: payload.width, height: payload.height, asset: derivedPath, derivedPath };
      }
      counts.ok++; counts.raster++;
      flatAssets.push({ ...base, status: 'ok', file: fname, width: payload.width, height: payload.height, debug: payload.debug });
      subAssets.push({ ...base, status: 'ok', file: `${sub}/${fname}`, width: payload.width, height: payload.height, debug: payload.debug,
        ...(sampledBandAsset ? { sampledBandAsset } : {}),
        ...(payload.bodyCicnSource ? { bodyCicnSource: payload.bodyCicnSource } : {}),
        ...(payload.cicnTransfer ? { cicnTransfer: payload.cicnTransfer } : {}),
        ...(payload.samplingEquivalence ? { samplingEquivalence: payload.samplingEquivalence } : {}),
        ...(payload.sampleKdefRgb16 ? { sampleKdefRgb16: payload.sampleKdefRgb16 } : {}) });
    } else {
      counts.ok++; counts.geometry++;
      flatAssets.push({ ...base, status: 'ok', data: payload });
      subAssets.push({ ...base, status: 'ok', data: payload });
    }
  }

  for (const a of subAssets) if (a.cicnTransfer && subAssets.filter(other => other.file === a.file).length !== 1)
    throw new CicnTransferError('Ambiguous finite transfer asset path');
  const theme = buildThemeJson({ source, counts, assets: subAssets }, { meta, displayProfile, cinfBinding, sliderLayoutBinding, cicnTransferBinding });
  // Only actual surviving, unambiguous element links may allocate derived URLs.
  const usedCompanions = new Set(Object.values(theme.chromeElements ?? {}).flatMap(e => e.sampledBandAsset ? [e.sampledBandAsset.derivedPath] : []));
  for (let i = assets.length - 1; i >= 0; i--)
    if (assets[i].path.startsWith('cicn-sampled/') && !usedCompanions.has(assets[i].path)) assets.splice(i, 1);
  for (const a of subAssets) if (a.sampledBandAsset && usedCompanions.has(a.sampledBandAsset.derivedPath))
    resourceObserver?.bindAsset(a.byteReference, a.sampledBandAsset.derivedPath);

  // Materialize only builder-selected occurrences. Ordinary RGBA still retains
  // hidden RGB and is already display-transformed: alpha promotion needs NO LUT.
  const originalByPath = new Map(assets.map(asset => [asset.path, asset]));
  const recordByPath = new Map(subAssets.filter(a => a.type === 'cicn' && a.status === 'ok').map(a => [a.file, a]));
  const bodyPaths = new Set();
  for (const face of Object.values(theme.chromeElements ?? {})) {
    const binding = face.cicnBody;
    if (binding?.status !== 'ready' || binding.copy !== 'unmasked' || bodyPaths.has(binding.derivedPath)) continue;
    const selected = theme.chromeElements[binding.manifestKey];
    const original = originalByPath.get(selected.asset), record = recordByPath.get(selected.asset);
    const rgba = original.rgba.slice();
    for (let i = 3; i < rgba.length; i += 4) rgba[i] = 255;
    assets.push({ path: binding.derivedPath, rgba, width: original.width, height: original.height });
    resourceObserver?.bindAsset(record.byteReference, binding.derivedPath);
    bodyPaths.add(binding.derivedPath);
  }

  // Icon-blit inputs (docs/spec/engine/qd-primitives.md I1–I3), only for the cicn
  // ids a caller names: the pixel map's depth, and for a map deeper than 1 bit an
  // opaque companion (every stored pixel, mask ignored) for the I3 CopyBits copy.
  // Ordinary RGBA retains the stored RGB under a clear mask (see above), so alpha
  // promotion is enough. Off by default: lint and local bakes are unchanged.
  if (iconBlitCicnIds?.length) {
    const wanted = new Set(iconBlitCicnIds), done = new Set();
    // Engine mode-5 bodies use the same opaque icon-blit contract.
    for (const e of entries) if (e.type === 'cinf' && engineCinfIds?.includes(e.id) && e.data.length >= 18) {
      const cinf = decodeCinf(e.data);
      if (cinf.patternAnchor === 5) wanted.add(cinf.bgPatternId);
    }
    for (const element of Object.values(theme.chromeElements ?? {})) {
      if (!wanted.has(element.sourceCicnId)) continue;
      const record = recordByPath.get(element.asset), original = originalByPath.get(element.asset);
      const pixelSize = record?.debug?.pixelSize;
      if (!record || !original || !Number.isInteger(pixelSize)) continue;
      const iconBlit = { pixelSize };
      if (pixelSize > 1) {
        const derivedPath = `cicn-unmasked/${record.file.slice(record.file.lastIndexOf('/') + 1)}`;
        if (!done.has(derivedPath)) {
          const rgba = original.rgba.slice();
          for (let i = 3; i < rgba.length; i += 4) rgba[i] = 255;
          assets.push({ path: derivedPath, rgba, width: original.width, height: original.height });
          resourceObserver?.bindAsset(record.byteReference, derivedPath);
          done.add(derivedPath);
        }
        iconBlit.unmaskedAsset = derivedPath;
      }
      element.iconBlit = iconBlit;
    }
  }

  // Engine cinf inputs (docs/spec/engine/slider.md G1, ID6, TR6, CF1–CF3): the raw bytes of
  // the first cinf at each id a caller names, so an engine ResourceChain can answer
  // a cinf request whether or not a same-id cicn exists (the slider gate tests
  // cinf only). Off by default: lint and local bakes are unchanged.
  if (engineCinfIds?.length) {
    const wanted = new Set(engineCinfIds), engineCinfs = {};
    for (const e of entries) {
      if (e.type === 'cinf' && wanted.has(e.id) && !(String(e.id) in engineCinfs)) engineCinfs[String(e.id)] = Array.from(e.data);
    }
    theme.engineCinfs = engineCinfs;
    // A finite point set, never a general sampler. A later base/provider cinf
    // can name another point; its colour then remains explicitly unavailable.
    const points = new Map();
    for (const bytes of Object.values(engineCinfs)) if (bytes.length >= 18) {
      const cinf = decodeCinf(Uint8Array.from(bytes));
      for (const p of [cinf.bgPixel, cinf.textPixel, cinf.embossPixel]) points.set(`${p.x},${p.y}`, p);
    }
    for (const element of Object.values(theme.chromeElements ?? {})) {
      if (!wanted.has(element.sourceCicnId)) continue;
      const records = subAssets.filter(a => a.type === 'cicn' && a.file === element.asset);
      const record = records.length === 1 ? records[0] : null;
      if (!record?.sampleKdefRgb16) continue;
      const samples = {};
      for (const [key, point] of points) {
        const rgb16 = record.sampleKdefRgb16(point.x, point.y);
        samples[key] = rgb16 ? { rgb16, displayRgb: mapEngineRgb16(rgb16, displayProfile) } : null;
      }
      element.engineColorSamples = { model: 'kdef-2.3.1-engine-points', asset: element.asset,
        width: element.width, height: element.height, displayPolicy: policy, points: samples };
    }
    // The same ids' cicn bounds origins (slider BL11): engine pixmaps drop the
    // origin, so the engine traces any cicn whose origin is not (0, 0).
    // The pixel map's bounds rect follows its 4-byte base address and 2-byte
    // rowBytes (Inside Macintosh: Imaging With QuickDraw, PixMap), top then left.
    const origins = new Map();
    for (const e of entries) {
      if (e.type !== 'cicn' || !wanted.has(e.id) || origins.has(e.id) || e.data.length < 10) continue;
      const view = new DataView(e.data.buffer, e.data.byteOffset, e.data.byteLength);
      origins.set(e.id, { top: view.getInt16(6), left: view.getInt16(8) });
    }
    for (const element of Object.values(theme.chromeElements ?? {})) {
      const origin = origins.get(element.sourceCicnId);
      if (origin) element.boundsOrigin = origin;
    }
  }

  // Header colours from the window cluts (-14336 active / -14335 inactive), gamma'd
  // so procedural frames + contrast-sampled title text match the gamma'd rasters.
  const cl = (id) => {
    const decoded = headerCluts.get(id);
    if (!decoded) return null;
    const c = headerColorsFromClut(decoded);
    for (const k of Object.keys(c)) if (c[k] != null && !realizeRgb16) c[k] = gammaCorrectHex(c[k]);
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
    // Compare SIGNED ids — matches how buildThemeJson wires patterns via the
    // `ppatSlugById` map. A +N and a -N ppat are distinct resources; collapsing
    // via Math.abs() risks a false match if a scheme ships both (no corpus
    // collision today, but the convention is the same everywhere else).
    for (const v of Object.values(theme.patterns ?? {})) {
      const m = /ppat-(n?)(\d+)/.exec(v.asset ?? '');
      if (!m) continue;
      const sign = m[1] === 'n' ? -1 : 1;
      const id = sign * parseInt(m[2], 10);
      if (id === viewBg) { theme.bodyBackground = { pattern: v.asset }; break; }
    }
  }

  validateTheme(theme); // throws on a malformed bundle; callers report/abort
  const cicnResources = entries.flatMap((e, resourceIndex) => e.type === 'cicn'
    ? [{ id: e.id, resourceIndex, byteLength: e.data.length }] : []);
  return { theme, assets, cicnResources, colorTables: colorTablesOf(entries, realizeRgb16), manifest: { source, counts, assets: flatAssets } };
}

/**
 * Colour-table resources (`actb`, `clut`; Inside Macintosh: Imaging With
 * QuickDraw, "Color Manager" ColorTable layout) as plain entries in index
 * order, for engine families that read a table entry (procedural-frame §3.5
 * alert colouring, §5A gap colour). Keyed `type:id`, first occurrence wins.
 * Each entry keeps the stored 16-bit channels (for equality tests) and the
 * display colour under the same policy as the rasters (the measured profile
 * when supplied, else the Mac → sRGB high-byte gamma). Additive inspector
 * data: theme.json and the lint fingerprints are unchanged.
 */
function colorTablesOf(entries, realizeRgb16) {
  const out = {};
  for (const e of entries) {
    if ((e.type !== 'actb' && e.type !== 'clut') || `${e.type}:${e.id}` in out) continue;
    try {
      const d = e.data, view = new DataView(d.buffer, d.byteOffset, d.byteLength);
      const last = view.getInt16(6, false);
      const list = [];
      for (let i = 0; i <= last && 8 + i * 8 + 8 <= d.byteLength; i++) {
        const o = 8 + i * 8;
        const rgb16 = [view.getUint16(o + 2, false), view.getUint16(o + 4, false), view.getUint16(o + 6, false)];
        const rgb = realizeRgb16 ? realizeRgb16(rgb16) : macRgbToSrgb(rgb16.map(v => v >> 8));
        list.push({ value: view.getInt16(o, false), rgb16, rgb: Array.from(rgb) });
      }
      out[`${e.type}:${e.id}`] = { entries: list };
    } catch { /* malformed table: absent */ }
  }
  return out;
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
 * @param {{ ids?: number[] }} [options] Restrict decoding to these resource ids.
 * @returns {{ assets: {path,rgba,width,height}[], index: object[], census: object }}
 */
export function convertIcons(fork, { ids, displayProfile, unmaskedIconIds = [] } = {}) {
  const realizeRgb16 = displayRealizer(displayProfile);
  const entries = parseResourceFork(asBytes(fork));
  const requested = ids ? new Set(ids) : null;
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
      if (requested && !requested.has(e.id)) continue;
      const key = `${type}:${e.id}`;
      if (done.has(key)) continue;
      if (e.data.length < need) continue;
      const maskData = maskOf(cfg.maskType, e.id);
      const mask = maskData && maskData.length >= cfg.maskOff * 2 ? decodeMaskBits(maskData, cfg.maskOff, cfg.size) : null;
      const rgba = cfg.depth === 4 ? decodeIcon4(e.data, cfg.size, mask) : decodeIcon8(e.data, cfg.size, mask);
      if (!mask) cornerFloodTransparency(rgba, cfg.size);
      // Keep legacy palette/flood decisions unchanged; realize only RGB afterward.
      if (realizeRgb16) {
        const memo = new Map(), palette = cfg.depth === 4 ? RAW_PALETTE16 : RAW_PALETTE256;
        for (let i=0; i<cfg.size*cfg.size; i++) {
          const index = cfg.depth === 4 ? (i&1 ? e.data[i>>1]&15 : e.data[i>>1]>>4) : e.data[i];
          if (!memo.has(index)) memo.set(index, realizeRgb16(palette[index].map(v => v*257)));
          rgba.set(memo.get(index), i*4);
        }
      }
      let opaque = 0;
      for (let i = 0; i < cfg.size * cfg.size; i++) if (rgba[i * 4 + 3] > 127) opaque++;
      const coverage = +(opaque / (cfg.size * cfg.size)).toFixed(3);
      const fname = `${type}-${idStr(e.id)}.png`;
      // Preserve this actual decoded occurrence's RGB before Canvas drops
      // mask-clear colours. Display realization above has already run once.
      let unmaskedFile;
      if (type === 'ics8' && unmaskedIconIds.includes(e.id)) {
        unmaskedFile = `opaque-${fname}`;
        const opaqueRgba = rgba.slice();
        for (let i = 3; i < opaqueRgba.length; i += 4) opaqueRgba[i] = 255;
        assets.push({ path: `icons/${unmaskedFile}`, rgba: opaqueRgba, width: cfg.size, height: cfg.size });
      }
      assets.push({ path: `icons/${fname}`, rgba, width: cfg.size, height: cfg.size });
      index.push({ id: e.id, type, size: cfg.size, depth: cfg.depth, file: fname, name: e.name || null, masked: !!mask, coverage, ...(unmaskedFile ? { unmaskedFile } : {}), resourceIndex: entries.indexOf(e) });
      done.add(key);
    }
  }
  index.sort((a, b) => (b.size - a.size) || (a.id - b.id));
  // Complete same-fork input census, including masks without supported color art.
  const iconMaskResources = entries.flatMap((e, resourceIndex) => e.type === 'ics#'
    ? [{ id: e.id, resourceIndex, byteLength: e.data.length }] : []);
  // The 16 × 16 ics# planes (32-byte image, then 32-byte mask; Inside Macintosh
  // "Icon Families"), first occurrence per id, for callers that draw the 1-bit
  // image itself (scroll-bar AI5). Raw bits: no gamma, no colour.
  const iconMaskPlanes = {};
  for (const e of entries) {
    if (e.type !== 'ics#' || e.data.length < 64 || String(e.id) in iconMaskPlanes) continue;
    iconMaskPlanes[String(e.id)] = Array.from(e.data.subarray(0, 64));
  }
  const iconColorResources = entries.flatMap((e, resourceIndex) => e.type in ICON_TYPES
    ? [{ type: e.type, id: e.id, resourceIndex, byteLength: e.data.length }] : []);
  return { assets, index, census, iconMaskResources, iconMaskPlanes, iconColorResources };
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
export function convertScheme(fork, { meta = {}, source = 'scheme.rsrc', resourceObserver, displayProfile, cinfBinding, sliderLayoutBinding, cicnTransferBinding, iconBlitCicnIds, engineCinfIds, unmaskedIconIds } = {}) {
  const bytes = asBytes(fork); // parse once conceptually; chrome+icons each re-parse (cheap, KB)
  const chrome = convertChrome(bytes, { meta, source, resourceObserver, displayProfile, cinfBinding, sliderLayoutBinding, cicnTransferBinding, iconBlitCicnIds, engineCinfIds });
  const icons = convertIcons(bytes, { displayProfile, unmaskedIconIds });
  return {
    theme: chrome.theme,
    assets: [...chrome.assets, ...icons.assets],
    iconIndex: icons.index,
    iconMaskResources: icons.iconMaskResources,
    iconMaskPlanes: icons.iconMaskPlanes,
    iconColorResources: icons.iconColorResources,
    cicnResources: chrome.cicnResources,
    colorTables: chrome.colorTables,
    manifest: chrome.manifest,
  };
}
