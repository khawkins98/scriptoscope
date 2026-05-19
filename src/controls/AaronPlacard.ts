// Placards — spec A §14 + spec B §4.15.
//
// Embossed label slabs used by Appearance-savvy apps for read-only
// status/title areas. K2 specifies "simply stretched" rendering.
//
// Slug convention (matches the bundled extractor's emit; some exotic
// schemes use the playful "placard-thing" name for the active state):
//   placard-thing OR active-placard  — normal active
//   pressed-placard                  — pressed (rare; not all schemes)
//   inactive-placard                 — disabled

import { installEngineBaseline } from './engineBaseline.js';
import {
  attachThemeToStretched,
  type StretchedRuntimeState,
} from '../themes/runtime/attachThemeToStretched.js';

export interface AaronPlacardOptions {
  /** Label text. Ignored if the wrapped element already has content. */
  label?: string;
  /** Initial pressed state (rare; most placards are read-only displays). */
  pressed?: boolean;
  /** Initial disabled state. */
  disabled?: boolean;
}

/** Aaron UI placard — period-faithful embossed label slab. */
export class AaronPlacard {
  readonly element: HTMLDivElement;
  private detach: () => void;

  constructor(elementOrOptions: HTMLDivElement | AaronPlacardOptions = {}) {
    let element: HTMLDivElement;
    let opts: AaronPlacardOptions;

    if (elementOrOptions instanceof HTMLDivElement) {
      element = elementOrOptions;
      opts = {};
    } else {
      opts = elementOrOptions;
      element = document.createElement('div');
    }
    this.element = element;

    if (opts.label != null && element.textContent === '') {
      element.textContent = opts.label;
    }

    installEngineBaseline(element.ownerDocument);
    element.classList.add('aaron-control', 'aaron-placard');
    element.setAttribute('data-aaron-promoted', '');
    element.setAttribute('data-state', opts.pressed ? 'pressed' : 'normal');
    if (opts.disabled) element.setAttribute('aria-disabled', 'true');

    // Slug map per spec B §4.15. The "placard-thing" name is what some
    // extracted schemes emit for active; fall back to active-placard for
    // schemes that use a more orthodox slug.
    this.detach = attachThemeToStretched({
      element,
      slugs: {
        active: 'placard-thing',
        pressed: 'pressed-placard',
        inactive: 'inactive-placard',
      },
    });
  }

  setDisabled(disabled: boolean): this {
    if (disabled) this.element.setAttribute('aria-disabled', 'true');
    else this.element.removeAttribute('aria-disabled');
    return this;
  }

  setPressed(pressed: boolean): this {
    this.element.setAttribute('data-state', pressed ? 'pressed' : 'normal');
    return this;
  }

  unmount(): this {
    this.detach();
    this.element.classList.remove('aaron-control', 'aaron-placard');
    this.element.removeAttribute('data-aaron-promoted');
    this.element.removeAttribute('data-state');
    this.element.removeAttribute('aria-disabled');
    return this;
  }
}

/**
 * Promote any `[data-aaron-placard]` divs in the root into AaronPlacard.
 * Idempotent.
 */
export function promotePlacards(root: ParentNode = document.body): AaronPlacard[] {
  const sel = 'div[data-aaron-placard]:not([data-aaron-promoted])';
  const els = Array.from(root.querySelectorAll<HTMLDivElement>(sel));
  return els.map((el) => new AaronPlacard(el));
}

export type { StretchedRuntimeState };
