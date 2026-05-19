// Window headers — spec A §13 + spec B §4.14.
//
// Used at the top of Finder windows (column headers) and similar
// app-internal banners. K2 specifies "simply stretched" rendering. Two
// states only: active + inactive (no pressed state for headers).
//
// Slug convention (matches the bundled extractor):
//   finder-header-active    normal/active
//   finder-header-inactive  inactive (window not focused)

import { installEngineBaseline } from './engineBaseline.js';
import { attachThemeToStretched } from '../themes/runtime/attachThemeToStretched.js';

export interface AaronWindowHeaderOptions {
  /** Header content (column titles, etc.). Ignored if wrapping an existing div. */
  html?: string;
  /** Initial active state. Default true. */
  active?: boolean;
}

/**
 * Aaron UI window header — Finder-style column header bar. The
 * consumer-provided content lives inside; this class only owns the
 * chrome paint + state attribute mirroring.
 */
export class AaronWindowHeader {
  readonly element: HTMLDivElement;
  private detach: () => void;

  constructor(elementOrOptions: HTMLDivElement | AaronWindowHeaderOptions = {}) {
    let element: HTMLDivElement;
    let opts: AaronWindowHeaderOptions;

    if (elementOrOptions instanceof HTMLDivElement) {
      element = elementOrOptions;
      opts = {};
    } else {
      opts = elementOrOptions;
      element = document.createElement('div');
    }
    this.element = element;

    if (opts.html != null && element.innerHTML === '') {
      element.innerHTML = opts.html;
    }

    installEngineBaseline(element.ownerDocument);
    element.classList.add('aaron-control', 'aaron-window-header');
    element.setAttribute('data-aaron-promoted', '');
    element.setAttribute('data-state', opts.active === false ? 'inactive' : 'active');

    // Window headers only have two cicns (active + inactive) per K2.
    // Map them onto the stretched-runtime-state vocabulary (no pressed).
    this.detach = attachThemeToStretched({
      element,
      slugs: {
        active: 'finder-header-active',
        inactive: 'finder-header-inactive',
      },
      readState: () =>
        element.getAttribute('data-state') === 'inactive' ? 'inactive' : 'active',
    });
  }

  setActive(active: boolean): this {
    this.element.setAttribute('data-state', active ? 'active' : 'inactive');
    return this;
  }

  unmount(): this {
    this.detach();
    this.element.classList.remove('aaron-control', 'aaron-window-header');
    this.element.removeAttribute('data-aaron-promoted');
    this.element.removeAttribute('data-state');
    return this;
  }
}

/**
 * Promote any `[data-aaron-window-header]` divs in the root.
 * Idempotent.
 */
export function promoteWindowHeaders(root: ParentNode = document.body): AaronWindowHeader[] {
  const sel = 'div[data-aaron-window-header]:not([data-aaron-promoted])';
  const els = Array.from(root.querySelectorAll<HTMLDivElement>(sel));
  return els.map((el) => new AaronWindowHeader(el));
}
