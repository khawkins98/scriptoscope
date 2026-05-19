// Generic cicn paint for "simply stretched" controls — spec B §3.4 +
// §4.14 (window headers) + §4.15 (placards).
//
// Many control families just stretch one cicn across the element with no
// slicing logic. Placards, window headers, menu backgrounds, popup-menu
// text/arrow sections all follow this pattern. This helper subscribes
// to themeRegistry + paints the right cicn for the current state.
//
// CSS strategy: `background-image: url(...)` + `background-size: 100% 100%`.
// (Not border-image — that's for 9-slice. Simply-stretched cicns paint
// edge-to-edge with proportional distortion, which is what K2 specifies
// for these families.)
//
// Mass:werk schemes (no exotic-control artwork) fall back to engine-
// baseline CSS via the [data-aaron-cicn-loaded] sentinel pattern.

import { themeRegistry } from './ThemeRegistry.js';
import type { Theme } from '../schema/types.js';

export type StretchedRuntimeState = 'active' | 'pressed' | 'inactive';

const CICN_LOADED_ATTR = 'data-aaron-cicn-loaded';

export interface AttachThemeToStretchedOptions {
  /** The element that receives the cicn background. */
  element: HTMLElement;
  /**
   * Slug map per runtime state. Lookups fall back to `active` when a
   * state-specific slug is missing.
   */
  slugs: Partial<Record<StretchedRuntimeState, string>>;
  /**
   * Optional state reader. Defaults to reading the element's
   * `data-state` + `disabled`/`aria-disabled` attrs. Override to source
   * state from a parent or related element.
   */
  readState?: () => StretchedRuntimeState;
  /**
   * MutationObserver target. Defaults to `element`. Use a parent when
   * state-bearing attrs live on a wrapper.
   */
  observeTarget?: HTMLElement;
}

/**
 * Paint a simply-stretched cicn onto an element. Re-paints on theme
 * change + state change. Returns a teardown function.
 */
export function attachThemeToStretched(opts: AttachThemeToStretchedOptions): () => void {
  const { element, slugs } = opts;
  const observeTarget = opts.observeTarget ?? element;
  const readState = opts.readState ?? (() => defaultReadState(element));

  const render = () => paint(themeRegistry.current(), element, slugs, readState());
  render();

  const unsubTheme = themeRegistry.subscribe(render);
  const observer = new MutationObserver(render);
  observer.observe(observeTarget, {
    attributes: true,
    attributeFilter: ['data-state', 'disabled', 'aria-disabled'],
  });

  return () => {
    unsubTheme();
    observer.disconnect();
    clear(element);
  };
}

// ─── Internals ─────────────────────────────────────────────────────────

function paint(
  theme: Theme | null,
  el: HTMLElement,
  slugs: Partial<Record<StretchedRuntimeState, string>>,
  state: StretchedRuntimeState,
): void {
  const catalog = theme?.chromeElements;
  if (!catalog) {
    clear(el);
    return;
  }
  // State-specific slug, falling back to active per spec B §9 chain.
  const slug = slugs[state] ?? slugs.active;
  const entry = slug ? catalog[slug] : undefined;
  if (!entry?.asset) {
    clear(el);
    return;
  }
  el.style.backgroundImage = `url("${entry.asset.replace(/"/g, '\\"')}")`;
  el.style.backgroundSize = '100% 100%';
  el.style.backgroundRepeat = 'no-repeat';
  el.style.imageRendering = 'pixelated';
  el.setAttribute(CICN_LOADED_ATTR, '');
}

function clear(el: HTMLElement): void {
  el.style.backgroundImage = '';
  el.style.backgroundSize = '';
  el.style.backgroundRepeat = '';
  el.style.imageRendering = '';
  el.removeAttribute(CICN_LOADED_ATTR);
}

function defaultReadState(el: HTMLElement): StretchedRuntimeState {
  if (
    (el as HTMLButtonElement).disabled === true ||
    el.getAttribute('aria-disabled') === 'true'
  ) {
    return 'inactive';
  }
  if (el.getAttribute('data-state') === 'pressed') return 'pressed';
  return 'active';
}
