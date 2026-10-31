// Bonn's skyline, Beethoven, the cherry bough and the small ornaments above
// the bar. First painted over the concept (concept/concept.jpg, 3 concept px
// per pixel, `npm run paint-over`), then redrawn by hand on whole pixels from
// what makes each real building recognisable:
//
//   - the Minster (Romanesque): a tall octagonal crossing tower (three faces
//     showing: lit, front, shade) under a green-grey slate spire, a ring of
//     gables at its foot, round-arched windows, a dwarf gallery and grey tufa
//     string courses on the sandstone; the pair of slimmer east towers with
//     their own pointed spires either side;
//   - the Altes Rathaus (rococo): a rose facade with white cornice, pilasters
//     and window frames, a grey mansard with dormers, a small bell lantern on
//     the ridge, gold over the door, and the double outside staircase with a
//     gilded balustrade climbing to it;
//   - the Post Tower: two offset glass half-ellipses with a gap between them,
//     very tall and slender, blue-green with horizontal banding (three tones
//     across each half for the curve);
//   - the Langer Eugen: a slim pale slab with a dense grid of dark window strips;
//   - Beethoven: a bust on a sandstone plinth (wild grey hair, a frown, a white
//     stock and red scarf), as on the monument in front of the Minster.
//
// Each building is built on a material grid (one letter per pixel), toned in
// three steps (light from the upper left), given its own 1px dark outline and
// laid back to front, so towers stand clear of what is behind them. The
// state's palette paints it: active and inactive are one drawing.
//
// Placement (frames.mjs): the Minster stands over the pennant's left cap and
// the Rathaus over its right cap, so the skyline straddles the title and moves
// with it; the Post Tower and the Langer Eugen stand over the right corner,
// above the zoom and collapse boxes; Beethoven and the bough over the left one.

export const SKY_ROWS = 78;    // rows above the bar (the spire's tip is on row 1)
export const MINSTER_W = 40;   // the left cap: Minster + trees
export const HALL_W = 48;      // the right cap: Town Hall + trees
export const BOUGH_W = 40;     // the left corner: the cherry bough
export const SPRIG_W = 24;     // dialog top ornament
export const ALERT_W = 24;     // alert top ornament

// Body materials → [lit, shade] tone letters.
const TONES = { A: ['a', 'z'], U: ['u', 'v'], R: ['r', 'x'], H: ['h', 'y'], M: ['m', 'n'], G: ['g', 'q'], E: ['e', 'f'], T: ['t', null] };

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
      o: p.outline, w: p.window, W: p.trim, Y: p.lamp, K: S.gold, k: S.goldLo, s: S.strip,
      A: S.stone, a: S.stoneHi, z: S.stoneLo,
      U: S.tufa, u: S.tufaHi, v: S.tufaLo,
      E: S.concrete, e: S.concreteHi, f: S.concreteLo,
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

/** A round-arched window, w wide (odd) and h tall, top-left (x, y). */
const arch = (g, x, y, w, h, v = 'w') => { g.rect(x + 1, y, w - 2, 1, v).rect(x, y + 1, w, h - 1, v); };

/** The Minster, centred on column c; its base is the grid's bottom row (77). */
function minster(g, c) {
  const B = g.h - 1;
  // Nave and choir behind everything, under a slate roof.
  layer(g, (q) => { q.rect(c - 11, 49, 23, 1, 'R').rect(c - 13, 50, 27, 2, 'R'); q.rect(c - 14, 52, 29, B - 51, 'A'); });
  // The two slim east towers: square, with pointed slate spires.
  for (const cx of [c - 11, c + 11]) layer(g, (q) => {
    q.spire(cx, 15, [0, 0, 0, 1, 1, 1, 2, 2, 2, 3, 3], 'R');
    q.rect(cx - 3, 26, 7, B - 25, 'A');
  });
  // The octagonal crossing tower: a ring of gables, then the tall spire.
  layer(g, (q) => {
    q.spire(c, 1, [0, 0, 0, 0, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4], 'R');
    for (const gx of [c - 4, c, c + 4]) q.spire(gx, 26, [0, 1, 2, 2], 'A');
    q.rect(c - 6, 30, 13, 35, 'A');
  });
  // The octagon's faces: lit on the left, shaded on the right, front between.
  for (let y = 26; y < 65; y++) for (let x = c - 6; x <= c + 6; x++) {
    const v = g.get(x, y);
    if (v !== 'A' && v !== 'a' && v !== 'z') continue;
    g.set(x, y, x <= c - 4 ? 'a' : x >= c + 4 ? 'z' : 'A');
  }
  // Grey tufa string courses (on the faces: lit, body, shade tufa).
  const course = (y, x0, x1) => { for (let x = x0; x <= x1; x++) { const v = g.get(x, y); if ('Aaz'.includes(v ?? '.')) g.set(x, y, v === 'a' ? 'u' : v === 'z' ? 'v' : 'U'); } };
  for (const y of [34, 43, 52, 61]) course(y, c - 6, c + 6);
  for (const y of [33, 44, 55, 65]) { course(y, c - 14, c - 8); course(y, c + 8, c + 14); }
  course(66, c - 14, c + 14);
  // Round-arched windows: two per stage on the octagon's front, one per stage on the east towers.
  for (const y of [36, 45]) { arch(g, c - 3, y, 3, 5); arch(g, c + 1, y, 3, 5); }
  for (const cx of [c - 11, c + 11]) for (const y of [28, 36, 46, 57]) arch(g, cx - 1, y, 3, 5);
  // The dwarf gallery: a row of little arches under the third course.
  for (let x = c - 5; x <= c + 5; x += 2) g.rect(x, 54, 1, 3, 'w');
  // The west portal, round-headed, and a rose window over it.
  arch(g, c - 2, 70, 5, B - 69);
  g.rect(c - 1, 68, 3, 1, 'Y');
}

/** The Altes Rathaus, 46 wide, x = its left column. */
function townHall(g, x) {
  const B = g.h - 1, w = 46, c = x + 22;               // centre bay columns c, c+1
  // The bell lantern on the ridge: a gold finial, a slate cap, an open arch with the bell.
  layer(g, (q) => { q.rect(c, 31, 2, 2, 'M').rect(c - 1, 33, 4, 1, 'M').rect(c - 1, 34, 4, 10, 'M'); }, 1);
  g.rect(c, 29, 2, 2, 'K').rect(c, 36, 2, 4, 'w').set(c, 38, 'K').set(c + 1, 38, 'k');
  // Grey mansard and the rose front.
  layer(g, (q) => {
    q.rect(x + 5, 44, w - 10, 1, 'M').rect(x + 3, 45, w - 6, 1, 'M').rect(x + 2, 46, w - 4, 1, 'M').rect(x + 1, 47, w - 2, 7, 'M');
    q.rect(x, 54, w, B - 53, 'H');
  });
  // White dormers.
  for (const dx of [6, 13, 30, 37]) g.rect(x + dx, 47, 3, 4, 'W').rect(x + dx + 1, 48, 1, 3, 'w');
  // White cornice and its shadow; white pilasters at the corners and either side of the centre bay.
  g.rect(x, 54, w, 1, 'W').rect(x + 1, 55, w - 3, 1, 'y');
  for (const px of [x + 1, c - 6, c + 7]) g.rect(px, 56, 1, B - 56, 'W');
  // Windows in white frames: a small top floor, a tall piano nobile, the ground floor.
  const bays = [x + 4, x + 9, x + 14, x + 29, x + 34, x + 39];
  for (const bx of bays) {
    g.rect(bx - 1, 56, 4, 1, 'W').rect(bx, 57, 2, 2, 'w');
    g.rect(bx - 1, 60, 4, 1, 'W').rect(bx, 61, 2, 4, 'w').rect(bx - 1, 65, 4, 1, 'W');
    g.rect(bx - 1, 68, 4, 1, 'W').rect(bx, 69, 2, 4, 'w');
  }
  for (const bx of [c - 3, c + 3]) g.rect(bx - 1, 56, 4, 1, 'W').rect(bx, 57, 2, 2, 'w');
  // The door to the piano nobile with gold over it.
  g.rect(c - 2, 58, 6, 1, 'K').rect(c - 1, 59, 4, 1, 'k').set(c, 57, 'K').set(c + 1, 57, 'K');
  g.rect(c - 1, 60, 4, 1, 'W').rect(c, 61, 2, 6, 'w');
  // The double outside staircase: a landing at the door, two flights down to
  // the street either side, a gilded balustrade along the top of all three.
  g.rect(c - 5, 67, 12, 2, 'A').rect(c - 5, 66, 12, 1, 'K').rect(c - 5, 69, 12, 1, 'z');
  for (let k = 0; k <= 9; k++) {
    const y = 67 + k + 1;
    // Each flight is a 3px band of treads, with the facade showing under it.
    g.rect(c - 8 - k, y, 3, 1, 'A').set(c - 8 - k, y, 'a').set(c - 6 - k, y, 'z');
    g.rect(c + 7 + k, y, 3, 1, 'A').set(c + 7 + k, y, 'a').set(c + 9 + k, y, 'z');
    g.set(c - 8 - k, y - 1, k % 2 ? 'k' : 'K').set(c + 9 + k, y - 1, k % 2 ? 'k' : 'K');
  }
  for (let px = c - 5; px <= c + 6; px += 2) g.set(px, 66, 'k');               // balusters
  g.rect(c, 70, 2, B - 69, 'w');                                               // the street door under the landing
}

/** The Post Tower: two offset glass half-ellipses with a gap, x = left column. */
function postTower(g, x) {
  const B = g.h - 1;
  layer(g, (q) => q.rect(x + 11, 11, 6, B - 10, 'G'), 2);                    // the lower half, behind
  layer(g, (q) => q.rect(x, 4, 8, B - 3, 'G'), 3);                           // the taller half
  // Horizontal banding every third row, and the lit crowns.
  for (let y = 6; y < B; y += 3) for (let i = x; i <= x + 17; i++) if (g.get(i, y) === 'G') g.set(i, y, 'q');
  g.rect(x + 1, 4, 6, 1, 'g').rect(x + 12, 11, 4, 1, 'g');
}

/** The Langer Eugen: a slim pale slab with a dense grid of dark window strips, x = left column. */
function langerEugen(g, x) {
  const B = g.h - 1;
  layer(g, (q) => { q.rect(x + 2, 21, 5, 2, 'E'); q.rect(x, 23, 9, B - 22, 'E'); }, 2);
  for (let y = 25; y < B - 1; y++) if (y % 4) for (const i of [x + 2, x + 4, x + 6]) g.set(i, y, 's');
}

/** The left cap's sky: the Minster among trees. */
export function drawMinsterCap(r, x, base, p) {
  const g = new Grid(MINSTER_W, SKY_ROWS);
  trees(g, [[0, 10, 56], [30, 40, 56]]);
  minster(g, 20);
  g.paint(r, x, base - SKY_ROWS, p);
}

/** The right cap's sky: the Rathaus among trees. */
export function drawHallCap(r, x, base, p) {
  const g = new Grid(HALL_W, SKY_ROWS);
  trees(g, [[0, 14, 52], [32, 48, 52]]);
  townHall(g, 1);
  g.paint(r, x, base - SKY_ROWS, p);
}

/** The right corner's sky: the Post Tower and the Langer Eugen among trees (`w` = corner width). */
export function drawTowerCorner(r, x, base, w, p) {
  const g = new Grid(w, SKY_ROWS);
  trees(g, [[0, w, 58]]);
  postTower(g, 3);
  langerEugen(g, 24);
  g.paint(r, x, base - SKY_ROWS, p);
}

// Beethoven: a bust on a plinth, 15 wide. o outline, h/H/d hair (body, lit,
// shade), f/s skin (lit, shade), e brows, eyes and mouth, w the white stock,
// r the red scarf, c the coat.
const BEETHOVEN = [
  '..o.oo.oo.o....',
  '.ohohhohhohoo..',
  'ohHHhhhhhhhhhoo',
  'oHHhhhhhhhhhhdo',
  'ohHhhhhhhhhhddo',
  'ohhhffffffhhddo',
  'ohheeeffeeehddo',
  'ohhfefffffefhdo',
  '.ohffffsfffhddo',
  '.ohffffsffshdo.',
  '.ohhfseeesshdo.',
  '..ohfsfffsshdo.',
  '..oohsssssooo..',
  '..owwwrrwwwo...',
  '.occwwrrrwccco.',
  'occccwrrwccccco',
  'occcccwwccccccco'.slice(0, 15),
  'ooooooooooooooo',
];
const PLINTH = [
  '.ooooooooooooo.',
  '.oaaaaaaaaaaao.',
  '.oaAAAAAAAAAzo.',
  '.ozzzzzzzzzzzo.',
  'ooooooooooooooo',
];

export function drawBeethoven(r, x, yb, p) {
  const S = p.sky3, P = p.pier;
  const top = yb - PLINTH.length - BEETHOVEN.length;
  r.sprite(x, top, BEETHOVEN, { o: p.outline, h: S.hair, H: S.hairHi, d: S.hairLo, f: S.skin, s: S.skinLo, e: p.outline, w: p.trim, r: S.scarf, c: S.coat });
  r.sprite(x, yb - PLINTH.length, PLINTH, { o: p.outline, a: P.hi, A: P.face, z: P.lo });
}

/**
 * The left corner's sky: Beethoven on his plinth, and the cherry bough rising
 * beside him up to the right with clusters of rosettes, in front of trees.
 */
export function drawBough(r, x, yb, w, p) {
  const g = new Grid(w, SKY_ROWS);
  trees(g, [[14, w, 50]]);
  g.paint(r, x, yb - SKY_ROWS, p);
  const L = blossomLegend(p);
  const limb = (x0, y0, x1, y1, thick) => {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let i = 0; i <= n; i++) {
      const px = Math.round(x0 + ((x1 - x0) * i) / n), py = Math.round(y0 + ((y1 - y0) * i) / n);
      r.set(x + px, py, L.k);
      for (let t = 1; t < thick; t++) r.set(x + px, py + t, L.b);
    }
  };
  limb(16, yb - 3, 22, yb - 8, 3);
  limb(22, yb - 8, 34, yb - 16, 2);
  limb(34, yb - 16, 38, yb - 18, 2);
  limb(24, yb - 9, 27, yb - 21, 2);
  for (const [dx, dy] of [[17, -12], [22, -15], [24, -25], [28, -21], [32, -22], [29, -13], [33, -17], [19, -9]]) rosette(r, x + dx, yb + dy, p);
  drawBeethoven(r, x + 1, yb, p);
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
