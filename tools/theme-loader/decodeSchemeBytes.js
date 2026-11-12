// The decode stage of the scheme loader: archive bytes → converted theme + RGBA
// assets. No DOM, canvas, URL or ownership work happens here, so this one module
// runs unchanged on the main thread (the default) and inside the opt-in decode
// worker (decodeWorker.js). Callers validate and snapshot options beforehand.
import { bindCinfEnvironment } from './cinf-environment.js';
import { bindCicnTransfer } from './cicn-transfer-results.js';
import { beginLoadProvenance } from './loadProvenance.js';
import { convertScheme } from './convert.js';
import { unwrapToResourceFork, detectContainer } from './containers.js';

/**
 * @param {Uint8Array} bytes non-empty archive or raw resource-fork bytes.
 * @param {object} options validated loader options; `cicnTransfer` is the snapshot.
 * @returns {Promise<{ converted: object, byteProvenance: object|undefined, sliderLayoutBinding: object|undefined }>}
 */
export async function decodeSchemeBytes(bytes, options) {
  const { displayProfile, cicnTransfer, cinfEnvironment, sliderLayoutEnvironment } = options;
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
 * downloading. Best effort and silent: decodeSchemeBytes' own import remains the only
 * place a decoder failure is reported. Callers must not use this for inputs that
 * are not StuffIt archives; those never request the decoder.
 *
 * The decoder has no separate warm-up entry, so its one-time WASM instantiation is
 * reached through its documented pass-through of a non-archive input: zero bytes
 * decode to a single empty fork, which is discarded.
 */
export function prewarmStuffItDecoder() {
  import('../sit-wasm/index.mjs').then(decoder => decoder.decodeArchive(new Uint8Array(0))).catch(() => {});
}
