// Declarative theme switching via `<html data-aaron-theme="...">`.
//
// Install a MutationObserver on `<html>` that calls loadTheme() whenever
// the data-aaron-theme attribute changes. Pairs with PRD §Theme system's
// declarative integration pattern: a consumer can swap themes from
// markup or by setting the attribute via any framework.

import { loadTheme } from './loadTheme.js';

const ATTR = 'data-aaron-theme' as const;

export interface EnableThemeSwitchingOptions {
  /**
   * If the attribute is already set when this is called, load it
   * immediately. Default true.
   */
  loadInitial?: boolean;
  /**
   * Callback for fetch / schema-validation errors during attribute-driven
   * loads. Defaults to console.warn. Set to a no-op to silence.
   */
  onError?: (err: unknown, themeUrl: string) => void;
}

/**
 * Start watching `<html data-aaron-theme>` for changes. Every new value
 * triggers `loadTheme(value)`. Returns a teardown function.
 *
 * The observer ignores the attribute being cleared (`removeAttribute` /
 * empty string) — to unload, the consumer should call
 * `themeRegistry.replace(null)` directly. This avoids two-step swaps
 * accidentally flashing un-themed state.
 *
 * Safe to call multiple times: each call returns its own teardown, but the
 * MutationObserver instances all watch the same attribute and fire
 * independently. Prefer calling once at app init.
 */
export function enableThemeSwitching(
  options: EnableThemeSwitchingOptions = {},
): () => void {
  const { loadInitial = true, onError = defaultOnError } = options;
  if (typeof document === 'undefined') {
    // Non-browser environment (Node SSR, etc.) — no-op + safe teardown.
    return () => {};
  }

  const html = document.documentElement;

  const load = (themeUrl: string) => {
    void loadTheme(themeUrl).catch((err: unknown) => onError(err, themeUrl));
  };

  if (loadInitial) {
    const initial = html.getAttribute(ATTR);
    if (initial) load(initial);
  }

  const observer = new MutationObserver((records) => {
    for (const r of records) {
      if (r.type !== 'attributes' || r.attributeName !== ATTR) continue;
      const next = html.getAttribute(ATTR);
      if (next) load(next);
    }
  });
  observer.observe(html, { attributes: true, attributeFilter: [ATTR] });

  return () => observer.disconnect();
}

function defaultOnError(err: unknown, themeUrl: string): void {
  // eslint-disable-next-line no-console
  console.warn(`[aaron-ui] theme switch failed for ${themeUrl}:`, err);
}
