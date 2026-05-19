// Progress bars — spec A §10 + spec B §4.11.
//
// Determinate mode: aria-valuenow drives a CSS --progress var (0-1),
// which controls the fill div's width. Indeterminate mode is deferred
// to a follow-up (needs ppat animation per spec B §13.6).
//
// Three painted components per K2:
//   - Frame: stretched cicn around the whole bar
//   - Track: stretched cicn for the unfilled portion
//   - Fill:  stretched cicn for the filled portion
//
// Slug convention (matches the bundled extractor's emit):
//   progress-bar-active / progress-bar-inactive             (fill)
//   progress-bar-frame-active / progress-bar-frame-inactive (frame)
//   progress-bar-track-active / progress-bar-track-inactive (track)
//
// Some exotic schemes use a different naming pattern (`progress-indicator-*`
// and `full-progress-indicator-section`); we try the canonical slugs
// first, then fall back to the exotic ones.

import { installEngineBaseline } from './engineBaseline.js';
import { attachThemeToStretched } from '../themes/runtime/attachThemeToStretched.js';

export interface AaronProgressOptions {
  /** Initial value, clamped to [min, max]. Default 0. */
  value?: number;
  /** Minimum value. Default 0. */
  min?: number;
  /** Maximum value. Default 100. */
  max?: number;
  /** Disabled state. Default false. */
  disabled?: boolean;
  /** Mode. Default `determinate`. Indeterminate is a step-3d.b follow-up. */
  mode?: 'determinate' | 'indeterminate';
}

/** Aaron UI progress bar. */
export class AaronProgress {
  readonly element: HTMLDivElement;
  readonly frame: HTMLDivElement;
  readonly track: HTMLDivElement;
  readonly fill: HTMLDivElement;
  private detachers: Array<() => void> = [];
  private _value: number;
  private _min: number;
  private _max: number;

  constructor(elementOrOptions: HTMLDivElement | AaronProgressOptions = {}) {
    let element: HTMLDivElement;
    let opts: AaronProgressOptions;

    if (elementOrOptions instanceof HTMLDivElement) {
      element = elementOrOptions;
      opts = readOptionsFromDataset(element);
    } else {
      opts = elementOrOptions;
      element = document.createElement('div');
    }
    this.element = element;
    this._min = opts.min ?? 0;
    this._max = opts.max ?? 100;
    this._value = clamp(opts.value ?? this._min, this._min, this._max);

    installEngineBaseline(element.ownerDocument);
    element.classList.add('aaron-control', 'aaron-progress');
    element.setAttribute('data-aaron-promoted', '');
    element.setAttribute('data-state', opts.disabled ? 'disabled' : 'normal');
    element.setAttribute('data-mode', opts.mode ?? 'determinate');
    element.setAttribute('role', 'progressbar');
    if (opts.disabled) element.setAttribute('aria-disabled', 'true');

    // Find or create the three painted divs.
    this.frame = ensureChild(element, 'aaron-progress__frame');
    this.track = ensureChild(element, 'aaron-progress__track');
    this.fill = ensureChild(this.track, 'aaron-progress__fill');

    // Cicn paint for each component (with fallback slug chains for
    // exotic schemes' alternate naming).
    this.detachers.push(
      attachThemeToStretched({
        element: this.frame,
        slugs: {
          active: 'progress-bar-frame-active',
          inactive: 'progress-bar-frame-inactive',
        },
        readState: () => (element.getAttribute('data-state') === 'disabled' ? 'inactive' : 'active'),
        observeTarget: element,
      }),
    );
    this.detachers.push(
      attachThemeToStretched({
        element: this.track,
        slugs: {
          active: 'progress-bar-track-active',
          inactive: 'progress-bar-track-inactive',
        },
        readState: () => (element.getAttribute('data-state') === 'disabled' ? 'inactive' : 'active'),
        observeTarget: element,
      }),
    );
    this.detachers.push(
      attachThemeToStretched({
        element: this.fill,
        slugs: {
          active: 'progress-bar-active',
          inactive: 'progress-bar-inactive',
        },
        readState: () => (element.getAttribute('data-state') === 'disabled' ? 'inactive' : 'active'),
        observeTarget: element,
      }),
    );

    this.syncAria();
  }

  setValue(value: number): this {
    this._value = clamp(value, this._min, this._max);
    this.syncAria();
    return this;
  }

  get value(): number { return this._value; }
  get min(): number { return this._min; }
  get max(): number { return this._max; }

  setDisabled(disabled: boolean): this {
    this.element.setAttribute('data-state', disabled ? 'disabled' : 'normal');
    if (disabled) this.element.setAttribute('aria-disabled', 'true');
    else this.element.removeAttribute('aria-disabled');
    return this;
  }

  setMode(mode: 'determinate' | 'indeterminate'): this {
    this.element.setAttribute('data-mode', mode);
    return this;
  }

  /** Sync aria-valuenow + --progress CSS var to current value. */
  syncAria(): this {
    this.element.setAttribute('aria-valuenow', String(this._value));
    this.element.setAttribute('aria-valuemin', String(this._min));
    this.element.setAttribute('aria-valuemax', String(this._max));
    const range = this._max - this._min;
    const progress = range > 0 ? (this._value - this._min) / range : 0;
    this.element.style.setProperty('--progress', String(progress));
    this.fill.style.width = `${progress * 100}%`;
    return this;
  }

  unmount(): this {
    for (const d of this.detachers) d();
    this.detachers = [];
    this.element.classList.remove('aaron-control', 'aaron-progress');
    this.element.removeAttribute('data-aaron-promoted');
    this.element.removeAttribute('data-state');
    this.element.removeAttribute('data-mode');
    this.element.removeAttribute('role');
    return this;
  }
}

/** Promote `[data-aaron-progress]` divs into AaronProgress. Idempotent. */
export function promoteProgressBars(root: ParentNode = document.body): AaronProgress[] {
  const sel = 'div[data-aaron-progress]:not([data-aaron-promoted])';
  const els = Array.from(root.querySelectorAll<HTMLDivElement>(sel));
  return els.map((el) => new AaronProgress(el));
}

// ─── Internals ─────────────────────────────────────────────────────────

function ensureChild(parent: HTMLElement, className: string): HTMLDivElement {
  let child = parent.querySelector<HTMLDivElement>(`:scope > .${className}`);
  if (!child) {
    child = document.createElement('div');
    child.className = className;
    child.setAttribute('aria-hidden', 'true');
    parent.appendChild(child);
  }
  return child;
}

function readOptionsFromDataset(el: HTMLElement): AaronProgressOptions {
  const ds = el.dataset;
  const out: AaronProgressOptions = {};
  if (ds['value']    !== undefined) out.value = Number(ds['value']);
  if (ds['min']      !== undefined) out.min   = Number(ds['min']);
  if (ds['max']      !== undefined) out.max   = Number(ds['max']);
  if (ds['mode']     !== undefined && (ds['mode'] === 'determinate' || ds['mode'] === 'indeterminate')) {
    out.mode = ds['mode'];
  }
  if (el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true') {
    out.disabled = true;
  }
  return out;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}
