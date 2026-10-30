// Bonn's skyline and the small ornaments above the bar. Original, stylised
// silhouettes on whole pixels (no smooth strokes):
//
//   - the Minster: a crossing tower with a capped spire, four flanking
//     towers and a low nave;
//   - the pink Old Town Hall: three floors of white windows, a slate mansard
//     with a pediment and ridge turret, the outside stair at its foot;
//   - the Post Tower: two glass slabs split by a dark slot, lit floor lines.
//
// A dark hedge (the riverside trees) links the bases along the bar's top
// edge, and the whole group carries ONE 1px outline, so it reads as a single
// figure against any page (R17). Light comes from the upper left: roofs are
// lit on their left slope, the plaster and glass on their left column.
//
// The group is built on a material grid (one letter per pixel), outlined by
// rule, then painted with the state's palette, so the active and inactive
// skylines are the same drawing.

export const SKYLINE_W = 72;   // document top: the whole group (code 10)
export const MINSTER_W = 29;   // movable modal top: the Minster alone (code 10)
export const SPRIG_W = 24;     // dialog top ornament
export const ALERT_W = 24;     // alert top ornament
export const SKY_ROWS = 24;    // rows above the bar the skyline may use

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
  /** 4-neighbour outline: every empty pixel touching the figure becomes 'o' (not below the base). */
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
  /** Light from the upper left: roof pixels with the outline to their left or above-left become lit. */
  lightRoofs() {
    const lit = [];
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      if (this.get(x, y) !== 'R') continue;
      const l = this.get(x - 1, y);
      if (l === 'o' || l === null) lit.push([x, y]);
    }
    for (const [x, y] of lit) this.set(x, y, 'L');
    return this;
  }
  paint(r, x0, y0, p) {
    const map = {
      o: p.outline, S: p.sky, R: p.sky, L: p.skyHi, T: p.sky, t: p.skyHi, Y: p.lamp,
      H: p.hall, h: p.hallLo, W: p.trim, G: p.glass, g: p.glassHi,
    };
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      const v = this.m[y][x];
      if (v) r.set(x0 + x, y0 + y, map[v]);
    }
  }
}

// Windows: 1×2 lamp blocks (yellow on the Minster, white on the Town Hall).
const windows = (g, xs, ys, v) => { for (const x of xs) for (const y of ys) g.set(x, y, v).set(x, y + 1, v); };

/**
 * Draw one component on its own grid, outline it and light its roofs, then
 * lay it over `g` (back to front), so every tower keeps its own outline in
 * front of what stands behind it.
 */
function layer(g, draw) {
  const part = new Grid(g.w, g.h);
  draw(part);
  part.outline().lightRoofs();
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) if (part.m[y][x]) g.m[y][x] = part.m[y][x];
}

/** The Minster, centred on column c; its base is the grid's bottom row. */
function minster(g, c) {
  const B = g.h - 1;
  // Nave behind everything: a low gabled roof over the whole width.
  layer(g, (q) => { q.rect(c - 11, 17, 23, B - 16, 'S'); q.rect(c - 10, 16, 21, 1, 'R'); });
  // Outer towers, low; inner towers, slender with tall caps.
  for (const cx of [c - 10, c + 10]) layer(g, (q) => { q.rect(cx, 13, 1, 1, 'R').rect(cx - 1, 14, 3, 1, 'R'); q.rect(cx - 1, 15, 3, B - 14, 'S'); });
  for (const cx of [c - 6, c + 6]) layer(g, (q) => { q.rect(cx, 7, 1, 2, 'R').rect(cx - 1, 9, 3, 2, 'R'); q.rect(cx - 1, 11, 3, B - 10, 'S'); });
  // Crossing tower: the spire (tip on row 1, so the outline is row 0) on a gallery.
  layer(g, (q) => {
    q.rect(c, 1, 1, 3, 'R').rect(c - 1, 4, 3, 3, 'R').rect(c - 2, 7, 5, 1, 'R');
    q.rect(c - 3, 8, 7, 1, 'R');
    q.rect(c - 3, 9, 7, B - 8, 'S');
  });
  windows(g, [c - 2, c, c + 2], [10], 'Y');           // belfry
  windows(g, [c - 6, c + 6], [12], 'Y');              // one high in each inner tower
  windows(g, [c - 1, c + 1], [14], 'Y');
  windows(g, [c - 10, c + 10], [17], 'Y');            // outer towers
  g.rect(c - 1, 19, 3, 4, 'Y').set(c - 1, 19, 'S').set(c + 1, 19, 'S');   // the lit west door, round-headed
}

/** The Old Town Hall, x = left column, 26 wide. */
function townHall(g, x) {
  const B = g.h - 1, w = 26, c = x + 12;              // turret over columns c, c+1
  // Ridge turret behind the roof.
  layer(g, (q) => { q.rect(c, 3, 2, 2, 'R').rect(c - 1, 5, 4, 4, 'R'); });
  layer(g, (q) => {
    q.rect(x, 12, w, B - 11, 'H');                    // plaster front
    // Slate mansard, stepped in at the ends.
    q.rect(x + 3, 8, w - 6, 1, 'R').rect(x + 2, 9, w - 4, 1, 'R').rect(x + 1, 10, w - 2, 2, 'R');
  });
  // Pediment over the centre bay, white cornice under the roof.
  g.set(c, 9, 'H').set(c + 1, 9, 'H').rect(c - 1, 10, 4, 1, 'H').rect(c - 2, 11, 6, 1, 'H');
  g.rect(x, 12, w, 1, 'W');
  g.rect(x + w - 1, 13, 1, B - 12, 'h');              // shade on the right
  // Three floors of windows, 3px rhythm, symmetric about the centre bay.
  windows(g, [x + 2, x + 5, x + 8, x + 17, x + 20, x + 23], [14, 17, 20], 'W');
  windows(g, [c, c + 1], [14, 17], 'W');
  // The outside stair: two flights climbing to the door in the centre bay.
  g.rect(c - 2, 20, 6, 1, 'h').rect(c - 4, 21, 10, 1, 'h').rect(c - 6, 22, 14, 1, 'h');
  g.rect(c - 6, 22, 1, 1, 'W').rect(c + 7, 22, 1, 1, 'W').rect(c - 4, 21, 1, 1, 'W').rect(c + 5, 21, 1, 1, 'W');
  g.rect(c, 19, 2, 1, 'S').rect(c, 20, 2, 1, 'S');    // the doorway
}

/** The Post Tower, x = left column, 12 wide. */
function postTower(g, x) {
  const B = g.h - 1;
  layer(g, (q) => q.rect(x + 7, 5, 5, B - 4, 'G'));
  layer(g, (q) => q.rect(x, 2, 6, B - 1, 'G'));
  g.rect(x, 2, 1, B - 1, 'g').rect(x + 7, 5, 1, B - 4, 'g');   // lit left edges
  for (let y = 5; y < B - 1; y += 4) { g.rect(x + 1, y, 5, 1, 'g'); g.rect(x + 8, y + 2, 4, 1, 'g'); }
}

/** The riverside trees, BEHIND the buildings: a 3px band along the base with rounded crowns. */
function hedge(g, x0, x1, crowns) {
  const B = g.h - 1;
  const put = (x, y) => { if (!g.get(x, y)) g.set(x, y, 'T'); };
  for (let x = x0; x < x1; x++) for (let y = B - 2; y <= B; y++) if (!((x === x0 || x === x1 - 1) && y === B - 2)) put(x, y);
  for (const [cx, w, h] of crowns) for (let k = 0; k < h; k++) {
    const inset = k === h - 1 ? 1 : 0;
    for (let x = cx + inset; x < cx + w - inset; x++) put(x, B - 3 - k);
  }
}

function litHedge(g) {
  // One lit pixel at the upper left of each crown and hedge run.
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
    if (g.get(x, y) === 'T' && g.get(x, y - 1) === 'o' && (g.get(x - 1, y) === 'o' || g.get(x - 1, y - 1) === 'o') && g.get(x + 1, y) === 'T') g.set(x, y, 't');
  }
}

/** The whole skyline group, standing on the bar's top outline row (`base` = bar top). */
export function drawSkyline(r, x, base, p) {
  const g = new Grid(SKYLINE_W, SKY_ROWS);
  minster(g, 14);
  townHall(g, 32);
  postTower(g, 59);
  hedge(g, 0, SKYLINE_W, [[0, 4, 2], [27, 5, 3], [56, 4, 2], [70, 2, 2]]);
  g.outline();
  litHedge(g);
  g.paint(r, x, base - SKY_ROWS, p);
}

/** The Minster alone, for movable modals. */
export function drawMinster(r, x, base, p) {
  const g = new Grid(MINSTER_W, SKY_ROWS);
  minster(g, 14);
  hedge(g, 0, MINSTER_W, [[0, 3, 2], [26, 3, 2]]);
  g.outline();
  litHedge(g);
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
