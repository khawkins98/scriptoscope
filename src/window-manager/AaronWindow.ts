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
  private mounted = false;

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
    this.options.oncreate.call(this);
    return this;
  }

  /**
   * Remove the window from the DOM and release internal references.
   * Idempotent — calling on an unmounted window is a no-op.
   */
  unmount(): this {
    if (!this.mounted || this.el === null) return this;
    this.el.remove();
    this.el = null;
    this.contentEl = null;
    this.mounted = false;
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

    this.contentEl = content;
    return win;
  }
}
