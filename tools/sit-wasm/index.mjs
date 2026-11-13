// JS wrapper over the munbox WASM decoder. Bytes in → forks out, in the browser or Node.
// Keeps the conversion core (convert.js/containers.js) PURE: this WASM-bearing module is
// imported lazily, only when a .sit is actually dropped.
import createMunbox from './dist/munbox.mjs';

// One WASM instance is shared across calls (the first call pays the instantiation cost) and
// is replaced when it can no longer be trusted or has grown; see createDecoder. Every
// instance, replacements included, comes from this one factory call. It silences munbox's
// stdout debug chatter ("Detected format: …", "SIT5: created file …"), which would spam the
// browser console. Real errors surface via sit_error(), not stdout; stderr (genuine warnings)
// is left intact.
const createModule = () => createMunbox({ print: () => {} });

const readU32 = (h, o) => (h[o] | (h[o + 1] << 8) | (h[o + 2] << 16) | (h[o + 3] << 24)) >>> 0;

// Builds a decodeArchive around one shared instance obtained from `create`.
//
// The instance is retired, so the next call instantiates a fresh one, in two cases:
// - A call into it threw (a runtime abort or a WebAssembly trap). Nothing inside it was
//   unwound or freed and its heap may be damaged. The caller gets that error unchanged.
// - Its linear memory grew during a decode. The decoder does not return everything it
//   allocates and WASM memory cannot shrink, so a reused instance only gets bigger. Retiring
//   on growth means every decode starts from the initial memory size. This is checked once a
//   decode has finished, and the finished decode's result is still returned.
// Nothing is started eagerly on retirement; a replacement exists only once a call needs it.
//
// The module runs a decode synchronously, so the only place calls interleave is the wait
// for the instance. A call that waited on an instance another call has since retired waits
// for the current one instead, and `instance()` caches, so those calls share one replacement.
function createDecoder(create) {
  let current; // promise for the instance new calls use; undefined after a retirement
  const instance = () => (current ??= create());

  return async function decodeArchive(bytes) {
    let p = instance();
    let m = await p;
    while (p !== current) m = await (p = instance());
    const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);

    const sizeBefore = m.HEAPU8.length;
    let packed, failure;
    let intact = false; // true when a throw came from copying in JS, not from the instance
    try {
      const inPtr = m._malloc(u8.length || 1);
      if (!inPtr) failure = 'out of memory';
      else {
        // HEAPU8 is read fresh each time (it's reassigned on memory growth).
        try { m.HEAPU8.set(u8, inPtr); } catch (e) { m._free(inPtr); intact = true; throw e; }
        const outPtr = m._sit_decode(inPtr, u8.length);
        m._free(inPtr);
        if (!outPtr) failure = m.UTF8ToString(m._sit_error()) || 'decode failed';
        else {
          const total = readU32(m.HEAPU8, outPtr);
          // Copy out of the WASM heap before freeing.
          try { packed = m.HEAPU8.slice(outPtr, outPtr + total); } catch (e) { m._sit_free(outPtr); intact = true; throw e; }
          m._sit_free(outPtr);
        }
      }
    } catch (e) {
      if (!intact || m.HEAPU8.length > sizeBefore) current = undefined;
      throw e;
    }
    if (m.HEAPU8.length > sizeBefore) current = undefined;
    if (failure) throw new Error(`decodeArchive: ${failure}`);
    return parsePacked(packed);
  };
}

/**
 * Decode a classic-Mac archive (StuffIt `.sit`, BinHex `.hqx`, MacBinary `.bin`, Compact
 * Pro `.cpt`) into its forks.
 * @type {(bytes: Uint8Array|ArrayBuffer) => Promise<Array<{ name: string, type: number, creator: number, forkType: 0|1, bytes: Uint8Array }>>}
 *   one entry per fork; `forkType` 0 = data fork, 1 = resource fork. `type`/`creator` are Mac
 *   OSType codes packed big-endian into a u32 (e.g. 'APPL' → 0x4150504C), NOT strings — decode
 *   with `String.fromCharCode((v>>24)&255, (v>>16)&255, (v>>8)&255, v&255)` if you need the text.
 *   A non-archive input passes through as a single data fork (forkType 0).
 */
export const decodeArchive = createDecoder(createModule);

/**
 * Internal, for this package's own tests; not part of the supported API and may change or
 * go away in any release. Returns a separate `decodeArchive` with its own shared instance,
 * taken from `create` (same contract as the Emscripten factory: resolves to a module).
 * @internal
 */
export const __createDecoderForTests = createDecoder;

/**
 * Convenience for Kaleidoscope schemes: the largest non-icon resource fork
 * (schemes keep all their resources in the resource fork, data fork empty).
 * @param {Uint8Array|ArrayBuffer} bytes
 * @returns {Promise<Uint8Array>}
 */
export async function stuffItResourceFork(bytes) {
  return (await stuffItResourceForkWithSelection(bytes)).bytes;
}

/** Same selection as stuffItResourceFork, with the actual chosen entry's identity.
 * The policy is observed compatibility behavior, not an independent scheme oracle. */
export async function stuffItResourceForkWithSelection(bytes) {
  const entries = await decodeArchive(bytes);
  const rsrc = entries.map((entry, entryIndex) => ({ entry, entryIndex }))
    .filter(({ entry }) => entry.forkType === 1 && entry.bytes.length > 0 && !/(^|\/)Icon\r?$/.test(entry.name))
    .sort((a, b) => b.entry.bytes.length - a.entry.bytes.length);
  if (!rsrc.length) throw new Error('stuffItResourceFork: archive has no resource fork');
  const { entry, entryIndex } = rsrc[0];
  return { bytes: entry.bytes, selection: {
    policy: 'largest-non-icon-resource-fork', entryIndex, entryName: entry.name,
    forkType: entry.forkType, fileType: entry.type, creator: entry.creator,
  } };
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
