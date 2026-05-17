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

/** Public constructor options. All fields optional with sensible defaults. */
export interface AaronWindowOptions {
  /** Title text shown in the titlebar. Defaults to empty string. */
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
   * responsible for sanitising untrusted strings. This matches WinBox's
   * `html` option for call-site compatibility (see issue #3).
   */
  html?: string;
  /**
   * DOM parent to append into. Falls back to `document.body` at mount time
   * if not provided. Resolving lazily means importing the module in a
   * non-browser environment (e.g. SSR) doesn't fail at import time.
   */
  mount?: HTMLElement;
  /** Fired when the window closes via the close button or .close(). */
  onclose?: () => void;
}

/**
 * Internal normalised options after defaults applied. Kept separate from
 * the public interface so we can encode the "always present" guarantees
 * without forcing consumers to pass everything.
 */
interface NormalizedOptions {
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
  html: string;
  mount?: HTMLElement;
  onclose: () => void;
}

const noop = (): void => undefined;

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
      onclose: options.onclose ?? noop,
    };
    if (options.mount !== undefined) normalised.mount = options.mount;
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
    win.className = 'aaron-window';
    win.setAttribute('data-aaron-window', '');
    win.setAttribute('data-state', 'active');
    Object.assign(win.style, {
      position: 'absolute',
      left: `${this.options.x}px`,
      top: `${this.options.y}px`,
      width: `${this.options.width}px`,
      height: `${this.options.height}px`,
    });

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
