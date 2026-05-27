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
  depth?: number;
  file: string;
}

/**
 * Fetch a bundle's `icons/index.json` and build the GLYPH map (id-string →
 * `icons/<file>`) from the 16px pictograms — the scheme's OWN scroll-arrow /
 * checkbox / radio / window-widget glyphs that the renderer stamps instead of
 * fabricating. Keyed by the 16px family REGARDLESS of bit-depth: a scheme that
 * ships only 8-bit `ics8` (e.g. Black Platinum, 1990) maps its glyphs the same
 * as a 4-bit `ics4` scheme. The extractor now emits EVERY depth a scheme ships
 * (so the gallery shows all assets); here we keep the HIGHEST depth per id for
 * rendering. The 32px icl4/icl8 scene icons are read by the demo inventory.
 * Returns null when the bundle ships no glyphs, so `glyphs` stays absent.
 */
async function loadGlyphMap(baseUrl: string): Promise<Record<string, string> | null> {
  try {
    const res = await fetch(`${baseUrl}/icons/index.json`);
    if (!res.ok) return null;
    const index = (await res.json()) as IconIndexEntry[];
    const glyphs: Record<string, string> = {};
    const depthAt: Record<string, number> = {};
    for (const e of index) {
      if (e.size !== 16 && e.type !== 'ics4' && e.type !== 'ics8') continue;
      const id = String(e.id);
      const d = e.depth ?? (e.type === 'ics8' ? 8 : 4); // prefer 8-bit over 4-bit at the same id
      if (d > (depthAt[id] ?? 0)) { glyphs[id] = `icons/${e.file}`; depthAt[id] = d; }
    }
    return Object.keys(glyphs).length ? glyphs : null;
  } catch {
    return null; // no icons index (offline / not extracted) → no glyphs
  }
}

/** Resolve a manifest asset ref to a fetchable URL. A ref that's ALREADY an absolute
 *  URL (`blob:`/`http(s):`/`data:`) passes through unchanged — that's how an IN-MEMORY
 *  theme works: `loadKaleidoscopeScheme` converts a dropped scheme and rewrites every
 *  asset ref (and glyph) to an OffscreenCanvas `blob:` URL, so the runtime renders it
 *  with no `baseUrl` fetch. A bundle-relative path is resolved against `baseUrl` as before. */
export function assetUrl(theme: LoadedTheme, relativePath: string): string {
  if (/^(?:blob:|https?:|data:)/.test(relativePath)) return relativePath;
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
