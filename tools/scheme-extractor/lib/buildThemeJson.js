// Build a schema-conformant theme.json from an extraction-manifest.json.
//
// The manifest is the extractor's raw output: per-resource decoded data plus
// PNG filenames. The theme.json is the runtime contract per
// docs/kaleidoscope-geometry-spec.md §7 (typed in src/themes/schema/types.ts,
// validated by parseTheme there + validateTheme.js here).
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
        ? { corner: cd.cornerSize, side: cd.sideThickness, tile: cd.tileSides !== 0 }
        : null,
      bgPattern: cd && cd.bgPatternId !== 0
        ? (ppatSlugById[cd.bgPatternId] ?? null)
        : null,
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
    const slug = uniqueElementSlug(windowTypes, slugify(wnd.name) || `wnd-${wnd.id}`);

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
      'Schema per docs/kaleidoscope-geometry-spec.md §7.',
  };

  // Merge sidecar meta (name, author, origin, options, palette) on top.
  // palette is sidecar-supplied pending a Colr decoder (#36 didn't ship one).
  // Once Colr decoding lands, this merge will defer to the extracted palette.
  if (meta.name != null)    theme.name = meta.name;
  if (meta.author != null)  theme.author = meta.author;
  if (meta.origin != null)  theme.origin = meta.origin;
  if (meta.options != null) theme.options = meta.options;
  if (meta.palette != null) theme.palette = meta.palette;

  // Then the extracted-resource sections — only emit non-empty ones to
  // keep the JSON honest about what was found in the scheme.
  if (Object.keys(windowTypes).length > 0)    theme.windowTypes = windowTypes;
  if (Object.keys(chromeElements).length > 0) theme.chromeElements = chromeElements;
  if (Object.keys(patterns).length > 0)       theme.patterns = patterns;

  return theme;
}

// ─── Helpers ───────────────────────────────────────────────────────────

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
