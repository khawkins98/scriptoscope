// Theme bootstrap for the declarative layer. Ports the demo's `loadWithBase` into reusable code so
// a STANDALONE consumer (not just demo/index.html) gets the universal base chain — without changing
// `loadTheme`'s runtime contract. Each non-base theme is loaded with `apple-platinum-replica` as its
// base (cached, fetched once), so lightly-skinned schemes inherit the Platinum baseline.

import type { LoadedTheme } from '../types.js';
import { loadTheme } from '../loadTheme.js';
import { themeRefToUrl } from './parse.js';

export interface ThemeBootstrapOpts {
  /** Base dir the bundle slugs resolve under (a standalone consumer points this at its themes/). */
  themeBaseUrl?: string; // default '/themes'
  /** The universal base bundle every other theme inherits from. */
  baseSlug?: string; // default 'apple-platinum-replica'
}

export interface ThemeResolver {
  /** Load a theme by ref (slug or url), with the universal base wired in (cached). */
  load(ref: string): Promise<LoadedTheme>;
  /** Preload the bundled Charcoal faces so the first window paint doesn't flash a fallback font. */
  preloadFonts(): Promise<void>;
}

export function createThemeResolver(opts: ThemeBootstrapOpts = {}): ThemeResolver {
  const themeBaseUrl = opts.themeBaseUrl ?? '/themes';
  const baseSlug = opts.baseSlug ?? 'apple-platinum-replica';
  const baseUrl = themeRefToUrl(baseSlug, themeBaseUrl);
  const cache = new Map<string, Promise<LoadedTheme>>(); // keyed by resolved bundle URL

  const loadByUrl = (url: string): Promise<LoadedTheme> => {
    const cached = cache.get(url);
    if (cached) return cached;
    const p = (async (): Promise<LoadedTheme> => {
      const base = url === baseUrl ? undefined : await loadByUrl(baseUrl);
      return loadTheme(url, base ? { base } : {});
    })();
    cache.set(url, p);
    return p;
  };

  return {
    load: (ref) => loadByUrl(themeRefToUrl(ref, themeBaseUrl)),
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
