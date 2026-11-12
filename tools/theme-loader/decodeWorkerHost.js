// Worker side of the opt-in decode worker: answers decode requests with the same
// decodeScheme stage the main thread runs by default. Kept separate from the
// entry (decodeWorker.js) so a test can host it over any message port.
import { decodeScheme, prewarmStuffItDecoder } from './decodeScheme.js';
import { DECODE_PROTOCOL, packDecodeResult, packDecodeError } from './decodeWorkerProtocol.js';

/** @param {{ addEventListener: Function, postMessage: Function }} scope the worker global or a port. */
export function serveDecodeRequests(scope) {
  scope.addEventListener('message', event => {
    const request = event.data;
    if (request?.protocol !== DECODE_PROTOCOL) return;
    const { client, id, type } = request;
    // Answered before anything else is touched: this is the client's liveness check.
    if (type === 'ping') { scope.postMessage({ protocol: DECODE_PROTOCOL, client, type: 'pong' }, []); return; }
    if (type === 'prewarm') { prewarmStuffItDecoder(); return; }
    if (type !== 'decode') return;
    const options = request.options ?? {};
    // The client only sends plain data options; the prepared-handle options that
    // decodeScheme also reads are absent here, so its validation of them is a no-op.
    Promise.resolve().then(() => decodeScheme(request.bytes, options)).then(({ converted, byteProvenance }) => {
      const { message, transfer } = packDecodeResult({ converted, byteProvenance }, options.meta);
      // Pixels are transferred, never copied: the worker keeps nothing of a finished load.
      scope.postMessage({ protocol: DECODE_PROTOCOL, client, type: 'result', id, ...message }, transfer);
    }).catch(error => {
      scope.postMessage({ protocol: DECODE_PROTOCOL, client, type: 'error', id, error: packDecodeError(error) }, []);
    });
  });
}
