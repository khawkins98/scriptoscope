// Wire format shared by the decode worker (decodeWorkerHost.js) and its main-thread
// client (decodeWorkerClient.js). A structured clone keeps values, key order and
// shared references but drops what the main-thread decode result also carries:
// frozen/sealed state and the identity of caller-supplied `meta` objects that the
// manifest holds by reference. Both sides walk the same graph in the same order,
// so the worker can name those objects by position and the client can restore them.

export const DECODE_PROTOCOL = 'scriptoscope-decode-v1';

const isContainer = value => {
  if (Array.isArray(value)) return true;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

/**
 * Deterministic walk over plain objects and arrays, each visited once.
 * `child(parent, key, value, ordinal, first)` runs for every container reference;
 * returning false on a first visit skips that container's own children.
 * `leaf(value)` receives every other object (typed arrays, buffers, …).
 * @returns {object[]} containers in visit order; the index is the ordinal.
 */
export function traverse(root, child, leaf) {
  const ordinals = new Map(), nodes = [], stack = [];
  if (root === null || typeof root !== 'object' || !isContainer(root)) return nodes;
  ordinals.set(root, 0); nodes.push(root); stack.push(root);
  while (stack.length) {
    const parent = stack.pop();
    const keys = Array.isArray(parent) ? null : Object.keys(parent);
    const length = keys ? keys.length : parent.length;
    for (let i = 0; i < length; i++) {
      const key = keys ? keys[i] : i, value = parent[key];
      if (value === null || typeof value !== 'object') continue;
      const known = ordinals.get(value);
      if (known !== undefined) { child?.(parent, key, value, known, false); continue; }
      if (!isContainer(value)) { leaf?.(value); continue; }
      const ordinal = nodes.length;
      ordinals.set(value, ordinal); nodes.push(value);
      if (child?.(parent, key, value, ordinal, true) !== false) stack.push(value);
    }
  }
  return nodes;
}

const integrity = value => Object.isFrozen(value) ? 1 : Object.isSealed(value) ? 2 : Object.isExtensible(value) ? 0 : 3;
const restoreIntegrity = [undefined, Object.freeze, Object.seal, Object.preventExtensions];

/**
 * Worker side. `meta` is the worker's clone of the caller's metadata.
 * @returns {{ message: { value: object, integrity: Uint8Array, metaRefs: number[] }, transfer: ArrayBuffer[] }}
 */
export function packDecodeResult(value, meta) {
  const metaOrdinals = new Map(traverse(meta).map((node, ordinal) => [node, ordinal]));
  const metaRefs = [], borrowed = new Set(), buffers = new Set();
  const nodes = traverse(value, (_parent, _key, node, ordinal, first) => {
    if (!first) return undefined;
    const metaOrdinal = metaOrdinals.get(node);
    if (metaOrdinal === undefined) return undefined;
    metaRefs.push(ordinal, metaOrdinal); borrowed.add(ordinal);
    return false;
  }, leaf => {
    const buffer = ArrayBuffer.isView(leaf) ? leaf.buffer : leaf;
    if (buffer instanceof ArrayBuffer) buffers.add(buffer);
  });
  const state = new Uint8Array(nodes.length);
  for (let i = 0; i < nodes.length; i++) if (!borrowed.has(i)) state[i] = integrity(nodes[i]);
  buffers.add(state.buffer);
  return { message: { value, integrity: state, metaRefs }, transfer: [...buffers] };
}

/** Client side. `meta` is the caller's original metadata object. */
export function unpackDecodeResult({ value, integrity: state, metaRefs }, meta) {
  const originals = traverse(meta), refs = new Map();
  for (let i = 0; i < metaRefs.length; i += 2) refs.set(metaRefs[i], originals[metaRefs[i + 1]]);
  const nodes = traverse(value, (parent, key, _node, ordinal) => {
    if (!refs.has(ordinal)) return undefined;
    parent[key] = refs.get(ordinal);
    return false;
  });
  for (let i = 0; i < nodes.length; i++) if (state[i]) restoreIntegrity[state[i]](nodes[i]);
  return value;
}

/** Plain cloneable description of a thrown value; classes are restored by the client. */
export function packDecodeError(error) {
  if (error === null || typeof error !== 'object') return { thrown: ['symbol', 'function'].includes(typeof error) ? String(error) : error };
  const fields = {};
  for (const [key, value] of Object.entries(error)) {
    if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) fields[key] = value;
  }
  return { name: String(error.name ?? 'Error'), message: String(error.message ?? ''),
    ...(typeof error.stack === 'string' ? { stack: error.stack } : {}), fields };
}
