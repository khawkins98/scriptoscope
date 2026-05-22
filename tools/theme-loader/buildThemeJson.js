// Build a schema-conformant theme.json from an extraction-manifest.json.
//
// The manifest is the extractor's raw output: per-resource decoded data plus
// PNG filenames. The theme.json is the runtime contract per
// docs/aaron-ui-composer-spec.md (spec C) §3 (typed in
// src/themes/schema/types.ts, validated by parseTheme there +
// validateTheme.js here).
//
// This module is pure: no Node imports, no file I/O. The CLI wraps it.

/**
 * @typedef {object} ManifestAsset
 * @property {string} type     - 'cicn' | 'ppat' | 'cinf' | 'wnd#'
 * @property {number} id       - Resource ID (negative for system, positive for user)
 * @property {string|null} name - Resource name (may be empty/null)
 * @property {string} status   - 'ok' | 'skipped' | 'error'
 * @property {string} [file]   - PNG filename (raster types only)
 * @property {number} [width]  - PNG dimensions (raster types)
 * @property {number} [height]
 * @property {object} [data]   - Decoded geometry (cinf, wnd#)
 */

/**
 * @typedef {object} Manifest
 * @property {string} source
 * @property {string} extractedAt
 * @property {object} counts
 * @property {ManifestAsset[]} assets
 */

/**
 * @typedef {object} BuildOptions
 * @property {object} [meta]   - Optional sidecar metadata: { name, author, origin, options }
 *                                merged into the top of theme.json. Lets bundle authors
 *                                supply provenance the binary scheme doesn't carry.
 */

/**
 * Build a Theme-shaped JSON object from a manifest.
 *
 * @param {Manifest} manifest
 * @param {BuildOptions} [options]
 * @returns {object} Schema-conformant theme.json
 */
export function buildThemeJson(manifest, options = {}) {
  const meta = options.meta ?? {};

  /** @type {Record<string, ManifestAsset>} */
  const byTypeAndId = {};
  for (const a of manifest.assets) {
    if (a.status === 'ok') byTypeAndId[`${a.type}:${a.id}`] = a;
  }

  const cicns = manifest.assets.filter(a => a.type === 'cicn' && a.status === 'ok');
  const ppats = manifest.assets.filter(a => a.type === 'ppat' && a.status === 'ok');
  const wnds  = manifest.assets.filter(a => a.type === 'wnd#' && a.status === 'ok');

  // ─── Patterns catalog ─────────────────────────────────────────────────
  // Each ppat becomes a catalog entry keyed by its slug. Chrome elements
  // reference patterns by slug via bgPattern, replacing the previous
  // {ppatId, anchor} object shape with a string handle the schema accepts.
  const patterns = {};
  /** @type {Record<number, string>} ppat resource ID → catalog slug */
  const ppatSlugById = {};
  for (const ppat of ppats) {
    const slug = uniquePatternSlug(patterns, slugify(ppat.name) || `ppat-${ppat.id}`);
    patterns[slug] = { asset: ppat.file };
    ppatSlugById[ppat.id] = slug;
  }

  // ─── Chrome elements ──────────────────────────────────────────────────
  // One entry per cicn, with paired cinf data when available. Coordinate
  // tuples (textAnchor, embossAnchor) flatten from {x,y} dicts to [x,y].
  // bgPattern resolves to a patterns-catalog slug, not the raw ppat ID.
  const chromeElements = {};
  for (const cicn of cicns) {
    const cinf = byTypeAndId[`cinf:${cicn.id}`];
    const cd = cinf?.data;
    const slug = uniqueElementSlug(chromeElements, slugify(cicn.name) || `cicn-${cicn.id}`);

    const entry = {
      asset: cicn.file,
      width: cicn.width,
      height: cicn.height,
      slice: cd
        ? {
            corner: cd.cornerSize,
            side: cd.sideThickness,
            tile: cd.tileSides !== 0,
            // The full 15-value resize behavior per Scheme Factory MENU 139.
            // See spec B §13.3 (parked against kDEF disassembly). Surfaced
            // here so the runtime can honor per-region behavior (e.g.,
            // 'repeat-bottom') rather than treating `tile` as a boolean.
            resizeBehavior: cd.resizeBehavior,
          }
        : null,
      bgPattern: cd && cd.bgPatternId !== 0
        ? (ppatSlugById[cd.bgPatternId] ?? null)
        : null,
      bgAnchor:     cd ? coordTuple(cd.bgPixel)     : null,
      textAnchor:   cd ? coordTuple(cd.textPixel)   : null,
      embossAnchor: cd ? coordTuple(cd.embossPixel) : null,
      sourceCicnId: cicn.id,
      sourceCinfId: cinf?.id ?? null,
    };
    chromeElements[slug] = entry;
  }

  // ─── Window types ─────────────────────────────────────────────────────
  // Each wnd# becomes a windowType entry. Parts re-key from array to
  // Record<"part-N", {rect: [l,t,r,b]}>. Edges convert {part:int, border:int}
  // to schema's {at: number, part: string}.
  //
  // Chrome cicn pairing convention (validated against mass:werk 7 Le + ErgoBox):
  //   wnd# -14336 "Document Window"
  //     → cicn -14336 "Inactive Document Window"
  //     → cicn -14335 "Active Document Window"           (id + 1)
  //     → cicn -14332 "Collapsed Inactive Document Window" (id - 4)
  //     → cicn -14331 "Collapsed Active Document Window"   (id - 5)
  // We try a small neighborhood of IDs and probe their names for the state.
  const windowTypes = {};
  for (const wnd of wnds) {
    // Slug priority: scheme-author's name → canonical Mac OS ID
    // fallback → opaque wnd-<id>. The fallback table catches the case
    // where the wnd# resource has no name (some authors didn't fill it
    // in — SHIOCOP's schemes are the canonical example). Without this,
    // such schemes would expose "wnd--14336" instead of "document-window"
    // and break runtime lookups by slug.
    const named = slugify(wnd.name);
    const canonical = CANONICAL_WNDTYPE_SLUGS[String(wnd.id)] || `wnd-${wnd.id}`;
    const slug = uniqueElementSlug(windowTypes, named || canonical);

    const chrome = pairChromeStates(wnd.id, byTypeAndId);
    if (Object.keys(chrome).length === 0) continue; // skip if no cicn pairs found

    /** @type {Record<string, {rect: [number,number,number,number]}>} */
    const parts = {};
    for (const r of wnd.data.rectangles) {
      parts[`part-${r.part}`] = {
        // Schema rect is [left, top, right, bottom] (CSS-friendly).
        // wnd# rect is {top, left, bottom, right} (classic Mac order).
        rect: [r.rect.left, r.rect.top, r.rect.right, r.rect.bottom],
      };
    }

    windowTypes[slug] = {
      chrome,
      parts,
      edges: {
        top:    convertEdgeRecipe(wnd.data.topSide),
        bottom: convertEdgeRecipe(wnd.data.bottomSide),
        left:   convertEdgeRecipe(wnd.data.leftSide),
        right:  convertEdgeRecipe(wnd.data.rightSide),
      },
      // The window-frame cinf (cornerSize / sideThickness / tileSides /
      // textPixel), when the scheme pairs one with this window type's cicn
      // family. The kDEF reads it alongside the wnd# recipe to gate tile-vs-
      // stretch and to colour the title. In the bundled corpus NO scheme ships
      // a cinf for the document window (the cinf resources are all menu/button/
      // slider/tab/dialog elements), so this is null for every observed scheme
      // → the compositor defaults to stretch (tileSides=0). The path is wired so
      // a scheme that DOES ship a window cinf surfaces it. See WindowCinf.
      cinf: findWindowCinf(wnd.id, byTypeAndId),
      bodyPattern: null, // wnd# doesn't reference a body pattern directly;
                         // body composition comes from the chrome cicn's cinf.bgPatternId.
    };
  }

  // ─── Assemble ─────────────────────────────────────────────────────────
  const theme = {
    version: '0.1',
    source: manifest.source,
    generatedAt: manifest.extractedAt,
    note:
      'Draft theme.json produced by @aaron-ui/scheme-extractor. ' +
      'Schema per docs/aaron-ui-composer-spec.md (spec C) §3.',
  };

  // Merge sidecar meta (name, author, origin, options, palette) on top.
  // palette is sidecar-supplied pending full Colr parsing.
  if (meta.name != null)    theme.name = meta.name;
  if (meta.author != null)  theme.author = meta.author;
  if (meta.origin != null)  theme.origin = meta.origin;
  if (meta.options != null) theme.options = meta.options;
  if (meta.palette != null) theme.palette = meta.palette;

  // Extracted Colr (scheme global flags) — supersedes meta.options when
  // present. Only the documented TMPL 128 fields are surfaced; later
  // Kaleidoscope flags live in colr.extraBytes for future decoding.
  const colrAsset = manifest.assets.find((a) => a.type === 'Colr' && a.status === 'ok');
  if (colrAsset?.data) {
    theme.options = {
      ...(theme.options ?? {}),
      stretchScrollbarThumbFromCenter: colrAsset.data.stretchScrollbarThumbFromCenter,
    };
    // Provenance: also stamp the minimum Kaleidoscope version + scheme
    // version on theme.origin so consumers can warn on too-old runtimes.
    theme.origin = {
      ...(theme.origin ?? { kind: 'kaleidoscope-port' }),
      minimumKaleidoscopeVersion: colrAsset.data.minimumKVersion,
    };
  }

  // Then the extracted-resource sections — only emit non-empty ones to
  // keep the JSON honest about what was found in the scheme.
  if (Object.keys(windowTypes).length > 0)    theme.windowTypes = windowTypes;
  if (Object.keys(chromeElements).length > 0) theme.chromeElements = chromeElements;
  if (Object.keys(patterns).length > 0)       theme.patterns = patterns;

  return theme;
}

// ─── Helpers ───────────────────────────────────────────────────────────

/**
 * Find the window-frame cinf paired with a window-type wnd#, if any.
 *
 * The kDEF reads a cinf alongside the wnd# (cornerSize / sideThickness /
 * tileSides / textPixel). A window cinf, when present, shares a resource ID
 * with one of the window's cicn family (the same id range as wnd#/cicn:
 * the active/inactive/collapsed window cicns cluster around wndId). We probe
 * that neighbourhood and the active-window id (wndId + 1).
 *
 * In every bundled scheme this returns null — windows ship NO cinf (the cinf
 * resources are menu/button/slider/tab/dialog elements). The compositor then
 * defaults to tileSides=0 (stretch). See src/types.ts WindowCinf.
 *
 * @param {number} wndId
 * @param {Record<string, ManifestAsset>} byTypeAndId
 * @returns {{cornerSize:number, sideThickness:number, tileSides:number, textPixel:[number,number]|null}|null}
 */
function findWindowCinf(wndId, byTypeAndId) {
  for (let delta = -8; delta <= 8; delta++) {
    const cinf = byTypeAndId[`cinf:${wndId + delta}`];
    if (!cinf?.data) continue;
    const d = cinf.data;
    return {
      cornerSize: d.cornerSize,
      sideThickness: d.sideThickness,
      tileSides: d.tileSides,
      textPixel: d.textPixel ? [d.textPixel.x, d.textPixel.y] : null,
    };
  }
  return null;
}

/**
 * Find active/inactive/collapsed cicns paired with a window-type wnd#.
 * @param {number} wndId
 * @param {Record<string, ManifestAsset>} byTypeAndId
 * @returns {Record<string, string>} state slug → PNG filename
 */
function pairChromeStates(wndId, byTypeAndId) {
  /** @type {Record<string, string>} */
  const out = {};
  // Probe a generous neighborhood; cicn IDs cluster around wnd# IDs.
  // Range observed in mass:werk corpus: wndId ± 8 covers all expected pairs.
  for (let delta = -8; delta <= 8; delta++) {
    const cicn = byTypeAndId[`cicn:${wndId + delta}`];
    if (!cicn) continue;
    const role = classifyChromeRole(cicn.name || '');
    if (role && !(role in out)) out[role] = cicn.file;
  }
  return out;
}

/**
 * Classify a cicn name into a window-chrome state slug per the schema.
 * Returns null when the name doesn't indicate a chrome state — we don't
 * want random control cicns sucked into a windowType's chrome.
 * @param {string} name
 * @returns {string|null}
 */
function classifyChromeRole(name) {
  const n = name.toLowerCase();
  // Need 'window' or 'dialog' or 'alert' in the name to be a chrome cicn
  // (vs a control cicn like 'normal vertical scrollbar').
  if (!/window|dialog|alert/.test(n)) return null;

  const isActive   = /\bactive\b/.test(n) && !/inactive/.test(n);
  const isInactive = /\binactive\b/.test(n);
  const isCollapsed = /\bcollapsed\b/.test(n);

  if (isCollapsed && isActive)   return 'collapsed-active';
  if (isCollapsed && isInactive) return 'collapsed-inactive';
  if (isActive)   return 'active';
  if (isInactive) return 'inactive';
  return null;
}

/**
 * Convert a wnd# edge sequence to schema EdgeRecipe[] shape.
 * @param {Array<{part: number, border: number}>} side
 * @returns {Array<{at: number, part: string}>}
 */
function convertEdgeRecipe(side) {
  return side.map(e => ({ at: e.border, part: `part-${e.part}` }));
}

/**
 * Flatten an {x, y} coord to schema [x, y] tuple.
 * @param {{x: number, y: number}} p
 * @returns {[number, number]}
 */
function coordTuple(p) {
  return [p.x, p.y];
}

function slugify(name) {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function uniqueElementSlug(existing, slug) {
  if (!(slug in existing)) return slug;
  let i = 2;
  while (`${slug}-${i}` in existing) i++;
  return `${slug}-${i}`;
}

function uniquePatternSlug(existing, slug) {
  return uniqueElementSlug(existing, slug);
}

/**
 * Canonical Mac OS wnd# resource IDs → standard slugs.
 *
 * Mac OS Window Manager uses well-known negative resource IDs for the
 * standard window types (zoomDocProc = -14336, etc.). Most scheme
 * authors fill in the `name` field on each wnd# resource (e.g.,
 * "Document Window") which slugifies cleanly. SHIOCOP (#1022, #1990,
 * #1991, ...) authored their schemes WITHOUT names — Mac OS doesn't
 * require them since the ID is the actual lookup key. Without this
 * fallback table their windowTypes get opaque "wnd--14336" slugs and
 * the runtime can't resolve `document-window`.
 *
 * Mapping derived from the named entries in well-formed schemes
 * (mass:werk 7 Le, ErgoBox, 1138, Big Blue) — every observed
 * name → ID pairing follows these conventions.
 */
const CANONICAL_WNDTYPE_SLUGS = {
  '-14336': 'document-window',
  '-14335': 'document-window', // active variant (some schemes use as the wnd# ID)
  '-14332': 'collapsed-document-window',
  '-14328': 'dialog',
  '-14326': 'alert',
  '-14324': 'movable-modal',
  '-14322': 'movable-alert',
  '-14304': 'titled-utility-window',
  '-14296': 'side-floating-utility-window',
  '-14288': 'no-title-utility-window',
  '-12320': 'popup-window',
};
