// scripts/generate-platinum/slice-controls.mjs
// Slices small CONTROL glyphs (checkbox, radio) straight out of Mac OS 8
// screenshots into cicns at the resource IDs the runtime renderer looks up
// (src/controls.ts composeCheckable). apple-platinum-2 keeps these at non-standard
// IDs (-10153..) so the renderer never finds them; these real slices fill that gap.
//
// Glyph rects measured from sources/general-controls-checks-radios.png (#25):
//   checkbox checked  x32,y58   12x12   (box + check mark)
//   checkbox empty    x32,y106  12x12   (empty recessed box)
//   radio selected    x468,y141 12x12   (filled centre)
//   radio unselected  x390,y141 12x12   (hollow recessed circle)
// Radios get transparent corners (outside the circle) so they composite cleanly
// on white document bodies as well as gray dialogs.
import { decodePng, encodePng } from '../diag-lib.mjs';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

// renderer resource IDs (controls.ts): checkbox -9500/-9503, radio -9488/-9491,
// with inactive twins -9501/-9504/-9489/-9492.
const SLICES = [
  { id: -9500, inactive: -9501, name: 'checkbox-checked', src: 'general-controls-checks-radios.png', rect: [32, 58, 12, 12] },
  { id: -9503, inactive: -9504, name: 'checkbox-empty',   src: 'general-controls-checks-radios.png', rect: [32, 106, 12, 12] },
  { id: -9488, inactive: -9489, name: 'radio-on',  src: 'general-controls-checks-radios.png', rect: [468, 141, 12, 12], circle: true },
  { id: -9491, inactive: -9492, name: 'radio-off', src: 'general-controls-checks-radios.png', rect: [390, 141, 12, 12], circle: true },
];

function chromeEl(file, w, h, id) {
  return { asset: file, width: w, height: h, slice: null, bgPattern: null, bgAnchor: null,
    textAnchor: null, embossAnchor: null, sourceCicnId: id, sourceCinfId: null };
}

/**
 * Slice the control glyphs into destDir/cicns and return chromeElements to merge.
 * @returns {{ sliced: Record<string, object>, count: number }}
 */
export function sliceControls(srcDir, destDir) {
  const sliced = {};
  const cache = {};
  for (const s of SLICES) {
    const im = (cache[s.src] ??= decodePng(readFileSync(resolve(srcDir, 'sources', s.src))));
    const [x, y, w, h] = s.rect;
    const out = new Uint8Array(w * h * 4);
    const cx = (w - 1) / 2, cy = (h - 1) / 2, r = w / 2; // circle radius for radios
    for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
      const si = ((y + yy) * im.width + (x + xx)) * 4, di = (yy * w + xx) * 4;
      const outside = s.circle && Math.hypot(xx - cx, yy - cy) > r;
      out[di] = im.rgba[si]; out[di + 1] = im.rgba[si + 1]; out[di + 2] = im.rgba[si + 2];
      out[di + 3] = outside ? 0 : 255;
    }
    const file = `cicns/cicn-n${-s.id}-${s.name}.png`;
    writeFileSync(resolve(destDir, file), encodePng(w, h, out));
    sliced[s.name] = chromeEl(file, w, h, s.id);
    if (s.inactive) sliced[`${s.name}-inactive`] = chromeEl(file, w, h, s.inactive); // reuse active glyph
  }
  return { sliced, count: SLICES.length };
}
