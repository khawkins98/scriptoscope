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
import { readFileSync, writeFileSync, copyFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { decodePng, encodePng } from '../diag-lib.mjs';

// The Mac OS 8.5/8.6 default "Blue" Appearance accent, sampled from real
// screenshots (#22 progress fill + #14 scrollbar thumb agree): dark→light ramp.
// apple-platinum-2's accent elements (the thumb) use Orion's PURPLE accent, so
// we remap them to this blue ramp by lightness — same bevel/ridge structure,
// the real default accent colour.
const ACCENT_DARK = [47, 27, 142];
const ACCENT_LIGHT = [196, 203, 252];
const ACCENT_RECOLOR_IDS = new Set([-10205, -10206, -10207, -10208]); // scroll thumbs

function recolorToAccent(img) {
  const lum = (i) => 0.3 * img.rgba[i] + 0.59 * img.rgba[i + 1] + 0.11 * img.rgba[i + 2];
  let lo = 255, hi = 0;
  for (let i = 0; i < img.rgba.length; i += 4) { if (img.rgba[i + 3] < 128) continue; const l = lum(i); if (l < lo) lo = l; if (l > hi) hi = l; }
  const span = Math.max(1, hi - lo);
  for (let i = 0; i < img.rgba.length; i += 4) {
    if (img.rgba[i + 3] < 128) continue;
    const t = (lum(i) - lo) / span;
    img.rgba[i]     = Math.round(ACCENT_DARK[0] + (ACCENT_LIGHT[0] - ACCENT_DARK[0]) * t);
    img.rgba[i + 1] = Math.round(ACCENT_DARK[1] + (ACCENT_LIGHT[1] - ACCENT_DARK[1]) * t);
    img.rgba[i + 2] = Math.round(ACCENT_DARK[2] + (ACCENT_LIGHT[2] - ACCENT_DARK[2]) * t);
  }
  return img;
}

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
    const to = resolve(destDir, el.asset);
    if (ACCENT_RECOLOR_IDS.has(el.sourceCicnId)) {
      const img = recolorToAccent(decodePng(readFileSync(from)));
      writeFileSync(to, encodePng(img.width, img.height, img.rgba));
    } else {
      copyFileSync(from, to);
    }
    grafted[key] = el;
    seen.add(el.sourceCicnId);
    copied++;
  }
  const missing = [...ids].filter((id) => !seen.has(id));
  return { grafted, copied, missing };
}
