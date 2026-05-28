// Theme bootstrap for the declarative layer. Loads themes from a base URL, caches them, and
// optionally wires a universal base bundle so lightly-skinned schemes inherit from it. By default
// NO base is wired — every theme loads standalone, and any missing chrome/control falls through
// to the procedural Platinum fallback in src/platinum.ts. A consumer can opt into a base by
// passing `baseSlug` (e.g. `'apple-platinum-2'`) if they want a specific scheme as the backstop.

import type { LoadedTheme } from '../types.js';
import { loadTheme } from '../loadTheme.js';
import { themeRefToUrl } from './parse.js';

export interface ThemeBootstrapOpts {
  /** Base dir the bundle slugs resolve under (a standalone consumer points this at its themes/). */
  themeBaseUrl?: string; // default '/themes'
  /** Optional universal base bundle every other theme inherits from. Default: none (themes load standalone). */
  baseSlug?: string;
}

export interface ThemeResolver {
  /** Load a theme by ref (slug or url), with the universal base wired in if configured (cached). */
  load(ref: string): Promise<LoadedTheme>;
  /** Preload the bundled Charcoal faces so the first window paint doesn't flash a fallback font. */
  preloadFonts(): Promise<void>;
}

export function createThemeResolver(opts: ThemeBootstrapOpts = {}): ThemeResolver {
  const themeBaseUrl = opts.themeBaseUrl ?? '/themes';
  const baseSlug = opts.baseSlug; // undefined = no base
  const baseUrl = baseSlug ? themeRefToUrl(baseSlug, themeBaseUrl) : null;
  const cache = new Map<string, Promise<LoadedTheme>>(); // keyed by resolved bundle URL

  const loadByUrl = (url: string): Promise<LoadedTheme> => {
    const cached = cache.get(url);
    if (cached) return cached;
    const p = (async (): Promise<LoadedTheme> => {
      const base = (baseUrl && url !== baseUrl) ? await loadByUrl(baseUrl) : undefined;
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
