// ─────────────────────────────────────────────────────────────────────────────
// wnd# fallback ladder — clean-room replay of Kaleidoscope 2.3.1 kDEF
// ─────────────────────────────────────────────────────────────────────────────
//
// The 2.3.1 kDEF (file `id-0-680x0_DefProcs.bin`, 107,726 B) carries a 12-step
// `wnd#` ID-degradation cascade at `0x356c..0x367e`. When the scheme's resource
// fork doesn't ship the requested wnd# id, the kDEF re-attempts with a series
// of bitwise-AND'd ids that strip "variant" bits until one resolves. The cascade
// terminates at the canonical document-window id (`-14336`) for the document
// family and at the titled-utility id (`-14304`) for the utility family.
//
// This is a 2.3.1-only enhancement — the 1.8.2 kDEF (`/scratch/k182-kdef/…`)
// has NO `'wnd#'` FourCC anywhere in `kDEF 0`; cross-checked by `grep -c 'wnd#'`
// on both binaries. 1.8.2 used a different resource model; 2.3.1 introduced
// the wnd# slice-list + this cascade as its degradation strategy.
//
// Decoded asm walk (every step `pea 'wnd#'; push (d3 ANDed); _GetResource; …`):
//
//   0x356a  raw          push d3
//   0x357c  AND -2       push d3 & 0xFFFE  (strip bit 0)
//   0x3594  AND -3       push d3 & 0xFFFD  (strip bit 1)
//   0x35ac  AND -4       push d3 & 0xFFFC  (strip bits 0-1)
//   0x35c4  AND -5       push d3 & 0xFFFB  (strip bit 2)
//   0x35dc  AND -6       push d3 & 0xFFFA  (strip bits 0+2)
//   0x35f4  AND -15      push d3 & 0xFFF1  (strip bits 1-3)
//   0x360c  AND -16      push d3 & 0xFFF0  (strip bits 0-3)
//   0x3624  AND -17      push d3 & 0xFFEF  (strip bit 4)
//   0x363c  AND -18      push d3 & 0xFFEE  (strip bits 0+4)
//   0x3654  AND -21      push d3 & 0xFFEB  (strip bits 2+4)
//   0x366c  AND -22      push d3 & 0xFFEA  (strip bits 0+2+4)
//
// After each attempt the kDEF tests the returned Handle (`a2`); a non-null
// handle short-circuits (`bnes`) past the remaining attempts to the join at
// `0x3680`. Verified 2026-05-29 against `.scratch/k231-kdef/kDEF/k231-kdef0.asm`
// (`'wnd#'` = FourCC 0x776e6423 = decimal 2003723299; `_GetResource` = 0xA9A0).
//
// HOW IT MAPS ONTO THE CANONICAL ID GRID (`-14336..-14284, -12320`):
//
//   ID      SLUG                              CASCADE LANDING (unique steps)
//   -14336  document-window                   (terminal)
//   -14332  collapsed-document-window         → -14336
//   -14328  dialog                            → -14336
//   -14326  alert                             → -14328 → -14336
//   -14324  movable-modal                     → -14328 → -14336
//   -14322  movable-alert                     → -14324 → -14326 → -14336
//   -14304  titled-utility-window             (terminal — utility family)
//   -14300  collapsed-titled-utility          → -14304
//   -14296  side-floating-utility-window      → -14304
//   -14292  collapsed-side-utility            → -14296 → -14304
//   -14288  no-title-utility-window           → -14304
//   -14284  collapsed-no-title-utility        → -14288 → -14300 → -14304
//   -12320  popup-window                      (terminal — no fallback in mask grid)
//
// CORPUS IMPACT (audited 2026-05-29 across all 18 bundles): every bundle except
// `1138` and `beos-r503` is missing at least one of the canonical collapsed-*
// or no-title-utility slugs, and the cascade resolves every one of them to a
// structurally compatible window type the bundle DOES ship. This is the
// period-faithful answer to the "windowshade requested but bundle ships no
// collapsed-* variant" question (vs. the prior `collapsedSlugFor` heuristic
// in `interactive.ts`, which only walked `collapsed-${slug}` and a noun match).
//
// CITATIONS:
//   docs/spec/kdef-binary-inventory.md §4              (the finding)
//   docs/spec/kdef231-reference.md §3.4                (the cascade table)
//   .scratch/k231-kdef/kDEF/k231-kdef0.asm 0x356c..0x367e  (the ground truth)
// ─────────────────────────────────────────────────────────────────────────────

/** Canonical wnd# resource id → standard slug (mirrors
 *  `CANONICAL_WNDTYPE_SLUGS` in `tools/theme-loader/buildThemeJson.js`).
 *  Kept here as the runtime mirror because the cascade walks in id-space. */
const CANONICAL_ID_TO_SLUG: Record<number, string> = {
  [-14336]: 'document-window',
  [-14335]: 'document-window', // active-state variant some schemes key on
  [-14332]: 'collapsed-document-window',
  [-14328]: 'dialog',
  [-14326]: 'alert',
  [-14324]: 'movable-modal',
  [-14322]: 'movable-alert',
  [-14304]: 'titled-utility-window',
  [-14300]: 'collapsed-titled-utility-window',
  [-14296]: 'side-floating-utility-window',
  [-14292]: 'collapsed-side-floating-utility-window',
  [-14288]: 'no-title-utility-window',
  [-14284]: 'collapsed-no-title-utility-window',
  [-12320]: 'popup-window',
};

/** Slug → canonical wnd# id (inverse of the table above; prefers the
 *  inactive-state id for `document-window`, matching the kDEF's load order). */
const CANONICAL_SLUG_TO_ID: Record<string, number> = (() => {
  const out: Record<string, number> = {};
  for (const [idStr, slug] of Object.entries(CANONICAL_ID_TO_SLUG)) {
    if (!(slug in out)) out[slug] = Number(idStr);
  }
  return out;
})();

/** The 12 AND masks the kDEF tries in order. First entry (`-1` ≡ 0xFFFF) is the
 *  raw id (no bit stripped). Subsequent entries are the `andiw` immediates from
 *  the disassembly at `0x3586/0x359e/…/0x3676`. */
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
 *   cascadeFallbackSlugs('collapsed-side-utility')
 *     → ['side-floating-utility-window', 'titled-utility-window']
 */
export function cascadeFallbackSlugs(slug: string): string[] {
  const id = CANONICAL_SLUG_TO_ID[slug];
  if (id == null) return [];
  const fallbackIds = cascadeFallbackIds(id);
  const out: string[] = [];
  const seen = new Set<string>([slug]);
  for (const fid of fallbackIds) {
    const fslug = CANONICAL_ID_TO_SLUG[fid];
    if (!fslug || seen.has(fslug)) continue;
    seen.add(fslug);
    out.push(fslug);
  }
  return out;
}
