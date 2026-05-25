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
 * the decoded icon-family resources (`icl4`/`icl8` 32×32, `ics4`/`ics8` 16×16;
 * `size` distinguishes them, `depth` is 4 or 8).
 */
interface IconIndexEntry {
  id: number;
  type: 'icl4' | 'ics4' | 'icl8' | 'ics8';
  size?: number;
  file: string;
}

/**
 * Fetch a bundle's `icons/index.json` and build the GLYPH map (id-string →
 * `icons/<file>`) from the 16px pictograms — the scheme's OWN scroll-arrow /
 * checkbox / radio / window-widget glyphs that the renderer stamps instead of
 * fabricating. Keyed by the 16px family REGARDLESS of bit-depth: a scheme that
 * ships only 8-bit `ics8` (e.g. Black Platinum, 1990) maps its glyphs the same
 * as a 4-bit `ics4` scheme (the extractor already dedups so there's one 16px
 * entry per id). The 32px icl4/icl8 scene icons are read by the demo inventory.
 * Returns null when the bundle ships no glyphs, so `glyphs` stays absent.
 */
async function loadGlyphMap(baseUrl: string): Promise<Record<string, string> | null> {
  try {
    const res = await fetch(`${baseUrl}/icons/index.json`);
    if (!res.ok) return null;
    const index = (await res.json()) as IconIndexEntry[];
    const glyphs: Record<string, string> = {};
    for (const e of index) {
      if (e.size === 16 || e.type === 'ics4' || e.type === 'ics8') glyphs[String(e.id)] = `icons/${e.file}`;
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
