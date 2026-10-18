import type { ElementByteProvenance } from './loadProvenance.js';
import type { ControlColorSamples } from './types.js';
import type { PixelBuffer } from './pixelBuffer.js';

/** Observed selection decisions, not proof of original-engine fidelity. */
export interface ControlResolutionStep {
  readonly role: 'face' | 'default-ring';
  /** Canonical requested ID; the selected signed ID is recorded separately. */
  readonly requestedId: number;
  readonly action: 'selected' | 'missing' | 'rejected' | 'fallback';
  readonly owner?: { readonly baseUrl: string; readonly chainDepth: number };
  readonly resource?: {
    /** Absent means byte provenance was not collected for this exact entry. */
    readonly byteProvenance?: ElementByteProvenance;
    readonly type: 'cicn';
    readonly signedId: number | null;
    readonly sourceCinfId: number | null;
    readonly manifestKey: string;
    /** Volatile diagnostic detail; blob URLs are not stable identity keys. */
    readonly assetUrl: string;
  };
  readonly reason: string;
  readonly basis: 'source-dispatch' | 'compatibility-policy';
  readonly usage: 'paint' | 'layout-reservation';
}

export interface ControlRenderTrace {
  readonly version: 1;
  readonly correlationId?: string;
  readonly family: 'push-button' | 'bevel-button';
  readonly requested: {
    readonly state: 'active' | 'pressed' | 'inactive';
    readonly pressed: boolean;
    readonly disabled: boolean;
    readonly default?: boolean;
    readonly on?: boolean;
    readonly small?: boolean;
  };
  readonly steps: readonly ControlResolutionStep[];
  /** Actual label policy for the selected face; no original font/device claim. */
  readonly textColors?: {
    readonly foreground: string; readonly emboss: string | null;
    readonly policy: 'caller-override' | 'source-samples' | 'contrast-fallback';
    readonly embossDecision: ControlColorSamples['embossDecision'] | 'unavailable' | 'caller-override';
    readonly sampleFallbackReason: 'ambiguous-asset-path' | 'missing-text-sample' | null;
    readonly labelPainted: boolean; readonly deviceMode: 'full-color-policy';
    readonly sourceManifestKey: string; readonly sourceOwnerDepth: number;
  };
  readonly outcome: {
    readonly status: 'themed' | 'unavailable' | 'error';
    readonly width?: number;
    readonly height?: number;
  };
}

export interface ControlDiagnostics {
  readonly correlationId?: string;
  /** Called synchronously once with a frozen completed record. On render success,
   * callback exceptions propagate. On render failure, callback exceptions are
   * suppressed so the original renderer error is rethrown unchanged. */
  readonly onComplete: (trace: ControlRenderTrace) => void;
}

/** Private per-invocation collector. Never stores themes or decoded buffers. */
export interface ControlTraceCollector {
  record(step: ControlResolutionStep): void;
  textColors(value: NonNullable<ControlRenderTrace['textColors']>): void;
}

function freezeRecord<T>(value: T): T {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freezeRecord(child);
    Object.freeze(value);
  }
  return value;
}

export async function withControlDiagnostics(
  diagnostics: ControlDiagnostics | undefined,
  family: ControlRenderTrace['family'],
  requested: ControlRenderTrace['requested'],
  render: (collector?: ControlTraceCollector) => Promise<PixelBuffer | null>,
): Promise<PixelBuffer | null> {
  if (!diagnostics) return render();
  const { onComplete, correlationId } = diagnostics;
  const steps: ControlResolutionStep[] = [];
  let textColors: ControlRenderTrace['textColors'];
  const collector: ControlTraceCollector = { record: step => { steps.push(step); }, textColors: value => { textColors = value; } };
  let result: PixelBuffer | null = null;
  let failed = false;
  let error: unknown;
  try { result = await render(collector); }
  catch (cause) { failed = true; error = cause; }
  const trace: ControlRenderTrace = freezeRecord({
    version: 1,
    ...(correlationId === undefined ? {} : { correlationId }),
    family, requested, steps, ...(textColors ? { textColors } : {}),
    outcome: failed ? { status: 'error' } : result
      ? { status: 'themed', width: result.width, height: result.height }
      : { status: 'unavailable' },
  });
  // Callback failures are not renderer failures and must never trigger another
  // completion. Preserve an existing renderer error even if diagnostics fail.
  if (failed) {
    try { onComplete(trace); } catch { /* preserve the primary renderer failure */ }
    throw error;
  }
  onComplete(trace);
  return result;
}
