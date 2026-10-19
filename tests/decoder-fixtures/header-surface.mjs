// Hand-encoded diagnostic input; no production decoder/compositor generates
// these bytes or the literal expected rows. PACH130 full-color solid subset
// only. Initial caller/model review pending under #292.
export const headerSourceRows = [
  '.aTQ.bc',
  'dE...FG',
  'L..@..R',
  '.......',
  '.......',
  'hI...JK',
  'lmB..no',
];
// T is a masked first-column band sample; Q is an opaque adjacent sample that
// a whole-band stretch would incorrectly consume. @ retains hidden raw RGB16.
export const headerMaskedPoints = [[2, 0], [3, 2]];
// Literal marker palette under the documented high-byte/display policy. The
// expected values were computed independently as round(255*(v/255)^(1.8/2.2)),
// not read back from the runtime. This is a geometry transport convention, not
// evidence of original device/palette RGB.
const rawColors = {
  '@': [33, 33, 33],
  'a': [255, 0, 0],
  'b': [0, 255, 0],
  'c': [0, 0, 255],
  'd': [0, 255, 255],
  'E': [255, 0, 255],
  'F': [255, 255, 0],
  'G': [255, 255, 255],
  'h': [0, 0, 0],
  'I': [80, 160, 240],
  'J': [40, 120, 200],
  'K': [180, 60, 100],
  'l': [210, 30, 90],
  'm': [30, 210, 90],
  'n': [90, 30, 210],
  'o': [180, 210, 30],
  'T': [70, 110, 150],
  'Q': [150, 110, 70],
  'B': [100, 200, 50],
  'L': [50, 100, 200],
  'R': [200, 50, 100],
};
export const headerColors = {
  '@': [48, 48, 48],
  'a': [255, 0, 0],
  'b': [0, 255, 0],
  'c': [0, 0, 255],
  'd': [0, 255, 255],
  'E': [255, 0, 255],
  'F': [255, 255, 0],
  'G': [255, 255, 255],
  'h': [0, 0, 0],
  'I': [99, 174, 243],
  'J': [56, 138, 209],
  'K': [192, 78, 119],
  'l': [218, 44, 109],
  'm': [44, 218, 109],
  'n': [109, 44, 218],
  'o': [192, 218, 44],
  'T': [89, 128, 165],
  'Q': [165, 128, 89],
  'B': [119, 209, 67],
  'L': [67, 119, 209],
  'R': [209, 67, 119],
};
export const headerInactiveColors = { ...headerColors, a: [32, 226, 243] };
export function headerSurfaceIcon({ inactive = false } = {}) {
  const colors = inactive ? { ...rawColors, a: [20, 220, 240] } : rawColors;
  const symbols = Object.keys(headerColors), table = 89;
  const pixels = table + 8 + symbols.length * 8;
  const bytes = new Uint8Array(pixels + 56), view = new DataView(bytes.buffer);
  const word = (offset, value) => view.setUint16(offset, value);
  word(4, 0x8008); word(10, 7); word(12, 7); word(32, 8); word(34, 1); word(36, 8);
  word(54, 1); word(60, 7); word(62, 7);
  word(table + 6, symbols.length - 1);
  symbols.forEach((symbol, i) => {
    word(table + 8 + i * 8, i);
    const rgb = colors[symbol];
    rgb.forEach((channel, c) => word(table + 10 + i * 8 + c * 2, channel * 257));
  });
  headerSourceRows.forEach((row, y) => [...row].forEach((symbol, x) => {
    bytes[pixels + y * 8 + x] = symbol === '.' ? 0 : symbols.indexOf(symbol);
    if (symbol !== '.' && !headerMaskedPoints.some(([mx, my]) => mx === x && my === y)) bytes[82 + y] |= 0x80 >>> x;
  }));
  return bytes;
}
export function headerSurfaceInfo() {
  const bytes = new Uint8Array(18), view = new DataView(bytes.buffer);
  bytes[0] = 2; bytes[1] = 1; // c2, s1, repeat=false, mode0, request ID0.
  view.setInt16(6, 2); view.setInt16(8, 3); // BG x3/y2, masked raw gray.
  return bytes;
}
// Required caller Rect11x16. For c2/s1, body rows1/14 cover x2..8;
// rows2..13 cover x1..9. Corners use2x2, bands use1px. No label/font layer.
export const windowHeaderRows = [
  '.a.......bc',
  'dE@@@@@@@FG',
  'L@@@@@@@@@R',
  'L@@@@@@@@@R',
  'L@@@@@@@@@R',
  'L@@@@@@@@@R',
  'L@@@@@@@@@R',
  'L@@@@@@@@@R',
  'L@@@@@@@@@R',
  'L@@@@@@@@@R',
  'L@@@@@@@@@R',
  'L@@@@@@@@@R',
  'L@@@@@@@@@R',
  'L@@@@@@@@@R',
  'hI@@@@@@@JK',
  'lmBBBBBBBno',
];
// Painter height17, original-height16 clip: lower corners start at15;
// the bottommost source row is outside the caller's clip, not deleted afterward.
export const listViewHeaderRows = [
  '.a.......bc',
  'dE@@@@@@@FG',
  'L@@@@@@@@@R',
  'L@@@@@@@@@R',
  'L@@@@@@@@@R',
  'L@@@@@@@@@R',
  'L@@@@@@@@@R',
  'L@@@@@@@@@R',
  'L@@@@@@@@@R',
  'L@@@@@@@@@R',
  'L@@@@@@@@@R',
  'L@@@@@@@@@R',
  'L@@@@@@@@@R',
  'L@@@@@@@@@R',
  'L@@@@@@@@@R',
  'hI@@@@@@@JK',
];
// Original port Rect(10,20,11,16), clip(10,20,6,15): right half and last
// requested row are excluded. Literal rows distinguish extension-before-clip.
export const clippedWindowHeaderRows = [
  '.a.........',
  'dE@@@@.....',
  'L@@@@@.....',
  'L@@@@@.....',
  'L@@@@@.....',
  'L@@@@@.....',
  'L@@@@@.....',
  'L@@@@@.....',
  'L@@@@@.....',
  'L@@@@@.....',
  'L@@@@@.....',
  'L@@@@@.....',
  'L@@@@@.....',
  'L@@@@@.....',
  'hI@@@@.....',
  '...........',
];
export const clippedListViewHeaderRows = [
  '.a.........',
  'dE@@@@.....',
  'L@@@@@.....',
  'L@@@@@.....',
  'L@@@@@.....',
  'L@@@@@.....',
  'L@@@@@.....',
  'L@@@@@.....',
  'L@@@@@.....',
  'L@@@@@.....',
  'L@@@@@.....',
  'L@@@@@.....',
  'L@@@@@.....',
  'L@@@@@.....',
  'L@@@@@.....',
  '...........',
];

// Second independently written experiment: c2/s3, full repeat, 11x9 source.
// Bands overlap the body/corners. The 19x13 destination has partial final tiles
// (horizontal7+7+1, vertical5+4). @ is hidden raw gray, not an opaque source fill.
export const headerOverlapSourceRows = [
  'aaTTTTTTTbb', 'ccUUUUUUUdd', 'XY.aB.cDZQR', 'LMN.....OPQ', 'RST..@..UVW',
  'xyz.....123', '456.....789', 'efJJJJJJJgh', 'ijKKKKKKKkl',
];
const overlapSymbols = 'aTbcUdXYBDZQRLMNOPSVWxyz123456789efJghijKkl';
// Independent literal high-byte/LUT values; no production transform imported.
const overlapRed = [3,13,22,30,38,45,53,59,66,73,79,85,92,98,104,110,116,121,127,133,139,144,150,155,161,166,171,177,182,187,193,198,203,208,213,218,223,229,234,239,243,248,253];
export const headerOverlapColors = Object.fromEntries([...overlapSymbols].map((symbol, i) => [symbol, [overlapRed[i], 0, 255]]));
headerOverlapColors['@'] = [48, 48, 48];
export function headerOverlapIcon() {
  const symbols = overlapSymbols + '@', table = 100, pixels = table + 8 + symbols.length * 8;
  const bytes = new Uint8Array(pixels + 108), view = new DataView(bytes.buffer);
  const word = (offset, value) => view.setUint16(offset, value);
  word(4, 0x800c); word(10, 9); word(12, 11); word(32, 8); word(34, 1); word(36, 8);
  word(54, 2); word(60, 9); word(62, 11); word(table + 6, symbols.length - 1);
  [...symbols].forEach((symbol, i) => {
    word(table + 8 + i * 8, i);
    (symbol === '@' ? [33,33,33] : [i * 6 + 1,0,255]).forEach((v, c) => word(table + 10 + i * 8 + c * 2, v * 257));
  });
  headerOverlapSourceRows.forEach((row, y) => [...row].forEach((symbol, x) => {
    bytes[pixels + y * 12 + x] = symbol === '.' ? 0 : symbols.indexOf(symbol);
    if (symbol !== '.' && symbol !== '@') bytes[82 + y * 2 + (x >>> 3)] |= 0x80 >>> (x & 7);
  }));
  return bytes;
}
export function headerOverlapInfo() {
  const bytes = new Uint8Array(18), view = new DataView(bytes.buffer);
  bytes[0] = 2; bytes[1] = 3; bytes[2] = 1;
  view.setInt16(6, 4); view.setInt16(8, 5);
  return bytes;
}
export const headerOverlapWindowRows = [
  'aaTTTTTTTTTTTTTTTbb', 'ccUUUUUUUUUUUUUUUdd', 'XY.aB@cDZ@aB@cDZZQR',
  'LMN@@@@@@@@@@@@@OPQ', 'RST@@@@@@@@@@@@@UVW', 'xyz@@@@@@@@@@@@@123',
  '456@@@@@@@@@@@@@789', 'XY@@@@@@@@@@@@@@ZQR', 'LMN@@@@@@@@@@@@@OPQ',
  'RST@@@@@@@@@@@@@UVW', 'xyz@@@@@76@@@@@7123', 'efJJJJJJJJJJJJJJJgh',
  'ijKKKKKKKKKKKKKKKkl',
];
export const headerOverlapListRows = [
  'aaTTTTTTTTTTTTTTTbb', 'ccUUUUUUUUUUUUUUUdd', 'XY.aB@cDZ@aB@cDZZQR',
  'LMN@@@@@@@@@@@@@OPQ', 'RST@@@@@@@@@@@@@UVW', 'xyz@@@@@@@@@@@@@123',
  '456@@@@@@@@@@@@@789', 'XY@@@@@@@@@@@@@@ZQR', 'LMN@@@@@@@@@@@@@OPQ',
  'RST@@@@@@@@@@@@@UVW', 'xyz@@@@@@@@@@@@@123', '456@@@@@76@@@@@7789',
  'efJJJJJJJJJJJJJJJgh',
];
// Clip local x5..12/y2..10 through the repeated bands. Sampling must retain the
// original region phase; restarting the top tile at the clip gives other labels.
export const headerOverlapClippedWindowRows = [
  '...................', '...................', '.....@cDZ@aB@......',
  '.....@@@@@@@@......', '.....@@@@@@@@......', '.....@@@@@@@@......',
  '.....@@@@@@@@......', '.....@@@@@@@@......', '.....@@@@@@@@......',
  '.....@@@@@@@@......', '.....@@@76@@@......', '...................',
  '...................',
];
export const headerOverlapClippedListRows = [
  '...................', '...................', '.....@cDZ@aB@......',
  '.....@@@@@@@@......', '.....@@@@@@@@......', '.....@@@@@@@@......',
  '.....@@@@@@@@......', '.....@@@@@@@@......', '.....@@@@@@@@......',
  '.....@@@@@@@@......', '.....@@@@@@@@......', '...................',
  '...................',
];

// Independent palette collision from the reviewed source-bound sampler probe:
// 7x7, bit15 positional raster, index0 is red but reverse ColorSpec.value0 is
// gray. Only (3,0)/(0,3) are opaque. c3/s1 has1px middle even with tile=true.
// SHA256 ae6a14ab40e4f69489f9444084133376abe2ff5872c3f82c4fa0e56290831231.
export function headerSamplingCollisionIcon() {
  const hex = '000000008008000000000007000700000000000000000000000000000000000000080001000800000000000000000000000000000000000100000000000700070000000000000000000000000000000000001000008000000000000000800000020007ffff000000000000212121212121000300000000ffff0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000';
  return Uint8Array.from(hex.match(/../g), byte => Number.parseInt(byte,16));
}

// PACH one-pixel sampler for the unchanged 7x7 collision source, c3/s1,
// ordinary 11x16 header. Only source (3,0) and (0,3) have mask bits.
// The five-pixel horizontal line and ten-pixel vertical line are gray48;
// masked holes preserve gray48 solid union. No decoded red is painted.
export const headerCollisionSampledRows = [
  '...@@@@@...',
  '...@@@@@...',
  '...@@@@@...',
  '@@@@@@@@@@.',
  '@@@@@@@@@@.',
  '@@@@@@@@@@.',
  '@@@@@@@@@@.',
  '@@@@@@@@@@.',
  '@@@@@@@@@@.',
  '@@@@@@@@@@.',
  '@@@@@@@@@@.',
  '@@@@@@@@@@.',
  '@@@@@@@@@@.',
  '...@@@@@...',
  '...@@@@@...',
  '...........',
];
