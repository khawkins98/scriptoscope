// Interactivity layer — wires real interaction onto the rendered chrome/controls.
//
// The compositor already renders per-STATE cicns (ControlState normal/pressed/
// disabled/inactive; renderWindow active/inactive), so interaction is a thin
// event → state → re-render layer, NOT new pixel logic. Because composing is
// async (cicn loading) we PRE-RENDER the discrete states once and swap the
// canvas instantly on events (snappy, no async mid-interaction). Each control is
// a non-semantic cicn canvas, so we wrap it in a FOCUSABLE element carrying the
// ARIA role + keyboard handlers.
//
// Phase 1: button press · checkbox · radio group · disclosure · window focus.
// (Phase 2 — scrollbar/slider drag + title-bar widget hit-testing — is deferred;
// see docs/tracking/interactivity-plan.md.)

import {
  composeButton, composeCheckable, composeDisclosure,
  baselineButton, baselineCheckable, bufferToCanvas,
  type ButtonOptions,
} from './controls.js';
import { renderWindow, type RenderWindowOptions } from './renderWindow.js';
import type { LoadedTheme } from './types.js';

const KEY_ACTIVATE = (e: KeyboardEvent): boolean => e.key === ' ' || e.key === 'Enter' || e.key === 'Spacebar';

// ── Button ──────────────────────────────────────────────────────────────────
export interface InteractiveButtonOptions extends ButtonOptions {
  /** Fired on a completed click / Space / Enter (not while merely pressed). */
  onClick?: () => void;
  scale?: number;
}

/**
 * A themed push button that depresses on press (the scheme's pressed cicn) and
 * fires `onClick` on release / keyboard activation. Falls back to the native
 * baseline button when the scheme ships no push-button cicns.
 */
export async function interactiveButton(
  theme: LoadedTheme,
  opts: InteractiveButtonOptions = {},
): Promise<HTMLElement> {
  const { onClick, scale = 1, ...bo } = opts;
  const normalBuf = await composeButton(theme, { ...bo, pressed: false });
  if (!normalBuf) {
    // No themed button cicns → the native CSS baseline button is already a real,
    // accessible, interactive <button>.
    const b = baselineButton(bo.label ?? '', bo);
    if (onClick && !bo.disabled) b.addEventListener('click', onClick);
    return b;
  }
  const pressedBuf = bo.disabled ? null : await composeButton(theme, { ...bo, pressed: true });
  const normal = bufferToCanvas(normalBuf, scale);
  const pressed = pressedBuf ? bufferToCanvas(pressedBuf, scale) : normal;

  const el = document.createElement('span');
  el.className = 'aw-button';
  el.setAttribute('role', 'button');
  el.tabIndex = bo.disabled ? -1 : 0;
  if (bo.label) el.setAttribute('aria-label', bo.label);
  if (bo.disabled) el.setAttribute('aria-disabled', 'true');
  Object.assign(el.style, {
    display: 'inline-block', lineHeight: '0', userSelect: 'none',
    cursor: bo.disabled ? 'default' : 'pointer', outlineOffset: '2px',
  } satisfies Partial<CSSStyleDeclaration>);
  el.appendChild(normal);
  if (bo.disabled) return el;

  let down = false;
  const press = (): void => { down = true; el.replaceChildren(pressed); };
  const release = (fire: boolean): void => {
    if (!down) return;
    down = false;
    el.replaceChildren(normal);
    if (fire && onClick) onClick();
  };
  el.addEventListener('mousedown', (e) => { e.preventDefault(); press(); });
  el.addEventListener('mouseup', () => release(true));
  el.addEventListener('mouseleave', () => release(false));
  el.addEventListener('keydown', (e) => { if (KEY_ACTIVATE(e)) { e.preventDefault(); press(); } });
  el.addEventListener('keyup', (e) => { if (KEY_ACTIVATE(e)) { e.preventDefault(); release(true); } });
  return el;
}

// ── Checkbox / Radio ──────────────────────────────────────────────────────────
export interface InteractiveCheckableOptions {
  label?: string;
  checked?: boolean;
  disabled?: boolean;
  fg?: string;
  scale?: number;
  onChange?: (checked: boolean) => void;
}

/** A live checkable: holds {checked, unchecked} canvases and swaps on toggle. */
interface Toggle {
  /** The focusable element to mount. */
  el: HTMLElement;
  /** Current checked state. */
  get(): boolean;
  /** Set state programmatically (no event); used by radio-group exclusivity. */
  set(checked: boolean): void;
}

async function buildToggle(
  theme: LoadedTheme,
  kind: 'checkbox' | 'radio',
  opts: InteractiveCheckableOptions,
): Promise<Toggle> {
  const { label, disabled = false, fg, scale = 1, onChange } = opts;
  let checked = opts.checked ?? false;
  // exactOptionalPropertyTypes: only include label/fg when actually set.
  const base = { disabled, ...(label !== undefined ? { label } : {}), ...(fg !== undefined ? { fg } : {}) };
  const onBuf = await composeCheckable(theme, kind, { ...base, checked: true });
  const offBuf = await composeCheckable(theme, kind, { ...base, checked: false });

  const el = document.createElement('span');
  el.className = `aw-${kind}`;
  el.setAttribute('role', kind);
  el.tabIndex = disabled ? -1 : 0;
  if (label) el.setAttribute('aria-label', label);
  el.setAttribute('aria-checked', String(checked));
  if (disabled) el.setAttribute('aria-disabled', 'true');
  Object.assign(el.style, {
    display: 'inline-flex', alignItems: 'center', gap: '5px', lineHeight: '0',
    userSelect: 'none', cursor: disabled ? 'default' : 'pointer', outlineOffset: '2px',
    font: '12px Charcoal, Geneva, sans-serif', color: disabled ? '#9a9a9a' : '#000',
  } satisfies Partial<CSSStyleDeclaration>);

  const paint = (): void => {
    const buf = checked ? onBuf : offBuf;
    el.replaceChildren();
    if (buf) el.appendChild(bufferToCanvas(buf, scale)); // themed cicn (label baked in)
    else el.appendChild(baselineCheckable(kind, label ?? '', { checked, disabled })); // baseline box + label
    el.setAttribute('aria-checked', String(checked));
  };
  paint();

  const set = (next: boolean): void => { if (next === checked) return; checked = next; paint(); };
  if (!disabled) {
    const toggle = (): void => {
      // Radios don't un-check on self-click; checkboxes flip.
      const next = kind === 'radio' ? true : !checked;
      if (next === checked) return;
      checked = next;
      paint();
      if (onChange) onChange(checked);
    };
    el.addEventListener('click', toggle);
    el.addEventListener('keydown', (e) => { if (KEY_ACTIVATE(e)) { e.preventDefault(); toggle(); } });
  }
  return { el, get: () => checked, set };
}

/** A standalone interactive checkbox. */
export async function interactiveCheckbox(
  theme: LoadedTheme,
  opts: InteractiveCheckableOptions = {},
): Promise<HTMLElement> {
  return (await buildToggle(theme, 'checkbox', opts)).el;
}

export interface RadioGroupOptions {
  items: { label?: string; value: string }[];
  value?: string;
  disabled?: boolean;
  scale?: number;
  onChange?: (value: string) => void;
}

/**
 * A radio group with single-selection: selecting one clears its siblings (the
 * exclusivity the kind='radio' toggle can't enforce alone). Returns a container
 * `role=radiogroup` of the rendered radios.
 */
export async function radioGroup(theme: LoadedTheme, opts: RadioGroupOptions): Promise<HTMLElement> {
  const { items, value, disabled = false, scale = 1, onChange } = opts;
  const group = document.createElement('div');
  group.setAttribute('role', 'radiogroup');
  Object.assign(group.style, { display: 'inline-flex', flexDirection: 'column', gap: '6px' });

  const toggles: { value: string; t: Toggle }[] = [];
  for (const item of items) {
    const t = await buildToggle(theme, 'radio', {
      ...(item.label !== undefined ? { label: item.label } : {}),
      disabled, scale, checked: item.value === value,
      onChange: (checked) => {
        if (!checked) return;
        for (const other of toggles) if (other.value !== item.value) other.t.set(false);
        if (onChange) onChange(item.value);
      },
    });
    toggles.push({ value: item.value, t });
    group.appendChild(t.el);
  }
  return group;
}

// ── Disclosure triangle ───────────────────────────────────────────────────────
export interface InteractiveDisclosureOptions {
  /** Initial state: 'right' = collapsed, 'down' = expanded. Default 'right'. */
  open?: boolean;
  scale?: number;
  onToggle?: (open: boolean) => void;
}

/**
 * A disclosure triangle that flips right↔down on click/keyboard and reports the
 * open state via `onToggle` (wire it to show/hide content).
 */
export async function interactiveDisclosure(
  theme: LoadedTheme,
  opts: InteractiveDisclosureOptions = {},
): Promise<HTMLElement> {
  const { scale = 1, onToggle } = opts;
  let open = opts.open ?? false;
  const closedBuf = await composeDisclosure(theme, { direction: 'right' });
  const openBuf = await composeDisclosure(theme, { direction: 'down' });

  const el = document.createElement('span');
  el.className = 'aw-disclosure';
  el.setAttribute('role', 'button');
  el.tabIndex = 0;
  el.setAttribute('aria-expanded', String(open));
  Object.assign(el.style, { display: 'inline-block', lineHeight: '0', cursor: 'pointer', outlineOffset: '2px' });

  const paint = (): void => {
    const buf = open ? openBuf : closedBuf;
    el.replaceChildren();
    if (buf) el.appendChild(bufferToCanvas(buf, scale));
    else { el.textContent = open ? '▼' : '▶'; el.style.lineHeight = '1'; el.style.font = '11px system-ui'; }
    el.setAttribute('aria-expanded', String(open));
  };
  paint();

  const toggle = (): void => { open = !open; paint(); if (onToggle) onToggle(open); };
  el.addEventListener('click', toggle);
  el.addEventListener('keydown', (e) => { if (KEY_ACTIVATE(e)) { e.preventDefault(); toggle(); } });
  return el;
}

// ── Window focus manager ────────────────────────────────────────────────────
interface ManagedWindow {
  theme: LoadedTheme;
  opts: RenderWindowOptions;
  host: HTMLElement;
  active: boolean;
}

/**
 * Tracks the focused window among several: clicking any window makes it active
 * (its chrome re-renders in the active state) and the rest inactive — the same
 * focus cue classic Mac draws. The active window is also raised in z-order.
 */
export class WindowManager {
  private windows: ManagedWindow[] = [];

  /**
   * Add a window. Returns a positioned host element (caller places it). The
   * FIRST window added is active by default.
   */
  async add(theme: LoadedTheme, opts: RenderWindowOptions = {}): Promise<HTMLElement> {
    const host = document.createElement('div');
    host.style.position = 'absolute';
    const entry: ManagedWindow = { theme, opts, host, active: this.windows.length === 0 };
    this.windows.push(entry);
    // mousedown (not click) so focus lands before any inner control acts.
    host.addEventListener('mousedown', () => { void this.focus(entry); });
    await this.render(entry);
    return host;
  }

  private async focus(entry: ManagedWindow): Promise<void> {
    if (entry.active) return;
    for (const w of this.windows) {
      const was = w.active;
      w.active = w === entry;
      if (w.active !== was) await this.render(w);
    }
  }

  private async render(entry: ManagedWindow): Promise<void> {
    const win = await renderWindow(entry.theme, {
      ...entry.opts,
      state: entry.active ? 'active' : 'inactive',
    });
    entry.host.style.zIndex = entry.active ? '2' : '1';
    entry.host.replaceChildren(win);
  }
}
