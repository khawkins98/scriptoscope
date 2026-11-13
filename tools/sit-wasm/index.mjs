// JS wrapper over the munbox WASM decoder. Bytes in → forks out, in the browser or Node.
// Keeps the conversion core (convert.js/containers.js) PURE: this WASM-bearing module is
// imported lazily, only when a .sit is actually dropped.
import createMunbox from './dist/munbox.mjs';

// Options for every instantiation of the decoder, first and replacement alike. `print`
// silences munbox's stdout debug chatter ("Detected format: …", "SIT5: created file …"),
// which would spam the browser console. Real errors surface via sit_error(), not stdout;
// stderr (genuine warnings) is left intact. A custom Emscripten `locateFile` goes here.
const moduleOptions = () => ({ print: () => {} });

const readU32 = (h, o) => (h[o] | (h[o + 1] << 8) | (h[o + 2] << 16) | (h[o + 3] << 24)) >>> 0;

// After a failed replacement load, how long calls go without attempting another.
const RETRY_MS = 1000;

// Builds a decodeArchive around one shared instance made by `glue` (the Emscripten factory).
// The first call pays the instantiation cost. The instance is replaced in two cases.
//
// 1. A call into it threw (a runtime abort or a WebAssembly trap). Nothing inside it was
//    unwound or freed and its heap may be damaged, so it is never called again. The caller
//    gets that error unchanged and the next call waits for a replacement.
// 2. It outgrew its limit. WASM memory cannot shrink, so whatever one decode needed, or
//    anything the decoder failed to return, stays with a reused instance. After a decode, an
//    instance whose memory exceeds max(2 × its initial size, initial size + 3 × (input +
//    output bytes of that decode)) is marked outgrown. The second term keeps one large
//    archive from replacing the instance on every decode: decoding needs up to about
//    2 × (input + output) above the initial size. An outgrown instance is still healthy. The
//    next call starts loading its replacement and is served by the outgrown instance, as are
//    later calls, until the replacement has loaded. If that load fails or never finishes,
//    nothing is lost.
//
// Nothing is loaded ahead of need. A failed replacement is never kept, but for RETRY_MS
// after one no other is attempted: calls with no usable instance reject with that failure,
// calls with an outgrown one are served by it. Only a failure of the very first load is
// kept and returned to every later call, as it always was.
//
// Replacements do not fetch the .wasm again where that can be avoided. In a browser the glue
// starts `WebAssembly.instantiateStreaming` synchronously inside the factory call, so
// `loadDefault` swaps that function for the length of that one synchronous call (nothing
// else can run in between) to keep the compiled `WebAssembly.Module` it resolves to; the
// call itself, its arguments, its promise and its errors pass through untouched, and the
// function found there is put back. Replacements instantiate the kept module through the
// glue's `instantiateWasm` hook. If that ever fails, the module is dropped, that load falls
// back to the default way and no module is kept again. While no module is held (Node, which
// reads the file from disk; a browser that fell back from streaming; a namespace that cannot
// be assigned), every load is made the default way, swap included.
//
// The module runs a decode synchronously, so calls interleave only while waiting for an
// instance. A call that waited on an instance another call has since crashed waits for the
// current one instead; those calls share one replacement.
function createDecoder(glue) {
  let compiled; // WebAssembly.Module behind an earlier instance, when one could be captured
  let reuse = true; // false once a kept module failed to instantiate: none is kept again
  let current; // promise for the instance in service
  let outgrown; // the instance in service, once it has passed its limit
  let renewing = false; // a replacement for the outgrown instance is loading
  let everLoaded = false;
  let failedAt = -Infinity; // when the last replacement load failed (Date.now())
  let lastFailure; // and what it failed with
  const dead = new WeakSet(); // instances a call crashed
  const initialSize = new WeakMap(); // instance → linear memory bytes when first used

  // The glue's own load. Never throws: a synchronous throw from the glue becomes a rejection.
  function loadDefault() {
    const found = WebAssembly.instantiateStreaming;
    let swapped = false;
    if (reuse && typeof found === 'function') {
      try {
        WebAssembly.instantiateStreaming = function (...args) {
          const result = found.apply(this, args);
          Promise.resolve(result)
            .then((made) => { if (made.module instanceof WebAssembly.Module) compiled = made.module; })
            .catch(() => {});
          return result;
        };
        swapped = true;
      } catch { /* not writable here: every instance loads the default way */ }
    }
    try { return glue(moduleOptions()); } catch (e) { return Promise.reject(e); } finally {
      if (swapped) WebAssembly.instantiateStreaming = found;
    }
  }

  function loadFromModule(module) {
    return new Promise((resolve, reject) => {
      glue({ ...moduleOptions(), instantiateWasm(imports, receive) {
        WebAssembly.instantiate(module, imports).then((made) => receive(made, module)).catch(reject);
        return {};
      } }).then(resolve, reject);
    });
  }

  function load() {
    if (!compiled) return loadDefault();
    const module = compiled;
    return loadFromModule(module).catch(() => {
      compiled = undefined;
      reuse = false;
      return loadDefault();
    });
  }

  const failed = (e) => { failedAt = Date.now(); lastFailure = e; };
  const mayRetry = () => Date.now() - failedAt >= RETRY_MS;

  // The promise a call waits on for its instance.
  function instance() {
    if (!current) {
      if (!everLoaded) return (current = load()); // the first load: kept even if it fails
      if (!mayRetry()) return Promise.reject(lastFailure);
      const replacement = current = load();
      replacement.catch((e) => { failed(e); current = undefined; });
      return replacement;
    }
    if (outgrown && !renewing && mayRetry()) {
      const old = outgrown;
      renewing = true;
      const replacement = load();
      replacement.then(() => {
        renewing = false;
        if (outgrown === old) { outgrown = undefined; current = replacement; }
      }, (e) => { renewing = false; failed(e); });
    }
    return current;
  }

  return async function decodeArchive(bytes) {
    let p = instance();
    let m = await p;
    while (dead.has(m)) {
      if (current === p) current = undefined;
      m = await (p = instance());
    }
    everLoaded = true;
    const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);

    let initial = initialSize.get(m);
    if (initial === undefined) initialSize.set(m, initial = m.HEAPU8.length);
    let packed, failure;
    let outLength = 0;
    let intact = false; // true when a throw came from copying in JS and cleanup succeeded
    const checkSize = () => {
      const limit = Math.max(2 * initial, initial + 3 * (u8.length + outLength));
      if (current === p && m.HEAPU8.length > limit) outgrown = m;
    };
    try {
      const inPtr = m._malloc(u8.length || 1);
      if (!inPtr) failure = 'out of memory';
      else {
        // HEAPU8 is read fresh each time (it's reassigned on memory growth).
        try { m.HEAPU8.set(u8, inPtr); } catch (e) {
          try { m._free(inPtr); intact = true; } catch { /* the copy's error wins; the instance is dropped */ }
          throw e;
        }
        const outPtr = m._sit_decode(inPtr, u8.length);
        m._free(inPtr);
        if (!outPtr) failure = m.UTF8ToString(m._sit_error()) || 'decode failed';
        else {
          outLength = readU32(m.HEAPU8, outPtr);
          // Copy out of the WASM heap before freeing.
          try { packed = m.HEAPU8.slice(outPtr, outPtr + outLength); } catch (e) {
            try { m._sit_free(outPtr); intact = true; } catch { /* as above */ }
            throw e;
          }
          m._sit_free(outPtr);
        }
      }
    } catch (e) {
      if (intact) checkSize();
      else {
        dead.add(m); // the next call finds it dead and loads a replacement
        if (outgrown === m) outgrown = undefined;
      }
      throw e;
    }
    checkSize();
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
export const decodeArchive = createDecoder(createMunbox);

/**
 * Internal, for this package's own tests; not part of the supported API and may change or
 * go away in any release. Returns a separate `decodeArchive` with its own shared instance,
 * made by `glue` (same contract as the Emscripten factory: takes the module options,
 * resolves to a module).
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
