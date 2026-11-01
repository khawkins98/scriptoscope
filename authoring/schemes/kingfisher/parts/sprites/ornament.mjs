// Editable 1× PNGs, exported losslessly from the cleaned concept paint-over.
// Keep alpha binary (0/255) and colours on Kingfisher's system palette.
// Active/inactive files are independent art sources: editing one never
// silently recolours the other. Geometry and clipping belong to frames.mjs.
import { readFileSync } from 'node:fs';
import { decodePng } from '../../../../../scripts/lib/png-decode.mjs';
import { Raster } from '../../../../../tools/theme-author/raster.js';

function sprite(name) {
  const { width, height, rgba } = decodePng(readFileSync(new URL(name, import.meta.url)));
  const { raster, snapped } = Raster.fromRgba(width, height, rgba);
  if (snapped) throw new Error(`${name}: use binary alpha (0 or 255); ${snapped} pixels have partial alpha`);
  return raster;
}

export const SPRITES = Object.fromEntries(['active', 'inactive'].map((state) => [state, {
  bird: sprite(`kingfisher-${state}.png`),
  ripple: sprite(`ripple-${state}.png`),
}]));

for (const name of ['bird', 'ripple']) {
  const active = SPRITES.active[name], inactive = SPRITES.inactive[name];
  if (active.width !== inactive.width || active.height !== inactive.height) {
    throw new Error(`Kingfisher ${name}: active and inactive PNG dimensions must match`);
  }
}
