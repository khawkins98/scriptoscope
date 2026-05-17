// AaronWindow — the imperative API foundation per PRD §North Star principle #2.
//
// This class is what the declarative `[data-aaron-window]` scanner (issue #8)
// will call into, and what consumers using the Aaron UI library directly will
// construct. The constructor is intentionally side-effect-free; mount() does
// the DOM work, unmount() cleans up.
//
// What's deliberately NOT here yet:
//   - drag (issue #4)
//   - resize (issue #5)
//   - z-order / focus / raise-on-click (issue #6)
//   - close button / windowshade / zoom interactions (issue #7)
//   - WinBox option key parity beyond the basics (issue #3)
//
// The chrome appearance comes from the theme CSS rules in the host page (the
// demo's <style> blocks today; eventually shipped as part of the Aaron UI
// theme bundle). This class only emits the DOM with the documented class
// names + data attributes. Themes do the rest.

/**
 * Public constructor options. Accepts the WinBox option keys cv-mac uses
 * (per PRD Success Criterion #1 and issue #3) so a one-line drop-in is
 * possible. Documented differences in docs/winbox-compat.md.
 */
export interface AaronWindowOptions {
  /** Title text shown in the titlebar. Default `''`. */
  title?: string;
  /** x position in pixels, relative to the mount parent. Default 100. */
  x?: number;
  /** y position in pixels, relative to the mount parent. Default 100. */
  y?: number;
  /** Window width in pixels. Default 320. */
  width?: number;
  /** Window height in pixels. Default 200. */
  height?: number;
  /**
   * HTML content for the body area. Inserted via innerHTML — consumers are
   * responsible for sanitising untrusted strings. WinBox compat.
   */
  html?: string;
  /**
   * DOM parent to append into. Falls back to `document.body` at mount time
   * if not provided. Lazy resolution means SSR import won't fail.
   * Aaron-UI native; corresponds to WinBox's `root`.
   */
  mount?: HTMLElement;
  /**
   * WinBox alias for `mount`. If both are provided, `mount` wins. Present
   * so cv-mac call sites that pass `root: ...` work unmodified.
   */
  root?: HTMLElement;
  /**
   * Optional CSS background applied to the window root via inline style.
   * Per-window override; theme CSS is the default. WinBox compat.
   */
  background?: string;
  /**
   * Optional CSS border applied to the window root via inline style.
   * Number → `${n}px solid`; string → used as-is. WinBox compat.
   */
  border?: number | string;
  /**
   * Extra class names (space-separated string or array) added to the
   * window root alongside `.aaron-window`. WinBox compat.
   */
  class?: string | string[];

  /** Fired after the window's DOM is created and appended. */
  oncreate?: (this: AaronWindow) => void;
  /** Fired when the window closes (placeholder until issue #7 wires .close()). */
  onclose?: (this: AaronWindow) => void;
  /** Fired when the window gains focus (placeholder until issue #6). */
  onfocus?: (this: AaronWindow) => void;
  /** Fired when the window loses focus (placeholder until issue #6). */
  onblur?: (this: AaronWindow) => void;
  /** Fired on move (placeholder until issue #4 wires drag). */
  onmove?: (this: AaronWindow, x: number, y: number) => void;
  /** Fired on resize (placeholder until issue #5 wires resize). */
  onresize?: (this: AaronWindow, width: number, height: number) => void;
}

/**
 * Internal normalised options after defaults applied. The "callbacks are
 * always present" guarantee simplifies the call sites in the class body
 * (no null checks); a no-op stand-in is used when the consumer didn't
 * supply one.
 */
interface NormalizedOptions {
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
  html: string;
  mount?: HTMLElement;
  background?: string;
  border?: string;
  class: string[];
  oncreate: (this: AaronWindow) => void;
  onclose: (this: AaronWindow) => void;
  onfocus: (this: AaronWindow) => void;
  onblur: (this: AaronWindow) => void;
  onmove: (this: AaronWindow, x: number, y: number) => void;
  onresize: (this: AaronWindow, width: number, height: number) => void;
}

const noop = (): void => undefined;

function normalizeBorder(border: number | string | undefined): string | undefined {
  if (border === undefined) return undefined;
  if (typeof border === 'number') return `${border}px solid`;
  return border;
}

function normalizeClass(cls: string | string[] | undefined): string[] {
  if (cls === undefined) return [];
  if (Array.isArray(cls)) return cls.filter(c => c.length > 0);
  return cls.split(/\s+/).filter(c => c.length > 0);
}

export class AaronWindow {
  /** Normalised options (defaults applied). Frozen for immutability. */
  readonly options: Readonly<NormalizedOptions>;

  /** Root window DOM element. `null` until mount(), back to `null` after unmount(). */
  private el: HTMLElement | null = null;
  private contentEl: HTMLElement | null = null;
  private titlebarEl: HTMLElement | null = null;
  private mounted = false;

  /** Active drag state, or null when not currently dragging. */
  private dragState: { offX: number; offY: number; pointerId: number } | null = null;

  constructor(options: AaronWindowOptions = {}) {
    const normalised: NormalizedOptions = {
      title: options.title ?? '',
      x: options.x ?? 100,
      y: options.y ?? 100,
      width: options.width ?? 320,
      height: options.height ?? 200,
      html: options.html ?? '',
      class: normalizeClass(options.class),
      oncreate: options.oncreate ?? noop,
      onclose: options.onclose ?? noop,
      onfocus: options.onfocus ?? noop,
      onblur: options.onblur ?? noop,
      onmove: options.onmove ?? noop,
      onresize: options.onresize ?? noop,
    };
    // `mount` is Aaron-UI native; `root` is the WinBox alias. mount wins
    // if both provided to keep precedence predictable.
    const parentRef = options.mount ?? options.root;
    if (parentRef !== undefined) normalised.mount = parentRef;
    if (options.background !== undefined) normalised.background = options.background;
    const border = normalizeBorder(options.border);
    if (border !== undefined) normalised.border = border;
    this.options = Object.freeze(normalised);
  }

  /** True after a successful mount() and before unmount(). */
  get isMounted(): boolean {
    return this.mounted;
  }

  /** The root window element, or null if not mounted. */
  get element(): HTMLElement | null {
    return this.el;
  }

  /** The content area element, or null if not mounted. */
  get content(): HTMLElement | null {
    return this.contentEl;
  }

  /**
   * Build the window DOM and append it to `parent`. If `parent` is omitted,
   * uses `options.mount` then falls back to `document.body`. Idempotent —
   * calling mount() on an already-mounted window is a no-op that returns
   * `this`.
   */
  mount(parent?: HTMLElement): this {
    if (this.mounted) return this;
    const target = parent ?? this.options.mount ?? document.body;
    this.el = this.createDom();
    target.appendChild(this.el);
    this.mounted = true;
    this.attachDrag();
    this.options.oncreate.call(this);
    return this;
  }

  /**
   * Remove the window from the DOM and release internal references.
   * Idempotent — calling on an unmounted window is a no-op.
   */
  unmount(): this {
    if (!this.mounted || this.el === null) return this;
    this.detachDrag();
    this.el.remove();
    this.el = null;
    this.contentEl = null;
    this.titlebarEl = null;
    this.mounted = false;
    return this;
  }

  /**
   * Programmatically move the window to (x, y). Clamped to keep the window
   * onscreen. Fires `onmove` with the actual (post-clamp) coordinates.
   */
  move(x: number, y: number): this {
    if (this.el === null) return this;
    const [nx, ny] = this.clampPosition(x, y);
    this.el.style.left = `${nx}px`;
    this.el.style.top = `${ny}px`;
    this.options.onmove.call(this, nx, ny);
    return this;
  }

  /** Build the DOM tree per the documented chrome class structure. */
  private createDom(): HTMLElement {
    const win = document.createElement('div');
    win.classList.add('aaron-window', ...this.options.class);
    win.setAttribute('data-aaron-window', '');
    win.setAttribute('data-state', 'active');
    Object.assign(win.style, {
      position: 'absolute',
      left: `${this.options.x}px`,
      top: `${this.options.y}px`,
      width: `${this.options.width}px`,
      height: `${this.options.height}px`,
    });
    if (this.options.background !== undefined) {
      win.style.background = this.options.background;
    }
    if (this.options.border !== undefined) {
      win.style.border = this.options.border;
    }

    const titlebar = document.createElement('div');
    titlebar.className = 'aaron-titlebar';

    const titleWrap = document.createElement('div');
    titleWrap.className = 'aaron-titlebar__title';
    const titleSpan = document.createElement('span');
    titleSpan.textContent = this.options.title;
    titleWrap.appendChild(titleSpan);
    titlebar.appendChild(titleWrap);

    const content = document.createElement('div');
    content.className = 'aaron-content';
    if (this.options.html !== '') {
      content.innerHTML = this.options.html;
    }

    win.appendChild(titlebar);
    win.appendChild(content);

    this.titlebarEl = titlebar;
    this.contentEl = content;
    return win;
  }

  /* ─── drag (issue #4) ─────────────────────────────────────────────
     Pointer Events unify mouse + touch + pen with a single API. We
     attach pointerdown to the titlebar; pointermove/up listeners are
     added to document.body for the duration of the drag so the pointer
     can leave the window without losing the drag.

     IME safety: pointerdown wouldn't fire from IME composition, but if
     the titlebar ever becomes editable we still bail when the target
     is an editable element. */

  private attachDrag(): void {
    if (this.titlebarEl === null) return;
    this.titlebarEl.style.cursor = 'grab';
    this.titlebarEl.style.touchAction = 'none'; // suppress browser pan-on-touch
    this.titlebarEl.addEventListener('pointerdown', this.onPointerDown);
  }

  private detachDrag(): void {
    if (this.titlebarEl !== null) {
      this.titlebarEl.removeEventListener('pointerdown', this.onPointerDown);
    }
    // Belt-and-braces: clean up document listeners if mid-drag at unmount.
    document.removeEventListener('pointermove', this.onPointerMove);
    document.removeEventListener('pointerup', this.onPointerUp);
    document.removeEventListener('pointercancel', this.onPointerUp);
    this.dragState = null;
  }

  private readonly onPointerDown = (e: PointerEvent): void => {
    // Primary button only (button 0 == left mouse / first touch / first pen).
    if (e.button !== 0) return;
    // Bail if the user clicked an editable element inside the titlebar
    // (defensive — titlebars aren't editable by default but a consumer
    // might make them so).
    if (isEditable(e.target)) return;
    // Bail if the click was on a chrome widget (close box etc.) — drag
    // should not start when you're about to click a button. We detect
    // this by looking for elements with `data-action` (the convention
    // the demo + future widgets use).
    if (this.isOnWidget(e.target)) return;
    if (this.el === null || this.titlebarEl === null) return;

    const rect = this.el.getBoundingClientRect();
    this.dragState = {
      offX: e.clientX - rect.left,
      offY: e.clientY - rect.top,
      pointerId: e.pointerId,
    };
    this.titlebarEl.style.cursor = 'grabbing';
    document.addEventListener('pointermove', this.onPointerMove);
    document.addEventListener('pointerup', this.onPointerUp);
    document.addEventListener('pointercancel', this.onPointerUp);
    e.preventDefault();
  };

  private readonly onPointerMove = (e: PointerEvent): void => {
    if (this.dragState === null) return;
    if (e.pointerId !== this.dragState.pointerId) return;
    if (this.el === null) return;
    const rawX = e.clientX - this.dragState.offX;
    const rawY = e.clientY - this.dragState.offY;
    const [nx, ny] = this.clampPosition(rawX, rawY);
    this.el.style.left = `${nx}px`;
    this.el.style.top = `${ny}px`;
    this.options.onmove.call(this, nx, ny);
  };

  private readonly onPointerUp = (e: PointerEvent): void => {
    if (this.dragState === null) return;
    if (e.pointerId !== this.dragState.pointerId) return;
    this.dragState = null;
    if (this.titlebarEl !== null) {
      this.titlebarEl.style.cursor = 'grab';
    }
    document.removeEventListener('pointermove', this.onPointerMove);
    document.removeEventListener('pointerup', this.onPointerUp);
    document.removeEventListener('pointercancel', this.onPointerUp);
  };

  /**
   * Clamp a desired position so the window stays at least partially
   * visible. Top-left can't go negative; bottom-right can't disappear
   * past viewport. Keeps at least the titlebar reachable for re-drag.
   */
  private clampPosition(x: number, y: number): [number, number] {
    if (this.el === null) return [x, y];
    const winW = this.el.offsetWidth || this.options.width;
    const winH = this.el.offsetHeight || this.options.height;
    const viewW = window.innerWidth;
    const viewH = window.innerHeight;
    const maxX = Math.max(0, viewW - winW);
    const maxY = Math.max(0, viewH - winH);
    const nx = Math.min(Math.max(0, x), maxX);
    const ny = Math.min(Math.max(0, y), maxY);
    return [nx, ny];
  }

  /** True when the target is an interactive widget (button etc.) inside the titlebar. */
  private isOnWidget(target: EventTarget | null): boolean {
    if (!(target instanceof Element)) return false;
    return target.closest('[data-action]') !== null
      || target.closest('button') !== null;
  }
}

function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (target instanceof HTMLElement && target.isContentEditable) return true;
  return false;
}
