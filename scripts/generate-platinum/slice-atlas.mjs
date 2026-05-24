// scripts/generate-platinum/slice-atlas.mjs
// Read a (hand-painted) master atlas PNG back into the per-type cicn PNGs at
// their native dimensions, using the SAME fixed layout coordinates the atlas was
// generated with (computeAtlasLayout — shared with atlas.mjs, so generate +
// slice always agree). Run via scripts/slice-platinum-atlas.mjs.
//
// Down-sampling: each native pixel was drawn as a `scale`×`scale` block. We
// sample the block's INTERIOR (centre), which dodges the 1px magenta slice
// lines (drawn at block-left edges for the cell-boundary columns and at the
// divider row). Fully-transparent atlas px (none in a painted atlas, but the
// page bg is opaque) map straight through.
import { computeAtlasLayout } from './atlas-layout.mjs';
import { cicnFiles } from './manifest.mjs';
import { WINDOW_TYPES } from './window-types.mjs';

const MAGENTA = [255, 0, 255];
function isMagenta(r, g, b) { return r === MAGENTA[0] && g === MAGENTA[1] && b === MAGENTA[2]; }

/**
 * Slice a decoded atlas image into per-type cicn RGBA buffers.
 * @param {{width:number,height:number,rgba:Uint8ClampedArray|Uint8Array}} atlas
 * @returns {Array<{slug:string, state:string, file:string, width:number, height:number, rgba:Uint8Array}>}
 */
export function sliceAtlas(atlas) {
  const layout = computeAtlasLayout();
  const { scale } = layout;
  const cfgBySlug = Object.fromEntries(WINDOW_TYPES.map((c) => [c.slug, c]));
  const half = Math.floor(scale / 2);

  // Map each cicn id to its filename via cicnFiles (active = wndId+1).
  const fileFor = (cfg, state) => {
    const f = cicnFiles(cfg, cfg.wndId, cfg.wndId + 1);
    return state === 'active' ? f.active : f.inactive;
  };

  const out = [];
  for (const slot of layout.slots) {
    const { cicnW, cicnH, sprite } = slot;
    const rgba = new Uint8Array(cicnW * cicnH * 4);
    for (let py = 0; py < cicnH; py++) {
      for (let px = 0; px < cicnW; px++) {
        // Sample the block interior; if that pixel is a magenta slice line,
        // step inward to a non-magenta neighbour within the block.
        let sxBase = sprite.x + px * scale + half;
        let syBase = sprite.y + py * scale + half;
        let r, g, b, a;
        let found = false;
        for (let oy = 0; oy < scale && !found; oy++) {
          for (let ox = 0; ox < scale && !found; ox++) {
            const sx = sprite.x + px * scale + ((half + ox) % scale);
            const sy = sprite.y + py * scale + ((half + oy) % scale);
            const i = (sy * atlas.width + sx) * 4;
            const pr = atlas.rgba[i], pg = atlas.rgba[i + 1], pb = atlas.rgba[i + 2], pa = atlas.rgba[i + 3];
            if (!isMagenta(pr, pg, pb)) { r = pr; g = pg; b = pb; a = pa; found = true; }
          }
        }
        if (!found) { // whole block magenta (shouldn't happen) — emit transparent
          const i0 = (syBase * atlas.width + sxBase) * 4;
          r = atlas.rgba[i0]; g = atlas.rgba[i0 + 1]; b = atlas.rgba[i0 + 2]; a = atlas.rgba[i0 + 3];
        }
        const o = (py * cicnW + px) * 4;
        rgba[o] = r; rgba[o + 1] = g; rgba[o + 2] = b; rgba[o + 3] = a;
      }
    }
    const cfg = cfgBySlug[slot.slug];
    out.push({ slug: slot.slug, state: slot.state, file: fileFor(cfg, slot.state), width: cicnW, height: cicnH, rgba });
  }
  return out;
}
