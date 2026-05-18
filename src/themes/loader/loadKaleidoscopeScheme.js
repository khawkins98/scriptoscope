// Runtime Kaleidoscope scheme loader — decode a .ksc / .rsrc resource
// fork on the fly into an in-memory Theme.
//
// Replaces the build-time pipeline (DeRez → .r → extractor → theme.json
// bundle) with a single runtime call. Same outputs (a Theme matching
// docs/kaleidoscope-geometry-spec.md §7), but no conversion step, no
// per-scheme manual patches needed, no macOS-only toolchain.
//
// Browser-portable: uses fetch + OffscreenCanvas (with a no-canvas
// option for Node tests).

import { parseResourceFork } from './resource-fork.js';
import { decodeCicn } from './decoders/cicn.js';
import { decodePpat } from './decoders/ppat.js';
import { decodeCinf } from './decoders/cinf.js';
import { decodeWnd }  from './decoders/wnd.js';
import { buildThemeJson } from './buildThemeJson.js';
import { validateTheme } from './validateTheme.js';

/**
 * @typedef {object} LoadOptions
 * @property {object} [meta]
 *   Optional metadata (name, author, origin) merged into the theme.
 *   The binary scheme doesn't carry these — supply them here.
 * @property {boolean} [encodeAssets]
 *   When true (default in browser, false elsewhere), encode cicn/ppat
 *   RGBA buffers into PNG blob URLs and put those in `asset` fields.
 *   When false, `asset` is a placeholder path — useful for tests + for
 *   cases where the caller wants to do its own encoding.
 * @property {(rgba: Uint8Array, w: number, h: number, key: string) => Promise<string>} [assetUrlFactory]
 *   Custom asset URL factory. Receives RGBA bytes + dimensions + a
 *   stable cache key. Default uses OffscreenCanvas in browser.
 * @property {boolean} [validate]
 *   Run schema validation on the result. Default true.
 */

/**
 * Decode a Kaleidoscope scheme resource fork into a Theme.
 *
 * @param {Uint8Array | ArrayBuffer | Blob | string} input
 *   Resource fork bytes, ArrayBuffer, Blob (e.g. from a File input),
 *   or a URL string to fetch.
 * @param {LoadOptions} [options]
 * @returns {Promise<object>} A validated, render-ready Theme.
 */
export async function loadKaleidoscopeScheme(input, options = {}) {
  const bytes = await toUint8Array(input);
  const entries = parseResourceFork(bytes);

  // Decode every resource of a known chrome type. Unknown types are
  // preserved for diagnostics but not decoded — the runtime doesn't
  // currently render anything from STR#, DITL, PICT, etc.
  const decoded = entries.map((e) => {
    let payload = null;
    let error = null;
    try {
      if      (e.type === 'cicn') payload = decodeCicn(e.data);
      else if (e.type === 'ppat') payload = decodePpat(e.data);
      else if (e.type === 'cinf') payload = decodeCinf(e.data);
      else if (e.type === 'wnd#') payload = decodeWnd(e.data);
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }
    return { entry: e, payload, error };
  });

  // Build a synthetic manifest that buildThemeJson can consume. The
  // shape mirrors what the CLI emits — `assets` array with type/id/name,
  // `file` for raster, `data` for geometry. We invent placeholder `file`
  // paths; if encodeAssets is on we replace them with blob URLs below.
  const manifest = buildSyntheticManifest(decoded);
  const theme = buildThemeJson(manifest, { meta: options.meta });

  // Encode RGBA buffers into asset URLs if requested.
  const encodeAssets = options.encodeAssets ?? (typeof OffscreenCanvas !== 'undefined');
  if (encodeAssets) {
    const urlFor = options.assetUrlFactory ?? defaultAssetUrlFactory;
    await replaceAssetsWithEncodedUrls(theme, decoded, urlFor);
  }

  if (options.validate !== false) validateTheme(theme);
  return theme;
}

async function toUint8Array(input) {
  if (input instanceof Uint8Array) return input;
  // ArrayBuffer-ish: ArrayBuffer + SharedArrayBuffer both expose
  // .byteLength + can wrap into a Uint8Array view.
  if (input && typeof input === 'object' && typeof input.byteLength === 'number' && !ArrayBuffer.isView(input)) {
    return new Uint8Array(input);
  }
  if (typeof Blob !== 'undefined' && input instanceof Blob) {
    return new Uint8Array(await input.arrayBuffer());
  }
  if (typeof input === 'string') {
    const res = await fetch(input);
    if (!res.ok) {
      throw new Error(`loadKaleidoscopeScheme: failed to fetch ${input} (${res.status} ${res.statusText})`);
    }
    return new Uint8Array(await res.arrayBuffer());
  }
  throw new Error(`loadKaleidoscopeScheme: unsupported input type ${typeof input}`);
}

function buildSyntheticManifest(decoded) {
  const assets = [];
  for (const { entry, payload, error } of decoded) {
    const base = {
      type: entry.type,
      id: entry.id,
      name: entry.name || null,
    };
    if (error) {
      assets.push({ ...base, status: 'error', error });
      continue;
    }
    if (!payload) {
      // Type we don't decode — pass through as skipped (still recorded
      // for diagnostics, ignored by buildThemeJson).
      assets.push({ ...base, status: 'skipped' });
      continue;
    }
    if (entry.type === 'cicn' || entry.type === 'ppat') {
      assets.push({
        ...base,
        status: 'ok',
        file: placeholderAssetPath(entry),
        width: payload.width,
        height: payload.height,
      });
    } else {
      // cinf / wnd# — geometry, no file
      assets.push({
        ...base,
        status: 'ok',
        data: payload,
      });
    }
  }
  return {
    source: 'resource-fork',
    extractedAt: new Date().toISOString(),
    counts: countManifest(assets),
    assets,
  };
}

function countManifest(assets) {
  const out = { total: assets.length, ok: 0, skipped: 0, errored: 0, raster: 0, geometry: 0 };
  for (const a of assets) {
    if (a.status === 'ok') {
      out.ok++;
      if (a.file) out.raster++;
      else out.geometry++;
    } else if (a.status === 'skipped') out.skipped++;
    else if (a.status === 'error') out.errored++;
  }
  return out;
}

function placeholderAssetPath(entry) {
  const slugBase = (entry.name || '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const idStr = entry.id < 0 ? `n${-entry.id}` : String(entry.id);
  const slug = slugBase ? `${slugBase}` : 'unnamed';
  if (entry.type === 'cicn') return `cicns/cicn-${idStr}-${slug}.png`;
  if (entry.type === 'ppat') return `ppats/ppat-${idStr}-${slug}.png`;
  return `unknown/${entry.type}-${idStr}.bin`;
}

/**
 * Walk the theme's catalogs and replace each `asset` placeholder with a
 * real URL derived from the corresponding decoded RGBA buffer.
 */
async function replaceAssetsWithEncodedUrls(theme, decoded, urlFor) {
  // Index decoded raster payloads by (type, id) for quick lookup.
  const byKey = new Map();
  for (const { entry, payload } of decoded) {
    if (!payload) continue;
    if (entry.type !== 'cicn' && entry.type !== 'ppat') continue;
    byKey.set(`${entry.type}:${entry.id}`, { entry, payload });
  }

  // chromeElements
  if (theme.chromeElements) {
    for (const elem of Object.values(theme.chromeElements)) {
      const id = elem.sourceCicnId;
      if (id == null) continue;
      const hit = byKey.get(`cicn:${id}`);
      if (!hit) continue;
      elem.asset = await urlFor(
        hit.payload.rgba, hit.payload.width, hit.payload.height,
        `cicn-${id}`,
      );
    }
  }

  // patterns (ppat)
  if (theme.patterns) {
    for (const entry of Object.values(theme.patterns)) {
      const id = entry.sourcePpatId;
      if (id == null) continue;
      const hit = byKey.get(`ppat:${id}`);
      if (!hit) continue;
      entry.asset = await urlFor(
        hit.payload.rgba, hit.payload.width, hit.payload.height,
        `ppat-${id}`,
      );
    }
  }

  // windowTypes' chrome map references the asset path stored on the
  // chromeElement entry — those paths were already updated above. But
  // windowType.chrome stores its own copy of the URL, so refresh it.
  if (theme.windowTypes && theme.chromeElements) {
    for (const wt of Object.values(theme.windowTypes)) {
      const chrome = wt.chrome || {};
      for (const state of Object.keys(chrome)) {
        const oldPath = chrome[state];
        if (typeof oldPath !== 'string') continue;
        // Find the chromeElement entry that originally had this path.
        for (const elem of Object.values(theme.chromeElements)) {
          if (placeholderMatches(elem, oldPath)) {
            chrome[state] = elem.asset;
            break;
          }
        }
      }
    }
  }
}

function placeholderMatches(elem, candidate) {
  // The chrome map stores the SAME path string the chromeElement
  // originally had (placeholder). After we update elem.asset to a blob
  // URL, we identify by sourceCicnId convention in the placeholder.
  if (!elem.sourceCicnId) return false;
  const idStr = elem.sourceCicnId < 0 ? `n${-elem.sourceCicnId}` : String(elem.sourceCicnId);
  return candidate.includes(`cicn-${idStr}-`) || candidate.includes(`cicn-${idStr}.`);
}

/**
 * Default asset URL factory — encodes RGBA into a PNG blob URL via
 * OffscreenCanvas. Browser-only; Node tests should pass their own
 * factory (or set encodeAssets: false).
 */
async function defaultAssetUrlFactory(rgba, width, height) {
  if (typeof OffscreenCanvas === 'undefined' || typeof createImageBitmap === 'undefined') {
    throw new Error('defaultAssetUrlFactory: OffscreenCanvas + createImageBitmap required (browser only)');
  }
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d');
  const imgData = ctx.createImageData(width, height);
  imgData.data.set(rgba);
  ctx.putImageData(imgData, 0, 0);
  const blob = await canvas.convertToBlob({ type: 'image/png' });
  return URL.createObjectURL(blob);
}
