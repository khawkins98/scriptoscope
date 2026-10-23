// Per-call engine trace (v2 PLAN §3): `{family, inputs, resolved[], rects,
// drawOps[]}`. One trace describes one driver call. The diff gate compares two
// traces of the same call made by different builds, so a trace holds only
// plain JSON data and `canonicalTrace` gives a key-order-independent string.
//
// Primitives append to a trace only when one is passed in; untraced calls pay
// nothing. A draw op names the decision-table row that produced it (`row`, the
// spec row id such as `T5` or `B3`), so a reviewer can map every recorded step
// to a spec sentence.
import type { QdRect } from './qd/types.js';
import type { ControlBandPaint, ControlResolutionStep } from '../controlDiagnostics.js';
import type { ControlCompositionSnapshot } from '../controlComposition.js';

/** Adapter observations captured with the selected value, never a second lookup. */
export type ResourceSelection = Pick<ControlResolutionStep, 'owner' | 'resource' | 'cinfLookup'>;

/** One resource request and its outcome. */
export interface ResolvedResource {
  type: string;
  id: number;
  found: boolean;
  /** Provider that answered (null when not found). */
  provider: string | null;
  /** The provider's tier: `archive`, `base` or `procedural` (null when not found). */
  tier: string | null;
  /** Spec/table row that issued the request, e.g. `cinf-request` or `B4`. */
  row?: string;
  selection?: ResourceSelection;
}

/** One primitive call. `op` names the primitive; extra fields are op-specific JSON. */
export interface DrawOp {
  op: string;
  /** Decision-table row(s) taken, e.g. `T6` or `E3`. */
  row?: string;
  src?: QdRect;
  dst?: QdRect;
  [field: string]: unknown;
}

export interface EngineTrace {
  family: string;
  inputs: Record<string, unknown>;
  resolved: ResolvedResource[];
  rects: Record<string, QdRect>;
  drawOps: DrawOp[];
  /** Opt-in adapter diagnostics; ordinary family traces retain their shape. */
  controlPaint?: {
    clip?: QdRect;
    context?: ControlCompositionSnapshot;
    bodies: ControlResolutionStep[];
    bands: ControlBandPaint[];
  };
}

export function createTrace(family: string, inputs: Record<string, unknown> = {}): EngineTrace {
  return { family, inputs: structuredClone(inputs), resolved: [], rects: {}, drawOps: [] };
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(value).sort()) out[k] = sortKeys((value as Record<string, unknown>)[k]);
    return out;
  }
  return value;
}

/** Stable serialisation: object keys sorted at every level, array order kept. */
export function canonicalTrace(trace: EngineTrace): string {
  return JSON.stringify(sortKeys(trace));
}
