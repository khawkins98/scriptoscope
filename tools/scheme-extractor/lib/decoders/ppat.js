// Decode a 'ppat' (pixel pattern) resource into an RGBA pixel buffer.
//
// Serialized layout (per Inside Macintosh: Imaging With QuickDraw, ch. 4):
//
//   0    UInt16 patType                — 0=basic, 1=RGB-based, 2=full
//   2    UInt32 patMap offset          — offset to PixMap from start
//   6    UInt32 patData offset         — offset to pixel data from start
//   10   UInt32 patXData offset        — offset to expanded data (we ignore)
//   14   UInt16 patXValid
//   16   UInt32 patXMap                — handle (ignored)
//   20   Pattern pat1Data (8 bytes)    — 1-bit fallback pattern
//   28   ... padding to patMap offset
//
// At patMap offset: a PixMap (50 bytes), no embedded mask/bmap.
// At patData offset: indexed pixel data (rowBytes * height bytes).
// After pixel data: ColorTable.
//
// Patterns are typically 8x8 but the bounds field is authoritative.

import {
  Reader, readPixMap, readColorTable,
  expandIndexedPixels, indexToRgb,
} from './shared.js';

/**
 * @param {Uint8Array} bytes  Raw ppat resource bytes
 * @returns {{width: number, height: number, rgba: Uint8Array, debug: object}|null}
 *   Returns null for unsupported pattern types (only patType 1 is decoded today).
 */
export function decodePpat(bytes) {
  const r = new Reader(bytes);

  const patType = r.readUInt16();
  const patMapOffset = r.readUInt32();
  const patDataOffset = r.readUInt32();
  // patType 0 is a plain 8-byte 1-bit pattern with no PixMap — skip for now.
  if (patType === 0) return null;

  // patType 1 = "Pattern" (color-table-based). patType 2 = "RGBPixPat" (direct color).
  // We support 1 for now; 2 is rare in chrome assets.
  if (patType !== 1) return null;

  // Jump to the PixMap section.
  r.seek(patMapOffset);
  const pmap = readPixMap(r);

  // Pixel data lives at patDataOffset.
  r.seek(patDataOffset);
  const pixelBytes = r.readBytes(pmap.rowBytes * pmap.height);

  // Color table follows.
  const colorTable = readColorTable(r);

  const indices = expandIndexedPixels(
    pixelBytes, pmap.width, pmap.height, pmap.pixelSize, pmap.rowBytes,
  );

  const w = pmap.width, h = pmap.height;
  const rgba = new Uint8Array(w * h * 4);
  for (let i = 0; i < indices.length; i++) {
    const [rR, gR, bR] = indexToRgb(indices[i], colorTable);
    const o = i * 4;
    rgba[o] = rR;
    rgba[o + 1] = gR;
    rgba[o + 2] = bR;
    rgba[o + 3] = 255; // patterns are fully opaque
  }

  return {
    width: w,
    height: h,
    rgba,
    debug: {
      patType,
      pixelSize: pmap.pixelSize,
      colorCount: colorTable.count,
      rowBytes: pmap.rowBytes,
    },
  };
}
