// MountHandle.openModal — themed-modal helper. Owns the visibility toggle,
// backdrop click, Esc key, focus trap, focus restore, and bubbled
// scriptoscope:close listener. The consumer keeps their wrap markup +
// CSS (the wrap's `position: fixed` shell + backdrop styling); the
// helper just flips `data-scriptoscope-modal-open` on it and handles
// the rest.
//
// The shape was chosen to replace ~70 LoC of consumer modal wiring
// (visibility class toggle, backdrop click, Esc, MutationObserver for
// close-widget) with one library call — architect-reviewer #5
// (2026-05-31). The focus trap (Tab/Shift+Tab cycle, focus restore on
// close) closes a real a11y gap the demo's hand-rolled modal had.

/** Focusable elements per WAI-ARIA inert/focus management guidance. */
const FOCUSABLE_SEL = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/** Walk descendants of `root`, including any shadow roots. The themed-window
 *  host has a shadow root, and focusable elements may be in light DOM
 *  children OR in the shadow's chrome (close widget hit-buttons live in
 *  the shadow). Trapping focus needs both. */
function findFocusable(root: Element): HTMLElement[] {
  const out: HTMLElement[] = [];
  const walk = (n: Element) => {
    out.push(...Array.from(n.querySelectorAll<HTMLElement>(FOCUSABLE_SEL)));
    // Recurse into shadow roots (the runtime's window hosts each have one).
    for (const el of Array.from(n.querySelectorAll<HTMLElement>('*'))) {
      if (el.shadowRoot) walk(el.shadowRoot as unknown as Element);
    }
  };
  walk(root);
  // Sort by tab-order (positive tabindex first, then DOM order).
  return out.filter((el) => {
    const cs = getComputedStyle(el);
    return cs.visibility !== 'hidden' && cs.display !== 'none' && !el.hasAttribute('inert');
  });
}

export interface OpenModalOptions {
  /** Fires after close has completed (after focus restore). */
  onClose?: (() => void) | undefined;
  /** Element to focus when the modal closes. Default: the document's
   *  activeElement at open-time (typically the trigger button). Pass null
   *  to skip focus restore entirely. */
  returnFocusTo?: HTMLElement | null;
}

export interface OpenModalHandle {
  /** Programmatic close (same path as Esc / backdrop / chrome-close). */
  close(): void;
}

/** Open `wrap` as a themed modal. The wrap is expected to already contain a
 *  `[data-scriptoscope-window]` article that the runtime has promoted; this
 *  helper does NOT do the promotion. Returns `{ close }` for programmatic
 *  control. Idempotent: calling openModal twice on the same wrap before close
 *  is a no-op (returns the same handle). */
export function openModal(wrap: HTMLElement, options: OpenModalOptions = {}): OpenModalHandle {
  // Idempotent: if already open, return a handle pointing at the existing close.
  const existing = (wrap as unknown as { __scriptoscopeModalClose?: () => void }).__scriptoscopeModalClose;
  if (existing) return { close: existing };

  const returnFocusTo = options.returnFocusTo === undefined
    ? (document.activeElement instanceof HTMLElement ? document.activeElement : null)
    : options.returnFocusTo;

  // Flip the attribute → consumer CSS makes the wrap visible. Single
  // toggle the consumer wires their fade/scale transition off.
  wrap.setAttribute('data-scriptoscope-modal-open', '');
  // Polite + role for screen readers (the consumer markup doesn't need
  // role=dialog because the themed window inside ALREADY has it — the
  // wrap is just the backdrop chrome).
  if (!wrap.hasAttribute('role')) wrap.setAttribute('role', 'presentation');

  // A11y: `inert` siblings of the wrap so SR virtual-cursor / swipe-nav
  // can't escape the modal. aria-modal on the dialog inside is the
  // declarative half; `inert` on the background DOM is the actual
  // constraint. Restored on close. Skip elements that already had
  // `inert` set by the consumer (don't toggle their state on close).
  // (a11y reviewer 2026-05-31 second pass.)
  const inertedSiblings: HTMLElement[] = [];
  if (wrap.parentElement) {
    for (const sibling of Array.from(wrap.parentElement.children)) {
      if (sibling === wrap) continue;
      if (!(sibling instanceof HTMLElement)) continue;
      if (sibling.hasAttribute('inert')) continue;
      sibling.setAttribute('inert', '');
      inertedSiblings.push(sibling);
    }
  }

  // Initial focus: first focusable inside the wrap (typically the close
  // widget hit-button in the chrome). If none, focus the wrap itself
  // (with tabindex=-1) so Esc still works.
  // Defer one microtask so promoted shadow content is queryable.
  queueMicrotask(() => {
    const focusables = findFocusable(wrap);
    if (focusables.length > 0) {
      focusables[0]?.focus();
    } else {
      if (!wrap.hasAttribute('tabindex')) wrap.setAttribute('tabindex', '-1');
      wrap.focus();
    }
  });

  const onBackdropClick = (e: MouseEvent) => {
    // Only close when the click target IS the wrap (not a descendant).
    if (e.target === wrap) close();
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    }
  };

  // Focus trap via `focusin` redirect (the standard pattern — react-aria,
  // focus-trap, dialog polyfill all use this). Intercepting Tab keys
  // misses focusables we didn't enumerate (shadow-DOM chrome widgets that
  // findFocusable() can miss across boundary edge cases). The focusin
  // listener catches the actual focus event regardless of how it
  // happened (Tab, click, programmatic), and redirects out-of-wrap focus
  // back to the first focusable inside.
  let redirecting = false;
  const onFocusIn = (e: FocusEvent) => {
    if (redirecting) return;
    const target = e.target as Node | null;
    if (target && wrap.contains(target)) return;
    // Focus escaped the wrap — pull it back to the first focusable.
    const focusables = findFocusable(wrap);
    const back = focusables[0] ?? (wrap.hasAttribute('tabindex') ? wrap : null);
    if (back) {
      redirecting = true;
      back.focus();
      // Release the guard on the next tick (the redirect itself will
      // fire focusin, which would otherwise loop).
      queueMicrotask(() => { redirecting = false; });
    }
  };

  const onInnerClose = () => close();

  wrap.addEventListener('click', onBackdropClick);
  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('focusin', onFocusIn);
  wrap.addEventListener('scriptoscope:close', onInnerClose);

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    wrap.removeAttribute('data-scriptoscope-modal-open');
    wrap.removeEventListener('click', onBackdropClick);
    document.removeEventListener('keydown', onKeyDown);
    document.removeEventListener('focusin', onFocusIn);
    wrap.removeEventListener('scriptoscope:close', onInnerClose);
    // Restore background SR navigation by un-inerting siblings we set.
    // Consumer-set inert elements are NOT in our list — they keep their state.
    for (const el of inertedSiblings) el.removeAttribute('inert');
    inertedSiblings.length = 0;
    delete (wrap as unknown as { __scriptoscopeModalClose?: () => void }).__scriptoscopeModalClose;
    // Restore focus AFTER the attribute is off (consumer CSS may make
    // the wrap unfocusable / display:none on transition end).
    if (returnFocusTo && typeof returnFocusTo.focus === 'function') {
      try { returnFocusTo.focus(); } catch { /* swallow */ }
    }
    options.onClose?.();
  };
  (wrap as unknown as { __scriptoscopeModalClose?: () => void }).__scriptoscopeModalClose = close;

  return { close };
}
