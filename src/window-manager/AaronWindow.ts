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
  /** Minimum width (px) when resizing. Default 120. */
  minWidth?: number;
  /** Minimum height (px) when resizing. Default 60. */
  minHeight?: number;
  /**
   * Window-type for ARIA + behavior. Default 'document'.
   *
   *   'document' — role=dialog, aria-modal=false, no focus trap. Default.
   *   'modal'    — role=dialog, aria-modal=true, focus trapped inside,
   *                Escape closes.
   *   'alert'    — role=alertdialog, aria-modal=true, focus trap +
   *                Escape closes.
   *   'utility'  — role=dialog, aria-modal=false, no focus trap.
   *                (Floating utility / tool palette window.)
   *
   * Issue #9.
   */
  type?: 'document' | 'modal' | 'alert' | 'utility';
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
  minWidth: number;
  minHeight: number;
  html: string;
  type: 'document' | 'modal' | 'alert' | 'utility';
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

/** Sets of focusable selectors for the focus trap. */
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

/** 8 resize directions matching CSS cursor names. */
export type ResizeDirection = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';
const RESIZE_DIRECTIONS: ResizeDirection[] = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];

import { windowManager } from './WindowManager.js';

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

  /** Module-level counter for unique title element IDs. */
  private static nextId = 0;
  private nextTitleId = AaronWindow.nextId++;

  /** True when minimized (windowshade collapse). */
  private collapsed = false;

  /** Pre-maximize position/size — null when not maximized. */
  private maximizedFrom: { left: string; top: string; width: string; height: string } | null = null;

  /** Active resize state, or null when not currently resizing. */
  private resizeState: {
    direction: ResizeDirection;
    startClientX: number;
    startClientY: number;
    startLeft: number;
    startTop: number;
    startWidth: number;
    startHeight: number;
    pointerId: number;
  } | null = null;

  constructor(options: AaronWindowOptions = {}) {
    const normalised: NormalizedOptions = {
      title: options.title ?? '',
      x: options.x ?? 100,
      y: options.y ?? 100,
      width: options.width ?? 320,
      height: options.height ?? 200,
      minWidth: options.minWidth ?? 120,
      minHeight: options.minHeight ?? 60,
      html: options.html ?? '',
      type: options.type ?? 'document',
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
    this.attachResize();
    this.attachRaiseOnPointerDown();
    this.attachKeyboard();
    // Register with the shared WM — this sets z-index, sets data-state to
    // active, and fires onfocus.
    windowManager.register(this);
    // Initial focus → first focusable in content, falling back to the
    // window root. Issue #9.
    this.placeInitialFocus();
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
    this.detachResize();
    this.detachRaiseOnPointerDown();
    this.detachKeyboard();
    windowManager.unregister(this);
    this.el.remove();
    this.el = null;
    this.contentEl = null;
    this.titlebarEl = null;
    this.mounted = false;
    return this;
  }

  /**
   * Raise the window to the top of the z-order + focus it. Fires onfocus
   * (and onblur on whichever window was previously focused). No-op if
   * already on top.
   */
  focus(): this {
    if (this.mounted) windowManager.raise(this);
    return this;
  }

  /** Is this the currently-focused window? */
  get hasFocus(): boolean {
    return windowManager.focusedWindow === this;
  }

  /** Is this window currently collapsed (windowshade)? */
  get isCollapsed(): boolean {
    return this.collapsed;
  }

  /** Is this window currently maximized? */
  get isMaximized(): boolean {
    return this.maximizedFrom !== null;
  }

  /**
   * Close the window: fires onclose, then unmounts. The window is gone
   * from the DOM after this returns. (Compare to .unmount() which doesn't
   * fire onclose — useful when the consumer is tearing down for other
   * reasons.) Idempotent.
   */
  close(): this {
    if (!this.mounted) return this;
    this.options.onclose.call(this);
    this.unmount();
    return this;
  }

  /**
   * Collapse to titlebar (windowshade). data-state becomes "collapsed",
   * which theme CSS uses to hide .aaron-content + .aaron-statusbar.
   * Idempotent.
   */
  minimize(): this {
    if (!this.mounted || this.collapsed || this.el === null) return this;
    this.collapsed = true;
    this.el.setAttribute('data-state', 'collapsed');
    return this;
  }

  /**
   * Un-collapse from windowshade. data-state restored to active/inactive
   * based on current focus. Idempotent — calling on a non-collapsed
   * window is a no-op.
   */
  restore(): this {
    if (!this.mounted || !this.collapsed || this.el === null) return this;
    this.collapsed = false;
    this.el.setAttribute('data-state', this.hasFocus ? 'active' : 'inactive');
    return this;
  }

  /**
   * Maximize: fill the viewport. Saves current position+size so
   * unmaximize() can restore. Fires onresize with the new dimensions.
   * Idempotent.
   */
  maximize(): this {
    if (!this.mounted || this.el === null || this.maximizedFrom !== null) return this;
    this.maximizedFrom = {
      left: this.el.style.left,
      top: this.el.style.top,
      width: this.el.style.width,
      height: this.el.style.height,
    };
    this.el.style.left = '0px';
    this.el.style.top = '0px';
    this.el.style.width = `${window.innerWidth}px`;
    this.el.style.height = `${window.innerHeight}px`;
    this.options.onmove.call(this, 0, 0);
    this.options.onresize.call(this, window.innerWidth, window.innerHeight);
    return this;
  }

  /**
   * Restore from maximized to the previous position+size. Idempotent.
   * Fires onmove + onresize with the restored dimensions.
   */
  unmaximize(): this {
    if (!this.mounted || this.el === null || this.maximizedFrom === null) return this;
    const prev = this.maximizedFrom;
    this.el.style.left = prev.left;
    this.el.style.top = prev.top;
    this.el.style.width = prev.width;
    this.el.style.height = prev.height;
    this.maximizedFrom = null;
    const numLeft = parseFloat(prev.left) || 0;
    const numTop = parseFloat(prev.top) || 0;
    const numW = parseFloat(prev.width) || this.options.width;
    const numH = parseFloat(prev.height) || this.options.height;
    this.options.onmove.call(this, numLeft, numTop);
    this.options.onresize.call(this, numW, numH);
    return this;
  }

  /**
   * Programmatically resize the window to (width, height). Clamped to
   * min size and viewport. Fires `onresize` with the actual (post-clamp)
   * dimensions.
   */
  resize(width: number, height: number): this {
    if (this.el === null) return this;
    const [nw, nh] = this.clampSize(width, height);
    this.el.style.width = `${nw}px`;
    this.el.style.height = `${nh}px`;
    this.options.onresize.call(this, nw, nh);
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
    // data-aaron-promoted is the scanner's sentinel: prevents re-scan
    // of already-rendered windows (which also have data-aaron-window).
    win.setAttribute('data-aaron-promoted', '');
    win.setAttribute('data-state', 'active');
    // ARIA per window type (issue #9).
    const isAlert = this.options.type === 'alert';
    const isModal = this.options.type === 'modal' || isAlert;
    win.setAttribute('role', isAlert ? 'alertdialog' : 'dialog');
    if (isModal) win.setAttribute('aria-modal', 'true');
    // tabindex makes the window itself focusable as a fallback when no
    // focusable content exists. -1 means programmatic-only focus.
    win.setAttribute('tabindex', '-1');
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
    // Stable ID so aria-labelledby on the window can point at this span.
    const titleId = `aaron-window-title-${++this.nextTitleId}`;
    titleSpan.id = titleId;
    titleSpan.textContent = this.options.title;
    titleWrap.appendChild(titleSpan);
    titlebar.appendChild(titleWrap);
    // aria-labelledby on the window root → titlebar text.
    win.setAttribute('aria-labelledby', titleId);

    const content = document.createElement('div');
    content.className = 'aaron-content';
    if (this.options.html !== '') {
      content.innerHTML = this.options.html;
    }

    win.appendChild(titlebar);
    win.appendChild(content);

    // Resize handles — 8 invisible zones positioned along edges + corners.
    // Pointerdown handlers wired in attachResize(); CSS positioning is
    // inline so the library doesn't ship a stylesheet (theme CSS owns
    // visible styling; these zones are functional only).
    for (const dir of RESIZE_DIRECTIONS) {
      const handle = document.createElement('div');
      handle.className = 'aaron-window__resize';
      handle.setAttribute('data-handle', dir);
      Object.assign(handle.style, this.resizeHandleStyle(dir));
      win.appendChild(handle);
    }

    this.titlebarEl = titlebar;
    this.contentEl = content;
    return win;
  }

  private resizeHandleStyle(dir: ResizeDirection): Partial<CSSStyleDeclaration> {
    const base: Partial<CSSStyleDeclaration> = {
      position: 'absolute',
      background: 'transparent',
      touchAction: 'none',
    };
    // Corners draw on top of edges (z-index) so click priority goes to
    // them when overlapping. SE is bigger for the growbox click target.
    const edgeThickness = '4px';
    const cornerSize = '8px';
    const seSize = '16px';
    switch (dir) {
      case 'n':  return { ...base, top: '0', left: cornerSize, right: cornerSize, height: edgeThickness, cursor: 'n-resize' };
      case 's':  return { ...base, bottom: '0', left: cornerSize, right: seSize, height: edgeThickness, cursor: 's-resize' };
      case 'e':  return { ...base, right: '0', top: cornerSize, bottom: seSize, width: edgeThickness, cursor: 'e-resize' };
      case 'w':  return { ...base, left: '0', top: cornerSize, bottom: cornerSize, width: edgeThickness, cursor: 'w-resize' };
      case 'ne': return { ...base, top: '0', right: '0', width: cornerSize, height: cornerSize, cursor: 'ne-resize', zIndex: '2' };
      case 'nw': return { ...base, top: '0', left: '0', width: cornerSize, height: cornerSize, cursor: 'nw-resize', zIndex: '2' };
      case 'se': return { ...base, bottom: '0', right: '0', width: seSize, height: seSize, cursor: 'se-resize', zIndex: '2' };
      case 'sw': return { ...base, bottom: '0', left: '0', width: cornerSize, height: cornerSize, cursor: 'sw-resize', zIndex: '2' };
    }
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

  /* ─── resize (issue #5) ───────────────────────────────────────────
     Eight invisible handles positioned along edges and corners. Same
     Pointer Events pattern as drag — pointerdown on a handle, then
     document-level pointermove/up. Math per direction encoded once. */

  private attachResize(): void {
    if (this.el === null) return;
    const handles = this.el.querySelectorAll<HTMLElement>('.aaron-window__resize');
    for (const handle of handles) {
      handle.addEventListener('pointerdown', this.onResizePointerDown);
    }
  }

  private detachResize(): void {
    if (this.el !== null) {
      const handles = this.el.querySelectorAll<HTMLElement>('.aaron-window__resize');
      for (const handle of handles) {
        handle.removeEventListener('pointerdown', this.onResizePointerDown);
      }
    }
    document.removeEventListener('pointermove', this.onResizePointerMove);
    document.removeEventListener('pointerup', this.onResizePointerUp);
    document.removeEventListener('pointercancel', this.onResizePointerUp);
    this.resizeState = null;
  }

  private readonly onResizePointerDown = (e: PointerEvent): void => {
    if (e.button !== 0) return;
    if (this.el === null) return;
    const target = e.currentTarget as HTMLElement | null;
    if (target === null) return;
    const direction = target.getAttribute('data-handle') as ResizeDirection | null;
    if (direction === null) return;

    const rect = this.el.getBoundingClientRect();
    this.resizeState = {
      direction,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startLeft: rect.left,
      startTop: rect.top,
      startWidth: rect.width || this.options.width,
      startHeight: rect.height || this.options.height,
      pointerId: e.pointerId,
    };
    document.addEventListener('pointermove', this.onResizePointerMove);
    document.addEventListener('pointerup', this.onResizePointerUp);
    document.addEventListener('pointercancel', this.onResizePointerUp);
    e.preventDefault();
    e.stopPropagation();
  };

  private readonly onResizePointerMove = (e: PointerEvent): void => {
    if (this.resizeState === null) return;
    if (e.pointerId !== this.resizeState.pointerId) return;
    if (this.el === null) return;
    const r = this.resizeState;
    const dx = e.clientX - r.startClientX;
    const dy = e.clientY - r.startClientY;
    let newLeft = r.startLeft;
    let newTop = r.startTop;
    let newWidth = r.startWidth;
    let newHeight = r.startHeight;

    if (r.direction.includes('w')) {
      newLeft = r.startLeft + dx;
      newWidth = r.startWidth - dx;
    }
    if (r.direction.includes('e')) {
      newWidth = r.startWidth + dx;
    }
    if (r.direction.includes('n')) {
      newTop = r.startTop + dy;
      newHeight = r.startHeight - dy;
    }
    if (r.direction.includes('s')) {
      newHeight = r.startHeight + dy;
    }

    // Enforce min size — if we'd go below min while dragging from a
    // top/left edge, freeze position so the window doesn't slide.
    if (newWidth < this.options.minWidth) {
      if (r.direction.includes('w')) {
        newLeft = r.startLeft + (r.startWidth - this.options.minWidth);
      }
      newWidth = this.options.minWidth;
    }
    if (newHeight < this.options.minHeight) {
      if (r.direction.includes('n')) {
        newTop = r.startTop + (r.startHeight - this.options.minHeight);
      }
      newHeight = this.options.minHeight;
    }

    // Viewport clamp — keep window within bounds.
    if (newLeft < 0) {
      newWidth += newLeft;
      newLeft = 0;
    }
    if (newTop < 0) {
      newHeight += newTop;
      newTop = 0;
    }
    if (newLeft + newWidth > window.innerWidth) {
      newWidth = window.innerWidth - newLeft;
    }
    if (newTop + newHeight > window.innerHeight) {
      newHeight = window.innerHeight - newTop;
    }

    this.el.style.left = `${newLeft}px`;
    this.el.style.top = `${newTop}px`;
    this.el.style.width = `${newWidth}px`;
    this.el.style.height = `${newHeight}px`;
    this.options.onresize.call(this, newWidth, newHeight);
  };

  private readonly onResizePointerUp = (e: PointerEvent): void => {
    if (this.resizeState === null) return;
    if (e.pointerId !== this.resizeState.pointerId) return;
    this.resizeState = null;
    document.removeEventListener('pointermove', this.onResizePointerMove);
    document.removeEventListener('pointerup', this.onResizePointerUp);
    document.removeEventListener('pointercancel', this.onResizePointerUp);
  };

  /* ─── raise-on-click (issue #6) ─────────────────────────────────
     Single capture-phase pointerdown handler on the window root —
     fires before drag/resize handlers consume the event so click-to-
     raise always wins. */

  private readonly onRaisePointerDown = (_e: PointerEvent): void => {
    windowManager.raise(this);
  };

  private attachRaiseOnPointerDown(): void {
    if (this.el !== null) {
      this.el.addEventListener('pointerdown', this.onRaisePointerDown, true);
    }
  }

  private detachRaiseOnPointerDown(): void {
    if (this.el !== null) {
      this.el.removeEventListener('pointerdown', this.onRaisePointerDown, true);
    }
  }

  /* ─── keyboard / a11y (issue #9) ──────────────────────────────────
     Handles Escape (closes modal/alert types) and Tab (focus trap on
     modal/alert). Bound at mount, removed at unmount. */

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (this.el === null) return;
    const isModal = this.options.type === 'modal' || this.options.type === 'alert';

    if (e.key === 'Escape' && isModal) {
      e.stopPropagation();
      this.close();
      return;
    }

    if (e.key === 'Tab' && isModal) {
      const focusables = this.getFocusables();
      if (focusables.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;
      const active = document.activeElement;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  private attachKeyboard(): void {
    if (this.el !== null) {
      this.el.addEventListener('keydown', this.onKeyDown);
    }
  }

  private detachKeyboard(): void {
    if (this.el !== null) {
      this.el.removeEventListener('keydown', this.onKeyDown);
    }
  }

  /**
   * Place initial focus on the first focusable element inside content.
   * Falls back to the window itself (tabindex=-1) when content has no
   * focusable children. Issue #9.
   */
  private placeInitialFocus(): void {
    if (this.el === null) return;
    const focusables = this.getFocusables();
    if (focusables.length > 0) {
      focusables[0]!.focus();
    } else {
      this.el.focus();
    }
  }

  /**
   * Return all focusable elements inside the content area, in tab order.
   * We filter by aria-hidden and disabled (via the selector), but NOT by
   * visibility — jsdom doesn't compute layout, so `offsetParent` checks
   * would break tests. Browsers naturally skip display:none / hidden
   * elements during focus operations anyway.
   */
  private getFocusables(): HTMLElement[] {
    if (this.contentEl === null) return [];
    return Array.from(this.contentEl.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
      .filter(el => el.getAttribute('aria-hidden') !== 'true');
  }

  /** Clamp programmatic resize to min size + viewport. */
  private clampSize(width: number, height: number): [number, number] {
    let w = Math.max(width, this.options.minWidth);
    let h = Math.max(height, this.options.minHeight);
    if (this.el !== null) {
      const rect = this.el.getBoundingClientRect();
      const left = rect.left || this.options.x;
      const top = rect.top || this.options.y;
      w = Math.min(w, window.innerWidth - left);
      h = Math.min(h, window.innerHeight - top);
    }
    return [Math.max(this.options.minWidth, w), Math.max(this.options.minHeight, h)];
  }
}

function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (target instanceof HTMLElement && target.isContentEditable) return true;
  return false;
}
