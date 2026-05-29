import type { LoadedTheme, ChromeElement } from './types.js';
import { loadKaleidoscopeScheme } from '../tools/theme-loader/loadKaleidoscopeScheme.js';

/**
 * Fetch and decode a theme bundle. The bundle is a directory containing a
 * single source-of-truth file — `scheme.rsrc`, the original Kaleidoscope
 * scheme resource fork — alongside optional `meta.json` for author /
 * license / provenance metadata. The runtime decodes the resource fork
 * in-browser via the WASM-bound StuffIt + Kaleidoscope decoders; no
 * pre-extracted PNG assets need to be committed to the bundle. This is
 * the same path the demo's drop-zone uses; we just resolve the bytes
 * from a URL instead of a File.
 *
 * The previous pre-decoded model (`theme.json` + `cicns/*.png` + …)
 * was retired 2026-05-29 — committing derivative PNGs read awkwardly
 * for community authors whose redistribution terms specify "keep the
 * original archive intact." Now the bundle IS the original archive.
 */
export async function loadTheme(
  bundleUrl: string,
  opts: { base?: LoadedTheme } = {},
): Promise<LoadedTheme> {
  const baseUrl = bundleUrl.replace(/\/$/, '');

  // Fetch the resource fork bytes.
  const rsrcRes = await fetch(`${baseUrl}/scheme.rsrc`);
  if (!rsrcRes.ok) {
    throw new Error(`loadTheme: ${baseUrl}/scheme.rsrc → HTTP ${rsrcRes.status}`);
  }
  const rsrcBytes = new Uint8Array(await rsrcRes.arrayBuffer());

  // Fetch meta.json if present (author/license/provenance — merged into the
  // decoded manifest's `name` / `author` / `origin` fields). Missing is OK
  // for a freshly-imported scheme that hasn't had its provenance scaffolded.
  let meta: Record<string, unknown> = {};
  try {
    const metaRes = await fetch(`${baseUrl}/meta.json`);
    if (metaRes.ok) meta = await metaRes.json() as Record<string, unknown>;
  } catch { /* network error / not present — silently degrade */ }

  const slug = baseUrl.split('/').filter(Boolean).pop() ?? 'theme';
  const loaded = await loadKaleidoscopeScheme(rsrcBytes, {
    meta: { name: (meta.name as string) ?? slug, ...meta },
    source: `${slug}/scheme.rsrc`,
  });

  return {
    ...loaded,
    ...(opts.base ? { base: opts.base } : {}),
  };
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
