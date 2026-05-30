// Theme bootstrap for the declarative layer. Loads themes from a base URL, caches them, and
// optionally wires a universal base bundle so lightly-skinned schemes inherit from it. By default
// NO base is wired — every theme loads standalone, and any missing chrome/control falls through
// to the procedural Platinum fallback in src/platinum.ts. A consumer can opt into a base by
// passing `baseSlug` (e.g. `'apple-platinum-2'`) if they want a specific scheme as the backstop.

import type { LoadedTheme } from '../types.js';
import { loadTheme } from '../loadTheme.js';
import { themeRefToUrl } from './parse.js';

/** Optional per-theme hints the consumer's manifest already knows. The
 *  resolver indexes these by slug so loadTheme can skip work it doesn't
 *  need to do (e.g. the .sit → .rsrc cascade for bundles where the
 *  consumer knows the source file already; the meta.json fetch for
 *  bundles where the consumer has the metadata). Mirror the shape of
 *  PickerThemeEntry — same object passes through both surfaces. */
export interface ThemeHint {
  slug: string;
  /** Which file in the bundle dir to fetch — `scheme.sit` or `scheme.rsrc`.
   *  When set, loadTheme skips the .sit→.rsrc fallback (saves a 580ms
   *  wasted 404 RTT per `.rsrc`-only theme; perf finding 2026-05-30 P1). */
  source?: string;
  /** Author + year — used to short-circuit the meta.json fetch (perf P1
   *  #2). When present, loadTheme skips the network call entirely. */
  name?: string;
  author?: string;
  year?: number;
}

export interface ThemeBootstrapOpts {
  /** Base dir the bundle slugs resolve under (a standalone consumer points this at its themes/). */
  themeBaseUrl?: string; // default '/themes'
  /** Optional universal base bundle every other theme inherits from. Default: none (themes load standalone). */
  baseSlug?: string;
  /** Optional per-theme hints (source file + cached metadata). The resolver
   *  indexes by slug; loadByUrl looks up the slug from the URL's last
   *  path segment. Without this, loadTheme falls back to its default
   *  cascade behavior. Typically passed as the same `themes` array as
   *  MountOptions.themes (the manifest). */
  themes?: readonly ThemeHint[];
}

export interface ThemeResolver {
  /** Load a theme by ref (slug or url), with the universal base wired in if configured (cached). */
  load(ref: string): Promise<LoadedTheme>;
  /** Pre-seed the cache with an already-loaded theme under a synthetic ref. Used by drop-zones:
   *  decode a `.sit`/`.rsrc` in the browser → call `register(ref, theme)` → subsequent `load(ref)`
   *  hits the cache without ever fetching. The ref doesn't need to correspond to a real URL.
   *  An existing entry under the same key is overwritten (drop-newer-wins). */
  register(ref: string, theme: LoadedTheme): void;
  /** Preload the bundled Charcoal faces so the first window paint doesn't flash a fallback font. */
  preloadFonts(): Promise<void>;
}

export function createThemeResolver(opts: ThemeBootstrapOpts = {}): ThemeResolver {
  const themeBaseUrl = opts.themeBaseUrl ?? '/themes';
  const baseSlug = opts.baseSlug; // undefined = no base
  const baseUrl = baseSlug ? themeRefToUrl(baseSlug, themeBaseUrl) : null;
  const cache = new Map<string, Promise<LoadedTheme>>(); // keyed by resolved bundle URL
  // Per-slug hint index from the consumer's manifest. Reads zero on the
  // happy path (loadTheme defaults work); reads on the slow path (.rsrc-
  // only themes, themes whose metadata is already on disk via manifest).
  const hintBySlug = new Map<string, ThemeHint>(
    (opts.themes ?? []).map((t) => [t.slug, t]),
  );
  // Recover the slug from a resolved URL — last path segment, trailing
  // slashes stripped. Works for both `/themes/1138` and `/themes/1138/`.
  const slugOfUrl = (url: string): string => url.replace(/\/+$/, '').split('/').pop() ?? '';

  const loadByUrl = (url: string): Promise<LoadedTheme> => {
    const cached = cache.get(url);
    if (cached) return cached;
    const p = (async (): Promise<LoadedTheme> => {
      const base = (baseUrl && url !== baseUrl) ? await loadByUrl(baseUrl) : undefined;
      // Look up per-slug hints (source file, cached meta) — these let
      // loadTheme skip wasted RTT for .rsrc-only bundles + skip the
      // redundant meta.json fetch when the manifest already has the data.
      const hint = hintBySlug.get(slugOfUrl(url));
      const loadOpts: Parameters<typeof loadTheme>[1] = {};
      if (base) loadOpts.base = base;
      if (hint?.source) loadOpts.source = hint.source;
      if (hint?.name) loadOpts.meta = { name: hint.name, ...(hint.author ? { author: { name: hint.author, ...(hint.year ? { year: hint.year } : {}) } } : {}) };
      return loadTheme(url, loadOpts);
    })();
    cache.set(url, p);
    return p;
  };

  return {
    load: (ref) => loadByUrl(themeRefToUrl(ref, themeBaseUrl)),
    register: (ref, theme) => { cache.set(themeRefToUrl(ref, themeBaseUrl), Promise.resolve(theme)); },
    preloadFonts,
  };
}

async function preloadFonts(): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts?.load) return;
  await Promise.all([
    document.fonts.load('16px "Charcoal 12"').catch(() => undefined),
    document.fonts.load('13px Charcoal').catch(() => undefined),
    document.fonts.load('11px Charcoal').catch(() => undefined),
  ]);
}
