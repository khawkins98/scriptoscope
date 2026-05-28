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
// Phase 2: slider/scrollbar drag · title-bar widget hit-testing (close/zoom/
// collapse). See docs/tracking/interactivity-plan.md.

import {
  composeButton, composeCheckable, composeDisclosure, composeSlider, composeScrollbar,
  baselineButton, baselineCheckable, bufferToCanvas,
  type ButtonOptions, type ControlState,
} from './controls.js';
import { platinumSlider, platinumScrollbar } from './platinum.js';
import { renderWindow, resolveTitleWidgetRects, type RenderWindowOptions } from './renderWindow.js';
import type { PixelBuffer } from './pixelBuffer.js';
import type { ComposedChrome } from './composeChrome.js';
import type { LoadedTheme } from './types.js';
import { resolveInChain } from './baseChain.js';

type Orientation = 'horizontal' | 'vertical';
const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));

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
  // Pointer events cover mouse + touch + pen in one path. pointerleave releases without firing the
  // click (canceled drag-away); pointerup fires it.
  el.addEventListener('pointerdown', (e) => { e.preventDefault(); press(); });
  el.addEventListener('pointerup', () => release(true));
  el.addEventListener('pointerleave', () => release(false));
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
  // Attach the setter on the element so callers (e.g. the declarative layer's radio-group sync) can
  // drive the visual state from the outside without an internal-API leak.
  (el as unknown as { _awSetChecked: (v: boolean) => void })._awSetChecked = set;
  return { el, get: () => checked, set };
}

/** A standalone interactive checkbox. */
export async function interactiveCheckbox(
  theme: LoadedTheme,
  opts: InteractiveCheckableOptions = {},
): Promise<HTMLElement> {
  return (await buildToggle(theme, 'checkbox', opts)).el;
}

/** A standalone interactive radio (group exclusivity is the consumer's job — when wrapping native
 *  inputs, the browser handles it via shared `name`; the visual sync is via `_awSetChecked`). */
export async function interactiveRadio(
  theme: LoadedTheme,
  opts: InteractiveCheckableOptions = {},
): Promise<HTMLElement> {
  return (await buildToggle(theme, 'radio', opts)).el;
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

// ── Slider / scrollbar (drag) ─────────────────────────────────────────────────
export interface InteractiveSliderOptions {
  orientation?: Orientation;
  length?: number;
  /** Initial thumb position, 0..1. */
  value?: number;
  scale?: number;
  onChange?: (value: number) => void;
}
export interface InteractiveScrollbarOptions extends InteractiveSliderOptions {
  /** Thumb size as a fraction of the track, 0..1. */
  thumbExtent?: number;
}

/**
 * Shared 1-D drag wiring: pointer position along the axis → value 0..1 (the
 * compositor maps value linearly along the track), re-rendering the control in
 * the pressed state while dragging. The re-compose is async (cicn loading) so
 * it's coalesced to one per animation frame; `onChange` fires immediately. The
 * element is a `role=slider` with arrow-key support.
 */
async function buildDraggable(
  el: HTMLElement,
  orientation: Orientation,
  initial: number,
  scale: number,
  compose: (value: number, state: ControlState) => Promise<PixelBuffer | null> | PixelBuffer,
  onChange?: (value: number) => void,
): Promise<void> {
  let value = clamp01(initial);
  let dragging = false;
  let raf = 0;
  el.setAttribute('role', 'slider');
  el.setAttribute('aria-orientation', orientation);
  el.setAttribute('aria-valuemin', '0');
  el.setAttribute('aria-valuemax', '100');
  el.tabIndex = 0;
  Object.assign(el.style, {
    display: 'inline-block', lineHeight: '0', userSelect: 'none',
    touchAction: 'none', cursor: 'pointer', outlineOffset: '2px',
    // Opt out of any flex parent's align-items:stretch — otherwise the element grows wider than the
    // canvas inside it, and the hit-test rect no longer matches what the user sees (clicking the
    // visible thumb lands somewhere far off the actual value). Slider lived in the Inspector's
    // `.row.col` (flex column, stretch) which made the element 220px wide around a 120px canvas.
    alignSelf: 'start', verticalAlign: 'middle',
  } satisfies Partial<CSSStyleDeclaration>);

  const repaint = async (): Promise<void> => {
    const buf = await compose(value, dragging ? 'pressed' : 'normal');
    if (buf) el.replaceChildren(bufferToCanvas(buf, scale));
    el.setAttribute('aria-valuenow', String(Math.round(value * 100)));
  };
  await repaint();

  // Map pointer→value against the CANVAS rect (the actual visual surface), not the element rect.
  // The element can be stretched by a parent layout; the canvas always reflects what the user sees.
  const valueAt = (e: PointerEvent): number => {
    const canvas = el.querySelector('canvas');
    const r = (canvas ?? el).getBoundingClientRect();
    const t = orientation === 'horizontal' ? (e.clientX - r.left) / r.width : (e.clientY - r.top) / r.height;
    return clamp01(t);
  };
  const schedule = (): void => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; void repaint(); }); };
  const onMove = (e: PointerEvent): void => { value = valueAt(e); onChange?.(value); schedule(); };
  const onUp = (): void => {
    dragging = false;
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    void repaint();
  };
  el.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    dragging = true;
    value = valueAt(e);
    onChange?.(value);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    void repaint();
  });
  el.addEventListener('keydown', (e) => {
    const step = e.shiftKey ? 0.1 : 0.05;
    let next = value;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') next = clamp01(value + step);
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') next = clamp01(value - step);
    else return;
    e.preventDefault();
    value = next;
    onChange?.(value);
    void repaint();
  });
}

/** A draggable slider (themed where the scheme ships slider cicns, else procedural). */
export async function interactiveSlider(theme: LoadedTheme, opts: InteractiveSliderOptions = {}): Promise<HTMLElement> {
  const { orientation = 'horizontal', length = 120, value = 0.5, scale = 1, onChange } = opts;
  const el = document.createElement('span');
  el.className = 'aw-slider';
  await buildDraggable(el, orientation, value, scale,
    async (v, state) => (await composeSlider(theme, { orientation, length, value: v, state }))
      ?? platinumSlider({ orientation, length, value: v }),
    onChange);
  return el;
}

/** A draggable scrollbar thumb (drag along the track sets the position). */
export async function interactiveScrollbar(theme: LoadedTheme, opts: InteractiveScrollbarOptions = {}): Promise<HTMLElement> {
  const { orientation = 'vertical', length = 120, value = 0.3, thumbExtent = 0.3, scale = 1, onChange } = opts;
  const el = document.createElement('span');
  el.className = 'aw-scrollbar';
  await buildDraggable(el, orientation, value, scale,
    async (v, state) => (await composeScrollbar(theme, { orientation, length, value: v, thumbExtent, state }))
      ?? platinumScrollbar({ orientation, length, value: v, thumbExtent }),
    onChange);
  return el;
}

// ── Title-bar widget hit-testing ──────────────────────────────────────────────
export type TitleWidget = 'close' | 'zoom' | 'collapse';
export interface TitleWidgetHandlers {
  onClose?: () => void;
  onZoom?: () => void;
  onCollapse?: () => void;
}
/** A widget hit zone in the window element's own (scaled) pixel space. */
export interface TitleWidgetHit {
  role: TitleWidget;
  rect: { x: number; y: number; w: number; h: number };
}

/**
 * Resolve the title-bar widget hit zones for a cicn-rendered window. The widget
 * art is BAKED into the chrome cicn; the scheme exposes each widget's cicn-pixel
 * rect as a `wnd#` part (`part-1`…, with `part-0` the body and any ≤2px-wide
 * top-band part being the title-text MARKER, not a widget). We map each cicn rect
 * onto the STRETCHED window: the title bar grows in its middle, so left-anchored
 * widgets keep their x while right-anchored widgets shift right by the same
 * amount the compositor shifted the right fixed band (the max src→out delta among
 * the top cells, == fullWidth − drawableWidth). Roles follow the classic Mac
 * title-bar layout — close at the left; on the right the far box is the zoom, an
 * inner one the collapse/windowshade — a HIG-layout heuristic (the only signal
 * the scheme carries is the widgets' positions, not labels).
 */
export function titleWidgetHits(
  theme: LoadedTheme,
  windowType: string,
  composed: ComposedChrome,
  scale: number,
): TitleWidgetHit[] {
  // Resolve the window type through the BASE chain, mirroring renderWindow: a
  // scheme that ships no window chrome of its own (e.g. apple-platinum-2 — no
  // `windowTypes` map at all) renders its base's chrome, so its widget rects
  // come from the base too. (`windowTypes` may be absent entirely → optional
  // chaining, not an index into undefined.)
  const wt = resolveInChain(theme, (t) => t.manifest.windowTypes?.[windowType]);
  if (!wt) return [];
  // Single source of truth (renderWindow.resolveTitleWidgetRects) — gives UNSCALED rects + roles;
  // the hit zones are those ×scale (the window element's own scaled pixel space).
  return resolveTitleWidgetRects(wt, composed).map(({ role, rect }) => ({
    role,
    rect: { x: rect.x * scale, y: rect.y * scale, w: rect.w * scale, h: rect.h * scale },
  }));
}

// ── Window focus manager ────────────────────────────────────────────────────
interface ManagedWindow {
  theme: LoadedTheme;
  opts: RenderWindowOptions;
  handlers: TitleWidgetHandlers;
  host: HTMLElement;
  active: boolean;
  /** Stacking order. Bumped to the top each focus; render() maps it to z-index (active windows sit
   *  above inactive ones at the same recency). Generalizes the old two-level (1/2) z so 3+ windows
   *  and modals stack correctly. */
  z: number;
  /** Window-shade (classic Mac "collapse"): when true, render() rolls the window up to its title bar
   *  (collapsed window-type slug + zero-height body, content hidden). `opts.height` is left at the
   *  EXPANDED height, so un-shading just renders again — no separate stash needed. */
  collapsed?: boolean;
  /** Zoom toggle: the user/declared size to restore when un-zooming (zoom grows to fit the content).
   *  Captures width/height INCLUDING undefined, so un-zooming a size-less window correctly restores it
   *  to size-less (not stuck at the zoomed size). */
  zoomed?: boolean;
  userSize?: { width: number | undefined; height: number | undefined };
  /** Aborts the previous render's scrollbar listeners. The wheel listener lives on the PERSISTENT
   *  scroll container (the slot survives re-slotting), so without this it would accumulate one per
   *  render — multiplying scroll speed and leaking. Re-created each time the bar is (re)wired. */
  scrollAbort?: AbortController;
  /** Optional persistent content node (the declarative layer's slotted consumer DOM). Re-attached
   *  into the freshly-built `.aw-content` after every render() — `renderWindow` rebuilds the window
   *  subtree, so without this the slotted content would be destroyed on focus/resize. */
  contentEl?: HTMLElement;
}

/** Find a theme's window-shade (collapsed) variant slug for a base window type, if it ships one.
 *  Returned slug is passed to renderWindow EXPLICITLY — `resolveWindowType` exact-matches it before
 *  the utility scan that deliberately skips `/collapsed/` keys, so the shade chrome resolves. */
function collapsedSlugFor(theme: LoadedTheme, baseSlug: string): string | undefined {
  const wts = theme.manifest.windowTypes ?? {};
  // Only accept a candidate that resolveWindowType would actually render as a window (top edge recipe
  // + a part-0 body rect) — otherwise return undefined so effectiveSlug's `?? base` fallback (same type
  // at zero body height) kicks in, instead of renderWindow dropping to the procedural baseline.
  const ok = (k: string): string | undefined => {
    const v = wts[k];
    return v && v.edges?.top?.length && v.parts?.['part-0']?.rect ? k : undefined;
  };
  const noun = baseSlug.replace(/-window$/, '');
  for (const c of [`collapsed-${baseSlug}`, `collapsed-${noun}`]) { const r = ok(c); if (r) return r; }
  for (const k of Object.keys(wts)) if (k.startsWith('collapsed') && k.includes(noun)) { const r = ok(k); if (r) return r; }
  return undefined;
}

/**
 * Tracks the focused window among several: clicking any window makes it active
 * (its chrome re-renders in the active state) and the rest inactive — the same
 * focus cue classic Mac draws. The active window is also raised in z-order.
 * Title-bar widgets (close/zoom/collapse) are hit-tested from the chrome and
 * fire the matching handler when clicked.
 */
export class WindowManager {
  private windows: ManagedWindow[] = [];
  /** Monotonic stacking clock — each add/focus takes the next value so the most-recently-touched
   *  window is frontmost. render() adds a large offset for the active window so it sits above all
   *  inactive ones (classic "active window on top", with inactive windows in recency order beneath). */
  private zClock = 0;

  /**
   * Add a window. Returns a positioned host element (caller places it). The
   * FIRST window added is active by default. `handlers` wire the title-bar
   * widgets; a transparent focusable button is overlaid on each widget that has
   * a handler (the widget art itself lives in the chrome cicn).
   */
  async add(
    theme: LoadedTheme,
    opts: RenderWindowOptions = {},
    handlers: TitleWidgetHandlers = {},
    extra: { contentEl?: HTMLElement; z?: number; collapsed?: boolean } = {},
  ): Promise<HTMLElement> {
    const host = document.createElement('div');
    host.style.position = 'absolute';
    // SHADOW DOM (ADR-0001 Decision 2): attach a shadow root to the host. The window's chrome
    // canvas + DOM-twin widgets + grow box + themed scrollbars all live inside the shadow root —
    // shielded from host-page CSS that targets div/canvas/button universally or via resets. The
    // consumer's content lives in the host's LIGHT DOM (set below if extra.contentEl), where
    // host CSS still reaches it; renderWindow's <slot> inside .aw-content auto-renders it.
    host.attachShadow({ mode: 'open' });
    if (extra.contentEl) host.appendChild(extra.contentEl);  // light-DOM child → slotted into shadow
    // NB: role + aria-label live on the INNER `.aw-window` element built by renderWindow.ts (which
    // emits role=dialog for utility windows, role=group otherwise; aria-label=title). Don't duplicate
    // them on the host — double-labelling makes screen readers announce the window twice.
    // Initial focus: the first window added is active — UNLESS it explicitly requests inactive
    // (so a declarative `data-aaron-state="inactive"` is honored; then no window starts focused).
    const entry: ManagedWindow = {
      theme, opts, handlers, host,
      active: this.windows.length === 0 && opts.state !== 'inactive',
      // Declared z (data-aaron-z) wins; else take the next stacking-clock tick. We still bump the
      // clock either way so subsequent focus events stay monotonic relative to any declared values.
      z: extra.z ?? ++this.zClock,
      ...(extra.collapsed ? { collapsed: true } : {}),
      ...(extra.contentEl ? { contentEl: extra.contentEl } : {}),
    };
    if (extra.z != null && extra.z > this.zClock) this.zClock = extra.z; // keep clock above declared
    this.windows.push(entry);
    // mousedown (not click) so focus lands before any inner control acts.
    host.addEventListener('pointerdown', () => { void this.focus(entry); });
    await this.render(entry);
    return host;
  }

  /** Stop managing a window (its host was/will be removed by the caller). Aborts its scrollbar
   *  listeners and drops the entry so it's not re-rendered/re-themed later. Idempotent. */
  remove(host: HTMLElement): void {
    const i = this.windows.findIndex((w) => w.host === host);
    if (i < 0) return;
    this.windows[i]?.scrollAbort?.abort();
    this.windows.splice(i, 1);
  }

  /** Re-render an already-added window at a new CONTENT size (used by the declarative content-fit
   *  path). No-op if the host isn't managed or the size is unchanged. Public so the declarative
   *  layer can drive resize without reaching into private state. */
  async setContentSize(host: HTMLElement, width: number, height: number): Promise<void> {
    const entry = this.windows.find((w) => w.host === host);
    if (!entry) return;
    if (entry.opts.width === width && entry.opts.height === height) return;
    entry.opts = { ...entry.opts, width, height };
    await this.render(entry);
  }

  /** Re-skin every managed window with a new theme and re-render in place (the persistent slotted
   *  content survives, exactly as on a focus re-render). Drives the declarative theme-switcher — the
   *  whole desktop changes scheme at runtime, the Kaleidoscope way. Public for imperative consumers. */
  async retheme(theme: LoadedTheme): Promise<void> {
    // Drop entries whose host is no longer in the document (e.g. a demo dismissed the window via
    // `.aw-window.remove()` without going through manager.remove). Without this, retheme would
    // render-into-detached-DOM for every dismissed window on every theme switch.
    this.windows = this.windows.filter((w) => w.host.isConnected);
    for (const w of this.windows) { w.theme = theme; await this.render(w); }
  }

  private async focus(entry: ManagedWindow): Promise<void> {
    entry.z = ++this.zClock; // raise above all (even if already active — re-clicking a window fronts it)
    if (entry.active) { entry.host.style.zIndex = this.zIndexFor(entry); return; }
    for (const w of this.windows) {
      const was = w.active;
      w.active = w === entry;
      if (w.active !== was) await this.render(w);
      else w.host.style.zIndex = this.zIndexFor(w); // refresh the loser's z without a full re-render
    }
  }

  /** Active windows float above inactive ones; within each group, higher zClock (more recent) wins. */
  private zIndexFor(entry: ManagedWindow): string {
    return String((entry.active ? 100_000 : 0) + entry.z);
  }

  /** The window-type slug actually rendered: the collapsed variant when shaded, else the base type. */
  private effectiveSlug(entry: ManagedWindow): string {
    const base = entry.opts.windowType ?? 'document-window';
    // Window-shade: render the collapsed chrome variant (title-bar-only art) if the theme ships one,
    // else fall back to the same type at zero body height — both roll the window up to the title bar.
    return entry.collapsed ? (collapsedSlugFor(entry.theme, base) ?? base) : base;
  }

  /**
   * Re-render a window's chrome (rebuilds the canvas + overlays + scrollbars).
   *
   * RENDER FREQUENCY CONTRACT (audited 2026-05-28, verified in browser):
   * render() fires only on state changes that affect the painted pixels:
   *   • add()                      — first render
   *   • setContentSize()           — width/height changed (guarded against equal)
   *   • retheme()                  — theme changed
   *   • focus()                    — only for windows whose `active` state actually flipped
   *                                  (same-window re-click → 0 renders, just bumps z-index)
   *   • toggleCollapse()           — shade state changed
   *   • toggleZoom()               — zoom dimensions changed
   *   • keyboard resize (line ~844)— size changed
   *   • pointer resize endpoint    — once at mouseup; the in-progress drag draws an
   *                                  outline (CSS-only). NOT per-mousemove.
   *
   * Title-bar drag uses CSS left/top updates (cheap), not render(). Per-frame
   * canvas re-paints during interactive drag would be the expensive thing
   * to introduce — measured baseline is 2 renders on focus-change between two
   * windows, N renders on a theme switch (one per window). Don't regress this.
   */
  private async render(entry: ManagedWindow): Promise<void> {
    const collapsed = entry.collapsed === true;
    const slug = this.effectiveSlug(entry);
    const win = await renderWindow(entry.theme, {
      ...entry.opts,
      windowType: slug,
      ...(collapsed ? { height: 0 } : {}),
      state: entry.active ? 'active' : 'inactive',
    });
    entry.host.style.zIndex = this.zIndexFor(entry);
    this.overlayWidgets(entry, win);
    this.wireMoveResize(entry, win);
    // Consumer content lives in the host's LIGHT DOM (placed there once in add()); renderWindow's
    // <slot> inside .aw-content auto-renders it. No per-render re-slotting needed — the slot
    // shows whatever's in light DOM, and the same DOM node persists across re-renders so
    // listeners + selection + scroll position survive.
    // When shaded, hide the content area (preserves the content node, just visually collapsed).
    if (collapsed) {
      const hole = win.querySelector('.aw-content') as HTMLElement | null;
      if (hole) hole.style.display = 'none';
    }
    // Mount the chrome into the SHADOW ROOT (attached in add()). Host CSS can't reach in;
    // light-DOM children (consumer content) are slotted via renderWindow's <slot>.
    const shadow = entry.host.shadowRoot;
    if (shadow) shadow.replaceChildren(win);
    else entry.host.replaceChildren(win);  // defensive fallback (host without shadow — shouldn't happen)
    // Themed scrollbar (replaces the native one) when the content overflows. Must run AFTER the window
    // is in the DOM — overflow can only be measured once the content is laid out.
    void this.wireScrollbars(entry, win, 0);
  }

  /**
   * Replace the native browser scrollbar with the scheme's own scrollbar art when declared-size
   * content overflows (content-fit windows grow to fit, so they never reach here). We own the scroll:
   * `.aw-content` goes `overflow:hidden`, a gutter is reserved on the relevant side(s), and themed
   * scrollbar(s) are overlaid — dragging the thumb, the wheel, and arrow keys all set scrollTop /
   * scrollLeft and repaint the thumb (two-way). Re-run on every render() (which rebuilds the subtree),
   * guarded against stale wins. `attempt` retries across a couple of frames for the first render, when
   * the host isn't in the document yet so nothing has layout. Detects + wires BOTH axes — vertical and
   * horizontal — independently, so a long-and-wide content gets both bars + a clear bottom-right corner.
   */
  private async wireScrollbars(entry: ManagedWindow, win: HTMLElement, attempt: number): Promise<void> {
    // Staleness check: is `win` still the current chrome? See LEARNINGS 2026-05-28 "Shadow DOM
    // gotchas" — host.firstChild is the slotted .aw-slot now, not win. We resolve via shadowRoot.
    // We deliberately do NOT use win.isConnected: AaronWindow.promote inserts the host into the
    // document AFTER manager.add returns, so the initial wireScrollbars fires while host is
    // still detached. The ch===0 retry below catches that pre-layout case; staleness is what
    // this check covers (a NEWER render replaced win).
    const currentChrome = entry.host.shadowRoot?.firstChild ?? entry.host.firstChild;
    if (currentChrome !== win) return;
    // Tear down the previous render's scrollbar listeners (esp. the wheel listener on the persistent
    // slot) BEFORE re-wiring, so they can't accumulate across renders/re-themes.
    entry.scrollAbort?.abort();
    if (entry.collapsed) return;                          // shaded: no body to scroll
    const composed = (win as unknown as { _awComposed?: ComposedChrome })._awComposed;
    const content = win.querySelector('.aw-content') as HTMLElement | null;
    if (!composed || !content) return;
    // Palettes / utility windows / modals / dialogs never scrolled in classic Mac — they're sized to
    // their content. Hard-clip them so neither a native nor a themed scrollbar can appear.
    const type = entry.opts.windowType ?? '';
    if (/utility|palette|floating|modal|dialog/.test(type)) {
      (entry.contentEl ?? content).style.overflow = 'hidden';
      return;
    }
    // The real scroll container is the declarative layer's slot (entry.contentEl, overflow:auto inside
    // .aw-content) when present, else .aw-content itself for plain WindowManager windows.
    const scrollEl = entry.contentEl ?? content;
    // Reset gutters from a previous wire so the natural-size measurement isn't inflated.
    scrollEl.style.paddingRight = '';
    scrollEl.style.paddingBottom = '';
    const ch = scrollEl.clientHeight;
    const cw = scrollEl.clientWidth;
    if (ch === 0 || cw === 0) {                           // not laid out yet (first render, pre-insert)
      if (attempt < 4) requestAnimationFrame(() => { void this.wireScrollbars(entry, win, attempt + 1); });
      return;
    }
    const needV = scrollEl.scrollHeight > ch + 1;
    const needH = scrollEl.scrollWidth > cw + 1;
    if (!needV && !needH) {
      scrollEl.style.overflowY = '';
      scrollEl.style.overflowX = '';
      return;
    }
    // Reserve the gutters BEFORE creating the bars so post-gutter scrollHeight/scrollWidth are correct.
    scrollEl.style.overflowY = needV ? 'hidden' : '';
    scrollEl.style.overflowX = needH ? 'hidden' : '';
    const scale = Math.max(1, Math.round(entry.opts.scale ?? 1));
    const gutter = 15 * scale;
    if (needV) scrollEl.style.paddingRight = `${gutter}px`;
    if (needH) scrollEl.style.paddingBottom = `${gutter}px`;

    const ac = new AbortController();
    entry.scrollAbort = ac;

    // Wire each axis independently. The two bars share the abort signal (re-render aborts both) +
    // the scroll element (wheel listener attached by whichever fires first; the other axis still
    // gets shift+wheel and its own thumb drag). Bottom-right corner left blank so the grow box
    // sits clear — vertical bar stops above the H gutter, horizontal bar stops before the V gutter.
    if (needV) this.wireScrollbarAxis('vertical', entry, win, scrollEl, composed, scale, ac.signal, { needV, needH });
    if (needH) this.wireScrollbarAxis('horizontal', entry, win, scrollEl, composed, scale, ac.signal, { needV, needH });
  }

  /**
   * Per-axis scrollbar wiring (vertical OR horizontal). The two axes share an AbortController so a
   * re-render aborts both; the bars are independent DOM elements with their own listeners.
   */
  private wireScrollbarAxis(
    axis: 'vertical' | 'horizontal',
    entry: ManagedWindow,
    win: HTMLElement,
    scrollEl: HTMLElement,
    composed: ComposedChrome,
    scale: number,
    signal: AbortSignal,
    flags: { needV: boolean; needH: boolean },
  ): void {
    const vertical = axis === 'vertical';
    // Per-axis dimensions (against the layout-complete scrollEl after gutter applied).
    const trackLen = vertical ? scrollEl.clientHeight : scrollEl.clientWidth;
    const contentLen = vertical ? scrollEl.scrollHeight : scrollEl.scrollWidth;
    const maxScroll = contentLen - trackLen;
    const thumbExtent = Math.max(0.08, trackLen / contentLen);
    // The OPPOSITE axis's gutter (when both bars present) eats into our track length so the bars
    // don't visually meet at a corner. ~15px reserved gives the grow box room too.
    const oppositeGutter = (vertical ? flags.needH : flags.needV) ? 15 * scale : 0;
    const growBoxClearance = composed.growBox && vertical ? (composed.growBox.h + 1) * scale : 0;
    const barLenCss = Math.max(32, trackLen - oppositeGutter - growBoxClearance);

    let value = maxScroll > 0 ? clamp01((vertical ? scrollEl.scrollTop : scrollEl.scrollLeft) / maxScroll) : 0;

    const bar = document.createElement('div');
    bar.className = `aw-window-scrollbar aw-window-scrollbar-${axis}`;
    Object.assign(bar.style, {
      position: 'absolute', zIndex: '3', lineHeight: '0', touchAction: 'none', cursor: 'default',
      ...(vertical
        ? { right: `${composed.frame.right * scale}px`, top: `${composed.frame.top * scale}px` }
        : { bottom: `${composed.frame.bottom * scale}px`, left: `${composed.frame.left * scale}px` }
      ),
    } satisfies Partial<CSSStyleDeclaration>);
    bar.setAttribute('role', 'scrollbar');
    bar.setAttribute('aria-orientation', axis);
    bar.setAttribute('aria-valuemin', '0');
    bar.setAttribute('aria-valuemax', '100');
    bar.setAttribute('aria-label', vertical ? 'Scroll content vertically' : 'Scroll content horizontally');
    bar.tabIndex = 0;

    let raf = 0;
    const repaint = async (): Promise<void> => {
      const opts = { orientation: axis, length: Math.round(barLenCss / scale), value, thumbExtent };
      const buf = (await composeScrollbar(entry.theme, opts)) ?? platinumScrollbar(opts);
      // Staleness check (see LEARNINGS 2026-05-28 — shadowRoot.firstChild not host.firstChild).
      if (buf && (entry.host.shadowRoot?.firstChild ?? entry.host.firstChild) === win) bar.replaceChildren(bufferToCanvas(buf, scale));
      bar.setAttribute('aria-valuenow', String(Math.round(value * 100)));
    };
    const scheduleRepaint = (): void => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; void repaint(); }); };
    const setValue = (v: number): void => {
      value = clamp01(v);
      if (vertical) scrollEl.scrollTop = value * maxScroll;
      else scrollEl.scrollLeft = value * maxScroll;
      scheduleRepaint();
    };

    win.appendChild(bar);

    // Drag the thumb (pointer = touch + mouse + pen).
    const valueAtPointer = (e: PointerEvent): number => {
      const r = bar.getBoundingClientRect();
      return clamp01(vertical ? (e.clientY - r.top) / r.height : (e.clientX - r.left) / r.width);
    };
    bar.addEventListener('pointerdown', (e) => {
      e.preventDefault(); e.stopPropagation();
      setValue(valueAtPointer(e));
      const mv = (ev: PointerEvent): void => setValue(valueAtPointer(ev));
      const up = (): void => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); };
      window.addEventListener('pointermove', mv, { signal }); window.addEventListener('pointerup', up, { signal });
    }, { signal });

    // Wheel: vertical bar handles deltaY (the dominant axis for mouse wheels); horizontal bar handles
    // deltaX (trackpad horizontal swipe) AND shift+deltaY (the convention for "wheel to scroll
    // horizontally"). Attach to the SAME scroll element — both listeners fire; each takes its axis.
    scrollEl.addEventListener('wheel', (e) => {
      if (vertical) {
        if (Math.abs(e.deltaY) < 0.5) return;
        e.preventDefault();
        setValue((scrollEl.scrollTop + e.deltaY) / maxScroll);
      } else {
        const dx = e.shiftKey ? e.deltaY : e.deltaX;
        if (Math.abs(dx) < 0.5) return;
        e.preventDefault();
        setValue((scrollEl.scrollLeft + dx) / maxScroll);
      }
    }, { passive: false, signal });

    // Arrow keys / page keys on the bar.
    bar.addEventListener('keydown', (e) => {
      const line = maxScroll > 0 ? 24 / maxScroll : 0;
      const page = trackLen / maxScroll;
      let next = value;
      if (vertical) {
        if (e.key === 'ArrowDown') next = value + line;
        else if (e.key === 'ArrowUp') next = value - line;
        else if (e.key === 'PageDown') next = value + page;
        else if (e.key === 'PageUp') next = value - page;
        else if (e.key === 'Home') next = 0;
        else if (e.key === 'End') next = 1;
        else return;
      } else {
        if (e.key === 'ArrowRight') next = value + line;
        else if (e.key === 'ArrowLeft') next = value - line;
        else if (e.key === 'PageDown') next = value + page;
        else if (e.key === 'PageUp') next = value - page;
        else if (e.key === 'Home') next = 0;
        else if (e.key === 'End') next = 1;
        else return;
      }
      e.preventDefault(); setValue(next);
    }, { signal });

    void repaint(); // initial thumb paint (staleness-guarded inside)
  }

  /** Toggle window-shade. Built-in for windows whose collapse widget has no explicit handler. */
  private async toggleCollapse(entry: ManagedWindow): Promise<void> {
    entry.collapsed = !entry.collapsed;
    await this.render(entry);
    entry.handlers.onCollapse?.();
  }

  /** Toggle zoom: grow to fit the content (capped), or restore the user/declared size. */
  private async toggleZoom(entry: ManagedWindow): Promise<void> {
    if (entry.collapsed) entry.collapsed = false; // zooming an un-shades first
    if (!entry.zoomed) {
      entry.userSize = { width: entry.opts.width, height: entry.opts.height }; // may be undefined — preserved
      const c = entry.contentEl;
      // Zoom-to-fit: show all content (classic "ideal size"), capped so it can't swallow the screen.
      const w = c ? Math.min(Math.max(c.scrollWidth, entry.opts.width ?? 0), 760) : Math.round((entry.opts.width ?? 240) * 1.5);
      const h = c ? Math.min(Math.max(c.scrollHeight, entry.opts.height ?? 0), 560) : Math.round((entry.opts.height ?? 120) * 1.5);
      entry.opts = { ...entry.opts, width: w, height: h };
      entry.zoomed = true;
    } else {
      // Restore the pre-zoom size, honoring undefined (delete the key) so a size-less window goes back
      // to size-less rather than sticking at the zoomed dimensions.
      const opts = { ...entry.opts };
      if (entry.userSize?.width != null) opts.width = entry.userSize.width; else delete opts.width;
      if (entry.userSize?.height != null) opts.height = entry.userSize.height; else delete opts.height;
      entry.opts = opts;
      entry.zoomed = false;
    }
    await this.render(entry);
    entry.handlers.onZoom?.();
  }

  /**
   * Make the window movable (drag the title bar) and resizable (drag the grow box). Move is live
   * (CSS left/top — cheap); resize draws a classic ghost OUTLINE during the drag and re-renders the
   * window at the new content size on release (faithful to the Mac grow-box, and avoids an async
   * re-render per mouse-move). Re-attached on every render(), so it tracks the current chrome.
   */
  private wireMoveResize(entry: ManagedWindow, win: HTMLElement): void {
    const composed = (win as unknown as { _awComposed?: ComposedChrome })._awComposed;
    if (!composed) return;
    const scale = Math.max(1, Math.round(entry.opts.scale ?? 1));
    const host = entry.host;

    // MOVE — mousedown anywhere on the FRAME (any inset edge), not just the top. Side-titled palette
    // windows (`side-floating-utility-window`) put their title strip on the LEFT, not the top, so a
    // top-only check would leave them un-draggable. "Frame" = the window rect minus the content rect.
    // Widgets (title boxes) and the grow-box corner stopPropagation, so they don't trigger drag; the
    // themed scrollbar (when present) also stopPropagation on pointerdown for the same reason.
    const inFrame = (e: MouseEvent): boolean => {
      const r = win.getBoundingClientRect();
      const dx = e.clientX - r.left, dy = e.clientY - r.top;
      const cx = composed.frame.left * scale, cy = composed.frame.top * scale;
      const cw = r.width - (composed.frame.left + composed.frame.right) * scale;
      const ch = r.height - (composed.frame.top + composed.frame.bottom) * scale;
      return !(dx >= cx && dx < cx + cw && dy >= cy && dy < cy + ch);
    };
    win.addEventListener('pointerdown', (e) => {
      if (!inFrame(e)) return; // inside the content body — not a drag handle
      if (e.pointerType === 'mouse' && e.button !== 0) return; // only primary mouse button initiates drag
      e.preventDefault();
      void this.focus(entry);
      const sx = e.clientX, sy = e.clientY;
      const x0 = parseFloat(host.style.left) || 0, y0 = parseFloat(host.style.top) || 0;
      const mv = (ev: PointerEvent): void => { host.style.left = `${x0 + ev.clientX - sx}px`; host.style.top = `${y0 + ev.clientY - sy}px`; };
      const up = (): void => { document.removeEventListener('pointermove', mv); document.removeEventListener('pointerup', up); };
      document.addEventListener('pointermove', mv); document.addEventListener('pointerup', up);
    });

    // Double-click any frame edge to window-shade (the classic Mac WindowShade gesture, side palettes
    // included — the side title strip is the natural target for a vertical title bar). Ignores
    // double-clicks on the widgets, the scrollbar, and the grow-box corner.
    win.addEventListener('dblclick', (e) => {
      const t = e.target as HTMLElement;
      if (t.closest('.aw-titlewidget') || t.closest('.aw-window-scrollbar')) return;
      if (!inFrame(e)) return;
      e.preventDefault();
      void this.toggleCollapse(entry);
    });

    // RESIZE — drag ONLY the bottom-right corner (the grow-box gripper), like classic Mac. NOT the
    // right/bottom edges: those run the length of the borders where the scrollbar tracks sit, and a
    // resize band there would steal their clicks. The corner square is safe — scrollbars stop above
    // and left of the grow box. The zone reaches inward to cover the gripper (which sits at the INNER
    // frame corner, over the content) plus the outer frame corner. Ghost outline; commit on release.
    // Mac OS hard minimum window width is 110px (native): clamp the CONTENT width so the FULL window
    // (content + chrome, chrome being constant) never drops below it.
    const minContentW = Math.max(40, 110 - (composed.fullWidth - (entry.opts.width ?? 240)));
    const cw = (Math.max(7, composed.frame.right) + (composed.growBox?.w ?? 15)) * scale;
    const ch = (Math.max(7, composed.frame.bottom) + (composed.growBox?.h ?? 15)) * scale;
    const corner = document.createElement('button');
    corner.type = 'button';
    corner.className = 'aw-growbox';
    corner.setAttribute('aria-label', 'Resize window');
    Object.assign(corner.style, {
      position: 'absolute', right: '0', bottom: '0', width: `${cw}px`, height: `${ch}px`,
      cursor: 'nwse-resize', zIndex: '4', touchAction: 'none', // touch-drag must not page-scroll
      padding: '0', margin: '0', border: '0', background: 'transparent',
      outlineOffset: '2px',
    } satisfies Partial<CSSStyleDeclaration>);
    // Keyboard alternative for the pointer-driven resize: arrow keys nudge size by 8px; Shift×4.
    // (Aaron's growbox is otherwise pointer-only — and an a11y dead-end if a keyboard user wants to
    // resize. Production WMs do this; we should too.)
    corner.addEventListener('keydown', (e) => {
      const step = (e.shiftKey ? 32 : 8);
      let dw = 0, dh = 0;
      if (e.key === 'ArrowRight')      dw =  step;
      else if (e.key === 'ArrowLeft')  dw = -step;
      else if (e.key === 'ArrowDown')  dh =  step;
      else if (e.key === 'ArrowUp')    dh = -step;
      else return;
      e.preventDefault();
      const w0 = entry.opts.width ?? 240, h0 = entry.opts.height ?? 120;
      entry.opts = { ...entry.opts, width: Math.max(minContentW, w0 + dw), height: Math.max(40, h0 + dh) };
      void this.render(entry);
    });
    // Swallow dblclick on the gripper too, else "inFrame at the bottom-right" would shade-on-dblclick.
    corner.addEventListener('dblclick', (e) => { e.stopPropagation(); });
    corner.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.preventDefault(); e.stopPropagation();
      void this.focus(entry);
      const sx = e.clientX, sy = e.clientY;
      const w0 = entry.opts.width ?? 240, h0 = entry.opts.height ?? 120;
      const hw0 = host.offsetWidth, hh0 = host.offsetHeight;
      const outline = document.createElement('div');
      Object.assign(outline.style, {
        position: 'absolute', left: '0', top: '0', width: `${hw0}px`, height: `${hh0}px`,
        border: '1px dotted #000', zIndex: '10', pointerEvents: 'none',
      } satisfies Partial<CSSStyleDeclaration>);
      host.appendChild(outline);
      let nw = w0, nh = h0;
      const mv = (ev: PointerEvent): void => {
        nw = Math.max(minContentW, w0 + Math.round((ev.clientX - sx) / scale));
        nh = Math.max(40, h0 + Math.round((ev.clientY - sy) / scale));
        outline.style.width = `${hw0 + (nw - w0) * scale}px`;
        outline.style.height = `${hh0 + (nh - h0) * scale}px`;
      };
      const up = (): void => {
        document.removeEventListener('pointermove', mv); document.removeEventListener('pointerup', up);
        outline.remove();
        entry.opts = { ...entry.opts, width: nw, height: nh };
        void this.render(entry);
      };
      document.addEventListener('pointermove', mv); document.addEventListener('pointerup', up);
    });
    win.appendChild(corner);
  }

  /** Overlay transparent hit buttons for any title-bar widget with a handler. */
  private overlayWidgets(entry: ManagedWindow, win: HTMLElement): void {
    const composed = (win as unknown as { _awComposed?: ComposedChrome })._awComposed;
    if (!composed) return; // baseline (procedural) window — no cicn widget rects
    const slug = this.effectiveSlug(entry);
    const scale = Math.max(1, Math.round(entry.opts.scale ?? 1));
    // Per-widget action: an explicit handler wins; otherwise collapse/zoom get a built-in (window-shade
    // / zoom-to-fit) so the widgets work out of the box. Close has no built-in (the manager doesn't own
    // what "close" means — the declarative layer wires onClose=unmount), so a close widget without a
    // handler stays inert. Existing callers that pass handlers (demo/index.html) keep their behavior.
    const builtin: Partial<Record<TitleWidget, () => void>> = {
      collapse: () => { void this.toggleCollapse(entry); },
      zoom: () => { void this.toggleZoom(entry); },
    };
    const cb: Record<TitleWidget, (() => void) | undefined> = {
      close: entry.handlers.onClose,
      zoom: entry.handlers.onZoom ?? builtin.zoom,
      collapse: entry.handlers.onCollapse ?? builtin.collapse,
    };
    // To show the PRESSED state on mousedown we repaint the live chrome canvas with a pre-rendered
    // pressed variant (renderWindow's pressedWidget), then restore a snapshot of the normal chrome
    // on release. Cheap + lag-free after the first press (the pressed render is cached per widget).
    const chrome = win.querySelector('.aw-chrome') as HTMLCanvasElement | null;
    const cctx = chrome?.getContext('2d') ?? null;
    let normalSnap: HTMLCanvasElement | null = null;
    if (chrome) {
      normalSnap = document.createElement('canvas');
      normalSnap.width = chrome.width; normalSnap.height = chrome.height;
      normalSnap.getContext('2d')?.drawImage(chrome, 0, 0);
    }
    for (const hit of titleWidgetHits(entry.theme, slug, composed, scale)) {
      const handler = cb[hit.role];
      if (!handler) continue;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `aw-titlewidget aw-titlewidget-${hit.role}`;
      // Friendlier labels than the bare role string ("close" → "Close window" etc.) so screen
      // readers announce the action, not just the technical name. aria-pressed is intentionally
      // omitted — these are momentary actions, not toggles (window-shade collapses the WINDOW, not
      // the button itself; AT users hear the new window state via the host's aria-label changing).
      const label = (
        hit.role === 'close'    ? 'Close window' :
        hit.role === 'zoom'     ? 'Zoom window'  :
        hit.role === 'collapse' ? 'Collapse window' :
        hit.role
      );
      btn.setAttribute('aria-label', label);
      Object.assign(btn.style, {
        position: 'absolute', left: `${hit.rect.x}px`, top: `${hit.rect.y}px`,
        width: `${hit.rect.w}px`, height: `${hit.rect.h}px`,
        padding: '0', margin: '0', border: '0', background: 'transparent',
        cursor: 'default', zIndex: '2',
      } satisfies Partial<CSSStyleDeclaration>);
      btn.addEventListener('click', (e) => { e.stopPropagation(); handler(); });
      if (chrome && cctx && normalSnap) {
        let pressedCanvas: HTMLCanvasElement | null | undefined; // undefined = not yet rendered
        const press = async (): Promise<void> => {
          if (pressedCanvas === undefined) {
            try {
              const pwin = await renderWindow(entry.theme, { ...entry.opts, state: entry.active ? 'active' : 'inactive', pressedWidget: hit.role });
              pressedCanvas = (pwin.querySelector('.aw-chrome') as HTMLCanvasElement | null) ?? null;
            } catch { pressedCanvas = null; }
          }
          if (pressedCanvas) cctx.drawImage(pressedCanvas, 0, 0);
        };
        const release = (): void => { if (normalSnap) cctx.drawImage(normalSnap, 0, 0); };
        // stopPropagation so the window's mousedown→focus handler doesn't re-render (which would
        // destroy this button mid-press); a widget press shouldn't require focusing the window first.
        btn.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); void press(); });
        btn.addEventListener('pointerup', release);
        btn.addEventListener('pointerleave', release);
      }
      win.appendChild(btn);
    }
  }
}
