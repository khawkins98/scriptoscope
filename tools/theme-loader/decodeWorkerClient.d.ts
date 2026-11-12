import type { DecodeWorkerOption } from './loadKaleidoscopeScheme.js';

export const DEFAULT_DECODE_WORKER_TIMEOUT_MS: number;
/** Longest wait for a worker's first sign of life (shorter when the load's timeout is). */
export const DECODE_WORKER_HANDSHAKE_MS: number;

interface DecodeWorkerSettings {
  decodeWorker?: DecodeWorkerOption | undefined;
  decodeWorkerTimeoutMs?: number | undefined;
}
/** Loader-internal. Whether a load with these options will decode in the worker; calls
 * no factory and posts nothing. Throws a TypeError for a malformed worker option. */
export function willDecodeInWorker(options: DecodeWorkerSettings & {
  displayProfile?: unknown; cicnTransfer?: unknown; cinfEnvironment?: unknown; sliderLayoutEnvironment?: unknown; meta?: unknown;
}): boolean;
/** Loader-internal. Obtain the worker ahead of the bytes, start its liveness check and,
 * with `stuffIt`, ask it for the lazy StuffIt decoder. Throws what a factory throws. */
export function startDecodeWorker(options: DecodeWorkerSettings, stuffIt: boolean): void;
