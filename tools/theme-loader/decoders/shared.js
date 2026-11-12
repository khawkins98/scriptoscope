import { DisplayProfileError } from '../display-profile.js';
// Shared big-endian binary reader and classic Mac Toolbox struct parsers
// used by both cicn and ppat decoders. Per Inside Macintosh: Imaging with
// QuickDraw (chapter 4), every Toolbox numeric field is big-endian.

/** Big-endian reader over a Uint8Array. */
export class Reader {
  constructor(bytes, offset = 0) {
    this.bytes = bytes;
    this.offset = offset;
  }
  remaining() { return this.bytes.length - this.offset; }
  seek(off) { this.offset = off; }
  skip(n) { this.offset += n; }

  readUInt8() {
    return this.bytes[this.offset++];
  }
  readUInt16() {
    const v = (this.bytes[this.offset] << 8) | this.bytes[this.offset + 1];
    this.offset += 2;
    return v;
  }
  readInt16() {
    const v = this.readUInt16();
    return v > 0x7FFF ? v - 0x10000 : v;
  }
  readUInt32() {
    const b = this.bytes, o = this.offset;
    const v = (b[o] * 0x1000000) + (b[o + 1] << 16) + (b[o + 2] << 8) + b[o + 3];
    this.offset += 4;
    return v >>> 0;
  }
  readInt32() {
    const v = this.readUInt32();
    return v > 0x7FFFFFFF ? v - 0x100000000 : v;
  }
  readBytes(n) {
    const out = this.bytes.subarray(this.offset, this.offset + n);
    this.offset += n;
    return out;
  }
}

/**
 * Parse a PixMap header. Inside Macintosh structure, 50 bytes:
 *   baseAddr(4) rowBytes(2) bounds(8) pmVersion(2) packType(2) packSize(4)
 *   hRes(4) vRes(4) pixelType(2) pixelSize(2) cmpCount(2) cmpSize(2)
 *   planeBytes(4) pmTable(4) pmReserved(4)
 * Serialized field meanings depend on the resource format. In ppat resources,
 * pmTable is a resource-relative color-table offset; it must not be assumed zero.
 * The rowBytes field's high bit (0x8000) flags pixmap (vs bitmap); the
 * actual byte count is the low 14 bits (0x3FFF).
 */
export function readPixMap(r) {
  const baseAddr = r.readUInt32();
  const rowBytesRaw = r.readUInt16();
  const isPixMap = (rowBytesRaw & 0x8000) !== 0;
  const rowBytes = rowBytesRaw & 0x3FFF;
  const bounds = readRect(r);
  const pmVersion = r.readUInt16();
  const packType = r.readUInt16();
  const packSize = r.readUInt32();
  const hRes = r.readUInt32(); // Fixed-point — we don't decode
  const vRes = r.readUInt32();
  const pixelType = r.readUInt16();
  const pixelSize = r.readUInt16();
  const cmpCount = r.readUInt16();
  const cmpSize = r.readUInt16();
  const planeBytes = r.readUInt32();
  const pmTable = r.readUInt32();
  const pmReserved = r.readUInt32();

  return {
    baseAddr, rowBytes, isPixMap, bounds,
    pmVersion, packType, packSize,
    hRes, vRes,
    pixelType, pixelSize, cmpCount, cmpSize,
    planeBytes, pmTable, pmReserved,
    width: bounds.right - bounds.left,
    height: bounds.bottom - bounds.top,
  };
}

/**
 * Parse a BitMap header (14 bytes): baseAddr(4) rowBytes(2) bounds(8).
 */
export function readBitMap(r) {
  const baseAddr = r.readUInt32();
  const rowBytes = r.readUInt16();
  const bounds = readRect(r);
  return {
    baseAddr, rowBytes, bounds,
    width: bounds.right - bounds.left,
    height: bounds.bottom - bounds.top,
  };
}

/** Rect: top, left, bottom, right as Int16. */
export function readRect(r) {
  const top = r.readInt16();
  const left = r.readInt16();
  const bottom = r.readInt16();
  const right = r.readInt16();
  return { top, left, bottom, right };
}

/**
 * Parse a ColorTable: ctSeed(4) ctFlags(2) ctSize(2) then (ctSize+1) ColorSpecs.
 * Each ColorSpec is value(2) + RGB(2+2+2). Returns {seed, flags, entries: Array<{value, r, g, b}>}.
 * RGB components are 16-bit; we keep them as-is and let callers downsample.
 */
export function readColorTable(r) {
  const seed = r.readUInt32();
  const flags = r.readUInt16();
  const ctSize = r.readInt16(); // "last index", so entry count = ctSize + 1
  const count = ctSize + 1;
  const entries = [];
  for (let i = 0; i < count; i++) {
    const value = r.readUInt16();
    const red = r.readUInt16();
    const green = r.readUInt16();
    const blue = r.readUInt16();
    entries.push({ value, r: red, g: green, b: blue });
  }
  return { seed, flags, ctSize, count, entries };
}

/**
 * Expand packed indexed pixel data into a flat array of indices.
 *
 *  - 1 bpp: 1 bit per pixel, MSB-first within each byte
 *  - 2 bpp: 4 pixels per byte
 *  - 4 bpp: 2 pixels per byte
 *  - 8 bpp: 1 pixel per byte (no unpacking)
 *
 * rowBytes is the BYTES per row (often more than width*pixelSize/8 due to
 * 16-bit alignment). We honor it during decoding.
 */
export function expandIndexedPixels(packed, width, height, pixelSize, rowBytes) {
  const out = new Uint8Array(width * height);
  // One loop per depth: the sample position and shift are constants of the
  // depth, so nothing depth-dependent is decided per pixel. An unsupported
  // depth is reported only when there is a first pixel to decode, as before.
  if (pixelSize === 8) {
    for (let y = 0; y < height; y++) {
      const rowStart = y * rowBytes, rowOut = y * width;
      for (let x = 0; x < width; x++) out[rowOut + x] = packed[rowStart + x];
    }
  } else if (pixelSize === 4) {
    for (let y = 0; y < height; y++) {
      const rowStart = y * rowBytes, rowOut = y * width;
      for (let x = 0; x < width; x++) out[rowOut + x] = (packed[rowStart + (x >> 1)] >> ((1 - (x & 1)) << 2)) & 15;
    }
  } else if (pixelSize === 2) {
    for (let y = 0; y < height; y++) {
      const rowStart = y * rowBytes, rowOut = y * width;
      for (let x = 0; x < width; x++) out[rowOut + x] = (packed[rowStart + (x >> 2)] >> ((3 - (x & 3)) << 1)) & 3;
    }
  } else if (pixelSize === 1) {
    for (let y = 0; y < height; y++) {
      const rowStart = y * rowBytes, rowOut = y * width;
      for (let x = 0; x < width; x++) out[rowOut + x] = (packed[rowStart + (x >> 3)] >> (7 - (x & 7))) & 1; // leftmost sample first
    }
  } else if (0 < height && 0 < width) throw new Error(`Unsupported pixelSize: ${pixelSize}`);
  return out;
}

/**
 * Expand a 1-bit mask bitmap into a per-pixel 0/255 alpha array.
 * Same row-byte alignment story as expandIndexedPixels.
 */
export function expandMask(packed, width, height, rowBytes) {
  const out = expandIndexedPixels(packed, width, height, 1, rowBytes);
  for (let i = 0; i < out.length; i++) out[i] *= 255;
  return out;
}

/** Expand ordinary indexed art, retaining per-pixel mask observation order. */
export function expandIndexedRgba(indices, rgba, colorTable, realizeRgb16, missingMessage, width, height, mask, maskAlpha) {
  // Bit15 selects positional entries; otherwise use the first matching value.
  const palette = new Map();
  colorTable.entries.forEach((entry, position) => {
    const index = colorTable.flags & 0x8000 ? position : entry.value;
    if (!palette.has(index)) palette.set(index, [entry.r, entry.g, entry.b]);
  });
  // Byte indices into byte output (every decoder call site): the color of each
  // distinct index is resolved at its first occurrence in raster order, exactly
  // as below, then replayed from a 256-entry byte table. Anything else, including
  // rasters shorter than width*height, keeps the general keyed path.
  if (!(indices instanceof Uint8Array && rgba instanceof Uint8Array
      && Number.isInteger(width) && Number.isInteger(height) && indices.length >= width * height)) {
    return expandKeyedRgba(indices, rgba, palette, realizeRgb16, missingMessage, width, height, mask, maskAlpha);
  }
  const known = new Uint8Array(256), table = new Uint8Array(768);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = y * width + x;
    const index = indices[i];
    const entry = index * 3;
    if (!known[index]) {
      if (realizeRgb16 && !palette.has(index)) throw new DisplayProfileError(missingMessage, 'UNSUPPORTED_SOURCE_COLOR');
      const raw = palette.get(index) ?? [0, 0, 0];
      const rgb = realizeRgb16 ? realizeRgb16(raw) : raw.map(value => value >> 8);
      const [r, g, b] = rgb;
      table[entry] = r;
      table[entry + 1] = g;
      table[entry + 2] = b;
      // A falsy result was never remembered: its index is realized again.
      if (rgb) known[index] = 1;
    }
    const offset = i * 4;
    rgba[offset] = table[entry];
    rgba[offset + 1] = table[entry + 1];
    rgba[offset + 2] = table[entry + 2];
    rgba[offset + 3] = mask ? (x < mask.width && y < mask.height ? maskAlpha[y * mask.width + x] : 255) : 255;
  }
  return rgba;
}

/** General path: any index value, any output container. */
function expandKeyedRgba(indices, rgba, palette, realizeRgb16, missingMessage, width, height, mask, maskAlpha) {
  const realized = new Map();
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = y * width + x;
    const index = indices[i];
    let rgb = realized.get(index);
    if (!rgb) {
      if (realizeRgb16 && !palette.has(index)) throw new DisplayProfileError(missingMessage, 'UNSUPPORTED_SOURCE_COLOR');
      const raw = palette.get(index) ?? [0, 0, 0];
      rgb = realizeRgb16 ? realizeRgb16(raw) : raw.map(value => value >> 8);
      realized.set(index, rgb);
    }
    const [r, g, b] = rgb;
    const offset = i * 4;
    rgba[offset] = r;
    rgba[offset + 1] = g;
    rgba[offset + 2] = b;
    rgba[offset + 3] = mask ? (x < mask.width && y < mask.height ? maskAlpha[y * mask.width + x] : 255) : 255;
  }
  return rgba;
}
