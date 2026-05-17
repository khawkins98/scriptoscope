// Phase 3.2 — push buttons (normal + default).
//
// Per docs/control-rendering-architecture.md §9 (push button) +
// the inspection in #71 that revealed: canonical Kaleidoscope schemes
// don't ship push-button cicn artwork. In real Mac OS Appearance, push
// buttons were drawn by the system's CDEF (Control DEFinition), not
// by Kaleidoscope schemes. Schemes themed the surroundings.
//
// Aaron UI's push buttons therefore use CSS-drawn chrome with palette
// custom property tinting (engine-baseline CSS from engineBaseline.ts).
// They wire the universal state machine via wireControlStateMachine
// (no chromeElements lookup needed).

import { wireControlStateMachine, type TeardownFn } from '../themes/runtime/applyControlChrome.js';
import { installEngineBaseline } from './engineBaseline.js';

export interface AaronButtonOptions {
  /** Label text. Ignored if the element already has text content. */
  label?: string;
  /** Default-button variant — adds the thick outline. */
  defaultButton?: boolean;
  /** Initial disabled state. Default false. */
  disabled?: boolean;
  /** Activation callback. Default: dispatches `click` event (which the
   * native button would do anyway; this just hooks before/after). */
  onActivate?: (this: AaronButton) => void;
}

/**
 * Wrap a `<button>` element with Aaron UI push button styling + the
 * universal state machine.
 *
 * Promoted from declarative `[data-aaron-button]` or `[data-aaron-button-default]`
 * markup by the scanner, or constructed programmatically.
 */
export class AaronButton {
  readonly element: HTMLButtonElement;
  readonly defaultButton: boolean;
  private detachStateMachine: TeardownFn | null = null;
  private onActivate: (this: AaronButton) => void;

  constructor(elementOrOptions: HTMLButtonElement | AaronButtonOptions = {}) {
    let opts: AaronButtonOptions;
    let el: HTMLButtonElement;

    if (elementOrOptions instanceof HTMLButtonElement) {
      el = elementOrOptions;
      opts = {};
    } else {
      opts = elementOrOptions;
      el = document.createElement('button');
      el.type = 'button';
    }

    if (opts.label != null && el.textContent === '') {
      el.textContent = opts.label;
    }
    this.defaultButton = opts.defaultButton ?? el.hasAttribute('data-aaron-button-default');
    this.onActivate = opts.onActivate ?? (() => {});
    this.element = el;

    this.mount();
    if (opts.disabled) this.setDisabled(true);
  }

  /** Promote the element: classes, ARIA, state machine. Idempotent. */
  mount(): this {
    installEngineBaseline(this.element.ownerDocument);

    this.element.classList.add('aaron-control', 'aaron-button');
    if (this.defaultButton) this.element.classList.add('aaron-button--default');

    // Mark as promoted so the scanner doesn't re-promote.
    this.element.setAttribute('data-aaron-promoted', '');
    this.element.setAttribute('data-state', 'normal');
    if (!this.element.hasAttribute('type')) {
      // Native <button> defaults to type=submit inside forms — surprising
      // for a generic Aaron UI button. Default to type=button unless the
      // consumer set otherwise.
      this.element.setAttribute('type', 'button');
    }

    if (this.detachStateMachine == null) {
      this.detachStateMachine = wireControlStateMachine(this.element, {
        onActivate: () => this.onActivate.call(this),
      });
    }
    return this;
  }

  /** Detach state machine + remove Aaron UI classes/attributes. */
  unmount(): this {
    this.detachStateMachine?.();
    this.detachStateMachine = null;
    this.element.classList.remove('aaron-control', 'aaron-button', 'aaron-button--default');
    this.element.removeAttribute('data-aaron-promoted');
    this.element.removeAttribute('data-state');
    return this;
  }

  /** Get/set disabled state. Updates aria-disabled + native disabled. */
  setDisabled(disabled: boolean): this {
    this.element.disabled = disabled;
    if (disabled) {
      this.element.setAttribute('aria-disabled', 'true');
    } else {
      this.element.removeAttribute('aria-disabled');
    }
    return this;
  }

  get disabled(): boolean {
    return this.element.disabled;
  }

  /** Programmatically activate (fires the click handler). */
  click(): this {
    if (this.disabled) return this;
    this.onActivate.call(this);
    return this;
  }
}

/**
 * Promote any `[data-aaron-button]` or `[data-aaron-button-default]` elements
 * in the given root (defaults to `document.body`) into AaronButton instances.
 *
 * Idempotent: elements with `data-aaron-promoted` are skipped.
 */
export function promoteButtons(root: ParentNode = document.body): AaronButton[] {
  const els = root.querySelectorAll<HTMLElement>(
    '[data-aaron-button]:not([data-aaron-promoted]), [data-aaron-button-default]:not([data-aaron-promoted])',
  );
  const buttons: AaronButton[] = [];
  for (const el of Array.from(els)) {
    if (!(el instanceof HTMLButtonElement)) {
      // Not a <button> — wrap by adding a button-shaped behaviour.
      // Strictly, per the spec, buttons should be <button> elements for
      // a11y. Log a warning so consumers fix their markup.
      // eslint-disable-next-line no-console
      console.warn(
        `[aaron-ui] [data-aaron-button] requires a <button> element. Got <${el.tagName.toLowerCase()}>; skipping.`,
      );
      continue;
    }
    buttons.push(new AaronButton(el));
  }
  return buttons;
}
