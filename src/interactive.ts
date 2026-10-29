import { prepareButtonPainter, registerButtonPainter, unregisterButtonPainter } from './buttonComposition.js';
import { ManagedContentPort, type ManagedControlPort } from './managedContentPort.js';
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
// ─────────────────────────────────────────────────────────────────────────────
// NAVIGATION MAP
// ─────────────────────────────────────────────────────────────────────────────
// This file ships TWO related layers in one module:
//
//   1) INTERACTIVE CONTROL PRIMITIVES — buttons,
//      disclosure triangles, sliders, scrollbars. Pure DOM widgets that wrap a
//      composed cicn canvas with role/tabIndex/aria + keyboard handlers. Used
//      both by the WindowManager (for its internal controls) and by consumer
//      code (via the public exports). See sections marked `// ── <name> ──`.
//
//      KEY PRIMITIVES:
//        interactiveButton              — focusable cicn-faced button
//        interactiveDisclosure          — twisty widget with aria-expanded
//        interactiveSlider              — role=slider with arrow-key support
//        interactiveScrollbar           — role=scrollbar (used by WindowManager
//                                         internally for the themed window
//                                         scrollbars)
//        titleWidgetHits                — title-bar hit-test rect resolver
//
//   2) WINDOW MANAGER — class `WindowManager`. Owns per-window state (active,
//      collapsed, zoomed, theme, opts) and rebuilds the chrome on state changes.
//      All chrome lives inside the host's shadow root (per ADR-0001 Decision 2);
//      consumer content lives in light DOM and is rendered via <slot> inside
//      .scriptoscope-content. See LEARNINGS 2026-05-28 "Shadow DOM gotchas" for the
//      staleness-check semantics that changed when chrome moved to shadow.
//
//      KEY ENTRY POINTS:
//        WindowManager.add(theme, opts, handlers, extra)   create + render
//        WindowManager.render(entry)                       rebuild chrome
//                                                          (frequency contract
//                                                          documented above the
//                                                          method)
//        WindowManager.focus(entry)                        active-state flip
//                                                          (renders only the
//                                                          windows whose active
//                                                          state actually changed)
//        WindowManager.retheme(theme)                      reskin every window
//        WindowManager.setContentSize(host, w, h)          content-fit resize
//        WindowManager.toggleCollapse/Zoom(entry)          shade / fit-to-content
//        WindowManager.remove(host)                        drop a window
//
//      INTERNAL HELPERS:
//        render(entry)                  → calls renderWindow() + overlayWidgets()
//                                         + wireMoveResize() + wireScrollbars()
//        overlayWidgets(entry, win)     → transparent <button>s over the title
//                                         widgets (close/zoom/collapse + DOM
//                                         twins for a11y)
//        wireMoveResize(entry, win)     → title-bar drag (CSS-only, no render)
//                                         + grow-box resize (ghost outline during
//                                         drag; render on mouseup)
//        wireScrollbars(entry, win)     → themed scrollbar wiring per axis (see
//                                         wireScrollbarAxis)
//        wireScrollbarAxis(...)         → per-axis bar element + listeners
//
// CROSS-FILE RELATIONSHIPS:
//   composeChrome.ts                     → static chrome geometry (the pixel
//                                          recipe Scriptoscope walks); produces a
//                                          ComposedChrome attached to the
//                                          rendered win as _scriptoscopeComposed
//   renderWindow.ts                      → wraps the composed chrome in a DOM
//                                          subtree (.scriptoscope-window > canvas + slot)
//   declarative/ScriptoscopeWindow.ts           → the consumer-facing wrapper that
//                                          calls manager.add() with light-DOM
//                                          slotted content
//
// RENDER FREQUENCY CONTRACT: see the comment block above WindowManager.render().
// Locked in 2026-05-28 audit (commit 6f9b285); don't introduce per-mousemove
// repaints.
// ─────────────────────────────────────────────────────────────────────────────

import { resolveWindowSelection, resolveCollapsedWindowTypeSlug } from './resolveWindowType.js';
import { listenUntilAborted } from './listenUntilAborted.js';
import {
  composeDisclosure, composeSliderWithLayout, composeScrollbar, composeScrollbarFrame, type SliderFrame, type SliderOptions,
  type ScrollbarFrame, type ScrollbarOptions,
  baselineButton, bufferToCanvas,
  type ButtonOptions, type ControlState, composeProgressFrame, type ProgressOptions,
} from './controls.js';
import { newProgressRecord, progressIdleAdvance, progressSetData, type ProgressRecord } from './engine/families/progress.js';
import { PROGRESS_DATA, PROGRESS_FACADE_TICKS } from './engine/tables/progress.js';
import { platinumSliderWithLayout, platinumScrollbar } from './platinum.js';
import { findPositionedAncestor, offsetInContainingBlock, pointInElement, viewportFrame } from './positioning.js';
import { debug } from './debug.js';
import { renderWindow, resolveTitleWidgetRects, type RenderWindowOptions } from './renderWindow.js';
import type { PixelBuffer } from './pixelBuffer.js';
import type { SliderComposition, SliderLayout } from './sliderLayout.js';
import type { ComposedChrome } from './composeChrome.js';
import type { LoadedTheme, WindowState } from './types.js';
import { themeView, type ThemeInput } from './ownedTheme.js';

type Orientation = 'horizontal' | 'vertical';
const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));

const KEY_ACTIVATE = (e: KeyboardEvent): boolean => e.key === ' ' || e.key === 'Enter' || e.key === 'Spacebar';

// Internal ownership hook used by declarative promotion. Not part of the package exports.
const controlDisposers = new WeakMap<HTMLElement, () => void>();
export function disposeInteractiveControl(el: HTMLElement): void {
  controlDisposers.get(el)?.();
  controlDisposers.delete(el);
}

// ── Button ──────────────────────────────────────────────────────────────────
export interface InteractiveButtonOptions extends ButtonOptions {
  /** Fired on a completed click / Space / Enter (not while merely pressed). */
  onClick?: () => void;
  scale?: number;
}

/**
 * A themed push button that depresses on press (the scheme's pressed cicn) and
 * fires `onClick` on release / keyboard activation. Falls back to the native
 * baseline button when either required face lacks an admitted paint stage.
 */
export async function interactiveButton(
  theme: ThemeInput,
  opts: InteractiveButtonOptions = {},
  /** Internal promotion lifetime; omitted for detached imperative preparation. */
  signal?: AbortSignal,
): Promise<HTMLElement> {
  const current = (): void => { if (signal?.aborted) throw new DOMException('Button preparation aborted', 'AbortError'); };
  current();
  const { onClick, scale = 1, ...bo } = opts;
  const painter = await prepareButtonPainter(theme, bo, scale, signal);
  current();
  const el = painter ? document.createElement('button') : baselineButton(bo.label ?? '', bo);
  el.type = 'button';
  el.disabled = !!bo.disabled;
  if (painter) {
    el.className = 'scriptoscope-button';
    if (bo.label) el.setAttribute('aria-label', bo.label);
    Object.assign(el.style, {
      display: 'inline-block', lineHeight: '0', userSelect: 'none', margin: '0',
      padding: '0', border: '0', background: 'transparent', appearance: 'none',
      cursor: bo.disabled ? 'default' : 'pointer', outlineOffset: '2px',
    } satisfies Partial<CSSStyleDeclaration>);
    el.appendChild(painter.canvas);
    registerButtonPainter(el, painter);
  }
  const events = new AbortController();
  controlDisposers.set(el, () => { painter?.dispose(); unregisterButtonPainter(el); events.abort(); });
  if (onClick) listenUntilAborted(events.signal, el, 'click', () => { if (!el.matches(':disabled')) onClick(); });
  if (painter) {
    // These handlers paint feedback only. The native button owns activation,
    // canceled presses, keyboard defaults, focus and disabled/form semantics.
    listenUntilAborted(events.signal, el, 'pointerdown', e => { if (e.button === 0 && !el.matches(':disabled')) painter.press(true); });
    for (const type of ['pointerup', 'pointerleave', 'pointercancel', 'blur'] as const)
      listenUntilAborted(events.signal, el, type, () => painter.press(false));
    listenUntilAborted(events.signal, el, 'keydown', e => { if (KEY_ACTIVATE(e) && !el.matches(':disabled')) painter.press(true); });
    listenUntilAborted(events.signal, el, 'keyup', e => { if (KEY_ACTIVATE(e)) painter.press(false); });
  }
  return el;
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
  theme: ThemeInput,
  opts: InteractiveDisclosureOptions = {},
): Promise<HTMLElement> {
  const { scale = 1, onToggle } = opts;
  let open = opts.open ?? false;
  const closedBuf = await composeDisclosure(theme, { direction: 'right' });
  const openBuf = await composeDisclosure(theme, { direction: 'down' });

  const el = document.createElement('span');
  el.className = 'scriptoscope-disclosure';
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
 * Shared 1-D drag wiring. Sliders use their committed composition layout;
 * controls without a layout retain their canvas mapping. Render in
 * the pressed state while dragging. The re-compose is async (cicn loading) so
 * it's coalesced to one per animation frame; `onChange` fires immediately. The
 * element is a `role=slider` with arrow-key support.
 */
async function buildDraggable(
  el: HTMLElement,
  orientation: Orientation,
  initial: number,
  scale: number,
  compose: (value: number, state: ControlState, signal: AbortSignal) => Promise<PixelBuffer | SliderComposition | null> | PixelBuffer,
  onChange?: (value: number) => void,
  native?: { input: HTMLInputElement; active(): boolean },
): Promise<void> {
  let value = clamp01(initial);
  let dragging = false;
  let stopDrag = (): void => {};
  let raf = 0;
  let paintVersion = 0;
  let paintedLayout: SliderLayout | null = null;
  let nativeDrag: { axisLength: number; travel: number; pointer: number; value: number; exact: string; direction: 1 | -1 } | null = null;
  const events = new AbortController();
  controlDisposers.set(el, () => {
    events.abort();
    paintVersion++;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  });
  if (native) el.setAttribute('aria-hidden', 'true');
  else {
    el.setAttribute('role', 'slider');
    el.setAttribute('aria-orientation', orientation);
    el.setAttribute('aria-valuemin', '0');
    el.setAttribute('aria-valuemax', '100');
    el.tabIndex = 0;
  }
  Object.assign(el.style, {
    display: 'inline-block', lineHeight: '0', userSelect: 'none',
    touchAction: 'none', cursor: 'pointer', outlineOffset: '2px',
    // Opt out of any flex parent's align-items:stretch — otherwise the element grows wider than the
    // canvas inside it, and the hit-test rect no longer matches what the user sees (clicking the
    // visible thumb lands somewhere far off the actual value). Slider lived in the Inspector's
    // `.row.col` (flex column, stretch) which made the element 220px wide around a 120px canvas.
    alignSelf: 'start', verticalAlign: 'middle',
  } satisfies Partial<CSSStyleDeclaration>);

  const disabled = (): boolean => native?.input.matches(':disabled') ?? false;
  const live = (): boolean => !events.signal.aborted && (!native || native.active());
  let dragStart = '';
  let pointerId = 0;
  const repaint = async (): Promise<void> => {
    if (events.signal.aborted) return;
    const version = ++paintVersion;
    let composed: PixelBuffer | SliderComposition | null;
    try { composed = await compose(value, disabled() ? 'disabled' : dragging ? 'pressed' : 'normal', events.signal); }
    catch (error) {
      if (events.signal.aborted || version !== paintVersion) return;
      throw error;
    }
    if (events.signal.aborted || version !== paintVersion) return;
    const frame = composed && 'buffer' in composed ? composed : null;
    const buf = frame ? frame.buffer : composed as PixelBuffer | null;
    if (buf) {
      // Canvas and the geometry that actually drew it commit together. A stale
      // async pressed/normal paint may replace neither half of this pair.
      const canvas = bufferToCanvas(buf, scale);
      el.replaceChildren(canvas);
      paintedLayout = frame?.layout ?? null;
    }
    if (!native) el.setAttribute('aria-valuenow', String(Math.round(value * 100)));
  };
  await repaint();
  // Exposed visual setter — mirrors `_scriptoscopeSetChecked` on toggles.
  // Used by `promoteControl`'s bfcache resync (pageshow.persisted) to push
  // the restored native input value back into the themed face when the
  // browser silently rehydrated form state. Sync (returns immediately;
  // repaint is rAF-scheduled).
  (el as unknown as { _scriptoscopeSetValue: (v: number) => void })._scriptoscopeSetValue = (v: number) => {
    if (events.signal.aborted) return;
    value = native ? nativeRangeValue(native.input) : clamp01(v);
    schedule();
  };

  // Map pointer→value against the CANVAS rect (the actual visual surface), not the element rect.
  // The element can be stretched by a parent layout; the canvas always reflects what the user sees.
  // Local CSS pixels, not the bounding rect, so a rotated ancestor (#519) keeps the axis.
  const valueAt = (e: PointerEvent): number => {
    const canvas = el.querySelector('canvas');
    const p = pointInElement(canvas ?? el, e.clientX, e.clientY);
    const t = orientation === 'horizontal' ? p.x / p.width : p.y / p.height;
    return clamp01(t);
  };
  // A painted layout whose value runs against the axis (the engine slider's
  // vertical minimum is at the bottom, slider §5.2) flips the pointer fraction.
  const spatialValue = (t: number): number => (paintedLayout?.valueDirection === -1 ? 1 - t : t);
  const nativePoint = (e: PointerEvent, axisLength: number): { axis: number; x: number; y: number; inside: boolean } | null => {
    const canvas = el.querySelector('canvas');
    if (!canvas) return null;
    const p = pointInElement(canvas, e.clientX, e.clientY);
    if (!(p.width > 0 && p.height > 0)) return null;
    const x = p.x * canvas.width / p.width;
    const y = p.y * canvas.height / p.height;
    return { x, y, axis: orientation === 'horizontal' ? p.x * axisLength / p.width : p.y * axisLength / p.height,
      inside: p.x >= 0 && p.x <= p.width && p.y >= 0 && p.y <= p.height };
  };
  const schedule = (): void => { if (!events.signal.aborted && !raf) raf = requestAnimationFrame(() => { raf = 0; void repaint(); }); };
  const update = (position: number, exact?: string): void => {
    if (!live() || disabled()) return;
    if (native) {
      const input = native.input, before = input.value, beforeNumber = input.valueAsNumber;
      const { min, max } = nativeRangeBounds(input);
      // The native setter applies min/max, fractional step and step-base rules.
      const span = max - min;
      if (exact !== undefined) {
        if (input.value !== exact) input.value = exact;
      } else input.valueAsNumber = Number.isFinite(span) ? min + position * span
        : (1 - position) * min + position * max;
      // Firefox can retain lexical values such as "025". A setter that
      // sanitizes back to the same number must not manufacture an input event
      // (or a later commit) solely by canonicalizing that string.
      if (input.valueAsNumber === beforeNumber && input.value !== before) input.value = before;
      else if (nativeDrag && input.valueAsNumber === Number(nativeDrag.exact)) input.value = nativeDrag.exact;
      value = nativeRangeValue(input);
      if (input.valueAsNumber !== beforeNumber) input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    } else { value = position; onChange?.(value); }
  };
  const onMove = (e: PointerEvent): void => {
    if ((native || nativeDrag) && e.pointerId !== pointerId) return;
    if (native || nativeDrag) {
      if (!nativeDrag || nativeDrag.travel <= 0) return;
      const point = nativePoint(e, nativeDrag.axisLength);
      if (!point) return;
      const delta = point.axis - nativeDrag.pointer;
      // Use the exact native starting value, not inversion of rounded raster
      // coordinates. Returning to the same pointer coordinate restores it too.
      update(clamp01(nativeDrag.value + nativeDrag.direction * delta / nativeDrag.travel), native && delta === 0 ? nativeDrag.exact : undefined);
    } else update(spatialValue(valueAt(e)));
    schedule();
  };
  const onUp = (e: PointerEvent): void => {
    if ((native || nativeDrag) && e.pointerId !== pointerId) return;
    dragging = false;
    nativeDrag = null;
    stopDrag();
    if (native && live() && !disabled() && native.input.valueAsNumber !== Number(dragStart)) {
      native.input.dispatchEvent(new Event('change', { bubbles: true }));
    }
    void repaint();
  };
  listenUntilAborted(events.signal, el, 'pointerdown', (e) => {
    const mapped = !!native || paintedLayout !== null;
    if (!live() || disabled() || (mapped && (e.button !== 0 || dragging))) return;
    // A stretched wrapper can have blank space outside its real canvas. Only
    // the canvas begins native interaction; an active drag may leave its bounds.
    const layout = mapped ? paintedLayout : null;
    const point = layout ? nativePoint(e, layout.axisLength) : null;
    if (mapped && (!layout || !point?.inside)) return;
    e.preventDefault();
    if (native) {
      native.input.focus({ preventScroll: true }); dragStart = native.input.value;
      value = nativeRangeValue(native.input);
    }
    dragging = true; pointerId = e.pointerId;
    if (mapped && layout && point) {
      const thumb = layout.thumb;
      const grabbed = thumb && point.x >= thumb.x && point.x < thumb.x + thumb.w
        && point.y >= thumb.y && point.y < thumb.y + thumb.h;
      const travel = thumb ? layout.travelEnd - layout.travelStart : layout.axisLength;
      const direction = layout.valueDirection ?? 1;
      if (!grabbed && travel > 0) {
        // Explicit track policy: center an existing thumb under the pointer.
        // A track without thumb art uses its full axis. Zero travel is inert.
        const half = thumb ? (orientation === 'horizontal' ? thumb.w : thumb.h) / 2 : 0;
        // Without thumb art the full axis has no corner inset either (slider TRK4).
        const spatial = (point.axis - (thumb ? layout.travelStart : 0) - half) / travel;
        update(clamp01(direction === 1 ? spatial : 1 - spatial));
      }
      nativeDrag = { axisLength: layout.axisLength, travel, pointer: point.axis,
        value: native ? nativeRangeValue(native.input) : value, exact: native?.input.value ?? '', direction };
    } else update(spatialValue(valueAt(e)));
    if (!live()) return;
    stopDrag();
    const removeMove = listenUntilAborted(events.signal, window, 'pointermove', onMove);
    const removeUp = listenUntilAborted(events.signal, window, 'pointerup', onUp);
    const removeCancel = mapped ? listenUntilAborted(events.signal, window, 'pointercancel', event => {
      if (event.pointerId !== pointerId) return;
      dragging = false; nativeDrag = null; stopDrag(); void repaint();
    }) : () => {};
    stopDrag = () => { removeMove(); removeUp(); removeCancel(); };
    void repaint();
  });
  if (!native) listenUntilAborted(events.signal, el, 'keydown', (e) => {
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
  if (native) {
    let lastDisabled: boolean | undefined;
    const sync = (): void => {
      if (events.signal.aborted) return;
      const next = nativeRangeValue(native.input), off = disabled();
      const changed = next !== value || off !== lastDisabled;
      value = next; lastDisabled = off;
      el.setAttribute('aria-disabled', String(off));
      el.style.cursor = off ? 'default' : 'pointer';
      if (off && dragging) { dragging = false; nativeDrag = null; stopDrag(); }
      if (changed) schedule();
    };
    // Attribute changes include disabled fieldsets and changes to their first
    // legend. Browser :disabled matching owns those rules. Native .value writes
    // without an event are sampled at the next interaction/pageshow/retheme.
    const observe = (): void => {
      observer.disconnect();
      observer.observe(native.input, { attributes: true,
        attributeFilter: ['min', 'max', 'step', 'value', 'disabled'] });
      // Watch the ancestor chain, not every descendant mutation in the document.
      // Child-list changes detect reparenting and first-legend replacement.
      for (let parent = native.input.parentElement; parent; parent = parent.parentElement) {
        observer.observe(parent, { childList: true,
          ...(parent instanceof HTMLFieldSetElement ? { attributes: true, attributeFilter: ['disabled'] } : {}) });
      }
    };
    const observer = new MutationObserver(records => {
      if (records.some(record => record.type === 'childList')) observe();
      sync();
    });
    observe();
    events.signal.addEventListener('abort', () => observer.disconnect(), { once: true });
    listenUntilAborted(events.signal, native.input, 'input', sync);
    listenUntilAborted(events.signal, native.input, 'change', sync);
    listenUntilAborted(events.signal, native.input.getRootNode(), 'reset', event => {
      if (event.target === native.input.form) queueMicrotask(sync);
    }, true);
    sync();
  }
}

const rangeProbes = new WeakMap<Document, HTMLInputElement>();
function nativeRangeBounds(input: HTMLInputElement): { min: number; max: number } {
  // Use the browser's range sanitizer for HTML numeric-attribute syntax too:
  // parseFloat incorrectly accepts e.g. min="10px", whitespace and "+10".
  let probe = rangeProbes.get(input.ownerDocument);
  if (!probe) {
    probe = input.ownerDocument.createElement('input'); probe.type = 'range'; probe.step = 'any';
    rangeProbes.set(input.ownerDocument, probe);
  }
  probe.min = input.min; probe.max = input.max;
  probe.valueAsNumber = -Number.MAX_VALUE; const min = probe.valueAsNumber;
  probe.valueAsNumber = Number.MAX_VALUE; const max = probe.valueAsNumber;
  return { min, max };
}
function nativeRangeValue(input: HTMLInputElement): number {
  const { min, max } = nativeRangeBounds(input);
  if (max <= min) return 0;
  const span = max - min;
  return clamp01(Number.isFinite(span) ? (input.valueAsNumber - min) / span
    : (input.valueAsNumber / 2 - min / 2) / (max / 2 - min / 2));
}

/** Internal native form adapter; the public imperative API remains normalized. */
/** A composition whose lifetime ended (its theme's assets were released, or its signal aborted): paint nothing. */
const ENDED = Symbol('ended');
async function composeSliderEnded(p: Promise<SliderFrame | null>): Promise<SliderFrame | null | typeof ENDED> {
  try { return await p; } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return ENDED;
    throw error;
  }
}

/** Hit the last painted frame using the canvas's current CSS-to-raster mapping. */
function paintedPartAt<T>(el: HTMLElement, e: PointerEvent,
  frame: { buffer: PixelBuffer; partAt(x: number, y: number): T } | null): T | undefined {
  const canvas = el.querySelector('canvas');
  if (!frame || !canvas) return undefined;
  const p = pointInElement(canvas, e.clientX, e.clientY);
  if (!(p.width > 0 && p.height > 0)) return undefined;
  return frame.partAt(Math.floor(p.x * frame.buffer.width / p.width),
    Math.floor(p.y * frame.buffer.height / p.height));
}

/**
 * The pressed slider part is the part under the pointer at press time (slider
 * §4.9 hit test on the painted geometry; DECISIONS #9). A capture listener runs
 * before the drag wiring's own pointerdown repaint reads it. Part 0 (outside
 * the band) paints the normal state.
 */
function sliderPressTracker(el: HTMLElement): {
  painted(frame: SliderFrame | null, state: ControlState): void;
  pressed(state: ControlState): { state: ControlState; pressedPart?: NonNullable<SliderOptions['pressedPart']> };
} {
  let painted: SliderFrame | null = null;
  let part: SliderOptions['pressedPart'] | null = null;
  el.addEventListener('pointerdown', (e) => {
    part = paintedPartAt(el, e, painted);
  }, { capture: true });
  return {
    painted: (frame, state) => { if (frame && state !== 'pressed') painted = frame; },
    pressed: (state) => state !== 'pressed' ? { state } : part === null ? { state: 'normal' } : { state, ...(part ? { pressedPart: part } : {}) },
  };
}

export async function interactiveNativeSlider(theme: ThemeInput, input: HTMLInputElement,
  active: () => boolean): Promise<HTMLElement> {
  const el = document.createElement('span'); el.className = 'scriptoscope-slider';
  const press = sliderPressTracker(el);
  await buildDraggable(el, 'horizontal', nativeRangeValue(input), 1,
    async (value, state, signal) => {
      const frame = await composeSliderEnded(composeSliderWithLayout(theme, { orientation: 'horizontal', length: 120, value, ...press.pressed(state) }, signal));
      if (signal.aborted || frame === ENDED) return null;
      press.painted(frame, state);
      return frame ?? platinumSliderWithLayout({ orientation: 'horizontal', length: 120, value });
    },
    undefined, { input, active });
  return el;
}

/** A draggable slider (themed where the scheme's slider CDEF draws, else procedural). */
export async function interactiveSlider(theme: ThemeInput, opts: InteractiveSliderOptions = {}): Promise<HTMLElement> {
  const { orientation = 'horizontal', length = 120, value = 0.5, scale = 1, onChange } = opts;
  const el = document.createElement('span');
  el.className = 'scriptoscope-slider';
  const press = sliderPressTracker(el);
  await buildDraggable(el, orientation, value, scale,
    async (v, state, signal) => {
      const frame = await composeSliderEnded(composeSliderWithLayout(theme, { orientation, length, value: v, ...press.pressed(state) }, signal));
      if (signal.aborted || frame === ENDED) return null;
      press.painted(frame, state);
      return frame ?? platinumSliderWithLayout({ orientation, length, value: v });
    },
    onChange);
  return el;
}

/** A draggable scrollbar thumb (drag along the track sets the position). */
export async function interactiveScrollbar(theme: ThemeInput, opts: InteractiveScrollbarOptions = {}): Promise<HTMLElement> {
  const { orientation = 'vertical', length = 120, value = 0.3, thumbExtent = 0.3, scale = 1, onChange } = opts;
  const el = document.createElement('span');
  el.className = 'scriptoscope-scrollbar';
  // The pressed part is the part under the pointer at press time (scrollbar
  // §4.8 hit test on the painted geometry; DECISIONS #4). A capture listener
  // runs before the drag wiring's own pointerdown repaint reads it.
  let painted: ScrollbarFrame | null = null;
  let pressedPart: ScrollbarOptions['pressedPart'];
  el.addEventListener('pointerdown', (e) => {
    pressedPart = paintedPartAt(el, e, painted) ?? undefined;
  }, { capture: true });
  await buildDraggable(el, orientation, value, scale,
    async (v, state) => {
      const frame = await composeScrollbarFrame(theme, { orientation, length, value: v, state,
        ...(state === 'pressed' && pressedPart ? { pressedPart } : {}) });
      if (frame && state !== 'pressed') painted = frame;
      return frame?.buffer ?? platinumScrollbar({ orientation, length, value: v, thumbExtent });
    },
    onChange);
  return el;
}

// ── Progress bar idle (DECISIONS #11) ─────────────────────────────────────────
/** The Mac TickCount stand-in the idle helper uses: whole ticks since page load. */
export function progressTickCount(): number {
  return Math.floor((performance.now() * PROGRESS_FACADE_TICKS.perSecond) / 1000);
}

/**
 * The progress bar's idle advance (DECISIONS #11; docs/spec/engine/progress.md
 * IDLE1–IDLE4): keeps the private record's phase byte and idle time across
 * frames, advances the phase once at least 3 ticks have passed (indeterminate
 * bars only), and writes back the phase each draw reports (frame mode resets it).
 * Call `idle()` from the host's timer; redraw with `compose()` when it returns true.
 */
export class ProgressIdle {
  private readonly record: ProgressRecord = newProgressRecord();

  constructor(opts: { indeterminate?: boolean; phase?: number } = {}) {
    this.indeterminate = !!opts.indeterminate;
    const phase = opts.phase ?? 0;
    if (!Number.isInteger(phase) || phase < 0 || phase > 255) throw new RangeError('ProgressIdle: phase must be an integer 0..255');
    this.record.phase = phase;
  }

  get phase(): number { return this.record.phase; }

  get indeterminate(): boolean { return this.record.indeterminate !== 0; }

  /** Message 20 (IDLE4): changes the flag only; the phase is kept. */
  set indeterminate(on: boolean) { progressSetData(this.record, PROGRESS_DATA.tag, [on ? 1 : 0]); }

  /** Message 18's advance (IDLE2): true when the phase advanced. */
  idle(ticks: number = progressTickCount()): boolean {
    return progressIdleAdvance(this.record, ticks);
  }

  /** Draw the current phase (one frame) and keep the phase the draw reports. */
  async compose(theme: ThemeInput, opts: Omit<ProgressOptions, 'indeterminate' | 'phase'> = {}): Promise<PixelBuffer> {
    const frame = await composeProgressFrame(theme, { ...opts, indeterminate: this.indeterminate, phase: this.record.phase });
    this.record.phase = frame.phase;
    return frame.buffer;
  }
}

// ── Title-bar widget hit-testing ──────────────────────────────────────────────
export type TitleWidget = 'close' | 'zoom' | 'collapse';
/**
 * Optional state-change hook invoked AFTER every WindowManager.render() (and after the
 * title-drag mouseup commits a position move). Used by the persistence layer (issue #165)
 * to serialize the post-mutation state to storage. The runtime never reads its return.
 *
 * Argument: the entry's host element (consumer-facing reference) — callers can derive
 * identity (data-scriptoscope-window-id), read position (host.style.left/top), and call the
 * manager's public API for size if needed.
 */
export type WindowChangeListener = (host: HTMLElement) => void;

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
 * Resolve title-bar hit zones from the same semantic widget IDs and composed
 * placements used by rendering and press feedback, then apply display scale.
 * Native wnd# rectangle parts 1/2/3 mean close/zoom/collapse independently of
 * their positions; corner-sprite placements carry explicit roles.
 */
export function titleWidgetHits(
  theme: ThemeInput,
  windowType: string,
  composed: ComposedChrome,
  scale: number,
  state?: WindowState,
): TitleWidgetHit[] {
  // Resolve the window type through the BASE chain, mirroring renderWindow: a
  // scheme that ships no window chrome of its own (e.g. apple-platinum-2 — no
  // `windowTypes` map at all) renders its base's chrome, so its widget rects
  // come from the base too. (`windowTypes` may be absent entirely → optional
  // chaining, not an index into undefined.)
  // Without an explicit state, retain public lookup of either chrome state.
  // The manager supplies its actual state to match the rendered owner.
  const wt = resolveWindowSelection(themeView(theme), windowType, state ?? 'inactive')?.wt;
  if (!wt) return [];
  // Single source of truth (renderWindow.resolveTitleWidgetRects) — gives UNSCALED rects + roles;
  // the hit zones are those ×scale (the window element's own scaled pixel space).
  return resolveTitleWidgetRects(wt, composed).map(({ role, rect }) => ({
    role,
    rect: { x: rect.x * scale, y: rect.y * scale, w: rect.w * scale, h: rect.h * scale },
  }));
}

// ── Window focus manager ────────────────────────────────────────────────────
interface ManagedWindow<Theme extends ThemeInput> {
  contentPort: ManagedContentPort;
  /** Invalidates asynchronous paints when geometry/state changes or the entry is removed. */
  renderEpoch: number;
  /** Authority of mounted chrome, independent of pending render preparations. */
  commitEpoch: number;
  applyStateEpoch: number;
  initializing: boolean;
  theme: Theme;
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
  /** Subset of widgets whose click handlers ARE wired. Set to `undefined`
   *  (the default) → every supported widget is enabled with the standard
   *  handler chain (onClose, then onZoom + builtin zoom fallback, then
   *  onCollapse + builtin collapse fallback). When set, widgets NOT in the
   *  set are inert (cicn art still drawn — we don't paint over chrome — but
   *  clicking does nothing). Honored in `overlayWidgets`. Plumbed from
   *  `data-scriptoscope-widgets` via parse.ts + ScriptoscopeWindow.promote. */
  enabledWidgets?: ReadonlySet<TitleWidget>;
  /** Zoom toggle: the user/declared size to restore when un-zooming (zoom grows to fit the content).
   *  Captures width/height INCLUDING undefined, so un-zooming a size-less window correctly restores it
   *  to size-less (not stuck at the zoomed size). */
  zoomed?: boolean;
  userSize?: { width: number | undefined; height: number | undefined };
  /** Aborts the previous render's scrollbar listeners. The wheel listener lives on the PERSISTENT
   *  scroll container (the slot survives re-slotting), so without this it would accumulate one per
   *  render — multiplying scroll speed and leaking. Re-created each time the bar is (re)wired. */
  scrollAbort?: AbortController;
  /** Root handlers are rebound without ending an already active document-level drag. */
  frameAbort?: AbortController;
  /** Pooled chrome canvas — keeps its DOM identity across state changes (see #171 and
   *  the 2026-05-28 perf review + LEARNINGS "Classic Mac OS lessons"
   *  entry pattern #5). Async preparation uses a staging canvas; only the guarded synchronous
   *  commit copies its pixels into this live canvas and moves it into the new chrome. */
  chromeCanvas?: HTMLCanvasElement;
  /** Persistent light-DOM consumer content, projected through the continuously mounted slot. */
  contentEl?: HTMLElement;
}

/**
 * Tracks the focused window among several: clicking any window makes it active
 * (its chrome re-renders in the active state) and the rest inactive — the same
 * focus cue classic Mac draws. The active window is also raised in z-order.
 * Title-bar widgets (close/zoom/collapse) are hit-tested from the chrome and
 * fire the matching handler when clicked.
 */

// Shared stylesheet injected into every window host's shadow root via
// adoptedStyleSheets. Provides a visible focus ring for the overlay
// buttons (title widgets, move handle, grow box, scrollbar) — the host's
// outer :focus-visible rule from scriptoscope.css doesn't reach inside
// the shadow boundary. One sheet for all windows. a11y reviewer 2026-05-31.
const shadowFocusSheet: CSSStyleSheet = (() => {
  if (typeof CSSStyleSheet === 'undefined') return null as unknown as CSSStyleSheet;
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(`
    .scriptoscope-titlewidget:focus-visible,
    .scriptoscope-movehandle:focus-visible,
    .scriptoscope-growbox:focus-visible,
    .scriptoscope-window-scrollbar:focus-visible {
      outline: 2px solid Highlight;
      outline-offset: 1px;
    }
  `);
  return sheet;
})();

/** Explicit live state. Omitted fields retain their current values. */
export interface ManagedWindowState {
  width?: number;
  height?: number;
  z?: number;
  collapsed?: boolean;
}

export class WindowManager<Theme extends ThemeInput = LoadedTheme> {
  private windows: ManagedWindow<Theme>[] = [];
  /** Monotonic stacking clock — each add/focus takes the next value so the most-recently-touched
   *  window is frontmost. render() adds a large offset for the active window so it sits above all
   *  inactive ones (classic "active window on top", with inactive windows in recency order beneath). */
  private zClock = 0;
  /** Optional listener fired post-render() + post-title-drag-mouseup. Persistence layer hooks here. */
  private onChange?: WindowChangeListener;

  /** Subscribe to render-affecting state changes. Used by the persistence layer (#165) to serialize. */
  setChangeListener(cb: WindowChangeListener | undefined): void {
    if (cb) this.onChange = cb; else delete this.onChange;
  }

  /** Public read access to a managed window's current state (size, collapsed, z). Used by the
   *  persistence layer to snapshot. Returns null if the host isn't managed. */
  describe(host: HTMLElement): { width?: number; height?: number; collapsed: boolean; z: number; theme: Theme } | null {
    const entry = this.windows.find((w) => w.host === host);
    if (!entry) return null;
    return {
      ...(entry.opts.width != null ? { width: entry.opts.width } : {}),
      ...(entry.opts.height != null ? { height: entry.opts.height } : {}),
      collapsed: entry.collapsed === true,
      z: entry.z,
      theme: entry.theme,
    };
  }

  /** Apply persisted state without invoking title widgets or moving native content.
   * Resolves after the chrome commit; cancellation, supersession and removed hosts are no-ops.
   * Preparation failure rejects and leaves the previously committed state intact. */
  async applyState(host: HTMLElement, state: ManagedWindowState, signal?: AbortSignal): Promise<void> {
    const entry = this.windows.find(w => w.host === host);
    if (!entry || signal?.aborted) return;
    for (const value of [state.width, state.height, state.z]) {
      if (value !== undefined && !Number.isFinite(value)) throw new TypeError('Window state must be finite');
    }
    const opts = { ...entry.opts,
      ...(state.width !== undefined ? { width: state.width } : {}),
      ...(state.height !== undefined ? { height: state.height } : {}),
    };
    const collapsed = state.collapsed ?? (entry.collapsed === true);
    const z = state.z ?? entry.z;
    const repaint = opts.width !== entry.opts.width || opts.height !== entry.opts.height
      || collapsed !== (entry.collapsed === true);
    const application = ++entry.applyStateEpoch;
    if (!repaint && z === entry.z) return;
    const epoch = ++entry.renderEpoch;
    const current = (): boolean => !signal?.aborted && application === entry.applyStateEpoch
      && epoch === entry.renderEpoch && this.windows.includes(entry);
    let prepared;
    try {
      if (repaint) prepared = await this.prepareRender({ ...entry, opts, collapsed, z }, entry.theme);
    } catch (error) {
      if (!current()) return;
      throw error;
    }
    if (!current()) return;
    entry.opts = opts;
    entry.collapsed = collapsed;
    entry.z = z;
    this.zClock = Math.max(this.zClock, z);
    if (prepared) this.commitRender(entry, prepared);
    else { host.style.zIndex = this.zIndexFor(entry); this.notifyChange(entry); }
  }

  /** Read-only browser coordinate authority for this manager's committed window. */
  contentPort(host: HTMLElement): ManagedControlPort | null {
    return this.windows.find(entry => entry.host === host)?.contentPort.port ?? null;
  }

  /**
   * Add a window. Returns a positioned host element (caller places it). The
   * FIRST window added is active by default. `handlers` wire the title-bar
   * widgets; a transparent focusable button is overlaid on each widget that has
   * a handler (the widget art itself lives in the chrome cicn).
   */
  async add(
    theme: Theme,
    opts: RenderWindowOptions = {},
    handlers: TitleWidgetHandlers = {},
    extra: {
      contentEl?: HTMLElement;
      z?: number;
      collapsed?: boolean;
      /** See ManagedWindow<Theme>.enabledWidgets — opt-in widget subset. Plumbed
       *  from `data-scriptoscope-widgets` for the declarative path. */
      enabledWidgets?: ReadonlySet<TitleWidget>;
    } = {},
  ): Promise<HTMLElement> {
    const host = document.createElement('div');
    // Stable shell hook for both imperative and declarative windows. Controls
    // also carry data-scriptoscope-promoted, so it cannot identify a window.
    host.setAttribute('data-scriptoscope-window-host', '');
    host.style.position = 'absolute';
    // SHADOW DOM (ADR-0001 Decision 2): attach a shadow root to the host. The window's chrome
    // canvas + DOM-twin widgets + grow box + themed scrollbars all live inside the shadow root —
    // shielded from host-page CSS that targets div/canvas/button universally or via resets. The
    // consumer's content lives in the host's LIGHT DOM (set below if extra.contentEl), where
    // host CSS still reaches it; renderWindow's <slot> inside .scriptoscope-content auto-renders it.
    host.attachShadow({ mode: 'open' });
    // A11y: inject a focus-visible outline stylesheet into the shadow root so
    // the chrome's overlay buttons (title widgets, move handle, grow box,
    // scrollbar) show a visible focus ring on Tab. The host's outer
    // :focus-visible rule (scriptoscope.css:86) doesn't reach inside the
    // shadow — without this, keyboard users land on invisible focus targets.
    // adoptedStyleSheets is the lowest-overhead path (shared between all
    // window hosts, no per-host parse cost). a11y reviewer 2026-05-31.
    if (host.shadowRoot && typeof CSSStyleSheet !== 'undefined') {
      try { host.shadowRoot.adoptedStyleSheets = [shadowFocusSheet]; }
      catch { /* older browsers may reject; the consumer's :focus default still applies */ }
    }
    debug('shadow', `attached for ${opts.title ?? '(untitled)'}`, { hasContent: !!extra.contentEl });
    if (extra.contentEl) host.appendChild(extra.contentEl);  // light-DOM child → slotted into shadow
    // NB: role + aria-label live on the INNER `.scriptoscope-window` element built by renderWindow.ts (which
    // emits role=dialog for utility windows, role=group otherwise; aria-label=title). Don't duplicate
    // them on the host — double-labelling makes screen readers announce the window twice.
    // Initial focus: the first window added is active — UNLESS it explicitly requests inactive
    // (so a declarative `data-scriptoscope-state="inactive"` is honored; then no window starts focused).
    const entry: ManagedWindow<Theme> = {
      theme, opts, handlers, host, renderEpoch: 0, commitEpoch: 0, applyStateEpoch: 0, initializing: true, contentPort: new ManagedContentPort(),
      ...(opts.reuseCanvas ? { chromeCanvas: opts.reuseCanvas } : {}),
      active: this.windows.length === 0 && opts.state !== 'inactive',
      // Declared z (data-scriptoscope-z) wins; else take the next stacking-clock tick. We still bump the
      // clock either way so subsequent focus events stay monotonic relative to any declared values.
      z: extra.z ?? ++this.zClock,
      ...(extra.collapsed ? { collapsed: true } : {}),
      ...(extra.contentEl ? { contentEl: extra.contentEl } : {}),
      ...(extra.enabledWidgets !== undefined ? { enabledWidgets: extra.enabledWidgets } : {}),
    };
    if (extra.z != null && extra.z > this.zClock) this.zClock = extra.z; // keep clock above declared
    this.windows.push(entry);
    // mousedown (not click) so focus lands before any inner control acts.
    host.addEventListener('pointerdown', () => { void this.focus(entry); });
    try {
      await this.render(entry);
      entry.initializing = false;
      return host;
    } catch (error) {
      // The caller never receives this detached host when preparation fails.
      // Drop its entry/listeners here so retrying does not leave a phantom
      // window behind or make the first successful window start inactive.
      this.remove(host);
      throw error;
    }
  }

  /** Stop managing a window (its host was/will be removed by the caller). Aborts its scrollbar
   *  listeners, removes any flow-slot placeholder that the drag handoff inserted, and drops
   *  the entry so it's not re-rendered/re-themed later. Idempotent. */
  remove(host: HTMLElement): void {
    const i = this.windows.findIndex((w) => w.host === host);
    if (i < 0) return;
    this.windows[i]!.renderEpoch++;
    this.windows[i]!.contentPort.dispose();
    this.windows[i]?.scrollAbort?.abort();
    this.windows[i]?.frameAbort?.abort();
    this.windows.splice(i, 1);
    // Drag-handoff placeholder cleanup (toAbsolute inserts one to keep the
    // page from shifting when an in-flow host lifts to absolute). Removed
    // here so the flow slot closes back up when the window unmounts.
    const placeholder = (host as unknown as { __scriptoscopePlaceholder?: HTMLElement }).__scriptoscopePlaceholder;
    if (placeholder) {
      placeholder.remove();
      delete (host as unknown as { __scriptoscopePlaceholder?: HTMLElement }).__scriptoscopePlaceholder;
    }
  }

  /** Set a window host's absolute-coordinate position. The chokepoint for ALL geometry
   *  mutations after promote: drag, keyboard-arrow move, cross-tab restore. Future v2
   *  reflow features (snap-to-grid, collision detection, multi-window tiling) intercept
   *  HERE rather than at every scattered `host.style.left = ...` site. Fires onChange so
   *  persistence + consumer listeners see the new position. Idempotent if the host's
   *  position is already absolute. */
  setPosition(host: HTMLElement, x: number, y: number): void {
    if (host.style.position !== 'absolute' && host.style.position !== 'fixed') {
      host.style.position = 'absolute';
    }
    host.style.left = `${Math.round(x)}px`;
    host.style.top = `${Math.round(y)}px`;
    if (this.onChange) try { this.onChange(host); } catch (err) { console.error('[scriptoscope] onChange threw:', err); }
  }

  /** Convert an in-flow host to `position: absolute` at its CURRENT visible page position.
   *  Captures the host's bounding rect, computes the offset against the nearest positioned
   *  ancestor, and flips position + sets top/left so the user perceives no jump. Called by
   *  the drag + keyboard-move handlers on the first move of a Posture-B in-flow host;
   *  subsequent moves skip this since the host is already absolute. Returns the (x, y) it
   *  applied so callers can start their drag math from a known baseline.
   *
   *  Also inserts a same-sized PLACEHOLDER `<div>` in the host's old flow position,
   *  so siblings don't collapse upward into the vacated slot — the visible page-shift
   *  on drag-start was worse than the dragability it bought (user-decided 2026-05-31).
   *  Period-Mac analogy: a dragged window leaves a visible 'origin' gap on the desktop.
   *  The placeholder is removed in WindowManager.remove (window unmount). */
  toAbsolute(host: HTMLElement): { x: number; y: number } {
    if (host.style.position === 'absolute' || host.style.position === 'fixed') {
      return { x: parseFloat(host.style.left) || 0, y: parseFloat(host.style.top) || 0 };
    }
    const anc = host.parentElement ? findPositionedAncestor(host) : null;
    const offset = offsetInContainingBlock(viewportFrame(host).origin, anc);
    const x = Math.round(offset.x);
    const y = Math.round(offset.y);
    // Reserve the static slot BEFORE flipping position. Insert as a sibling
    // immediately before the host so it sits in the same flow position.
    // Block element matching the host's outer width/height; invisible +
    // aria-hidden so AT skips it. Lifecycle: cleared in WindowManager.remove
    // (single cleanup site, matches setPosition's single-mutation pattern).
    const parent = host.parentNode;
    const hasPlaceholder = (host as unknown as { __scriptoscopePlaceholder?: HTMLElement }).__scriptoscopePlaceholder;
    if (parent && !hasPlaceholder) {
      const placeholder = document.createElement('div');
      placeholder.setAttribute('aria-hidden', 'true');
      placeholder.dataset.scriptoscopePlaceholder = '';
      Object.assign(placeholder.style, {
        // Layout size, not the bounding rect: under a scaled or rotated
        // ancestor the rect is the transformed box's screen bounds.
        display: 'block', width: `${host.offsetWidth}px`, height: `${host.offsetHeight}px`,
        margin: '0', padding: '0', border: '0', background: 'transparent',
        pointerEvents: 'none', visibility: 'hidden',
      } satisfies Partial<CSSStyleDeclaration>);
      parent.insertBefore(placeholder, host);
      (host as unknown as { __scriptoscopePlaceholder?: HTMLElement }).__scriptoscopePlaceholder = placeholder;
    }
    host.style.position = 'absolute';
    host.style.left = `${x}px`;
    host.style.top = `${y}px`;
    return { x, y };
  }

  /** Re-check scrollbars for a window without re-rendering chrome. Public so the
   *  declarative layer can nudge the runtime after content-only changes — e.g. the
   *  theme picker populates tiles AFTER mount, growing the slot's scrollHeight past
   *  its declared height. The initial wireScrollbars (called from render() before
   *  tile load) sees no overflow and bails; without this hook, scrollbars never
   *  appear because no re-render fires. The find-current-win path goes through
   *  shadowRoot.firstChild (same as render's staleness check). 2026-05-31. */
  async refreshScrollbars(host: HTMLElement): Promise<void> {
    const entry = this.windows.find((w) => w.host === host);
    if (!entry) return;
    const win = entry.host.shadowRoot?.firstChild as HTMLElement | null;
    if (!win) return;
    await this.wireScrollbars(entry, win, 0);
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

  private themeEpoch = 0;

  /** Re-skin every managed window with a new theme and re-render in place (the persistent slotted
   *  content survives, exactly as on a focus re-render). Drives the declarative theme-switcher — the
   *  whole desktop changes scheme at runtime, the Kaleidoscope way. Public for imperative consumers.
   *  `themeRef` is the declarative mount's host metadata (not loaded asset identity);
   *  imperative callers normally omit it. It commits with the pixels, before onChange. */
  async retheme(theme: Theme, signal?: AbortSignal, themeRef?: string): Promise<void> {
    const epoch = ++this.themeEpoch;
    // Preserve the existing detached-host cleanup, but do not steal an add()
    // still preparing its initial off-DOM host.
    for (const entry of [...this.windows]) {
      if (!entry.host.isConnected && !entry.initializing) this.remove(entry.host);
    }
    const current = (): boolean => epoch === this.themeEpoch && !signal?.aborted;
    // Preparation never touches a live canvas. Failed/superseded batches leave
    // every current window intact; commit below contains no asynchronous work.
    const prepared = new Map<ManagedWindow<Theme>, { epoch: number; win: HTMLElement; collapsed: boolean }>();
    while (current()) {
      const entries = this.windows.filter(w => w.host.isConnected);
      try {
        for (const entry of entries) {
          if (!current()) return;
          if (prepared.get(entry)?.epoch === entry.renderEpoch) continue;
          const version = entry.renderEpoch;
          const result = await this.prepareRender(entry, theme);
          if (!current()) return;
          prepared.set(entry, { epoch: version, ...result });
        }
      } catch (error) {
        if (!current()) return;
        throw error;
      }
      // Focus/resize may have changed an entry while another raster decoded.
      // Re-prepare only changed entries; removed windows are never resurrected.
      const live = this.windows.filter(w => w.host.isConnected);
      if (live.some(w => prepared.get(w)?.epoch !== w.renderEpoch)) continue;
      for (const entry of live) {
        const result = prepared.get(entry)!;
        entry.renderEpoch++; // invalidate any older standalone render
        entry.theme = theme;
        this.commitRender(entry, result, false);
        if (themeRef !== undefined) entry.host.dataset.scriptoscopeTheme = themeRef;
      }
      for (const entry of live) this.notifyChange(entry);
      return;
    }
  }

  private async focus(entry: ManagedWindow<Theme>): Promise<void> {
    if (!this.windows.includes(entry)) return;
    entry.z = ++this.zClock; // raise above all (even if already active — re-clicking a window fronts it)
    if (entry.active) {
      debug('focus', `${entry.opts.title ?? '(untitled)'} — already active, z=${entry.z}`);
      entry.host.style.zIndex = this.zIndexFor(entry);
      return;
    }
    debug('focus', `${entry.opts.title ?? '(untitled)'} — gaining active`, { z: entry.z, total: this.windows.length });
    const changed: ManagedWindow<Theme>[] = [];
    // Publish the whole focus state before preparation can yield, then start
    // every changed render so a later click cannot strand unpainted state.
    for (const w of this.windows) {
      const was = w.active;
      w.active = w === entry;
      if (w.active !== was) { w.renderEpoch++; changed.push(w); }
      else w.host.style.zIndex = this.zIndexFor(w);
    }
    await Promise.all(changed.map(w => this.render(w)));
  }

  /** Active windows float above inactive ones; within each group, higher zClock (more recent) wins. */
  private zIndexFor(entry: ManagedWindow<Theme>): string {
    return String((entry.active ? 100_000 : 0) + entry.z);
  }

  /** The window-type slug actually rendered: the collapsed variant when shaded, else the base type. */
  private effectiveSlug(entry: ManagedWindow<Theme>, theme = entry.theme): string {
    const base = entry.opts.windowType ?? 'document-window';
    // Window-shade: render the collapsed chrome variant (title-bar-only art) if the theme ships one,
    // else fall back to the same type at zero body height — both roll the window up to the title bar.
    return entry.collapsed ? (resolveCollapsedWindowTypeSlug(themeView(theme), base, entry.active ? 'active' : 'inactive') ?? base) : base;
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
  private async render(entry: ManagedWindow<Theme>): Promise<void> {
    const epoch = ++entry.renderEpoch;
    let prepared;
    try { prepared = await this.prepareRender(entry, entry.theme); }
    catch (error) {
      if (epoch !== entry.renderEpoch || !this.windows.includes(entry)) return;
      throw error;
    }
    if (epoch !== entry.renderEpoch || !this.windows.includes(entry)) return;
    this.commitRender(entry, prepared);
  }

  private async prepareRender(entry: ManagedWindow<Theme>, theme: Theme): Promise<{ win: HTMLElement; collapsed: boolean }> {
    const collapsed = entry.collapsed === true;
    const slug = this.effectiveSlug(entry, theme);
    const { reuseCanvas: _callerCanvas, ...options } = entry.opts;
    const win = await renderWindow(theme, {
      ...options,
      windowType: slug,
      ...(collapsed ? { height: 0 } : {}),
      state: entry.active ? 'active' : 'inactive',
      // Never lend a live pooled canvas to an asynchronous preparation.
    });
    return { win, collapsed };
  }

  private commitRender(entry: ManagedWindow<Theme>, { win, collapsed }: { win: HTMLElement; collapsed: boolean }, notify = true): void {
    entry.commitEpoch++;
    const fresh = win.querySelector<HTMLCanvasElement>('canvas.scriptoscope-chrome');
    const pooled = entry.chromeCanvas;
    if (fresh && pooled) {
      pooled.width = fresh.width; pooled.height = fresh.height;
      pooled.style.cssText = fresh.style.cssText;
      pooled.className = fresh.className;
      pooled.getContext('2d')!.drawImage(fresh, 0, 0);
      fresh.replaceWith(pooled);
    }
    if (fresh) entry.chromeCanvas = pooled ?? fresh;
    else delete entry.chromeCanvas;
    entry.host.style.zIndex = this.zIndexFor(entry);
    // Consumer content lives in the host's LIGHT DOM (placed there once in add()); renderWindow's
    // <slot> inside .scriptoscope-content auto-renders it. No per-render re-slotting needed — the slot
    // shows whatever's in light DOM, and the same DOM node persists across re-renders so
    // listeners + selection + scroll position survive.
    // When shaded, hide the content area (preserves the content node, just visually collapsed).
    if (collapsed) {
      const hole = win.querySelector('.scriptoscope-content') as HTMLElement | null;
      if (hole) hole.style.display = 'none';
    }
    // Keep the rendered projection continuously mounted: replacing its ancestors cancels
    // a browser's pending native Space activation even when light-DOM focus survives.
    const mount = entry.host.shadowRoot ?? entry.host;
    const live = mount.firstChild as HTMLElement | null;
    const content = live?.querySelector<HTMLElement>('.scriptoscope-content');
    const preparedContent = win.querySelector<HTMLElement>('.scriptoscope-content');
    if (live && content && preparedContent) {
      const syncAttributes = (target: HTMLElement, source: HTMLElement): void => {
        for (const attr of Array.from(target.attributes))
          if (!source.hasAttribute(attr.name)) target.removeAttribute(attr.name);
        for (const attr of Array.from(source.attributes))
          if (target.getAttribute(attr.name) !== attr.value) target.setAttribute(attr.name, attr.value);
      };
      syncAttributes(live, win);
      syncAttributes(content, preparedContent);
      Object.assign(live, { _scriptoscopeComposed:
        (win as unknown as { _scriptoscopeComposed?: ComposedChrome })._scriptoscopeComposed });
      for (const child of Array.from(live.childNodes)) if (child !== content) child.remove();
      let beforeContent = true;
      for (const child of Array.from(win.childNodes)) {
        if (child === preparedContent) { beforeContent = false; continue; }
        live.insertBefore(child, beforeContent ? content : null);
      }
      win = live;
    } else mount.replaceChildren(win);
    this.overlayWidgets(entry, win);
    this.wireMoveResize(entry, win);
    const viewport = win.querySelector<HTMLElement>('.scriptoscope-content');
    if (viewport) entry.contentPort.commit(entry.host, viewport, Math.max(1, Math.round(entry.opts.scale ?? 1)));
    else entry.contentPort.clear();
    // Themed scrollbar (replaces the native one) when the content overflows. Must run AFTER the window
    // is in the DOM — overflow can only be measured once the content is laid out.
    void this.wireScrollbars(entry, win, 0);
    // Notify the persistence layer (or any other state-change consumer) that this window's
    // render-affecting state is now committed. Fired after the DOM is updated so callers see the
    // final state. Cheap branch if no listener is registered.
    if (notify) this.notifyChange(entry);
  }

  private notifyChange(entry: ManagedWindow<Theme>): void {
    if (this.onChange) try { this.onChange(entry.host); } catch (err) { console.error('[scriptoscope] onChange threw:', err); }
  }

  /**
   * Replace the native browser scrollbar with the scheme's own scrollbar art when declared-size
   * content overflows (content-fit windows grow to fit, so they never reach here). We own the scroll:
   * `.scriptoscope-content` goes `overflow:hidden`, a gutter is reserved on the relevant side(s), and themed
   * scrollbar(s) are overlaid — dragging the thumb, the wheel, and arrow keys all set scrollTop /
   * scrollLeft and repaint the thumb (two-way). Re-run on every render() (which rebuilds the subtree),
   * guarded against stale wins. `attempt` retries across a couple of frames for the first render, when
   * the host isn't in the document yet so nothing has layout. Detects + wires BOTH axes — vertical and
   * horizontal — independently, so a long-and-wide content gets both bars + a clear bottom-right corner.
   */
  private async wireScrollbars(entry: ManagedWindow<Theme>, win: HTMLElement, attempt: number, epoch = entry.commitEpoch): Promise<void> {
    // Staleness check: is `win` still the current chrome? See LEARNINGS 2026-05-28 "Shadow DOM
    // gotchas" — host.firstChild is the slotted .scriptoscope-slot now, not win. We resolve via shadowRoot.
    // We deliberately do NOT use win.isConnected: ScriptoscopeWindow.promote inserts the host into the
    // document AFTER manager.add returns, so the initial wireScrollbars fires while host is
    // still detached. The ch===0 retry below catches that pre-layout case; staleness is what
    // this check covers, including retries from an older commit on the retained root.
    const currentChrome = entry.host.shadowRoot?.firstChild ?? entry.host.firstChild;
    if (!this.windows.includes(entry) || currentChrome !== win || entry.commitEpoch !== epoch) {
      debug('scrollbar', `${entry.opts.title ?? ''} — stale win, bailing`);
      return;
    }
    // Tear down the previous render's scrollbar listeners (esp. the wheel listener on the persistent
    // slot) BEFORE re-wiring, so they can't accumulate across renders/re-themes.
    if (entry.scrollAbort) debug('scrollbar', `${entry.opts.title ?? ''} — tearing down previous bars`);
    entry.scrollAbort?.abort();
    if (entry.collapsed) return;                          // shaded: no body to scroll
    const composed = (win as unknown as { _scriptoscopeComposed?: ComposedChrome })._scriptoscopeComposed;
    const content = win.querySelector('.scriptoscope-content') as HTMLElement | null;
    if (!composed || !content) return;
    // Palettes / utility windows / modals / dialogs never scrolled in classic Mac — they're sized to
    // their content. Hard-clip them so neither a native nor a themed scrollbar can appear.
    const type = entry.opts.windowType ?? '';
    if (/utility|palette|floating|modal|dialog/.test(type)) {
      (entry.contentEl ?? content).style.overflow = 'hidden';
      return;
    }
    // The real scroll container is the declarative layer's slot (entry.contentEl, overflow:auto inside
    // .scriptoscope-content) when present, else .scriptoscope-content itself for plain WindowManager windows.
    const scrollEl = entry.contentEl ?? content;
    // Reset gutters from a previous wire so the natural-size measurement isn't inflated.
    scrollEl.style.paddingRight = '';
    scrollEl.style.paddingBottom = '';
    const ch = scrollEl.clientHeight;
    const cw = scrollEl.clientWidth;
    if (ch === 0 || cw === 0) {                           // not laid out yet (first render, pre-insert)
      if (attempt < 4) requestAnimationFrame(() => { void this.wireScrollbars(entry, win, attempt + 1, epoch); });
      return;
    }
    const needV = scrollEl.scrollHeight > ch + 1;
    const needH = scrollEl.scrollWidth > cw + 1;
    if (!needV && !needH) {
      scrollEl.style.overflowY = '';
      scrollEl.style.overflowX = '';
      debug('scrollbar', `${entry.opts.title ?? ''} — no overflow, native behavior`);
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
    debug('scrollbar', `${entry.opts.title ?? ''} — wiring`, {
      vertical: needV, horizontal: needH,
      content: `${cw}×${ch}`, scroll: `${scrollEl.scrollWidth}×${scrollEl.scrollHeight}`,
    });
    if (needV) this.wireScrollbarAxis('vertical', entry, win, scrollEl, composed, scale, ac.signal, { needV, needH });
    if (needH) this.wireScrollbarAxis('horizontal', entry, win, scrollEl, composed, scale, ac.signal, { needV, needH });
  }

  /**
   * Per-axis scrollbar wiring (vertical OR horizontal). The two axes share an AbortController so a
   * re-render aborts both; the bars are independent DOM elements with their own listeners.
   */
  private wireScrollbarAxis(
    axis: 'vertical' | 'horizontal',
    entry: ManagedWindow<Theme>,
    win: HTMLElement,
    scrollEl: HTMLElement,
    composed: ComposedChrome,
    scale: number,
    signal: AbortSignal,
    flags: { needV: boolean; needH: boolean },
  ): void {
    const current = (): boolean => !signal.aborted && this.windows.includes(entry)
      && (entry.host.shadowRoot?.firstChild ?? entry.host.firstChild) === win;
    if (!current()) return;
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
    bar.className = `scriptoscope-window-scrollbar scriptoscope-window-scrollbar-${axis}`;
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

    let raf = 0, paintEpoch = 0;
    signal.addEventListener('abort', () => {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      bar.remove();
    }, { once: true });
    const repaint = async (): Promise<void> => {
      if (!current()) return;
      const epoch = paintEpoch;
      try {
        const opts = { orientation: axis, length: Math.round(barLenCss / scale), value };
        const themed = await composeScrollbar(entry.theme, opts);
        if (!current() || epoch !== paintEpoch) return;
        // thumbExtent shapes only the procedural fallback, never the engine thumb.
        const buf = themed ?? platinumScrollbar({ ...opts, thumbExtent });
        bar.replaceChildren(bufferToCanvas(buf, scale));
        bar.setAttribute('aria-valuenow', String(Math.round(opts.value * 100)));
      } catch (error) {
        if (current() && epoch === paintEpoch && !(error instanceof DOMException && error.name === 'AbortError'))
          console.error('[scriptoscope] scrollbar paint failed:', error);
      }
    };
    const scheduleRepaint = (): void => { if (current() && !raf) raf = requestAnimationFrame(() => { raf = 0; void repaint(); }); };
    const setValue = (v: number): void => {
      paintEpoch++;
      value = clamp01(v);
      if (vertical) scrollEl.scrollTop = value * maxScroll;
      else scrollEl.scrollLeft = value * maxScroll;
      scheduleRepaint();
    };

    win.appendChild(bar);

    // Drag the thumb (pointer = touch + mouse + pen).
    const valueAtPointer = (e: PointerEvent): number => {
      const p = pointInElement(bar, e.clientX, e.clientY);
      return clamp01(vertical ? p.y / p.height : p.x / p.width);
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
      const delta = vertical || e.shiftKey ? e.deltaY : e.deltaX;
      if (Math.abs(delta) < 0.5) return;
      e.preventDefault();
      setValue(((vertical ? scrollEl.scrollTop : scrollEl.scrollLeft) + delta) / maxScroll);
    }, { passive: false, signal });

    // Arrow keys / page keys on the bar.
    bar.addEventListener('keydown', (e) => {
      const line = maxScroll > 0 ? 24 / maxScroll : 0;
      const page = trackLen / maxScroll;
      let next = value;
      if (e.key === (vertical ? 'ArrowDown' : 'ArrowRight')) next = value + line;
      else if (e.key === (vertical ? 'ArrowUp' : 'ArrowLeft')) next = value - line;
      else if (e.key === 'PageDown') next = value + page;
      else if (e.key === 'PageUp') next = value - page;
      else if (e.key === 'Home') next = 0;
      else if (e.key === 'End') next = 1;
      else return;
      e.preventDefault(); setValue(next);
    }, { signal });

    void repaint(); // initial thumb paint (staleness-guarded inside)
  }

  /** Toggle window-shade. Built-in for windows whose collapse widget has no explicit handler. */
  private async toggleCollapse(entry: ManagedWindow<Theme>): Promise<void> {
    entry.collapsed = !entry.collapsed;
    debug('drag', `toggleCollapse ${entry.opts.title ?? ''} → collapsed=${entry.collapsed}`);
    await this.render(entry);
    entry.handlers.onCollapse?.();
  }

  /** Toggle zoom: grow to fit the content (capped), or restore the user/declared size.
   *  Bumps z-order so a background window zoomed-to-fit comes to the front (otherwise it'd
   *  re-render at the new size but stay buried — UX bug surfaced by 2026-05-28 review). */
  private async toggleZoom(entry: ManagedWindow<Theme>): Promise<void> {
    if (entry.collapsed) entry.collapsed = false; // zooming an un-shades first
    entry.z = ++this.zClock;                       // raise to front (fix from 2026-05-28 review)
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
    debug('drag', `toggleZoom ${entry.opts.title ?? ''} → zoomed=${entry.zoomed}`, {
      w: entry.opts.width, h: entry.opts.height,
    });
    await this.render(entry);
    entry.handlers.onZoom?.();
  }

  /**
   * Make the window movable (drag the title bar) and resizable (drag the grow box). Move is live
   * (CSS left/top — cheap); resize draws a classic ghost OUTLINE during the drag and re-renders the
   * window at the new content size on release (faithful to the Mac grow-box, and avoids an async
   * re-render per mouse-move). Re-attached on every render(), so it tracks the current chrome.
   */
  private wireMoveResize(entry: ManagedWindow<Theme>, win: HTMLElement): void {
    entry.frameAbort?.abort();
    const signal = (entry.frameAbort = new AbortController()).signal;
    const composed = (win as unknown as { _scriptoscopeComposed?: ComposedChrome })._scriptoscopeComposed;
    if (!composed) return;
    const scale = Math.max(1, Math.round(entry.opts.scale ?? 1));
    const host = entry.host;

    // MOVE — mousedown anywhere on the FRAME (any inset edge), not just the top. Side-titled palette
    // windows (`side-floating-utility-window`) put their title strip on the LEFT, not the top, so a
    // top-only check would leave them un-draggable. "Frame" = the window rect minus the content rect.
    // Widgets (title boxes) and the grow-box corner stopPropagation, so they don't trigger drag; the
    // themed scrollbar (when present) also stopPropagation on pointerdown for the same reason.
    const inFrame = (e: MouseEvent): boolean => {
      // Work in the window's own CSS pixels so a scaled or rotated ancestor
      // (#515, #519) doesn't shift the frame strip against the pointer.
      const { x: dx, y: dy } = viewportFrame(win).toLocal(e.clientX, e.clientY);
      const cx = composed.frame.left * scale, cy = composed.frame.top * scale;
      const cw = win.offsetWidth - (composed.frame.left + composed.frame.right) * scale;
      const ch = win.offsetHeight - (composed.frame.top + composed.frame.bottom) * scale;
      return !(dx >= cx && dx < cx + cw && dy >= cy && dy < cy + ch);
    };
    win.addEventListener('pointerdown', (e) => {
      if (!inFrame(e)) return; // inside the content body — not a drag handle
      if (e.pointerType === 'mouse' && e.button !== 0) return; // only primary mouse button initiates drag
      e.preventDefault();
      void this.focus(entry);
      // Posture B handoff: in-flow hosts (the Posture-B default) need to
      // flip to `position: absolute` before drag math can write top/left.
      // `toAbsolute` is the chokepoint — captures the host's current
      // visible page position, computes coords relative to its positioned
      // ancestor (using the canonical containing-block walker that handles
      // transformed/filtered ancestors correctly — the duplicated ad-hoc
      // walker that lived here pre-2026-05-31 missed those cases),
      // returns the now-applied (x, y). No visual jump.
      const { x: x0, y: y0 } = this.toAbsolute(host);
      // Pointer positions are viewport pixels; left/top are the containing
      // block's CSS pixels. They differ inside a scaled (#515), rotated or
      // skewed (#519) ancestor, so map each position and subtract.
      const frame = viewportFrame(host);
      const start = frame.toLocal(e.clientX, e.clientY);
      const at = (ev: PointerEvent): { x: number; y: number } => {
        const p = frame.toLocal(ev.clientX, ev.clientY);
        return { x: x0 + p.x - start.x, y: y0 + p.y - start.y };
      };
      // Hot-loop bypass: pointermove writes left/top directly at 60Hz for
      // smoothness. Calling setPosition() per move would fire onChange on
      // every frame and thrash persistence + consumer listeners. Acceptable
      // because pointerup commits through setPosition once below — the
      // chokepoint's contract is "every COMMITTED move", not every frame.
      const mv = (ev: PointerEvent): void => { const p = at(ev); host.style.left = `${p.x}px`; host.style.top = `${p.y}px`; };
      const up = (ev: PointerEvent): void => {
        document.removeEventListener('pointermove', mv);
        document.removeEventListener('pointerup', up);
        // Commit through the chokepoint so persistence + future v2 reflow
        // features (snap-to-grid, collision) see the move. setPosition
        // fires onChange for us; no explicit call needed.
        const p = at(ev);
        this.setPosition(host, p.x, p.y);
      };
      document.addEventListener('pointermove', mv); document.addEventListener('pointerup', up);
    }, { signal });

    // KEYBOARD MOVE HANDLE — focusable transparent button overlaying the title region. Closes the
    // a11y gap from the 2026-05-28 DOM-twin audit: pointer-drag was the only way to move a window
    // before this. Mirrors the grow box's arrow-key resize pattern (8px steps, Shift × 4). CSS-only
    // updates to host.style.left/top — no render, preserving the render-frequency contract. We place
    // the handle at the top frame strip; for side-titled palettes that have left-side titles, the
    // top strip is usually 1-2px (still reachable but visually subtle) and tab-discoverability still
    // works. A11y purists may want a side variant for those palettes later; first alpha consumer can
    // tell us if it matters. (closes #169)
    const moveBtn = document.createElement('button');
    moveBtn.type = 'button';
    moveBtn.className = 'scriptoscope-movehandle';
    moveBtn.setAttribute('aria-label', 'Move window');
    Object.assign(moveBtn.style, {
      position: 'absolute', left: '0', top: '0',
      width: '100%', height: `${Math.max(1, composed.frame.top * scale)}px`,
      padding: '0', margin: '0', border: '0', background: 'transparent',
      cursor: 'inherit', zIndex: '1',
      pointerEvents: 'none',                 // pointer drag stays on the win listener above
      outlineOffset: '2px',
    } satisfies Partial<CSSStyleDeclaration>);
    moveBtn.tabIndex = 0;                    // Tab-reachable even with pointer-events:none
    moveBtn.addEventListener('keydown', (e) => {
      const step = (e.shiftKey ? 32 : 8);
      let dx = 0, dy = 0;
      if (e.key === 'ArrowRight')      dx =  step;
      else if (e.key === 'ArrowLeft')  dx = -step;
      else if (e.key === 'ArrowDown')  dy =  step;
      else if (e.key === 'ArrowUp')    dy = -step;
      else return;
      e.preventDefault();
      void this.focus(entry);
      // Posture B handoff: same as pointer-drag above — `toAbsolute` is the
      // chokepoint that converts an in-flow host on first move. After the
      // first arrow keypress the host stays absolute; subsequent steps are
      // pure left/top math.
      const { x: x0, y: y0 } = this.toAbsolute(host);
      // setPosition is the chokepoint — it fires onChange so persistence
      // + consumer listeners see the new position. The contract is the
      // same as the pointer-drag mouseup: CSS-only update, no render,
      // single commit point.
      this.setPosition(host, x0 + dx, Math.max(0, y0 + dy));
      debug('drag', `keyboard move ${entry.opts.title ?? ''}`, { dx, dy, x: x0 + dx, y: y0 + dy });
    });
    win.appendChild(moveBtn);

    // Double-click any frame edge to window-shade (the classic Mac WindowShade gesture, side palettes
    // included — the side title strip is the natural target for a vertical title bar). Ignores
    // double-clicks on the widgets, the scrollbar, and the grow-box corner.
    win.addEventListener('dblclick', (e) => {
      const t = e.target as HTMLElement;
      if (t.closest('.scriptoscope-titlewidget') || t.closest('.scriptoscope-window-scrollbar')) return;
      if (!inFrame(e)) return;
      e.preventDefault();
      void this.toggleCollapse(entry);
    }, { signal });

    // A shaded window has no content area to resize. Its bottom-right resize
    // overlay would cover the title widgets (and intercept the restore click).
    if (entry.collapsed) return;

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
    corner.className = 'scriptoscope-growbox';
    corner.setAttribute('aria-label', 'Resize window');
    Object.assign(corner.style, {
      position: 'absolute', right: '0', bottom: '0', width: `${cw}px`, height: `${ch}px`,
      cursor: 'nwse-resize', zIndex: '4', touchAction: 'none', // touch-drag must not page-scroll
      padding: '0', margin: '0', border: '0', background: 'transparent',
      outlineOffset: '2px',
    } satisfies Partial<CSSStyleDeclaration>);
    // Keyboard alternative for the pointer-driven resize: arrow keys nudge size by 8px; Shift×4.
    // (Scriptoscope's growbox is otherwise pointer-only — and an a11y dead-end if a keyboard user wants to
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
      // Same Posture-B handoff as the pointer grow box — see comment below.
      this.toAbsolute(host);
      const w0 = entry.opts.width ?? 240, h0 = entry.opts.height ?? 120;
      const nw = Math.max(minContentW, w0 + dw), nh = Math.max(40, h0 + dh);
      entry.opts = { ...entry.opts, width: nw, height: nh };
      void this.render(entry);
      // Signal to the declarative layer that the user owns the size now.
      // ScriptoscopeWindow's auto-fit ResizeObserver disconnects on this
      // event — otherwise the "only grows" auto-fit fights the user's
      // shrink (e.g. narrowing a wrapping picker grows the height to fit
      // more rows, undoing the user's intent). 2026-05-31 user fix.
      host.dispatchEvent(new CustomEvent('scriptoscope:userresize', {
        detail: { w: nw, h: nh }, bubbles: true,
      }));
    });
    // Swallow dblclick on the gripper too, else "inFrame at the bottom-right" would shade-on-dblclick.
    corner.addEventListener('dblclick', (e) => { e.stopPropagation(); });
    corner.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.preventDefault(); e.stopPropagation();
      void this.focus(entry);
      // Posture-B handoff: an in-flow host stays at parent block width
      // even after the chrome canvas inside it shrinks — visually the
      // window doesn't appear smaller (the canvas just doesn't fill).
      // toAbsolute flips the host to position:absolute (so it sizes to
      // its content) AND inserts a same-size placeholder in the static
      // slot so the page doesn't shift. Once absolute, all subsequent
      // resizes work naturally. 2026-05-31 user fix follow-up.
      this.toAbsolute(host);
      // Viewport to the host's CSS pixels under a transformed ancestor (#515, #519).
      const frame = viewportFrame(host);
      const start = frame.toLocal(e.clientX, e.clientY);
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
        const p = frame.toLocal(ev.clientX, ev.clientY);
        nw = Math.max(minContentW, w0 + Math.round((p.x - start.x) / scale));
        nh = Math.max(40, h0 + Math.round((p.y - start.y) / scale));
        outline.style.width = `${hw0 + (nw - w0) * scale}px`;
        outline.style.height = `${hh0 + (nh - h0) * scale}px`;
      };
      const up = (): void => {
        document.removeEventListener('pointermove', mv); document.removeEventListener('pointerup', up);
        outline.remove();
        entry.opts = { ...entry.opts, width: nw, height: nh };
        void this.render(entry);
        // Same userresize signal as the keyboard path — the declarative
        // layer's auto-fit disconnects on this event.
        host.dispatchEvent(new CustomEvent('scriptoscope:userresize', {
          detail: { w: nw, h: nh }, bubbles: true,
        }));
      };
      document.addEventListener('pointermove', mv); document.addEventListener('pointerup', up);
    });
    win.appendChild(corner);
  }

  /** Overlay transparent hit buttons for any title-bar widget with a handler. */
  private overlayWidgets(entry: ManagedWindow<Theme>, win: HTMLElement): void {
    const composed = (win as unknown as { _scriptoscopeComposed?: ComposedChrome })._scriptoscopeComposed;
    if (!composed) return; // baseline (procedural) window — no cicn widget rects
    const slug = this.effectiveSlug(entry);
    const scale = Math.max(1, Math.round(entry.opts.scale ?? 1));
    // Per-widget action: an explicit handler wins; otherwise collapse/zoom get a built-in (window-shade
    // / zoom-to-fit) so the widgets work out of the box. Close has no built-in (the manager doesn't own
    // what "close" means — the declarative layer wires onClose=unmount), so a close widget without a
    // handler stays inert. Existing callers that pass handlers (demo/diagnostic.html) keep their behavior.
    const builtin: Partial<Record<TitleWidget, () => void>> = {
      collapse: () => { void this.toggleCollapse(entry); },
      zoom: () => { void this.toggleZoom(entry); },
    };
    // Widget gating: if `enabledWidgets` is set, only widgets in the set get
    // a handler. Widgets NOT in the set are inert (no handler → no transparent
    // overlay button → click does nothing; cicn art still painted). Default
    // (no set) → every widget gets its handler — preserves the pre-2026-05-31
    // behavior for callers that don't pass the option.
    const isOn = (w: TitleWidget): boolean =>
      entry.enabledWidgets === undefined || entry.enabledWidgets.has(w);
    const cb: Record<TitleWidget, (() => void) | undefined> = {
      close: isOn('close') ? entry.handlers.onClose : undefined,
      zoom: isOn('zoom') ? (entry.handlers.onZoom ?? builtin.zoom) : undefined,
      collapse: isOn('collapse') ? (entry.handlers.onCollapse ?? builtin.collapse) : undefined,
    };
    // To show the PRESSED state on mousedown we repaint the live chrome canvas with a pre-rendered
    // pressed variant (renderWindow's pressedWidget), then restore a snapshot of the normal chrome
    // on release. Cheap + lag-free after the first press (the pressed render is cached per widget).
    const chrome = win.querySelector('.scriptoscope-chrome') as HTMLCanvasElement | null;
    const cctx = chrome?.getContext('2d') ?? null;
    const currentChrome = (): boolean => this.windows.includes(entry)
      && entry.host.shadowRoot?.firstChild === win
      && (win as unknown as { _scriptoscopeComposed?: ComposedChrome })._scriptoscopeComposed === composed;
    for (const hit of titleWidgetHits(entry.theme, slug, composed, scale, entry.active ? 'active' : 'inactive')) {
      const handler = cb[hit.role];
      if (!handler) continue;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `scriptoscope-titlewidget scriptoscope-titlewidget-${hit.role}`;
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
        // WM381 modern policy: title buttons take priority over enlarged resize overlays.
        cursor: 'default', zIndex: '5',
      } satisfies Partial<CSSStyleDeclaration>);
      // HT7: inside the rect, only the pressed strip's mask hits; elsewhere the event passes to the window.
      const onWidget = (e: MouseEvent): boolean => !composed.hitWidget
        || composed.hitWidget(Math.floor((hit.rect.x + e.offsetX) / scale), Math.floor((hit.rect.y + e.offsetY) / scale)) === hit.role;
      // A keyboard or assistive-technology click (detail 0) has no pointer position: it always acts (DECISIONS #12).
      btn.addEventListener('click', (e) => { if (e.detail !== 0 && !onWidget(e)) return; e.stopPropagation(); if (currentChrome()) handler(); });
      if (chrome && cctx) {
        let pressedCanvas: HTMLCanvasElement | null | undefined;
        let cacheEpoch = -1, pressEpoch = -1, pressGeneration = 0;
        let normalSnap: HTMLCanvasElement | null = null;
        const press = async (): Promise<void> => {
          if (!currentChrome()) return;
          const generation = ++pressGeneration;
          const epoch = pressEpoch = entry.renderEpoch;
          // A focus-strip swap keeps the chrome node but changes its pixels.
          // Capture the current normal face at press time, not overlay creation.
          normalSnap = document.createElement('canvas');
          normalSnap.width = chrome.width; normalSnap.height = chrome.height;
          normalSnap.getContext('2d')?.drawImage(chrome, 0, 0);
          if (cacheEpoch !== epoch) pressedCanvas = undefined;
          if (pressedCanvas === undefined) {
            try {
              const { reuseCanvas: _callerCanvas, ...options } = entry.opts;
              const pwin = await renderWindow(entry.theme, { ...options, state: entry.active ? 'active' : 'inactive', pressedWidget: hit.role });
              if (!currentChrome() || epoch !== entry.renderEpoch || generation !== pressGeneration) return;
              pressedCanvas = pwin.querySelector<HTMLCanvasElement>('.scriptoscope-chrome');
              cacheEpoch = epoch;
            } catch {
              if (!currentChrome() || epoch !== entry.renderEpoch || generation !== pressGeneration) return;
              pressedCanvas = null; cacheEpoch = epoch;
            }
          }
          if (currentChrome() && epoch === entry.renderEpoch && generation === pressGeneration && pressedCanvas) cctx.drawImage(pressedCanvas, 0, 0);
        };
        const release = (): void => {
          pressGeneration++;
          if (currentChrome() && pressEpoch === entry.renderEpoch && normalSnap) cctx.drawImage(normalSnap, 0, 0);
          normalSnap = null;
        };
        // stopPropagation so the window's mousedown→focus handler doesn't re-render (which would
        // destroy this button mid-press); a widget press shouldn't require focusing the window first.
        btn.addEventListener('pointerdown', (e) => { if (!onWidget(e)) return; e.preventDefault(); e.stopPropagation(); void press(); });
        btn.addEventListener('pointerup', release);
        btn.addEventListener('pointerleave', release);
      }
      win.appendChild(btn);
    }
  }
}
