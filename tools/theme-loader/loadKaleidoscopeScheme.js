import { encodeRasterPng } from './encodeRasterPng.js';
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

import { finalizeCinfTheme, finalizeCinfResourceOwner } from './cinf-environment.js';
import { createRasterAssetOwner, bindRasterOwner, bindRasterLifetime } from './rasterAssets.js';
import { decodeScheme as decodeOnThisThread } from './decodeScheme.js';
import { decodeWithWorker } from './decodeWorkerClient.js';
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
 * @property {object|Function} [decodeWorker] Caller-supplied decode Worker (or a factory for one).
 *   Absent: everything runs on the calling thread. See decodeWorkerClient.js.
 * @property {number} [decodeWorkerTimeoutMs] How long a silent worker may hold this load (default 30000).
 */

export { prewarmStuffItDecoder } from './decodeScheme.js';

// Without `decodeWorker` this is a direct call of the decode stage: the same promise,
// the same number of microtask ticks and the same option reads as before the option
// existed. Only a load that names a worker takes the other branch.
const decodeScheme = (input, options) => options.decodeWorker === undefined
  ? decodeOnThisThread(input, options) : decodeWithWorker(input, options);

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
    bindRasterLifetime(owner.dispose, owner);
    return result;
  } catch (error) { owner.dispose(); throw error; }
}

/** Render-focused contract: resource references and pixels, with lazy image exports. */
export async function loadOwnedKaleidoscopeScheme(input, options = {}) {
  const { converted, byteProvenance, sliderLayoutBinding } = await decodeScheme(input, options);
  const owner = makeOwner(converted.assets, options);
  const source = assembleTheme(converted, undefined, sliderLayoutBinding, byteProvenance, options, owner);
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
    if (urlByPath) rewriteAssetRefs(theme, urlByPath);
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
      cicns.push({ ...parsed, url: urlByPath ? urlByPath.get(a.path) : a.path });
    } else if (a.path.startsWith('ppats/')) {
      const file = a.path.slice('ppats/'.length);
      const parsed = parsePpatFilename(file);
      ppats.push({ ...parsed, url: urlByPath ? urlByPath.get(a.path) : a.path });
    }
  }
  // Icon entries get a URL too (panel rendering happens off `i.url`, not a path).
  const enrichedIcons = iconIndex.map((e) => ({
    ...e,
    url: urlByPath ? urlByPath.get(`icons/${e.file}`) : `icons/${e.file}`,
    ...(e.unmaskedFile ? { unmaskedUrl: urlByPath ? urlByPath.get(`icons/${e.unmaskedFile}`) : `icons/${e.unmaskedFile}` } : {}),
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
    if (d > (depthAt[id] ?? 0)) { glyphs[id] = urlByPath ? urlByPath.get(`icons/${e.file}`) : `icons/${e.file}`; depthAt[id] = d; }
  }
  return glyphs;
}

/** Browser PNG URL adapter; portable callers provide assetUrlFactory. */
async function defaultAssetUrlFactory(rgba, width, height) {
  const canvas = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(width, height)
    : typeof document !== 'undefined' && typeof HTMLCanvasElement !== 'undefined' ? document.createElement('canvas') : null;
  if (!canvas) throw new Error('defaultAssetUrlFactory: no canvas API available (need OffscreenCanvas or document.createElement) — pass assetUrlFactory or encodeAssets:false');
  return URL.createObjectURL(await encodeRasterPng(canvas, rgba, width, height));
}
