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
// Matched active+inactive PAIR, both from the same window (Macintosh HD) so the
// corner geometry, scale and landmarks line up:
// ACTIVE source (sources/doc-window-macintosh-hd-active.png, 328x196):
//   window outline x5..x313, title-bar top y2; close box left corner, collapse+
//   zoom right corner, white/#777 pinstripe flank, solid #ccc title plate.
// INACTIVE source (sources/doc-window-macintosh-hd-inactive.png, 333x199):
//   Mac OS 8 hides the title widgets when inactive — a FLAT light-gray (#dd) bar
//   with a dark-gray (#58) frame, no buttons. window outline x4..x312, top y3.
// To RE-MEASURE if a screenshot is re-captured: leftX/rightX = the black window
// outline columns at a title-bar row; srcY0 = the outline row; flankX = a clean
// pinstripe column (no close box, no title). The chrome is identical across all
// standard document windows (same system WDEF), so any clean capture works.
import { decodePng } from '../diag-lib.mjs';
import { readFileSync, existsSync } from 'node:fs';

// cicn geometry (must match the recipe in theme.json: top edges at 21/27/57/63/98).
const W = 98, H = 23;
// The pinstripe occupies cicn rows [4,15]; the bevel margins (hi/light/solid/#999)
// are outside it. The title PLATE flattens this band to the solid bar gray.
const STRIPE_BAND = [4, 15];

// Per-source landmarks, measured from the screenshots.
const ACTIVE   = { leftX: 5, flankX: 70, rightX: 313, srcY0: 2 };
const INACTIVE = { leftX: 4, flankX: 40, rightX: 312, srcY0: 3 };

// Build a 98x23 cicn from a source image + its landmarks: real left corner in
// leftFixed [0,21), pinstripe flank in the fill cells [21,27)+[57,63), a SOLID
// title plate in [27,57) (part-5 — the title sits on solid #ccc, not pinstripe),
// real right corner (right-aligned) in rightFixed [63,98). Source rows
// srcY0..srcY0+22 map onto cicn rows 0..22.
function sliceChrome(im, p) {
  if (p.srcY0 + H > im.height || p.rightX >= im.width || p.leftX < 0)
    throw new Error(`slice rect out of bounds for ${im.width}x${im.height} (srcY0=${p.srcY0}, rightX=${p.rightX})`);
  const out = new Uint8Array(W * H * 4);
  const px = (sx, row) => { const s = ((p.srcY0 + row) * im.width + sx) * 4; return [im.rgba[s], im.rgba[s + 1], im.rgba[s + 2]]; };
  const setCol = (dx, colFn) => {
    for (let y = 0; y < H; y++) { const [r, g, b] = colFn(y); const d = (y * W + dx) * 4; out[d] = r; out[d + 1] = g; out[d + 2] = b; out[d + 3] = 255; }
  };
  for (let i = 0; i < 21; i++) { const sx = p.leftX + i; setCol(i, (y) => px(sx, y)); }      // leftFixed
  for (let dx = 21; dx < 27; dx++) setCol(dx, (y) => px(p.flankX, y));                        // leftFill: pinstripe
  for (let dx = 57; dx < 63; dx++) setCol(dx, (y) => px(p.flankX, y));                        // rightFill: pinstripe
  const solid = px(p.flankX, STRIPE_BAND[1] + 2);                                             // the solid-band gray (state-aware)
  for (let dx = 27; dx < 57; dx++) setCol(dx, (y) => (y >= STRIPE_BAND[0] && y <= STRIPE_BAND[1]) ? solid : px(p.flankX, y)); // plate: solid
  for (let i = 0; i < 35; i++) { const sx = p.rightX - 34 + i; setCol(63 + i, (y) => px(sx, y)); } // rightFixed
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
