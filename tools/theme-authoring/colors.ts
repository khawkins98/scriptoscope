import type { Rgb16 } from "./project.js";
import { macRgbToSrgb } from "../theme-loader/mac-gamma.js";

/** Display values follow the existing runtime's high-byte + Mac display policy. */
export function displayHex(rgb: Rgb16): string {
  return (
    "#" +
    macRgbToSrgb(rgb.map((channel) => channel >> 8))
      .map((channel) => channel!.toString(16).padStart(2, "0"))
      .join("")
  );
}
const displayLevels = Array.from(
  { length: 256 },
  (_, source) => macRgbToSrgb([source, source, source])[0]!,
);

/** Explicit authoring quantization policy, not a lossless inverse of old colors.
 * New display choices select the nearest representable 8-bit source channel,
 * with lower source value breaking ties, then expand it by257 toRGB16.
 * Existing channels are never run through this function on import/open/save.
 */
export function sourceFromDisplayHex(hex: string): Rgb16 {
  if (!/^#[\da-f]{6}$/i.test(hex))
    throw new Error("Use a six-digit display hex color.");
  return [1, 3, 5].map((offset) => {
    const target = parseInt(hex.slice(offset, offset + 2), 16);
    let nearest = 0;
    for (let source = 1; source < 256; source++)
      if (
        Math.abs(displayLevels[source]! - target) <
        Math.abs(displayLevels[nearest]! - target)
      )
        nearest = source;
    return nearest * 257;
  }) as Rgb16;
}
