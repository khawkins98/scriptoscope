// Resource-id expansion for family tables (tables/loaderNeeds.ts IdGrid) and
// the engine-wide loader needs. Pure.
import { ENGINE_LOADER_NEEDS, type IdGrid } from '../tables/loaderNeeds.js';

/** Every `base + t1 + t2 + …` (one term per array), first occurrence order, no duplicates. */
export function expandIdGrid(grid: IdGrid): number[] {
  let sums: number[] = [...grid.bases];
  for (const terms of grid.terms) sums = sums.flatMap(s => terms.map(t => s + t));
  return [...new Set(sums)];
}

/** The cicn ids every registered family draws with the icon blit (loader option `iconBlitCicnIds`). */
export function engineIconBlitCicnIds(): number[] {
  return [...new Set(ENGINE_LOADER_NEEDS.flatMap(n => n.iconBlitCicns.flatMap(expandIdGrid)))];
}

/** The cinf ids every registered family reads raw header bytes of (loader option `engineCinfIds`). */
export function engineCinfIds(): number[] {
  return [...new Set(ENGINE_LOADER_NEEDS.flatMap(n => (n.cinfs ?? []).flatMap(expandIdGrid)))];
}

/** The cicn ids some family draws through the line samplers (their sampler companion is loaded). */
export function engineLineSampledCicnIds(): number[] {
  return [...new Set(ENGINE_LOADER_NEEDS.flatMap(n => (n.lineSampledCicns ?? []).flatMap(expandIdGrid)))];
}
