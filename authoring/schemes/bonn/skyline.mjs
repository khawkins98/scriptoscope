// Landmark and main cherry-bough art is extracted from concept/concept.jpg.
// The editable1× PNGs in sprites/ are authoritative; no procedural building
// reconstruction or additional architectural detail is painted over them.
// concept/extract-assets.mjs records the original crop/mask/3px sampling.
// Layout fitting uses one uniform nearest-neighbor scale per asset.
import { readFileSync } from 'node:fs';
import { decodePng } from '../../../scripts/lib/png-decode.mjs';

export const SKY_ROWS = 110;
export const MINSTER_W = 64;
export const HALL_W = 72;
export const BOUGH_W = 72;
export const SPRIG_W = 24;
export const ALERT_W = 24;

const ASSETS = Object.fromEntries(['minster', 'rathaus', 'post-tower', 'cherry-bough', 'bridge'].map(name => {
  const image = decodePng(readFileSync(new URL(`./sprites/${name}.png`, import.meta.url)));
  for (let i = 3; i < image.rgba.length; i += 4) {
    if (image.rgba[i] !== 0 && image.rgba[i] !== 255) throw new Error(`${name}: concept sprites require a binary mask`);
  }
  return [name, image];
}));

/** Uniform fit preserves the extracted composition. Output pixels sample
 * one source pixel; no filtering, smoothing, new outlines or detail passes. */
function drawConcept(r, name, x, base, maxW, maxH, p) {
  const image = ASSETS[name];
  const scale = Math.min(maxW / image.width, maxH / image.height);
  const w = Math.max(1, Math.round(image.width * scale));
  const h = Math.max(1, Math.round(image.height * scale));
  const left = x + Math.floor((maxW - w) / 2), top = base - h;
  const inactive = p.outline === '#777777';
  for (let oy = 0; oy < h; oy++) for (let ox = 0; ox < w; ox++) {
    const sx = Math.min(image.width - 1, Math.floor((ox + 0.5) / scale));
    const sy = Math.min(image.height - 1, Math.floor((oy + 0.5) / scale));
    const i = (sy * image.width + sx) * 4;
    if (!image.rgba[i + 3]) continue;
    let rgb = Array.from(image.rgba.subarray(i, i + 3));
    if (inactive) {
      const gray = Math.round(110 + (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) * 0.5);
      rgb = [gray, gray, gray];
    }
    r.set(left + ox, top + oy, `#${rgb.map(v => v.toString(16).padStart(2, '0')).join('')}`);
  }
}

export function drawMinsterCap(r, x, base, p) {
  drawConcept(r, 'minster', x, base, MINSTER_W, SKY_ROWS, p);
}
export function drawHallCap(r, x, base, p) {
  drawConcept(r, 'rathaus', x, base, HALL_W, SKY_ROWS, p);
}
export function drawTowerCorner(r, x, base, w, p) {
  drawConcept(r, 'post-tower', x, base, w, SKY_ROWS, p);
}

/** The extracted stone arch overlays the frame's river pixels. */
export function drawBridge(r, x, y, w, h, p) {
  drawConcept(r, 'bridge', x, y + h, w, h, p);
}

/** Actual cherry bough from the concept, fitted uniformly without cropping. */
export function drawBough(r, x, base, w, p) {
  drawConcept(r, 'cherry-bough', x, base, w, SKY_ROWS, p);
}

// ── Blossom ────────────────────────────────────────────────────────────────

/** A 5px cherry rosette: lit petals upper left, shaded lower right, dark heart. */
export const ROSETTE = [
  '.l.a.',
  'llaaa',
  '.aca.',
  'aaadd',
  '.a.d.',
];
const blossomLegend = (p) => ({ l: p.blossomHi, a: p.blossom, d: p.blossomLo, c: p.blossomLo, b: p.branch, k: p.mortar ?? p.branch });

export function rosette(r, x, y, p) { r.sprite(x, y, ROSETTE, blossomLegend(p)); }

/**
 * One 48px period of the branch along the bar's top edge (the code-8 tile).
 * The 2px branch (lit top row) rises and falls on a one-pixel stair; blossom
 * is placed irregularly so the repeat doesn't read as a fence: a pair of
 * rosettes high on twigs, a single low one, two hanging below the branch over
 * the bar's top edge, and two buds. `yb` = the bar's top row. The branch is on
 * rows yb−3/yb−2 at both ends of the tile, as in the corner piece, so the tile
 * continues the bough and repeats seamlessly.
 */
export const BRANCH_TILE_W = 48;
// How far the branch's top row is lifted above yb−3, per column.
const LIFT = Array.from({ length: BRANCH_TILE_W }, (_, i) => (i < 9 ? 0 : i < 17 ? 1 : i < 26 ? 2 : i < 35 ? 1 : 0));

export function drawBranchTile(r, x, yb, p) {
  const L = blossomLegend(p);
  const top = (i) => yb - 3 - LIFT[i];
  for (let i = 0; i < BRANCH_TILE_W; i++) r.set(x + i, top(i), L.k).set(x + i, top(i) + 1, L.b);
  const twig = (pts) => { for (const [i, dy] of pts) r.set(x + i, top(i) - dy, L.b); };
  // A low rosette near the start.
  twig([[5, 1]]);
  rosette(r, x + 3, top(5) - 6, p);
  // A bud.
  twig([[12, 1], [13, 2]]);
  r.set(x + 13, top(13) - 3, L.a).set(x + 14, top(13) - 3, L.l).set(x + 13, top(13) - 4, L.l);
  // Hanging below the branch.
  rosette(r, x + 16, top(17) + 1, p);
  // The high pair on a forked twig.
  twig([[24, 1], [24, 2], [23, 3], [25, 3], [26, 4]]);
  rosette(r, x + 20, top(24) - 9, p);
  rosette(r, x + 25, top(24) - 7, p);
  // Hanging below again, then a bud near the end.
  rosette(r, x + 33, top(34) + 1, p);
  twig([[42, 1]]);
  r.set(x + 42, top(42) - 2, L.d).set(x + 41, top(42) - 2, L.a).set(x + 41, top(42) - 3, L.l);
}

/**
 * The corner where the branch starts (left corner cell, `w` wide): a thicker
 * bough coming in from the frame's edge with a cluster of rosettes. Ends on
 * the tile's branch rows so the tile continues it.
 */
export function drawBranchCorner(r, x, yb, w, p, { cluster = true } = {}) {
  const L = blossomLegend(p);
  for (let i = 0; i < w; i++) {
    r.set(x + i, yb - 3, L.k).set(x + i, yb - 2, L.b);
    if (i < 7) r.set(x + i, yb - 1, L.b);
    if (i < 3) r.set(x + i, yb - 4, L.k).set(x + i, yb - 3, L.b);
  }
  if (!cluster) return;
  // Twigs up to a cluster of four rosettes (about 12px across) and a bud.
  r.set(x + 8, yb - 4, L.b).set(x + 9, yb - 5, L.b).set(x + 15, yb - 4, L.b).set(x + 16, yb - 5, L.b);
  rosette(r, x + 5, yb - 11, p);
  rosette(r, x + 10, yb - 13, p);
  rosette(r, x + 13, yb - 9, p);
  rosette(r, x + 8, yb - 8, p);
  r.set(x + 19, yb - 7, L.a).set(x + 20, yb - 7, L.l).set(x + 19, yb - 6, L.d).set(x + 18, yb - 5, L.b);
}

/** A sprig of three rosettes for the dialog's top ornament (centred in SPRIG_W, standing on the bar). */
export function drawSprig(r, x, yb, p) {
  const L = blossomLegend(p);
  for (let i = 2; i < SPRIG_W - 2; i++) r.set(x + i, yb - 2, L.b).set(x + i, yb - 3, L.k);
  r.set(x + 1, yb - 2, L.b).set(x + SPRIG_W - 2, yb - 2, L.b);
  r.set(x + 7, yb - 4, L.b).set(x + 12, yb - 4, L.b).set(x + 12, yb - 5, L.b).set(x + 17, yb - 4, L.b);
  rosette(r, x + 3, yb - 9, p);
  rosette(r, x + 10, yb - 10, p);
  rosette(r, x + 16, yb - 9, p);
  rosette(r, x + 7, yb - 1, p);
}

/** The alert's ornament: a yellow caution disc with a dark "!", on a short branch. */
const ALERT_DISC = [
  '...oooo...',
  '.ooyyyyoo.',
  '.oyyddyyo.',
  'oyyyddyyyo',
  'oyyyddyyyo',
  'oyyyddyyyo',
  'oyyyyyyyyo',
  '.oyyddyyo.',
  '.ooyyyyoo.',
  '...oooo...',
];
export function drawAlertDisc(r, x, yb, p) {
  const L = blossomLegend(p);
  for (let i = 1; i < ALERT_W - 1; i++) r.set(x + i, yb - 2, L.b).set(x + i, yb - 3, L.k);
  rosette(r, x + 1, yb - 8, p);
  rosette(r, x + ALERT_W - 6, yb - 8, p);
  r.sprite(x + 7, yb - 10, ALERT_DISC, { o: p.outline, y: p.yellow, d: p.outline });
}
