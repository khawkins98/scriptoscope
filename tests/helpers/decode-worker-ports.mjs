// Node stand-ins for a browser decode Worker, for the pure-Node unit suite.
import { MessageChannel } from 'node:worker_threads';
import { serveDecodeRequests } from '../../tools/theme-loader/decodeWorkerHost.js';

/**
 * The real worker host behind a real MessageChannel: requests and answers cross the
 * same structured clone and buffer transfer a browser Worker performs. With `hold`,
 * answers queue until `release()`.
 */
export function hostedDecodeWorker(t, { hold = false } = {}) {
  const { port1, port2 } = new MessageChannel();
  t.after(() => { port1.close(); port2.close(); });
  const requests = [], held = [];
  let terminated = 0;
  const worker = {
    requests, holding: hold,
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
      if (worker.holding) held.push(() => port2.postMessage(message, transfer)); else port2.postMessage(message, transfer);
    },
  });
  return worker;
}

/** A port that records requests and answers only when the test emits an event. */
export function silentDecodePort() {
  const target = new EventTarget(), posted = [];
  return {
    posted,
    postMessage(message) { posted.push(message); },
    addEventListener: target.addEventListener.bind(target),
    emit(type, fields = {}) { target.dispatchEvent(Object.assign(new Event(type), fields)); },
  };
}

export const nextTask = () => new Promise(resolve => setImmediate(resolve));
