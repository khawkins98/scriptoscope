import type { LoadedTheme, ChromeElement } from './types.js';
import { loadKaleidoscopeScheme } from '../tools/theme-loader/loadKaleidoscopeScheme.js';

/**
 * The shape of `themes/<slug>/meta.json` — author + provenance metadata
 * for a bundle. Surfaces on `LoadedTheme.manifest.meta`. Fields are
 * loose (consumers may extend with their own keys via the catch-all);
 * the named ones are what the loader and the inspector actually read.
 *
 * Lib reviewer P2 2026-05-30: previously typed as `Record<string, unknown>`
 * on the `opts.meta` short-circuit path, which gave consumers no IDE
 * autocomplete for the canonical fields and no warning if they passed
 * something the manifest never reads.
 */
export interface ThemeMeta {
  /** Display name. Falls back to slug. */
  name?: string;
  /** Author / origin attribution. */
  author?: { name?: string; year?: number };
  /** Provenance — where the bundle came from, what it was, original license. */
  origin?: {
    kind?: 'kaleidoscope-port' | 'platinum-replica' | string;
    originalFormat?: string;
    originalSchemeId?: number;
    originalLicense?: string;
    sourceUrl?: string;
    sourceArchive?: string;
  };
  /** Consumers can attach their own keys (display tags, internal ids). */
  [extra: string]: unknown;
}

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
  opts: { base?: LoadedTheme; source?: string; meta?: ThemeMeta } = {},
): Promise<LoadedTheme> {
  const baseUrl = bundleUrl.replace(/\/$/, '');

  // Try the StuffIt archive first (the original `.sit` the author published — the
  // most palatable redistribution form: nothing decompressed by us). Fall back to
  // the raw resource fork (the unwrapped form some bundles ship when the upstream
  // .sit is no longer reachable, e.g. wayback-recovered schemes). loadKaleidoscopeScheme
  // unwraps both — `.sit` lazy-loads the WASM decoder, `.rsrc` skips it.
  //
  // `opts.source` is a hint from the consumer (e.g. the demo reads it off
  // themes-manifest.json) — when present, we skip the cascade and fetch that file
  // directly. Avoids the dev-console 404 noise on bundles whose first-try is missing.
  const candidates = opts.source ? [opts.source] : ['scheme.sit', 'scheme.rsrc'];
  const fileBytes = await fetchFirst(baseUrl, candidates);
  if (!fileBytes) {
    throw new Error(`loadTheme: ${baseUrl} — no ${candidates.join(' or ')} found`);
  }

  // meta.json: consumer can pass `opts.meta` (the resolver does this when a
  // ThemeEntry has the data already on disk via themes-manifest.json,
  // avoiding a ~660ms wasted round-trip per theme — perf finding 2026-05-30 P1).
  // Falls back to fetching `meta.json` directly when no hint is provided.
  // Missing is OK for a freshly-imported scheme that hasn't had its
  // provenance scaffolded yet.
  let meta: ThemeMeta = opts.meta ?? {};
  if (!opts.meta) {
    try {
      const metaRes = await fetch(`${baseUrl}/meta.json`);
      if (metaRes.ok) meta = await metaRes.json() as ThemeMeta;
    } catch { /* network error / not present — silently degrade */ }
  }

  const slug = baseUrl.split('/').filter(Boolean).pop() ?? 'theme';
  const loaded = await loadKaleidoscopeScheme(fileBytes.bytes, {
    meta: { name: meta.name ?? slug, ...meta },
    source: `${slug}/${fileBytes.filename}`,
  });

  // Preserve the bundle URL as the LoadedTheme's `baseUrl`. The decoder default is
  // `''` (asset refs are already blob: URLs — assetUrl() passes them through
  // unchanged), but consumers use `baseUrl` as an IDENTITY key for per-theme caches
  // (the demo's icon / desktop-pattern memoisation, the WindowManager's theme tag).
  // Leaving it `''` meant every theme shared the same key → the FIRST theme's icons
  // leaked into every other theme's Scene preview (the 1138-folders-in-1984 bug).
  return {
    ...loaded,
    baseUrl,
    ...(opts.base ? { base: opts.base } : {}),
  };
}

/** Race the candidate filenames; return the first one that responds 200 with bytes that
 *  look at least PLAUSIBLY like a Mac archive / resource fork. Falls back to trying them
 *  serially so a 404 → next-name cascade is deterministic.
 *
 *  The smell-test guards against a CDN configured with an SPA fallback that returns
 *  200 + HTML for a missing file. Without it, the HTML bytes would be consumed as a
 *  resource fork and explode deep in `parseResourceFork` with an opaque message; we'd
 *  never fall through to the `.rsrc` alternative. The check is cheap (the magic-byte
 *  detection in containers.js plus a string sniff for the HTML preamble). */
async function fetchFirst(
  baseUrl: string, filenames: string[],
): Promise<{ filename: string; bytes: Uint8Array } | null> {
  for (const filename of filenames) {
    try {
      const res = await fetch(`${baseUrl}/${filename}`);
      if (!res.ok) continue;
      const bytes = new Uint8Array(await res.arrayBuffer());
      if (looksLikeArchiveOrFork(bytes)) return { filename, bytes };
      // 200 but bytes don't smell like a binary archive — almost certainly an HTML SPA
      // fallback. Don't accept it; let the cascade continue to the next candidate.
    } catch { /* try the next candidate */ }
  }
  return null;
}

/** Cheap, hardcoded "is this plausibly a Mac archive or a resource fork?" check used
 *  by `fetchFirst` to recognise an SPA fallback / wrong-URL response. Covers all
 *  formats containers.js detects (StuffIt, MacBinary, AppleSingle/Double, BinHex) plus
 *  a positive sniff for "is this NOT an HTML/JSON/text document". Not an exhaustive
 *  validator — the real decoder is the source of truth — just enough to fall through. */
function looksLikeArchiveOrFork(b: Uint8Array): boolean {
  if (b.length < 16) return false;
  // Reject the unmistakable HTML preambles a misconfigured CDN serves.
  const head = String.fromCharCode(...b.subarray(0, Math.min(64, b.length))).toLowerCase();
  if (head.includes('<!doctype') || head.includes('<html') || head.startsWith('{')) return false;
  // Positive sniff for known containers / forks.
  // StuffIt: 'SIT!' / 'StuffIt' magic at offset 0.
  if (b[0] === 0x53 && b[1] === 0x49 && b[2] === 0x54 && b[3] === 0x21) return true; // 'SIT!'
  if (b[0] === 0x53 && b[1] === 0x74 && b[2] === 0x75 && b[3] === 0x66) return true; // 'Stuf'
  // MacBinary: byte 0 = 0x00, byte 1 = filename length (1..63), byte 74 = 0x00.
  if (b[0] === 0x00 && (b[1] ?? 0) >= 1 && (b[1] ?? 0) <= 63 && b.length > 128 && b[74] === 0x00) return true;
  // AppleSingle/Double: magic 0x00051600 (single) or 0x00051607 (double) at offset 0.
  if (b[0] === 0x00 && b[1] === 0x05 && b[2] === 0x16 && (b[3] === 0x00 || b[3] === 0x07)) return true;
  // BinHex: ASCII '(This file must be converted with BinHex…' preamble.
  if (head.startsWith('(this file must be converted')) return true;
  // Raw resource fork: a Mac resource fork header is { dataOffset, mapOffset, dataLen,
  // mapLen }, four big-endian u32 — usually with dataOffset=0x100 and small. Sanity-check
  // that dataOffset + dataLen fits within file length.
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const dataOffset = dv.getUint32(0); const mapOffset = dv.getUint32(4);
  const dataLength = dv.getUint32(8); const mapLength = dv.getUint32(12);
  if (dataOffset >= 16 && dataOffset + dataLength <= b.length
      && mapOffset >= 16 && mapOffset + mapLength <= b.length) return true;
  return false;
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

/** Look up the chromeElement whose `asset` matches a path or URL. Compares strings —
 *  works for both legacy relative paths (`cicns/cicn-….png`) and the in-memory blob:
 *  URLs (both `chromeElement.asset` AND a windowType's `chrome.active` get rewritten
 *  to the same blob URL when they reference the same resource, so string equality
 *  still resolves correctly). For id-based lookup, see `elementById` in controls.ts. */
export function findChromeElement(
  theme: LoadedTheme,
  assetRefOrUrl: string,
): ChromeElement | undefined {
  for (const el of Object.values(theme.manifest.chromeElements)) {
    if (el.asset === assetRefOrUrl) return el;
  }
  return undefined;
}
