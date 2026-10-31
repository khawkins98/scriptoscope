// Kingfisher-pxl: Kingfisher with its normal-state checkboxes and radio buttons
// replaced by sprites drawn in claude-pxl (../kingfisher-agy.px.js, built to
// ../sprites/). A trial of bringing art from another tool into a scheme.
//
// Build:   npm run author -- authoring/experiments/pxl/variant
// Preview: /authoring-preview.html?scheme=/authoring/experiments/pxl/variant/scheme.rsrc
//          (build first; the output isn't committed)
import { readFileSync } from 'node:fs';
import { Raster, encodeCicn, encodeVers } from '../../../../tools/theme-author/index.js';
import { decodePng } from '../../../../scripts/lib/png-decode.mjs';
import { buildScheme as buildKingfisher } from '../../../schemes/kingfisher/scheme.mjs';

/** Load a PNG as a Raster; fail if it has soft (partial-alpha) edges. */
function sprite(name) {
  const { width, height, rgba } = decodePng(readFileSync(new URL(`../sprites/${name}.png`, import.meta.url)));
  const { raster, snapped } = Raster.fromRgba(width, height, rgba);
  if (snapped) throw new Error(`${name}.png has ${snapped} semi-transparent pixels; export with hard edges`);
  return raster;
}

// id = -9504 + 12·kind + 3·value + tier; tier 1 is the normal (enabled, unpressed) state.
const NORMAL = 1;
const REPLACE = {
  [-9504 + 0 * 12 + 0 * 3 + NORMAL]: 'checkbox_off',
  [-9504 + 0 * 12 + 1 * 3 + NORMAL]: 'checkbox_on',
  [-9504 + 0 * 12 + 2 * 3 + NORMAL]: 'checkbox_mixed',
  [-9504 + 1 * 12 + 0 * 3 + NORMAL]: 'radio_off',
  [-9504 + 1 * 12 + 1 * 3 + NORMAL]: 'radio_on',
};

export async function buildScheme() {
  const { resources } = await buildKingfisher();
  for (const r of resources) {
    if (r.type === 'cicn' && REPLACE[r.id]) r.data = encodeCicn(sprite(REPLACE[r.id]));
  }
  const vers = resources.find((r) => r.type === 'vers');
  if (vers) vers.data = encodeVers({ major: 0, minor: 1, short: '0.1', long: '0.1 Kingfisher-pxl (claude-pxl sprite trial)' });
  return { resources };
}
