import type { ControlColorSamples } from './types.js';
import type { ControlCompositionSnapshot, ControlRect } from './controlComposition.js';
import type { ElementByteProvenance, PatternByteProvenance } from './loadProvenance.js';
import type { PixelBuffer } from './pixelBuffer.js';

/** Observed selection decisions, not proof of original-engine fidelity. */
export interface ControlResolutionStep {
  readonly role: 'face' | 'default-ring' | 'body-fill';
  /** Raw cinf mode for body dependency decisions; never inferred from a label. */
  readonly bodyMode?: number;
  readonly requestedResourceType?: 'cicn' | 'ppat';
  /** Canonical requested ID; the selected signed ID is recorded separately. */
  readonly requestedId: number;
  readonly action: 'selected' | 'missing' | 'rejected' | 'fallback';
  readonly owner?: { readonly baseUrl: string; readonly chainDepth: number };
  readonly resource?: {
    readonly signedId: number | null;
    readonly sourceCinfId: number | null;
    readonly manifestKey: string;
    /** Volatile diagnostic detail; blob URLs are not stable identity keys. */
    readonly assetUrl: string;
  } & ({ readonly type: 'cicn'; readonly byteProvenance?: ElementByteProvenance }
    | { readonly type: 'ppat'; readonly byteProvenance?: PatternByteProvenance });
  readonly reason: string;
  readonly basis: 'source-dispatch' | 'compatibility-policy';
  readonly usage: 'paint' | 'layout-reservation';
}

/** Actual tab assembly decision. Legacy reasons describe current compatibility
 * policy, not an original-engine fallback. No font/device fidelity is implied. */
export type TabBodyTrace = {
  readonly sourceWidth: number; readonly sourceHeight: number;
  readonly requestedWidth: number;
} & ({
  readonly path: 'source-bands'; readonly basis: 'source-dispatch';
  readonly center: 'empty' | 'solid';
  readonly backgroundPolicy: 'none' | 'raw-sample' | 'decoded-anchor';
  readonly corner: number; readonly side: number; readonly tile: boolean;
} | {
  readonly path: 'legacy-three-slice'; readonly basis: 'compatibility-policy';
  readonly reason: 'missing-slice' | 'invalid-slice-or-size' | 'missing-body-request'
    | 'invalid-body-request' | 'pattern-center' | 'missing-or-invalid-background-anchor' | 'masked-background';
});

/** Actual visible opaque border paint; not original device color evidence. */
export interface ControlBandPaint {
  readonly role: 'face' | 'default-ring';
  readonly region: number;
  readonly branch: 'copy' | 'horizontal-lines' | 'vertical-lines';
  readonly policy: 'ordinary-raster' | 'equivalent-raster' | 'sampled-companion' | 'compatibility-raster';
  readonly owner: { readonly baseUrl: string; readonly chainDepth: number };
  readonly resource: NonNullable<ControlResolutionStep['resource']>;
  readonly derived?: { readonly path: string; readonly assetUrl: string; readonly model: string; readonly displayPolicy: string };
}

export interface ControlRenderTrace {
  readonly version: 1;
  readonly correlationId?: string;
  readonly family: 'push-button' | 'bevel-button' | 'tab';
  readonly requested: {
    readonly state: 'active' | 'pressed' | 'inactive';
    readonly pressed: boolean;
    readonly disabled: boolean;
    readonly default?: boolean;
    readonly on?: boolean;
    readonly small?: boolean;
    readonly selected?: boolean;
  };
  readonly steps: readonly ControlResolutionStep[];
  readonly tabBody?: TabBodyTrace;
  readonly bandPaints?: readonly ControlBandPaint[];
  /** Actual label policy for the selected face; no original font/device claim. */
  readonly textColors?: {
    readonly foreground: string; readonly emboss: string | null;
    readonly policy: 'caller-override' | 'source-samples' | 'contrast-fallback';
    readonly embossDecision: ControlColorSamples['embossDecision'] | 'unavailable' | 'caller-override';
    readonly sampleFallbackReason: 'ambiguous-asset-path' | 'missing-text-sample' | null;
    readonly labelPainted: boolean; readonly deviceMode: 'full-color-policy';
    readonly sourceManifestKey: string; readonly sourceOwnerDepth: number;
  };
  /** Actual applied context/policy, not independent historical verification. */
  readonly composition?: { readonly context: ControlCompositionSnapshot; readonly originalPortState: 'unverified'; readonly faceRect: ControlRect; readonly appliedUnknownPatternOffset: boolean; };
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
  bandPaint(value: ControlBandPaint): void;
  tabBody(value: TabBodyTrace): void;
  textColors(value: NonNullable<ControlRenderTrace['textColors']>): void;
  composition(value: NonNullable<ControlRenderTrace['composition']>): void;
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
  let tabBody: TabBodyTrace | undefined;
  const bandPaints: ControlBandPaint[] = [];
  let textColors: ControlRenderTrace['textColors'];
  let composition: ControlRenderTrace['composition'];
  const collector: ControlTraceCollector = { bandPaint: value => { bandPaints.push(value); }, tabBody: value => { tabBody = value; }, record: step => { steps.push(step); }, composition: value => { composition = value; }, textColors: value => { textColors = value; } };
  let result: PixelBuffer | null = null;
  let failed = false;
  let error: unknown;
  try { result = await render(collector); }
  catch (cause) { failed = true; error = cause; }
  const trace: ControlRenderTrace = freezeRecord({
    version: 1,
    ...(correlationId === undefined ? {} : { correlationId }),
    family, requested, steps, ...(bandPaints.length ? { bandPaints } : {}), ...(tabBody ? { tabBody } : {}), ...(textColors ? { textColors } : {}), ...(composition ? { composition } : {}),
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
