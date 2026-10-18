// Independently hand-encoded serialized cicn/cinf fixtures. No production
// encoder, palette search, gamma or renderer computes these input bytes.
export function colorIcon({ entries = [[0, 0xeeee, 0xeeee, 0xeeee], [1, 0x2121, 0x2121, 0x2121]],
  pixels = [0, 1, 0, 1, 1, 0, 1, 0], mask = [0, 0], flags = 0, origin = 7 } = {}) {
  const bytes = new Uint8Array(92 + entries.length * 8 + 8), view = new DataView(bytes.buffer);
  const word = (offset, value) => view.setUint16(offset, value);
  word(4, 0x8004); word(6, origin); word(8, origin); word(10, origin + 2); word(12, origin + 4);
  word(32, 8); word(34, 1); word(36, 8);
  word(54, 1); word(60, 2); word(62, 4); // mask; NIL monochrome bitmap
  bytes.set(mask, 82);
  word(88, flags); word(90, entries.length - 1);
  entries.forEach(([value, r, g, b], i) => {
    [value, r, g, b].forEach((n, j) => word(92 + i * 8 + j * 2, n));
  });
  bytes.set(pixels, 92 + entries.length * 8);
  return bytes;
}

export function colorInfo({ background = [0, 0], text = [1, 0], emboss = [0, 0] } = {}) {
  const bytes = new Uint8Array(18), view = new DataView(bytes.buffer);
  bytes[0] = 1; bytes[1] = 1;
  for (const [offset, [x, y]] of [[6, background], [10, text], [14, emboss]]) {
    view.setInt16(offset, y); view.setInt16(offset + 2, x);
  }
  return bytes;
}
