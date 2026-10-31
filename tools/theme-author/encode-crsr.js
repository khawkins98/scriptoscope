// Encode a 'crsr' (colour cursor) resource.
//
// Kaleidoscope's control panel enables "Arrow Cursor" when the scheme ships
// `crsr 0` (TEXT 1005 "Using the Control Panel": "This box is disabled if the
// scheme does not include a custom arrow cursor"; corpus author label "Custom
// Arrow Cursor", 14 of 18 schemes). The same schemes ship three Mac OS 8
// Finder cursors beside it: -20486 duplicate, -20487 make alias, -20488
// contextual menu (author labels "Dupicate Item / Make Alias / Context Menu
// Finder Cursor").
//
// Layout (Inside Macintosh: Imaging With QuickDraw, "Color QuickDraw",
// 'crsr' resource; the CCrsr record followed by its PixMap, pixel data and
// colour table, located by offsets):
//
//   0    crsrType     2   0x8001 = colour cursor
//   2    crsrMap      4   offset of the PixMap (0x60)
//   6    crsrData     4   offset of the pixel rows (0x92)
//   10   crsrXData    4   0 (runtime only)
//   14   crsrXValid   2   0
//   16   crsrXHandle  4   0
//   20   crsr1Data   32   16×16 1-bit image for 1-bit screens
//   52   crsrMask    32   16×16 mask
//   84   crsrHotSpot  4   v, h
//   88   crsrXTable   4   0
//   92   crsrID       4   0
//   96   PixMap      50   bounds 16×16, pmTable = offset of the colour table
//   146  pixel rows       rowBytes × 16
//   ..   ColorTable       seed, flags, ctSize, ColorSpecs keyed by value
//
// How QuickDraw combines them on a colour screen: where the mask is 1 the
// colour pixel shows; where it is 0 the screen shows through (1-bit data 0) or
// is inverted (data 1). So keep the 1-bit image inside the mask.

import { ByteWriter, rowBytesFor } from './bytes.js';
import { to16 } from './color.js';
import { buildPalette, packRows } from './encode-cicn.js';

const DPI_72 = 0x00480000;
const PIXMAP_AT = 0x60;
const DATA_AT = PIXMAP_AT + 50;

/** Pack a 16×16 array of 0/1 into 32 bytes of 16-bit rows. */
const bits16 = (values) => Array.from(packRows(values, 16, 16, 1, 2));

/**
 * Low-level writer: every field explicit. Used by encodeCrsr and by the corpus
 * round-trip test.
 * @param {{ data: ArrayLike<number>, mask: ArrayLike<number>, hotSpot: {x:number,y:number},
 *   depth: 1|2|4|8, pixels: ArrayLike<number>, colorTable: Array<{value:number, rgb16:number[]}>,
 *   ctSeed?: number, ctFlags?: number, packSize?: number }} c  data/mask/pixels are 256 values,
 *   row by row; packSize is informational (0, or the pixel data's size in 23 corpus cursors)
 * @returns {Uint8Array}
 */
export function encodeCrsrRecord({ data, mask, hotSpot, depth, pixels, colorTable, ctSeed = 0, ctFlags = 0, packSize = 0 }) {
  if (![1, 2, 4, 8].includes(depth)) throw new Error(`encodeCrsr: depth ${depth} must be 1, 2, 4 or 8`);
  for (const [k, arr] of [['data', data], ['mask', mask], ['pixels', pixels]]) {
    if (arr.length !== 256) throw new Error(`encodeCrsr: ${k} must have 256 values (16×16)`);
  }
  const { x, y } = hotSpot;
  if (!(x >= 0 && x < 16 && y >= 0 && y < 16)) throw new Error('encodeCrsr: the hot spot must lie inside the 16×16 cursor');
  const rowBytes = rowBytesFor(16, depth);
  const tableAt = DATA_AT + rowBytes * 16;
  const w = new ByteWriter()
    .u16(0x8001).u32(PIXMAP_AT).u32(DATA_AT).u32(0).i16(0).u32(0)
    .raw(bits16(data)).raw(bits16(mask))
    .i16(y).i16(x)
    .u32(0).u32(0)
    // PixMap
    .u32(0).u16(rowBytes | 0x8000)
    .rect({ top: 0, left: 0, bottom: 16, right: 16 })
    .u16(0).u16(0).u32(packSize)
    .u32(DPI_72).u32(DPI_72)
    .u16(0).u16(depth).u16(1).u16(depth)
    .u32(0).u32(tableAt).u32(0)
    .raw(packRows(pixels, 16, 16, depth, rowBytes));
  w.u32(ctSeed >>> 0).u16(ctFlags).i16(colorTable.length - 1);
  for (const { value, rgb16 } of colorTable) w.i16(value).u16(rgb16[0]).u16(rgb16[1]).u16(rgb16[2]);
  return w.toUint8Array();
}

/**
 * A 16×16 Raster → 'crsr'. Opaque pixels form the mask and carry their colour;
 * transparent pixels show the screen. The 1-bit image for 1-bit screens is the
 * dark opaque pixels unless `bw` (256 values of 0/1) is given; either way it is
 * clipped to the mask. Colours are gamma-compensated like encodeCicn's.
 * @param {import('./raster.js').Raster} raster
 * @param {{ hotSpot: {x:number,y:number}, bw?: ArrayLike<number>, gamma?: boolean }} options
 * @returns {Uint8Array}
 */
export function encodeCrsr(raster, { hotSpot, bw, gamma = true }) {
  if (raster.width !== 16 || raster.height !== 16) throw new Error(`encodeCrsr: a cursor is 16×16, not ${raster.width}x${raster.height}`);
  for (let i = 3; i < raster.rgba.length; i += 4) {
    const a = raster.rgba[i];
    if (a !== 0 && a < 128) throw new Error('encodeCrsr: cursors have no hidden swatches; use alpha 0 or 255');
  }
  const { palette, indices, mask, depth } = buildPalette(raster, { gamma, label: 'encodeCrsr' });
  // Corpus cursors keep white as entry 0, which every transparent pixel uses.
  const white = palette.findIndex(([r, g, b]) => r === 255 && g === 255 && b === 255);
  const order = white > 0 ? [white, ...palette.keys()].filter((v, i, a) => a.indexOf(v) === i) : [...palette.keys()];
  if (white < 0) order.unshift(-1);
  const table = order.map((p) => (p < 0 ? [255, 255, 255] : palette[p]));
  const remap = new Map(order.map((p, i) => [p, i]));
  const pixels = Array.from(indices, (v, i) => (mask[i] ? remap.get(v) : 0));
  if (table.length > 256) throw new Error('encodeCrsr: too many colours');
  const finalDepth = [1, 2, 4, 8].find((d) => table.length <= 1 << d) ?? depth;
  const data = bw ? Array.from(bw, (b, i) => (b && mask[i] ? 1 : 0)) : Array.from(mask, (m, i) => {
    if (!m) return 0;
    const [r, g, b] = table[pixels[i]];
    return 0.299 * r + 0.587 * g + 0.114 * b < 128 ? 1 : 0;
  });
  return encodeCrsrRecord({
    data, mask, hotSpot, depth: finalDepth, pixels,
    colorTable: table.map(([r, g, b], value) => ({ value, rgb16: [to16(r), to16(g), to16(b)] })),
  });
}
