// Recipe density classifier. See docs/chrome-rendering-architecture.md §7.1.
//
// A recipe is "rich" when CSS border-image (9-slice only) can't represent the
// slicing — i.e., more than ~6 fill segments on any single edge. Named-widget
// entries don't strain border-image; only fill spans do.

import type { WindowTypeEntry } from '../schema/types.js';

export type RecipeDensity = 'simple' | 'rich';

/**
 * Returns `'rich'` when any edge has more than 6 fill segments (entries whose
 * `part` is NOT present in the windowType's `parts` table). The threshold is
 * corpus-empirical — see chrome-rendering-architecture.md §7.1 for the gap
 * analysis (simple = 4-5 fills max; rich = 9+).
 */
export function recipeDensity(windowType: WindowTypeEntry): RecipeDensity {
  const parts = windowType.parts ?? {};
  const edges = windowType.edges;
  if (!edges) return 'simple';
  const sides = ['top', 'right', 'bottom', 'left'] as const;
  for (const side of sides) {
    const recipe = edges[side];
    if (!recipe) continue;
    let fills = 0;
    for (const entry of recipe) {
      if (!(entry.part in parts)) fills += 1;
      if (fills > 6) return 'rich';
    }
  }
  return 'simple';
}
