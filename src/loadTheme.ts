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
  return { manifest, baseUrl, ...(opts.base ? { base: opts.base } : {}) };
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
