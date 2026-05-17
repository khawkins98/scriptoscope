// Phase 3.3 — checkbox + radio controls.
//
// Like push buttons (#71), neither canonical bundle ships cicn artwork
// for these controls (Mac OS CDEF rendered them; Kaleidoscope themed
// surroundings). CSS-drawn + palette-tinted via engineBaseline.ts.
//
// Implementation strategy: keep the native <input type="checkbox|radio">
// for activation, focus, keyboard, form-submission, and a11y. Wrap it
// in a <label> (so click-on-label toggles) and add a sibling <span>
// that paints the visible chrome. The native input is visually hidden
// but stays in the tab order.

import { installEngineBaseline } from './engineBaseline.js';

type Kind = 'checkbox' | 'radio';

export interface AaronCheckableOptions {
  /** Label text. If omitted and an existing input is wrapped, the
   * existing surrounding text is used. */
  label?: string;
  /** Initial checked state. */
  checked?: boolean;
  /** Initial disabled state. */
  disabled?: boolean;
  /** Form name (mostly for radios — siblings sharing a name form a group). */
  name?: string;
  /** Value submitted with the form. */
  value?: string;
  /** Change callback — fired when checked state flips. */
  onChange?: (checked: boolean, el: HTMLInputElement) => void;
}

abstract class AaronCheckable {
  readonly element: HTMLInputElement;
  readonly label: HTMLLabelElement;
  readonly chrome: HTMLSpanElement;
  private detachers: Array<() => void> = [];

  protected constructor(
    kind: Kind,
    inputOrOptions: HTMLInputElement | AaronCheckableOptions = {},
  ) {
    let opts: AaronCheckableOptions;
    let input: HTMLInputElement;

    if (inputOrOptions instanceof HTMLInputElement) {
      input = inputOrOptions;
      opts = {};
    } else {
      opts = inputOrOptions;
      input = document.createElement('input');
      input.type = kind;
    }
    if (input.type !== kind) {
      throw new Error(
        `[aaron-ui] AaronCheckable expected <input type="${kind}">, got type="${input.type}"`,
      );
    }

    // Find or create the wrapping label. If the input is already inside
    // a <label>, reuse it; otherwise create one and move sibling text in.
    let label = input.closest('label');
    if (!label) {
      label = document.createElement('label');
      const parent = input.parentNode;
      if (parent) parent.insertBefore(label, input);
      label.appendChild(input);
    }
    this.label = label;
    this.element = input;

    // Apply options that affect the input itself.
    if (opts.name != null) input.name = opts.name;
    if (opts.value != null) input.value = opts.value;
    if (opts.checked != null) input.checked = opts.checked;
    if (opts.disabled != null) input.disabled = opts.disabled;

    // Create or find chrome span (a sibling of the input inside the label).
    let chrome = label.querySelector<HTMLSpanElement>(`.aaron-${kind}__chrome`);
    if (!chrome) {
      chrome = document.createElement('span');
      chrome.className = `aaron-${kind}__chrome`;
      chrome.setAttribute('aria-hidden', 'true');
      // Insert chrome immediately after the input.
      if (input.nextSibling) {
        label.insertBefore(chrome, input.nextSibling);
      } else {
        label.appendChild(chrome);
      }
    }
    this.chrome = chrome;

    // If a label option was provided and the label has no text-bearing
    // wrapper yet, add one.
    if (opts.label != null) {
      let textEl = label.querySelector<HTMLSpanElement>(`.aaron-${kind}__label`);
      if (!textEl) {
        textEl = document.createElement('span');
        textEl.className = `aaron-${kind}__label`;
        label.appendChild(textEl);
      }
      textEl.textContent = opts.label;
    }

    this.mountKind(kind);

    if (opts.onChange) {
      const handler = (): void => opts.onChange!(input.checked, input);
      input.addEventListener('change', handler);
      this.detachers.push(() => input.removeEventListener('change', handler));
    }
  }

  protected mountKind(kind: Kind): void {
    installEngineBaseline(this.label.ownerDocument);
    this.label.classList.add('aaron-control', `aaron-${kind}`);
    this.label.setAttribute('data-aaron-promoted', '');
    this.label.setAttribute('data-state', 'normal');
    this.syncAria();
  }

  /** Sync ARIA + data-state to current input state. */
  syncAria(): this {
    if (this.element.disabled) {
      this.label.setAttribute('aria-disabled', 'true');
    } else {
      this.label.removeAttribute('aria-disabled');
    }
    return this;
  }

  setChecked(checked: boolean): this {
    this.element.checked = checked;
    this.element.dispatchEvent(new Event('change', { bubbles: true }));
    return this;
  }

  get checked(): boolean {
    return this.element.checked;
  }

  setDisabled(disabled: boolean): this {
    this.element.disabled = disabled;
    this.syncAria();
    return this;
  }

  get disabled(): boolean {
    return this.element.disabled;
  }

  unmount(): this {
    for (const d of this.detachers) d();
    this.detachers = [];
    this.label.classList.remove('aaron-control', 'aaron-checkbox', 'aaron-radio');
    this.label.removeAttribute('data-aaron-promoted');
    this.label.removeAttribute('data-state');
    this.label.removeAttribute('aria-disabled');
    return this;
  }
}

/** Aaron UI checkbox control. */
export class AaronCheckbox extends AaronCheckable {
  constructor(inputOrOptions: HTMLInputElement | AaronCheckableOptions = {}) {
    super('checkbox', inputOrOptions);
  }
}

/** Aaron UI radio control. Group behaviour via shared `name`. */
export class AaronRadio extends AaronCheckable {
  constructor(inputOrOptions: HTMLInputElement | AaronCheckableOptions = {}) {
    super('radio', inputOrOptions);
  }
}

/**
 * Promote any `[data-aaron-checkbox]` inputs in the root into AaronCheckbox.
 * Idempotent — already-promoted wrappers are skipped.
 */
export function promoteCheckboxes(root: ParentNode = document.body): AaronCheckbox[] {
  return promote(root, 'checkbox', AaronCheckbox) as AaronCheckbox[];
}

/**
 * Promote any `[data-aaron-radio]` inputs in the root into AaronRadio.
 */
export function promoteRadios(root: ParentNode = document.body): AaronRadio[] {
  return promote(root, 'radio', AaronRadio) as AaronRadio[];
}

function promote(
  root: ParentNode,
  kind: Kind,
  Ctor: typeof AaronCheckbox | typeof AaronRadio,
): AaronCheckable[] {
  const attr = `data-aaron-${kind}`;
  const sel = `input[type="${kind}"][${attr}]:not([data-aaron-promoted-input])`;
  const inputs = Array.from(root.querySelectorAll<HTMLInputElement>(sel));
  const out: AaronCheckable[] = [];
  for (const input of inputs) {
    // The wrapping <label> is what carries data-aaron-promoted (and the
    // .aaron-control class). To make the scanner idempotent at the input
    // level, also tag the input.
    input.setAttribute('data-aaron-promoted-input', '');
    out.push(new Ctor(input));
  }
  return out;
}
