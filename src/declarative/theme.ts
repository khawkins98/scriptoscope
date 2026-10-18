// Theme bootstrap for the declarative layer. Loads themes from a base URL, caches them, and
// optionally wires a universal base bundle so lightly-skinned schemes inherit from it. By default
// NO base is wired — every theme loads standalone, and any missing chrome/control falls through
// to the procedural Platinum fallback in src/platinum.ts. A consumer can opt into a base by
// passing `baseSlug` (e.g. `'apple-platinum-2'`) if they want a specific scheme as the backstop.

import type { LoadedTheme } from '../types.js';
import { loadTheme, type ThemeMeta } from '../loadTheme.js';
import { themeRefToUrl } from './parse.js';

/** One theme as both the picker and the loader need it. Single source of
 *  truth for the consumer-facing manifest shape — the same object passes
 *  through `MountOptions.themes` (where it drives picker tiles AND seeds
 *  loader hints). Lib reviewer P1 convergence 2026-05-30: the previous
 *  ThemeHint (loader-side) and PickerThemeEntry (picker-side) types were
 *  the same shape minus their `source`/`label` extras; consumers passing
 *  the manifest got no TS warning for omitting `source` and silently
 *  paid the 580ms wasted `.rsrc` 404 RTT. Aliased below so any consumer
 *  with `import type { ThemeHint }` or `import type { PickerThemeEntry }`
 *  still compiles. */
export interface ThemeEntry {
  /** Bundle directory slug — `themes/<slug>/` resolves from this. */
  slug: string;
  /** Display name — used by picker tiles. Falls back to a `label` parse,
   *  then to slug. */
  name?: string;
  /** Display author/origin attribution — picker tile subtitle. */
  author?: string;
  /** Release year — picker tile subtitle suffix. */
  year?: number;
  /** Which file in the bundle dir to fetch — `scheme.sit` or `scheme.rsrc`.
   *  When set, loadTheme skips the .sit→.rsrc fallback (saves a 580ms
   *  wasted 404 RTT per `.rsrc`-only theme; perf finding 2026-05-30 P1). */
  source?: string;
  /** Picker-side back-compat: pre-name/author/year manifests stored a
   *  single combined `label`. The picker parses it if `name` is absent.
   *  New consumers should use `name` + `author` + `year` directly. */
  label?: string;
  /** Complete cached meta.json, including origin/license. Display name/author/year
   * alone are picker labels and do not replace the provenance sidecar. */
  meta?: ThemeMeta;
}

/** @deprecated 2026-05-30 — use {@link ThemeEntry}. Kept as a type alias
 *  so `import type { ThemeHint }` still resolves; removable on the next
 *  consumer-API sweep. */
export type ThemeHint = ThemeEntry;

export interface ThemeBootstrapOpts {
  /** Base dir the bundle slugs resolve under (a standalone consumer points this at its themes/). */
  themeBaseUrl?: string; // default '/themes'
  /** Optional universal base bundle every other theme inherits from. Default: none (themes load standalone). */
  baseSlug?: string;
  /** Optional per-theme hints (source file + optional complete metadata). The resolver
   *  indexes by slug; loadByUrl looks up the slug from the URL's last
   *  path segment. Without this, loadTheme falls back to its default
   *  cascade behavior. Typically passed as the same `themes` array as
   *  MountOptions.themes (the manifest). */
  themes?: readonly ThemeEntry[];
}

export interface ThemeResolver {
  /** Load a theme by ref (slug or url), with the universal base wired in if configured (cached). */
  load(ref: string): Promise<LoadedTheme>;
  /** Pre-seed the cache with an already-loaded theme under a synthetic ref. Used by drop-zones:
   *  decode a `.sit`/`.rsrc` in the browser → call `register(ref, theme)` → subsequent `load(ref)`
   *  hits the cache without ever fetching. The ref doesn't need to correspond to a real URL.
   *  An existing entry under the same key is overwritten (drop-newer-wins). */
  register(ref: string, theme: LoadedTheme): void;
  /** Release only internally loaded themes. Registered themes and their base
   * chains are borrowed. Idempotent; subsequent load/register calls fail and
   * pending loads clean up their own results before rejecting. */
  dispose(): void;
  /** Preload the bundled Charcoal faces so the first window paint doesn't flash a fallback font. */
  preloadFonts(): Promise<void>;
}

export function createThemeResolver(opts: ThemeBootstrapOpts = {}): ThemeResolver {
  const themeBaseUrl = opts.themeBaseUrl ?? '/themes';
  const baseSlug = opts.baseSlug; // undefined = no base
  const baseUrl = baseSlug ? themeRefToUrl(baseSlug, themeBaseUrl) : null;
  const cache = new Map<string, Promise<LoadedTheme>>(); // keyed by resolved bundle URL
  const owned = new Set<LoadedTheme>();
  const borrowed = new WeakSet<LoadedTheme>();
  let disposed = false;
  const disposedError = () => new Error('ThemeResolver: disposed');
  // Registration borrows the whole graph, including a base that this resolver
  // previously loaded. The caller may keep rendering it after this mount ends.
  const borrowChain = (theme: LoadedTheme): void => {
    const seen = new Set<LoadedTheme>();
    for (let t: LoadedTheme | undefined = theme; t && !seen.has(t); t = t.base) {
      seen.add(t);
      borrowed.add(t);
      owned.delete(t);
    }
  };
  // Display labels do not contain provenance. Only explicit complete `meta`
  // substitutes for meta.json; source hints still avoid archive fallback RTT.
  const hintBySlug = new Map<string, ThemeEntry>(
    (opts.themes ?? []).map((t) => [t.slug, t]),
  );
  // Recover the slug from a resolved URL — last path segment, trailing
  // slashes stripped. Works for both `/themes/1138` and `/themes/1138/`.
  const slugOfUrl = (url: string): string => url.replace(/\/+$/, '').split('/').pop() ?? '';

  const loadByUrl = (url: string): Promise<LoadedTheme> => {
    if (disposed) return Promise.reject(disposedError());
    const cached = cache.get(url);
    if (cached) return cached;
    const p = (async (): Promise<LoadedTheme> => {
      const base = (baseUrl && url !== baseUrl) ? await loadByUrl(baseUrl) : undefined;
      if (disposed) throw disposedError();
      // Source hints and complete sidecars are independent of picker labels.
      const hint = hintBySlug.get(slugOfUrl(url));
      const loadOpts: Parameters<typeof loadTheme>[1] = {};
      if (base) loadOpts.base = base;
      if (hint?.source) loadOpts.source = hint.source;
      if (hint?.meta) loadOpts.meta = hint.meta;
      const theme = await loadTheme(url, loadOpts);
      if (disposed) {
        if (!borrowed.has(theme)) theme.dispose?.();
        throw disposedError();
      }
      if (!borrowed.has(theme)) owned.add(theme);
      return theme;
    })().catch((error: unknown) => {
      // A later register() may already have replaced this failed attempt.
      if (cache.get(url) === p) cache.delete(url);
      throw error;
    });
    cache.set(url, p);
    return p;
  };

  return {
    load: (ref) => loadByUrl(themeRefToUrl(ref, themeBaseUrl)),
    register: (ref, theme) => {
      if (disposed) throw disposedError();
      borrowChain(theme);
      cache.set(themeRefToUrl(ref, themeBaseUrl), Promise.resolve(theme));
    },
    dispose: () => {
      if (disposed) return;
      disposed = true;
      cache.clear();
      for (const theme of owned) theme.dispose?.();
      owned.clear();
    },
    preloadFonts: () => disposed ? Promise.reject(disposedError()) : preloadFonts(),
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
