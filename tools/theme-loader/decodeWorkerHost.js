// Worker side of the opt-in decode worker: answers decode requests with the same
// decodeSchemeBytes stage the main thread runs by default. Kept separate from the
// entry (decodeWorker.js) so a test can host it over any message port.
import { decodeSchemeBytes, prewarmStuffItDecoder } from './decodeSchemeBytes.js';
import { DECODE_PROTOCOL, packDecodeResult, packDecodeError } from './decodeWorkerProtocol.js';

/** @param {{ addEventListener: Function, postMessage: Function }} scope the worker global or a port. */
export function serveDecodeRequests(scope) {
  scope.addEventListener('message', event => {
    const request = event.data;
    if (request?.protocol !== DECODE_PROTOCOL) return;
    if (request.type === 'prewarm') { prewarmStuffItDecoder(); return; }
    if (request.type !== 'decode') return;
    const { id, bytes, options } = request;
    decodeSchemeBytes(bytes, options).then(({ converted, byteProvenance }) => {
      const { message, transfer } = packDecodeResult({ converted, byteProvenance }, options.meta);
      scope.postMessage({ protocol: DECODE_PROTOCOL, type: 'result', id, ...message }, transfer);
    }).catch(error => {
      scope.postMessage({ protocol: DECODE_PROTOCOL, type: 'error', id, error: packDecodeError(error) });
    });
  });
}
