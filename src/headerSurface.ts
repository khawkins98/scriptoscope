import type { ControlCompositionContext, ControlCompositionSnapshot, ControlRect } from './controlComposition.js';
import type { ControlDiagnostics } from './controlDiagnostics.js';
import type { PixelBuffer } from './pixelBuffer.js';

export interface HeaderSurfaceOptions {
  /** Whole Appearance header surface; never a column or a label. */
  kind: 'window-header' | 'list-view-header';
  width: number;
  height: number;
  /** Raw UInt32 callback state: zero selects -9568, every nonzero value -9567. */
  drawState: number;
  compositionContext: ControlCompositionContext;
  diagnostics?: ControlDiagnostics;
}
export type HeaderSurfaceUnsupportedReason = 'unknown-clip' | 'special-window-origin' | 'missing-slice' | 'invalid-slice'
  | 'missing-body-request' | 'invalid-body-request' | 'cicn-body' | 'unknown-pattern-origin' | 'nonopaque-pattern'
  | 'ambiguous-body-selection' | 'missing-background-sample' | 'unverified-line-sampling' | 'unsafe-source-geometry' | 'nonbinary-mask';
export type HeaderSurfaceResult = { status: 'rendered'; buffer: PixelBuffer }
  | { status: 'unavailable'; reason: 'missing-face' }
  | { status: 'unsupported'; reason: HeaderSurfaceUnsupportedReason };

/** Diagnostic decisions are implementation observations, not original captures. */
export interface HeaderSurfaceTrace {
  readonly kind: HeaderSurfaceOptions['kind'];
  readonly drawState: number;
  readonly requestedRect: ControlRect;
  readonly paintRect: ControlRect;
  readonly context: ControlCompositionSnapshot;
  /** Returned pixels are always cropped to requestedRect, even with unbounded clip. */
  readonly effectiveClip: ControlRect | null;
  readonly admission: 'rendered' | 'unavailable' | 'unsupported' | 'error';
  /** Any admitted body/border pixel write, not final contribution attribution. */
  readonly painted?: boolean;
  readonly reason?: HeaderSurfaceUnsupportedReason | 'missing-face';
  readonly geometry: 'pach130-ordinary-full-color';
  readonly sourceSelection: 'current-manifest-compatibility';
  readonly backgroundPolicy?: 'raw-sample-current-display';
  /** Clipped union coverage before masked borders, not final visible contribution. */
  readonly patternBody?: { readonly phase: readonly [number, number]; readonly width: number; readonly height: number; readonly paintedPixels: number };
  readonly lineSampling?: 'not-required' | 'equivalent-current-display' | 'sampled-companion' | 'unverified';
}
