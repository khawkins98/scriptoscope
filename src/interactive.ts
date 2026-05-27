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
  } satisfies Partial<CSSStyleDeclaration>);

  const repaint = async (): Promise<void> => {
    const buf = await compose(value, dragging ? 'pressed' : 'normal');
    if (buf) el.replaceChildren(bufferToCanvas(buf, scale));
    el.setAttribute('aria-valuenow', String(Math.round(value * 100)));
  };
  await repaint();

  const valueAt = (e: PointerEvent): number => {
    const r = el.getBoundingClientRect();
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
  ): Promise<HTMLElement> {
    const host = document.createElement('div');
    host.style.position = 'absolute';
    const entry: ManagedWindow = { theme, opts, handlers, host, active: this.windows.length === 0 };
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
    this.overlayWidgets(entry, win);
    this.wireMoveResize(entry, win);
    entry.host.replaceChildren(win);
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

    // MOVE — mousedown on the title bar (top frame, not a widget: widgets stopPropagation).
    const frameTop = composed.frame.top * scale;
    win.addEventListener('mousedown', (e) => {
      if (e.clientY - win.getBoundingClientRect().top > frameTop) return; // below the title bar
      e.preventDefault();
      void this.focus(entry);
      const sx = e.clientX, sy = e.clientY;
      const x0 = parseFloat(host.style.left) || 0, y0 = parseFloat(host.style.top) || 0;
      const mv = (ev: MouseEvent): void => { host.style.left = `${x0 + ev.clientX - sx}px`; host.style.top = `${y0 + ev.clientY - sy}px`; };
      const up = (): void => { document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up); };
      document.addEventListener('mousemove', mv); document.addEventListener('mouseup', up);
    });

    // RESIZE — drag the bottom / right / corner border (a generous band, NOT a hairline grow box;
    // and it works for native schemes whose grow box is baked into the chrome with no sprite). A
    // classic ghost OUTLINE tracks the drag; the window re-renders at the new content size on release.
    const ft = composed.frame.top * scale;
    const fr = Math.max(7, composed.frame.right) * scale;  // resize band ≥ 7px native so it's grabbable
    const fb = Math.max(7, composed.frame.bottom) * scale;
    // Mac OS hard minimum window width is 110px (native). Clamp the CONTENT width so the FULL window
    // (content + chrome) never goes below it. (Chrome width is constant for the frame.)
    const chromeW = composed.fullWidth - (entry.opts.width ?? 240);
    const minContentW = Math.max(40, 110 - chromeW);
    const startResize = (e: MouseEvent, dW: boolean, dH: boolean): void => {
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
      const mv = (ev: MouseEvent): void => {
        if (dW) nw = Math.max(minContentW, w0 + Math.round((ev.clientX - sx) / scale));
        if (dH) nh = Math.max(40, h0 + Math.round((ev.clientY - sy) / scale));
        outline.style.width = `${hw0 + (nw - w0) * scale}px`;
        outline.style.height = `${hh0 + (nh - h0) * scale}px`;
      };
      const up = (): void => {
        document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up);
        outline.remove();
        entry.opts = { ...entry.opts, width: nw, height: nh };
        void this.render(entry);
      };
      document.addEventListener('mousemove', mv); document.addEventListener('mouseup', up);
    };
    const mkZone = (css: Partial<CSSStyleDeclaration>, dW: boolean, dH: boolean): void => {
      const z = document.createElement('div');
      Object.assign(z.style, { position: 'absolute', zIndex: '4', ...css } satisfies Partial<CSSStyleDeclaration>);
      z.addEventListener('mousedown', (e) => startResize(e, dW, dH));
      win.appendChild(z);
    };
    // Corner zone reaches INWARD to cover the grow-box gripper, which sits at the INNER frame corner
    // (over the content), not the outer edge — so clicking the visible gripper actually resizes.
    const gripW = (composed.growBox?.w ?? 15) * scale;
    const gripH = (composed.growBox?.h ?? 15) * scale;
    const cw = fr + gripW, ch = fb + gripH;
    mkZone({ right: '0', top: `${ft}px`, width: `${fr}px`, bottom: `${ch}px`, cursor: 'ew-resize' }, true, false);  // right edge
    mkZone({ left: '0', bottom: '0', height: `${fb}px`, right: `${cw}px`, cursor: 'ns-resize' }, false, true);     // bottom edge
    mkZone({ right: '0', bottom: '0', width: `${cw}px`, height: `${ch}px`, cursor: 'nwse-resize' }, true, true);   // corner + gripper
  }

  /** Overlay transparent hit buttons for any title-bar widget with a handler. */
  private overlayWidgets(entry: ManagedWindow, win: HTMLElement): void {
    const composed = (win as unknown as { _awComposed?: ComposedChrome })._awComposed;
    if (!composed) return; // baseline (procedural) window — no cicn widget rects
    const slug = entry.opts.windowType ?? 'document-window';
    const scale = Math.max(1, Math.round(entry.opts.scale ?? 1));
    const cb: Record<TitleWidget, (() => void) | undefined> = {
      close: entry.handlers.onClose, zoom: entry.handlers.onZoom, collapse: entry.handlers.onCollapse,
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
      btn.setAttribute('aria-label', hit.role);
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
        btn.addEventListener('mousedown', (e) => { e.preventDefault(); e.stopPropagation(); void press(); });
        btn.addEventListener('mouseup', release);
        btn.addEventListener('mouseleave', release);
      }
      win.appendChild(btn);
    }
  }
}
