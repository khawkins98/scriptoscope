// Bonn body patterns and Finder colour records.
//
// Web runtime (docs/authoring-exotic-frames.md R21): document bodies tile the
// ppat named by cinf -9551's bgPatternId (else -9550's); utility, dialog,
// alert and modal bodies tile ppat 42. Classic Kaleidoscope uses -9551/-9550
// for Finder icon/list views, not for ordinary window bodies (R22), so both
// are web-only decoration for windows.
//
// Live DOM text sits on these, so contrast is kept very low (R23).
import { Raster, encodePpat, encodeCicn, encodeCinf, mix, bayer } from '../../../tools/theme-author/index.js';
import { C } from './palette.mjs';

export const PETALS_PPAT = 128;

const hash = (x, y, s = 0) => {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(s | 0, 982451653);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

/**
 * 32×32 cream with a few drifting cherry petals: each petal is a small
 * teardrop, very pale pink, at a different angle. Petals near an edge wrap
 * around, so the tile repeats seamlessly.
 */
function petals() {
  const N = 32, r = new Raster(N, N).fillRect(0, 0, N, N, C.body);
  const petal = ['#f9e6e6', '#f7dfe2'];
  const drops = [[5, 6, 0.4], [21, 3, 2.1], [14, 17, 1.2], [28, 22, 3.6], [7, 26, 5.0]];
  for (const [cx, cy, ang] of drops) {
    const ux = Math.cos(ang), uy = Math.sin(ang);
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      // Teardrop: along the axis t ∈ [-2, 2.5], width shrinking towards the tip.
      const t = dx * ux + dy * uy, n = -dx * uy + dy * ux;
      const half = t < -2 || t > 2.5 ? -1 : 1.4 * Math.sqrt(Math.max(0, 1 - ((t - 0.2) / 2.4) ** 2));
      if (Math.abs(n) > half) continue;
      const x = ((cx + dx) % N + N) % N, y = ((cy + dy) % N + N) % N;
      r.set(x, y, t > 1.2 ? petal[1] : petal[0]);
    }
  }
  return r;
}

/**
 * 32×32 Altstadt cobblestones for dialogs and palettes: rounded setts in
 * offset rows, barely darker joints, a dithered speckle. Very faint.
 */
function cobbles() {
  const N = 32, r = new Raster(N, N);
  const base = C.utilBody, joint = '#e9e0d1', lit = '#f7f1e7';
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const row = Math.floor(y / 8), off = row % 2 ? 4 : 0;
    const sx = ((x + off) % 8 + 8) % 8, sy = y % 8;
    // Rounded sett: joints on the cell boundary, corners knocked off.
    const corner = (sx === 0 || sx === 7) && (sy === 0 || sy === 7);
    let c = base;
    if (sx === 7 || sy === 7 || corner) c = joint;
    else if (sy === 0 || sx === 0) c = lit;
    else if (hash(x, y, 4) < 0.18 && bayer(x, y) < 0.5) c = mix(base, joint, 0.6);
    r.set(x, y, c);
  }
  return r;
}

/**
 * 32×32 desktop: the Rhine at dusk, with cherry blossoms drifting on it.
 * Colours are exact entries of the 8-bit system palette, stored raw
 * (gamma: false), so a 256-colour classic screen shows this texture instead
 * of rounding it (Halcyon's menus.mjs does the same). The ordered dither
 * wraps at 4, so the tile repeats seamlessly.
 */
function desktop() {
  const N = 32, r = new Raster(N, N);
  const deep = [0, 102, 102], water = [51, 102, 102], light = [51, 153, 153];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    // Gentle diagonal ripples: a light band every 16px, dithered in.
    const band = (Math.sin(((x + 2 * y) / 16) * 2 * Math.PI) + 1) / 2;
    const t = bayer(x, y);
    r.set(x, y, band > 0.85 && t < 0.5 ? light : band < 0.2 && t < 0.4 ? deep : water);
  }
  const petal = [255, 204, 204], petalLo = [255, 153, 204], heart = [255, 204, 51];
  for (const [cx, cy] of [[6, 7], [22, 21]]) {
    for (const [dx, dy] of [[0, -2], [-2, 0], [2, 0], [-1, 2], [1, 2]]) {
      r.set(cx + dx, cy + dy, petal);
      r.set(cx + Math.sign(dx), cy + Math.sign(dy), petalLo);
    }
    r.set(cx, cy, heart);
  }
  for (const [x, y] of [[15, 4], [28, 12], [4, 26], [12, 16]]) r.set(x, y, petal); // single petals
  return r;
}

function finderSwatch(fill, text) {
  return new Raster(8, 8).fillRect(0, 0, 8, 8, fill).set(1, 1, text);
}
const finderCinf = (bgPatternId = 0) => encodeCinf({
  cornerSize: 0, sideThickness: 0, tileSides: 0, patternAnchor: 0, bgPatternId,
  bgPixel: { x: 3, y: 3 }, textPixel: { x: 1, y: 1 }, embossPixel: { x: 0, y: 0 },
});

export function build(add) {
  add('ppat', PETALS_PPAT, encodePpat(petals()), 'Blossom Petals');
  add('ppat', 42, encodePpat(cobbles()), 'Utility Pattern');
  add('ppat', 17, encodePpat(desktop(), { gamma: false }), 'Desktop Pattern');
  const ink = '#2a211d';
  const finder = [
    [-9552, 'Desktop Text Color And Background', '#ffffff', ink, 0],
    [-9551, 'Icon View Background', C.body, ink, PETALS_PPAT],
    [-9550, 'List View Background', C.body, ink, PETALS_PPAT],
    [-9549, 'List View Sort Color', '#f3e6cf', ink, 0],
    [-9548, 'List View Divider Line', '#e2cca7', ink, 0],
  ];
  for (const [id, name, fill, text, ppat] of finder) {
    add('cicn', id, encodeCicn(finderSwatch(fill, text)), name);
    add('cinf', id, finderCinf(ppat), name);
  }
}
