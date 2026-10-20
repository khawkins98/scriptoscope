import type { CinfLookupView } from '../tools/theme-loader/cinf-environment.js';
import type { BitmapTextPaint } from './preparedBitmapFont.js';
import type { ControlColorSamples } from './types.js';
import type { ControlCompositionSnapshot, ControlRect } from './controlComposition.js';
import type { ElementByteProvenance, PatternByteProvenance } from './loadProvenance.js';
import type { PixelBuffer } from './pixelBuffer.js';
import type { HeaderSurfaceTrace } from './headerSurface.js';

/** Observed selection decisions, not proof of original-engine fidelity. */
export interface ControlResolutionStep {
  /** Explicit role-view admission, separate from static local pair identity. */
  readonly cinfLookup?: CinfLookupView;
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
    /** Static local pair; consumedCinf identifies an opted-in role view instead. */
    readonly sourceCinfId: number | null;
    readonly consumedCinf?: CinfLookupView;
    readonly manifestKey: string;
    /** Volatile diagnostic detail; blob URLs are not stable identity keys. */
    readonly assetUrl: string;
  } & ({ readonly type: 'cicn'; readonly byteProvenance?: ElementByteProvenance }
    | { readonly type: 'ppat'; readonly byteProvenance?: PatternByteProvenance });
  /** Completed bounded body stage; absent for selection-only or unpublished writes. */
  readonly bodyPaint?: { readonly branch: 'masked-copy' | 'unmasked-copy' | 'missing-erase';
    readonly sourceRect?: ControlRect; readonly destinationRect: ControlRect;
    readonly paintedPixels: number; readonly sourceAssetUrl?: string; readonly derivedPath?: string }
    | { readonly branch: 'pattern-fill-union'; readonly coordinateSpace: 'face-local-before-ring';
      /** Within the face allocation, before the separately declared port clip. Overlap is written once. */
      readonly unionRects: readonly ControlRect[]; readonly paintedPixels: number;
      readonly sourceAssetUrl: string; readonly sourceSize: readonly [number, number];
      /** Resolved sampling offset, not original QuickDraw phase evidence. */
      readonly phase: { readonly basis: 'modern-composition-policy'; readonly offset: readonly [number, number];
        readonly originalPatternPhase: 'unverified' };
      readonly context: ControlCompositionSnapshot };
  readonly reason: string;
  readonly basis: 'source-dispatch' | 'compatibility-policy';
  readonly usage: 'paint' | 'layout-reservation' | 'admission';
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

/** Completed compatibility raster stage, before label/ring overlays. Occupancy
 * is not a write count or a claim that these pixels survive later overlays. */
export interface LegacyFacePaint {
  readonly basis: 'compatibility-policy';
  readonly operation: 'legacy-nine-slice-and-sample-fill';
  readonly coordinateSpace: 'face-local-before-ring';
  readonly owner: { readonly baseUrl: string; readonly chainDepth: number };
  readonly resource: NonNullable<ControlResolutionStep['resource']>;
  readonly sourceRect: ControlRect;
  readonly destinationRect: ControlRect;
  readonly requestedInsets: { readonly l: number; readonly t: number; readonly r: number; readonly b: number };
  readonly insetPolicy: 'pixel-buffer-nine-slice-source-clamp';
  readonly mode: 'tile' | 'stretch';
  readonly rasterAlpha: 'copy-source-rgba';
  readonly centerFill?: { readonly sourcePoint: readonly [number, number]; readonly sampledDisplayRgba: readonly [number, number, number, number];
    readonly destinationRect: ControlRect; readonly outputAlpha: 255 };
  readonly controlOrigin: readonly [number, number];
  /** Declared port-space clip. Unknown/unbounded apply no additional clip. */
  readonly declaredClip: ControlCompositionSnapshot['clip'];
  readonly effectiveFaceClip: ControlRect;
  readonly retainedNonzeroAlphaPixels: number;
}

export interface ControlRenderTrace {
  readonly version: 1;
  readonly correlationId?: string;
  readonly family: 'push-button' | 'bevel-button' | 'tab' | 'header-surface';
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
  readonly legacyFacePaint?: LegacyFacePaint;
  readonly bitmapTextPaint?: BitmapTextPaint;
  readonly headerSurface?: HeaderSurfaceTrace;
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
  /** Enrich exactly the earlier observed selection without adding a second selection. */
  completeBodyPaint(selection: ControlResolutionStep, paint: NonNullable<ControlResolutionStep['bodyPaint']>): void;
  bandPaint(value: ControlBandPaint): void;
  legacyFacePaint(value: LegacyFacePaint): void;
  bitmapTextPaint(value: BitmapTextPaint): void;
  tabBody(value: TabBodyTrace): void;
  headerSurface(value: HeaderSurfaceTrace): void;
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
  let legacyFacePaint: LegacyFacePaint | undefined;
  let bitmapTextPaint: BitmapTextPaint | undefined;
  let headerSurface: HeaderSurfaceTrace | undefined;
  let textColors: ControlRenderTrace['textColors'];
  let composition: ControlRenderTrace['composition'];
  const collector: ControlTraceCollector = {
    completeBodyPaint: (selection, bodyPaint) => {
      const index = steps.indexOf(selection);
      if (index >= 0) steps[index] = { ...selection, bodyPaint };
    },
    bitmapTextPaint: value => { bitmapTextPaint = value; },
    legacyFacePaint: value => { legacyFacePaint = value; },
    bandPaint: value => { bandPaints.push(value); }, headerSurface: value => { headerSurface = value; },
    tabBody: value => { tabBody = value; }, record: step => { steps.push(step); },
    composition: value => { composition = value; }, textColors: value => { textColors = value; },
  };
  let result: PixelBuffer | null = null;
  let failed = false;
  let error: unknown;
  try { result = await render(collector); }
  catch (cause) { failed = true; error = cause; }
  const trace: ControlRenderTrace = freezeRecord({
    version: 1,
    ...(correlationId === undefined ? {} : { correlationId }),
    // A later default-ring failure can invalidate an already composed face.
    // Keep patterned lookup observations, but never label unpublished writes as completed.
    family, requested, steps: steps.flatMap(step => {
      if ((!result || failed) && step.bodyPaint?.branch === 'pattern-fill-union') {
        const { bodyPaint: _unpublished, ...selection } = step;
        return [selection];
      }
      return failed && step.bodyPaint ? [] : [step];
    }),
    ...(!failed && result && bitmapTextPaint ? { bitmapTextPaint } : {}),
    ...(!failed && result && legacyFacePaint ? { legacyFacePaint } : {}),
    ...(bandPaints.length ? { bandPaints } : {}), ...(tabBody ? { tabBody } : {}), ...(headerSurface ? { headerSurface } : {}), ...(textColors ? { textColors } : {}), ...(composition ? { composition } : {}),
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
