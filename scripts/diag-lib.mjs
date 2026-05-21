// Shared helpers for the headless diagnostic tools (render + audit):
// a minimal PNG codec, cicn→PixelBuffer loading, and window-type resolution.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { inflateSync, deflateSync } from 'node:zlib';
import { PixelBuffer } from '../dist/aaron-ui.js';

function paeth(a, b, c) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); return pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }

/** Decode an 8-bit PNG (color types 6=RGBA, 2=RGB, 0=gray) → {width,height,rgba}. */
export function decodePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG');
  let p = 8, width = 0, height = 0, bitDepth = 8, colorType = 6;
  const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p); const type = buf.toString('latin1', p + 4, p + 8); const data = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') { width = data.readUInt32BE(0); height = data.readUInt32BE(4); bitDepth = data[8]; colorType = data[9]; }
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    p += 12 + len;
  }
  if (bitDepth !== 8) throw new Error(`unsupported bit depth ${bitDepth}`);
  const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : colorType === 0 ? 1 : 0;
  if (!channels) throw new Error(`unsupported color type ${colorType}`);
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const out = new Uint8ClampedArray(width * height * 4);
  const prev = new Uint8Array(stride); const cur = new Uint8Array(stride);
  let rp = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[rp++];
    for (let x = 0; x < stride; x++) cur[x] = raw[rp++];
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? cur[x - channels] : 0;
      const b = prev[x]; const c = x >= channels ? prev[x - channels] : 0;
      let v = cur[x];
      if (filter === 1) v += a; else if (filter === 2) v += b; else if (filter === 3) v += (a + b) >> 1; else if (filter === 4) v += paeth(a, b, c);
      cur[x] = v & 0xff;
    }
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4; const s = x * channels;
      if (channels === 4) { out[o] = cur[s]; out[o + 1] = cur[s + 1]; out[o + 2] = cur[s + 2]; out[o + 3] = cur[s + 3]; }
      else if (channels === 3) { out[o] = cur[s]; out[o + 1] = cur[s + 1]; out[o + 2] = cur[s + 2]; out[o + 3] = 255; }
      else { out[o] = out[o + 1] = out[o + 2] = cur[s]; out[o + 3] = 255; }
    }
    prev.set(cur);
  }
  return { width, height, rgba: out };
}

const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return (b) => { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = t[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }; })();
function chunk(type, data) { const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0); const body = Buffer.concat([Buffer.from(type, 'latin1'), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(CRC(body), 0); return Buffer.concat([len, body, crc]); }
/** Encode an RGBA buffer → PNG bytes. */
export function encodePng(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 6;
  const stride = width * 4; const rawb = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) { rawb[y * (stride + 1)] = 0; Buffer.from(rgba.buffer, rgba.byteOffset + y * stride, stride).copy(rawb, y * (stride + 1) + 1); }
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(rawb, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

/** Load a theme's cicn PNG (relative path from theme.json) into a PixelBuffer. */
export function loadCicn(themeDir, asset) {
  const { width, height, rgba } = decodePng(readFileSync(resolve(themeDir, asset)));
  return new PixelBuffer(width, height, rgba);
}

/** Resolve a window type by key, else the document window, else the first with
 *  a renderable active chrome + top recipe. Returns {key, wt} or null. */
export function resolveWindow(manifest, key) {
  const wts = manifest.windowTypes || {};
  if (key) return wts[key] ? { key, wt: wts[key] } : null;
  if (wts['document-window']?.chrome?.active) return { key: 'document-window', wt: wts['document-window'] };
  const e = Object.entries(wts).find(([, w]) => w.edges?.top?.length && w.chrome?.active);
  return e ? { key: e[0], wt: e[1] } : null;
}
