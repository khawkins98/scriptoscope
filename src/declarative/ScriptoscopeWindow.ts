// ScriptoscopeWindow — promotes a single consumer element into a managed Mac window. The element's
// CHILDREN become the window's content (moved into the chrome's `.scriptoscope-content` hole as live light
// DOM — still selectable, focusable, reflowing); the chrome is the canvas behind them. Two size
// modes: declared (data-scriptoscope-width/height) or content-fit (a ResizeObserver re-renders the chrome
// when the content reflows). Built on the WindowManager's contentEl re-slot hook.

import type { LoadedTheme } from '../types.js';
import type { WindowManager } from '../interactive.js';
import { parseWindowAttrs } from './parse.js';
import { debug } from '../debug.js';
import { sharedRO } from './sharedResizeObserver.js';
import { SCRIPTOSCOPE_SLOT_CLASS } from './markers.js';
import { consumeInheritedRect } from './inheritedRect.js';

export interface ScriptoscopeWindowDeps {
  manager: WindowManager;
  theme: LoadedTheme;
}

const FIT_DEFAULT = { w: 260, h: 150 }; // provisional first-render size for content-fit (corrected after measure)
const FIT_MAX_W = 720; // cap so a wide content block doesn't yield a monster window
const MIN_W = 80, MIN_H = 40;

// (numOrNull was the parser for the dataset-based pre-captured rect seam;
// retired with the WeakMap migration in T3.2.)

/** Walk up the DOM to find the nearest positioned ancestor (the one the host's absolute
 *  positioning will resolve against). Returns null when no positioned ancestor exists
 *  (the host will resolve against the viewport via `<html>`). Matches the browser's own
 *  "containing block for absolute positioning" algorithm: any element whose computed
 *  `position` is `relative`/`absolute`/`fixed`/`sticky`, OR a `transform`/`filter`/`perspective`
 *  that creates a containing block, OR `<html>`. */
export function findPositionedAncestor(el: HTMLElement): HTMLElement | null {
  let node: HTMLElement | null = el.parentElement;
  while (node && node !== document.documentElement) {
    const cs = getComputedStyle(node);
    if (cs.position !== 'static') return node;
    // CSS transforms / filters create a containing block too.
    if (cs.transform !== 'none' || cs.filter !== 'none' || cs.perspective !== 'none') return node;
    node = node.parentElement;
  }
  return node; // <html> when nothing positioned along the chain
}

export class ScriptoscopeWindow {
  /** The positioned WindowManager host element (lives in the document). */
  readonly host: HTMLElement;
  private readonly fit: HTMLElement; // max-content wrapper inside the slot; the resize-observe target
  private readonly deps: ScriptoscopeWindowDeps;
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
    host: HTMLElement, fit: HTMLElement, deps: ScriptoscopeWindowDeps,
    restore: { parent: ParentNode | null; next: Node | null; el: HTMLElement },
  ) {
    this.host = host; this.fit = fit; this.deps = deps; this.restore = restore;
  }

  /** Promote `el` into a window. When position attrs (`data-scriptoscope-x`/`-y`) are omitted,
   *  the window appears where the element naturally sat in the page. When size attrs are omitted,
   *  the window inherits the element's rendered width/height. `fallbackPos` is only used when
   *  the element has no bounding rect (e.g. `display:none` at promotion time). */
  static async promote(
    el: HTMLElement, deps: ScriptoscopeWindowDeps, fallbackPos: { x: number; y: number } = { x: 24, y: 24 },
  ): Promise<ScriptoscopeWindow> {
    const parsed = parseWindowAttrs(el.dataset as Record<string, string | undefined>);
    // ── INHERIT FROM DOM RECT (when attrs are omitted) ─────────────────────────
    // Capture the element's natural position + size in the document BEFORE we move
    // its children into the slot. Subtract the positioned ancestor's offset so the
    // host (which is absolute-positioned) lands at the same visual spot.
    // - Position: omitted x/y default to the element's current page position.
    // - Size: omitted width/height default to the element's rendered size (one-shot
    //   capture at promotion time; if the consumer wants content-fit reflow, they
    //   can omit both AND keep the children sized by content — the runtime keeps the
    //   fit ResizeObserver wired in that case).
    // Edge case: an element with `display:none` or detached has a 0-rect; fall through
    // to the legacy `fallbackPos` (24,24) + `FIT_DEFAULT` (260x150).
    //
    // The scanner pre-captures rects for ALL window targets before any promotion runs
    // (so sibling reflows don't corrupt later measurements). We prefer those when
    // present, and fall back to measuring `el` ourselves when called directly (test
    // harness, programmatic AaronWindow.promote calls, etc.).
    const ancestor = findPositionedAncestor(el);
    const ancRect = ancestor?.getBoundingClientRect() ?? { left: 0, top: 0 };
    // Pre-captured rect from the scanner lives on a WeakMap (T3.2 — was
    // dataset attributes before; the dataset version leaked to consumer
    // DevTools + CSS attribute selectors). consume() reads-and-clears in
    // one call so the entry doesn't outlive its single intended use.
    const pre = consumeInheritedRect(el);
    const elRect = pre ?? el.getBoundingClientRect();
    const naturalX = Math.round(elRect.left - ancRect.left);
    const naturalY = Math.round(elRect.top - ancRect.top);
    const naturalW = Math.round(elRect.width);
    const naturalH = Math.round(elRect.height);
    const hasNaturalRect = naturalW > 0 && naturalH > 0;
    el.dataset.scriptoscopePromoted = ''; // stamp BEFORE mutating (MutationObserver re-entrancy guard)

    // Persistent slot → fit wrapper holding the consumer's moved children.
    // SCRIPTOSCOPE_SLOT_CLASS is the published structural marker — consumer
    // CSS scopes off it to tell "is this content currently inside chrome?".
    const slot = document.createElement('div');
    slot.className = SCRIPTOSCOPE_SLOT_CLASS;
    Object.assign(slot.style, { width: '100%', height: '100%', boxSizing: 'border-box', overflow: 'auto' });
    const fit = document.createElement('div');
    fit.className = 'scriptoscope-fit';
    // Content padding — classic Mac windows always had a small inset before
    // the body content, so the text/widgets didn't butt against the chrome.
    // Default 6px vertical / 8px horizontal (the Apple Human Interface
    // Guidelines 1989 default for window content). Consumers can override
    // via the custom property at any scope:
    //   :root { --scriptoscope-content-padding: 12px 16px; }
    //   .scriptoscope-fit { padding: 0; }  /* opt out entirely */
    // Padding lives on `.scriptoscope-fit` rather than `.scriptoscope-slot`
    // so the scrollbar (when content overflows) appears OUTSIDE the padded
    // area, not inside it — matches Finder window behavior.
    const padding = 'var(--scriptoscope-content-padding, 6px 8px)';
    if (parsed.sizeMode === 'fit') {
      Object.assign(fit.style, { width: 'max-content', maxWidth: `${FIT_MAX_W}px`, height: 'max-content', padding, boxSizing: 'border-box' });
    } else {
      Object.assign(fit.style, { width: '100%', minHeight: '100%', padding, boxSizing: 'border-box' });
    }
    fit.append(...Array.from(el.childNodes)); // MOVE children (identity + listeners preserved)
    slot.append(fit);

    const restore = { parent: el.parentNode, next: el.nextSibling, el };
    // Initial size: declared > inherited from DOM rect > content-fit default.
    const w0 = Math.max(MIN_W,
      parsed.width ?? (hasNaturalRect ? naturalW : FIT_DEFAULT.w));
    const h0 = Math.max(MIN_H,
      parsed.height ?? (hasNaturalRect ? naturalH : FIT_DEFAULT.h));

    let inst: ScriptoscopeWindow | undefined;
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
    inst = new ScriptoscopeWindow(host, fit, deps, restore);

    // Place the host where the original element was. Priority: declared x/y > inherited
    // page position > fallback (24,24 for detached / display:none elements).
    host.style.left = `${parsed.x ?? (hasNaturalRect ? naturalX : fallbackPos.x)}px`;
    host.style.top = `${parsed.y ?? (hasNaturalRect ? naturalY : fallbackPos.y)}px`;
    if (restore.parent) restore.parent.insertBefore(host, restore.el);
    restore.el.remove();

    // Content-fit only when NEITHER w/h was declared AND we didn't capture a natural rect:
    // the captured rect already gives the right initial size, and triggering a fit-to-content
    // pass would override it with content's max-content size (often smaller than the
    // visually-occupied element). When the natural rect is missing (display:none, etc.),
    // fall back to content-fit so the window at least picks up the body's intrinsic size.
    if (parsed.sizeMode === 'fit' && !hasNaturalRect) await inst.fitToContent(true);
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
   *  natural size is independent of the `.scriptoscope-content` box we resize), with an epsilon + re-entrancy
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
    debug('unmount', `ScriptoscopeWindow: ${this.host.querySelector('[aria-label]')?.getAttribute('aria-label') ?? ''}`);
    this.unmounted = true;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    if (this.observing) { sharedRO.unobserve(this.fit); this.observing = false; }
    this.deps.manager.remove(this.host); // stop the manager re-rendering/re-theming a closed window
    const { el, parent, next } = this.restore;
    el.append(...Array.from(this.fit.childNodes));
    delete el.dataset.scriptoscopePromoted;
    // The captured nextSibling may itself have been removed (e.g. an adjacent promoted window) —
    // only insert before it if it's still a child of the parent, else append.
    if (parent) {
      if (next && next.parentNode === parent) parent.insertBefore(el, next);
      else parent.appendChild(el);
    }
    this.host.remove();
  }
}
