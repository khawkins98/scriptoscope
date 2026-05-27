// Build a schema-conformant theme.json from an extraction-manifest.json.
//
// The manifest is the extractor's raw output: per-resource decoded data plus
// PNG filenames. The theme.json is the runtime contract — typed in src/types.ts
// (the schema of record), validated by validateTheme.js here.
//
// This module is pure: no file I/O, no Node built-ins. The CLI wraps it. (The one
// import is the shared, pure WINDOW_RECIPES data — the per-type recipe both this
// builder and the replica generator derive from; see window-recipes.mjs.)

import { WINDOW_RECIPES, isDefaultWidgets } from './window-recipes.mjs';

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
            // The full 15-value resize behavior (Scheme Factory MENU 139; see
            // the open question in decoders/cinf.js). Surfaced here so the
            // runtime can honor per-region behavior (e.g. 'repeat-bottom')
            // rather than treating `tile` as a boolean.
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
  // Chrome cicn pairing is by the WDEF resource-id convention (see
  // pairChromeStates): inactive = cicn at the wnd# id, active = cicn at id + 1.
  //   wnd# -14336 "Document Window" → inactive cicn -14336, active cicn -14335.
  // Collapsed windows are their own wnd# resources (e.g. -14332 "Collapsed
  // Document Window" → -14332/-14331), paired the same way.
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

  // ─── Corner-sprite windows (look-only Platinum schemes) ───────────────
  // Some schemes ship the window CORNER cicns + the per-type racing-stripe /
  // grow-box sprites but NO wnd# side-recipe (apple-platinum-2, platinum-8,
  // system7-nostalgia-silver) — so the loop above emitted zero windowTypes and
  // the runtime falls back to the apple-platinum-replica base. These windows are
  // the classic Platinum WDEF corner-sprite + procedural model (the frame is
  // code-driven, not sliced — see docs/spec/platinum-wdef125-decode.md), so we
  // synthesize them from the scheme's OWN sprites instead.
  //
  // CORNER_SPRITE_WINDOWS is the per-type recipe table (the generalization of
  // the original single hardcoded document-window). Each row maps a canonical
  // window slug to the Kaleidoscope cicn ids that dress it:
  //   active/inactive  the corner cicns (role markers — wndId+0 inactive,
  //                    wndId+1 active by the WDEF id convention)
  //   pinstripe        the racing-stripe title-bar fill cicn, or null for a
  //                    title-LESS frame (alert/dialog/no-title utility)
  //   growBox          the size-box cicn, or null (only resizable windows)
  //   titleH           title-bar height px (0 ⇒ title-less, just the 1px ring)
  //   widgets          title-bar widget glyphs (close left, collapse/zoom right)
  //   collapsed        title-bar-only window (no body) — reuses the parent's
  //                    chrome + title bar with a 0-height body
  // Only runs when no wnd# produced a windowType (a scheme WITH a real recipe
  // uses the faithful sliced path).
  if (Object.keys(windowTypes).length === 0) {
    // Resolve a row to PNG files; skip the row if its corner cicns are absent.
    const cicnFile = (id) => byTypeAndId[`cicn:${id}`]?.file ?? null;
    // Side-utility ships no own pinstripe (-14318 is absent in the corpus); it
    // reuses the utility racing-stripes (-14314). The table notes the fallback.
    for (const row of CORNER_SPRITE_WINDOWS) {
      const rec = WINDOW_RECIPES[row.slug]; // titleH / widgets / collapsed (shared)
      if (!rec) continue; // a wired slug with no recipe would be a spec bug
      const activeFile = cicnFile(row.active);
      const inactiveFile = cicnFile(row.inactive) ?? activeFile;
      if (!activeFile) continue; // no corner cicn for this type → can't draw it

      // Title-less frames carry NO pinstripe. Titled types need their stripe
      // sprite present; if the stripe is missing we still draw a plain bar
      // (the header fill) rather than dropping the type, but record null.
      const pinstripeFile = row.pinstripe != null ? cicnFile(row.pinstripe) : null;
      const growFile = row.growBox != null ? cicnFile(row.growBox) : null;

      const sprites = {};
      if (pinstripeFile) sprites.pinstripe = pinstripeFile;
      if (growFile) sprites.growBox = growFile;

      // part-0 = frame thicknesses [left, top, right, bottom]. The top inset is
      // the title-bar height + the 1px bottom-of-bar rule for titled types, or
      // 1px (just the frame band) for title-less / collapsed-title-less. The
      // compositor treats part-0.rect as the four thicknesses directly.
      const top = rec.titleH > 0 ? rec.titleH : 1;
      // Collapsed windows are the title bar only — a 0-height body. We still give
      // them a part-0 so the compositor frames them; the renderer passes a small
      // content height. Nothing special needed here beyond the title height.
      const wt = {
        model: 'corner-sprite',
        chrome: { active: activeFile, inactive: inactiveFile },
        parts: { 'part-0': { rect: [1, top, 1, 1] } },
        cinf: null,
      };
      if (Object.keys(sprites).length) wt.sprites = sprites;
      // Only emit `widgets` when it differs from the compositor default
      // ([close,collapse,zoom]) so the document-window row stays byte-identical
      // to the prior single-type output (which omitted the field).
      if (!isDefaultWidgets(rec.widgets)) wt.widgets = rec.widgets;
      windowTypes[row.slug] = wt;
    }
  }

  // ─── Assemble ─────────────────────────────────────────────────────────
  // NB: no `generatedAt` timestamp — theme.json is DETERMINISTIC so re-importing a
  // scheme reproduces it byte-for-byte (the import is repeatable; only the source
  // bytes drive the output). The extraction wall-clock lives in extraction-manifest.json.
  const theme = {
    version: '0.1',
    source: manifest.source,
    note:
      'Draft theme.json produced by scripts/extract-scheme.mjs. ' +
      'Schema: src/types.ts.',
  };

  // Merge sidecar meta (name, author, origin, options, palette) on top.
  // palette is sidecar-supplied pending full Colr parsing.
  if (meta.note != null)    theme.note = meta.note;
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
 * Pair a window-type wnd# with its chrome cicns by the Mac OS WDEF resource-id
 * convention — NOT by name. Names are unreliable (schemes leave the doc-window
 * cicn unnamed, and the nearest *name-matching* cicn in an id neighbourhood is
 * routinely the wrong one): the previous name-keyword probe mis-paired every
 * secondary type, e.g. Movable Modal (wnd# −14324) grabbing the 16×16 "Active
 * Dialog" −14327 instead of its own 41×32 frame −14323, which then drove the
 * negative/oversized frame insets the compositor had to guard against.
 *
 * The convention every Kaleidoscope scheme follows (the active/inactive frame
 * cicns sit immediately at the wnd# id):
 *   inactive frame cicn = cicn at  wndId        (id + 0)
 *   active   frame cicn = cicn at  wndId + 1    (id + 1)
 *
 * Verified across the bundled corpus (1138/1984/1990/evolution/beos-r503): for
 * every wnd# the id+1 cicn is that type's "Active <Type>" frame, dimensionally
 * consistent with its recipe + body rect. Single-state windows (popup) ship
 * only id+0 — active falls back to it. Collapsed states are their OWN wnd#
 * resources, paired the same way, so a window type's chrome needs only
 * active/inactive.
 *
 * @param {number} wndId
 * @param {Record<string, ManifestAsset>} byTypeAndId
 * @returns {Record<string, string>} state slug → PNG filename
 */
function pairChromeStates(wndId, byTypeAndId) {
  /** @type {Record<string, string>} */
  const out = {};
  const inactive = byTypeAndId[`cicn:${wndId}`];
  const active = byTypeAndId[`cicn:${wndId + 1}`] ?? inactive; // single-state → id+0
  if (active) out.active = active.file;
  if (inactive) out.inactive = inactive.file;
  return out;
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
/**
 * Corner-sprite window recipe table (the Platinum WDEF model, for look-only
 * schemes with no wnd# recipe — apple-platinum-2 et al). One row per canonical
 * window slug; the compositor (src/composeCornerSprite.ts) draws each from the
 * scheme's OWN cicns. ids are the Kaleidoscope window-chrome convention:
 *   active/inactive = the corner cicns; pinstripe = the racing-stripe title fill
 *   (null ⇒ title-less frame); growBox = the size-box cicn (null ⇒ fixed size).
 *   titleH = title-bar height px (0 ⇒ title-less); widgets = title-bar glyphs
 *   (null ⇒ the compositor default [close,collapse,zoom]; [] ⇒ none).
 *   collapsed = title-bar-only (no body).
 *
 * Title heights track the apple-platinum-replica geometry per slug
 * (scripts/generate-platinum/window-types.mjs titleBarHeight): document 19/20,
 * movable-modal/alert 16, utility 11.
 *
 * MAPPING NOTES (apple-platinum-2's inventory; see the task brief):
 *   • alert/dialog are title-LESS (titleBarHeight 0) framed boxes → pinstripe
 *     null; their racing-stripe sprites (-14321/-14325) instead dress the TITLED
 *     movable variants (movable-alert / movable-modal), which share the alert/
 *     dialog corner cicns + a real title bar.
 *   • side-utility ships NO own pinstripe (-14318 is absent in the corpus) — it
 *     reuses the utility racing-stripes (-14314).
 *   • no-title-utility has no dedicated corner cicn (-14288 absent) → reuse the
 *     utility corner cicn (-14316) as a title-less frame.
 *   • popup-window (-12320) and collapsed-no-title-utility are NOT in this table
 *     — see the comment after it.
 */
// Per-type SHIPPED-cicn WIRING only: which Kaleidoscope cicn ids dress each window
// type. The title-bar height / widget set / collapsed flag come from the shared
// WINDOW_RECIPES (imported above) — this table is just the resource ids: the
// active/inactive corner markers (wndId+1 active / wndId+0 inactive, per the WDEF
// id convention), the pinstripe title-bar fill, and the grow-box sprite.
//   • Side-utility ships no own pinstripe (-14318 is absent in the corpus) → it
//     reuses the utility racing-stripes (-14314).
//   • no-title-utility is a tool-palette DRAG BAR (dotted -14314 + close/collapse) —
//     its titleH/widgets live in WINDOW_RECIPES (the references show the dotted bar).
//   • NOT wired here (fall back to the apple-platinum-replica base): popup-window
//     (-12320/-12319 are popup-MENU art, not a window corner) and the title-LESS
//     collapsed-no-title-utility (an empty 1px frame — nothing to draw).
const CORNER_SPRITE_WINDOWS = [
  { slug: 'document-window',              active: -14332, inactive: -14336, pinstripe: -14331, growBox: -14330 },
  { slug: 'collapsed-document-window',    active: -14332, inactive: -14336, pinstripe: -14331, growBox: null   },
  { slug: 'dialog',                       active: -14326, inactive: -14328, pinstripe: null,    growBox: null   },
  { slug: 'alert',                        active: -14322, inactive: -14324, pinstripe: null,    growBox: null   },
  { slug: 'movable-modal',                active: -14326, inactive: -14328, pinstripe: -14325, growBox: null   },
  { slug: 'movable-alert',                active: -14322, inactive: -14324, pinstripe: -14321, growBox: null   },
  { slug: 'titled-utility-window',        active: -14316, inactive: -14320, pinstripe: -14314, growBox: -14313 },
  { slug: 'collapsed-titled-utility',     active: -14316, inactive: -14320, pinstripe: -14314, growBox: null   },
  { slug: 'side-floating-utility-window', active: -14315, inactive: -14319, pinstripe: -14314, growBox: null   },
  { slug: 'collapsed-side-utility',       active: -14315, inactive: -14319, pinstripe: -14314, growBox: null   },
  { slug: 'no-title-utility-window',      active: -14316, inactive: -14320, pinstripe: -14314, growBox: null   },
];

const CANONICAL_WNDTYPE_SLUGS = {
  '-14336': 'document-window',
  '-14335': 'document-window', // active variant (some schemes use as the wnd# ID)
  '-14332': 'collapsed-document-window',
  '-14328': 'dialog',
  '-14326': 'alert',
  '-14324': 'movable-modal',
  '-14322': 'movable-alert',
  '-14304': 'titled-utility-window',
  '-14300': 'collapsed-titled-utility',
  '-14296': 'side-floating-utility-window',
  '-14292': 'collapsed-side-utility',
  '-14288': 'no-title-utility-window',
  '-14284': 'collapsed-no-title-utility',
  '-12320': 'popup-window',
};
