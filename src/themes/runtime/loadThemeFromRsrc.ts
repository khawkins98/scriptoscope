// Bridge between the pure-JS loader (src/themes/loader/) and the
// runtime registry. Fetches a scheme.rsrc + optional meta.json, decodes
// via loadKaleidoscopeScheme, publishes to the registry.
//
// This is the "Phase 3" entry point — what the demo + apps call instead
// of loadTheme(bundleUrl). The build-time theme.json bundle becomes
// optional (a cache); the .rsrc is the source of truth.

import type { Theme } from '../schema/types.js';
// @ts-expect-error — loader is .js (pure browser-portable); .d.ts not generated
import { loadKaleidoscopeScheme } from '../loader/loadKaleidoscopeScheme.js';
import { resolveAssetUrls } from './loadTheme.js';
import { themeRegistry } from './ThemeRegistry.js';

export interface LoadThemeFromRsrcOptions {
  /**
   * Optional metadata to merge into the decoded theme (name, author,
   * origin). If omitted, the loader will try `<bundleUrl>/meta.json`
   * as a sibling fetch — same convention as the build-time bundle.
   */
  meta?: {
    name?: string;
    author?: { name?: string; email?: string; url?: string; year?: number };
    origin?: { kind?: string; originalFormat?: string; originalLicense?: string; sourceUrl?: string };
  };
  /**
   * Publish to themeRegistry on success (so subscribers re-render).
   * Default true. Set false for one-shot decode (e.g., gallery preview).
   */
  publishToRegistry?: boolean;
}

/**
 * Load a Kaleidoscope scheme from a `scheme.rsrc` URL at runtime.
 *
 * @param rsrcUrl   URL to the resource fork bytes
 * @param metaUrl   Optional URL to a meta.json sibling (provenance/palette).
 *                  Defaults to the rsrc URL's directory + 'meta.json'.
 * @param options   See LoadThemeFromRsrcOptions
 */
export async function loadThemeFromRsrc(
  rsrcUrl: string,
  metaUrl?: string,
  options: LoadThemeFromRsrcOptions = {},
): Promise<Theme> {
  // Default metaUrl: sibling 'meta.json' next to the .rsrc.
  const resolvedMetaUrl = metaUrl ?? new URL('meta.json', new URL(rsrcUrl, location.href)).toString();
  let meta = options.meta;
  if (!meta) {
    try {
      const res = await fetch(resolvedMetaUrl);
      if (res.ok) meta = await res.json();
    } catch {
      // No meta.json — proceed with empty meta. The binary doesn't
      // carry author info; consumer is responsible if they care.
    }
  }

  const theme = (await loadKaleidoscopeScheme(rsrcUrl, {
    meta: meta ?? {},
  })) as Theme;

  // The loader stamps relative asset paths (or blob URLs in browser).
  // For consistency with loadTheme(bundleUrl), resolve any relative
  // ones against the rsrc URL's directory.
  const resolved = resolveAssetUrls(theme, rsrcUrl);

  if (options.publishToRegistry !== false) {
    themeRegistry.replace(resolved);
  }
  return resolved;
}
