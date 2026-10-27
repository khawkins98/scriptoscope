// wnd# fallback lookup.
//
// Supports canonical window-type names, compatibility aliases and raw resource keys.
// Compatibility aliases resolve before the ordered variant-bit fallback ladder.
// Resource lookup stops at the first available candidate.
// This helper does not define Resource Manager base-chain ownership.

import { WINDOW_TYPE_IDENTITIES } from '../tools/theme-loader/window-type-identities.js';

function identityFor(key: string) {
  return WINDOW_TYPE_IDENTITIES.find(identity => identity.canonicalSlug === key
    || identity.legacySlugs.includes(key)
    || [identity.id, ...(identity.alternateIds ?? [])].some(id => key === `wnd-${id}`));
}

/** Normalize known canonical, legacy and raw keys; custom names stay exact. */
export function canonicalWindowTypeSlug(key: string): string {
  return identityFor(key)?.canonicalSlug ?? key;
}

/** Exact requested key first, then equivalent canonical/legacy/raw identities. */
export function equivalentWindowTypeKeys(key: string): string[] {
  const identity = identityFor(key);
  return identity ? [...new Set([key, identity.canonicalSlug, ...identity.legacySlugs,
    ...[identity.id, ...(identity.alternateIds ?? [])].map(id => `wnd-${id}`)])] : [key];
}

/** Known collapsed identity, separate from missing-resource degradation. */
export function collapsedWindowTypeSlug(key: string): string | undefined {
  const id = identityFor(key)?.collapsedId;
  return WINDOW_TYPE_IDENTITIES.find(identity => identity.id === id)?.canonicalSlug;
}

/** The 12 AND masks the kDEF tries in order. First entry (`-1` ≡ 0xFFFF) is the
 *  raw id (no bit stripped). Subsequent entries are the AND masks applied at
 *  `0x3586/0x359e/…/0x3676`. */
const CASCADE_MASKS: ReadonlyArray<number> = [-1, -2, -3, -4, -5, -6, -15, -16, -17, -18, -21, -22];

/** Sign-extend a 16-bit unsigned value to a signed int (so AND results that go
 *  through the unsigned domain land back as the negative resource id we use). */
function signExtend16(u: number): number {
  return u < 0x8000 ? u : u - 0x10000;
}

/**
 * Apply the kDEF cascade to a canonical wnd# resource id and return the ORDERED
 * list of distinct fallback ids the kDEF would try after the raw id misses.
 * The raw id itself is NOT included — callers handle exact-match before
 * consulting the cascade. Order matches the binary's attempt order (top-down
 * through the mask table), with duplicates suppressed (an `& -4` that lands on
 * the same id as `& -2` doesn't re-attempt the same resource).
 *
 * @example
 *   cascadeFallbackIds(-14284) → [-14288, -14300, -14304]
 *   //  collapsed-no-title-utility → no-title-utility → collapsed-titled-utility → titled-utility
 *   cascadeFallbackIds(-14336) → []   // document-window is terminal
 */
export function cascadeFallbackIds(rawId: number): number[] {
  const u = rawId & 0xFFFF;
  const seen = new Set<number>([rawId]);
  const out: number[] = [];
  for (const mask of CASCADE_MASKS) {
    if (mask === -1) continue; // skip the raw attempt — caller's job
    const candidate = signExtend16(u & (mask & 0xFFFF));
    if (seen.has(candidate)) continue;
    seen.add(candidate);
    out.push(candidate);
  }
  return out;
}

/**
 * Slug-space wrapper: given a canonical window-type slug, return the ordered
 * list of canonical fallback SLUGS the kDEF cascade would land on. Unknown
 * slugs (non-canonical, e.g. an author-supplied custom wnd# id) return `[]` —
 * the cascade only operates on the canonical id grid.
 *
 * @example
 *   cascadeFallbackSlugs('collapsed-side-floating-utility-window')
 *     → ['side-floating-utility-window', 'titled-utility-window']
 */
export function cascadeFallbackSlugs(slug: string): string[] {
  const id = identityFor(slug)?.id;
  if (id == null) return [];
  const fallbackIds = cascadeFallbackIds(id);
  const out: string[] = [];
  const seen = new Set<string>([canonicalWindowTypeSlug(slug)]);
  for (const fid of fallbackIds) {
    const fslug = WINDOW_TYPE_IDENTITIES.find(identity => identity.id === fid || identity.alternateIds?.includes(fid))?.canonicalSlug;
    if (!fslug || seen.has(fslug)) continue;
    seen.add(fslug);
    out.push(fslug);
  }
  return out;
}
