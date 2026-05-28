// Promote `<input type=checkbox|radio|range>` into a themed control. Same skin-don't-steal contract
// as button.ts: the original input is hidden in place (preserves form value/association, change
// events, accessibility), and the themed face is inserted next to it. User interaction on the themed
// face drives the native input (setting .checked / .value + dispatching the matching event).
//
// Radio-group exclusivity rides on the native inputs' shared `name` (the browser un-checks siblings
// when one is checked via .click()); the themed siblings' VISUALS get re-synced on each change via
// their `_awSetChecked` setter so they all show the right state without us rebuilding them.

import type { LoadedTheme } from '../types.js';
import { interactiveCheckbox, interactiveRadio, interactiveSlider } from '../interactive.js';

type Promotable = HTMLInputElement;
type Kind = 'checkbox' | 'radio' | 'range';

const KIND_RE = /^(checkbox|radio|range)$/;
const SETTER = '_awSetChecked'; // see interactive.ts buildToggle — exposes the visual state setter

/** Promote one input. Returns the themed element, or null if the input type isn't one we handle. */
export async function promoteControl(el: Promotable, theme: LoadedTheme): Promise<HTMLElement | null> {
  if (el.dataset.aaronPromoted != null) return null;
  const kind = el.type as Kind;
  if (!KIND_RE.test(kind)) return null;
  el.dataset.aaronPromoted = '';
  const label = labelTextFor(el);
  let skinned: HTMLElement;

  if (kind === 'checkbox') {
    skinned = await interactiveCheckbox(theme, {
      checked: el.checked,
      disabled: el.disabled,
      ...(label ? { label } : {}),
      onChange: (checked) => {
        el.checked = checked;
        el.dispatchEvent(new Event('change', { bubbles: true }));
      },
    });
  } else if (kind === 'radio') {
    skinned = await interactiveRadio(theme, {
      checked: el.checked,
      disabled: el.disabled,
      ...(label ? { label } : {}),
      onChange: () => {
        // .click() flips this radio AND tells the browser to un-check same-name siblings; that's the
        // path that fires the native input's `change` event for each affected sibling. We then walk
        // the promoted radios in this group and re-sync their themed visual to match `.checked`.
        if (!el.checked) el.click();
        syncRadioGroup(el.name);
      },
    });
    if (el.name) skinned.dataset.aaronRadioGroup = el.name;
    (skinned as unknown as { _awNative: HTMLInputElement })._awNative = el;
  } else {
    const min = numOr(el.min, 0), max = numOr(el.max, 100);
    const range = max - min || 1;
    const initial = clamp01((numOr(el.value, min) - min) / range);
    skinned = await interactiveSlider(theme, {
      orientation: 'horizontal',
      length: 120,
      value: initial,
      onChange: (v) => {
        el.value = String(Math.round(min + v * range));
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      },
    });
  }

  // Skin-don't-steal: hide the native input in place + insert the themed face right after it.
  el.style.display = 'none';
  el.after(skinned);
  // The themed checkable bakes its own label into the cicn (we passed `label`), so an associated
  // <label for=...> or wrapping <label> would duplicate the text. Hide it. Slider has no inline label.
  if (kind !== 'range' && label) {
    const lbl = associatedLabel(el);
    if (lbl) lbl.style.display = 'none';
  }
  skinned.dataset.aaronPromoted = '';
  return skinned;
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
  const sel = `.aw-radio[data-aaron-radio-group="${CSS.escape(name)}"]`;
  for (const node of Array.from(document.querySelectorAll<HTMLElement>(sel))) {
    const native = (node as unknown as { _awNative?: HTMLInputElement })._awNative;
    const setVisual = (node as unknown as Record<string, ((v: boolean) => void) | undefined>)[SETTER];
    if (native && setVisual) setVisual(native.checked);
  }
}
