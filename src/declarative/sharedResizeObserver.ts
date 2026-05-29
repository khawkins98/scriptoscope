// Lazy singleton wrapper around a single ResizeObserver that multiplexes observations
// for multiple ScriptoscopeWindow content-fit observations. Closes #170 — without this, every
// content-fit window attaches its own ResizeObserver (~50 observers at 50 windows, each
// firing independently on layout changes). The shared observer batches into one callback
// per ResizeObserver firing, dispatches to per-element registered callbacks.
//
// Lazy: the underlying ResizeObserver is only created on the first observe() call. A page
// that never uses content-fit windows pays nothing.
//
// Per-page singleton: even multiple mountDeclarative() calls share this one observer.
// ResizeObserver is browser-side; one is plenty.

type Callback = (entry: ResizeObserverEntry) => void;

class SharedResizeObserver {
  private ro: ResizeObserver | null = null;
  // Map (not WeakMap) so we can dispatch by Element identity in the RO callback —
  // ResizeObserverEntry.target is a strong reference we hold transiently for the
  // duration of the dispatch loop. Unobserve removes the mapping cleanly.
  private callbacks = new Map<Element, Callback>();

  /** Register an element + callback. Lazily creates the underlying ResizeObserver. */
  observe(el: Element, cb: Callback): void {
    // Bail if ResizeObserver isn't available (older browsers, jsdom default). Caller
    // gets no resize-driven re-rendering, which is the same as today's behavior in
    // those environments.
    if (typeof ResizeObserver === 'undefined') return;
    if (!this.ro) {
      this.ro = new ResizeObserver((entries) => {
        // Dispatch each fired entry to its registered callback. A throw from any
        // callback shouldn't prevent the others from firing — wrap in try/catch.
        for (const e of entries) {
          const handler = this.callbacks.get(e.target);
          if (!handler) continue;
          try { handler(e); }
          catch (err) { console.error('[scriptoscope] SharedResizeObserver callback threw:', err); }
        }
      });
    }
    this.callbacks.set(el, cb);
    this.ro.observe(el);
  }

  /** Stop observing an element. Idempotent. */
  unobserve(el: Element): void {
    this.callbacks.delete(el);
    if (this.ro) this.ro.unobserve(el);
  }
}

/** Module-level singleton. One ResizeObserver per page across all consumers. */
export const sharedRO = new SharedResizeObserver();
