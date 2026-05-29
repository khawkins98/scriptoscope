// Promote `<input type=checkbox|radio|range>` into a themed control. Same skin-don't-steal contract
// as button.ts: the original input is hidden in place (preserves form value/association, change
// events, accessibility), and the themed face is inserted next to it. User interaction on the themed
// face drives the native input (setting .checked / .value + dispatching the matching event).
//
// Radio-group exclusivity rides on the native inputs' shared `name` (the browser un-checks siblings
// when one is checked via .click()); the themed siblings' VISUALS get re-synced on each change via
// their `_scriptoscopeSetChecked` setter so they all show the right state without us rebuilding them.

import type { LoadedTheme } from '../types.js';
import { interactiveCheckbox, interactiveRadio, interactiveSlider, interactiveButton } from '../interactive.js';

type Promotable = HTMLInputElement | HTMLSelectElement;
type Kind = 'checkbox' | 'radio' | 'range' | 'select';

const INPUT_KIND_RE = /^(checkbox|radio|range)$/;
const SETTER = '_scriptoscopeSetChecked'; // see interactive.ts buildToggle — exposes the visual state setter

/** Promote one form control. Returns the themed element / wrapper, or null if the type isn't one we handle. */
export async function promoteControl(el: Promotable, theme: LoadedTheme): Promise<HTMLElement | null> {
  if (el.dataset.scriptoscopePromoted != null) return null;
  const kind: Kind | undefined =
    el.tagName === 'SELECT' ? 'select'
    : INPUT_KIND_RE.test((el as HTMLInputElement).type) ? (el as HTMLInputElement).type as Kind
    : undefined;
  if (!kind) return null;
  // Selects take a different shape (wrap + transparent overlay), handled in their own branch below.
  if (kind === 'select') return promoteSelect(el as HTMLSelectElement, theme);
  el.dataset.scriptoscopePromoted = '';
  const input = el as HTMLInputElement;
  const label = labelTextFor(input);
  let skinned: HTMLElement;

  if (kind === 'checkbox') {
    skinned = await interactiveCheckbox(theme, {
      checked: input.checked,
      disabled: input.disabled,
      ...(label ? { label } : {}),
      onChange: (checked) => {
        input.checked = checked;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      },
    });
  } else if (kind === 'radio') {
    skinned = await interactiveRadio(theme, {
      checked: input.checked,
      disabled: input.disabled,
      ...(label ? { label } : {}),
      onChange: () => {
        if (!input.checked) input.click();
        syncRadioGroup(input.name);
      },
    });
    if (input.name) skinned.dataset.scriptoscopeRadioGroup = input.name;
    (skinned as unknown as { _scriptoscopeNative: HTMLInputElement })._scriptoscopeNative = input;
  } else {
    const min = numOr(input.min, 0), max = numOr(input.max, 100);
    const range = max - min;
    const initial = range > 0 ? clamp01((numOr(input.value, min) - min) / range) : 0;
    skinned = await interactiveSlider(theme, {
      orientation: 'horizontal',
      length: 120,
      value: initial,
      onChange: (v) => {
        const out = range > 0 ? Math.round(min + v * range) : min;
        input.value = String(out);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      },
    });
  }

  input.style.display = 'none';
  const lbl = kind !== 'range' ? associatedLabel(input) : null;
  const wrapping = lbl?.contains(input) ?? false;
  if (wrapping && lbl) {
    lbl.after(skinned);
    if (label) lbl.style.display = 'none';
  } else {
    input.after(skinned);
    if (lbl && label) lbl.style.display = 'none';
  }
  skinned.dataset.scriptoscopePromoted = '';
  if (kind === 'radio' && input.name) syncRadioGroup(input.name);
  return skinned;
}

/**
 * Themed `<select>` via the transparent-overlay trick: wrap the select; render a themed button
 * (label + chevron) behind it; overlay the native select on top at opacity 0. The user SEES the
 * themed button; clicks land on the invisible native select, opening the browser's native dropdown
 * menu (cross-browser, keyboard-navigable, screen-reader-accessible — for free). On change we
 * re-render the button label. Theme switching re-wraps from scratch.
 *
 * A fully themed popup-menu via the `popup-window` chrome is a follow-up — this iteration gives
 * the closed-state fidelity without the keyboard/a11y reimplementation cost.
 */
// Track AbortControllers for each promoted <select>'s change listener so retheme can dispose the
// previous one and attach fresh. WeakMap so a select being removed from the document also drops
// its controller (no manual cleanup needed in that case).
const selectChangeAborts = new WeakMap<HTMLSelectElement, AbortController>();

async function promoteSelect(el: HTMLSelectElement, theme: LoadedTheme): Promise<HTMLElement> {
  // Unwrap a prior promotion (retheme path) so we always rebuild cleanly.
  const existingWrap = el.closest('.scriptoscope-select') as HTMLElement | null;
  if (existingWrap && existingWrap.parentNode) {
    existingWrap.parentNode.insertBefore(el, existingWrap);
    existingWrap.remove();
    el.style.cssText = '';
  }
  el.dataset.scriptoscopePromoted = '';
  // Abort the PREVIOUS promotion's change listener (every retheme reaches this path; without the
  // abort the change-listener count would grow by one per retheme on every themed select — caught
  // by the 2026-05-28 review).
  selectChangeAborts.get(el)?.abort();

  const wrap = document.createElement('span');
  wrap.className = 'scriptoscope-select';
  Object.assign(wrap.style, {
    position: 'relative', display: 'inline-block', verticalAlign: 'middle',
    cursor: el.disabled ? 'default' : 'pointer',
  } satisfies Partial<CSSStyleDeclaration>);

  const renderBtn = async (): Promise<HTMLElement> => {
    const text = (el.selectedOptions[0]?.textContent ?? '').trim();
    // The chevron `▾` (U+25BE) signals "this is a dropdown" — universally understood, available in
    // every font we ship; cheaper than a custom cicn for the corner indicator.
    const b = await interactiveButton(theme, { label: `${text}  ▾`, disabled: el.disabled });
    // Pointer-events:none so clicks fall THROUGH to the native select underneath (the real handler).
    Object.assign(b.style, { pointerEvents: 'none' } satisfies Partial<CSSStyleDeclaration>);
    return b;
  };

  // Insert wrap where el was, move el INTO wrap as the click target on top.
  el.parentNode?.insertBefore(wrap, el);
  wrap.appendChild(el);
  const btn = await renderBtn();
  wrap.appendChild(btn);
  Object.assign(el.style, {
    position: 'absolute', inset: '0', opacity: '0', cursor: el.disabled ? 'default' : 'pointer',
    zIndex: '2', width: '100%', height: '100%', font: 'inherit', margin: '0', padding: '0',
    border: '0', appearance: 'none',
  } satisfies Partial<CSSStyleDeclaration>);

  // Scope the change listener to a fresh AbortController so the next retheme can abort it cleanly.
  const ac = new AbortController();
  selectChangeAborts.set(el, ac);
  el.addEventListener('change', async () => {
    const fresh = await renderBtn();
    const cur = wrap.querySelector(':scope > .scriptoscope-button');
    cur?.replaceWith(fresh);
  }, { signal: ac.signal });

  wrap.dataset.scriptoscopePromoted = '';
  return wrap;
}

function labelTextFor(el: Promotable): string | undefined {
  const lbl = associatedLabel(el);
  return lbl?.textContent?.trim() || undefined;
}

function associatedLabel(el: Promotable): HTMLLabelElement | null {
  if (el.id) {
    const lbl = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
    if (lbl instanceof HTMLLabelElement) return lbl;
  }
  const wrap = el.closest('label');
  return wrap instanceof HTMLLabelElement ? wrap : null;
}

function numOr(s: string, fallback: number): number {
  const n = parseFloat(s); return Number.isFinite(n) ? n : fallback;
}
function clamp01(n: number): number { return n < 0 ? 0 : n > 1 ? 1 : n; }

/** Re-paint every themed radio in `name` to match its native input's current `.checked` state.
 *  Used after a click flips one — the browser updates siblings' `.checked` natively, but we own
 *  their themed visuals. */
function syncRadioGroup(name: string): void {
  if (!name) return;
  const sel = `.scriptoscope-radio[data-scriptoscope-radio-group="${CSS.escape(name)}"]`;
  for (const node of Array.from(document.querySelectorAll<HTMLElement>(sel))) {
    const native = (node as unknown as { _scriptoscopeNative?: HTMLInputElement })._scriptoscopeNative;
    const setVisual = (node as unknown as Record<string, ((v: boolean) => void) | undefined>)[SETTER];
    if (native && setVisual) setVisual(native.checked);
  }
}
