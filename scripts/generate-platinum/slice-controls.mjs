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

// Progress bar (composeProgress wants fill -10079, track -10078, frame -10080).
// The #22 bar is ~99% full, so there's no empty track to slice — we SLICE the
// real blue 3-D fill (sources/progress-dialog-copy-desktop.png, the bar at
// y98..108, a dark border → blue ramp → sheen → ramp → dark border) and pair it
// with a constructed recessed gray track (no empty-track reference exists).
const PROGRESS = { src: 'progress-dialog-copy-desktop.png', fillRect: [119, 98, 8, 11] };

function buildProgress(srcDir, destDir, cache) {
  const out = {};
  const W = 8;
  // fill: sliced real blue
  const im = (cache[PROGRESS.src] ??= decodePng(readFileSync(resolve(srcDir, 'sources', PROGRESS.src))));
  const [fx, fy, fw, fh] = PROGRESS.fillRect;
  const fill = new Uint8Array(fw * fh * 4);
  for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) {
    const si = ((fy + y) * im.width + (fx + x)) * 4, di = (y * fw + x) * 4;
    fill[di] = im.rgba[si]; fill[di + 1] = im.rgba[si + 1]; fill[di + 2] = im.rgba[si + 2]; fill[di + 3] = 255;
  }
  writeFileSync(resolve(destDir, 'cicns/cicn-n10079-progress-fill.png'), encodePng(fw, fh, fill));
  out['progress-fill'] = chromeEl('cicns/cicn-n10079-progress-fill.png', fw, fh, -10079);

  // track: constructed recessed light channel, same height, dark top/bottom borders.
  const chan = [50, 210, 226, 236, 240, 240, 236, 228, 218, 208, 50]; // per-row gray (fh=11)
  const track = new Uint8Array(W * fh * 4);
  for (let y = 0; y < fh; y++) for (let x = 0; x < W; x++) {
    const v = chan[Math.min(chan.length - 1, y)]; const di = (y * W + x) * 4;
    track[di] = v; track[di + 1] = v; track[di + 2] = v; track[di + 3] = 255;
  }
  writeFileSync(resolve(destDir, 'cicns/cicn-n10078-progress-track.png'), encodePng(W, fh, track));
  out['progress-track'] = chromeEl('cicns/cicn-n10078-progress-track.png', W, fh, -10078);
  return out;
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
  Object.assign(sliced, buildProgress(srcDir, destDir, cache));
  return { sliced, count: Object.keys(sliced).length };
}
