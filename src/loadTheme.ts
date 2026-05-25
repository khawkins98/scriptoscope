import type { LoadedTheme, ThemeManifest, ChromeElement } from './types.js';

/**
 * Fetch a theme bundle's `theme.json` from `bundleUrl` (a directory URL
 * like `/themes/masswerk-7-le`). Asset paths inside the manifest are
 * relative to that directory; resolve them with {@link assetUrl}.
 */
export async function loadTheme(
  bundleUrl: string,
  opts: { base?: LoadedTheme } = {},
): Promise<LoadedTheme> {
  const baseUrl = bundleUrl.replace(/\/$/, '');
  const res = await fetch(`${baseUrl}/theme.json`);
  if (!res.ok) {
    throw new Error(`loadTheme: ${baseUrl}/theme.json → HTTP ${res.status}`);
  }
  const manifest = (await res.json()) as ThemeManifest;
  const glyphs = await loadGlyphMap(baseUrl);
  return {
    manifest,
    baseUrl,
    ...(glyphs ? { glyphs } : {}),
    ...(opts.base ? { base: opts.base } : {}),
  };
}

/**
 * One entry of a bundle's `icons/index.json` (written by extract-icons.mjs):
 * the decoded icon-family resources (`icl4` 32×32 / `ics4` 16×16).
 */
interface IconIndexEntry {
  id: number;
  type: 'icl4' | 'ics4';
  file: string;
}

/**
 * Fetch a bundle's `icons/index.json` and build the `ics4` GLYPH map
 * (id-string → `icons/<file>`). These are the scheme's OWN pictograms —
 * scroll-arrow buttons, window-corner proxies — that the renderer can stamp
 * instead of fabricating. icl4 entries are the larger scene icons (the demo
 * inventory already reads those straight from the index), so only ics4 is
 * mapped here. Returns null when the bundle ships no icons (most baseline
 * schemes), so `glyphs` stays absent rather than an empty object.
 */
async function loadGlyphMap(baseUrl: string): Promise<Record<string, string> | null> {
  try {
    const res = await fetch(`${baseUrl}/icons/index.json`);
    if (!res.ok) return null;
    const index = (await res.json()) as IconIndexEntry[];
    const glyphs: Record<string, string> = {};
    for (const e of index) {
      if (e.type === 'ics4') glyphs[String(e.id)] = `icons/${e.file}`;
    }
    return Object.keys(glyphs).length ? glyphs : null;
  } catch {
    return null; // no icons index (offline / not extracted) → no glyphs
  }
}

/** Resolve a manifest-relative asset path to a fetchable URL. */
export function assetUrl(theme: LoadedTheme, relativePath: string): string {
  return `${theme.baseUrl}/${relativePath}`;
}

/** Look up the chromeElement whose `asset` matches a relative path. */
export function findChromeElement(
  theme: LoadedTheme,
  relativePath: string,
): ChromeElement | undefined {
  for (const el of Object.values(theme.manifest.chromeElements)) {
    if (el.asset === relativePath) return el;
  }
  return undefined;
}
