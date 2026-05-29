// scripts/lib/kdef-control-ids.mjs
//
// Single source of truth for the kDEF 2.3.1 control resource ids that BOTH
// lint:themes (control-coverage warns) and audit:scenes (codex tier resolvers)
// read. Previously each script hardcoded the same numbers inline — when a
// reviewer added the `-10223 lavender canonical` slot to the audit, the lint's
// `progress` family list had to be updated separately, and the two could (and
// did) drift on related ids. One catalogue, one update site.
//
// The id constants are POSITIVE here (the kDEF dispatches on |id|; bundles
// ship them as negative-resource cicns, but `cicn-n10239-...` and `cicn--10239-...`
// both encode the same dispatch slot). Consumers that need negative ids (e.g.,
// the glyph map keys) negate when looking up.
//
// CITATIONS to the asm reference live with each control. The two scripts
// import the same constants and apply their own semantics:
//   - lint uses `lookupIds` (what composeX calls) vs `familyRanges` (what the
//     bundle ships) to flag "ships art that composeX won't find."
//   - audit uses individual constants in per-tier resolvers (e.g.,
//     -10223 → lavender progress-bar tier).

export const KDEF_CONTROL_IDS = {
  // composeButton looks up these three; the family covers all canonical face slots.
  // kDEF231 asm 0x49d6 (kButtonFaceActive). See docs/spec/kdef231-reference.md §2.2.
  button: {
    active: 10239,
    pressed: 10238,
    inactive: 10240,
    ringActive: 10231,
    ringInactive: 10232,
    lookupIds: [10239, 10238, 10240],
    familyRanges: [[10238, 10240]],
  },
  // composeCheckbox / composeRadio: 4 cells each (unchecked, checked, mixed,
  // disabled), spaced by state. kDEF231 asm 0x???? — see controls.ts:1126.
  checkbox: {
    lookupIds: [9500, 9503, 9501, 9504],
    familyRanges: [[9500, 9504]],
  },
  radio: {
    lookupIds: [9488, 9491, 9489, 9492],
    familyRanges: [[9488, 9492]],
  },
  // composeSlider: -10205..-10208 (4 cells: thumb up/down/track-h/track-v).
  // kDEF231 asm 0x???? — see controls.ts composeSlider.
  slider: {
    lookupIds: [10205, 10206, 10207, 10208],
    familyRanges: [[10205, 10208]],
  },
  // composeScrollbar: -8277..-8288 (active + inactive × horiz + vert + arrows).
  // kDEF231 asm 0x???? — see controls.ts composeScrollbar.
  scrollbar: {
    lookupIds: [8277, 8278, 8279, 8280, 8285, 8286, 8287, 8288],
    familyRanges: [[8277, 8288]],
  },
  // composeProgress: -10075..-10080 (role-3-part frame/fill/track variants) +
  // -10223/-10224 (lavender 2-part canonical default that the kDEF checks first).
  // See controls.ts composeProgress + docs/scene-codex.md progress-bar-hue.
  progress: {
    lavenderCanonical: 10223,
    lavenderInactive: 10224,
    frame: 10080,
    fill: 10079,
    track: 10078,
    lookupIds: [10075, 10076, 10077, 10078, 10079, 10080, 10223, 10224],
    familyRanges: [[10075, 10080], [10223, 10224]],
  },
  // composeTab: -9972/-9975/-9980/-9983 (front/rear × active/inactive).
  tab: {
    lookupIds: [9972, 9975, 9980, 9983],
    familyRanges: [[9969, 9984]],
  },
  // composeGrowBox + corner-sprite renderer: -14330/-14333/-14334.
  growbox: {
    lookupIds: [14330, 14333, 14334],
    familyRanges: [[14330, 14334]],
  },
};

/** Glyph (ics4/ics8) families, keyed by negative id range. Consumed by lint
 *  (orphan detection) and the codex (title-widget-glyph + scroll-arrow-glyph
 *  tier resolvers). */
export const KDEF_GLYPH_FAMILIES = [
  { lo: -10208, hi: -10197, label: 'scroll/slider-arrow' },
  { lo: -10224, hi: -10214, label: 'radio' },
  { lo: -10240, hi: -10229, label: 'checkbox' },
  { lo: -14336, hi: -14331, label: 'doc-widget' },
  { lo: -14320, hi: -14315, label: 'util-widget' },
];

/** The canonical doc-window widget ids (close / zoom / collapse, raised state).
 *  Used by the codex `title-widget-glyph` slot. */
export const KDEF_DOC_WIDGET_IDS = [-14336, -14335, -14334];
export const KDEF_UTIL_WIDGET_IDS = [-14320, -14319, -14318];

/** Full 8-glyph scroll-arrow set (4 directions × raised+pressed). The
 *  canonical kDEF231 CDEF arrow map (asm 9f0e-9f38). */
export const KDEF_SCROLL_ARROW_IDS = [
  -10197, -10198, -10199, -10200, -10201, -10202, -10203, -10204,
];
