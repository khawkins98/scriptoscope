// Phase 3.4 — text input + textarea.
//
// Predicted to be the first cicn-rendered control (LEARNINGS 2026-05-17),
// but inspection showed otherwise: neither canonical bundle ships any
// field/frame slugs. Mac OS edit-text was also CDEF-rendered. CSS-drawn
// it is, same path as #71 / #72.
//
// Native <input> or <textarea> stays focusable + a11y-meaningful;
// the wrapping <span class="aaron-field"> paints the inset bezel.

import { installEngineBaseline } from './engineBaseline.js';

export interface AaronFieldOptions {
  /** Field type. 'textarea' creates a `<textarea>`; anything else
   * becomes an `<input type="...">`. Default 'text'. */
  type?: 'text' | 'password' | 'email' | 'url' | 'number' | 'search' | 'tel' | 'textarea';
  /** Initial value. */
  value?: string;
  /** Placeholder. */
  placeholder?: string;
  /** Form name. */
  name?: string;
  /** Disabled state. */
  disabled?: boolean;
  /** Read-only state. */
  readOnly?: boolean;
  /** Stretch to fill parent width (`.aaron-field--block`). */
  block?: boolean;
  /** For textareas: visible row count. */
  rows?: number;
  /** Change callback (fired on `input` event, not `change`, so it
   * reflects every keystroke). */
  onInput?: (value: string, el: HTMLInputElement | HTMLTextAreaElement) => void;
}

type FieldElement = HTMLInputElement | HTMLTextAreaElement;

export class AaronField {
  readonly element: FieldElement;
  readonly wrapper: HTMLSpanElement;
  private detachers: Array<() => void> = [];

  constructor(elementOrOptions: FieldElement | AaronFieldOptions = {}) {
    let opts: AaronFieldOptions;
    let el: FieldElement;

    if (elementOrOptions instanceof HTMLInputElement || elementOrOptions instanceof HTMLTextAreaElement) {
      el = elementOrOptions;
      opts = {};
    } else {
      opts = elementOrOptions;
      const type = opts.type ?? 'text';
      if (type === 'textarea') {
        const ta = document.createElement('textarea');
        if (opts.rows != null) ta.rows = opts.rows;
        el = ta;
      } else {
        const input = document.createElement('input');
        input.type = type;
        el = input;
      }
    }

    if (opts.value != null) el.value = opts.value;
    if (opts.placeholder != null) el.placeholder = opts.placeholder;
    if (opts.name != null) el.name = opts.name;
    if (opts.disabled != null) el.disabled = opts.disabled;
    if (opts.readOnly != null) el.readOnly = opts.readOnly;
    this.element = el;

    // If element is already inside an .aaron-field wrapper (re-mount),
    // reuse it; otherwise create one and wrap.
    let wrapper = el.parentElement;
    if (!wrapper || !wrapper.classList.contains('aaron-field')) {
      wrapper = document.createElement('span');
      const parent = el.parentNode;
      if (parent) parent.insertBefore(wrapper, el);
      wrapper.appendChild(el);
    }
    this.wrapper = wrapper as HTMLSpanElement;

    this.mount(!!opts.block);

    if (opts.onInput) {
      const handler = (): void => opts.onInput!(el.value, el);
      el.addEventListener('input', handler);
      this.detachers.push(() => el.removeEventListener('input', handler));
    }
  }

  private mount(block: boolean): void {
    installEngineBaseline(this.wrapper.ownerDocument);
    this.wrapper.classList.add('aaron-control', 'aaron-field');
    if (block) this.wrapper.classList.add('aaron-field--block');
    this.wrapper.setAttribute('data-aaron-promoted', '');
    this.syncAria();
  }

  syncAria(): this {
    if (this.element.disabled) {
      this.wrapper.setAttribute('aria-disabled', 'true');
    } else {
      this.wrapper.removeAttribute('aria-disabled');
    }
    this.wrapper.classList.toggle('aaron-field--readonly', this.element.readOnly);
    return this;
  }

  get value(): string { return this.element.value; }
  setValue(v: string): this {
    this.element.value = v;
    return this;
  }

  setDisabled(disabled: boolean): this {
    this.element.disabled = disabled;
    this.syncAria();
    return this;
  }
  get disabled(): boolean { return this.element.disabled; }

  setReadOnly(readOnly: boolean): this {
    this.element.readOnly = readOnly;
    this.syncAria();
    return this;
  }
  get readOnly(): boolean { return this.element.readOnly; }

  /** Move focus to the underlying input/textarea. */
  focus(): this {
    this.element.focus();
    return this;
  }

  unmount(): this {
    for (const d of this.detachers) d();
    this.detachers = [];
    this.wrapper.classList.remove(
      'aaron-control', 'aaron-field', 'aaron-field--block', 'aaron-field--readonly',
    );
    this.wrapper.removeAttribute('data-aaron-promoted');
    this.wrapper.removeAttribute('aria-disabled');
    return this;
  }
}

/**
 * Promote any `[data-aaron-field]` inputs/textareas in the root.
 * Idempotent.
 */
export function promoteFields(root: ParentNode = document.body): AaronField[] {
  const sel = '[data-aaron-field]:not([data-aaron-promoted-input])';
  const els = Array.from(root.querySelectorAll<HTMLElement>(sel));
  const out: AaronField[] = [];
  for (const el of els) {
    if (!(el instanceof HTMLInputElement) && !(el instanceof HTMLTextAreaElement)) {
      // eslint-disable-next-line no-console
      console.warn(
        `[aaron-ui] [data-aaron-field] requires <input> or <textarea>. Got <${el.tagName.toLowerCase()}>; skipping.`,
      );
      continue;
    }
    el.setAttribute('data-aaron-promoted-input', '');
    out.push(new AaronField(el));
  }
  return out;
}
