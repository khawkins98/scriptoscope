// Encode a Raster as a 'ppat' (pixel pattern) resource — the inverse of
// tools/theme-loader/decoders/ppat.js. Patterns tile a surface: the desktop,
// window and menu backgrounds, progress-bar stripes, scrollbar tracks.
//
// Layout written here (the one every corpus ppat uses; Inside Macintosh:
// Imaging With QuickDraw, ch. 4):
//
//   0   patType      2   1 = full-colour indexed pattern
//   2   patMap       4   offset of the PixMap = 28
//   6   patData      4   offset of the pixel rows = 78
//   10  patXData     4   0 (runtime only)
//   14  patXValid    2   -1 (expanded data not valid yet)
//   16  patXMap      4   0 (runtime only)
//   20  pat1Data     8   1-bit fallback pattern for black-and-white screens
//   28  PixMap      50   pmTable = offset of the colour table
//   78  pixel rows       rowBytes × height
//   ..  ColorTable
//
// Patterns have no mask: every pixel is opaque. QuickDraw expects power-of-two
// sizes (8×8, 16×16, 32×16 …; the corpus goes up to 1024×8 and 128×128),
// so other sizes are rejected.

import { ByteWriter, rowBytesFor } from './bytes.js';
import { to16 } from './color.js';
import { buildPalette, packRows } from './encode-cicn.js';

const DPI_72 = 0x00480000;
const PIXMAP_AT = 28;
const DATA_AT = PIXMAP_AT + 50;

/**
 * @param {import('./raster.js').Raster} raster
 * @param {{ gamma?: boolean }} [options]
 * @returns {Uint8Array}
 */
export function encodePpat(raster, { gamma = true } = {}) {
  const { width, height, rgba } = raster;
  const pow2 = (n) => n > 0 && (n & (n - 1)) === 0;
  if (!pow2(width) || !pow2(height) || width > 1024 || height > 1024) {
    throw new Error(`encodePpat: pattern size ${width}x${height} must be powers of two, at most 1024 (e.g. 8x8, 16x16, 32x16)`);
  }
  for (let i = 3; i < rgba.length; i += 4) {
    if (rgba[i] < 128) throw new Error('encodePpat: patterns cannot have transparent pixels');
  }
  const { palette, indices, depth } = buildPalette(raster, { gamma, label: 'encodePpat' });
  const rowBytes = rowBytesFor(width, depth);
  const tableAt = DATA_AT + rowBytes * height;

  // 1-bit fallback: dark pixels of the top-left 8×8 become black.
  const pat1 = new Array(8).fill(0);
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    const [r, g, b] = palette[indices[(y % height) * width + (x % width)]];
    if (0.299 * r + 0.587 * g + 0.114 * b < 128) pat1[y] |= 0x80 >> x;
  }

  const w = new ByteWriter()
    .u16(1).u32(PIXMAP_AT).u32(DATA_AT).u32(0).i16(-1).u32(0).raw(pat1)
    // PixMap
    .u32(0).u16(rowBytes | 0x8000)
    .rect({ top: 0, left: 0, bottom: height, right: width })
    .u16(0).u16(0).u32(0)
    .u32(DPI_72).u32(DPI_72)
    .u16(0).u16(depth).u16(1).u16(depth)
    .u32(0).u32(tableAt).u32(0)
    .raw(packRows(indices, width, height, depth, rowBytes));
  w.u32(0).u16(0).i16(palette.length - 1);
  palette.forEach(([r, g, b], i) => w.u16(i).u16(to16(r)).u16(to16(g)).u16(to16(b)));
  return w.toUint8Array();
}
