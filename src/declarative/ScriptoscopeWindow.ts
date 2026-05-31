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

export interface ScriptoscopeWindowDeps {
  manager: WindowManager;
  theme: LoadedTheme;
}

const FIT_DEFAULT = { w: 260, h: 150 }; // provisional first-render size for content-fit (corrected after measure)
const FIT_MAX_W = 720; // cap so a wide content block doesn't yield a monster window
const MIN_W = 80, MIN_H = 40;


// findPositionedAncestor moved to ../positioning.ts so the runtime layer
// (WindowManager's drag handlers in interactive.ts) can use the same walker
// without crossing into the declarative layer. Re-exported here for back-
// compat with any external imports. FE-reviewer follow-up 2026-05-31.
import { findPositionedAncestor } from '../positioning.js';
export { findPositionedAncestor };

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
  /** Handle for the one-shot 500ms growth-diagnostic timer (set inside
   *  startGrowthObserver). Cleared in unmount() so a fast unmount-then-
   *  remount cycle doesn't leak a pending timer that fires on the dead
   *  instance. */
  private growthTimer: ReturnType<typeof setTimeout> | 0 = 0;
  private rendering = false;
  /** Most-recent content size set on the chrome — also the FLOOR for the
   *  observer-driven auto-resize. Re-fits only grow past `last`, never
   *  shrink below it: stops transient layout collapses (e.g. image
   *  flicker during reflow) from yanking the chrome smaller mid-life,
   *  and preserves `data-scriptoscope-extra-height` baselines. */
  private last = { w: 0, h: 0 };
  private unmounted = false;

  /** Consumer-declared dimensions, preserved across observer-driven re-fits so
   *  a `data-scriptoscope-width="400"` window doesn't shrink to its content
   *  if the un-declared `height` happens to trigger a re-fit. */
  private readonly declaredW?: number;
  private readonly declaredH?: number;

  private constructor(
    host: HTMLElement, fit: HTMLElement, deps: ScriptoscopeWindowDeps,
    restore: { parent: ParentNode | null; next: Node | null; el: HTMLElement },
    declared: { w?: number; h?: number } = {},
    initial: { w: number; h: number } = { w: 0, h: 0 },
  ) {
    this.host = host; this.fit = fit; this.deps = deps; this.restore = restore;
    if (declared.w !== undefined) this.declaredW = declared.w;
    if (declared.h !== undefined) this.declaredH = declared.h;
    // Seed `last` so the floor-only auto-fit doesn't shrink below what the
    // manager just rendered. Without this seed, `last={0,0}` and the first
    // scheduleFit would happily shrink the chrome to the inner content size.
    this.last = { w: initial.w, h: initial.h };
  }

  /** Promote `el` into a window. When position attrs (`data-scriptoscope-x`/`-y`) are omitted,
   *  the window appears where the element naturally sat in the page. When size attrs are omitted,
   *  the window inherits the element's rendered width/height. `fallbackPos` is only used when
   *  the element has no bounding rect (e.g. `display:none` at promotion time). */
  static async promote(
    el: HTMLElement, deps: ScriptoscopeWindowDeps, fallbackPos: { x: number; y: number } = { x: 24, y: 24 },
  ): Promise<ScriptoscopeWindow> {
    const parsed = parseWindowAttrs(el.dataset as Record<string, string | undefined>);
    // ── POSTURE B: in-flow host by default; absolute opt-in via -x/-y ─────────
    // The host is created as a `position: static` block element sitting in the
    // same DOM position the source element occupied. The browser's own layout
    // engine places it correctly (CSS grid/flex/normal flow all respected), and
    // siblings push down naturally without any min-height pin / cumulative-shift
    // gymnastics in the scanner.
    //
    // When the consumer declares `data-scriptoscope-x` or `data-scriptoscope-y`,
    // they're explicitly opting INTO an absolute-positioned floater (overlay
    // windows, Mac-style desktop scatters, etc.) and the runtime switches the
    // host to `position: absolute` at those coordinates. The drag handler also
    // flips host → absolute lazily on the first drag (it captures the current
    // page rect and converts), so a window that started in-flow becomes a
    // floater once the user yanks it.
    //
    // Width/height still come from the source element's bounding rect (JIT
    // measure — no scanner pre-capture needed because we're not racing absolute
    // positioning of siblings any more). Edge case: an element with display:none
    // or 0-rect falls through to FIT_DEFAULT.
    const wantsAbsolute = parsed.x !== undefined || parsed.y !== undefined;
    const elRect = el.getBoundingClientRect();
    const naturalW = Math.round(elRect.width);
    const naturalH = Math.round(elRect.height);
    const hasNaturalRect = naturalW > 0 && naturalH > 0;
    // Only computed when absolute mode is requested — it's the only path that
    // needs them. Default in-flow positioning is the browser's job.
    let naturalX = 0, naturalY = 0;
    if (wantsAbsolute) {
      const ancestor = findPositionedAncestor(el);
      const ancRect = ancestor?.getBoundingClientRect() ?? { left: 0, top: 0 };
      naturalX = Math.round(elRect.left - ancRect.left);
      naturalY = Math.round(elRect.top - ancRect.top);
    }
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
    // Two modes for the fit wrapper:
    //   - `max-content` only when we have NO natural rect to anchor against
    //     (display:none + no declared dims). In that case fit shrink-wraps
    //     its content; the OUTSIDE world (slot, host, chrome) then sizes
    //     to it. Pre-2026-05-30 we used this whenever sizeMode==='fit',
    //     which silently meant `fit.scrollWidth` returned the longest
    //     unwrapped line of consumer prose — the auto-resize observer
    //     then grew the card to that width, overflowing its grid cell.
    //   - `100%/100%` whenever there IS a natural rect (or any declared
    //     dimension). fit fills the slot; scrollHeight reflects content
    //     overflow within the bounded width; scrollWidth doesn't shoot
    //     past slot.clientWidth on long prose lines.
    const useContentFit = parsed.sizeMode === 'fit' && !hasNaturalRect;
    if (useContentFit) {
      Object.assign(fit.style, { width: 'max-content', maxWidth: `${FIT_MAX_W}px`, height: 'max-content', padding, boxSizing: 'border-box' });
    } else {
      Object.assign(fit.style, { width: '100%', minHeight: '100%', padding, boxSizing: 'border-box' });
    }
    fit.append(...Array.from(el.childNodes)); // MOVE children (identity + listeners preserved)
    slot.append(fit);

    const restore = { parent: el.parentNode, next: el.nextSibling, el };
    // Initial size: declared > inherited from DOM rect > content-fit default.
    // `extraWidth` / `extraHeight` pad the auto-captured rect for the
    // "runtime adds content after promote" case (e.g. a theme-picker whose
    // tiles are populated by the runtime itself — bare-HTML rect doesn't
    // reflect the final content size). Skipped when explicit width/height
    // is set (declared dimensions are absolute by definition). Parse: see
    // `data-scriptoscope-extra-width` / `-extra-height` in parse.ts. Added
    // 2026-05-30 for the picker overlap / nested-scroll edge case.
    const w0 = Math.max(MIN_W,
      parsed.width ?? ((hasNaturalRect ? naturalW : FIT_DEFAULT.w) + (parsed.extraWidth ?? 0)));
    const h0 = Math.max(MIN_H,
      parsed.height ?? ((hasNaturalRect ? naturalH : FIT_DEFAULT.h) + (parsed.extraHeight ?? 0)));

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
    inst = new ScriptoscopeWindow(
      host, fit, deps, restore,
      // Spread to omit undefined fields — exactOptionalPropertyTypes:true.
      {
        ...(parsed.width !== undefined ? { w: parsed.width } : {}),
        ...(parsed.height !== undefined ? { h: parsed.height } : {}),
      },
      { w: w0, h: h0 },
    );

    // Position handling — Posture B.
    //   - Absolute opt-in (consumer declared -x or -y): use the declared
    //     coordinates, falling back to the captured natural position for
    //     whichever axis the consumer omitted, falling back further to
    //     fallbackPos for the display:none / detached case.
    //   - Default (no -x/-y): leave the host as a normal in-flow block.
    //     The browser's own layout puts it where the source element was —
    //     no top/left needed, no flow disruption, no pin/shift gymnastics.
    //     (See WindowManager.add — it sets position:absolute initially;
    //     we override here for the in-flow case.)
    if (wantsAbsolute) {
      host.style.position = 'absolute';
      host.style.left = `${parsed.x ?? (hasNaturalRect ? naturalX : fallbackPos.x)}px`;
      host.style.top = `${parsed.y ?? (hasNaturalRect ? naturalY : fallbackPos.y)}px`;
    } else {
      // In-flow path. WindowManager.add sets `position: absolute` inline
      // unconditionally (line ~636 of interactive.ts — the historical
      // default before Posture B). CLEAR the inline value so it falls
      // back to consumer-class CSS (if any) or the UA default `static`.
      // Setting `'static'` inline here would CLOBBER a consumer's class-
      // based positioning intent (e.g. `.my-window { position: relative }`
      // for stacking-context purposes); clearing the inline value lets
      // that intent through. Drag handler flips to absolute on first
      // drag/move (interactive.ts).
      host.style.position = '';
    }
    // Carry consumer-side identity from the source element to the runtime
    // host so CSS / JS / AT that targeted the source (`.my-class`,
    // `#my-id`, `[data-foo]`, `aria-label`, etc.) keeps working post-
    // promote. Without this, any consumer style/script was orphaned when
    // the original was removed below.
    //
    // `classList.add` (not `host.className = el.className`) so runtime-
    // added classes survive — assignment was a latent clobber bug. ID is
    // only copied if the host doesn't already have one; ARIA + non-
    // scriptoscope `data-*` + `lang` / `dir` / `title` likewise. Lib-
    // reviewer follow-up 2026-05-30.
    //
    // CAVEAT: consumer classes carry their CSS verbatim, including
    // LAYOUT-affecting properties (display:grid on `.powers-card`,
    // flex/contain/etc). Those would re-size the host's box and break
    // the host↔chrome-canvas correspondence. So we force the layout-
    // critical properties on the host directly — these win over inherited
    // class CSS via inline-style specificity. Consumer styles for color,
    // font, position offsets, custom properties, etc. all still apply.
    if (el.id && !host.id) host.id = el.id;
    for (const cls of el.classList) host.classList.add(cls);
    for (const attr of ['lang', 'dir', 'title']) {
      const v = el.getAttribute(attr);
      if (v != null && !host.hasAttribute(attr)) host.setAttribute(attr, v);
    }
    for (const a of Array.from(el.attributes)) {
      if (host.hasAttribute(a.name)) continue;
      if (a.name.startsWith('aria-')) host.setAttribute(a.name, a.value);
      else if (a.name.startsWith('data-') && !a.name.startsWith('data-scriptoscope-')) {
        host.setAttribute(a.name, a.value);
      }
    }
    // Lock down layout + decoration properties AFTER inheriting the
    // consumer's classes — inline styles override class-based CSS via
    // specificity. Without these, consumer styling intended for the
    // bare-HTML state of the source element bleeds onto the host where
    // it no longer makes sense:
    //   - `display: grid/flex` collapses the host's box, decoupling it
    //     from the chrome canvas it's supposed to wrap.
    //   - `padding` offsets the canvas inside the host's box, leaving
    //     stripes of host-background showing around the chrome edges.
    //   - `border` draws a second frame around the canvas — the chrome
    //     IS the intended visual frame; the consumer's border was for
    //     the bare HTML, not the chromed state.
    //   - `background` paints under the chrome — invisible if chrome is
    //     opaque, ugly if chrome has any transparent corners.
    // Consumer styles for color, font, position offsets, custom
    // properties, etc. still apply (they're not in this lockdown set).
    Object.assign(host.style, {
      display: 'block',
      boxSizing: 'border-box',
      padding: '0',
      border: '0',
      background: 'transparent',
      // The chrome canvas's outer dimensions can extend a pixel or two
      // past the host's CSS box (chrome adds a frame; w0 vs fullWidth
      // diverge by 2-6px depending on theme). A consumer-class
      // `overflow: auto` (e.g. `.powers-card-row.heavy .powers-card`
      // sets it for slot-scroll behaviour) would clip those edge
      // pixels — visible as the chrome's right/bottom edge being
      // 'sliced off' on the demo's heavy-row cards. Force visible so
      // the canvas paints fully. The slot inside still has its own
      // overflow:auto for actual content scrolling.
      overflow: 'visible',
    });
    if (restore.parent) restore.parent.insertBefore(host, restore.el);
    restore.el.remove();

    // Content-fit only when NEITHER w/h was declared AND we didn't capture a natural rect:
    // the captured rect already gives the right initial size, and triggering a fit-to-content
    // pass would override it with content's max-content size (often smaller than the
    // visually-occupied element). When the natural rect is missing (display:none, etc.),
    // fall back to content-fit so the window at least picks up the body's intrinsic size.
    if (parsed.sizeMode === 'fit' && !hasNaturalRect) {
      await inst.fitToContent(true);
    } else if (parsed.width === undefined || parsed.height === undefined) {
      // The window was sized from a natural rect (or partly-declared), AND
      // at least one dimension is open. Observe `fit` for post-promote
      // growth — the picker case (runtime populates tiles after promote)
      // and the "image loaded inside content" case both get auto-resized
      // without consumer intervention. Declared dimensions are preserved
      // inside fitToContent (declaredW / declaredH). FE-reviewer follow-up
      // 2026-05-30 P1.
      inst.startGrowthObserver({
        initialH: h0, initialW: w0,
        ...(parsed.title !== undefined ? { title: parsed.title } : {}),
      });
    }
    return inst;
  }

  /** Wire the shared ResizeObserver on `fit` so post-promote content growth
   *  (e.g. theme-picker tiles populated by the runtime; images that finish
   *  loading; async-rendered child components) auto-resizes the chrome
   *  without consumer intervention. Emits a single console.warn at the 500ms
   *  deadline if the content grew SIGNIFICANTLY — informs the dev they could
   *  pre-declare the size to avoid the visual pop. Threshold tuned to skip
   *  routine browser settling (scrollbar gutters, sub-pixel rounding, grid
   *  layout finalisation) and only surface cases worth acting on. */
  private startGrowthObserver(opts: { initialW: number; initialH: number; title?: string }): void {
    if (this.observing || this.unmounted) return;
    sharedRO.observe(this.fit, () => this.scheduleFit());
    this.observing = true;
    // One-shot growth diagnostic. 30px threshold filters out browser
    // settling noise (we routinely see 5-25px width/height shifts from
    // grid/flex layout finalising); anything past that is consumer-
    // visible and worth a hint.
    this.growthTimer = setTimeout(() => {
      this.growthTimer = 0;
      if (this.unmounted) return;
      const grewH = this.last.h - opts.initialH;
      const grewW = this.last.w - opts.initialW;
      const EPS = 30;
      if (grewH < EPS && grewW < EPS) return;
      const title = opts.title ?? this.host.id ?? '(untitled)';
      const hint: string[] = [];
      if (grewH > EPS) hint.push(`data-scriptoscope-extra-height="${Math.ceil(grewH)}"`);
      if (grewW > EPS) hint.push(`data-scriptoscope-extra-width="${Math.ceil(grewW)}"`);
      console.warn(
        `[scriptoscope] Window "${title}" content grew past its bare-HTML measurement ` +
        `(captured ${opts.initialW}×${opts.initialH}px → settled ${this.last.w}×${this.last.h}px). ` +
        `The runtime auto-resized; to avoid the visual pop, pre-declare via ${hint.join(' / ')} ` +
        `on the source element.`
      );
    }, 500);
  }

  /** Measure the content and re-render the chrome to fit it; optionally start observing reflow.
   *  Declared dimensions (`data-scriptoscope-width` / `-height`) are preserved — a window with
   *  `width="400"` but no declared height keeps its width and only fits the height. */
  private async fitToContent(startObserving: boolean): Promise<void> {
    this.rendering = true;
    const measuredW = Math.min(FIT_MAX_W, Math.max(MIN_W, this.fit.scrollWidth));
    const measuredH = Math.max(MIN_H, this.fit.scrollHeight);
    const w = this.declaredW ?? measuredW;
    const h = this.declaredH ?? measuredH;
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
   *  flag + disconnect-during-render so our own size changes can't re-trigger it.
   *  Only GROWS — never shrinks past the captured/declared baseline — so transient layout
   *  collapses (e.g. images flickering during reflow) don't yank the chrome smaller.
   *  Respects consumer-imposed CSS max-width / max-height on the host: when the
   *  consumer set those (e.g. `.powers-card-row.heavy .powers-card { max-height: 280px }`),
   *  they explicitly opted in to slot-scrolling for overflow — auto-grow would fight
   *  the intent and visually overflow the host's box. */
  private scheduleFit(): void {
    if (this.rendering || this.rafId) return;
    this.rafId = requestAnimationFrame(() => {
      void (async () => {
        this.rafId = 0;
        if (this.unmounted) return;
        const measuredW = Math.min(FIT_MAX_W, Math.max(MIN_W, this.fit.scrollWidth));
        const measuredH = Math.max(MIN_H, this.fit.scrollHeight);
        // Cap grow by consumer-imposed PIXEL max-width / max-height. Only px
        // values cap — percentages, em, vh/vw, calc(), none, etc. all leave
        // the cap at Infinity. (parseFloat('100%') returns 100, not NaN, so
        // a unit check is required — losing this bit collapsed Read Me's
        // host to 100px wide because `.powers-inner > * { max-width: 100% }`
        // applied via inheritance.)
        const cs = getComputedStyle(this.host);
        const pxCap = (v: string): number => {
          if (!v.endsWith('px')) return Infinity;
          const n = parseFloat(v);
          return isNaN(n) || n <= 0 ? Infinity : n;
        };
        const capW = pxCap(cs.maxWidth);
        const capH = pxCap(cs.maxHeight);
        const w = this.declaredW ?? Math.min(capW, Math.max(measuredW, this.last.w));
        const h = this.declaredH ?? Math.min(capH, Math.max(measuredH, this.last.h));
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
    if (this.growthTimer) { clearTimeout(this.growthTimer); this.growthTimer = 0; }
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
