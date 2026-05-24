// scripts/generate-platinum/slice-doc-window.mjs
// Screenshot-sourced document-window cicn. Instead of hand-drawing the Platinum
// title bar (draw-window.mjs), this slices the REAL pixels out of a Mac OS 8
// Platinum screenshot and assembles them into the 98x23 min-size cicn that the
// existing compositor + recipe tile to any width.
//
// Why this works with the Kaleidoscope model: the title-bar pinstripe is a
// per-row pattern (horizontal lines), so a SINGLE clean flank column already
// carries the whole vertical band (white highlight -> light -> pinstripe ->
// solid -> #999 shadow). We replicate that column across the tiled middle and
// paste the real fixed corners (close box left, collapse+zoom right).
//
// Source landmarks (sources/doc-window-infinite-hd.png, 423x301), measured:
//   window outline x11 .. x397
//   title bar      y26 (outline) .. y48 (first body row)  -> cicn rows 0..22
//   close box      ~x16..x26   (lands in leftFixed [0,21))
//   clean flank    ~x40        (replicated across leftFill/plate/rightFill)
//   right corner   x363..x397  (collapse x365.., zoom x381.., outline x396)
import { decodePng } from '../diag-lib.mjs';
import { readFileSync } from 'node:fs';

// cicn geometry (must match the recipe in theme.json: top edges at 21/27/57/63/98).
const W = 98, H = 23;
const SRC_Y0 = 26;            // screenshot title-bar top outline row
const LEFT_SRC_X = 11;        // window left outline in the source
const RIGHT_SRC_X = 397;      // window right outline in the source
const FLANK_SRC_X = 40;       // a clean pinstripe flank column (no box, no text)
const MIDDLE = [21, 63];      // [start,end) cols filled with the tiled pinstripe

function buf() { return new Uint8Array(W * H * 4); }
function srcIdx(im, x, y) { return ((SRC_Y0 + y) * im.width + x) * 4; }
function dstIdx(x, y) { return (y * W + x) * 4; }

// Copy one source column (at screenshot x = sx) into cicn column dx, all rows opaque.
function copyCol(im, out, sx, dx) {
  for (let y = 0; y < H; y++) {
    const s = srcIdx(im, sx, y), d = dstIdx(dx, y);
    out[d] = im.rgba[s]; out[d + 1] = im.rgba[s + 1]; out[d + 2] = im.rgba[s + 2]; out[d + 3] = 255;
  }
}

export function sliceDocWindow(srcPath) {
  const im = decodePng(readFileSync(srcPath));
  const active = buf();

  // leftFixed [0,21): the real left corner (outline + close box).
  for (let i = 0; i < 21; i++) copyCol(im, active, LEFT_SRC_X + i, i);
  // tiled middle [21,63): replicate one clean flank column (carries the band).
  for (let dx = MIDDLE[0]; dx < MIDDLE[1]; dx++) copyCol(im, active, FLANK_SRC_X, dx);
  // rightFixed [63,98): the real right corner (collapse + zoom + outline),
  // right-aligned so the source outline (x397) lands on cicn col 97.
  for (let i = 0; i < 35; i++) copyCol(im, active, RIGHT_SRC_X - 34 + i, 63 + i);

  // Inactive: no active screenshot exists, so derive it — the real Platinum
  // inactive bar drops the pinstripe to a flat light gray. Flatten only the
  // tiled middle's stripe rows; keep the corners (boxes) and the bevel margins.
  const inactive = active.slice();
  const flat = sampleLightGray(im); // the bar's light bevel gray (#cc-ish)
  for (let y = 0; y < H; y++) {
    if (!isStripeRow(im, y)) continue;
    for (let dx = MIDDLE[0]; dx < MIDDLE[1]; dx++) {
      const d = dstIdx(dx, y);
      inactive[d] = flat[0]; inactive[d + 1] = flat[1]; inactive[d + 2] = flat[2]; inactive[d + 3] = 255;
    }
  }

  return { active: { width: W, height: H, rgba: active }, inactive: { width: W, height: H, rgba: inactive } };
}

// A row is a pinstripe row if the flank column there is markedly dark (the #777
// line) — those are the rows we flatten for the inactive bar.
function isStripeRow(im, y) {
  const s = srcIdx(im, FLANK_SRC_X, y);
  const lum = (im.rgba[s] + im.rgba[s + 1] + im.rgba[s + 2]) / 3;
  return lum < 170; // dark pinstripe line
}

// Sample the bar's light bevel gray (a light row near the top of the flank).
function sampleLightGray(im) {
  const s = srcIdx(im, FLANK_SRC_X, 2); // row 2 = light bevel
  return [im.rgba[s], im.rgba[s + 1], im.rgba[s + 2]];
}
