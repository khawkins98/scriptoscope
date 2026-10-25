import { assertDisplayProfileChain } from '../tools/theme-loader/display-profile.js';
// Base-theme inheritance traversal — the single place "try self, else defer to
// the base theme" lives.
//
// A LoadedTheme may set `base` (the theme it inherits chrome/controls from when
// it ships none itself — e.g. lightly-skinned schemes deferring to the Platinum
// baseline). Every consumer that resolves a resource through that chain (control
// cicns in controls.ts, window chrome in renderWindow.ts, title-bar widget rects
// in interactive.ts) goes through `resolveInChain`, so the traversal — and its
// cycle guard — is defined once rather than re-derived per call site.

import type { LoadedTheme } from './types.js';

/**
 * Walk a theme's base chain (the theme itself first, then `theme.base`, then
 * `theme.base.base`, …) and return the first non-null/undefined result of
 * `pick`. Cycle-safe: a chain that loops back on itself terminates (via a
 * visited set) instead of recursing forever. Returns `undefined` if no theme in
 * the chain yields a value.
 *
 * `pick` receives each theme so it can resolve theme-relative data correctly
 * (e.g. build an asset URL against the bundle that actually OWNS the asset).
 */
export function resolveInChain<T, Theme extends { manifest: LoadedTheme['manifest']; readonly base?: Theme | undefined }>(
  theme: Theme,
  pick: (t: Theme) => T | null | undefined,
): T | undefined {
  assertDisplayProfileChain(theme, theme.manifest.displayProfile);
  const seen = new Set<Theme>();
  for (let t: Theme | undefined = theme; t && !seen.has(t); t = t.base) {
    seen.add(t);
    const v = pick(t);
    if (v != null) return v;
  }
  return undefined;
}
