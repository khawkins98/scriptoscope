// Subscribe an AaronWindow's DOM to the active theme: applies the current
// theme on attach (if any), re-applies on every theme change, clears on
// detach. Returns a teardown function.
//
// This is the consumer-friendly bridge between AaronWindow and the theme
// runtime. AaronWindow itself doesn't import the runtime; consumers wire
// it up explicitly:
//
//   const win = new AaronWindow({ title: 'Hi', oncreate() {
//     attachThemeToWindow(this.element!);
//   }});

import type { Theme } from '../schema/types.js';
import {
  applyChromeFromTheme,
  clearChromeFromTheme,
  type ApplyChromeFromThemeOptions,
} from './applyChromeFromTheme.js';
import { themeRegistry } from './ThemeRegistry.js';

export interface AttachThemeToWindowOptions extends ApplyChromeFromThemeOptions {
  /**
   * Whether to apply the current theme immediately on attach. Default true.
   * Set false if you'll trigger the first apply manually (e.g., to delay
   * until layout is stable).
   */
  applyOnAttach?: boolean;
}

/**
 * Subscribe `windowEl` to the active theme.
 *
 * - If a theme is currently loaded and `applyOnAttach !== false`, applies it.
 * - On every subsequent theme change, re-applies the new theme.
 * - On detach (the returned teardown), unsubscribes and clears the chrome.
 *
 * @returns A teardown function. Always call this when the window is
 *          unmounted to prevent leaks of the theme subscription.
 */
export function attachThemeToWindow(
  windowEl: HTMLElement,
  options: AttachThemeToWindowOptions = {},
): () => void {
  const { applyOnAttach = true, ...applyOpts } = options;

  const apply = (theme: Theme | null) => {
    if (theme) {
      try {
        applyChromeFromTheme(windowEl, theme, applyOpts);
      } catch {
        // Theme doesn't define a usable chrome for this window — leave the
        // window un-themed (engine-baseline rendering) rather than throw.
        // Common case: theme has chromeElements but no windowTypes match
        // the slug. Caller can opt into stricter behaviour by calling
        // applyChromeFromTheme directly.
        clearChromeFromTheme(windowEl);
      }
    } else {
      clearChromeFromTheme(windowEl);
    }
  };

  if (applyOnAttach) apply(themeRegistry.current());
  const unsubscribe = themeRegistry.subscribe(apply);

  return () => {
    unsubscribe();
    clearChromeFromTheme(windowEl);
  };
}
