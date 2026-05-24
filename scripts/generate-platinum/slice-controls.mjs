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
  // radio-on = the recessed empty ring + a SMALL centered dark dot (slicing the
  // reference's selected radio gave a dot that read too large/black at this size).
  { id: -9488, inactive: -9489, name: 'radio-on',  src: 'general-controls-checks-radios.png', rect: [390, 141, 12, 12], circle: true, dot: true },
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

// Slider (composeSlider: h track -10131 + thumb sheet -10129). The renderer sizes
// the output to the TRACK height and stamps the thumb at y:0, so the track must be
// as tall as the thumb with the groove centred + transparent padding; the thumb is
// a 4-state sheet stacked vertically (cell 1 = normal). Sliced from #24 Speech
// "Rate": groove at y103.., downward-pointing pentagon thumb at x178,y101 (15x16).
const SLIDER = { src: 'speech-panel-slider-popups.png', grooveX: 148, grooveY: 103, grooveH: 8,
  thumbX: 174, thumbY: 101, thumbW: 15, thumbH: 16 };

function buildSlider(srcDir, destDir, cache) {
  const out = {};
  const im = (cache[SLIDER.src] ??= decodePng(readFileSync(resolve(srcDir, 'sources', SLIDER.src))));
  const TW = 14, TH = SLIDER.thumbH;          // track height = thumb height so the thumb fits
  const pad = Math.floor((TH - SLIDER.grooveH) / 2);
  // track: groove strip centred vertically, transparent above/below.
  const track = new Uint8Array(TW * TH * 4);
  for (let y = 0; y < SLIDER.grooveH; y++) for (let x = 0; x < TW; x++) {
    const si = ((SLIDER.grooveY + y) * im.width + (SLIDER.grooveX + x)) * 4, di = ((pad + y) * TW + x) * 4;
    track[di] = im.rgba[si]; track[di + 1] = im.rgba[si + 1]; track[di + 2] = im.rgba[si + 2]; track[di + 3] = 255;
  }
  writeFileSync(resolve(destDir, 'cicns/cicn-n10131-slider-track.png'), encodePng(TW, TH, track));
  out['slider-track'] = chromeEl('cicns/cicn-n10131-slider-track.png', TW, TH, -10131);

  // thumb sheet: 4 cells stacked; cells 1..3 = the pentagon thumb, cell 0 blank.
  const PW = SLIDER.thumbW, PH = SLIDER.thumbH, cx = (PW - 1) / 2;
  const sheet = new Uint8Array(PW * (PH * 4) * 4);
  const stamp = (cellTop) => {
    for (let y = 0; y < PH; y++) for (let x = 0; x < PW; x++) {
      const half = y < 10 ? PW : (PW >> 1) - (y - 9); // rows 0-9 full rect, then triangle to a point
      if (Math.abs(x - cx) > half) continue;          // outside pentagon -> transparent
      const si = ((SLIDER.thumbY + y) * im.width + (SLIDER.thumbX + x)) * 4, di = ((cellTop + y) * PW + x) * 4;
      sheet[di] = im.rgba[si]; sheet[di + 1] = im.rgba[si + 1]; sheet[di + 2] = im.rgba[si + 2]; sheet[di + 3] = 255;
    }
  };
  for (let c = 1; c < 4; c++) stamp(c * PH);
  writeFileSync(resolve(destDir, 'cicns/cicn-n10129-slider-thumb.png'), encodePng(PW, PH * 4, sheet));
  out['slider-thumb'] = chromeEl('cicns/cicn-n10129-slider-thumb.png', PW, PH * 4, -10129);
  return out;
}

// Disclosure triangles (composeDisclosure looks them up by KEY name, not id).
// Slice the real beveled right-triangle from #22 ("> Time remaining"), alpha =
// non-background; derive the down triangle by a 90deg CW rotation.
const DISCLOSURE = { src: 'progress-dialog-copy-desktop.png', rect: [52, 120, 7, 12] };

function buildDisclosure(srcDir, destDir, cache) {
  const im = (cache[DISCLOSURE.src] ??= decodePng(readFileSync(resolve(srcDir, 'sources', DISCLOSURE.src))));
  const [x, y, w, h] = DISCLOSURE.rect;
  const right = new Uint8Array(w * h * 4);
  for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
    const si = ((y + yy) * im.width + (x + xx)) * 4, di = (yy * w + xx) * 4;
    const lum = 0.3 * im.rgba[si] + 0.59 * im.rgba[si + 1] + 0.11 * im.rgba[si + 2];
    const g = Math.round(lum); // desaturate: Platinum disclosure is neutral gray, not the slice's blue tint
    right[di] = g; right[di + 1] = g; right[di + 2] = g;
    right[di + 3] = lum < 214 ? 255 : 0; // drop the light dialog background
  }
  writeFileSync(resolve(destDir, 'cicns/cicn-disclosure-right.png'), encodePng(w, h, right));
  // down = rotate right 90deg CW: (x,y) -> (h-1-y, x), new size (h x w)
  const dw = h, dh = w, down = new Uint8Array(dw * dh * 4);
  for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
    const si = (yy * w + xx) * 4, di = (xx * dw + (h - 1 - yy)) * 4;
    down[di] = right[si]; down[di + 1] = right[si + 1]; down[di + 2] = right[si + 2]; down[di + 3] = right[si + 3];
  }
  writeFileSync(resolve(destDir, 'cicns/cicn-disclosure-down.png'), encodePng(dw, dh, down));
  return {
    'right-pointing-disclosure-triangle': chromeEl('cicns/cicn-disclosure-right.png', w, h, -9990),
    'down-pointing-disclosure-triangle': chromeEl('cicns/cicn-disclosure-down.png', dw, dh, -9991),
  };
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
    if (s.dot) { // selected radio: stamp a small dark centre dot on the empty ring
      for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
        if (Math.hypot(xx - cx, yy - cy) > 2.4) continue;
        const di = (yy * w + xx) * 4;
        out[di] = 56; out[di + 1] = 56; out[di + 2] = 56; out[di + 3] = 255;
      }
    }
    const file = `cicns/cicn-n${-s.id}-${s.name}.png`;
    writeFileSync(resolve(destDir, file), encodePng(w, h, out));
    sliced[s.name] = chromeEl(file, w, h, s.id);
    if (s.inactive) sliced[`${s.name}-inactive`] = chromeEl(file, w, h, s.inactive); // reuse active glyph
  }
  Object.assign(sliced, buildProgress(srcDir, destDir, cache));
  Object.assign(sliced, buildSlider(srcDir, destDir, cache));
  Object.assign(sliced, buildDisclosure(srcDir, destDir, cache));
  return { sliced, count: Object.keys(sliced).length };
}
