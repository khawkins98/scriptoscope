// Fetch + validate + apply a theme bundle.
//
// loadTheme is the user-facing entry point. It does four things:
//   1. Fetches <bundleUrl>/theme.json.
//   2. Validates the JSON against the schema via parseTheme.
//   3. Resolves every relative asset path inside the bundle to an absolute URL
//      so downstream rendering doesn't need to know about bundle layout.
//   4. Hands the parsed Theme to ThemeRegistry.replace, which applies the
//      palette and broadcasts the change.
//
// The asset-URL resolution step is intentional: every chromeElement.asset,
// pattern.asset, and windowType.chrome.* value in the returned Theme is an
// absolute URL string. Downstream consumers (#40 cinf 9-slice, #41 ppat
// overlay, #42 wnd# part rects) reference these directly without re-deriving
// the bundle root.

import { parseTheme } from '../schema/parseTheme.js';
import type { Theme, WindowChromeStates } from '../schema/types.js';
import { themeRegistry } from './ThemeRegistry.js';

/**
 * Fetch a theme bundle, validate it, apply it, and return the parsed `Theme`.
 *
 * @param url Bundle root URL. The bundle's `theme.json` is fetched from
 *            `<url>/theme.json` (a trailing slash is implied). Asset paths
 *            inside the bundle are resolved relative to `<url>`.
 *
 * @example
 * await loadTheme('/themes/masswerk-7-le');
 * // → fetches /themes/masswerk-7-le/theme.json,
 *   applies palette, broadcasts aaron:themechange
 *
 * @throws Error            On HTTP error or invalid JSON.
 * @throws ThemeValidationError On schema violation.
 */
export async function loadTheme(url: string): Promise<Theme> {
  const bundleUrl = url.endsWith('/') ? url : `${url}/`;
  const themeJsonUrl = new URL('theme.json', resolveBaseUrl(bundleUrl)).toString();

  const res = await fetch(themeJsonUrl);
  if (!res.ok) {
    throw new Error(
      `loadTheme: failed to fetch ${themeJsonUrl} (${res.status} ${res.statusText})`,
    );
  }
  const json: unknown = await res.json();
  const parsed = parseTheme(json);
  const resolved = resolveAssetUrls(parsed, themeJsonUrl);

  themeRegistry.replace(resolved);
  return resolved;
}

/**
 * Return a new Theme whose asset paths are absolute URLs resolved against the
 * bundle's `theme.json` URL. Non-asset fields pass through unchanged.
 *
 * Pure function — exported for testability.
 */
export function resolveAssetUrls(theme: Theme, themeJsonUrl: string): Theme {
  const base = new URL(themeJsonUrl);
  const resolve = (assetPath: string) => new URL(assetPath, base).toString();

  const out: Theme = { ...theme };

  if (theme.chromeElements) {
    const resolved: Record<string, typeof theme.chromeElements[string]> = {};
    for (const [key, entry] of Object.entries(theme.chromeElements)) {
      resolved[key] = { ...entry, asset: resolve(entry.asset) };
    }
    out.chromeElements = resolved;
  }

  if (theme.patterns) {
    const resolved: Record<string, typeof theme.patterns[string]> = {};
    for (const [key, entry] of Object.entries(theme.patterns)) {
      resolved[key] = { ...entry, asset: resolve(entry.asset) };
    }
    out.patterns = resolved;
  }

  if (theme.windowTypes) {
    const resolved: Record<string, typeof theme.windowTypes[string]> = {};
    for (const [key, entry] of Object.entries(theme.windowTypes)) {
      const chrome: WindowChromeStates = {};
      for (const state of ['active', 'inactive', 'collapsed-active', 'collapsed-inactive'] as const) {
        const v = entry.chrome[state];
        if (v !== undefined) chrome[state] = resolve(v);
      }
      resolved[key] = { ...entry, chrome };
    }
    out.windowTypes = resolved;
  }

  if (theme.cursors) {
    const resolved: Record<string, typeof theme.cursors[string]> = {};
    for (const [key, entry] of Object.entries(theme.cursors)) {
      resolved[key] = { ...entry, asset: resolve(entry.asset) };
    }
    out.cursors = resolved;
  }

  return out;
}

/**
 * Resolve a possibly-relative bundle URL against the current document base.
 *
 * In a browser: relative URLs resolve against `document.baseURI`.
 * In jsdom (unit tests): `document.baseURI` defaults to `about:blank`, so we
 * fall back to `http://localhost/` to keep `new URL()` from throwing.
 * In Node-only contexts: callers are expected to pass an absolute URL.
 */
function resolveBaseUrl(bundleUrl: string): string {
  if (/^[a-z][a-z0-9+.-]*:/i.test(bundleUrl)) return bundleUrl;
  const base =
    typeof document !== 'undefined' && document.baseURI && document.baseURI !== 'about:blank'
      ? document.baseURI
      : 'http://localhost/';
  return new URL(bundleUrl, base).toString();
}
