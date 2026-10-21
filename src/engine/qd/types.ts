// QuickDraw-level value types for the v2 engine (docs/spec/engine/qd-primitives.md §2).
//
// Rects follow the Mac `Rect` convention the spec states: `{top, left, bottom,
// right}`, width = right − left, height = bottom − top, half-open on the far
// edges (Inside Macintosh: QuickDraw, "Rectangles").

/** A Mac `Rect`: `{top, left, bottom, right}`. */
export interface QdRect {
  readonly top: number;
  readonly left: number;
  readonly bottom: number;
  readonly right: number;
}

/** A point `(h, v)` = `(x, y)`. */
export interface QdPoint {
  readonly x: number;
  readonly y: number;
}

/** An RGBA colour, 8 bits per channel. Alpha carries the decoded mask (binary for cicns). */
export interface Rgba {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly a: number;
}

/**
 * A decoded pixel map: row-major RGBA, 4 bytes per pixel. The engine draws into
 * and samples from this shape only; `src/pixelBuffer.ts`'s `PixelBuffer`
 * satisfies it structurally. A cicn's mask is its alpha channel: the cicn
 * decoder turns mask bits into binary alpha (docs/spec/cicn-decoding.md), so a
 * clear mask bit is alpha 0.
 */
export interface Pixmap {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8ClampedArray;
}

/**
 * The per-transfer trap a blit ends in (qd-primitives §3 "Per-tile transfer"):
 * - `copyBits`: CopyBits `$A8EC` srcCopy, no mask; transparent source pixels
 *   overwrite the destination (alpha included);
 * - `copyMask`: CopyMask `$A817`; source pixels whose mask is clear leave the
 *   destination unchanged.
 */
export type Transfer = 'copyBits' | 'copyMask';

/** The tile blit's anchor byte (qd-primitives §2): 1 = forward, 0 = reverse. */
export type TileDirection = 0 | 1;
