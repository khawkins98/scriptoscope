// The decode stage of the scheme loader: validated options + input → converted theme
// and RGBA assets. No DOM, canvas, URL or ownership work happens here. This one
// function is what loadKaleidoscopeScheme.js runs on the calling thread (the default)
// and what the opt-in decode worker (decodeWorkerHost.js) runs for a request, so the
// two cannot drift. It is the loader's former private `decodeScheme`, moved unchanged:
// option reads and awaits keep their order.
import { snapshotCicnTransfer, bindCicnTransfer } from './cicn-transfer-results.js';
import { assertCinfEnvironment, bindCinfEnvironment } from './cinf-environment.js';
import { beginLoadProvenance } from './loadProvenance.js';
import { convertScheme } from './convert.js';
import { displayRealizer } from './display-profile.js';
import { unwrapToResourceFork, detectContainer } from './containers.js';

/**
 * Decode a Kaleidoscope scheme resource fork into a render-ready in-memory theme.
 *
 * @param {Uint8Array|ArrayBuffer|Blob|string} input  a raw resource fork OR a Mac
 *   transfer container (MacBinary `.bin`, AppleSingle/Double, BinHex `.hqx`) — as
 *   bytes, an ArrayBuffer, a dropped Blob/File, or a URL to fetch. The container is
 *   unwrapped to its resource fork automatically; `.sit` lazily uses the WASM decoder.
 * @param {LoadOptions} [options]
 * @returns {Promise<object>} encodeAssets ⇒ a LoadedTheme `{ manifest, baseUrl:'', glyphs? }`
 *   whose asset refs are blob: URLs (assetUrl passes them through); otherwise the raw
 *   `{ manifest, assets, iconIndex }`.
 */
export async function decodeScheme(input, options) {
  const displayProfile = options.displayProfile;
  const cicnTransfer = snapshotCicnTransfer(options.cicnTransfer, displayProfile);
  const cinfEnvironment = options.cinfEnvironment;
  assertCinfEnvironment(cinfEnvironment);
  const sliderLayoutEnvironment = options.sliderLayoutEnvironment;
  assertCinfEnvironment(sliderLayoutEnvironment);
  displayRealizer(displayProfile);
  // Snapshot caller-owned byte inputs synchronously, before any await. Every
  // digest and decoder receives this same private snapshot when opted in.
  if ((options.provenance || cinfEnvironment || sliderLayoutEnvironment || cicnTransfer) && input instanceof Uint8Array) input = new Uint8Array(input);
  else if ((options.provenance || cinfEnvironment || sliderLayoutEnvironment || cicnTransfer) && input && typeof input.byteLength === 'number' && !ArrayBuffer.isView(input)) {
    input = new Uint8Array(new Uint8Array(input));
  }
  const bytes = await toUint8Array(input);
  if (!bytes || bytes.length === 0) {
    throw new Error('loadKaleidoscopeScheme: empty input (0 bytes) — not a theme file.');
  }
  // Unwrap a Mac transfer container down to the raw resource fork. StuffIt (.sit) needs the
  // munbox WASM decoder, lazily imported here so the conversion core stays WASM-free until a
  // .sit is actually dropped; the toolchain-free formats (MacBinary / AppleSingle·Double /
  // BinHex) and a raw fork go through the pure-JS containers.js. See tools/sit-wasm.
  const container = detectContainer(bytes);
  const evidence = options.provenance ? await beginLoadProvenance(bytes, container) : null;
  let fork, selection;
  if (container === 'stuffit') {
    const { stuffItResourceForkWithSelection } = await import('../sit-wasm/index.mjs');
    ({ bytes: fork, selection } = await stuffItResourceForkWithSelection(bytes));
  } else {
    fork = unwrapToResourceFork(bytes);
    selection = { policy: container === 'raw' ? 'raw-resource-fork' : 'unverified-container-unwrapping',
      entryIndex: null, entryName: null, forkType: container === 'raw' ? 1 : null, fileType: null, creator: null };
  }
  if (cicnTransfer) fork = new Uint8Array(fork);
  if (evidence) await evidence.selectedFork(fork, selection);
  const cinfBinding = await bindCinfEnvironment(cinfEnvironment, fork);
  const sliderLayoutBinding = await bindCinfEnvironment(sliderLayoutEnvironment, fork);
  const cicnTransferBinding = await bindCicnTransfer(cicnTransfer, fork);
  let converted;
  try {
    converted = convertScheme(fork, {
      meta: options.meta, source: options.source ?? 'resource-fork', displayProfile, cinfBinding, cicnTransferBinding,
      ...(options.iconBlitCicnIds ? { iconBlitCicnIds: options.iconBlitCicnIds } : {}),
      ...(options.unmaskedIconIds ? { unmaskedIconIds: options.unmaskedIconIds } : {}),
      ...(options.engineCinfIds ? { engineCinfIds: options.engineCinfIds } : {}),
      ...(evidence ? { resourceObserver: evidence.observer } : {}),
    });
  } catch (error) {
    // Preserve the primary conversion error and settle every pending digest.
    if (evidence) await evidence.settle();
    throw error;
  }
  // Complete or reject all hashing before any encoder can allocate asset URLs.
  const byteProvenance = evidence ? await evidence.finish() : undefined;
  return { converted, byteProvenance, sliderLayoutBinding };
}

/**
 * Start loading the lazy StuffIt decoder (module and WASM) while a `.sit` is still
 * downloading. Best effort and silent: decodeScheme's own import remains the only
 * place a decoder failure is reported. Callers must not use this for inputs that
 * are not StuffIt archives; those never request the decoder.
 *
 * The decoder has no separate warm-up entry, so its one-time WASM instantiation is
 * reached through its documented pass-through of a non-archive input: zero bytes
 * decode to a single empty fork, which is discarded.
 *
 * When the WASM cannot instantiate, the Emscripten runtime logs the failure with
 * console.error and the decoder keeps the failed instantiation for the page's
 * lifetime, as it does without warming. Warming only moves that earlier: to the
 * request for a named `.sit` instead of the first decode.
 */
export function prewarmStuffItDecoder() {
  import('../sit-wasm/index.mjs').then(decoder => decoder.decodeArchive(new Uint8Array(0))).catch(() => {});
}

export async function toUint8Array(input) {
  if (input instanceof Uint8Array) return input;
  if (input && typeof input === 'object' && typeof input.byteLength === 'number' && !ArrayBuffer.isView(input)) {
    return new Uint8Array(input);
  }
  if (typeof Blob !== 'undefined' && input instanceof Blob) {
    return new Uint8Array(await input.arrayBuffer());
  }
  if (typeof input === 'string') {
    const res = await fetch(input);
    if (!res.ok) throw new Error(`loadKaleidoscopeScheme: failed to fetch ${input} (${res.status} ${res.statusText})`);
    return new Uint8Array(await res.arrayBuffer());
  }
  throw new Error(`loadKaleidoscopeScheme: unsupported input type ${typeof input}`);
}

