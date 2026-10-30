// Bonn's skyline, drawn once on the title bar (a fixed code-10 cell), plus
// the smaller motifs for utility windows and the ornaments of untitled
// dialogs and alerts. Original, deliberately simple silhouettes:
//
//   - the Minster: a Romanesque basilica with a tall crossing spire, a west
//     tower and two slim east towers;
//   - the Old Town Hall: a rose-coloured rococo front with a mansard roof and
//     a little lantern;
//   - the Beethoven monument: a standing figure on a plinth;
//   - the Post Tower: a tall glass slab in two offset halves;
//   - cherry trees in blossom between them.
//
// Everything stands on the bar's top outline row (`base`), so the silhouette
// rises out of the bar. Above the bar the frame is transparent: edges against
// it are hard (no matte, exotic-frames R17); edges against the bar or another
// building blend with real pixels.
import { mix } from '../../../tools/theme-author/index.js';

// Widths are a trade: every px here is a px less room for the title.
export const SKYLINE_W = 72;  // document top
export const TOWER_W = 32;    // movable modal / alert and utility tops
export const ORNAMENT_W = 42; // dialog / alert tops

/** Even-odd point-in-polygon, for paintCoverage. */
export const poly = (pts) => (px, py) => {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};
const fillPoly = (r, pts, color) => {
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const x = Math.floor(Math.min(...xs)), y = Math.floor(Math.min(...ys));
  r.paintCoverage(x, y, Math.ceil(Math.max(...xs)) - x, Math.ceil(Math.max(...ys)) - y, poly(pts), color);
};

/**
 * A cherry tree in blossom, hand-placed on whole pixels: a 5×5 blob lit from
 * the top left (pale tips, mid pink, a deeper lower right) on a 2px trunk.
 * `size` < 0.8 picks the 4×4 sapling. Stands on `base`, `x` is its left column.
 */
const TREE = [
  '.cbb.',
  'cbbba',
  'bbbaa',
  'bbaaa',
  '.aaa.',
  '..t..',
  '..t..',
];
const SAPLING = [
  '.cb.',
  'cbba',
  'baaa',
  '.aa.',
  '.t..',
  '.t..',
];
function tree(r, x, base, p, size = 1) {
  const rows = size < 0.8 ? SAPLING : TREE;
  r.sprite(x, base - rows.length, rows, { a: p.tree[1], b: p.tree[0], c: p.tree[2], t: p.trunk });
}

/**
 * The Minster, drawn like the Town Hall: flat silhouette masses, a 1px skyHi
 * edge on each lit (left) face and on the nave ridge, and lit windows as 1×2
 * yellow blocks on a 3px rhythm. 30 wide, 17 tall.
 */
function minster(r, x, base, p) {
  const s = p.sky, hi = p.skyHi, lit = p.yellow;
  const top = base - 17;
  const R = (cx, ry, w, h, c) => r.fillRect(x + cx, top + ry, w, h, c);
  // Nave with a stepped gable roof.
  R(6, 7, 18, 1, s); R(5, 8, 20, 1, s); R(4, 9, 22, 1, s); R(0, 10, 30, 7, s);
  // West tower with a pointed cap.
  R(1, 6, 5, 11, s); R(2, 5, 3, 1, s); R(3, 3, 1, 2, s);
  // Crossing tower and its tall spire.
  R(12, 5, 7, 12, s); R(13, 4, 5, 1, s); R(14, 2, 3, 2, s); R(15, 0, 1, 2, s);
  // Two slim east towers with needle caps.
  for (const tx of [21, 26]) { R(tx, 7, 3, 10, s); R(tx + 1, 5, 1, 2, s); }
  // Lit faces: the left column of each tower above the roof, the cap's left
  // step, and the nave ridge between the towers.
  R(1, 6, 1, 4, hi); R(2, 5, 1, 1, hi);
  R(12, 5, 1, 5, hi); R(13, 4, 1, 1, hi); R(14, 2, 1, 2, hi);
  R(21, 7, 1, 3, hi); R(26, 7, 1, 3, hi);
  R(6, 7, 6, 1, hi); R(19, 7, 2, 1, hi); R(24, 7, 2, 1, hi);
  // Windows: one row along the nave on a 3px rhythm, and one in each tower.
  for (const wx of [3, 7, 10, 15, 22, 27]) R(wx, 12, 1, 2, lit);
  R(3, 8, 1, 2, lit); R(15, 7, 1, 2, lit);
}

function townHall(r, x, base, p) {
  const front = mix(p.pink, p.red, 0.25), trim = p.pinkHi;
  // Main block.
  r.fillRect(x, base - 7, 20, 7, front);
  r.hline(x, base - 7, 20, trim);
  // Mansard roof and a lantern on top.
  fillPoly(r, [[x - 0.5, base - 7], [x + 2, base - 10], [x + 18, base - 10], [x + 20.5, base - 7]], p.sky);
  r.fillRect(x + 8, base - 13, 4, 3, p.sky);
  fillPoly(r, [[x + 7.5, base - 13], [x + 10, base - 15.5], [x + 12.5, base - 13]], p.sky);
  r.set(x + 10, base - 16, p.yellow);
  // Windows (white) and a doorway with the double stair.
  for (const wx of [2, 5, 8, 11, 14, 17]) r.fillRect(x + wx, base - 5, 1, 2, '#fffaf0');
  r.fillRect(x + 9, base - 3, 2, 3, p.sky);
  r.set(x + 7, base - 1, trim).set(x + 12, base - 1, trim);
}

function beethoven(r, x, base, p) {
  const s = p.sky;
  r.fillRect(x, base - 4, 6, 4, s);              // plinth
  r.hline(x, base - 4, 6, p.skyHi);
  // A standing, cloaked figure: wider at the hem, a head.
  fillPoly(r, [[x + 1, base - 4], [x + 2, base - 10], [x + 4, base - 10], [x + 5, base - 4]], s);
  r.fillCircleSmooth(x + 3, base - 11.2, 1.3, s);
}

/**
 * The Post Tower: two offset glass halves, the eastern one taller, in flat
 * glass tones (lit west column, darker east face), floors every third row in
 * the next tone down, and a sky-coloured slot between the halves.
 */
function postTower(r, x, base, p, h = 20) {
  const [g0, g1, g2] = p.glass;
  const lo = Math.round(h * 0.85);
  const half = (x0, top, cols) => cols.forEach((c, i) => {
    for (let y = top + 1; y < base; y++) r.set(x0 + i, y, (base - y) % 3 === 0 ? c[1] : c[0]);
  });
  half(x, base - lo, [[g0, g1], [g1, g2], [g1, g2], [g1, g2]]);
  half(x + 5, base - h, [[g1, g2], [g2, p.sky], [g2, p.sky]]);
  r.vline(x + 4, base - h, h, p.sky);                            // the slot between the halves
  r.hline(x, base - lo, 4, p.sky).hline(x + 4, base - h, 4, p.sky);
}

/** The document skyline, SKYLINE_W wide, at (x, base). */
export function drawSkyline(r, x, base, p) {
  // Everything stays 1px inside the cell: a pixel in the neighbouring 1px
  // grower column would be tiled into a line (exotic-frames R8).
  tree(r, x + 1, base, p, 0.8);
  minster(r, x + 6, base, p);
  townHall(r, x + 37, base, p);
  postTower(r, x + 59, base, p);
  tree(r, x + 66, base, p, 0.85);
}

/**
 * Modal and utility windows: the Post Tower among blossom trees, TOWER_W wide;
 * with room (h ≥ 14) the Beethoven monument stands beside it.
 */
export function drawTowerMotif(r, x, base, p, h) {
  if (h >= 14) {
    tree(r, x + 1, base, p, 0.8);
    beethoven(r, x + 7, base, p);
    postTower(r, x + 15, base, p, h);
    tree(r, x + 24, base, p, 0.9);
    return;
  }
  tree(r, x + 3, base, p, 0.8);
  tree(r, x + 9, base, p, 0.7);
  postTower(r, x + 16, base, p, h);
  tree(r, x + 25, base, p, 0.8);
}

/**
 * Untitled windows: a centred ornament rising above the band. Dialogs get a
 * cherry branch in blossom; alerts get a yellow disc with a red "!" between
 * two blossom sprays.
 */
export function drawOrnament(r, cell, base, p, kind) {
  const { x0, w } = cell, cx = x0 + w / 2;
  if (kind === 'alert') {
    tree(r, x0 + 4, base + 1, p, 1);
    tree(r, x0 + w - 10, base + 1, p, 1);
    r.fillCircleSmooth(cx, base - 2, 7, p.redLo);
    r.fillCircleSmooth(cx, base - 2, 6, p.yellow);
    r.strokeLineSmooth(cx, base - 6, cx, base - 1, 2, p.red);
    r.fillCircleSmooth(cx, base + 1.5, 1.1, p.red);
    return;
  }
  // A cherry branch arching across the cell, with blossoms.
  const branch = (t) => [x0 + 3 + t * (w - 6), base - 1 - Math.sin(t * Math.PI) * 9];
  for (let i = 0; i < 24; i++) {
    const [ax, ay] = branch(i / 24), [bx, by] = branch((i + 1) / 24);
    r.strokeLineSmooth(ax, ay, bx, by, 2, p.trunk);
  }
  for (const t of [0.12, 0.3, 0.46, 0.62, 0.8, 0.92]) {
    const [bx, by] = branch(t);
    const up = (t * 7) % 2 > 1 ? -2.5 : 1.5;
    r.fillCircleSmooth(bx, by + up, 3.2, p.tree[1]);
    r.fillCircleSmooth(bx - 0.6, by + up - 0.6, 1.8, p.tree[0]);
    r.set(Math.round(bx), Math.round(by + up), p.yellow);
  }
}
