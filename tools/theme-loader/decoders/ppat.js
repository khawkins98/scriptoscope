// Decode a 'ppat' (pixel pattern) resource into an RGBA pixel buffer.
//
// Serialized layout (per Inside Macintosh: Imaging With QuickDraw, ch. 4):
//
//   0    UInt16 patType                — 0=basic, 1=full-color, 2=RGB pattern
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
// PixMap.pmTable is the resource-relative offset to the ColorTable; it need
// not immediately follow the image rows. See docs/spec/ppat-decoding.md.
//
// Patterns are typically 8x8 but the bounds field is authoritative.

import {
  Reader, readPixMap, readColorTable,
  expandIndexedPixels,
} from './shared.js';

/**
 * @param {Uint8Array} bytes  Raw ppat resource bytes
 * @returns {{width: number, height: number, rgba: Uint8Array, debug: object}|null}
 *   Returns null for unsupported pattern types or palette-relative color tables.
 *   Existing direct-color/type2 handling is outside the indexed-table contract.
 */
export function decodePpat(bytes) {
  const r = new Reader(bytes);

  const patType = r.readUInt16();
  const patMapOffset = r.readUInt32();
  const patDataOffset = r.readUInt32();
  // patType 0 is a plain 8-byte 1-bit pattern with no PixMap — skip for now.
  if (patType === 0) return null;

  // patType 1 = "Pattern" (color-table-based, indexed). patType 2 = "RGBPixPat"
  // (direct color, no color table). Both are unpacked via the same PixMap +
  // pixel-data + (optional) color-table layout; type 2 just skips the table.
  // Beos ships its 32-bit "Alert Backround" as patType 1 with pixelSize 32 —
  // the QuickDraw spec allows direct-color pixels even under type 1 if the
  // PixMap's pixelType field is 16 (RGBDirect). We handle both via pixelSize.
  if (patType !== 1 && patType !== 2) return null;

  // Jump to the PixMap section.
  r.seek(patMapOffset);
  const pmap = readPixMap(r);

  // Pixel data lives at patDataOffset.
  r.seek(patDataOffset);
  const pixelBytes = r.readBytes(pmap.rowBytes * pmap.height);

  const w = pmap.width, h = pmap.height;
  const rgba = new Uint8Array(w * h * 4);

  // Direct-color ppats (16/32 bpp, pmap.pixelType === 16 RGBDirect) skip the
  // color table entirely. Beos's "Alert Backround" (ppat 128) is the corpus
  // example for 32 bpp — previously failed with "Unsupported pixelSize: 32".
  // 16 bpp = 1 padding bit + 5R + 5G + 5B big-endian; 32 bpp = $00 $RR $GG $BB.
  if (pmap.pixelSize === 32 || pmap.pixelSize === 16) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const o = (y * w + x) * 4;
        if (pmap.pixelSize === 32) {
          // pmap.cmpCount === 3 (no alpha) or 4 (ARGB). When 3, format is
          // pad-R-G-B (one $00 byte per pixel). When 4, alpha is the first byte.
          const p = y * pmap.rowBytes + x * 4;
          if (pmap.cmpCount === 4) {
            rgba[o]     = pixelBytes[p + 1];
            rgba[o + 1] = pixelBytes[p + 2];
            rgba[o + 2] = pixelBytes[p + 3];
            rgba[o + 3] = pixelBytes[p]; // alpha — usually 0 (padding) for ppats; force opaque below
          } else {
            rgba[o]     = pixelBytes[p + 1];
            rgba[o + 1] = pixelBytes[p + 2];
            rgba[o + 2] = pixelBytes[p + 3];
            rgba[o + 3] = 255;
          }
          // ppats are fully opaque regardless of the source alpha byte
          // (some encoders leave $00 as padding).
          rgba[o + 3] = 255;
        } else {
          // 16 bpp: big-endian uint16, 0_RRRRR_GGGGG_BBBBB.
          const p = y * pmap.rowBytes + x * 2;
          const v = (pixelBytes[p] << 8) | pixelBytes[p + 1];
          // Expand 5-bit → 8-bit by replicating high bits into low: (n<<3)|(n>>2).
          const r5 = (v >> 10) & 0x1F;
          const g5 = (v >> 5) & 0x1F;
          const b5 = v & 0x1F;
          rgba[o]     = (r5 << 3) | (r5 >> 2);
          rgba[o + 1] = (g5 << 3) | (g5 >> 2);
          rgba[o + 2] = (b5 << 3) | (b5 >> 2);
          rgba[o + 3] = 255;
        }
      }
    }
    return {
      width: w,
      height: h,
      rgba,
      debug: { patType, pixelSize: pmap.pixelSize, direct: true, rowBytes: pmap.rowBytes },
    };
  }

  // Indexed-color path (1/2/4/8 bpp). In a serialized ppat, pmTable is an
  // offset from the resource start, not an in-memory handle or row-end hint.
  if (pmap.pmTable + 8 > bytes.length) throw new RangeError('ppat color table header is outside the resource');
  r.seek(pmap.pmTable);
  const colorTable = readColorTable(r);
  if (colorTable.count < 0 || r.offset > bytes.length) throw new RangeError('ppat color table entries are truncated or invalid');
  // Apple TN QD13: bit14 redirects ColorSpec.value into a destination-window
  // palette and ignores RGB. A standalone decoder has no such palette.
  if (colorTable.flags & 0x4000) return null;
  // Bit15 set means positional device entries; otherwise ColorSpec.value is
  // the actual pixel value, including sparse/permuted tables. Keep this local
  // to ppat: the shared cicn lookup has not earned the same source contract.
  const colors = new Map();
  colorTable.entries.forEach((entry, position) => {
    const index = colorTable.flags & 0x8000 ? position : entry.value;
    if (!colors.has(index)) colors.set(index, [entry.r >> 8, entry.g >> 8, entry.b >> 8]);
  });

  const indices = expandIndexedPixels(
    pixelBytes, pmap.width, pmap.height, pmap.pixelSize, pmap.rowBytes,
  );

  for (let i = 0; i < indices.length; i++) {
    // Preserve the existing visible black fallback for missing values. The
    // original foreground/background interpolation is not implemented here.
    const [rR, gR, bR] = colors.get(indices[i]) ?? [0, 0, 0];
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
