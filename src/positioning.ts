// Positioning primitives shared between the runtime (`WindowManager`) and the
// declarative consumption layer. Pure DOM walkers — no class state, no theme
// dependency. Lives in `src/` (not `src/declarative/`) so the runtime layer
// can import it without crossing into the consumption layer (the layer
// boundary is one-way: declarative depends on runtime, not the other way).
// Originally defined twice — once in `ScriptoscopeWindow.ts:30`, once as an
// ad-hoc walker inside `interactive.ts`'s drag handlers — with subtly
// different stop conditions. The drag walker missed CSS-containing-block
// triggers (transform/filter/perspective), so dragging windows inside
// transformed ancestors landed at the wrong coordinates. Unified here on
// 2026-05-31 (FE reviewer follow-up).

/** Walk up from `el` to the nearest ancestor that establishes a CSS
 *  containing block for absolute-positioned descendants. Returns
 *  `<html>` if the chain reaches the root with nothing positioned.
 *  An element creates a containing block when its computed `position`
 *  is `relative`/`absolute`/`fixed`/`sticky`, OR when it has a
 *  `transform`/`filter`/`perspective` value (per CSS spec). */
export function findPositionedAncestor(el: HTMLElement): HTMLElement | null {
  let node: HTMLElement | null = el.parentElement;
  while (node && node !== document.documentElement) {
    const cs = getComputedStyle(node);
    if (cs.position !== 'static') return node;
    // CSS transforms / filters / perspective create a containing block too —
    // a common iOS scroll-perf hack (`* { transform: translateZ(0) }`) trips
    // this. Drag math that misses this case lands the host at the wrong
    // coordinates inside transformed parents.
    if (cs.transform !== 'none' || cs.filter !== 'none' || cs.perspective !== 'none') return node;
    node = node.parentElement;
  }
  return node; // <html> when nothing positioned along the chain
}

/** Convert a viewport rect's top-left into the `left`/`top` an absolutely
 *  positioned element needs to sit at that spot inside `ancestor` (the result
 *  of `findPositionedAncestor`). `getBoundingClientRect` is viewport-relative,
 *  but `left`/`top` resolve against the containing block's padding box:
 *  - `<html>`/none: the initial containing block sits at the document origin
 *    and scrolls with the page, so add the page scroll. Without this, an
 *    in-flow window dragged on a scrolled page jumped up by the scroll offset.
 *  - a positioned element: subtract its border, add its own scroll offset. */
export function offsetInContainingBlock(
  rect: { left: number; top: number },
  ancestor: HTMLElement | null,
): { x: number; y: number } {
  const root = document.documentElement;
  if (!ancestor || (ancestor === root && establishesNoContainingBlock(root))) {
    return { x: rect.left + window.scrollX, y: rect.top + window.scrollY };
  }
  const a = ancestor.getBoundingClientRect();
  // Viewport distances inside a scaled ancestor are scaled; left/top are not.
  const s = visualScale(ancestor, a);
  // A positioned <html> already moves with the page, and its scrollTop is the
  // page scroll, so only other ancestors add their own scroll offset.
  const scroll = ancestor === root ? { left: 0, top: 0 } : { left: ancestor.scrollLeft, top: ancestor.scrollTop };
  return {
    x: (rect.left - a.left) / s.x - ancestor.clientLeft + scroll.left,
    y: (rect.top - a.top) / s.y - ancestor.clientTop + scroll.top,
  };
}

/** How many viewport pixels one of `el`'s CSS pixels covers on each axis:
 *  the product of every `transform: scale()` on it and its ancestors. Divide
 *  pointer deltas by this before writing them as CSS lengths (issue #515).
 *  Axis-aligned scales only; rotation and skew aren't supported. Returns 1
 *  for an element with no layout box. */
export function visualScale(
  el: HTMLElement,
  rect: { width: number; height: number } = el.getBoundingClientRect(),
): { x: number; y: number } {
  const ratio = (shown: number, layout: number): number =>
    layout > 0 && shown > 0 ? shown / layout : 1;
  return { x: ratio(rect.width, el.offsetWidth), y: ratio(rect.height, el.offsetHeight) };
}

function establishesNoContainingBlock(el: HTMLElement): boolean {
  const cs = getComputedStyle(el);
  return cs.position === 'static' && cs.transform === 'none' && cs.filter === 'none' && cs.perspective === 'none';
}
