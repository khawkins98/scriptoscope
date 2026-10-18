// Hand-encoded serialized source, independent of production decoding/assembly.
// One blue opaque corner; gray RGB16 beneath the central mask hole. In the
// collision variant ctFlags requests positional raster colors, while kDEF's
// separate RGB sampler searches ColorSpec.value and still obtains gray.
export function solidBackgroundIcon({ opaqueBackground = false, collision = false } = {}) {
  const entries = collision ? [[7, 0xffff, 0, 0], [0, 0x2121, 0x2121, 0x2121], [3, 0, 0, 0xffff]]
    : [[0, 0x2121, 0x2121, 0x2121], [1, 0, 0, 0xffff]];
  const table = 89, pixels = table + 8 + entries.length * 8;
  const bytes = new Uint8Array(pixels + 56), view = new DataView(bytes.buffer);
  const word = (offset, value) => view.setUint16(offset, value);
  word(4, 0x8008); word(10, 7); word(12, 7); word(32, 8); word(34, 1); word(36, 8);
  word(54, 1); word(60, 7); word(62, 7); bytes[82] = 0x80;
  if (opaqueBackground) bytes[85] = 0x10;
  word(table + 4, collision ? 0x8000 : 0); word(table + 6, entries.length - 1);
  entries.forEach((entry, i) => entry.forEach((value, channel) => word(table + 8 + i * 8 + channel * 2, value)));
  bytes[pixels] = collision ? 2 : 1;
  return bytes;
}
export function solidBackgroundInfo({ mode = 0, resourceId = 0, background = [3, 3] } = {}) {
  const bytes = new Uint8Array(18), view = new DataView(bytes.buffer);
  bytes[0] = 3; bytes[1] = 1; bytes[3] = mode; view.setInt16(4, resourceId);
  view.setInt16(6, background[1]); view.setInt16(8, background[0]);
  // Text samples the blue corner; emboss (0,0) is absent.
  return bytes;
}
export const solidBackgroundRows = [
  'B............................',
  '...GGGGGGGGGGGGGGGGGGGGGGG...',
  '...GGGGGGGGGGGGGGGGGGGGGGG...',
  '.GGGGGGGGGGGGGGGGGGGGGGGGGGG.',
  '.GGGGGGGGGGGGGGGGGGGGGGGGGGG.',
  '.GGGGGGGGGGGGGGGGGGGGGGGGGGG.',
  '...GGGGGGGGGGGGGGGGGGGGGGG...',
  '...GGGGGGGGGGGGGGGGGGGGGGG...',
  '.............................',
];
