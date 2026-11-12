// Node stand-ins for a browser decode Worker, for the pure-Node unit suite.
import { MessageChannel } from 'node:worker_threads';
import { serveDecodeRequests } from '../../tools/theme-loader/decodeWorkerHost.js';
import { DECODE_PROTOCOL } from '../../tools/theme-loader/decodeWorkerProtocol.js';

/**
 * The real worker host behind a real MessageChannel: requests and answers cross the
 * same structured clone and buffer transfer a browser Worker performs. With `hold`,
 * decode answers queue until `release()`; liveness answers are never held.
 * `transferred` records, per answer, how many bytes left the host by transfer.
 */
export function hostedDecodeWorker(t, { hold = false } = {}) {
  const { port1, port2 } = new MessageChannel();
  t.after(() => { port1.close(); port2.close(); });
  const requests = [], held = [], transferred = [];
  let terminated = 0;
  const worker = {
    requests, transferred, holding: hold,
    get terminated() { return terminated; },
    get held() { return held.length; },
    /** Deliver held answers; newest first when `reverse`. */
    release({ reverse = false } = {}) {
      worker.holding = false;
      for (const send of reverse ? held.splice(0).reverse() : held.splice(0)) send();
    },
    postMessage(message, transfer) { requests.push(message.type); port1.postMessage(message, transfer); },
    addEventListener(type, listener) { port1.addEventListener(type, listener); port1.start(); },
    terminate() { terminated++; },
  };
  // The worker global: requests arrive on port2 and answers leave through it.
  serveDecodeRequests({
    addEventListener(type, listener) { port2.addEventListener(type, listener); port2.start(); },
    postMessage(message, transfer) {
      const send = () => {
        const bytes = transfer.reduce((sum, buffer) => sum + buffer.byteLength, 0);
        port2.postMessage(message, transfer);
        // A transferred buffer is detached on the sending side; a copied one is not.
        if (message.type === 'result') transferred.push(transfer.every(buffer => buffer.byteLength === 0) ? bytes : 0);
      };
      if (worker.holding && message.type !== 'pong') held.push(send); else send();
    },
  });
  return worker;
}

/**
 * A port that records requests and says only what the test makes it say. With
 * `alive`, it answers liveness pings (a running worker that never finishes a decode).
 * `reply(fields)` emits a protocol message addressed to the client that last posted.
 */
export function silentDecodePort({ alive = false } = {}) {
  const target = new EventTarget(), posted = [];
  let terminated = 0;
  const port = {
    posted,
    get terminated() { return terminated; },
    types: () => posted.map(message => message.type),
    decodes: () => posted.filter(message => message.type === 'decode'),
    postMessage(message) {
      posted.push(message);
      if (alive && message.type === 'ping') queueMicrotask(() => port.reply({ type: 'pong' }));
    },
    addEventListener: target.addEventListener.bind(target),
    emit(type, fields = {}) { target.dispatchEvent(Object.assign(new Event(type), fields)); },
    reply(fields) { port.emit('message', { data: { protocol: DECODE_PROTOCOL, client: posted.at(-1)?.client, ...fields } }); },
    terminate() { terminated++; },
  };
  return port;
}

export const nextTask = () => new Promise(resolve => setImmediate(resolve));
export const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
/** Wait for a condition, failing after `ms` instead of spinning forever. */
export async function until(condition, ms = 10_000, what = 'the awaited condition') {
  const deadline = performance.now() + ms;
  while (!condition()) {
    if (performance.now() > deadline) throw new Error(`timed out after ${ms} ms waiting for ${what}`);
    await nextTask();
  }
}
/** Settle a promise or report that it is still pending after `ms`: no test waits forever. */
export const within = (promise, ms) => Promise.race([
  promise.then(value => ({ resolved: value }), error => ({ rejected: error })),
  sleep(ms).then(() => ({ pending: true })),
]);
