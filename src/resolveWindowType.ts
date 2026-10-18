import type { LoadedTheme, WindowType } from './types.js';
import { canonicalWindowTypeSlug, cascadeFallbackSlugs } from './wndCascade.js';

/**
 * Resolve a window type robustly across bundles. Some schemes use the
 * friendly slug (`document-window`); others (acid, evolution, big-blue)
 * key by raw resource id (`wnd--14336`). Try, in order: exact slug,
 * the period-faithful kDEF 2.3.1 fallback ladder (`src/wndCascade.ts` —
 * clean-room replay of the 12-step AND-mask cascade at `0x356c..0x367e`),
 * any key containing the slug's noun, the doc-window resource ids, then
 * the first window type that publishes a `part-0` body.
 *
 * The cascade sits BEFORE the heuristic noun/utility scans because it's the
 * binary's documented behaviour for "scheme doesn't ship this wnd# id";
 * the heuristics remain as catch-alls for off-canonical (author-custom or
 * raw-id-keyed) bundles the cascade doesn't cover.
 */
export function resolveWindowType(theme: LoadedTheme, slug: string): WindowType | undefined {
  const wts = theme.manifest.windowTypes ?? {};
  const ok = (k: string): WindowType | undefined => (wts[k] && looksLikeWindow(theme, wts[k]) ? wts[k] : undefined);
  if (wts[slug] && looksLikeWindow(theme, wts[slug])) return wts[slug];

  // kDEF 2.3.1 fallback ladder (the binary's wnd# id-degradation cascade).
  // For canonical slugs (`collapsed-side-floating-utility-window` etc.), this
  // walks the structurally compatible ids the kDEF would try next. Example impact:
  //   collapsed-side-floating-utility-window → side-floating-utility-window → titled-utility-window
  // This catches 16 of 18 corpus bundles' missing collapsed-* variants
  // (see docs/spec/kdef231-reference.md §3.4 cascade table).
  for (const fallback of cascadeFallbackSlugs(slug)) {
    const hit = ok(fallback);
    if (hit) return hit;
  }

  // Generic utility aliases use the canonical wnd# type identity established by
  // the decoder. Asset URLs are opaque transport handles (usually blob: URLs).
  // Keep the preference for titled, then other utility, then floating palettes,
  // and require a complete top recipe for the sliced compositor.
  if (/utility|mini|floating|palette/.test(slug)) {
    let best: WindowType | undefined;
    let bestScore = 0;
    let bestSegs = -1;
    for (const [k, v] of Object.entries(wts)) {
      const identity = canonicalWindowTypeSlug(k);
      if (/collapsed/.test(identity) || !v.edges?.top?.length || !v.parts?.['part-0']?.rect) continue;
      if (!v.chrome?.active || !looksLikeWindow(theme, v)) continue;
      const score = /titled-utility/.test(identity) ? 4 : /utility/.test(identity) ? 3 : /floating|palette/.test(identity) ? 2 : 0;
      if (score === 0) continue;
      const segs = v.edges.top.length;
      if (score > bestScore || (score === bestScore && segs > bestSegs)) { bestScore = score; bestSegs = segs; best = v; }
    }
    if (best) return best;
    // No dedicated utility chrome → a dialog/modal reads as a small window.
    for (const k of ['movable-modal', 'dialog', 'document-window']) { const w = ok(k); if (w) return w; }
  }

  const noun = slug.replace(/-window$/, '');
  for (const [k, v] of Object.entries(wts)) if (k.includes(noun) && looksLikeWindow(theme, v)) return v;

  // raw doc-window resource ids (-14336 inactive / -14335 active family)
  for (const id of ['document-window', 'wnd--14336', 'wnd--14335', 'wnd--14332', 'wnd--14331']) {
    const w = ok(id); if (w) return w;
  }
  for (const v of Object.values(wts)) if (looksLikeWindow(theme, v)) return v;
  return undefined; // nothing usable → caller renders the procedural default
}

/**
 * A window type usable for rendering: has a part-0 body and a chrome cicn
 * that's an actual window frame — NOT a grow-box cicn (some bundles mis-pair
 * a dialog/utility wnd# with the grow-box) and not an empty chrome map.
 */
function looksLikeWindow(theme: LoadedTheme, wt: WindowType): boolean {
  const ch = wt.chrome?.active ?? wt.chrome?.inactive;
  if (!ch) return false;
  // A malformed pairing can point at a grow-box resource. Consult the author's
  // structured resource label, which survives URL rewriting, rather than its
  // encoded filename. Unlabelled resources retain the normal structural check.
  const element = Object.values(theme.manifest.chromeElements ?? {}).find((entry) => entry.asset === ch);
  if (/grow[ -]?box/i.test(element?.authorLabel ?? '')) return false;
  return !!wt.parts?.['part-0']?.rect;
}

