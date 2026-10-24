// Independently hand-encoded sparse/duplicate ColorSpec fixture, CDEF8 C4/C5.
// Raster lookup explicitly uses ctFlags bit15 positions; sampler positional-match/reverse-value search
// gives different RGB. No renderer or loader is used to generate these bytes.
export function sparseTabCicn() {
  const w = 7, h = 5, maskBytes = h, bitmapBytes = h;
  const table = 82 + maskBytes + bitmapBytes, pixels = table + 8 + 4 * 8;
  const bytes = new Uint8Array(pixels + w * h), view = new DataView(bytes.buffer);
  view.setUint16(4, 0x8000 | w); view.setUint16(10, h); view.setUint16(12, w);
  view.setUint16(32, 8); view.setUint16(34, 1); view.setUint16(36, 8);
  for (const offset of [50, 64]) { view.setUint16(offset + 4, 1); view.setUint16(offset + 10, h); view.setUint16(offset + 12, w); }
  bytes.fill(0xfe, 82, 82 + maskBytes);
  // Explicit bit15 makes ordinary decoder position-keyed; CDEF8 C5 ignores it.
  view.setUint16(table + 4, 0x8000); view.setUint16(table + 6, 3);
  const entries = [[9, 65535, 0, 0], [7, 0, 65535, 0], [1, 0, 0, 65535], [7, 65535, 65535, 0]];
  entries.forEach((entry, i) => entry.forEach((v, j) => view.setUint16(table + 8 + i * 8 + j * 2, v)));
  // Caps index1 => decoded green; source top/bottom middle1/7 => sampled
  // blue/yellow. Background point(3,2) index2 has no value match => entry0 red.
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) bytes[pixels + y * w + x] = x === 0 || x === w - 1 ? 1 : y === 0 ? 1 : y === h - 1 ? 7 : 2;
  return bytes;
}
export const SPARSE_TAB_CINF = [1, 1, 0, 0, 0, 0, 0, 2, 0, 3, 0, 2, 0, 3, 0, 2, 0, 3];
export const SPARSE_TAB_COLORS = { A: [255, 0, 0, 255], B: [0, 255, 0, 255], C: [0, 0, 255, 255], D: [255, 255, 0, 255] };
export const SPARSE_TAB_ROWS = ['BCCCCCCB', 'BAAAAAAB', 'BAAAAAAB', 'BAAAAAAB', 'BDDDDDDB'];
