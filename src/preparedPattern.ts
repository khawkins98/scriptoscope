import type { Pixmap, QdRect, QdPoint } from './engine/qd/types.js';

const ownedPixmaps = new WeakSet<object>();
export function registerPixelBuffer(p: Pixmap): void { ownedPixmaps.add(p); }

const typedArrayPrototype = Object.getPrototypeOf(Uint8ClampedArray.prototype);
const arrayLength = Object.getOwnPropertyDescriptor(typedArrayPrototype, 'length')!.get!;
const arrayKind = Object.getOwnPropertyDescriptor(typedArrayPrototype, Symbol.toStringTag)!.get!;
const arrayBuffer = Object.getOwnPropertyDescriptor(typedArrayPrototype, 'buffer')!.get!;
const repeatBytes = Uint8ClampedArray.prototype.copyWithin;

export function preparedPatternRect(work: Pixmap, r: { x: number; y: number; w: number; h: number }, pattern: Pixmap, phase: readonly number[], indexedSeed = false): void {
  const pw = pattern.width, ph = pattern.height;
  const start = ((r.x + phase[0]!) % pw + pw) % pw, seed = Math.min(pw, r.w);
  for (let y = r.y; y < r.y + r.h; y++) {
    const row = ((y + phase[1]!) % ph + ph) % ph * pw;
    for (let x = r.x, sx = start; x < r.x + seed; sx = 0) {
      const n = Math.min(pw - sx, r.x + seed - x);
      const source = (row + sx) * 4, target = (y * work.width + x) * 4;
      if (indexedSeed) for (let i = 0; i < n * 4; i++) work.data[target + i] = pattern.data[source + i]!;
      else work.data.set(pattern.data.subarray(source, source + n * 4), target);
      x += n;
    }
    const at = (y * work.width + r.x) * 4;
    for (let n = seed * 4; n < r.w * 4; n *= 2) {
      const end = at + Math.min(n, r.w * 4 - n);
      if (indexedSeed) repeatBytes.call(work.data, at + n, at, end);
      else work.data.set(work.data.subarray(at, end), at + n);
    }
  }
}

/** The public push route owns the geometry, but cached pixels remain mutable. */
export function tryPreparedPattern(port: Pixmap, box: QdRect, pattern: Pixmap, phase: QdPoint): boolean {
  if (!ownedPixmaps.has(port) || !ownedPixmaps.has(pattern)) return false;
  for (const p of [port, pattern]) {
    for (const key of ['width', 'height', 'data']) if (!Object.hasOwn(Object.getOwnPropertyDescriptor(p, key) ?? {}, 'value')) return false;
    if (!Number.isSafeInteger(p.width) || !Number.isSafeInteger(p.height) || p.width <= 0 || p.height <= 0
      || !ArrayBuffer.isView(p.data) || arrayKind.call(p.data) !== 'Uint8ClampedArray' || arrayLength.call(p.data) !== p.width * p.height * 4) return false;
  }
  if (arrayBuffer.call(port.data) === arrayBuffer.call(pattern.data) || ![box.top, box.left, box.bottom, box.right, phase.x, phase.y].every(Number.isSafeInteger)) return false;
  const x = Math.max(0, box.left), y = Math.max(0, box.top), right = Math.min(port.width, box.right), bottom = Math.min(port.height, box.bottom);
  if (right > x && bottom > y) preparedPatternRect(port, { x, y, w: right - x, h: bottom - y }, pattern, [-phase.x, -phase.y], true);
  return true;
}
