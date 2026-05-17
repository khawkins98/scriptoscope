// Bundled default theme: mass:werk's "7 Le" scheme.
//
// Per the 2026-05-17 Kaleidoscope-runtime pivot, Aaron UI does not
// hand-author a first-party Platinum default. Instead, mass:werk's
// freeware "7 Le" scheme is shipped *inside the npm package* (under
// themes/masswerk-7-le/) so `import 'aaron-ui'` renders Platinum-
// faithful chrome with no extra fetch URL the consumer has to wire up.
//
// Design call: theme.json + PNGs are SHIPPED as separate files in the
// package (not inlined into the JS bundle as data: URLs). Reasons:
//   - PNGs total ~564 KB for 7 Le. Inlining as base64 in JS would bloat
//     the bundle past PRD §Success criteria #5's "WM core + runtime
//     ≤30 KB gzipped" target.
//   - Most consumer bundlers (Vite, esbuild, webpack with their default
//     copy plugins) automatically resolve `import.meta.url`-anchored
//     paths and emit the referenced files in their dist.
//   - Worst case (no bundler asset copying): the consumer hosts
//     `themes/masswerk-7-le/` from their web server. One-time
//     deploy step, documented in README.
//
// The default URL is configurable for any of these cases. Consumers can
// `setBundledDefaultUrl('/static/themes/masswerk-7-le/')` before the
// auto-load fires to point at wherever they're hosting the assets.

import { loadTheme } from './loadTheme.js';
import { themeRegistry } from './ThemeRegistry.js';

/**
 * Slug for the bundled default theme. Pinned for clarity; refer to this
 * constant rather than the string literal anywhere it's checked.
 */
export const BUNDLED_DEFAULT_SLUG = 'masswerk-7-le' as const;

let bundledDefaultUrl = `themes/${BUNDLED_DEFAULT_SLUG}/`;
let autoLoadEnabled = false;
let autoLoadAttempted = false;

/**
 * Get the URL the bundled default theme is fetched from.
 *
 * Default: `'themes/masswerk-7-le/'` (relative to `document.baseURI`).
 * Override via {@link setBundledDefaultUrl} before the auto-load fires.
 */
export function getBundledDefaultUrl(): string {
  return bundledDefaultUrl;
}

/**
 * Override where the bundled default theme is fetched from. Useful when
 * the npm package's `themes/` dir is hosted at a non-default path on the
 * consumer's server (CDN, public/ subdir, etc.).
 *
 * Call this BEFORE the auto-load fires (i.e., before `enableBundledDefault`
 * is called, or before `DOMContentLoaded` in the main-entry side-effect path).
 */
export function setBundledDefaultUrl(url: string): void {
  bundledDefaultUrl = url;
}

/**
 * Fetch and apply the bundled default theme. Reuses {@link loadTheme} —
 * shares the same validation, asset-URL resolution, and palette
 * application. Returns the parsed Theme on success.
 *
 * Idempotent if you only care that *a* theme ends up loaded: callers can
 * invoke this directly without enabling the auto-load mechanism.
 */
export async function loadBundledDefault(): Promise<unknown> {
  return loadTheme(bundledDefaultUrl);
}

/**
 * Enable the auto-load mechanism: schedule {@link loadBundledDefault} to
 * fire once when the document is ready, *unless* a theme has already been
 * loaded explicitly. Safe to call multiple times (subsequent calls are
 * no-ops once the auto-load has been scheduled or fired).
 *
 * Called as a side-effect from the main `aaron-ui` entry. The
 * `aaron-ui/no-default` sub-entry does NOT call this — consumers who want
 * full control over theme loading should import from there.
 */
export function enableBundledDefault(): void {
  if (autoLoadEnabled) return;
  autoLoadEnabled = true;

  if (typeof document === 'undefined') return;

  const fire = () => {
    if (autoLoadAttempted) return;
    autoLoadAttempted = true;
    // Skip if the consumer already loaded a theme manually (or via
    // data-aaron-theme attribute, whichever path they prefer).
    if (themeRegistry.current() !== null) return;
    void loadBundledDefault().catch((err: unknown) => {
      // eslint-disable-next-line no-console
      console.warn(`[aaron-ui] bundled-default theme failed to load from ${bundledDefaultUrl}:`, err);
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fire, { once: true });
  } else {
    // Already past DCL — defer to the next microtask so consumer code
    // that runs immediately after `import 'aaron-ui'` gets a chance to
    // call setBundledDefaultUrl()/loadTheme() before auto-load fires.
    queueMicrotask(fire);
  }
}

/**
 * Internal test helper: reset the module-level state so tests can verify
 * the auto-load mechanism from a fresh state. Not exported from the
 * public package — only accessible via deep import from inside the repo.
 */
export function _resetBundledDefaultForTests(): void {
  bundledDefaultUrl = `themes/${BUNDLED_DEFAULT_SLUG}/`;
  autoLoadEnabled = false;
  autoLoadAttempted = false;
}
