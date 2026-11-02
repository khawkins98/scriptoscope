// Encode a Raster as a 'cicn' (colour icon) resource — the inverse of
// tools/theme-loader/decoders/cicn.js. Every frame image, button face and
// checkbox in a Kaleidoscope scheme is a cicn.
//
// Serialized layout (Inside Macintosh: Imaging With QuickDraw, ch. 4):
//
//   0    PixMap iconPMap   (50 bytes)  colour image header
//   50   BitMap iconMask   (14 bytes)  1-bit transparency mask header
//   64   BitMap iconBMap   (14 bytes)  1-bit black-and-white fallback header
//   78   Handle iconData   (4 bytes, 0)
//   82   mask rows, then B/W rows, then ColorTable, then colour pixel rows
//
// What the encoder decides for you:
//   • Palette: the distinct opaque colours, in first-seen order. More than 256
//     colours is an error (cicns are indexed, 8 bits at most): simplify the art.
//   • Depth: the smallest of 1/2/4/8 bits that fits the palette.
//   • Mask: alpha ≥ 128 → opaque. Alpha 0 → transparent. Alpha 1–127 → a
//     hidden swatch: transparent on screen, but its colour is kept at that
//     pixel for the engine to sample (Raster.swatch).
//   • B/W fallback: dark opaque pixels become black (only 1-bit screens use it).
//   • Colours: converted from display sRGB to stored Mac values (color.js).

import { ByteWriter, rowBytesFor } from './bytes.js';
import { srgbChannelToMac, to16 } from './color.js';

const DPI_72 = 0x00480000; // Fixed-point 72.0, what every corpus cicn stores

/**
 * @param {import('./raster.js').Raster} raster
 * @param {{ gamma?: boolean }} [options] gamma=false stores colours unchanged
 * @returns {Uint8Array}
 */
export function encodeCicn(raster, { gamma = true } = {}) {
  const { width, height, rgba } = raster;
  // rowBytes keeps flag bits in its top two bits, so it must stay below 0x4000.
  if (rowBytesFor(width, 8) > 0x3ffe || height > 0x7fff) throw new Error('encodeCicn: raster too large');

  const { palette, indices, mask, depth } = buildPalette(raster, { gamma, label: 'encodeCicn' });

  const pixRowBytes = rowBytesFor(width, depth);
  const bitRowBytes = rowBytesFor(width, 1);

  const w = new ByteWriter();
  // PixMap
  w.u32(0)                          // baseAddr
    .u16(pixRowBytes | 0x8000)      // rowBytes, high bit = "this is a PixMap"
    .rect({ top: 0, left: 0, bottom: height, right: width })
    .u16(0).u16(0).u32(0)           // pmVersion, packType (unpacked), packSize
    .u32(DPI_72).u32(DPI_72)        // hRes, vRes
    .u16(0)                         // pixelType: indexed
    .u16(depth).u16(1).u16(depth)   // pixelSize, cmpCount, cmpSize
    .u32(0).u32(0).u32(0);          // planeBytes, pmTable, pmReserved
  // Mask and B/W bitmap headers
  for (let k = 0; k < 2; k++) w.u32(0).u16(bitRowBytes).rect({ top: 0, left: 0, bottom: height, right: width });
  w.u32(0); // iconData handle

  // Mask rows
  w.raw(packRows(mask, width, height, 1, bitRowBytes));
  // B/W fallback rows: 1 = black
  const bw = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) {
    if (!mask[i]) continue;
    const [r, g, b] = palette[indices[i]];
    bw[i] = 0.299 * r + 0.587 * g + 0.114 * b < 128 ? 1 : 0;
  }
  w.raw(packRows(bw, width, height, 1, bitRowBytes));

  // ColorTable: seed, flags (0 = entries keyed by their value field), ctSize = count − 1
  w.u32(0).u16(0).i16(palette.length - 1);
  palette.forEach(([r, g, b], i) => w.u16(i).u16(to16(r)).u16(to16(g)).u16(to16(b)));

  // Colour pixel rows
  w.raw(packRows(indices, width, height, depth, pixRowBytes));
  return w.toUint8Array();
}

/**
 * Index a raster's pixels into a palette of stored (gamma-inverted) colours.
 * Shared by encodeCicn and encodePpat. Alpha 0 → index 0 and mask 0; alpha
 * 1–127 → a hidden swatch (mask 0, colour kept); alpha ≥ 128 → opaque.
 * @returns {{ palette: number[][], indices: Uint8Array, mask: Uint8Array, depth: number }}
 */
export function buildPalette(raster, { gamma = true, label = 'encode' } = {}) {
  const { width, height, rgba } = raster;
  const indexOf = new Map();
  const palette = [];
  const indices = new Uint8Array(width * height);
  const mask = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const alpha = rgba[i * 4 + 3];
    if (alpha === 0) continue;   // transparent, colour irrelevant (palette index 0)
    mask[i] = alpha >= 128 ? 1 : 0;
    const r = gamma ? srgbChannelToMac(rgba[i * 4]) : rgba[i * 4];
    const g = gamma ? srgbChannelToMac(rgba[i * 4 + 1]) : rgba[i * 4 + 1];
    const b = gamma ? srgbChannelToMac(rgba[i * 4 + 2]) : rgba[i * 4 + 2];
    // Key by the stored colour: inverse gamma can merge distinct display
    // colours. Packed RGB avoids allocating arrays and strings per pixel.
    const key = (r << 16) | (g << 8) | b;
    let index = indexOf.get(key);
    if (index === undefined) {
      if (palette.length === 256) {
        const total = new Set();
        for (let j = 0; j < width * height; j++) if (rgba[j * 4 + 3]) total.add(`${rgba[j * 4]},${rgba[j * 4 + 1]},${rgba[j * 4 + 2]}`);
        throw new Error(`${label}: ${total.size} colours in a ${width}x${height} image, but the limit is 256. ` +
          'Smooth edges and gradients add colours fast: call fitPalette(raster) (tools/theme-author/fit-palette.js) before encoding, or use fewer gradient steps');
      }
      index = palette.length;
      indexOf.set(key, index);
      palette.push([r, g, b]);
    }
    indices[i] = index;
  }
  if (palette.length === 0) palette.push([255, 255, 255]); // fully transparent image
  const depth = [1, 2, 4, 8].find((d) => palette.length <= 1 << d);
  return { palette, indices, mask, depth };
}

/** Pack per-pixel values (< 2^depth) into QuickDraw rows, leftmost pixel in the high bits. */
export function packRows(values, width, height, depth, rowBytes) {
  const out = new Uint8Array(rowBytes * height);
  const perByte = 8 / depth;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const shift = (perByte - 1 - (x % perByte)) * depth;
    out[y * rowBytes + Math.floor(x / perByte)] |= values[y * width + x] << shift;
  }
  return out;
}
