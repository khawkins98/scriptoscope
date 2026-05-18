// Part-code behavior table — Kaleidoscope's wnd# recipe entries carry an
// int16 `part` field whose semantic was hardcoded into Kaleidoscope.app's
// renderer (not externalized in any TMPL or doc). This table reproduces
// that hardcoded mapping, derived empirically from cross-scheme analysis
// of all 7 schemes in `themes/`.
//
// See docs/kaleidoscope-geometry-spec.md §3 ("Empirical semantics of recipe
// parts") for the original speculation and the multi-scheme audit that
// upgraded these from "best guess" to "well-supported" semantics.
//
// Reproduce the audit:
//   for t in themes/*/; do jq -r '.windowTypes[].edges[]?[]?.part' "$t"theme.json; done | sort | uniq -c
//
// Key cross-scheme patterns that gave us confidence:
//   - parts 5 + 6 always appear as a `(N:6) (N+1:5) (N+M:6)` sandwich in
//     every scheme's top recipe at the divider/seam position
//   - parts 8 + 18 are alternative universal-fill codes (1990 uses 8;
//     Acid + evolution use 18; behavior is identical)
//   - parts 0-4 typically resolve to named entries in the parts (rectList)
//     table; the renderer treats them as anchored widgets

export type PartCodeBehavior =
  /** Body region marker — first recipe entry, never a render target. Treated
   *  as left-corner fill in our composer. */
  | 'body-marker'
  /** Named widget in the rectList — anchor at native size, no tile. */
  | 'named-widget'
  /** Divider sandwich edge piece (`(N:6) ... (N+M:6)` pattern). Static
   *  graphic at native size, no tile. */
  | 'divider-edge'
  /** Divider sandwich middle (`(N+1:5)` in the sandwich). Static graphic
   *  at native size, no tile. */
  | 'divider-fill'
  /** Universal stretchable fill — tile cicn pixels across the segment. */
  | 'universal-fill'
  /** Scheme-specific decoration variant. Currently rendered as universal-fill
   *  (safe default per geometry spec). Revisit per-scheme if visible artifacts
   *  appear in reference comparisons. */
  | 'scheme-variant';

const PART_CODE_TABLE: Record<number, PartCodeBehavior> = {
  0:  'body-marker',
  // 1-4 are typically named widgets; resolved dynamically vs the parts
  // table by `classifyPartCode` below. Falls back to scheme-variant if
  // not in the parts table.
  5:  'divider-fill',
  6:  'divider-edge',
  8:  'universal-fill',
  10: 'scheme-variant',  // 1138, Big Blue, Acid
  11: 'scheme-variant',  // 1138 (single use)
  15: 'scheme-variant',  // Big Blue, 1138, Acid
  16: 'scheme-variant',  // 7 Le (single use)
  17: 'scheme-variant',  // ErgoBox (single use)
  18: 'universal-fill',  // Acid + evolution alt fill (identical to part-8)
};

/**
 * Classify a recipe entry's part code into a rendering behavior.
 *
 * Resolution order:
 *   1. If the part code is in the parts table (rectList) → 'named-widget'
 *   2. Otherwise look up the hardcoded part-code table
 *   3. Fallback to 'universal-fill' for unknown codes
 *
 * @param partString Theme JSON's stringified part key ("part-0", "part-8", etc.)
 * @param partsTable The windowType's `parts` Record
 */
export function classifyPartCode(
  partString: string,
  partsTable: Record<string, unknown>,
): PartCodeBehavior {
  const partNum = Number(partString.replace('part-', ''));
  if (partString === 'part-0') return 'body-marker';
  if (partString in partsTable) return 'named-widget';
  const knownBehavior = PART_CODE_TABLE[partNum];
  if (knownBehavior) return knownBehavior;
  return 'universal-fill';
}

/**
 * Whether the behavior pins the segment (no flex-grow, no tile).
 * Tile-grow happens only for `universal-fill` and `scheme-variant`.
 */
export function isPinnedBehavior(behavior: PartCodeBehavior): boolean {
  return (
    behavior === 'named-widget' ||
    behavior === 'divider-edge' ||
    behavior === 'divider-fill'
  );
}
