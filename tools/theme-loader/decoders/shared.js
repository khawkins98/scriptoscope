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
  const supported = [1, 2, 4, 8].includes(pixelSize);
  const perByte = supported ? 8 / pixelSize : 0, mask = supported ? (1 << pixelSize) - 1 : 0;
  const byteShift = pixelSize === 1 ? 3 : pixelSize === 2 ? 2 : 1;
  for (let y = 0; y < height; y++) {
    const rowStart = y * rowBytes;
    for (let x = 0; x < width; x++) {
      if (!supported) throw new Error(`Unsupported pixelSize: ${pixelSize}`);
      const byte = packed[rowStart + (pixelSize === 8 ? x : x >> byteShift)];
      const shift = (perByte - 1 - (x & (perByte - 1))) * pixelSize; // leftmost sample first
      out[y * width + x] = (byte >> shift) & mask;
    }
  }
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
