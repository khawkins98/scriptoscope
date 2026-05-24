// scripts/generate-platinum/slice-atlas.mjs
// Read a (hand-painted) PAINTABLE atlas PNG back into the per-type cicn PNGs at
// their native dimensions, using the SAME layout coordinates the atlas was
// generated with (computePaintableLayout — shared with atlas.mjs, so generate +
// slice always agree). Run via scripts/slice-platinum-atlas.mjs.
//
// The paintable atlas is 1× native: each sprite occupies a layout rect of EXACTLY
// its native (w,h), separated from its neighbours by a magenta gutter. So slicing
// is a clean 1:1 copy of each sprite rect — no downsampling, no magenta-dodging
// (the magenta lives only in the gutters, outside every sprite rect).
import { computePaintableLayout } from './atlas-layout.mjs';
import { cicnFiles } from './manifest.mjs';
import { WINDOW_TYPES } from './window-types.mjs';

/**
 * Slice a decoded paintable atlas image into per-type cicn RGBA buffers.
 * @param {{width:number,height:number,rgba:Uint8ClampedArray|Uint8Array}} atlas
 * @returns {Array<{slug:string, state:string, file:string, width:number, height:number, rgba:Uint8Array}>}
 */
export function sliceAtlas(atlas) {
  const layout = computePaintableLayout();
  const cfgBySlug = Object.fromEntries(WINDOW_TYPES.map((c) => [c.slug, c]));

  // Map each cicn id to its filename via cicnFiles (active = wndId+1).
  const fileFor = (cfg, state) => {
    const f = cicnFiles(cfg, cfg.wndId, cfg.wndId + 1);
    return state === 'active' ? f.active : f.inactive;
  };

  const out = [];
  for (const slot of layout.slots) {
    const { cicnW, cicnH, sprite } = slot;
    const rgba = new Uint8Array(cicnW * cicnH * 4);
    // 1:1 copy of the sprite rect (rect dims == native cicn dims at scale 1).
    for (let py = 0; py < cicnH; py++) {
      for (let px = 0; px < cicnW; px++) {
        const sx = sprite.x + px;
        const sy = sprite.y + py;
        const i = (sy * atlas.width + sx) * 4;
        const o = (py * cicnW + px) * 4;
        rgba[o] = atlas.rgba[i];
        rgba[o + 1] = atlas.rgba[i + 1];
        rgba[o + 2] = atlas.rgba[i + 2];
        rgba[o + 3] = atlas.rgba[i + 3];
      }
    }
    const cfg = cfgBySlug[slot.slug];
    out.push({ slug: slot.slug, state: slot.state, file: fileFor(cfg, slot.state), width: cicnW, height: cicnH, rgba });
  }
  return out;
}
