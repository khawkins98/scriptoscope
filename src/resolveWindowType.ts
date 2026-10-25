import type { LoadedTheme, WindowType, WindowState } from './types.js';
import { canonicalWindowTypeSlug, cascadeFallbackSlugs, equivalentWindowTypeKeys, collapsedWindowTypeSlug } from './wndCascade.js';
import { resolveInChain } from './baseChain.js';

/** Exact/equivalent identities precede the source-derived mask cascade, then
 * existing heuristic fallbacks. Alias names are not missing resources. */
export function resolveWindowType(theme: Pick<LoadedTheme, 'manifest'>, slug: string): WindowType | undefined {
  const wts = theme.manifest.windowTypes ?? {};
  const ok = (k: string): WindowType | undefined => (wts[k] && looksLikeWindow(theme, wts[k]) ? wts[k] : undefined);
  for (const key of equivalentWindowTypeKeys(slug)) { const hit = ok(key); if (hit) return hit; }
  // Each historical fallback ID may itself be stored under a compatible key.
  for (const fallback of cascadeFallbackSlugs(slug)) {
    for (const key of equivalentWindowTypeKeys(fallback)) { const hit = ok(key); if (hit) return hit; }
  }
  slug = canonicalWindowTypeSlug(slug);

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
function looksLikeWindow(theme: Pick<LoadedTheme, 'manifest'>, wt: WindowType): boolean {
  const ch = wt.chrome?.active ?? wt.chrome?.inactive;
  if (!ch) return false;
  // A malformed pairing can point at a grow-box resource. Consult the author's
  // structured resource label, which survives URL rewriting, rather than its
  // encoded filename. Unlabelled resources retain the normal structural check.
  const element = Object.values(theme.manifest.chromeElements ?? {}).find((entry) => entry.asset === ch);
  if (/grow[ -]?box/i.test(element?.authorLabel ?? '')) return false;
  return !!wt.parts?.['part-0']?.rect;
}


/** The existing child-first render policy, shared by rendering and collapse.
 * A child heuristic selection still wins over an exact type in its base. */
export function resolveWindowSelection<Theme extends { manifest: LoadedTheme['manifest']; readonly base?: Theme | undefined }>(theme: Theme, slug: string, state: WindowState = 'active'):
  { owner: Theme; wt: WindowType; cicnPath: string } | undefined {
  return resolveInChain(theme, owner => {
    const wt = resolveWindowType(owner, slug);
    const cicnPath = wt ? (wt.chrome[state] ?? wt.chrome.active) : undefined;
    return wt && cicnPath ? { owner, wt, cicnPath } : null;
  });
}

/** Discover authored collapsed art only in the owner selected for the expanded
 * request. Corner-sprite windows need no sliced top-edge recipe. */
export function resolveCollapsedWindowTypeSlug<Theme extends { manifest: LoadedTheme['manifest']; readonly base?: Theme | undefined }>(theme: Theme, baseSlug: string, state: WindowState = 'active'): string | undefined {
  const selected = resolveWindowSelection(theme, baseSlug, state);
  if (!selected) return undefined;
  const { owner } = selected, wts = owner.manifest.windowTypes ?? {};
  const ok = (key: string): boolean => !!wts[key] && looksLikeWindow(owner, wts[key])
    && !!(wts[key].chrome[state] ?? wts[key].chrome.active);
  const noun = baseSlug.replace(/-window$/, '');
  const known = collapsedWindowTypeSlug(baseSlug);
  // Preserve exact custom naming before compatibility normalization.
  const candidates = [`collapsed-${baseSlug}`, `collapsed-${noun}`, ...(known ? equivalentWindowTypeKeys(known) : [])];
  for (const key of candidates) if (ok(key)) return key;
  for (const key of Object.keys(wts)) if (key.startsWith('collapsed') && key.includes(noun) && ok(key)) return key;
  return undefined;
}
