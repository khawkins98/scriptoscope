// Hand-built byte inputs, not renderer-derived fixtures. These establish input
// identity/occurrence joins only; decoder pixel correctness is separate work.
export function onePixelCicn(red = 0xffff) {
  // PixMap50 + mask14 + bitmap14 + handle4 + mask1 + bitmap1 + table16 + pixel1.
  const bytes = new Uint8Array(101), v = new DataView(bytes.buffer);
  v.setUint16(4, 0x8001); v.setUint16(10, 1); v.setUint16(12, 1);
  v.setUint16(32, 8); v.setUint16(34, 1); v.setUint16(36, 8);
  for (const offset of [50, 64]) { v.setUint16(offset + 4, 1); v.setUint16(offset + 10, 1); v.setUint16(offset + 12, 1); }
  bytes[82] = 0x80; // opaque pixel
  v.setUint16(94, red); // table starts84; one entry starts92, red at94
  return bytes;
}
export const cinf = () => new Uint8Array([1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
export function forkOf(resources) {
  // Intentionally permit repeated type/ID occurrences. One type-list entry per
  // resource exercises parser occurrence identity, including duplicate IDs.
  const dataLength = resources.reduce((n, r) => n + 4 + r.data.length, 0);
  const namesOffset = 30 + resources.length * 20;
  const mapOffset = 16 + dataLength, mapLength = namesOffset + resources.reduce((n, r) => n + (r.name ? 1 + r.name.length : 0), 0);
  const bytes = new Uint8Array(mapOffset + mapLength), view = new DataView(bytes.buffer);
  [16, mapOffset, dataLength, mapLength].forEach((n, i) => view.setUint32(i * 4, n));
  view.setUint16(mapOffset + 24, 28); view.setUint16(mapOffset + 26, namesOffset);
  const types = mapOffset + 28; view.setUint16(types, resources.length - 1);
  let dataOffset = 0, nameOffset = 0;
  resources.forEach((r, i) => {
    const type = types + 2 + i * 8, refOffset = 2 + resources.length * 8 + i * 12;
    bytes.set([...r.type].map(c => c.charCodeAt(0)), type); view.setUint16(type + 6, refOffset);
    const ref = types + refOffset; view.setInt16(ref, r.id); view.setUint16(ref + 2, r.name ? nameOffset : 0xffff);
    if (r.name) { bytes[mapOffset + namesOffset + nameOffset++] = r.name.length; bytes.set([...r.name].map(c => c.charCodeAt(0)), mapOffset + namesOffset + nameOffset); nameOffset += r.name.length; }
    bytes[ref + 5] = dataOffset >>> 16; bytes[ref + 6] = dataOffset >>> 8; bytes[ref + 7] = dataOffset;
    view.setUint32(16 + dataOffset, r.data.length); bytes.set(r.data, 20 + dataOffset); dataOffset += 4 + r.data.length;
  });
  return bytes;
}
export const faceFork = (red = 0xffff) => forkOf([
  { type: 'cicn', id: -10239, data: onePixelCicn(red) },
  { type: 'cinf', id: -10239, data: cinf() },
]);
function crc16(bytes) {
  let crc = 0;
  for (const byte of bytes) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? (crc >>> 1) ^ 0xa001 : crc >>> 1; }
  return crc;
}
export function stuffIt(entries) {
  // Classic SIT: 22-byte archive header, 112-byte entry header, stored resource
  // fork (method0), empty data fork. CRC16 uses the documented reflected8005.
  const bytes = new Uint8Array(22 + entries.reduce((n, e) => n + 112 + e.bytes.length, 0));
  const v = new DataView(bytes.buffer), ascii = (offset, s) => bytes.set([...s].map(c => c.charCodeAt(0)), offset);
  ascii(0, 'SIT!'); v.setUint16(4, entries.length); v.setUint32(6, bytes.length); ascii(10, 'rLau'); bytes[14] = 1;
  let offset = 22;
  for (const entry of entries) {
    bytes[offset + 2] = entry.name.length; ascii(offset + 3, entry.name);
    ascii(offset + 66, 'Colr'); ascii(offset + 70, 'Acid');
    v.setUint32(offset + 84, entry.bytes.length); v.setUint32(offset + 92, entry.bytes.length);
    v.setUint16(offset + 100, crc16(entry.bytes)); v.setUint16(offset + 110, crc16(bytes.subarray(offset, offset + 110)));
    bytes.set(entry.bytes, offset + 112); offset += 112 + entry.bytes.length;
  }
  return bytes;
}
