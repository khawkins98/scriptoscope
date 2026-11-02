// scripts/lib/png-decode.mjs
// Minimal PNG decoder over node:zlib, the read-side twin of png-encode.mjs.
// Used to bring sprites drawn in other tools (e.g. claude-pxl, Aseprite) into
// the authoring toolkit: decodePng → Raster.fromRgba → encodeCicn.
//
// Supports what pixel-art tools write: non-interlaced, bit depth 8 for
// grey / grey+alpha / RGB / RGBA, and bit depth 1, 2, 4 or 8 for palette
// images (with optional tRNS transparency). Anything else throws.
import { inflateSync } from 'node:zlib';

const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const CHANNELS = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }; // colour type → samples per pixel

/** @returns {{ width: number, height: number, rgba: Uint8Array }} */
export function decodePng(buf) {
  if (!SIGNATURE.every((b, i) => buf[i] === b)) throw new Error('decodePng: not a PNG file');
  let o = 8, ihdr, plte, trns;
  const idat = [];
  while (o < buf.length) {
    const len = buf.readUInt32BE(o);
    const type = buf.toString('latin1', o + 4, o + 8);
    const data = buf.subarray(o + 8, o + 8 + len);
    if (type === 'IHDR') ihdr = { width: data.readUInt32BE(0), height: data.readUInt32BE(4), depth: data[8], colorType: data[9], interlace: data[12] };
    else if (type === 'PLTE') plte = data;
    else if (type === 'tRNS') trns = data;
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    o += 12 + len;
  }
  if (!ihdr) throw new Error('decodePng: missing IHDR');
  const { width, height, depth, colorType, interlace } = ihdr;
  if (interlace) throw new Error('decodePng: interlaced PNGs are not supported; re-save without interlacing');
  if (!(colorType in CHANNELS)) throw new Error(`decodePng: unsupported colour type ${colorType}`);
  if (colorType === 3 ? ![1, 2, 4, 8].includes(depth) : depth !== 8) {
    throw new Error(`decodePng: unsupported bit depth ${depth} for colour type ${colorType}; re-save as 8-bit`);
  }
  if (colorType === 3 && !plte) throw new Error('decodePng: palette image without PLTE');

  const channels = CHANNELS[colorType];
  const bitsPerPixel = channels * depth;
  const stride = Math.ceil((width * bitsPerPixel) / 8);
  const filterStep = Math.max(1, bitsPerPixel >> 3); // bytes per complete pixel, min 1
  const raw = inflateSync(Buffer.concat(idat));
  if (raw.length < height * (stride + 1)) throw new Error('decodePng: image data is truncated');

  // Undo the per-row filters (PNG spec §9).
  const rows = new Uint8Array(height * stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const src = y * (stride + 1) + 1, dst = y * stride, up = dst - stride;
    for (let i = 0; i < stride; i++) {
      const a = i >= filterStep ? rows[dst + i - filterStep] : 0;
      const b = y > 0 ? rows[up + i] : 0;
      const c = i >= filterStep && y > 0 ? rows[up + i - filterStep] : 0;
      let pred = 0;
      if (filter === 1) pred = a;
      else if (filter === 2) pred = b;
      else if (filter === 3) pred = (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        pred = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      } else if (filter !== 0) throw new Error(`decodePng: bad filter type ${filter}`);
      rows[dst + i] = (raw[src + i] + pred) & 0xff;
    }
  }

  const rgba = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const out = (y * width + x) * 4, row = y * stride;
    if (colorType === 3) {
      const perByte = 8 / depth;
      const byte = rows[row + Math.floor(x / perByte)];
      const k = (byte >> ((perByte - 1 - (x % perByte)) * depth)) & ((1 << depth) - 1);
      rgba[out] = plte[k * 3]; rgba[out + 1] = plte[k * 3 + 1]; rgba[out + 2] = plte[k * 3 + 2];
      rgba[out + 3] = trns && k < trns.length ? trns[k] : 255;
      continue;
    }
    const s = row + x * channels;
    if (colorType === 0 || colorType === 4) {
      rgba[out] = rgba[out + 1] = rgba[out + 2] = rows[s];
      rgba[out + 3] = colorType === 4 ? rows[s + 1] : 255;
    } else {
      rgba[out] = rows[s]; rgba[out + 1] = rows[s + 1]; rgba[out + 2] = rows[s + 2];
      rgba[out + 3] = colorType === 6 ? rows[s + 3] : 255;
    }
  }
  return { width, height, rgba };
}
