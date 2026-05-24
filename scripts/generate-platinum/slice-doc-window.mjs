// scripts/generate-platinum/slice-doc-window.mjs
// Screenshot-sourced document-window cicns (active + inactive). Instead of
// hand-drawing the Platinum title bar, this slices the REAL pixels out of Mac OS 8
// screenshots and assembles them into the 98x23 min-size cicn the compositor
// tiles to any width.
//
// Why this works with the Kaleidoscope model: the title bar is a per-row pattern,
// so a SINGLE clean flank column carries the whole vertical band. We replicate
// that column across the tiled middle and paste the real fixed corners.
//
// ACTIVE source (sources/doc-window-infinite-hd.png, 423x301):
//   window outline x11..x397, title-bar top y26; close box in the left corner,
//   collapse+zoom in the right corner, white/#777 pinstripe flank.
// INACTIVE source (sources/doc-window-macintosh-hd-inactive.png, 333x199):
//   Mac OS 8 hides the title widgets when inactive — the bar is a FLAT light-gray
//   (#dd) fill with a dark-gray (#58) frame, no buttons. window outline x4..x312,
//   title-bar top y3. So the same corner+flank slice yields flat, button-less
//   corners automatically.
import { decodePng } from '../diag-lib.mjs';
import { readFileSync, existsSync } from 'node:fs';

// cicn geometry (must match the recipe in theme.json: top edges at 21/27/57/63/98).
const W = 98, H = 23;

// Per-source landmarks, measured from the screenshots.
const ACTIVE   = { leftX: 11, flankX: 40, rightX: 397, srcY0: 26 };
const INACTIVE = { leftX: 4,  flankX: 40, rightX: 312, srcY0: 3 };

// Build a 98x23 cicn from a source image + its landmarks: real left corner in
// leftFixed [0,21), one replicated flank column across the tiled middle [21,63),
// real right corner (right-aligned) in rightFixed [63,98). Source rows
// srcY0..srcY0+22 map onto cicn rows 0..22.
function sliceChrome(im, p) {
  const out = new Uint8Array(W * H * 4);
  const copyCol = (sx, dx) => {
    for (let y = 0; y < H; y++) {
      const s = ((p.srcY0 + y) * im.width + sx) * 4, d = (y * W + dx) * 4;
      out[d] = im.rgba[s]; out[d + 1] = im.rgba[s + 1]; out[d + 2] = im.rgba[s + 2]; out[d + 3] = 255;
    }
  };
  for (let i = 0; i < 21; i++) copyCol(p.leftX + i, i);          // leftFixed: real left corner
  for (let dx = 21; dx < 63; dx++) copyCol(p.flankX, dx);        // tiled middle: flank column
  for (let i = 0; i < 35; i++) copyCol(p.rightX - 34 + i, 63 + i); // rightFixed: real right corner
  return { width: W, height: H, rgba: out };
}

/**
 * Slice the active + inactive document-window cicns.
 * @param {string} activeSrc    path to the active-window screenshot
 * @param {string} [inactiveSrc] path to the inactive-window screenshot; if absent,
 *   the inactive cicn is derived from the active by flattening the pinstripe.
 */
export function sliceDocWindow(activeSrc, inactiveSrc) {
  const active = sliceChrome(decodePng(readFileSync(activeSrc)), ACTIVE);
  let inactive;
  if (inactiveSrc && existsSync(inactiveSrc)) {
    inactive = sliceChrome(decodePng(readFileSync(inactiveSrc)), INACTIVE);
  } else {
    inactive = deriveInactive(active);
  }
  return { active, inactive };
}

// Fallback when no inactive screenshot exists: flatten the active's tiled-middle
// pinstripe rows to the bar's light gray (corners kept). Approximate — a real
// inactive screenshot (above) is preferred.
function deriveInactive(active) {
  const out = active.rgba.slice();
  const lum = (x, y) => { const i = (y * W + x) * 4; return (out[i] + out[i + 1] + out[i + 2]) / 3; };
  const li = (3 * W + 2) * 4;                         // a light bevel pixel near the top
  const flat = [active.rgba[li], active.rgba[li + 1], active.rgba[li + 2]];
  for (let y = 0; y < H; y++) {
    if (lum(40, y) >= 170) continue;                  // only flatten dark pinstripe rows
    for (let dx = 21; dx < 63; dx++) {
      const d = (y * W + dx) * 4;
      out[d] = flat[0]; out[d + 1] = flat[1]; out[d + 2] = flat[2]; out[d + 3] = 255;
    }
  }
  return { width: W, height: H, rgba: out };
}
