// Main-thread side of the opt-in decode worker. The caller creates and owns the
// Worker (or supplies a factory); this module only multiplexes decode requests
// over it and never terminates it. Without the `decodeWorker` option none of this
// runs and decoding stays on the calling thread.
import { DECODE_PROTOCOL, unpackDecodeResult } from './decodeWorkerProtocol.js';
import { DisplayProfileError } from './display-profile.js';
import { CinfEnvironmentError } from './cinf-environment.js';
import { CicnTransferError } from './cicn-transfer-results.js';
import { ThemeValidationError } from './validateTheme.js';

export const DEFAULT_DECODE_WORKER_TIMEOUT_MS = 30_000;
const channels = new WeakMap(); // worker → request channel
const spawned = new WeakMap();  // factory → the worker it returned

// Options the worker stage reads, and options that only matter after it. Anything
// else — prepared display profiles, cinf environments and finite transfers are
// branded handles whose identity a structured clone cannot carry, and an option
// this module does not know — keeps the load on the calling thread.
const WORKER_OPTIONS = ['meta', 'source', 'provenance', 'iconBlitCicnIds', 'unmaskedIconIds', 'engineCinfIds'];
const LOCAL_OPTIONS = ['encodeAssets', 'assetUrlFactory', 'decodeWorker', 'decodeWorkerTimeoutMs'];
const ID_LISTS = ['iconBlitCicnIds', 'unmaskedIconIds', 'engineCinfIds'];

function failure(message) {
  return Object.assign(new Error(`Scriptoscope decode worker failed: ${message}`), { code: 'DECODE_WORKER_FAILED' });
}

/** Strict JSON-like data: a structured clone of it loses nothing the decoder reads. */
function plainData(value, seen = new Set()) {
  if (value === null || typeof value !== 'object') return typeof value !== 'function' && typeof value !== 'symbol';
  if (seen.has(value)) return true;
  seen.add(value);
  const array = Array.isArray(value);
  if (Object.getPrototypeOf(value) !== (array ? Array.prototype : Object.prototype)) return false;
  const keys = Reflect.ownKeys(value);
  if (array && keys.length !== value.length + 1) return false; // holes or named properties
  for (const key of keys) {
    if (typeof key === 'symbol') return false;
    if (array && key === 'length') continue;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor.enumerable || !('value' in descriptor) || !plainData(descriptor.value, seen)) return false;
  }
  return true;
}

function assertPort(port) {
  if (!port || typeof port.postMessage !== 'function' || typeof port.addEventListener !== 'function') {
    throw new TypeError('decodeWorker must be a Worker or a function returning one');
  }
  return port;
}

function portOf(option) {
  if (typeof option !== 'function') return assertPort(option);
  let port = spawned.get(option);
  // A factory is asked again only after its previous worker failed.
  if (!port || channels.get(port)?.failed) { port = assertPort(option()); spawned.set(option, port); }
  return port;
}

function channelOf(port) {
  let channel = channels.get(port);
  if (channel) return channel;
  const pending = new Map();
  let timer;
  const arm = () => {
    clearTimeout(timer);
    let wait = Infinity;
    for (const request of pending.values()) wait = Math.min(wait, request.timeoutMs);
    if (wait === Infinity) return;
    timer = setTimeout(() => fail(`no response within ${wait} ms`), wait);
    timer.unref?.();
  };
  const fail = message => {
    channel.failed = message;
    clearTimeout(timer);
    const requests = [...pending.values()];
    pending.clear();
    for (const request of requests) request.reject(failure(message));
  };
  channel = { next: 0, pending, arm, failed: undefined };
  channels.set(port, channel);
  port.addEventListener('message', event => {
    const message = event.data;
    if (message?.protocol !== DECODE_PROTOCOL || channel.failed) return;
    const request = pending.get(message.id);
    pending.delete(message.id);
    arm(); // any answer shows the worker is alive: restart the wait for the rest
    if (!request) return;
    if (message.type === 'error') { request.reject(unpackDecodeError(message.error)); return; }
    try { request.resolve({ ...unpackDecodeResult(message, request.meta), sliderLayoutBinding: undefined }); }
    catch (error) { request.reject(error); }
  });
  port.addEventListener('error', event => fail(event?.message || 'the worker reported an error'));
  port.addEventListener('messageerror', () => fail('a worker message could not be deserialized'));
  return channel;
}

/**
 * Decide where a load decodes. Returns undefined when no worker was supplied or
 * this load carries an option the worker cannot honour (it then decodes on the
 * calling thread, exactly as without the option).
 * @throws {TypeError} for a malformed `decodeWorker` / `decodeWorkerTimeoutMs`.
 */
export function decodeWorkerRequest(options) {
  const option = options.decodeWorker;
  if (option === undefined) return undefined;
  if (typeof option !== 'function') assertPort(option);
  const timeoutMs = options.decodeWorkerTimeoutMs ?? DEFAULT_DECODE_WORKER_TIMEOUT_MS;
  if (typeof timeoutMs !== 'number' || !(timeoutMs > 0)) throw new TypeError('decodeWorkerTimeoutMs must be a positive number of milliseconds');
  const request = {};
  for (const key of Object.keys(options)) {
    const value = options[key];
    if (value === undefined || LOCAL_OPTIONS.includes(key)) continue;
    if (!WORKER_OPTIONS.includes(key)) return undefined;
    if (ID_LISTS.includes(key)) {
      if (!Array.isArray(value) || !value.every(Number.isFinite)) return undefined;
      request[key] = Array.from(value);
    } else if (key === 'source') {
      if (typeof value !== 'string') return undefined;
      request.source = value;
    } else if (key === 'provenance') request.provenance = !!value;
    else if (!plainData(value)) return undefined;
    else request.meta = value;
  }
  const port = portOf(option);
  channelOf(port); // listen from the first sight of the worker, so an early failure is seen
  return { port, options: request, meta: options.meta, timeoutMs };
}

/**
 * Run the decode stage in the worker. `bytes` is copied, never detached.
 * Rejects (code `DECODE_WORKER_FAILED`) when the worker errors or stays silent;
 * a decode error is rethrown as the class the main thread would have thrown.
 */
export function decodeInWorker({ port, options, meta, timeoutMs }, bytes) {
  const channel = channelOf(port);
  if (channel.failed) return Promise.reject(failure(channel.failed));
  return new Promise((resolve, reject) => {
    const id = ++channel.next, payload = bytes.slice();
    port.postMessage({ protocol: DECODE_PROTOCOL, type: 'decode', id, bytes: payload, options }, [payload.buffer]);
    channel.pending.set(id, { resolve, reject, meta, timeoutMs });
    channel.arm();
  });
}

/**
 * Loader-internal: ask the worker for the lazy StuffIt decoder (or, with
 * `stuffIt` false, only make sure a factory's worker exists) ahead of the bytes.
 * @returns {boolean} true when this load will decode in the worker.
 * @throws when the option is malformed or its factory throws.
 */
export function prewarmDecodeWorker(options, stuffIt) {
  const request = decodeWorkerRequest(options);
  if (!request) return false;
  if (stuffIt) {
    try { request.port.postMessage({ protocol: DECODE_PROTOCOL, type: 'prewarm' }, []); } catch { /* the load reports it */ }
  }
  return true;
}

const LOADER_ERRORS = { DisplayProfileError, CinfEnvironmentError, CicnTransferError, ThemeValidationError };
const BUILT_IN_ERRORS = ['Error', 'TypeError', 'RangeError', 'SyntaxError', 'ReferenceError', 'EvalError', 'URIError'];

function unpackDecodeError(packed) {
  if ('thrown' in packed) return packed.thrown;
  const { name, message, stack, fields } = packed;
  let error;
  if (LOADER_ERRORS[name]) {
    error = new Error(message);
    Object.setPrototypeOf(error, LOADER_ERRORS[name].prototype);
  } else if (BUILT_IN_ERRORS.includes(name)) error = new globalThis[name](message);
  else if (typeof DOMException === 'function' && !('name' in fields)) return new DOMException(message, name);
  else error = new Error(message);
  Object.assign(error, fields);
  if (stack) error.stack = stack;
  return error;
}
