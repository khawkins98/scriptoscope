// JS wrapper over the munbox WASM decoder. Bytes in → forks out, in the browser or Node.
// Keeps the conversion core (convert.js/containers.js) PURE: this WASM-bearing module is
// imported lazily, only when a .sit is actually dropped.
import createMunbox from './dist/munbox.mjs';

let _modP;
// Silence munbox's stdout debug chatter ("Detected format: …", "SIT5: created file …") —
// it would spam the browser console. Real errors surface via sit_error(), not stdout;
// stderr (genuine warnings) is left intact.
const mod = () => (_modP ??= createMunbox({ print: () => {} }));

const readU32 = (h, o) => (h[o] | (h[o + 1] << 8) | (h[o + 2] << 16) | (h[o + 3] << 24)) >>> 0;

/**
 * Decode a classic-Mac archive (StuffIt `.sit`, BinHex `.hqx`, MacBinary `.bin`, Compact
 * Pro `.cpt`) into its forks.
 * @param {Uint8Array|ArrayBuffer} bytes
 * @returns {Promise<Array<{ name: string, type: number, creator: number, forkType: 0|1, bytes: Uint8Array }>>}
 *   one entry per fork; forkType 0 = data fork, 1 = resource fork.
 */
export async function decodeArchive(bytes) {
  const m = await mod();
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);

  const inPtr = m._malloc(u8.length || 1);
  m.HEAPU8.set(u8, inPtr); // HEAPU8 read fresh (it's reassigned on memory growth)
  const outPtr = m._sit_decode(inPtr, u8.length);
  m._free(inPtr);
  if (!outPtr) throw new Error(`decodeArchive: ${m.UTF8ToString(m._sit_error()) || 'decode failed'}`);

  const total = readU32(m.HEAPU8, outPtr);
  const packed = m.HEAPU8.slice(outPtr, outPtr + total); // copy out of the WASM heap before freeing
  m._sit_free(outPtr);
  return parsePacked(packed);
}

/**
 * Convenience for Kaleidoscope schemes: the resource fork of the first entry that has one
 * (schemes keep all their resources in the resource fork, data fork empty).
 * @param {Uint8Array|ArrayBuffer} bytes
 * @returns {Promise<Uint8Array>}
 */
export async function stuffItResourceFork(bytes) {
  const entries = await decodeArchive(bytes);
  // A scheme often ships in a folder alongside a custom-folder-icon file ("Icon\r") and a
  // ReadMe — each with its own little resource fork. The scheme's fork dwarfs them, so pick
  // the LARGEST resource fork, skipping the special folder-icon file.
  const rsrc = entries
    .filter((e) => e.forkType === 1 && e.bytes.length > 0 && !/(^|\/)Icon\r?$/.test(e.name))
    .sort((a, b) => b.bytes.length - a.bytes.length);
  if (!rsrc.length) throw new Error('stuffItResourceFork: archive has no resource fork');
  return rsrc[0].bytes;
}

function parsePacked(b) {
  let p = 8; // skip [u32 totalLen][u32 count]
  const count = readU32(b, 4);
  const dec = new TextDecoder();
  const out = [];
  for (let i = 0; i < count; i++) {
    const nameLen = readU32(b, p); p += 4;
    const name = dec.decode(b.subarray(p, p + nameLen)); p += nameLen;
    const type = readU32(b, p); p += 4;
    const creator = readU32(b, p); p += 4;
    const forkType = readU32(b, p); p += 4;
    const forkLen = readU32(b, p); p += 4;
    const bytes = b.slice(p, p + forkLen); p += forkLen;
    out.push({ name, type, creator, forkType, bytes });
  }
  return out;
}
