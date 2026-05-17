// Phase 3.1 — shared infrastructure for in-window controls.
//
// Wraps the Phase 4 runtime's applyChromeElement (cinf 9-slice + ppat
// overlay primitive) with the universal state machine spec'd in
// docs/control-rendering-architecture.md §3:
//
//   Normal  ──pointerdown──> Pressed ──pointerup (within bounds)──> activate
//   Normal  ──focus(keyboard)──> Focused ──Space/Enter──> Pressed → activate
//   *       ──setEnabled(false)──> Disabled
//
// Per-control tickets (#71 onwards) all call this helper. They supply
// the state→chromeElements-slug map; the helper handles the rest.

import type { ChromeElementEntry, Theme } from '../schema/types.js';
import { applyChromeElement, clearChromeElement } from './applyChromeElement.js';
import { themeRegistry } from './ThemeRegistry.js';

/** Interaction state — the universal control state vocabulary. */
export type ControlState = 'normal' | 'pressed' | 'disabled' | 'focused';

/** Optional checked state for stateful controls (checkbox, radio). */
export type ControlCheckedState = 'unchecked' | 'checked' | 'mixed';

/**
 * Per-state chromeElements slug. The renderer looks up
 * `theme.chromeElements[slug]` for the current state's slug and applies
 * its cicn (with cinf + ppat) via applyChromeElement.
 *
 * `pressed` / `disabled` / `focused` fall back to `normal` if omitted.
 */
export interface StateChromeMap {
  normal: string;
  pressed?: string;
  disabled?: string;
  focused?: string;
}

export interface ApplyControlChromeOptions {
  /** Slugs for each interaction state. */
  stateChromeMap: StateChromeMap;
  /**
   * Optional second map for the checked state of stateful controls
   * (checkbox, radio). When set, `aria-checked="true"` flips the lookup
   * from `stateChromeMap` to this map.
   */
  checkedStateChromeMap?: StateChromeMap;
  /**
   * Whether this control responds to pointer events.
   * Default `true`. Set `false` for read-only controls (progress bar).
   */
  interactive?: boolean;
  /**
   * Whether to attach the pointer + keyboard state-machine listeners.
   * Default `true`. Set `false` if the caller wires its own handlers
   * (e.g., scrollbar arrow buttons that need long-press auto-repeat).
   */
  wireStateMachine?: boolean;
  /**
   * Override what happens on activate. Default:
   * `el.dispatchEvent(new Event('click', { bubbles: true }))`.
   * Useful for controls that should toggle state (checkbox) or open
   * something (popup) instead of just firing click.
   */
  onActivate?: (el: HTMLElement) => void;
}

/** Teardown function returned by `applyControlChrome`. Idempotent. */
export type TeardownFn = () => void;

export interface WireControlStateMachineOptions {
  /**
   * Called when the control should activate (click within bounds, or
   * Space/Enter key while focused). Default: dispatches `click` event.
   */
  onActivate?: (el: HTMLElement) => void;
}

/**
 * Wire the universal control state machine on an element WITHOUT applying
 * any cicn chrome rendering. Use this for CSS-drawn controls (push buttons,
 * group boxes) where the visual styling comes from CSS using palette custom
 * properties, not from per-state cicn artwork.
 *
 * For controls that DO have cicn artwork (checkbox, radio, popup, slider,
 * scrollbar), use `applyControlChrome` instead — it wires this state machine
 * AND renders the per-state cicn.
 *
 * Returns a teardown function.
 */
export function wireControlStateMachine(
  el: HTMLElement,
  options: WireControlStateMachineOptions = {},
): TeardownFn {
  const { onActivate = defaultActivate } = options;
  return wireInteractionStateMachine(el, () => onActivate(el));
}

/**
 * Apply themed chrome + interaction state machine to a control element.
 *
 * The element's chrome re-renders automatically when:
 *   - `data-state` attribute changes
 *   - `aria-checked` attribute changes (when `checkedStateChromeMap` is set)
 *   - `aria-disabled` attribute changes
 *   - The active theme changes (via `aaron:themechange`)
 *
 * Returns a teardown function that detaches listeners + clears chrome.
 * Always call teardown before removing the element from the DOM.
 */
export function applyControlChrome(
  el: HTMLElement,
  options: ApplyControlChromeOptions,
): TeardownFn {
  const {
    stateChromeMap,
    checkedStateChromeMap,
    interactive = true,
    wireStateMachine = true,
    onActivate = defaultActivate,
  } = options;

  // Initial state: derived from existing attributes (so re-application
  // doesn't reset state on a control that was already pressed/disabled).
  let currentState: ControlState = readStateFromDom(el);

  // ─── Renderer ─────────────────────────────────────────────────────
  const render = () => {
    const theme = themeRegistry.current();
    if (!theme) {
      // No theme loaded — clear any prior chrome so the control degrades
      // gracefully to the host page's default styling.
      clearChromeElement(el);
      return;
    }
    const map = isChecked(el) && checkedStateChromeMap
      ? checkedStateChromeMap
      : stateChromeMap;
    const slug = map[currentState] ?? map.normal;
    const entry = resolveChromeEntry(theme, slug);
    if (!entry) {
      // Slug not in catalog — clear so the element doesn't show stale
      // chrome from a previous theme.
      clearChromeElement(el);
      return;
    }
    applyChromeElement(el, entry, { theme });
  };
  render();

  // ─── Theme subscription ───────────────────────────────────────────
  const unsubscribeTheme = themeRegistry.subscribe(() => render());

  // ─── Attribute observer ───────────────────────────────────────────
  // data-state / aria-checked / aria-disabled changes trigger re-render.
  // MutationObserver is the cheapest way to do this without polling.
  const observer = new MutationObserver((records) => {
    let needsRender = false;
    for (const r of records) {
      if (
        r.attributeName === 'data-state' ||
        r.attributeName === 'aria-checked' ||
        r.attributeName === 'aria-disabled'
      ) {
        const newState = readStateFromDom(el);
        if (newState !== currentState) {
          currentState = newState;
          needsRender = true;
        } else if (r.attributeName === 'aria-checked' && checkedStateChromeMap) {
          // Checked toggled but interaction state didn't — still needs re-render.
          needsRender = true;
        }
      }
    }
    if (needsRender) render();
  });
  observer.observe(el, {
    attributes: true,
    attributeFilter: ['data-state', 'aria-checked', 'aria-disabled'],
  });

  // ─── State machine wiring ─────────────────────────────────────────
  const detachStateMachine = wireStateMachine && interactive
    ? wireInteractionStateMachine(el, () => onActivate(el))
    : () => {};

  // ─── Teardown ─────────────────────────────────────────────────────
  let torn = false;
  return () => {
    if (torn) return;
    torn = true;
    detachStateMachine();
    observer.disconnect();
    unsubscribeTheme();
    clearChromeElement(el);
  };
}

// ─── Internals ────────────────────────────────────────────────────

function defaultActivate(el: HTMLElement): void {
  el.dispatchEvent(new Event('click', { bubbles: true }));
}

function readStateFromDom(el: HTMLElement): ControlState {
  if (el.getAttribute('aria-disabled') === 'true') return 'disabled';
  const ds = el.getAttribute('data-state');
  if (ds === 'pressed' || ds === 'disabled' || ds === 'focused') return ds;
  return 'normal';
}

function isChecked(el: HTMLElement): boolean {
  return el.getAttribute('aria-checked') === 'true';
}

function resolveChromeEntry(theme: Theme, slug: string): ChromeElementEntry | null {
  return theme.chromeElements?.[slug] ?? null;
}

/**
 * Wire the pointer + keyboard state machine. Returns detach function.
 *
 * - `pointerdown` → set `data-state="pressed"` + capture pointer
 * - `pointerup` (within bounds) → fire activate + return to `normal`/`focused`
 * - `pointerup` (outside) → cancel + return to prior state
 * - `pointerleave` while pressed → cancel
 * - `Space` / `Enter` on focused → fire activate (no transient pressed
 *   visual; Mac OS 8 keyboard activation didn't show press-down)
 *
 * Disabled state suppresses all events (checked via `aria-disabled` at
 * dispatch time, so the runtime stays current).
 */
function wireInteractionStateMachine(el: HTMLElement, fire: () => void): TeardownFn {
  let pressed = false;
  let priorState: ControlState = 'normal';

  const onPointerDown = (e: PointerEvent) => {
    if (el.getAttribute('aria-disabled') === 'true') return;
    pressed = true;
    priorState = (el.getAttribute('data-state') as ControlState) ?? 'normal';
    el.setAttribute('data-state', 'pressed');
    try { el.setPointerCapture(e.pointerId); } catch { /* jsdom etc. */ }
  };

  const onPointerUp = (e: PointerEvent) => {
    if (!pressed) return;
    pressed = false;
    try { el.releasePointerCapture(e.pointerId); } catch { /* */ }
    // Check whether the pointer is still within the control's bounds.
    const rect = el.getBoundingClientRect();
    const within =
      e.clientX >= rect.left && e.clientX <= rect.right &&
      e.clientY >= rect.top && e.clientY <= rect.bottom;
    el.setAttribute('data-state', priorState);
    if (within && el.getAttribute('aria-disabled') !== 'true') {
      fire();
    }
  };

  const onPointerCancel = () => {
    if (!pressed) return;
    pressed = false;
    el.setAttribute('data-state', priorState);
  };

  const onPointerLeave = () => {
    if (!pressed) return;
    pressed = false;
    el.setAttribute('data-state', priorState);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (el.getAttribute('aria-disabled') === 'true') return;
    if (e.key !== ' ' && e.key !== 'Enter') return;
    e.preventDefault();
    fire();
  };

  const onFocus = () => {
    if (el.getAttribute('aria-disabled') === 'true') return;
    if (el.getAttribute('data-state') !== 'pressed') {
      el.setAttribute('data-state', 'focused');
    }
  };

  const onBlur = () => {
    if (el.getAttribute('data-state') === 'focused') {
      el.setAttribute('data-state', 'normal');
    }
  };

  el.addEventListener('pointerdown', onPointerDown);
  el.addEventListener('pointerup', onPointerUp);
  el.addEventListener('pointercancel', onPointerCancel);
  el.addEventListener('pointerleave', onPointerLeave);
  el.addEventListener('keydown', onKeyDown);
  el.addEventListener('focus', onFocus);
  el.addEventListener('blur', onBlur);

  return () => {
    el.removeEventListener('pointerdown', onPointerDown);
    el.removeEventListener('pointerup', onPointerUp);
    el.removeEventListener('pointercancel', onPointerCancel);
    el.removeEventListener('pointerleave', onPointerLeave);
    el.removeEventListener('keydown', onKeyDown);
    el.removeEventListener('focus', onFocus);
    el.removeEventListener('blur', onBlur);
  };
}
