// Frame pass-through hits: web host policy (docs/spec/engine/hit-regions.md §9). Pure helpers;
// the WindowManager (interactive.ts) owns the layers, modes and outside-press tracking.
import type { Region } from './raster.js';
import type { QdRect } from './engine/qd/types.js';
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
export interface NativeRect { left: number; top: number; right: number; bottom: number }
export interface RegionGeometry { path: string; rectangles: NativeRect[]; frame: NativeRect[] }

/** Prepare the paint path and native surfaces from one exact band decomposition. */
export function regionGeometry(r: Region, k: number, content?: QdRect): RegionGeometry {
  const frame: NativeRect[] = [];
  const rectangles: NativeRect[] = [];
  // SR11: C is solid. Emit it once and scan only the frame on either side, preserving holes
  // and disconnected runs without revisiting the content's area for every preparation.
  const solid = content && {
    left: Math.max(0, content.left), top: Math.max(0, content.top),
    right: Math.min(r.width, content.right), bottom: Math.min(r.height, content.bottom),
  };
  if (solid && solid.right > solid.left && solid.bottom > solid.top)
    rectangles.push({ left: solid.left * k, top: solid.top * k, right: solid.right * k, bottom: solid.bottom * k });
  let band: number[] = [], top = 0;
  const flush = (bottom: number): void => {
    for (let i = 0; i < band.length; i += 2) {
      const l = band[i]! * k, rr = band[i + 1]! * k;
      frame.push({ left: l, top: top * k, right: rr, bottom: bottom * k });
    }
  };
  for (let y = 0; y <= r.height; y++) {
    const runs: number[] = [];
    const scan = (left: number, right: number): void => {
      for (let x = left; y < r.height && x < right; x++) {
        if (!r.bits[y * r.width + x]) continue;
        const start = x;
        while (x < right && r.bits[y * r.width + x]) x++;
        runs.push(start, x);
      }
    };
    if (solid && solid.right > solid.left && y >= solid.top && y < solid.bottom) {
      scan(0, solid.left); scan(solid.right, r.width);
    } else scan(0, r.width);
    if (y < r.height && runs.length === band.length && runs.every((v, i) => v === band[i])) continue;
    flush(y);
    band = runs; top = y;
  }
  rectangles.push(...frame);
  return { rectangles, frame, path: rectangles.map(r => `M${r.left} ${r.top}H${r.right}V${r.bottom}H${r.left}Z`).join('') };
}

export function regionPath(r: Region, k: number, content?: QdRect): string {
  return regionGeometry(r, k, content).path;
}

/** Exact intersections, expressed relative to the original control's origin. */
export function targetIntersections(rectangles: readonly NativeRect[], box: NativeRect): NativeRect[] {
  return rectangles.flatMap(r => {
    const left = Math.max(r.left, box.left), top = Math.max(r.top, box.top);
    const right = Math.min(r.right, box.right), bottom = Math.min(r.bottom, box.bottom);
    return right > left && bottom > top
      ? [{ left: left - box.left, top: top - box.top, right: right - box.left, bottom: bottom - box.top }] : [];
  });
}
