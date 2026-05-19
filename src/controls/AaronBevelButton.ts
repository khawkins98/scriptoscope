// Bevel buttons — spec A §3.2.
//
// Visually heavier-bordered buttons used for tool palettes + similar.
// Canonical Kaleidoscope schemes don't ship bevel-button cicn artwork
// (per the kDEF disassembly findings: Mac OS Appearance Manager + the
// system CDEF render these via SetUpControlBackground hooks). So bevel
// buttons follow the same CSS-only pattern as AaronButton, with a
// thicker border + per-size variants.
//
// Variants per spec A §3.2:
//   - small: 16px high
//   - normal: 20px high
//   - large: 28px high

import { wireControlStateMachine, type TeardownFn } from '../themes/runtime/applyControlChrome.js';
import { installEngineBaseline } from './engineBaseline.js';

export type BevelButtonSize = 'small' | 'normal' | 'large';
export type BevelButtonValue = 'off' | 'on' | 'mixed';

export interface AaronBevelButtonOptions {
  label?: string;
  size?: BevelButtonSize;
  value?: BevelButtonValue;
  disabled?: boolean;
  onActivate?: (this: AaronBevelButton) => void;
}

/** Aaron UI bevel button — heavier-bordered button variant. */
export class AaronBevelButton {
  readonly element: HTMLButtonElement;
  private detach: TeardownFn;

  constructor(elementOrOptions: HTMLButtonElement | AaronBevelButtonOptions = {}) {
    let element: HTMLButtonElement;
    let opts: AaronBevelButtonOptions;

    if (elementOrOptions instanceof HTMLButtonElement) {
      element = elementOrOptions;
      opts = {};
    } else {
      opts = elementOrOptions;
      element = document.createElement('button');
      element.type = 'button';
    }
    this.element = element;

    if (opts.label != null && element.textContent === '') {
      element.textContent = opts.label;
    }

    installEngineBaseline(element.ownerDocument);
    element.classList.add('aaron-control', 'aaron-button', 'aaron-button--bevel');
    element.setAttribute('data-aaron-promoted', '');
    element.setAttribute('data-state', 'normal');
    element.setAttribute('data-size', opts.size ?? 'normal');
    element.setAttribute('data-value', opts.value ?? 'off');
    element.setAttribute('aria-pressed', opts.value === 'on' ? 'true' : opts.value === 'mixed' ? 'mixed' : 'false');

    if (opts.disabled) {
      element.disabled = true;
      element.setAttribute('aria-disabled', 'true');
    }

    this.detach = wireControlStateMachine(element, {
      onActivate: () => {
        if (element.disabled) return;
        opts.onActivate?.call(this);
      },
    });
  }

  setValue(value: BevelButtonValue): this {
    this.element.setAttribute('data-value', value);
    this.element.setAttribute(
      'aria-pressed',
      value === 'on' ? 'true' : value === 'mixed' ? 'mixed' : 'false',
    );
    return this;
  }

  get value(): BevelButtonValue {
    return (this.element.getAttribute('data-value') as BevelButtonValue) ?? 'off';
  }

  setDisabled(disabled: boolean): this {
    this.element.disabled = disabled;
    if (disabled) this.element.setAttribute('aria-disabled', 'true');
    else this.element.removeAttribute('aria-disabled');
    return this;
  }

  unmount(): this {
    this.detach();
    this.element.classList.remove('aaron-control', 'aaron-button', 'aaron-button--bevel');
    this.element.removeAttribute('data-aaron-promoted');
    this.element.removeAttribute('data-state');
    this.element.removeAttribute('data-size');
    this.element.removeAttribute('data-value');
    this.element.removeAttribute('aria-pressed');
    return this;
  }
}

/** Promote `<button data-aaron-button-bevel>` into AaronBevelButton. Idempotent. */
export function promoteBevelButtons(root: ParentNode = document.body): AaronBevelButton[] {
  const sel = 'button[data-aaron-button-bevel]:not([data-aaron-promoted])';
  const buttons = Array.from(root.querySelectorAll<HTMLButtonElement>(sel));
  return buttons.map((b) => new AaronBevelButton(b));
}
