import { snapshotCicnTransfer, bindCicnTransfer } from './cicn-transfer-results.js';
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

import { assertCinfEnvironment, bindCinfEnvironment, finalizeCinfTheme, finalizeCinfResourceOwner } from './cinf-environment.js';
import { beginLoadProvenance } from './loadProvenance.js';
import { createRasterAssetOwner, bindRasterOwner } from './rasterAssets.js';
import { convertScheme } from './convert.js';
import { displayRealizer } from './display-profile.js';
import { unwrapToResourceFork, detectContainer } from './containers.js';
import { buildResourceRoles, parseCicnFilename, parsePpatFilename } from './classifyResources.js';

/**
 * @typedef {object} LoadOptions
 * @property {object}  [meta]   name/author/origin merged into the theme (the binary
 *   scheme doesn't carry these).
 * @property {string}  [source] source label for the manifest (default 'resource-fork').
 * @property {boolean} [encodeAssets] encode RGBA → blob-URL assets (default: true in a
 *   browser w/ OffscreenCanvas). When false, returns the raw RGBA assets instead — for
 *   Node tests or a caller doing its own encoding.
 * @property {boolean} [provenance] Opt-in immutable decoder-input byte evidence.
 * @property {object} [sliderLayoutEnvironment] Prepared authoritative cinf-only environment for standalone group2 sliders.
 * @property {object} [cinfEnvironment] Prepared explicit standalone push/bevel body cinf environment.
 * @property {(rgba: Uint8Array, w: number, h: number, path: string) => (string|Promise<string>)} [assetUrlFactory]
 *   Custom RGBA→URL encoder. Default: OffscreenCanvas PNG blob URL (browser only).
 */

/**
 * Decode a Kaleidoscope scheme resource fork into a render-ready in-memory theme.
 *
 * @param {Uint8Array|ArrayBuffer|Blob|string} input  a raw resource fork OR a Mac
 *   transfer container (MacBinary `.bin`, AppleSingle/Double, BinHex `.hqx`) — as
 *   bytes, an ArrayBuffer, a dropped Blob/File, or a URL to fetch. The container is
 *   unwrapped to its resource fork automatically; `.sit` lazily uses the WASM decoder.
 * @param {LoadOptions} [options]
 * @returns {Promise<object>} encodeAssets ⇒ a LoadedTheme `{ manifest, baseUrl:'', glyphs? }`
 *   whose asset refs are blob: URLs (assetUrl passes them through); otherwise the raw
 *   `{ manifest, assets, iconIndex }`.
 */
async function decodeScheme(input, options) {
  const displayProfile = options.displayProfile;
  const cicnTransfer = snapshotCicnTransfer(options.cicnTransfer, displayProfile);
  const cinfEnvironment = options.cinfEnvironment;
  assertCinfEnvironment(cinfEnvironment);
  const sliderLayoutEnvironment = options.sliderLayoutEnvironment;
  assertCinfEnvironment(sliderLayoutEnvironment);
  displayRealizer(displayProfile);
  // Snapshot caller-owned byte inputs synchronously, before any await. Every
  // digest and decoder receives this same private snapshot when opted in.
  if ((options.provenance || cinfEnvironment || sliderLayoutEnvironment || cicnTransfer) && input instanceof Uint8Array) input = new Uint8Array(input);
  else if ((options.provenance || cinfEnvironment || sliderLayoutEnvironment || cicnTransfer) && input && typeof input.byteLength === 'number' && !ArrayBuffer.isView(input)) {
    input = new Uint8Array(new Uint8Array(input));
  }
  const bytes = await toUint8Array(input);
  if (!bytes || bytes.length === 0) {
    throw new Error('loadKaleidoscopeScheme: empty input (0 bytes) — not a theme file.');
  }
  // Unwrap a Mac transfer container down to the raw resource fork. StuffIt (.sit) needs the
  // munbox WASM decoder, lazily imported here so the conversion core stays WASM-free until a
  // .sit is actually dropped; the toolchain-free formats (MacBinary / AppleSingle·Double /
  // BinHex) and a raw fork go through the pure-JS containers.js. See tools/sit-wasm.
  const container = detectContainer(bytes);
  const evidence = options.provenance ? await beginLoadProvenance(bytes, container) : null;
  let fork, selection;
  if (container === 'stuffit') {
    const { stuffItResourceForkWithSelection } = await import('../sit-wasm/index.mjs');
    ({ bytes: fork, selection } = await stuffItResourceForkWithSelection(bytes));
  } else {
    fork = unwrapToResourceFork(bytes);
    selection = { policy: container === 'raw' ? 'raw-resource-fork' : 'unverified-container-unwrapping',
      entryIndex: null, entryName: null, forkType: container === 'raw' ? 1 : null, fileType: null, creator: null };
  }
  if (cicnTransfer) fork = new Uint8Array(fork);
  if (evidence) await evidence.selectedFork(fork, selection);
  const cinfBinding = await bindCinfEnvironment(cinfEnvironment, fork);
  const sliderLayoutBinding = await bindCinfEnvironment(sliderLayoutEnvironment, fork);
  const cicnTransferBinding = await bindCicnTransfer(cicnTransfer, fork);
  let converted;
  try {
    converted = convertScheme(fork, {
      meta: options.meta, source: options.source ?? 'resource-fork', displayProfile, cinfBinding, cicnTransferBinding,
      ...(options.iconBlitCicnIds ? { iconBlitCicnIds: options.iconBlitCicnIds } : {}),
      ...(options.unmaskedIconIds ? { unmaskedIconIds: options.unmaskedIconIds } : {}),
      ...(options.engineCinfIds ? { engineCinfIds: options.engineCinfIds } : {}),
      ...(evidence ? { resourceObserver: evidence.observer } : {}),
    });
  } catch (error) {
    // Preserve the primary conversion error and settle every pending digest.
    if (evidence) await evidence.settle();
    throw error;
  }
  // Complete or reject all hashing before any encoder can allocate asset URLs.
  const byteProvenance = evidence ? await evidence.finish() : undefined;
  return { converted, byteProvenance, sliderLayoutBinding };
}

export async function loadKaleidoscopeScheme(input, options = {}) {
  const { converted, byteProvenance, sliderLayoutBinding } = await decodeScheme(input, options);
  const { theme, assets, ...catalog } = converted;
  const canEncode = typeof OffscreenCanvas !== 'undefined'
    || (typeof document !== 'undefined' && typeof HTMLCanvasElement !== 'undefined');
  const encodeAssets = options.encodeAssets ?? canEncode;
  if (!encodeAssets) {
    finalizeCinfTheme(theme);
    finalizeCinfResourceOwner(theme, sliderLayoutBinding, 'sliderLayoutEnvironment');
    const { iconIndex, iconMaskResources, iconMaskPlanes, iconColorResources, cicnResources, ppatResources, colorTables } = catalog;
    return { manifest: theme, assets, iconIndex, iconMaskResources, iconMaskPlanes, iconColorResources, cicnResources, ppatResources, colorTables, ...(byteProvenance ? { byteProvenance } : {}) };
  }

  const owner = makeOwner(assets, options);
  try {
    const result = assembleTheme(converted, await owner.imageUrls(), sliderLayoutBinding, byteProvenance, options, owner);
    owner.releasePixels();
    return result;
  } catch (error) { owner.dispose(); throw error; }
}

/** Render-focused contract: resource references and pixels, with lazy image exports. */
export async function loadOwnedKaleidoscopeScheme(input, options = {}) {
  const { converted, byteProvenance, sliderLayoutBinding } = await decodeScheme(input, options);
  const owner = makeOwner(converted.assets, options);
  const source = assembleTheme(converted, owner.references, sliderLayoutBinding, byteProvenance, options, owner);
  delete source.baseUrl;
  delete source.dispose;
  bindRasterOwner(source, owner);
  return { kind: 'owned-theme', origin: '', source, imageUrl: owner.imageUrl, dispose: owner.dispose };
}

function makeOwner(assets, options) {
  const custom = options.assetUrlFactory;
  return createRasterAssetOwner(assets, custom ?? defaultAssetUrlFactory, !!custom);
}

function assembleTheme(converted, urlByPath, sliderLayoutBinding, byteProvenance, options, owner) {
  const { theme, assets, iconIndex, iconMaskResources, iconMaskPlanes, iconColorResources, cicnResources, ppatResources, colorTables } = converted;
  try {
    rewriteAssetRefs(theme, urlByPath);
    finalizeCinfTheme(theme);
    finalizeCinfResourceOwner(theme, sliderLayoutBinding, 'sliderLayoutEnvironment');
    const glyphs = buildGlyphMap(iconIndex, urlByPath);
    const inspector = { ...buildInspector(theme, assets, iconIndex, urlByPath, options.meta?.name),
      iconMaskResources, iconMaskPlanes, iconColorResources, cicnResources, ppatResources, colorTables };
    return {
      manifest: theme, baseUrl: '', inspector, dispose: owner.dispose,
      ...(byteProvenance ? { byteProvenance } : {}),
      ...(Object.keys(glyphs).length ? { glyphs } : {}),
    };
  } catch (error) {
    owner.dispose();
    throw error;
  }
}

/** Build the inspector catalog from the decode output. Mirrors the on-disk JSON
 *  shape: { iconIndex, cicns, ppats, resourceRoles }. URLs (vs filesystem paths)
 *  are baked in so the panel code can render directly. */
function buildInspector(manifest, assets, iconIndex, urlByPath, slugHint) {
  // Reverse: bundle-path → URL, so the inspector can hand each row a ready URL.
  // The cicn/ppat lists come from the assets[] array (the same source that gave
  // us urlByPath). Icon list comes from convertScheme's iconIndex.
  const cicns = [];
  const ppats = [];
  for (const a of assets) {
    // Asset paths: 'cicns/cicn-n10239-…png', 'ppats/ppat-…png', 'icons/…png'.
    if (a.path.startsWith('cicns/')) {
      const file = a.path.slice('cicns/'.length);
      const parsed = parseCicnFilename(file);
      cicns.push({ ...parsed, url: urlByPath.get(a.path) });
    } else if (a.path.startsWith('ppats/')) {
      const file = a.path.slice('ppats/'.length);
      const parsed = parsePpatFilename(file);
      ppats.push({ ...parsed, url: urlByPath.get(a.path) });
    }
  }
  // Icon entries get a URL too (panel rendering happens off `i.url`, not a path).
  const enrichedIcons = iconIndex.map((e) => ({
    ...e,
    url: urlByPath.get(`icons/${e.file}`),
    ...(e.unmaskedFile ? { unmaskedUrl: urlByPath.get(`icons/${e.unmaskedFile}`) } : {}),
  }));

  const themeSlug = (slugHint || manifest?.name || 'theme').toString();
  const resourceRoles = buildResourceRoles(themeSlug, cicns, ppats, iconIndex);

  return { iconIndex: enrichedIcons, cicns, ppats, resourceRoles };
}

/** Recursively replace any string value that is a known asset bundle-path with its URL. */
function rewriteAssetRefs(node, urlByPath) {
  if (Array.isArray(node)) { for (const v of node) rewriteAssetRefs(v, urlByPath); return; }
  if (node && typeof node === 'object') {
    for (const k of Object.keys(node)) {
      const v = node[k];
      if (k === 'cicnTransfer' || k === 'displayProfile' || k === 'bodyCinf' || k === 'cinfEnvironment' || k === 'sliderLayoutEnvironment') continue; // immutable condition/evidence data, never asset references
      // Stable derivation identity is not an asset URL. Replace this immutable
      // scalar link as a unit; never recursively rewrite its derivedPath.
      if ((k === 'sampledBandAsset' || k === 'cicnBody') && v && typeof v === 'object') {
        node[k] = Object.freeze({ ...v, ...(v.asset ? { asset: urlByPath.get(v.asset) ?? v.asset } : {}) });
        continue;
      }
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
/** Default RGBA→URL encoder. `OffscreenCanvas` is the fast path (parallel + off the
 *  main thread); a fallback to the main-thread `<canvas>` covers Safari 16.0–16.3 +
 *  iOS WebView pre-16.4, where `OffscreenCanvas` is undefined. Without the fallback,
 *  loadTheme would have silently produced a broken theme on a meaningful slice of
 *  iOS traffic — every render fetched `bundleUrl/<bundle-relative-path>` and 404'd.
 *  Node callers without DOM globals still need to pass `assetUrlFactory` or
 *  `encodeAssets:false`. */
async function defaultAssetUrlFactory(rgba, width, height) {
  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    const imgData = ctx.createImageData(width, height);
    imgData.data.set(rgba);
    ctx.putImageData(imgData, 0, 0);
    const blob = await canvas.convertToBlob({ type: 'image/png' });
    return URL.createObjectURL(blob);
  }
  if (typeof document !== 'undefined' && typeof HTMLCanvasElement !== 'undefined') {
    // Main-thread <canvas> fallback. The detached element is GC'd as soon as the
    // returned Promise resolves; the encoded blob URL owns its own bytes.
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d');
    const imgData = ctx.createImageData(width, height);
    imgData.data.set(rgba);
    ctx.putImageData(imgData, 0, 0);
    return await new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) return reject(new Error('canvas.toBlob returned null'));
        resolve(URL.createObjectURL(blob));
      }, 'image/png');
    });
  }
  throw new Error('defaultAssetUrlFactory: no canvas API available (need OffscreenCanvas or document.createElement) — pass assetUrlFactory or encodeAssets:false');
}
