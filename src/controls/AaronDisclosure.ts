// Disclosure triangles — spec A §5 + spec B §4.6.
//
// A `<button>` element with a glyph + optional label. Clicking toggles
// `aria-expanded` + flips `data-facing` between `right` (collapsed) and
// `down` (expanded). The glyph is the cicn artwork from the active
// scheme when present; otherwise an engine-baseline CSS triangle.
//
// State machine: pointer + keyboard activation toggles aria-expanded.
// Disabled controls don't activate. No animation in this PR (spec B §13.7
// — disclosure animations parked for a follow-up; the data-facing flip
// + cicn swap is enough for first-cut visual parity).
//
// Slug convention from the bundled extractor:
//   {right|down}-pointing-disclosure-triangle              (normal active)
//   inactive-{right|down}-pointing-disclosure-tri[an]gle   (disabled; note typo)
//   pressed-{right|down}-pointing-disclosure-triangle      (pressed)

import { installEngineBaseline } from './engineBaseline.js';
import { attachThemeToDisclosure } from '../themes/runtime/attachThemeToDisclosure.js';

export type DisclosureFacing = 'right' | 'down';

export interface AaronDisclosureOptions {
  /** Label text shown next to the glyph. Defaults to empty. */
  label?: string;
  /** Initial facing direction. Default: `right` (collapsed). */
  facing?: DisclosureFacing;
  /** Initial disabled state. */
  disabled?: boolean;
  /** Toggle callback — fires with the new aria-expanded value. */
  onToggle?: (expanded: boolean, el: HTMLButtonElement) => void;
  /** ID of the region this triangle controls (sets `aria-controls`). */
  controls?: string;
}

/** Aaron UI disclosure triangle. Tracks `aria-expanded` + `data-facing`. */
export class AaronDisclosure {
  readonly element: HTMLButtonElement;
  readonly glyph: HTMLSpanElement;
  private detachers: Array<() => void> = [];

  constructor(elementOrOptions: HTMLButtonElement | AaronDisclosureOptions = {}) {
    let element: HTMLButtonElement;
    let opts: AaronDisclosureOptions;

    if (elementOrOptions instanceof HTMLButtonElement) {
      element = elementOrOptions;
      opts = {};
    } else {
      opts = elementOrOptions;
      element = document.createElement('button');
      element.type = 'button';
    }
    this.element = element;

    // Glyph span + label span. Glyph is what attachThemeToDisclosure paints
    // onto; label is consumer-provided text.
    let glyph = element.querySelector<HTMLSpanElement>('.aaron-disclosure__glyph');
    if (!glyph) {
      glyph = document.createElement('span');
      glyph.className = 'aaron-disclosure__glyph';
      glyph.setAttribute('aria-hidden', 'true');
      element.insertBefore(glyph, element.firstChild);
    }
    this.glyph = glyph;

    if (opts.label != null) {
      let labelSpan = element.querySelector<HTMLSpanElement>('.aaron-disclosure__label');
      if (!labelSpan) {
        labelSpan = document.createElement('span');
        labelSpan.className = 'aaron-disclosure__label';
        element.appendChild(labelSpan);
      }
      labelSpan.textContent = opts.label;
    }

    installEngineBaseline(element.ownerDocument);
    element.classList.add('aaron-control', 'aaron-disclosure');
    element.setAttribute('data-aaron-promoted', '');
    element.setAttribute('data-state', 'normal');
    element.setAttribute('data-facing', opts.facing ?? 'right');
    element.setAttribute('aria-expanded', opts.facing === 'down' ? 'true' : 'false');
    if (opts.controls != null) element.setAttribute('aria-controls', opts.controls);
    if (opts.disabled) {
      element.disabled = true;
      element.setAttribute('aria-disabled', 'true');
    }

    // Cicn-driven glyph when the active theme ships artwork. Falls back
    // to engine-baseline CSS triangle when not.
    this.detachers.push(
      attachThemeToDisclosure({ glyphEl: this.glyph, button: this.element }),
    );

    // Activation toggles aria-expanded + data-facing.
    const onActivate = (): void => {
      if (this.element.disabled) return;
      const expanded = this.element.getAttribute('aria-expanded') === 'true';
      this.setExpanded(!expanded);
      opts.onToggle?.(!expanded, this.element);
    };
    const onPointerDown = (): void => {
      if (this.element.disabled) return;
      this.element.setAttribute('data-state', 'pressed');
    };
    const onPointerUp = (): void => {
      if (this.element.getAttribute('data-state') === 'pressed') {
        this.element.setAttribute('data-state', 'normal');
      }
    };
    this.element.addEventListener('click', onActivate);
    this.element.addEventListener('pointerdown', onPointerDown);
    this.element.addEventListener('pointerup', onPointerUp);
    this.element.addEventListener('pointerleave', onPointerUp);
    this.detachers.push(() => {
      this.element.removeEventListener('click', onActivate);
      this.element.removeEventListener('pointerdown', onPointerDown);
      this.element.removeEventListener('pointerup', onPointerUp);
      this.element.removeEventListener('pointerleave', onPointerUp);
    });
  }

  setExpanded(expanded: boolean): this {
    this.element.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    this.element.setAttribute('data-facing', expanded ? 'down' : 'right');
    return this;
  }

  get expanded(): boolean {
    return this.element.getAttribute('aria-expanded') === 'true';
  }

  setDisabled(disabled: boolean): this {
    this.element.disabled = disabled;
    if (disabled) this.element.setAttribute('aria-disabled', 'true');
    else this.element.removeAttribute('aria-disabled');
    return this;
  }

  unmount(): this {
    for (const d of this.detachers) d();
    this.detachers = [];
    this.element.classList.remove('aaron-control', 'aaron-disclosure');
    this.element.removeAttribute('data-aaron-promoted');
    this.element.removeAttribute('data-state');
    this.element.removeAttribute('data-facing');
    return this;
  }
}

/**
 * Promote any `[data-aaron-disclosure]` buttons in the root into
 * AaronDisclosure. Idempotent — already-promoted buttons are skipped.
 */
export function promoteDisclosures(root: ParentNode = document.body): AaronDisclosure[] {
  const sel = 'button[data-aaron-disclosure]:not([data-aaron-promoted])';
  const buttons = Array.from(root.querySelectorAll<HTMLButtonElement>(sel));
  return buttons.map((b) => new AaronDisclosure(b));
}
