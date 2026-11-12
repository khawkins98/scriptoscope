// Wire format shared by the decode worker (decodeWorkerHost.js) and its main-thread
// client (decodeWorkerClient.js).
//
// Messages. Every message carries `protocol`; every request carries the `client`
// id of the module instance that sent it, and every reply echoes it, so two copies
// of the library sharing one Worker never read each other's answers.
//   client → worker  { type: 'ping' }                       answered at once by 'pong'
//                    { type: 'prewarm' }                    no answer
//                    { type: 'decode', id, bytes, options } answered by 'result' or 'error'
//   worker → client  { type: 'pong' }
//                    { type: 'result', id, value, integrity, metaRefs }
//                    { type: 'error', id, error }
//
// A structured clone keeps values, key order and shared references but drops what
// the main-thread decode result also carries: frozen/sealed state and the identity
// of caller-supplied `meta` objects that the manifest holds by reference. Both sides
// walk the same graph in the same order, so the worker can name those objects by
// position and the client can restore them.
import { DisplayProfileError } from './display-profile.js';
import { CinfEnvironmentError } from './cinf-environment.js';
import { CicnTransferError } from './cicn-transfer-results.js';
import { ThemeValidationError } from './validateTheme.js';

export const DECODE_PROTOCOL = 'scriptoscope-decode-v2';

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

// 0 open, 1 frozen, 2 sealed, 3 not extensible. Each is restored as itself.
const integrity = value => Object.isFrozen(value) ? 1 : Object.isSealed(value) ? 2 : Object.isExtensible(value) ? 0 : 3;
const restoreIntegrity = [undefined, Object.freeze, Object.seal, Object.preventExtensions];

/**
 * Worker side. `meta` is the worker's clone of the caller's metadata. A result node
 * that IS one of those clones is only named (`metaRefs`): the client puts the
 * caller's own object back, so its state is never taken from the clone.
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

const malformed = what => new TypeError(`malformed decode reply: ${what}`);

/**
 * Client side. `meta` is the caller's original metadata object.
 * @throws {TypeError} when the reply is not a well-formed result for this graph.
 */
export function unpackDecodeResult({ value, integrity: state, metaRefs }, meta) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)
      || value.converted === null || typeof value.converted !== 'object') throw malformed('no decoded theme');
  if (!(state instanceof Uint8Array) || !Array.isArray(metaRefs) || metaRefs.length % 2) throw malformed('no restore data');
  const originals = traverse(meta), refs = new Map();
  for (let i = 0; i < metaRefs.length; i += 2) {
    const ordinal = metaRefs[i], original = originals[metaRefs[i + 1]];
    if (!Number.isInteger(ordinal) || original === undefined) throw malformed('unknown metadata reference');
    refs.set(ordinal, original);
  }
  const nodes = traverse(value, (parent, key, _node, ordinal) => {
    if (!refs.has(ordinal)) return undefined;
    parent[key] = refs.get(ordinal);
    return false;
  });
  if (nodes.length !== state.length) throw malformed('restore data does not match the result');
  for (let i = 0; i < nodes.length; i++) {
    if (state[i] > 3) throw malformed('unknown object state');
    if (state[i] && !refs.has(i)) restoreIntegrity[state[i]](nodes[i]);
  }
  return value;
}

// The only error classes that cross the boundary as themselves. Listed most specific
// first; anything else arrives as a plain Error carrying the original name.
const ERROR_KINDS = Object.freeze(Object.assign(Object.create(null), {
  DisplayProfileError, CinfEnvironmentError, CicnTransferError, ThemeValidationError,
  ...(typeof WebAssembly === 'object' ? { RuntimeError: WebAssembly.RuntimeError, CompileError: WebAssembly.CompileError, LinkError: WebAssembly.LinkError } : {}),
  ...(typeof AggregateError === 'function' ? { AggregateError } : {}),
  EvalError, RangeError, ReferenceError, SyntaxError, TypeError, URIError, Error,
}));
const RESERVED_FIELDS = ['__proto__', 'constructor', 'prototype', 'message', 'stack'];
const primitive = value => value === null || ['string', 'number', 'boolean', 'undefined', 'bigint'].includes(typeof value);

/** Plain cloneable description of a thrown value. */
export function packDecodeError(error) {
  if (error === null || (typeof error !== 'object' && typeof error !== 'function')) {
    return { thrown: typeof error === 'symbol' ? String(error) : error };
  }
  const kind = Object.keys(ERROR_KINDS).find(name => error instanceof ERROR_KINDS[name]) ?? 'Error';
  const fields = [];
  for (const [key, value] of Object.entries(error)) if (primitive(value)) fields.push([key, value]);
  return { kind, name: String(error.name ?? 'Error'), message: String(error.message ?? ''),
    ...(typeof error.stack === 'string' ? { stack: error.stack } : {}), fields };
}

const define = (error, key, value, enumerable) => Object.defineProperty(error, key, { value, enumerable, writable: true, configurable: true });

/**
 * Rebuild the thrown value. Constructors come only from the fixed table, looked up
 * by own key; nothing from the message is used as a prototype or a constructor.
 * @throws {TypeError} when the description is malformed.
 */
export function unpackDecodeError(packed) {
  if (packed === null || typeof packed !== 'object') throw malformed('no error description');
  if (Object.hasOwn(packed, 'thrown')) {
    if (!primitive(packed.thrown)) throw malformed('non-primitive thrown value');
    return packed.thrown;
  }
  const { kind, name, message, stack, fields } = packed;
  if (typeof kind !== 'string' || !Object.hasOwn(ERROR_KINDS, kind) || typeof name !== 'string' || typeof message !== 'string'
      || (stack !== undefined && typeof stack !== 'string') || !Array.isArray(fields)
      || !fields.every(field => Array.isArray(field) && field.length === 2 && typeof field[0] === 'string' && primitive(field[1]))) {
    throw malformed('invalid error description');
  }
  const Kind = ERROR_KINDS[kind], own = new Map(fields);
  let error;
  if (Kind === ThemeValidationError) {
    // Its constructor composes `${path}: ${message}`; take that apart again.
    const path = typeof own.get('path') === 'string' ? own.get('path') : '';
    error = message.startsWith(`${path}: `) ? new Kind(message.slice(path.length + 2), path) : new Kind(message, path);
  } else if (kind === 'AggregateError') error = new Kind([], message);
  else error = new Kind(message);
  if (error.message !== message) define(error, 'message', message, false);
  for (const [key, value] of fields) if (!RESERVED_FIELDS.includes(key)) define(error, key, value, true);
  if (error.name !== name) define(error, 'name', name, false);
  if (stack !== undefined) define(error, 'stack', stack, false);
  return error;
}
