// ResourceChain: data-driven resource lookup for engine drivers (v2 PLAN §3).
//
// Tiers, in search order:
//   archive     the scheme's own fork;
//   base        each base scheme in the inheritance chain, nearest first
//               (DECISIONS #5 and scrollbar §2 "Declared defaults": the
//               archive's own fork, then its base chain; the Kaleidoscope
//               control-panel fork is not shipped, a recorded divergence);
//   procedural  engine-supplied stand-ins (e.g. procedural Platinum art).
//
// `getResource` models GetResource `$A9A0` over the open-file chain: archive,
// then base providers, first non-null wins. That walk is ONE request, not a
// retry. The procedural tier is never searched implicitly: a request reaches
// it only when the caller names the spec/table row that authorises it
// (`procedural: '<row>'`). `get1Resource` models Get1Resource: one provider.
//
// Retries at a different id are never implicit either: `probe` takes the
// ordered id list from a decision-table row and records every request in the
// trace, including repeats of the same id (cinf-lookup-contract: a request
// that already equals the retry id is still made twice).
import type { EngineTrace, ResourceSelection } from '../trace.js';

export type ResourceTier = 'archive' | 'base' | 'procedural';

export interface ResourceProvider {
  /** Stable name for traces (e.g. the theme slug, or `procedural:platinum`). */
  readonly name: string;
  readonly tier: ResourceTier;
  /** The resource, or null/undefined when this provider has none. */
  get(type: string, id: number): unknown;
  /** Provenance bound to the same prepared value returned by get. */
  selection?(type: string, id: number): ResourceSelection | undefined;
}

export interface ResourceHit<T> {
  value: T;
  provider: ResourceProvider;
}

export interface RequestOptions {
  /** Spec/table row issuing the request; recorded in the trace. */
  row?: string;
  /** Allow the procedural tier, naming the spec/table row that authorises it. */
  procedural?: string;
  trace?: EngineTrace;
}

const TIER_ORDER: Record<ResourceTier, number> = { archive: 0, base: 1, procedural: 2 };

export class ResourceChain {
  readonly providers: readonly ResourceProvider[];

  constructor(providers: readonly ResourceProvider[]) {
    for (let i = 1; i < providers.length; i++) {
      if (TIER_ORDER[providers[i]!.tier] < TIER_ORDER[providers[i - 1]!.tier]) {
        throw new Error(`ResourceChain: provider ${providers[i]!.name} (${providers[i]!.tier}) is out of tier order`);
      }
    }
    if (providers.filter(p => p.tier === 'archive').length > 1) throw new Error('ResourceChain: at most one archive provider');
    this.providers = providers;
  }

  /** GetResource over archive → base (→ procedural only when authorised). */
  getResource<T>(type: string, id: number, opts: RequestOptions = {}): ResourceHit<T> | null {
    let hit: ResourceHit<T> | null = null;
    for (const p of this.providers) {
      if (p.tier === 'procedural' && !opts.procedural) continue;
      const v = p.get(type, id);
      if (v != null) { hit = { value: v as T, provider: p }; break; }
    }
    this.record(type, id, hit, opts);
    return hit;
  }

  /** Get1Resource: only `provider` is searched. */
  get1Resource<T>(type: string, id: number, provider: ResourceProvider, opts: RequestOptions = {}): ResourceHit<T> | null {
    const v = provider.get(type, id);
    const hit = v != null ? { value: v as T, provider } : null;
    this.record(type, id, hit, opts);
    return hit;
  }

  /**
   * Request each id in order until one is found. The id list is table data;
   * the chain adds no ids of its own and never skips a repeated id.
   */
  probe<T>(type: string, ids: readonly number[], opts: RequestOptions = {}): (ResourceHit<T> & { id: number }) | null {
    for (const id of ids) {
      const hit = this.getResource<T>(type, id, opts);
      if (hit) return { ...hit, id };
    }
    return null;
  }

  private record(type: string, id: number, hit: ResourceHit<unknown> | null, opts: RequestOptions): void {
    const selection = hit?.provider.selection?.(type, id);
    opts.trace?.resolved.push({
      type, id, found: hit != null,
      provider: hit?.provider.name ?? null, tier: hit?.provider.tier ?? null,
      ...(opts.row ? { row: opts.row } : {}),
      ...(selection ? { selection } : {}),
    });
  }
}

/** A provider over a plain `Map` keyed `type:id` (tests, synthetic forks, adapters). */
export function mapProvider(name: string, tier: ResourceTier, entries: Iterable<[string, unknown]>): ResourceProvider {
  const map = new Map(entries);
  return { name, tier, get: (type, id) => map.get(`${type}:${id}`) ?? null };
}
