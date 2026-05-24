// Decode a Mac OS 'clut' (color lookup table) resource.
//
// Standard ColorTable layout (Inside Macintosh: Imaging With QuickDraw,
// "Color Manager"):
//
//   off  size  field
//   0    4     ctSeed   (DWRD long) — table id / seed
//   4    2     ctFlags  (DWRD)      — 0x0000 for a clut resource
//   6    2     ctSize   (DWRD)      — index of the LAST entry (count − 1)
//   8    …     ColorSpec[ctSize+1] — each: value(2) + red(2)+green(2)+blue(2)
//
// Channels are 16-bit; we take the high byte (>>8) for 8-bit RGB.
//
// Kaleidoscope's window-header cluts (-14335 active, -14336 inactive)
// index colors by PART CODE, per the "Creating Color Schemes" doc:
//   part 0 = Frame color   part 1 = Fill (background)   part 2 = "Text" color
//   part 3 = Light tinge   part 4 = Dark tinge
//   part 5 = Light bevel   part 6 = Dark bevel
// `value` is the part code; entries may be sparse, so index BY value.
//
// CAVEAT: part 2 ("Text") is NOT the rendered TITLE-TEXT colour. The kDEF
// samples the title colour from a marker pixel baked into the window cicn
// (see kdef231-reference.md §1.4, `0x5530`), not from this clut. part 2 here
// is a frame/bevel tint; for several schemes it's wildly off the real title
// colour (1984 → sky-blue here vs. black on screen). Treat these as the
// frame APPEARANCE palette only; sample the cicn for the title colour.

import { Reader } from './shared.js';

/**
 * @param {Uint8Array} bytes  Raw clut resource bytes
 * @returns {{ seed: number, entries: Array<{ value: number, hex: string }> }}
 */
export function decodeClut(bytes) {
  const r = new Reader(bytes);
  const seed = (r.readInt16() << 16) | (r.readInt16() & 0xffff);
  r.readInt16(); // ctFlags (ignored)
  const last = r.readInt16(); // ctSize = last index
  const entries = [];
  for (let i = 0; i <= last; i++) {
    const value = r.readInt16();
    const red = r.readInt16() & 0xffff;
    const green = r.readInt16() & 0xffff;
    const blue = r.readInt16() & 0xffff;
    const hex =
      '#' +
      [(red >> 8) & 0xff, (green >> 8) & 0xff, (blue >> 8) & 0xff]
        .map((c) => c.toString(16).padStart(2, '0'))
        .join('');
    entries.push({ value, hex });
  }
  return { seed, entries };
}

/**
 * Pull the Kaleidoscope window-header colors out of a decoded clut,
 * indexed by part code. Missing parts come back undefined.
 *
 * @param {ReturnType<typeof decodeClut>} clut
 * @returns {{ frame?: string, fill?: string, text?: string,
 *             lightTinge?: string, darkTinge?: string,
 *             lightBevel?: string, darkBevel?: string }}
 */
export function headerColorsFromClut(clut) {
  const byPart = new Map(clut.entries.map((e) => [e.value, e.hex]));
  // part 2 ("Text") is intentionally NOT surfaced — it's a frame tint, not the
  // rendered title-text colour (see the CAVEAT above + title-text-color.md).
  return {
    frame: byPart.get(0),
    fill: byPart.get(1),
    lightTinge: byPart.get(3),
    darkTinge: byPart.get(4),
    lightBevel: byPart.get(5),
    darkBevel: byPart.get(6),
  };
}
