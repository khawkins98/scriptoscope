// Tiny big-endian byte writer shared by the encoders. Every classic Mac
// Toolbox field is big-endian (Inside Macintosh: Imaging With QuickDraw, ch. 4).

export class ByteWriter {
  constructor() { this.bytes = []; }
  u8(v) { this.bytes.push(v & 0xff); return this; }
  i8(v) { return this.u8(v); }
  u16(v) { this.bytes.push((v >> 8) & 0xff, v & 0xff); return this; }
  i16(v) {
    if (!Number.isInteger(v) || v < -32768 || v > 32767) throw new Error(`ByteWriter: ${v} is not int16`);
    return this.u16(v & 0xffff);
  }
  u32(v) { this.bytes.push((v >>> 24) & 0xff, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff); return this; }
  /** Rect in classic Mac order: top, left, bottom, right. */
  rect({ top, left, bottom, right }) { return this.i16(top).i16(left).i16(bottom).i16(right); }
  raw(arr) { for (const b of arr) this.bytes.push(b & 0xff); return this; }
  get length() { return this.bytes.length; }
  toUint8Array() { return Uint8Array.from(this.bytes); }
}

/** QuickDraw rows are padded to an even number of bytes. */
export function rowBytesFor(width, depth) {
  const bytes = Math.ceil((width * depth) / 8);
  return bytes + (bytes & 1);
}
