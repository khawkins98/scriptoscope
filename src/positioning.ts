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
    // The individual transform properties create one as well.
    if (isSet(cs.rotate) || isSet(cs.scale) || isSet(cs.translate)) return node;
    node = node.parentElement;
  }
  return node; // <html> when nothing positioned along the chain
}

/** Convert a viewport point into the `left`/`top` an absolutely positioned
 *  element needs to put its origin there inside `ancestor` (the result of
 *  `findPositionedAncestor`). Pass the element's origin, `viewportFrame(el).origin`,
 *  not its bounding rect: under a rotated ancestor the two differ (#519).
 *  `getBoundingClientRect` is viewport-relative, but `left`/`top` resolve
 *  against the containing block's padding box:
 *  - `<html>`/none: the initial containing block sits at the document origin
 *    and scrolls with the page, so add the page scroll. Without this, an
 *    in-flow window dragged on a scrolled page jumped up by the scroll offset.
 *  - a positioned element: map into its own CSS pixels (undoing any scale,
 *    rotation or skew on it and above it), subtract its border, add its own
 *    scroll offset. */
export function offsetInContainingBlock(
  point: { left: number; top: number },
  ancestor: HTMLElement | null,
): { x: number; y: number } {
  const root = document.documentElement;
  if (!ancestor || (ancestor === root && establishesNoContainingBlock(root))) {
    return { x: point.left + window.scrollX, y: point.top + window.scrollY };
  }
  const local = viewportFrame(ancestor).toLocal(point.left, point.top);
  // A positioned <html> already moves with the page, and its scrollTop is the
  // page scroll, so only other ancestors add their own scroll offset.
  const scroll = ancestor === root ? { left: 0, top: 0 } : { left: ancestor.scrollLeft, top: ancestor.scrollTop };
  return {
    x: local.x - ancestor.clientLeft + scroll.left,
    y: local.y - ancestor.clientTop + scroll.top,
  };
}

/** How many viewport pixels one of `el`'s CSS pixels covers on each axis:
 *  the product of every `transform: scale()` on it and its ancestors (issue
 *  #515). Only meaningful for axis-aligned transforms; `viewportFrame` handles
 *  rotation and skew. Returns 1 for an element with no layout box. */
export function visualScale(
  el: HTMLElement,
  rect: { width: number; height: number } = el.getBoundingClientRect(),
): { x: number; y: number } {
  const ratio = (shown: number, layout: number): number =>
    layout > 0 && shown > 0 ? shown / layout : 1;
  return { x: ratio(rect.width, el.offsetWidth), y: ratio(rect.height, el.offsetHeight) };
}

/** Maps viewport points into an element's own CSS pixels, with (0, 0) at the
 *  top-left of its border box. */
export interface ViewportFrame {
  /** Where the element's local (0, 0) sits in the viewport. */
  readonly origin: { left: number; top: number };
  toLocal(x: number, y: number): { x: number; y: number };
}

/** The affine map from viewport points to `el`'s local CSS pixels (#519).
 *  Pointer positions and `getBoundingClientRect` are viewport pixels, but
 *  `left`/`top`/`width` are local ones; they differ inside any transformed
 *  ancestor. Map positions, then subtract: a delta along one screen axis can
 *  move along both local axes under a rotation.
 *
 *  The linear part (scale, rotation, skew) is the product of the 2D parts of
 *  every `transform`, `rotate` and `scale` from `el` up to the root. The
 *  translation comes from the bounding rect, which is the axis-aligned bounds
 *  of the transformed border box. When that product is a plain positive scale
 *  (or nothing), the rect-to-layout ratio is used instead, as before. 3D
 *  transforms are flattened to their 2D part. */
export function viewportFrame(el: HTMLElement, rect: DOMRectReadOnly | ClientRectLike = el.getBoundingClientRect()): ViewportFrame {
  const m = cumulativeLinear(el);
  const [a, b, c, d] = m;
  const det = a * d - b * c;
  if ((b === 0 && c === 0 && a > 0 && d > 0) || Math.abs(det) < 1e-9) {
    const s = visualScale(el, rect);
    return {
      origin: { left: rect.left, top: rect.top },
      toLocal: (x, y) => ({ x: (x - rect.left) / s.x, y: (y - rect.top) / s.y }),
    };
  }
  // The bounding rect's top-left is the minimum of the mapped corners, which
  // need not be the origin corner.
  const w = el.offsetWidth, h = el.offsetHeight;
  const left = rect.left - Math.min(0, a * w, c * h, a * w + c * h);
  const top = rect.top - Math.min(0, b * w, d * h, b * w + d * h);
  return {
    origin: { left, top },
    toLocal: (x, y) => {
      const dx = x - left, dy = y - top;
      return { x: (d * dx - c * dy) / det, y: (a * dy - b * dx) / det };
    },
  };
}

interface ClientRectLike { left: number; top: number; width: number; height: number }

/** 2D linear part of a CSS transform, as DOMMatrix `[a, b, c, d]`: local
 *  (x, y) maps to (a·x + c·y, b·x + d·y). */
type Linear = readonly [number, number, number, number];
const IDENTITY: Linear = [1, 0, 0, 1];

function multiply(p: Linear, q: Linear): Linear {
  return [p[0] * q[0] + p[2] * q[1], p[1] * q[0] + p[3] * q[1], p[0] * q[2] + p[2] * q[3], p[1] * q[2] + p[3] * q[3]];
}

/** Product of the linear parts of every transform from the root down to `el`. */
function cumulativeLinear(el: HTMLElement): Linear {
  let m = IDENTITY;
  for (let node: Element | null = el; node; node = composedParent(node)) {
    m = multiply(elementLinear(getComputedStyle(node)), m);
  }
  return m;
}

/** The flat-tree parent: across slots and out of shadow roots. */
function composedParent(node: Element): Element | null {
  if (node.assignedSlot) return node.assignedSlot;
  if (node.parentElement) return node.parentElement;
  const root = node.getRootNode?.() as (Node & { host?: Element }) | undefined;
  return root?.host ?? null;
}

/** Individual properties apply as translate, rotate, scale, then `transform`. */
function elementLinear(cs: Partial<CSSStyleDeclaration>): Linear {
  return multiply(multiply(parseRotate(cs.rotate), parseScale(cs.scale)), parseTransform(cs.transform));
}

function isSet(v: string | undefined): boolean {
  return !!v && v !== 'none';
}

/** Computed `transform` is always `none`, `matrix(…)` or `matrix3d(…)`. */
function parseTransform(v: string | undefined): Linear {
  const m = isSet(v) ? /^matrix(3d)?\(([^)]*)\)$/.exec(v!.trim()) : null;
  if (!m) return IDENTITY;
  const n = m[2]!.split(',').map(Number);
  // matrix3d lists columns: m11 m12 m13 m14 m21 m22 …
  const [a, b, c, d] = m[1] ? [n[0], n[1], n[4], n[5]] : [n[0], n[1], n[2], n[3]];
  return [a, b, c, d].every(Number.isFinite) ? [a!, b!, c!, d!] : IDENTITY;
}

/** Computed `scale`: `none` or one to three numbers (or percentages). */
function parseScale(v: string | undefined): Linear {
  if (!isSet(v)) return IDENTITY;
  const n = v!.trim().split(/\s+/).map(t => (t.endsWith('%') ? parseFloat(t) / 100 : parseFloat(t)));
  const sx = n[0]!, sy = n[1] ?? sx;
  return Number.isFinite(sx) && Number.isFinite(sy) ? [sx, 0, 0, sy] : IDENTITY;
}

/** Computed `rotate`: `none`, an angle, or an axis then an angle. Only a
 *  rotation about z is 2D; other axes are ignored. */
function parseRotate(v: string | undefined): Linear {
  if (!isSet(v)) return IDENTITY;
  const t = v!.trim().split(/\s+/);
  const axis = t.slice(0, -1).join(' ');
  if (axis && axis !== 'z' && axis !== '0 0 1') return IDENTITY;
  const rad = angle(t[t.length - 1]!);
  if (!Number.isFinite(rad)) return IDENTITY;
  const cos = Math.cos(rad), sin = Math.sin(rad);
  return [cos, sin, -sin, cos];
}

function angle(t: string): number {
  const n = parseFloat(t);
  if (t.endsWith('grad')) return (n * Math.PI) / 200;
  if (t.endsWith('rad')) return n;
  if (t.endsWith('turn')) return n * 2 * Math.PI;
  return (n * Math.PI) / 180; // deg
}

function establishesNoContainingBlock(el: HTMLElement): boolean {
  const cs = getComputedStyle(el);
  return cs.position === 'static' && cs.transform === 'none' && cs.filter === 'none' && cs.perspective === 'none';
}
