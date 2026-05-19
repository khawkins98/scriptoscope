// Cicn-driven chrome for checkboxes + radios — spec B §4.4 / §4.5.
//
// Many Kaleidoscope schemes ship cicn artwork for these controls in a
// 3-value × 3-state matrix (value: empty/checked/mixed; state: active/
// pressed/inactive). When the active theme has that artwork, paint it
// onto the chrome span; otherwise leave the engine-baseline CSS to
// render the control.
//
// The chrome span sits inside a <label>; both the label (for data-state)
// and the input (for checked) carry state. This helper observes both
// and re-paints the chrome span accordingly.
//
// Mixed state (3-state checkbox) is supported via aria-checked="mixed"
// on the input — falls back to the "mixed" cicn when present, else to
// the "checked" cicn.

import { themeRegistry } from './ThemeRegistry.js';
import type { Theme } from '../schema/types.js';

type Kind = 'checkbox' | 'radio';
type RuntimeState = 'active' | 'pressed' | 'inactive';
type CheckboxValue = 'empty' | 'checked' | 'mixed';
type RadioValue = 'off' | 'on' | 'mixed';

const CICN_LOADED_ATTR = 'data-aaron-cicn-loaded';

/**
 * Slug lookup table per spec B §4.4 (checkbox) + §4.5 (radio).
 * State semantics: active = enabled normal, pressed = mid-click,
 * inactive = disabled. Schemes use these exact tokens in their slugs.
 */
const CHECKBOX_SLUGS: Record<CheckboxValue, Record<RuntimeState, string>> = {
  empty:   { active: 'checkboxes-empty-active',   pressed: 'checkboxes-empty-pressed',   inactive: 'checkboxes-empty-inactive' },
  checked: { active: 'checkboxes-checked-active', pressed: 'checkboxes-checked-pressed', inactive: 'checkboxes-checked-inactive' },
  mixed:   { active: 'checkboxes-mixed-active',   pressed: 'checkboxes-mixed-pressed',   inactive: 'checkboxes-mixed-inactive' },
};
const RADIO_SLUGS: Record<RadioValue, Record<RuntimeState, string>> = {
  off:   { active: 'radio-buttons-off-active',   pressed: 'radio-buttons-off-pressed',   inactive: 'radio-buttons-off-inactive' },
  on:    { active: 'radio-buttons-on-active',    pressed: 'radio-buttons-on-pressed',    inactive: 'radio-buttons-on-inactive' },
  mixed: { active: 'radio-buttons-mixed-active', pressed: 'radio-buttons-mixed-pressed', inactive: 'radio-buttons-mixed-inactive' },
};

export interface AttachThemeToCheckableOptions {
  /** The chrome `<span>` that receives the cicn background. */
  chromeEl: HTMLSpanElement;
  /** The native input — read for `.checked` and `.disabled`. */
  input: HTMLInputElement;
  /** The wrapping label — read for `data-state`. */
  label: HTMLLabelElement;
  /** Control family. */
  kind: Kind;
}

/**
 * Wire a checkbox/radio chrome span to receive cicn artwork from the
 * active theme. Subscribes to `themeRegistry` + observes state changes.
 *
 * Returns a teardown function. Always call before removing the control
 * from the DOM.
 *
 * When the theme has no cicn artwork for the requested slug, clears any
 * prior background and removes the {@link CICN_LOADED_ATTR} sentinel so
 * engine-baseline CSS renders the fallback.
 */
export function attachThemeToCheckable(
  options: AttachThemeToCheckableOptions,
): () => void {
  const { chromeEl, input, label, kind } = options;
  const slugs = kind === 'checkbox' ? CHECKBOX_SLUGS : RADIO_SLUGS;

  const render = () => {
    const theme = themeRegistry.current();
    paintCicn(theme, chromeEl, input, label, slugs, kind);
  };

  render();

  const unsubTheme = themeRegistry.subscribe(render);

  // Watch label's data-state (pressed/focused/normal) + aria-disabled.
  const labelObserver = new MutationObserver(render);
  labelObserver.observe(label, {
    attributes: true,
    attributeFilter: ['data-state', 'aria-disabled'],
  });

  // Watch input's `checked` via the native `change` event — MutationObserver
  // does NOT fire for the `checked` IDL property, only for the attribute,
  // and the attribute doesn't auto-sync with the property.
  input.addEventListener('change', render);
  // Also react to indeterminate flips (mixed state).
  input.addEventListener('input', render);

  return () => {
    unsubTheme();
    labelObserver.disconnect();
    input.removeEventListener('change', render);
    input.removeEventListener('input', render);
    chromeEl.style.backgroundImage = '';
    chromeEl.style.backgroundSize = '';
    chromeEl.style.backgroundRepeat = '';
    chromeEl.style.imageRendering = '';
    chromeEl.removeAttribute(CICN_LOADED_ATTR);
  };
}

// ─── Internals ─────────────────────────────────────────────────────────

function paintCicn(
  theme: Theme | null,
  chromeEl: HTMLSpanElement,
  input: HTMLInputElement,
  label: HTMLLabelElement,
  slugs:
    | Record<CheckboxValue, Record<RuntimeState, string>>
    | Record<RadioValue, Record<RuntimeState, string>>,
  kind: Kind,
): void {
  const catalog = theme?.chromeElements;
  if (!catalog) {
    clearChrome(chromeEl);
    return;
  }

  const state = readRuntimeState(input, label);
  const value = readValue(input, kind);
  const slug = (slugs as Record<string, Record<RuntimeState, string>>)[value]?.[state];
  const entry = slug ? catalog[slug] : undefined;

  if (!entry?.asset) {
    // Mixed value fallback: if there's no "mixed" cicn, fall back to
    // "checked" / "on" (spec B §4.4 + §9 fallback chain).
    if (value === 'mixed') {
      const fallbackValue = kind === 'checkbox' ? 'checked' : 'on';
      const fallbackSlug = (slugs as Record<string, Record<RuntimeState, string>>)[fallbackValue]?.[state];
      const fallbackEntry = fallbackSlug ? catalog[fallbackSlug] : undefined;
      if (fallbackEntry?.asset) {
        applyEntry(chromeEl, fallbackEntry.asset, fallbackEntry.width, fallbackEntry.height);
        return;
      }
    }
    clearChrome(chromeEl);
    return;
  }

  applyEntry(chromeEl, entry.asset, entry.width, entry.height);
}

function applyEntry(
  chromeEl: HTMLSpanElement,
  asset: string,
  width: number | undefined,
  height: number | undefined,
): void {
  chromeEl.style.backgroundImage = `url("${asset.replace(/"/g, '\\"')}")`;
  chromeEl.style.backgroundRepeat = 'no-repeat';
  chromeEl.style.backgroundPosition = 'center';
  if (width && height) {
    chromeEl.style.backgroundSize = `${width}px ${height}px`;
  } else {
    chromeEl.style.backgroundSize = '';
  }
  // Pixel-art rendering — cicns are tiny bitmaps.
  chromeEl.style.imageRendering = 'pixelated';
  chromeEl.setAttribute(CICN_LOADED_ATTR, '');
}

function clearChrome(chromeEl: HTMLSpanElement): void {
  chromeEl.style.backgroundImage = '';
  chromeEl.style.backgroundSize = '';
  chromeEl.style.backgroundRepeat = '';
  chromeEl.style.imageRendering = '';
  chromeEl.removeAttribute(CICN_LOADED_ATTR);
}

function readRuntimeState(input: HTMLInputElement, label: HTMLLabelElement): RuntimeState {
  if (input.disabled) return 'inactive';
  if (label.getAttribute('data-state') === 'pressed') return 'pressed';
  return 'active';
}

function readValue(input: HTMLInputElement, kind: Kind): CheckboxValue | RadioValue {
  if (input.indeterminate) return 'mixed';
  if (input.checked) return kind === 'checkbox' ? 'checked' : 'on';
  return kind === 'checkbox' ? 'empty' : 'off';
}
