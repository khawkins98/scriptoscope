// Transient pre-mount geometry capture — was stored as `data-scriptoscope-
// inherited-{left,top,width,height}` dataset attributes on each window
// target between scanner pre-capture and ScriptoscopeWindow.promote. That
// leaked into consumer DevTools, MutationObservers, and CSS attribute
// selectors. WeakMap keeps the same handoff invisible to the consumer.
//
// Per the 2026-05-30 lib-reviewer audit (C[#4-#5]): "transient stamps
// should be moved to a WeakMap so they don't appear in the DOM at all
// (cleaner Dev Tools, no leakage into the consumer's CSS)."

export interface InheritedRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

const RECTS = new WeakMap<Element, InheritedRect>();

/** Stash the viewport-relative pre-mount rect for an element. Called by
 *  the scanner during its single pre-capture pass. Subsequent reads via
 *  `readInheritedRect` see this value until consume() clears it. */
export function setInheritedRect(el: Element, rect: InheritedRect): void {
  RECTS.set(el, rect);
}

/** Read + clear in one call. ScriptoscopeWindow.promote uses this — the
 *  rect is only valid for the single promotion that follows the scan, so
 *  reading it consumes it. WeakMap entries also drop automatically when
 *  the element is GC'd, so this is belt + braces. */
export function consumeInheritedRect(el: Element): InheritedRect | null {
  const r = RECTS.get(el);
  if (!r) return null;
  RECTS.delete(el);
  return r;
}
