// scripts/generate-platinum/graft-controls.mjs
// apple-platinum-2 (Orion Dimitrakopoulos, 1999) carries NO window recipes
// (no wnd# resources — its windows lean on the base WDEF), but it DOES carry a
// real Platinum control set: scrollbar tracks + thumbs, grow box, tabs, etc.
// Our generated apple-platinum-replica has window recipes but zero controls, so
// we graft apple-platinum-2's control cicns + their chromeElements entries in.
//
// The runtime (src/controls.ts) resolves controls by Mac OS resource ID
// (sourceCicnId), not by slug, so grafted entries are found regardless of name.
//
// Grafted (clean, correctly-typed in apple-platinum-2):
//   scrollbar tracks  -8277..-8280 (V), -8285..-8288 (H)
//   scroll thumbs     -10206/-10205 (H/H-pressed), -10208/-10207 (V/V-pressed)
//   grow box          -14330 (active), -14334 (inactive)
//   tabs              -9972/-9975 (small front/back), -9980/-9983 (large)
//
// Deliberately NOT grafted yet:
//   progress  -10078/-10079/-10080 are per-accent COLOR variants in
//             apple-platinum-2, not the frame/track/fill the renderer expects.
//   button    -10238/-10239/-10240 exist but are raw-named (cicn--102xx);
//             need a visual check before trusting them as button art.
//   checkbox/radio  apple-platinum-2 keeps these at -10153.. not the renderer's
//             -9500../-9488.. — needs an ID remap.
// These are left to texture-hydration from real control screenshots.
import { readFileSync, copyFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

export const GRAFT_CONTROL_IDS = new Set([
  -8277, -8278, -8279, -8280,        // vertical scrollbar track
  -8285, -8286, -8287, -8288,        // horizontal scrollbar track
  -10206, -10205, -10208, -10207,    // scroll thumbs
  -14330, -14334,                    // grow box active/inactive
  -9972, -9975, -9980, -9983,        // tabs
]);

/**
 * Copy the grafted control cicns from srcDir into destDir and return the
 * chromeElements entries to merge into the destination theme.
 * @returns {{ grafted: Record<string, object>, copied: number, missing: number[] }}
 */
export function graftControls(srcDir, destDir, ids = GRAFT_CONTROL_IDS) {
  const src = JSON.parse(readFileSync(resolve(srcDir, 'theme.json'), 'utf8'));
  const grafted = {};
  const seen = new Set();
  let copied = 0;
  for (const [key, el] of Object.entries(src.chromeElements || {})) {
    if (!ids.has(el.sourceCicnId)) continue;
    const from = resolve(srcDir, el.asset);
    if (!existsSync(from)) continue;
    copyFileSync(from, resolve(destDir, el.asset));
    grafted[key] = el;
    seen.add(el.sourceCicnId);
    copied++;
  }
  const missing = [...ids].filter((id) => !seen.has(id));
  return { grafted, copied, missing };
}
