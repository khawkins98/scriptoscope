import { inflateSync } from 'node:zlib';

/** Mechanical PNG integrity only: this does not identify the producing renderer. */
export function inspectPNG(bytes) {
  const check = (ok, reason) => { if (!ok) throw new Error(`PNG: ${reason}`); };
  check(bytes.length >= 45 && bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')), 'invalid signature/envelope');
  const crc32 = data => { let crc = -1; for (const byte of data) { crc ^= byte; for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1)); } return (crc ^ -1) >>> 0; };
  let offset = 8, header, ended = false, palette = false;
  const compressed = [];
  while (offset < bytes.length) {
    check(offset + 12 <= bytes.length, 'truncated chunk');
    const length = bytes.readUInt32BE(offset), end = offset + 12 + length;
    check(end <= bytes.length, 'truncated chunk data');
    const type = bytes.subarray(offset + 4, offset + 8).toString(), data = bytes.subarray(offset + 8, end - 4);
    check(crc32(bytes.subarray(offset + 4, end - 4)) === bytes.readUInt32BE(end - 4), `bad ${type} checksum`);
    if (type === 'IHDR') {
      check(!header && offset === 8 && length === 13, 'invalid/duplicate IHDR');
      header = { width: data.readUInt32BE(0), height: data.readUInt32BE(4), bits: data[8], color: data[9], interlace: data[12] };
      check(data[10] === 0 && data[11] === 0 && header.interlace <= 1, 'unsupported encoding');
    } else {
      check(header, 'missing initial IHDR');
      check(['IDAT', 'PLTE', 'IEND'].includes(type) || /^[a-z]/.test(type), `unknown critical chunk ${type}`);
      if (type === 'IDAT') compressed.push(data);
      if (type === 'PLTE') { check(length > 0 && length <= 768 && length % 3 === 0, 'invalid palette'); palette = true; }
      if (type === 'IEND') { check(length === 0 && end === bytes.length, 'invalid end/trailing bytes'); ended = true; }
    }
    offset = end;
  }
  check(header && ended && compressed.length > 0, 'missing image/header/end');
  const { width, height, bits, color, interlace } = header;
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[color];
  const depths = { 0: [1, 2, 4, 8, 16], 2: [8, 16], 3: [1, 2, 4, 8], 4: [8, 16], 6: [8, 16] };
  check(width > 0 && height > 0 && depths[color]?.includes(bits), 'invalid size/color depth');
  check(color !== 3 || palette, 'indexed image has no palette');
  const passes = interlace ? [[0, 0, 8, 8], [4, 0, 8, 8], [0, 4, 4, 8], [2, 0, 4, 4], [0, 2, 2, 4], [1, 0, 2, 2], [0, 1, 1, 2]] : [[0, 0, 1, 1]];
  const rows = passes.map(([x, y, dx, dy]) => {
    const w = Math.max(0, Math.ceil((width - x) / dx)), h = Math.max(0, Math.ceil((height - y) / dy));
    return { count: w ? h : 0, stride: 1 + Math.ceil(w * channels * bits / 8) };
  });
  const size = rows.reduce((sum, row) => sum + row.count * row.stride, 0);
  check(size > 0 && size <= 40 * 1024 * 1024, 'decoded image exceeds intake limit');
  const raw = inflateSync(Buffer.concat(compressed), { maxOutputLength: size });
  check(raw.length === size, 'decoded scanline size mismatch');
  let cursor = 0;
  for (const row of rows) for (let i = 0; i < row.count; i++) { check(raw[cursor] <= 4, 'invalid scanline filter'); cursor += row.stride; }
  return { width, height };
}
