// Bonn's skyline, the cherry bough and the small ornaments above the bar,
// painted over the concept (concept/concept.jpg, measured at 3 concept px per
// pixel with `npm run paint-over`) and redrawn by hand on whole pixels:
//
//   - the Minster: a sandstone church with a tall teal spire on its crossing
//     tower, two flanking towers with spires and a teal gable;
//   - the pink Old Town Hall: a slate mansard with dormers, a pediment over
//     the centre bay, a ridge turret, three floors of windows and the stair;
//   - the Post Tower: a teal glass slab with a lit edge, floor bands and a mast;
//   - dark riverside trees behind them, and the cherry bough in the corner.
//
// Each building is built on a material grid (one letter per pixel), toned in
// three steps (lit face on the left, body, shade face on the right; light
// from the upper left), given its own 1px dark outline, and laid back to
// front. The state's palette paints it, so active and inactive are one drawing.
//
// Placement (frames.mjs): the Minster stands over the pennant's left cap and
// the Town Hall over its right cap, so the skyline straddles the title and
// moves with it, as in the concept; the Post Tower stands over the right
// corner, above the zoom and collapse boxes.

export const SKY_ROWS = 78;    // rows above the bar (the spire's tip is on row 1)
export const MINSTER_W = 40;   // the left cap: Minster + trees
export const HALL_W = 48;      // the right cap: Town Hall + trees
export const TOWER_X = 8;      // the Post Tower's left column inside the right corner
export const BOUGH_W = 40;     // the left corner: the cherry bough
export const SPRIG_W = 24;     // dialog top ornament
export const ALERT_W = 24;     // alert top ornament

// Body materials → [lit, shade] tone letters.
const TONES = { A: ['a', 'z'], R: ['r', 'x'], H: ['h', 'y'], M: ['m', 'n'], G: ['g', 'q'], T: ['t', null] };

class Grid {
  constructor(w, h) { this.w = w; this.h = h; this.m = Array.from({ length: h }, () => Array(w).fill(null)); }
  in(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  get(x, y) { return this.in(x, y) ? this.m[y][x] : null; }
  set(x, y, v) { if (this.in(x, y)) this.m[y][x] = v; return this; }
  rect(x, y, w, h, v) { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.set(i, j, v); return this; }
  /** A pointed roof: tip at (cx, y0), half-width from the `halves` table per row (last value repeats). */
  spire(cx, y0, halves, v) { halves.forEach((k, i) => this.rect(cx - k, y0 + i, 2 * k + 1, 1, v)); return this; }
  outline() {
    const add = [];
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      if (this.get(x, y)) continue;
      if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => { const v = this.get(x + dx, y + dy); return v && v !== 'o'; })) add.push([x, y]);
    }
    for (const [x, y] of add) this.set(x, y, 'o');
    return this;
  }
  /** Three tones along each row of a material run: spires split lit / shade, walls get a lit left column and a shade face. */
  tone(shade = 2) {
    const out = this.m.map((row) => row.slice());
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w;) {
        const v = this.m[y][x];
        if (!TONES[v]) { x++; continue; }
        let e = x; while (e < this.w && this.m[y][e] === v) e++;
        const n = e - x, [lit, dark] = TONES[v];
        for (let i = 0; i < n; i++) {
          const dl = i, dr = n - 1 - i;
          let t = v;
          if (v === 'R' && n <= 9) t = n < 2 ? v : dl < dr ? lit : dl > dr ? dark : v;
          else if (dark && dr < shade && n > 2) t = dark;
          else if (lit && dl === 0 && n > 2) t = lit;
          out[y][x + i] = t;
        }
        x = e;
      }
    }
    this.m = out;
    return this;
  }
  paint(r, x0, y0, p) {
    const S = p.sky3;
    const map = {
      o: p.outline, w: p.window, W: p.trim, Y: p.lamp,
      A: S.stone, a: S.stoneHi, z: S.stoneLo,
      R: S.roof, r: S.roofHi, x: S.roofLo,
      H: S.hall, h: S.hallHi, y: S.hallLo,
      M: S.slate, m: S.slateHi, n: S.slateLo,
      G: S.glass, g: S.glassHi, q: S.glassLo,
      T: S.tree, t: S.treeHi,
    };
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      const v = this.m[y][x];
      if (v) r.set(x0 + x, y0 + y, map[v]);
    }
  }
}

/** Draw one component on its own grid, tone and outline it, then lay it over `g` (back to front). */
function layer(g, draw, shade) {
  const part = new Grid(g.w, g.h);
  draw(part);
  part.tone(shade).outline();
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) if (part.m[y][x]) g.m[y][x] = part.m[y][x];
}
const windows = (g, xs, ys, v, w = 1, h = 3) => { for (const x of xs) for (const y of ys) g.rect(x, y, w, h, v); };

/**
 * Riverside trees, laid first: each clump [x0, x1, top] is a run of rounded
 * crowns about 7px wide whose tops step up and down by a few rows.
 */
function trees(g, clumps) {
  layer(g, (q) => {
    for (const [x0, x1, top] of clumps) {
      for (let cx = x0, n = 0; cx < x1; cx += 6, n++) {
        const t = top + [0, 3, 1, 4, 2][n % 5], w = Math.min(8, x1 - cx);
        for (let y = t; y < g.h; y++) {
          const k = y - t, inset = k === 0 ? 2 : k === 1 ? 1 : 0;
          if (w - 2 * inset > 0) q.rect(cx + inset, y, w - 2 * inset, 1, 'T');
        }
      }
    }
  });
  // A lit pixel on the upper left of each crown.
  for (let y = 1; y < g.h; y++) for (let x = 1; x < g.w; x++) if (g.get(x, y) === 'T' && g.get(x, y - 1) === 'o' && g.get(x - 1, y) === 'o') g.set(x, y, 't');
}

/** The Minster, 37 wide, centred on column c; its base is the grid's bottom row (77). */
function minster(g, c) {
  const B = g.h - 1;
  // The nave and west front behind the towers.
  layer(g, (q) => q.rect(c - 10, 50, 21, B - 49, 'A'));
  // Flanking towers: 7 wide, spires from row 37.
  for (const cx of [c - 14, c + 14]) layer(g, (q) => {
    q.spire(cx, 37, [0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 2, 3], 'R');
    q.rect(cx - 3, 50, 7, B - 49, 'A');
  });
  // The crossing tower and its long spire (tip on row 1, so the outline is row 0).
  layer(g, (q) => {
    q.spire(c, 1, [0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4], 'R');
    q.rect(c - 7, 34, 15, 29, 'A');
  });
  // The teal gable over the west front.
  layer(g, (q) => q.spire(c, 55, [0, 1, 2, 3, 4, 5, 6, 7], 'R'));
  // Cornice under the gable, then the west front.
  layer(g, (q) => q.rect(c - 10, 63, 21, B - 62, 'A'));
  // Windows: paired belfry lancets, tower lights, the rose and the portal.
  windows(g, [c - 4, c - 2, c + 2, c + 4], [37, 44], 'w', 1, 4);
  windows(g, [c - 14, c + 14], [53, 60, 67], 'w', 1, 3);
  windows(g, [c - 7, c - 4, c + 4, c + 7], [66], 'w', 1, 3);
  g.rect(c - 1, 65, 3, 3, 'w').set(c, 66, 'Y');
  g.rect(c - 2, 71, 5, B - 70, 'w').set(c - 2, 71, 'A').set(c + 2, 71, 'A').rect(c, 72, 1, B - 71, 'Y');
  for (const y of [57, 70]) for (const cx of [c - 14, c + 14]) g.rect(cx - 2, y, 5, 1, 'z');   // string courses
}

/** The Old Town Hall, 46 wide, x = its left column. */
function townHall(g, x) {
  const B = g.h - 1, w = 46, c = x + 22;               // centre bay columns c, c+1
  // The ridge turret: finial, lantern, slate drum.
  layer(g, (q) => { q.rect(c, 29, 2, 4, 'M'); q.rect(c - 1, 33, 4, 4, 'M'); q.rect(c - 2, 37, 6, 11, 'M'); }, 1);
  layer(g, (q) => {
    q.rect(x + 4, 48, w - 8, 1, 'M').rect(x + 3, 49, w - 6, 1, 'M').rect(x + 2, 50, w - 4, 1, 'M').rect(x + 1, 51, w - 2, 7, 'M');
    q.rect(x, 58, w, B - 57, 'H');
  });
  // Pediment over the centre bay, rising into the roof, with a clock.
  for (let k = 0; k < 6; k++) g.rect(c - 1 - k, 49 + k, 4 + 2 * k, 1, 'H');
  g.rect(c - 6, 55, 14, 3, 'H').rect(c, 51, 2, 2, 'W');
  // Dormers in the roof.
  for (const dx of [6, 13, 31, 38]) g.rect(x + dx, 52, 3, 4, 'H').rect(x + dx + 1, 53, 1, 2, 'w');
  // White cornice, its shadow, and the centre bay's pilasters.
  g.rect(x, 58, w, 1, 'W').rect(x, 59, w - 2, 1, 'y');
  g.rect(c - 7, 60, 1, B - 66, 'W').rect(c + 8, 60, 1, B - 66, 'y');
  // Three floors of windows, 2×3 on a 4px rhythm, with sills.
  const xs = [x + 2, x + 6, x + 10, x + 32, x + 36, x + 40], bay = [c - 4, c, c + 4];
  for (const y of [61, 66]) { windows(g, [...xs, ...bay], [y], 'w', 2, 3); for (const wx of [...xs, ...bay]) g.rect(wx, y + 3, 2, 1, 'W'); }
  windows(g, xs, [71], 'w', 2, 3);
  // The door and the outside stair: two flights climbing to it.
  g.rect(c - 1, 70, 4, 3, 'w');
  g.rect(c - 3, 73, 8, 1, 'A').rect(c - 5, 74, 12, 1, 'A').rect(c - 7, 75, 16, 1, 'A').rect(c - 9, 76, 20, 2, 'A');
  for (let k = 0; k < 4; k++) g.set(c - 3 - 2 * k, 73 + k, 'a').set(c + 4 + 2 * k, 73 + k, 'z');
}

/** The Post Tower, 22 wide, x = its left column. */
function postTower(g, x) {
  const B = g.h - 1;
  layer(g, (q) => q.rect(x + 15, 20, 7, B - 19, 'G'), 2);
  layer(g, (q) => { q.rect(x + 6, 10, 1, 5, 'M'); q.rect(x, 15, 14, B - 14, 'G'); }, 3);
  g.rect(x + 14, 20, 1, B - 19, 'x');                    // the slot between the halves
  for (let y = 18; y < B - 1; y += 4) { g.rect(x + 1, y, 10, 1, 'q'); g.rect(x + 16, y + 2, 4, 1, 'q'); }
  g.rect(x + 1, 16, 2, B - 16, 'g');                    // the lit edge catching the sky
}

/** The left cap's sky: the Minster among trees. */
export function drawMinsterCap(r, x, base, p) {
  const g = new Grid(MINSTER_W, SKY_ROWS);
  trees(g, [[0, 12, 54], [26, 40, 56]]);
  minster(g, 20);
  g.paint(r, x, base - SKY_ROWS, p);
}

/** The right cap's sky: the Town Hall among trees. */
export function drawHallCap(r, x, base, p) {
  const g = new Grid(HALL_W, SKY_ROWS);
  trees(g, [[0, 14, 55], [32, 48, 54]]);
  townHall(g, 1);
  g.paint(r, x, base - SKY_ROWS, p);
}

/** The right corner's sky: the Post Tower among trees (`w` = corner width). */
export function drawTowerCorner(r, x, base, w, p) {
  const g = new Grid(w, SKY_ROWS);
  trees(g, [[1, w - 1, 57]]);
  postTower(g, TOWER_X);
  g.paint(r, x, base - SKY_ROWS, p);
}

/**
 * The left corner's sky: the cherry bough rising from the corner up to the
 * right, with clusters of rosettes, in front of a clump of trees.
 */
export function drawBough(r, x, yb, w, p) {
  const g = new Grid(w, SKY_ROWS);
  trees(g, [[6, w, 50]]);
  g.paint(r, x, yb - SKY_ROWS, p);
  const L = blossomLegend(p);
  // The bough: 3px at the frame edge, a 2px limb up to the right, a twig off it.
  const limb = (x0, y0, x1, y1, thick) => {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let i = 0; i <= n; i++) {
      const px = Math.round(x0 + ((x1 - x0) * i) / n), py = Math.round(y0 + ((y1 - y0) * i) / n);
      r.set(x + px, py, L.k);
      for (let t = 1; t < thick; t++) r.set(x + px, py + t, L.b);
    }
  };
  limb(0, yb - 4, 12, yb - 9, 3);
  limb(12, yb - 9, 30, yb - 17, 2);
  limb(30, yb - 17, 38, yb - 19, 2);
  limb(14, yb - 10, 20, yb - 22, 2);
  limb(24, yb - 14, 28, yb - 8, 1);
  for (const [dx, dy] of [[2, -14], [8, -15], [13, -19], [17, -26], [21, -23], [25, -20], [30, -23], [34, -21], [27, -12], [20, -13], [5, -9], [33, -16]]) rosette(r, x + dx, yb + dy, p);
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
