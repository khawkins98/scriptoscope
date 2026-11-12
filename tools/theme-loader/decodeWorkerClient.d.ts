import type { DecodeWorkerOption } from './loadKaleidoscopeScheme.js';

export const DEFAULT_DECODE_WORKER_TIMEOUT_MS: number;
/** Loader-internal. Returns true when a load with these options decodes in the worker;
 * with `stuffIt` it also asks that worker for the lazy StuffIt decoder. Throws for a
 * malformed option or a throwing factory. */
export function prewarmDecodeWorker(
  options: { decodeWorker?: DecodeWorkerOption | undefined; decodeWorkerTimeoutMs?: number | undefined; [option: string]: unknown },
  stuffIt: boolean,
): boolean;
