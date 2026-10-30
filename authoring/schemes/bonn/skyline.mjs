// Bonn's skyline and the small ornaments above the bar. Original, stylised
// silhouettes on whole pixels (no smooth strokes, no tracing):
//
//   - the Minster: a crossing tower with an octagonal stage and spire, four
//     flanking towers with pointed caps, a nave with a lit west door;
//   - the pink Old Town Hall: three floors of white windows, a slate mansard,
//     a pediment over the centre bay, a ridge turret, the outside stair;
//   - the Post Tower: two glass slabs split by a dark slot, lit floor bands.
//
// It is the window's main ornament: 44 rows tall, standing on the bar (a
// droppable code-10 cell). Each building is a bold mass in three tones (lit
// face on the left, body, shade face on the right; light from the upper
// left), and each component carries its own 1px outline, so towers stand
// clear of what is behind them and the group reads on any page (R17).
// Riverside trees fill in behind the bases.
//
// The group is built on a material grid (one letter per pixel), outlined and
// toned by rule, then painted with the state's palette, so the active and
// inactive skylines are the same drawing.

export const SKYLINE_W = 94;   // document top: the whole group (code 10)
export const MINSTER_W = 39;   // movable modal top: the Minster alone (code 10)
export const SPRIG_W = 24;     // dialog top ornament
export const ALERT_W = 24;     // alert top ornament
export const SKY_ROWS = 44;    // rows above the bar the skyline uses

// Body materials and their lit / shade tones.
const TONES = { S: ['L', 'D'], R: ['L', 'D'], G: ['g', 'q'], H: [null, 'h'], T: ['t', null] };

class Grid {
  constructor(w, h) { this.w = w; this.h = h; this.m = Array.from({ length: h }, () => Array(w).fill(null)); }
  in(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  get(x, y) { return this.in(x, y) ? this.m[y][x] : null; }
  set(x, y, v) { if (this.in(x, y)) this.m[y][x] = v; return this; }
  rect(x, y, w, h, v) { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.set(i, j, v); return this; }
  /** A pointed roof: tip at (cx, y0), widening one px each side every `every` rows, down to row y1 (inclusive). */
  spire(cx, y0, y1, every, v, maxHalf = 99) {
    for (let y = y0; y <= y1; y++) { const k = Math.min(maxHalf, Math.floor((y - y0) / every)); this.rect(cx - k, y, 2 * k + 1, 1, v); }
    return this;
  }
  /** 4-neighbour outline: every empty pixel touching the figure becomes 'o'. */
  outline() {
    const add = [];
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      if (this.get(x, y)) continue;
      const n = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => { const v = this.get(x + dx, y + dy); return v && v !== 'o'; });
      if (n) add.push([x, y]);
    }
    for (const [x, y] of add) this.set(x, y, 'o');
    return this;
  }
  /**
   * Three tones, light from the upper left. Along each row, inside a run of
   * one material: spires split lit (left half) / shade (right half), long
   * roofs get lit and shaded ends; walls get
   * a lit column on the left and a `shade`-px shade face on the right.
   */
  tone(shade = 2) {
    const out = this.m.map((row) => row.slice());
    for (let y = 0; y < this.h; y++) {
      let x = 0;
      while (x < this.w) {
        const v = this.m[y][x];
        if (!TONES[v]) { x++; continue; }
        let e = x; while (e < this.w && this.m[y][e] === v) e++;
        const n = e - x, [lit, dark] = TONES[v];
        for (let i = 0; i < n; i++) {
          const dl = i, dr = n - 1 - i;
          let t = v;
          if (v === 'R' && n <= 9) t = n < 2 ? v : dl < dr ? lit : dl > dr ? dark : v;   // spires: lit and shade halves
          else if (v === 'R') t = dl < 2 ? lit : dr < 2 ? dark : v;                        // long roofs: lit and shade ends
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
    const map = {
      o: p.outline, S: p.sky, R: p.sky, L: p.skyHi, D: p.skyLo, T: p.sky, t: p.skyHi, Y: p.lamp,
      H: p.hall, h: p.hallLo, W: p.trim, G: p.glass, g: p.glassHi, q: p.glassLo,
    };
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      const v = this.m[y][x];
      if (v) r.set(x0 + x, y0 + y, map[v]);
    }
  }
}

/** Windows: w×h blocks at each (x, y). */
const windows = (g, xs, ys, v, w = 1, h = 3) => { for (const x of xs) for (const y of ys) g.rect(x, y, w, h, v); };

/**
 * Draw one component on its own grid, outline and tone it, then lay it over
 * `g` (back to front), so every tower keeps its own outline in front of what
 * stands behind it.
 */
function layer(g, draw, shade) {
  const part = new Grid(g.w, g.h);
  draw(part);
  part.tone(shade).outline();
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) if (part.m[y][x]) g.m[y][x] = part.m[y][x];
}

/** The Minster, centred on column c (37 wide); its base is the grid's bottom row. */
function minster(g, c) {
  const B = g.h - 1;
  // Nave behind everything, under a pitched roof.
  layer(g, (q) => { q.rect(c - 17, 30, 35, B - 29, 'S'); q.rect(c - 15, 29, 31, 1, 'R').rect(c - 13, 28, 27, 1, 'R'); });
  // Outer towers: 5 wide, low pyramid caps.
  for (const cx of [c - 14, c + 14]) layer(g, (q) => { q.spire(cx, 18, 23, 2, 'R', 2); q.rect(cx - 2, 24, 5, B - 23, 'S'); });
  // Inner towers: 5 wide, tall needle caps.
  for (const cx of [c - 8, c + 8]) layer(g, (q) => { q.spire(cx, 7, 15, 4, 'R', 2); q.rect(cx - 2, 16, 5, B - 15, 'S'); });
  // Crossing tower: body, gallery, octagonal stage, spire (tip on row 1, outline row 0).
  layer(g, (q) => {
    q.spire(c, 1, 9, 3, 'R', 2);
    q.rect(c - 3, 10, 7, 4, 'S');
    q.rect(c - 6, 14, 13, 1, 'R');
    q.rect(c - 5, 15, 11, B - 14, 'S');
  });
  windows(g, [c - 1, c + 1], [11], 'Y', 1, 2);          // octagon lights
  windows(g, [c - 3, c, c + 3], [18, 24], 'Y');         // belfry and stage, 3px rhythm
  windows(g, [c - 8, c + 8], [19, 26], 'Y');            // inner towers
  windows(g, [c - 14, c + 14], [27, 34], 'Y');          // outer towers
  // Rose window and the lit west door, round-headed.
  g.rect(c - 1, 30, 3, 3, 'Y').set(c - 1, 30, 'S').set(c + 1, 30, 'S').set(c - 1, 32, 'S').set(c + 1, 32, 'S');
  g.rect(c - 2, 37, 5, B - 36, 'Y').set(c - 2, 37, 'S').set(c + 2, 37, 'S');
  g.rect(c, 37, 1, B - 36, 'D');
}

/** The Old Town Hall, x = left column, 34 wide. */
function townHall(g, x) {
  const B = g.h - 1, w = 34, c = x + 16;                 // centre bay columns c, c+1
  // Ridge turret behind the roof: lantern, cap, finial.
  layer(g, (q) => { q.rect(c, 4, 2, 3, 'R'); q.spire(c, 7, 9, 1, 'R', 2).rect(c - 1, 7, 4, 1, 'R'); q.rect(c - 2, 10, 6, 7, 'S'); }, 1);
  layer(g, (q) => {
    q.rect(x, 24, w, B - 23, 'H');                       // plaster front
    // Slate mansard, stepped in at the ends.
    q.rect(x + 5, 17, w - 10, 1, 'R').rect(x + 4, 18, w - 8, 1, 'R').rect(x + 3, 19, w - 6, 1, 'R').rect(x + 1, 20, w - 2, 4, 'R');
  }, 2);
  // Pediment over the centre bay (rows 19–23), white cornice, a shadow line under it.
  for (let k = 0; k < 5; k++) g.rect(c - k, 19 + k, 2 + 2 * k, 1, 'H');
  g.rect(c - 4, 23, 10, 1, 'W');
  g.rect(x, 24, w, 1, 'W').rect(x, 25, w - 2, 1, 'h');
  // Centre bay: pilasters in white, shade on its right.
  g.rect(c - 5, 25, 1, B - 30, 'W').rect(c + 6, 25, 1, B - 30, 'h');
  // Three floors of windows, 2×3 on a 4px rhythm, white with a shade sill.
  const xs = [x + 2, x + 6, x + 25, x + 29], bay = [c - 3, c + 2];
  for (const y of [27, 32]) { windows(g, [...xs, ...bay], [y], 'W', 2, 3); for (const wx of [...xs, ...bay]) g.rect(wx, y + 3, 2, 1, 'h'); }
  windows(g, xs, [37], 'W', 2, 3);
  windows(g, [c, c], [27, 32], 'W', 2, 3);
  // The outside stair: two flights climbing to the door in the centre bay.
  g.rect(c - 1, 36, 4, 3, 'S');                           // the door
  g.rect(c - 3, 39, 8, 1, 'h').rect(c - 5, 40, 12, 1, 'h').rect(c - 7, 41, 16, 1, 'h').rect(c - 9, 42, 20, 2, 'h');
  for (let k = 0; k < 4; k++) g.set(c - 3 - 2 * k, 39 + k, 'W').set(c + 4 + 2 * k, 39 + k, 'W');
}

/** The Post Tower, x = left column, 16 wide. */
function postTower(g, x) {
  const B = g.h - 1;
  layer(g, (q) => q.rect(x + 10, 9, 6, B - 8, 'G'), 1);
  layer(g, (q) => q.rect(x, 3, 9, B - 2, 'G'), 2);
  g.rect(x + 9, 9, 1, B - 8, 'D');                        // the slot between the halves
  for (let y = 6; y < B - 1; y += 4) { g.rect(x + 1, y, 6, 1, 'g'); g.rect(x + 11, y + 2, 3, 1, 'g'); }
  g.rect(x, 3, 9, 1, 'q').rect(x + 10, 9, 6, 1, 'q');     // dark crowns
}

/** The riverside trees, BEHIND the buildings: a band along the base with rounded crowns. */
function hedge(g, x0, x1, crowns) {
  const B = g.h - 1;
  const put = (x, y) => { if (!g.get(x, y)) g.set(x, y, 'T'); };
  for (let x = x0; x < x1; x++) for (let y = B - 3; y <= B; y++) if (!((x === x0 || x === x1 - 1) && y === B - 3)) put(x, y);
  for (const [cx, w, h] of crowns) for (let k = 0; k < h; k++) {
    const inset = k >= h - 2 ? k - h + 3 : 0;
    for (let x = cx + inset; x < cx + w - inset; x++) put(x, B - 4 - k);
  }
}

function finishTrees(g) {
  // A lit pixel at the upper left of each crown.
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
    if (g.get(x, y) === 'T' && g.get(x, y - 1) === 'o' && g.get(x + 1, y) === 'T') g.set(x, y, 't');
  }
}

/** The whole skyline group, standing on the bar's top outline row (`base` = bar top). */
export function drawSkyline(r, x, base, p) {
  const g = new Grid(SKYLINE_W, SKY_ROWS);
  minster(g, 19);
  townHall(g, 41);
  postTower(g, 77);
  hedge(g, 0, SKYLINE_W, [[0, 5, 3], [36, 6, 5], [74, 4, 4], [90, 4, 3]]);
  g.outline();
  finishTrees(g);
  g.paint(r, x, base - SKY_ROWS, p);
}

/** The Minster alone, for movable modals. */
export function drawMinster(r, x, base, p) {
  const g = new Grid(MINSTER_W, SKY_ROWS);
  minster(g, 19);
  hedge(g, 0, MINSTER_W, [[0, 4, 3], [35, 4, 3]]);
  g.outline();
  finishTrees(g);
  g.paint(r, x, base - SKY_ROWS, p);
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
