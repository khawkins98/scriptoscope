// Entry of the opt-in decode worker, published as `@khawkins98/scriptoscope/decode-worker`.
// A consumer creates it and passes it as the `decodeWorker` load option:
//
//   new Worker(new URL('@khawkins98/scriptoscope/decode-worker', import.meta.url), { type: 'module' })
//
// The module only listens for decode requests; it has no exports.
import { serveDecodeRequests } from './decodeWorkerHost.js';

serveDecodeRequests(globalThis);
