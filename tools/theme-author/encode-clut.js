// Encode a 'clut' (colour lookup table) resource — the inverse of
// tools/theme-loader/decoders/clut.js.
//
// ColorTable layout (Inside Macintosh: Imaging With QuickDraw, "Color Manager"):
//
//   0  ctSeed   4   0 in every corpus scheme clut
//   4  ctFlags  2   0x0000 (entries keyed by their value field)
//   6  ctSize   2   index of the last entry (count − 1)
//   8  ColorSpec[]  value(2) red(2) green(2) blue(2), 16-bit channels
//
// Kaleidoscope schemes ship three kinds (author labels in the corpus):
//   clut -14336 "Active Header" / -14335 "Inactive Header": seven entries keyed by
//     part code: 0 frame, 1 fill, 2 text, 3 light tinge, 4 dark tinge,
//     5 light bevel, 6 dark bevel (decoders/clut.js; "Creating Color Schemes").
//   clut 300 "Slider & Focus Ring Colors" / "Appearance1.0.X Accent Color Ramp":
//     eight entries 0–7, light to dark.

import { ByteWriter } from './bytes.js';
import { srgbToStored, to16 } from './color.js';

/**
 * @param {Array<{ value: number, color?: string|number[], rgb16?: number[] }>} entries
 *   `color` is what you want to see (sRGB; gamma-compensated like every other
 *   encoder unless { gamma: false }); `rgb16` writes raw 16-bit channels.
 * @param {{ seed?: number, flags?: number, gamma?: boolean }} [options]
 * @returns {Uint8Array}
 */
export function encodeClut(entries, { seed = 0, flags = 0, gamma = true } = {}) {
  if (!entries.length) throw new Error('encodeClut: a colour table needs at least one entry');
  const w = new ByteWriter().u32(seed >>> 0).u16(flags).i16(entries.length - 1);
  for (const e of entries) {
    const rgb16 = e.rgb16 ?? srgbToStored(e.color, { gamma }).map(to16);
    if (rgb16.length !== 3) throw new Error('encodeClut: an entry needs color or rgb16');
    w.i16(e.value).u16(rgb16[0]).u16(rgb16[1]).u16(rgb16[2]);
  }
  return w.toUint8Array();
}

/** Header clut (-14336 active / -14335 inactive) from named part colours. */
export function encodeHeaderClut({ frame, fill, text, lightTinge, darkTinge, lightBevel, darkBevel }, options) {
  const parts = [frame, fill, text, lightTinge, darkTinge, lightBevel, darkBevel];
  if (parts.some((c) => c == null)) throw new Error('encodeHeaderClut: all seven part colours are required');
  return encodeClut(parts.map((color, value) => ({ value, color })), options);
}
