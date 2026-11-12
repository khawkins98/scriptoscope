// Main-thread side of the opt-in decode worker. Nothing here runs for a load that
// does not pass `decodeWorker`.
//
// Ownership. A Worker the caller passes is the caller's: this module never
// terminates it. A Worker obtained from a caller's FACTORY is held by this module
// (the caller has no handle to it): when it is judged failed it is terminated, and
// the next load asks the factory for one replacement, which concurrent loads share.
//
// When a worker is judged failed (every pending load on it rejects with
// DECODE_WORKER_FAILED, later loads reject at once):
//   - it dispatches `error` or `messageerror`;
//   - it sends this client a malformed reply;
//   - it does not answer a liveness ping. A ping is sent the first time a worker is
//     used, because a Worker that failed to start before anyone listened shows no
//     later sign of it, and again on first use after one of its loads timed out.
//     The wait is DECODE_WORKER_HANDSHAKE_MS, or the load's own timeout if shorter.
// A load's own timeout rejects only that load. Its clock restarts whenever the
// worker sends this client anything (an answer to another load counts: the worker
// is alive and working through its queue). Posting a new request restarts nothing.
import { decodeScheme, toUint8Array } from './decodeScheme.js';
import { snapshotCicnTransfer } from './cicn-transfer-results.js';
import { assertCinfEnvironment } from './cinf-environment.js';
import { displayRealizer } from './display-profile.js';
import { DECODE_PROTOCOL, unpackDecodeResult, unpackDecodeError } from './decodeWorkerProtocol.js';

export const DEFAULT_DECODE_WORKER_TIMEOUT_MS = 30_000;
export const DECODE_WORKER_HANDSHAKE_MS = 5_000;
const MAX_TIMER_MS = 2 ** 31 - 1; // longer waits are not timed: setTimeout would fire at once

// Identifies this module instance on a worker that another copy of the library shares.
const CLIENT = Array.from(globalThis.crypto?.getRandomValues?.(new Uint8Array(16)) ?? Array.from({ length: 16 }, () => Math.random() * 256 | 0),
  byte => (byte & 255).toString(16).padStart(2, '0')).join('');
const channels = new WeakMap();  // worker → channel
const factories = new WeakMap(); // factory → the worker it last returned

const failure = message => Object.assign(new Error(`Scriptoscope decode worker failed: ${message}`), { code: 'DECODE_WORKER_FAILED' });
const timed = ms => Number.isFinite(ms) && ms <= MAX_TIMER_MS;
const timer = (run, ms) => { const handle = setTimeout(run, ms); handle.unref?.(); return handle; };

/** Strict JSON-like data: a structured clone of it loses nothing the decoder reads. */
function plainData(value, seen) {
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
    if (!descriptor?.enumerable || !('value' in descriptor) || !plainData(descriptor.value, seen)) return false;
  }
  return true;
}

/** Plain data that also survives an actual clone (a Proxy looks plain and does not). */
function cloneable(meta) {
  try {
    if (!plainData(meta, new Set())) return false;
    if (meta !== null && typeof meta === 'object' && typeof structuredClone === 'function') structuredClone(meta);
    return true;
  } catch { return false; } // throwing traps, too deep to walk, DataCloneError
}

function assertPort(port) {
  if (!port || typeof port.postMessage !== 'function' || typeof port.addEventListener !== 'function') {
    throw new TypeError('decodeWorker must be a Worker or a function returning one');
  }
  return port;
}

function settings(options) {
  const option = options.decodeWorker;
  if (typeof option !== 'function') assertPort(option);
  const timeoutMs = options.decodeWorkerTimeoutMs ?? DEFAULT_DECODE_WORKER_TIMEOUT_MS;
  if (typeof timeoutMs !== 'number' || !(timeoutMs > 0)) throw new TypeError('decodeWorkerTimeoutMs must be a positive number of milliseconds');
  return { option, timeoutMs };
}

/**
 * The options the worker's decodeScheme will read, taken with the same property
 * reads the calling thread performs (inherited and non-enumerable options count).
 * Undefined when any of them is not plain cloneable data.
 */
function payloadOf(options) {
  const payload = {};
  const meta = options.meta;
  if (!cloneable(meta)) return undefined;
  if (meta !== undefined) payload.meta = meta;
  const source = options.source;
  if (source !== undefined && source !== null && typeof source !== 'string') return undefined;
  if (typeof source === 'string') payload.source = source;
  if (options.provenance) payload.provenance = true;
  for (const key of ['iconBlitCicnIds', 'unmaskedIconIds', 'engineCinfIds']) {
    const ids = options[key];
    if (!ids) continue;
    if (!cloneable(ids) || !Array.isArray(ids) || !ids.every(Number.isFinite)) return undefined;
    payload[key] = Array.from(ids);
  }
  return payload;
}

function fail(channel, message) {
  if (channel.failed !== undefined) return;
  channel.failed = message;
  clearTimeout(channel.pingTimer);
  const requests = [...channel.pending.values()];
  channel.pending.clear();
  for (const request of requests) { clearTimeout(request.timer); request.reject(failure(message)); }
  // Only a worker this module obtained from a factory is this module's to stop.
  if (channel.held) { try { channel.port.terminate?.(); } catch { /* already gone */ } }
}

function arm(channel, id, request) {
  clearTimeout(request.timer);
  if (!timed(request.timeoutMs)) return;
  request.timer = timer(() => {
    channel.pending.delete(id);
    channel.alive = false; // unproven again: its next use starts with a liveness ping
    request.reject(failure(`no response within ${request.timeoutMs} ms`));
  }, request.timeoutMs);
}

function channelOf(port) {
  let channel = channels.get(port);
  if (channel) return channel;
  channel = { port, held: false, next: 0, pending: new Map(), alive: false, pingTimer: undefined, failed: undefined };
  channels.set(port, channel);
  port.addEventListener('message', event => {
    try {
      const message = event?.data;
      if (message === null || typeof message !== 'object' || message.protocol !== DECODE_PROTOCOL
          || message.client !== CLIENT || channel.failed !== undefined) return;
      const { type, id } = message;
      if (type !== 'pong' && type !== 'result' && type !== 'error') throw new TypeError(`unknown reply type`);
      // The worker spoke to this client: it is alive, so every pending wait starts over.
      channel.alive = true;
      clearTimeout(channel.pingTimer); channel.pingTimer = undefined;
      for (const [pendingId, request] of channel.pending) arm(channel, pendingId, request);
      const request = type === 'pong' ? undefined : channel.pending.get(id);
      if (!request) return; // a pong, or a late or duplicate answer
      const error = type === 'error' ? { thrown: unpackDecodeError(message.error) } : undefined;
      const value = error ? undefined : unpackDecodeResult(message, request.meta);
      channel.pending.delete(id);
      clearTimeout(request.timer);
      if (error) request.reject(error.thrown); else request.resolve({ ...value, sliderLayoutBinding: undefined });
    } catch (error) {
      // Never let a reply throw out of the listener: the load would hang.
      fail(channel, `it sent a malformed reply (${error instanceof Error ? error.message : 'unreadable'})`);
    }
  });
  port.addEventListener('error', event => fail(channel, typeof event?.message === 'string' && event.message ? event.message : 'the worker reported an error'));
  port.addEventListener('messageerror', () => fail(channel, 'a worker message could not be deserialized'));
  return channel;
}

/** The worker for this option; a factory is called only for a first or replacement worker. */
function portOf(option) {
  if (typeof option !== 'function') {
    const port = assertPort(option);
    channelOf(port).held = false; // passed directly at least once: the caller's
    return port;
  }
  let port = factories.get(option);
  if (port && channelOf(port).failed === undefined) return port;
  port = assertPort(option());
  factories.set(option, port);
  if (!channels.has(port)) channelOf(port).held = true;
  return port;
}

/** Ask an unproven worker to show it is running. No effect on a proven or already-asked one. */
function probe(channel, timeoutMs) {
  if (channel.alive || channel.pingTimer !== undefined || channel.failed !== undefined) return;
  const wait = timed(timeoutMs) ? Math.min(DECODE_WORKER_HANDSHAKE_MS, timeoutMs) : DECODE_WORKER_HANDSHAKE_MS;
  channel.pingTimer = timer(() => fail(channel, `it did not answer a liveness check within ${wait} ms`), wait);
  try { channel.port.postMessage({ protocol: DECODE_PROTOCOL, client: CLIENT, type: 'ping' }, []); }
  catch (error) { fail(channel, `it could not be messaged (${error instanceof Error ? error.message : 'postMessage threw'})`); }
}

/**
 * Loader-internal, for the URL loaders: whether a load with these options (the
 * prepared handles and, when the caller supplied it, `meta`) will decode in the worker.
 * Calls no factory and posts nothing.
 * @throws {TypeError} for a malformed `decodeWorker` / `decodeWorkerTimeoutMs`.
 */
export function willDecodeInWorker(options) {
  settings(options);
  return !(options.displayProfile || options.cicnTransfer || options.cinfEnvironment || options.sliderLayoutEnvironment)
    && cloneable(options.meta);
}

/**
 * Loader-internal: obtain the worker ahead of the archive bytes (calling a factory
 * if it has no live worker), start its liveness check and, for a named `.sit`, ask
 * it for the lazy StuffIt decoder. Throws only what the factory throws.
 */
export function startDecodeWorker(options, stuffIt) {
  const { option, timeoutMs } = settings(options);
  const channel = channelOf(portOf(option));
  if (channel.failed !== undefined) return;
  probe(channel, timeoutMs);
  if (stuffIt && channel.failed === undefined) {
    try { channel.port.postMessage({ protocol: DECODE_PROTOCOL, client: CLIENT, type: 'prewarm' }, []); } catch { /* the decode reports it */ }
  }
}

/**
 * decodeScheme for a load that passed `decodeWorker`. Options are read and validated
 * as decodeScheme does. A load carrying a prepared display profile, cinf environment
 * or finite transfer (handles recognised by identity, which a clone does not keep),
 * or options that are not plain cloneable data, decodes on the calling thread.
 */
export async function decodeWithWorker(input, options) {
  const displayProfile = options.displayProfile;
  const cicnTransfer = snapshotCicnTransfer(options.cicnTransfer, displayProfile);
  const cinfEnvironment = options.cinfEnvironment;
  assertCinfEnvironment(cinfEnvironment);
  const sliderLayoutEnvironment = options.sliderLayoutEnvironment;
  assertCinfEnvironment(sliderLayoutEnvironment);
  displayRealizer(displayProfile);
  const { option, timeoutMs } = settings(options);
  const payload = displayProfile || cicnTransfer || cinfEnvironment || sliderLayoutEnvironment ? undefined : payloadOf(options);
  if (!payload) return decodeScheme(input, options);
  // Take a private copy of caller bytes now, into a buffer of our own. That buffer is
  // what gets transferred, so the caller's memory (a Node Buffer's shared pool, a
  // larger buffer behind a view) is never detached, whatever `slice` the input has.
  if (input instanceof Uint8Array) {
    const copy = new Uint8Array(input.byteLength);
    Uint8Array.prototype.set.call(copy, input);
    input = copy;
  } else if (input && typeof input.byteLength === 'number' && !ArrayBuffer.isView(input)) {
    input = new Uint8Array(new Uint8Array(input));
  }
  const bytes = await toUint8Array(input);
  if (!bytes || bytes.length === 0) {
    throw new Error('loadKaleidoscopeScheme: empty input (0 bytes) — not a theme file.');
  }
  const channel = channelOf(portOf(option));
  if (channel.failed !== undefined) throw failure(channel.failed);
  probe(channel, timeoutMs);
  if (channel.failed !== undefined) throw failure(channel.failed);
  const id = ++channel.next;
  try {
    channel.port.postMessage({ protocol: DECODE_PROTOCOL, client: CLIENT, type: 'decode', id, bytes, options: payload }, [bytes.buffer]);
  } catch (error) {
    // Something in the request could not be cloned after all. That is this load's
    // problem, not the worker's: decode here, as if it had been ineligible.
    if (error?.name === 'DataCloneError') return decodeScheme(bytes, options);
    throw error;
  }
  return new Promise((resolve, reject) => {
    const request = { resolve, reject, meta: payload.meta, timeoutMs, timer: undefined };
    channel.pending.set(id, request);
    arm(channel, id, request);
  });
}
