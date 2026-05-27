// Runtime Kaleidoscope scheme loader — the BROWSER shell over the portable
// conversion core (convert.js). A single in-browser call instead of the Node
// build pipeline: decode a dropped .ksc/.rsrc resource fork → a render-ready,
// in-memory LoadedTheme (the same theme.json the CLIs write, plus OffscreenCanvas
// blob-URL assets + the glyph map), with no build step and no macOS toolchain.
//
// Layering: convert.js does the PURE conversion (fork → theme + RGBA assets); THIS
// file is the browser I/O shell (RGBA → blob-URL via OffscreenCanvas) + the glue that
// produces the runtime's LoadedTheme contract. The Node CLIs (extract-*.mjs) are the
// parallel Node shell. See docs/superpowers/specs/2026-05-27-browser-conversion-design.md.

import { convertScheme } from './convert.js';
import { unwrapToResourceFork, detectContainer } from './containers.js';

/**
 * @typedef {object} LoadOptions
 * @property {object}  [meta]   name/author/origin merged into the theme (the binary
 *   scheme doesn't carry these).
 * @property {string}  [source] source label for the manifest (default 'resource-fork').
 * @property {boolean} [encodeAssets] encode RGBA → blob-URL assets (default: true in a
 *   browser w/ OffscreenCanvas). When false, returns the raw RGBA assets instead — for
 *   Node tests or a caller doing its own encoding.
 * @property {(rgba: Uint8Array, w: number, h: number, path: string) => (string|Promise<string>)} [assetUrlFactory]
 *   Custom RGBA→URL encoder. Default: OffscreenCanvas PNG blob URL (browser only).
 */

/**
 * Decode a Kaleidoscope scheme resource fork into a render-ready in-memory theme.
 *
 * @param {Uint8Array|ArrayBuffer|Blob|string} input  a raw resource fork OR a Mac
 *   transfer container (MacBinary `.bin`, AppleSingle/Double, BinHex `.hqx`) — as
 *   bytes, an ArrayBuffer, a dropped Blob/File, or a URL to fetch. The container is
 *   unwrapped to its resource fork automatically; `.sit` throws (separate decoder).
 * @param {LoadOptions} [options]
 * @returns {Promise<object>} encodeAssets ⇒ a LoadedTheme `{ manifest, baseUrl:'', glyphs? }`
 *   whose asset refs are blob: URLs (assetUrl passes them through); otherwise the raw
 *   `{ manifest, assets, iconIndex }`.
 */
export async function loadKaleidoscopeScheme(input, options = {}) {
  const bytes = await toUint8Array(input);
  if (!bytes || bytes.length === 0) {
    throw new Error('loadKaleidoscopeScheme: empty input (0 bytes) — not a theme file.');
  }
  // Unwrap a Mac transfer container down to the raw resource fork. StuffIt (.sit) needs the
  // munbox WASM decoder, lazily imported here so the conversion core stays WASM-free until a
  // .sit is actually dropped; the toolchain-free formats (MacBinary / AppleSingle·Double /
  // BinHex) and a raw fork go through the pure-JS containers.js. See tools/sit-wasm.
  let fork;
  if (detectContainer(bytes) === 'stuffit') {
    const { stuffItResourceFork } = await import('../sit-wasm/index.mjs');
    fork = await stuffItResourceFork(bytes);
  } else {
    fork = unwrapToResourceFork(bytes);
  }
  const { theme, assets, iconIndex } = convertScheme(fork, {
    meta: options.meta,
    source: options.source ?? 'resource-fork',
  });
  // convertScheme already validated the theme (convertChrome → validateTheme).

  const encodeAssets = options.encodeAssets ?? (typeof OffscreenCanvas !== 'undefined');
  if (!encodeAssets) {
    // Raw mode: hand back the contract + the un-encoded RGBA assets.
    return { manifest: theme, assets, iconIndex };
  }

  const urlFor = options.assetUrlFactory ?? defaultAssetUrlFactory;
  // Encode every decoded asset → a URL, keyed by its bundle path.
  const urlByPath = new Map();
  for (const a of assets) urlByPath.set(a.path, await urlFor(a.rgba, a.width, a.height, a.path));

  // Rewrite every asset-path ref in the manifest to its URL (chrome, sprites, frame
  // proxy, patterns, body pattern — all stored as path strings that match an asset).
  rewriteAssetRefs(theme, urlByPath);

  // Glyph map (id → URL), highest depth per id — mirrors src/loadTheme.loadGlyphMap.
  const glyphs = buildGlyphMap(iconIndex, urlByPath);

  return { manifest: theme, baseUrl: '', ...(Object.keys(glyphs).length ? { glyphs } : {}) };
}

/** Recursively replace any string value that is a known asset bundle-path with its URL. */
function rewriteAssetRefs(node, urlByPath) {
  if (Array.isArray(node)) { for (const v of node) rewriteAssetRefs(v, urlByPath); return; }
  if (node && typeof node === 'object') {
    for (const k of Object.keys(node)) {
      const v = node[k];
      if (typeof v === 'string') { if (urlByPath.has(v)) node[k] = urlByPath.get(v); }
      else if (v && typeof v === 'object') rewriteAssetRefs(v, urlByPath);
    }
  }
}

/** id → glyph URL, highest depth per id (mirrors src/loadTheme.loadGlyphMap). */
function buildGlyphMap(iconIndex, urlByPath) {
  const glyphs = {};
  const depthAt = {};
  for (const e of iconIndex) {
    if (e.size !== 16 && e.type !== 'ics4' && e.type !== 'ics8') continue;
    const id = String(e.id);
    const d = e.depth ?? (e.type === 'ics8' ? 8 : 4);
    if (d > (depthAt[id] ?? 0)) { glyphs[id] = urlByPath.get(`icons/${e.file}`); depthAt[id] = d; }
  }
  return glyphs;
}

async function toUint8Array(input) {
  if (input instanceof Uint8Array) return input;
  if (input && typeof input === 'object' && typeof input.byteLength === 'number' && !ArrayBuffer.isView(input)) {
    return new Uint8Array(input);
  }
  if (typeof Blob !== 'undefined' && input instanceof Blob) {
    return new Uint8Array(await input.arrayBuffer());
  }
  if (typeof input === 'string') {
    const res = await fetch(input);
    if (!res.ok) throw new Error(`loadKaleidoscopeScheme: failed to fetch ${input} (${res.status} ${res.statusText})`);
    return new Uint8Array(await res.arrayBuffer());
  }
  throw new Error(`loadKaleidoscopeScheme: unsupported input type ${typeof input}`);
}

/** Default RGBA→URL encoder: a PNG blob URL via OffscreenCanvas. Browser-only; Node
 *  callers pass their own assetUrlFactory (or encodeAssets:false). */
async function defaultAssetUrlFactory(rgba, width, height) {
  if (typeof OffscreenCanvas === 'undefined') {
    throw new Error('defaultAssetUrlFactory: OffscreenCanvas required (browser only) — pass assetUrlFactory or encodeAssets:false');
  }
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d');
  const imgData = ctx.createImageData(width, height);
  imgData.data.set(rgba);
  ctx.putImageData(imgData, 0, 0);
  const blob = await canvas.convertToBlob({ type: 'image/png' });
  return URL.createObjectURL(blob);
}
