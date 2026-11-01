// Frame pass-through hits: web host policy (docs/spec/engine/hit-regions.md §9). Pure helpers;
// the WindowManager (interactive.ts) owns the layers, modes and outside-press tracking.
import type { Region } from './raster.js';
import { debug } from './debug.js';

/** HP48: the public window types whose title axis is left/right (canonical slugs; aliases resolve
 *  through `canonicalWindowTypeSlug`). Every other type is top-titled. A declared mapping, not a decode. */
export const SIDE_TITLED_TYPES: ReadonlySet<string> = new Set(['side-floating-utility-window', 'collapsed-side-floating-utility-window']);

/** A window's hit mode (HP1). */
export type HitMode = 'region' | 'box';

/** HP10: trimmed and case-insensitive. Absent, empty or unknown values are `undefined` (the caller
 *  inherits); an empty or unknown value (anything but absent) logs once per call through `debug`. */
export function parseHit(value: unknown, where: string): HitMode | undefined {
  if (value == null) return undefined;
  const v = String(value).trim().toLowerCase();
  if (v === 'region' || v === 'box') return v;
  debug('region', 'ignored hit value', { where, value });
  return undefined;
}

/**
 * HP19: the region as one `path()` in the band decomposition. Consecutive rows with the same
 * run list form a band; each run of a band is one rectangle subpath, coordinates times the
 * integer display scale `k` (HP16). Empty string for an empty region.
 */
export function regionPath(r: Region, k: number): string {
  const out: string[] = [];
  let band: number[] = [], top = 0;
  const flush = (bottom: number): void => {
    for (let i = 0; i < band.length; i += 2) {
      const l = band[i]! * k, rr = band[i + 1]! * k;
      out.push(`M${l} ${top * k}H${rr}V${bottom * k}H${l}Z`);
    }
  };
  for (let y = 0; y <= r.height; y++) {
    const runs: number[] = [];
    for (let x = 0; y < r.height && x < r.width; x++) {
      if (!r.bits[y * r.width + x]) continue;
      const start = x;
      while (x < r.width && r.bits[y * r.width + x]) x++;
      runs.push(start, x);
    }
    if (y < r.height && runs.length === band.length && runs.every((v, i) => v === band[i])) continue;
    flush(y);
    band = runs; top = y;
  }
  return out.join('');
}
