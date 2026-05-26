// scripts/generate-platinum/build-controls.mjs
// Orchestrates the data-driven control generator: resolve the palette (WDEF
// bevel grays + the REAL extracted Platinum colors from platinum-palette.json),
// render every CONTROL_SPECS × state via the generic drawer, write the cicn PNGs,
// and return { chromeElements, assets } to merge into the replica bundle — exactly
// the shape graftControls returns, so it drops into generate-platinum.mjs.
//
// This SUPERSEDES the apple-platinum-2 / platinum-8 graft for the control IDs it
// generates: one coherent, decode-grounded source instead of borrowed 1999 art.
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { encodePng } from '../lib/png-encode.mjs';
import { PALETTE } from './palette.mjs';
import { CONTROL_SPECS, CONTROL_IDS } from './control-metrics.mjs';
import { drawControl } from './draw-control.mjs';

const tag = (id) => (id < 0 ? 'n' + Math.abs(id) : String(id));
const chromeEl = (file, w, h, id, slice) => ({
  asset: file, width: w, height: h, slice: slice ?? null,
  bgPattern: null, bgAnchor: null, textAnchor: null, embossAnchor: null,
  sourceCicnId: id, sourceCinfId: null,
});

// Build the drawer palette: grays from the verified WDEF model (palette.mjs),
// ring/highlight from the extracted cctb (platinum-palette.json — the genuine
// lavender/indigo Platinum highlight pair). Falls back gracefully if the JSON
// is absent.
function resolvePalette(root) {
  const jsonPath = resolve(root, 'themes/apple-platinum-replica/sources/platinum-palette.json');
  let cc = {};
  if (existsSync(jsonPath)) {
    try { cc = JSON.parse(readFileSync(jsonPath, 'utf8')).controlColors ?? {}; } catch { /* ignore */ }
  }
  const indigo = cc['14'] ?? [51, 51, 102];   // cctb highlight (default-ring / accent)
  const lavender = cc['13'] ?? [204, 204, 255];
  return {
    frame: [102, 102, 102],          // control outline (gray, softer than window black)
    face: PALETTE.plateBase,         // #ccc raised face
    light: PALETTE.windowHighlight,  // #fff top/left
    dark: PALETTE.pinstripeDark,     // #777 bottom/right
    facePressed: [170, 170, 170],    // pressed inset
    well: [255, 255, 255],           // recessed checkable interior
    channel: [221, 221, 221],        // track groove
    channelPressed: lavender,        // pressed track tint
    ring: indigo,                    // default-button ring (real Platinum indigo)
    ringInactive: [153, 153, 153],   // dimmed ring
    accent: indigo,                  // selection / progress fill
    glyph: [0, 0, 0],                // check / dot / glyph ink
  };
}

/**
 * Generate control cicns into destDir/cicns and return chromeElements + assets.
 * @param {string[]} [only] - restrict to these CONTROL_SPECS keys (default: all).
 * @returns {{chromeElements: object, assets: Array, ids: number[]}}
 */
export function buildControls(destDir, root, only) {
  const pal = resolvePalette(root);
  const chromeElements = {};
  const assets = [];
  const ids = [];
  const entries = only
    ? only.map((k) => [k, CONTROL_SPECS[k]])
    : Object.entries(CONTROL_SPECS);

  for (const [key, spec] of entries) {
    if (!spec) throw new Error(`build-controls: unknown control spec '${key}'`);
    const idMap = CONTROL_IDS[key] ?? {};
    for (const stateName of Object.keys(spec.states)) {
      const id = idMap[stateName];
      if (id == null) throw new Error(`control-metrics: no resource id for ${key}.${stateName}`);
      const img = drawControl(spec, stateName, pal);
      // chromeElement key: base name for the canonical state, suffixed otherwise,
      // so each state is a distinct element (lookup is by sourceCicnId/filename id).
      const isCanonical = stateName === 'active' || stateName === 'onActive' || stateName === 'normal';
      const elName = isCanonical ? spec.name : `${spec.name}-${stateName.toLowerCase()}`;
      const file = `cicns/cicn-${tag(id)}-${elName}.png`;
      writeFileSync(resolve(destDir, file), encodePng(img.width, img.height, img.rgba));
      chromeElements[elName] = chromeEl(file, img.width, img.height, id, spec.slice);
      assets.push({ type: 'cicn', id, name: elName, status: 'ok', file, width: img.width, height: img.height });
      ids.push(id);
    }
  }
  return { chromeElements, assets, ids };
}
