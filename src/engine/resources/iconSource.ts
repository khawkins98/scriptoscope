// Pure part of the theme adapter's cicn entry (docs/v2/DECISIONS.md #7): pair a
// cicn's decoded pixels with its opaque icon-blit companion. Adapter policy, not a
// spec row. The companion is the I3 copy source (qd-primitives I3) only when it is
// the same occurrence as the element's asset. When it is not (for example a
// consumer replaced `asset`), the icon falls back to the masked copy of the
// current asset, and `fallback` says so; iconBlit records it in the trace. Stale
// hidden pixels are never drawn, and the icon is never dropped.
import type { Pixmap } from '../qd/types.js';
import type { IconSource } from '../qd/region.js';

/** Reason recorded when the companion is rejected (DECISIONS #7). */
export const OPAQUE_COMPANION_MISMATCH = 'opaque companion is not the same occurrence as the asset; masked copy of the current asset (DECISIONS #7)';

/** Same size, and identical RGB at every mask-set pixel of `masked` (DECISIONS #7). */
export function sameOccurrence(masked: Pixmap, unmasked: Pixmap): boolean {
  if (masked.width !== unmasked.width || masked.height !== unmasked.height) return false;
  const a = masked.data, b = unmasked.data;
  for (let i = 0; i < a.length; i += 4) {
    if (a[i + 3] === 0) continue;
    if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]) return false;
  }
  return true;
}

/** The IconSource for a cicn: `companion` is the loader's opaque copy, or null when it made none. */
export function cicnIconSource(pixmap: Pixmap, pixelSize: number | null, companion: Pixmap | null): IconSource {
  if (!companion) return { pixmap, pixelSize, unmasked: null };
  if (sameOccurrence(pixmap, companion)) return { pixmap, pixelSize, unmasked: companion };
  return { pixmap, pixelSize, unmasked: null, fallback: OPAQUE_COMPANION_MISMATCH };
}
