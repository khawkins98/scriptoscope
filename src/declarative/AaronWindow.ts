// AaronWindow — promotes a single consumer element into a managed Mac window. The element's
// CHILDREN become the window's content (moved into the chrome's `.aw-content` hole as live light
// DOM — still selectable, focusable, reflowing); the chrome is the canvas behind them. Two size
// modes: declared (data-aaron-width/height) or content-fit (a ResizeObserver re-renders the chrome
// when the content reflows). Built on the WindowManager's contentEl re-slot hook.

import type { LoadedTheme } from '../types.js';
import type { WindowManager } from '../interactive.js';
import { parseWindowAttrs } from './parse.js';
import { debug } from '../debug.js';
import { sharedRO } from './sharedResizeObserver.js';

export interface AaronWindowDeps {
  manager: WindowManager;
  theme: LoadedTheme;
}

const FIT_DEFAULT = { w: 260, h: 150 }; // provisional first-render size for content-fit (corrected after measure)
const FIT_MAX_W = 720; // cap so a wide content block doesn't yield a monster window
const MIN_W = 80, MIN_H = 40;

export class AaronWindow {
  /** The positioned WindowManager host element (lives in the document). */
  readonly host: HTMLElement;
  private readonly fit: HTMLElement; // max-content wrapper inside the slot; the resize-observe target
  private readonly deps: AaronWindowDeps;
  private readonly restore: { parent: ParentNode | null; next: Node | null; el: HTMLElement };
  /** True once this window is registered with the shared ResizeObserver. We track this rather
   *  than holding a per-window ResizeObserver — sharedRO handles a single browser-side observer
   *  for all windows (closes #170). */
  private observing = false;
  private rafId = 0;
  private rendering = false;
  private last = { w: 0, h: 0 };
  private unmounted = false;

  private constructor(
    host: HTMLElement, fit: HTMLElement, deps: AaronWindowDeps,
    restore: { parent: ParentNode | null; next: Node | null; el: HTMLElement },
  ) {
    this.host = host; this.fit = fit; this.deps = deps; this.restore = restore;
  }

  /** Promote `el` into a window. `fallbackPos` positions windows whose x/y aren't declared. */
  static async promote(
    el: HTMLElement, deps: AaronWindowDeps, fallbackPos: { x: number; y: number } = { x: 24, y: 24 },
  ): Promise<AaronWindow> {
    const parsed = parseWindowAttrs(el.dataset as Record<string, string | undefined>);
    el.dataset.aaronPromoted = ''; // stamp BEFORE mutating (MutationObserver re-entrancy guard)

    // Persistent slot → fit wrapper holding the consumer's moved children.
    const slot = document.createElement('div');
    slot.className = 'aw-slot';
    Object.assign(slot.style, { width: '100%', height: '100%', boxSizing: 'border-box', overflow: 'auto' });
    const fit = document.createElement('div');
    fit.className = 'aw-fit';
    if (parsed.sizeMode === 'fit') {
      Object.assign(fit.style, { width: 'max-content', maxWidth: `${FIT_MAX_W}px`, height: 'max-content' });
    } else {
      Object.assign(fit.style, { width: '100%', minHeight: '100%' });
    }
    fit.append(...Array.from(el.childNodes)); // MOVE children (identity + listeners preserved)
    slot.append(fit);

    const restore = { parent: el.parentNode, next: el.nextSibling, el };
    const w0 = Math.max(MIN_W, parsed.width ?? FIT_DEFAULT.w);
    const h0 = Math.max(MIN_H, parsed.height ?? FIT_DEFAULT.h);

    let inst: AaronWindow | undefined;
    const host = await deps.manager.add(
      deps.theme,
      {
        windowType: parsed.windowType, width: w0, height: h0, state: parsed.state,
        ...(parsed.title != null ? { title: parsed.title } : {}),
      },
      { onClose: () => inst?.unmount() },
      {
        contentEl: slot,
        ...(parsed.z != null ? { z: parsed.z } : {}),
        ...(parsed.collapsed ? { collapsed: true } : {}),
      },
    );
    inst = new AaronWindow(host, fit, deps, restore);

    // Place the host where the original element was (in-flow position; the host is absolute, so it
    // floats relative to the nearest positioned ancestor — the demo provides one), then drop `el`.
    host.style.left = `${parsed.x ?? fallbackPos.x}px`;
    host.style.top = `${parsed.y ?? fallbackPos.y}px`;
    if (restore.parent) restore.parent.insertBefore(host, restore.el);
    restore.el.remove();

    if (parsed.sizeMode === 'fit') await inst.fitToContent(true);
    return inst;
  }

  /** Measure the content and re-render the chrome to fit it; optionally start observing reflow. */
  private async fitToContent(startObserving: boolean): Promise<void> {
    this.rendering = true;
    const w = Math.min(FIT_MAX_W, Math.max(MIN_W, this.fit.scrollWidth));
    const h = Math.max(MIN_H, this.fit.scrollHeight);
    this.last = { w, h };
    await this.deps.manager.setContentSize(this.host, w, h);
    this.rendering = false;
    if (startObserving && !this.observing) {
      sharedRO.observe(this.fit, () => this.scheduleFit());
      this.observing = true;
    }
  }

  /** Debounced, loop-guarded re-fit on content reflow. Observes the max-content `fit` wrapper (whose
   *  natural size is independent of the `.aw-content` box we resize), with an epsilon + re-entrancy
   *  flag + disconnect-during-render so our own size changes can't re-trigger it. */
  private scheduleFit(): void {
    if (this.rendering || this.rafId) return;
    this.rafId = requestAnimationFrame(() => {
      void (async () => {
        this.rafId = 0;
        if (this.unmounted) return;
        const w = Math.min(FIT_MAX_W, Math.max(MIN_W, this.fit.scrollWidth));
        const h = Math.max(MIN_H, this.fit.scrollHeight);
        if (Math.abs(w - this.last.w) < 1 && Math.abs(h - this.last.h) < 1) return;
        this.rendering = true;
        // Unobserve ONLY this window's fit (not the whole shared observer) so OUR own
        // size-change can't re-trigger fitToContent. Other windows' observations continue.
        if (this.observing) sharedRO.unobserve(this.fit);
        this.last = { w, h };
        await this.deps.manager.setContentSize(this.host, w, h);
        if (this.observing) sharedRO.observe(this.fit, () => this.scheduleFit());
        this.rendering = false;
      })();
    });
  }

  /** Restore the original DOM: move the content back into the original element and remove the window. */
  unmount(): void {
    if (this.unmounted) return; // idempotent: onClose AND disconnect() may both call this
    debug('unmount', `AaronWindow: ${this.host.querySelector('[aria-label]')?.getAttribute('aria-label') ?? ''}`);
    this.unmounted = true;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    if (this.observing) { sharedRO.unobserve(this.fit); this.observing = false; }
    this.deps.manager.remove(this.host); // stop the manager re-rendering/re-theming a closed window
    const { el, parent, next } = this.restore;
    el.append(...Array.from(this.fit.childNodes));
    delete el.dataset.aaronPromoted;
    // The captured nextSibling may itself have been removed (e.g. an adjacent promoted window) —
    // only insert before it if it's still a child of the parent, else append.
    if (parent) {
      if (next && next.parentNode === parent) parent.insertBefore(el, next);
      else parent.appendChild(el);
    }
    this.host.remove();
  }
}
