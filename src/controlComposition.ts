import type { PixelBuffer } from './pixelBuffer.js';

export type ControlPoint = readonly [number, number];
export interface ControlRect { readonly x: number; readonly y: number; readonly w: number; readonly h: number; }
/** Logical port coordinates of the FACE, excluding any reserved default ring.
 * Caller declarations and managed browser mappings do not certify original state. */
export interface ControlCompositionContext {
  readonly controlOrigin: ControlPoint;
  readonly portOrigin: ControlPoint;
  readonly patternOrigin:
    | { readonly status: 'known'; readonly offset: ControlPoint }
    | { readonly status: 'api-unavailable' }
    | { readonly status: 'unknown' };
  readonly clip: { readonly kind: 'unbounded' } | { readonly kind: 'rect'; readonly rect: ControlRect } | { readonly kind: 'unknown' };
  readonly basis?: 'caller-declared' | 'managed-content-port';
}

/** Applied compatibility defaults remain distinct from supplied state. */
export interface ControlCompositionSnapshot {
  readonly basis: 'caller-declared' | 'managed-content-port' | 'compatibility-default';
  readonly controlOrigin: ControlPoint;
  readonly portOrigin: ControlPoint;
  readonly patternOrigin: ControlCompositionContext['patternOrigin'];
  readonly clip: ControlCompositionContext['clip'];
}

/** Internal layout seam. Public composeButton/composeBevelButton still return pixels. */
export interface ButtonComposition {
  readonly buffer: PixelBuffer;
  readonly layout: { readonly faceRect: ControlRect };
}

const coordinate = (value: number, name: string): number => {
  if (!Number.isInteger(value) || value < -32768 || value > 32767) throw new RangeError(`${name} must be a signed 16-bit integer`);
  return value;
};
const point = (value: ControlPoint, name: string): ControlPoint => {
  if (!Array.isArray(value) || value.length !== 2) throw new TypeError(`${name} must be a coordinate pair`);
  return Object.freeze([coordinate(value[0], `${name}.x`), coordinate(value[1], `${name}.y`)]);
};
/** Snapshot before the first asynchronous render boundary; never freeze caller objects. */
export function snapshotControlComposition(context?: ControlCompositionContext): ControlCompositionSnapshot {
  if (!context) return Object.freeze({ basis: 'compatibility-default', controlOrigin: Object.freeze([0, 0]) as ControlPoint,
    portOrigin: Object.freeze([0, 0]) as ControlPoint, patternOrigin: Object.freeze({ status: 'unknown' }), clip: Object.freeze({ kind: 'unknown' }) });
  const { patternOrigin, clip } = context;
  if (!['known', 'api-unavailable', 'unknown'].includes(patternOrigin?.status)) throw new TypeError('Unknown pattern-origin state');
  if (!['rect', 'unbounded', 'unknown'].includes(clip?.kind)) throw new TypeError('Unknown clip kind');
  if (context.basis !== undefined && context.basis !== 'caller-declared' && context.basis !== 'managed-content-port') throw new TypeError('Unknown composition-context basis');
  let copiedClip: ControlCompositionSnapshot['clip'];
  if (clip.kind === 'rect') {
    const { x, y, w, h } = clip.rect;
    coordinate(x, 'clip.x'); coordinate(y, 'clip.y');
    if (!Number.isInteger(w) || !Number.isInteger(h) || w < 0 || h < 0) throw new RangeError('Clip dimensions must be nonnegative integers');
    coordinate(x + w, 'clip.right'); coordinate(y + h, 'clip.bottom');
    copiedClip = Object.freeze({ kind: 'rect', rect: Object.freeze({ x, y, w, h }) });
  } else copiedClip = Object.freeze({ kind: clip.kind });
  return Object.freeze({ basis: context.basis ?? 'caller-declared', controlOrigin: point(context.controlOrigin, 'controlOrigin'),
    portOrigin: point(context.portOrigin, 'portOrigin'), patternOrigin: patternOrigin.status === 'known'
      ? Object.freeze({ status: 'known', offset: point(patternOrigin.offset, 'patternOrigin.offset') }) : Object.freeze({ status: patternOrigin.status }),
    clip: copiedClip });
}

/** kDEF 10ac8..10af6 uses the ORIGINAL Rect edges, including exclusive right/bottom. */
export function bodyPatternAnchor(mode: number, rect: ControlRect): ControlPoint {
  const right = coordinate(rect.x + rect.w, 'control.right'), bottom = coordinate(rect.y + rect.h, 'control.bottom');
  switch (mode) {
    case 1: return [rect.x, rect.y];
    case 2: return [right, rect.y];
    case 3: return [rect.x, bottom];
    case 4: return [right, bottom];
    default: return [0, 0];
  }
}

const modulo = (value: number, size: number): number => ((value % size) + size) % size;
/** Full-color source model: f930 translates D/clip by -P; QDSetPatternOrigin's
 * signed offset adds to sampling (UI3.4.1's +10 origin/-10 offset example).
 * Unknown state explicitly applies zero as compatibility policy. Mode5 is NOT ppat. */
export function bodyPatternSample(context: ControlCompositionSnapshot, mode: number, width: number, height: number,
  x: number, y: number, tileWidth: number, tileHeight: number): ControlPoint {
  if (mode === 5) throw new RangeError('Body mode5 requests cicn, not ppat');
  if (!Number.isInteger(tileWidth) || !Number.isInteger(tileHeight) || tileWidth <= 0 || tileHeight <= 0) throw new RangeError('Pattern dimensions must be positive integers');
  const [phaseX, phaseY] = bodyPatternPhase(context, mode, width, height);
  return [modulo(phaseX + x, tileWidth), modulo(phaseY + y, tileHeight)];
}

/** Clip coordinates share the original port space; clipping never changes sampling. */
export function controlPointVisible(context: ControlCompositionSnapshot, x: number, y: number): boolean {
  if (context.clip.kind !== 'rect') return true;
  const r = context.clip.rect, px = context.controlOrigin[0] + x, py = context.controlOrigin[1] + y;
  return px >= r.x && py >= r.y && px < r.x + r.w && py < r.y + r.h;
}

/** Compute once per face, outside the pixel loop. */
export function bodyPatternPhase(context: ControlCompositionSnapshot, mode: number, width: number, height: number): ControlPoint {
  if (mode === 5) throw new RangeError('Body mode5 requests cicn, not ppat');
  const [dx, dy] = context.controlOrigin;
  const [px, py] = bodyPatternAnchor(mode, { x: dx, y: dy, w: width, h: height });
  const [ox, oy] = context.patternOrigin.status === 'known' ? context.patternOrigin.offset : [0, 0];
  return [dx - px + ox, dy - py + oy];
}
