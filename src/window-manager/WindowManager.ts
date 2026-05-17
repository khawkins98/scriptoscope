// Singleton that tracks all mounted AaronWindow instances and their
// z-order. Provides raise(), focus tracking (data-state active/inactive),
// and onfocus/onblur dispatch.
//
// AaronWindow.mount() registers itself; AaronWindow.unmount() unregisters.
// pointerdown anywhere on a window calls raise() (capture-phase listener,
// so it fires before drag/resize handlers consume the event).
//
// For tests: `windowManager.reset()` clears state between cases. Production
// callers don't need it.

import type { AaronWindow } from './AaronWindow.js';

class WindowManager {
  /** Z-order stack — index 0 is bottom, last index is top. */
  private windows: AaronWindow[] = [];
  /** Currently-focused window (the one at the top of the stack). */
  private focused: AaronWindow | null = null;
  /** Base z-index. Top window = baseZ + (length - 1). */
  private readonly baseZ = 1000;

  /** All currently-registered windows in z-order (bottom to top). */
  get all(): readonly AaronWindow[] {
    return this.windows;
  }

  /** The window currently at the top of the z-order, or null. */
  get topWindow(): AaronWindow | null {
    return this.windows[this.windows.length - 1] ?? null;
  }

  /** The window currently focused (= the top window). */
  get focusedWindow(): AaronWindow | null {
    return this.focused;
  }

  /**
   * Register a freshly-mounted window. It joins the top of the stack and
   * becomes focused. Idempotent — registering an already-registered window
   * just raises it.
   */
  register(w: AaronWindow): void {
    const existing = this.windows.indexOf(w);
    if (existing !== -1) {
      this.raise(w);
      return;
    }
    this.windows.push(w);
    this.applyZOrder();
    this.setFocus(w);
  }

  /**
   * Remove a window from tracking. If it was focused, focus passes to the
   * next-highest window. Idempotent.
   */
  unregister(w: AaronWindow): void {
    const idx = this.windows.indexOf(w);
    if (idx === -1) return;
    this.windows.splice(idx, 1);
    this.applyZOrder();
    if (this.focused === w) {
      this.focused = null;
      const next = this.topWindow;
      if (next !== null) this.setFocus(next);
    }
  }

  /**
   * Move a window to the top of the z-order + focus it. No-op if already
   * on top. Returns true if the order changed.
   */
  raise(w: AaronWindow): boolean {
    const idx = this.windows.indexOf(w);
    if (idx === -1) return false;
    if (idx === this.windows.length - 1 && this.focused === w) return false;
    this.windows.splice(idx, 1);
    this.windows.push(w);
    this.applyZOrder();
    this.setFocus(w);
    return true;
  }

  /**
   * Set focus to a specific window (or null to blur). Updates the
   * data-state attribute on the elements and fires onfocus/onblur.
   */
  setFocus(w: AaronWindow | null): void {
    if (this.focused === w) return;
    const old = this.focused;
    this.focused = w;
    if (old?.element !== undefined && old?.element !== null) {
      old.element.setAttribute('data-state', 'inactive');
    }
    if (w?.element !== undefined && w?.element !== null) {
      w.element.setAttribute('data-state', 'active');
    }
    // Fire callbacks AFTER DOM is updated, so handlers see the new state.
    if (old !== null) old.options.onblur.call(old);
    if (w !== null) w.options.onfocus.call(w);
  }

  /** Clear all tracking. Test-only convenience; not part of the public API. */
  reset(): void {
    this.windows = [];
    this.focused = null;
  }

  private applyZOrder(): void {
    for (let i = 0; i < this.windows.length; i++) {
      const w = this.windows[i];
      if (w?.element !== undefined && w?.element !== null) {
        w.element.style.zIndex = String(this.baseZ + i);
      }
    }
  }
}

/** The single shared WM. There's no use case for multiple yet. */
export const windowManager = new WindowManager();

/** Exported type so tests + advanced consumers can reason about it. */
export type { WindowManager };
