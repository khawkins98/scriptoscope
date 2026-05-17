// Module-level singleton holding the currently-loaded theme and broadcasting
// theme-change events. Matches the WindowManager pattern from Phase 1.
//
// The registry is the one place that mutates :root CSS custom properties for
// the palette — every replace() cleans the previous theme's keys first, so
// theme swaps don't leak --aaron-colr-* vars from the prior scheme.

import type { Theme } from '../schema/types.js';

/**
 * Event dispatched on `document` whenever the active theme changes (including
 * to `null` on `replace(null)`). Bubbles, not cancelable.
 */
export const THEME_CHANGE_EVENT = 'aaron:themechange' as const;

export interface ThemeChangeEventDetail {
  /** New active theme; `null` when the theme has been unloaded. */
  theme: Theme | null;
}

export type ThemeChangeListener = (theme: Theme | null) => void;

class ThemeRegistryImpl {
  #currentTheme: Theme | null = null;
  #currentPaletteKeys: string[] = [];
  #listeners = new Set<ThemeChangeListener>();

  /** The active theme, or `null` if none has been loaded. */
  current(): Theme | null {
    return this.#currentTheme;
  }

  /**
   * Apply a theme as the new active theme. Pass `null` to unload.
   *
   * - Clears all `--aaron-colr-*` custom properties set by the prior theme.
   * - Applies the new theme's `palette` entries (if any) to `:root` as
   *   `--aaron-colr-<key>` custom properties.
   * - Dispatches an {@link THEME_CHANGE_EVENT} on `document`.
   * - Invokes every subscribed listener.
   *
   * Idempotent: calling with the same theme reference re-applies the palette
   * and re-emits the event. Useful after manual DOM resets in tests.
   */
  replace(theme: Theme | null): void {
    // 1. Clear previous palette so theme swaps don't leak vars.
    if (typeof document !== 'undefined') {
      for (const key of this.#currentPaletteKeys) {
        document.documentElement.style.removeProperty(`--aaron-colr-${key}`);
      }
    }
    this.#currentPaletteKeys = [];

    this.#currentTheme = theme;

    // 2. Apply new palette.
    if (theme?.palette && typeof document !== 'undefined') {
      for (const [key, value] of Object.entries(theme.palette)) {
        document.documentElement.style.setProperty(`--aaron-colr-${key}`, value);
        this.#currentPaletteKeys.push(key);
      }
    }

    // 3. Broadcast.
    if (typeof document !== 'undefined') {
      const detail: ThemeChangeEventDetail = { theme };
      document.dispatchEvent(
        new CustomEvent(THEME_CHANGE_EVENT, { bubbles: true, detail }),
      );
    }
    for (const listener of this.#listeners) {
      listener(theme);
    }
  }

  /**
   * Subscribe to theme-change notifications. Returns an unsubscribe function.
   * The listener fires synchronously inside {@link replace} after the palette
   * has been applied and the DOM event dispatched.
   */
  subscribe(listener: ThemeChangeListener): () => void {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  }

  /**
   * Test-only: clear the registry to its initial state. Listeners are
   * dropped *before* the final `replace(null)` so the teardown doesn't
   * call into the listeners that are about to be unsubscribed.
   */
  reset(): void {
    this.#listeners.clear();
    this.replace(null);
  }
}

/**
 * The singleton theme registry. All runtime code uses this instance; tests
 * can call `themeRegistry.reset()` between cases.
 */
export const themeRegistry = new ThemeRegistryImpl();

export type ThemeRegistry = ThemeRegistryImpl;
