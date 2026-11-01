// The #597 fixture oracle (hit-region-rules.mjs) against the decode's own hooks
// (hit-regions.md §7 T1–T6, T8, T12) on synthetic recipes. The browser specs
// (frame-pass-through*.spec.mjs) choose their points with this oracle, so each
// rule it transcribes must be pinned and each listed mutation must fail here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { structureRegion, cellAt, pickPoints, IN, OUT, UNKNOWN, builtInNotches, pathNumbers } from './hit-region-rules.mjs';

/** A 10 × 10 template: frame 3 px on every side, body A = (3, 3, 7, 7). */
function template(maskAt) {
  return { width: 10, height: 10, alphaAt: (x, y) => (maskAt(x, y) ? 255 : 0) };
}
const side = [{ at: 0, part: 'part-1' }, { at: 3, part: 'part-1' }, { at: 7, part: 'part-8' }, { at: 10, part: 'part-1' }];
const windowType = { parts: { 'part-0': { rect: [3, 3, 7, 7] } }, edges: { top: side, bottom: side, left: side, right: side } };
// Content 20 × 12 at (3, 3): W = 26, H = 18.
const C = { left: 3, top: 3, right: 23, bottom: 15 }, W = 26, H = 18;
const at = (r, x, y) => r.region[y * W + x];

test('T1/T2 (SR10, WH1): frame membership follows the template mask, not the cell rect or pixel colour', () => {
  // Mask clear only at template (1, 1): the top-left fixed corner cell, outside C.
  const cicn = template((x, y) => !(x === 1 && y === 1));
  const r = structureRegion({ windowType, cicn, C, W, H });
  assert.equal(at(r, 1, 1), OUT, 'T1: mask-clear corner pixel excluded');
  assert.equal(at(r, 0, 0), IN, 'T2: mask-set corner pixel included');
  assert.equal(at(structureRegion({ windowType, cicn, C, W, H, mutation: 'noMask' }), 1, 1), IN, 'T1 mutation: no mask');
  assert.equal(at(structureRegion({ windowType, cicn, C, W, H, mutation: 'invertMask' }), 0, 0), OUT, 'T2 mutation: invert');
});

test('T3 (SR11): a transparent body still leaves all of C in S', () => {
  const cicn = template((x, y) => x < 3 || y < 3 || x >= 7 || y >= 7);
  const r = structureRegion({ windowType, cicn, C, W, H });
  for (const [x, y] of [[3, 3], [12, 9], [22, 14]]) assert.equal(at(r, x, y), IN);
  assert.equal(at(structureRegion({ windowType, cicn, C, W, H, mutation: 'cellsOnly' }), 12, 9), OUT);
});

test('T4 (TR3, TR4): a non-uniform 3 × 2 tile repeats at its pitch from the anchored corner', () => {
  const rows = ['110', '100'], mask = (x, y) => rows[y][x] === '1';
  const src = { left: 0, top: 0, right: 3, bottom: 2 }, dst = { left: 0, top: 0, right: 8, bottom: 5 };
  const grid = (code, mutation) => Array.from({ length: 5 }, (_, y) => Array.from({ length: 8 }, (_, x) => (cellAt(mask, code, src, dst, x, y, mutation) === IN ? 1 : 0)).join(''));
  const forward = ['11011011', '10010010', '11011011', '10010010', '11011011'];
  // Anchored bottom-right: dst (7, 4) is src (2, 1).
  const reverse = ['00100100', '10110110', '00100100', '10110110', '00100100'];
  assert.deepEqual(grid(12), forward);
  assert.deepEqual(grid(11), reverse);
  assert.deepEqual(grid(14), reverse);
  assert.notDeepEqual(grid(12, 'reverseAll'), forward);
  assert.notDeepEqual(grid(11, 'forwardAll'), reverse);
  const scaled = Array.from({ length: 5 }, (_, y) => Array.from({ length: 8 }, (_, x) => cellAt(mask, 12, src, dst, x, y, 'scaleTiles')));
  assert.ok(scaled.flat().some((v, j) => v !== UNKNOWN && v !== (forward[Math.floor(j / 8)][j % 8] === '1' ? IN : OUT)), 'scaling contradicts the repeat');
});

test('T5 (SR8): code 18 scales its mask (3-px blocks), it does not repeat it', () => {
  const mask = (x, y) => (x + y) % 2 === 0;
  const src = { left: 0, top: 0, right: 2, bottom: 2 }, dst = { left: 0, top: 0, right: 6, bottom: 6 };
  const v = (x, y, m) => cellAt(mask, 18, src, dst, x, y, m);
  assert.deepEqual([v(1, 1), v(4, 1), v(1, 4), v(4, 4)], [IN, OUT, OUT, IN]);
  assert.deepEqual([v(2, 0), v(3, 0)], [IN, OUT], '3-px blocks: column 2 still block 0');
  assert.equal(v(3, 1), OUT);
  assert.notEqual(v(3, 1, 'tile18'), v(3, 1), 'tiling repeats at a 2-px period');
});

test('T6 (TR1): a 1 × 4 source is scaled into 2-px bands, not repeated', () => {
  const mask = (x, y) => y % 2 === 0;
  const src = { left: 0, top: 0, right: 1, bottom: 4 }, dst = { left: 0, top: 0, right: 8, bottom: 8 };
  const col = Array.from({ length: 8 }, (_, y) => cellAt(mask, 12, src, dst, 5, y));
  assert.deepEqual(col, [IN, IN, OUT, OUT, IN, IN, OUT, OUT]);
});

test('T8 (SR12): pixels no walked cell covers are excluded; T12 (SR6): collapsed walks only the title-axis sides', () => {
  // A top side that stops at template x = 7 and a right side that starts at y = 3:
  // the top-right corner is covered by no cell (window-widgets Q3).
  const short = [{ at: 0, part: 'part-1' }, { at: 3, part: 'part-1' }, { at: 7, part: 'part-8' }];
  const late = [{ at: 3, part: 'part-1' }, { at: 7, part: 'part-8' }, { at: 10, part: 'part-1' }];
  const wt = { ...windowType, edges: { ...windowType.edges, top: short, right: late } };
  const cicn = template(() => true);
  const r = structureRegion({ windowType: wt, cicn, C, W, H });
  assert.equal(at(r, W - 1, 0), OUT, 'top-right corner reached by no cell');
  assert.equal(at(structureRegion({ windowType: wt, cicn, C, W, H, mutation: 'bbox' }), W - 1, 0), IN);
  const Cc = { left: 3, top: 3, right: 23, bottom: 3 }, Hc = 6;
  const rc = structureRegion({ windowType, cicn, C: Cc, W, H: Hc, collapsed: true });
  // Left side cells lie at x 0..2 from the top edge down: excluded when collapsed (outside top/bottom rows).
  assert.equal(rc.region[0 * W + 1], IN, 'top side kept');
  assert.equal(rc.region[4 * W + 1], IN, 'bottom side kept');
  const four = structureRegion({ windowType: { ...windowType, edges: { ...windowType.edges, top: [], bottom: [] } }, cicn, C: { left: 3, top: 3, right: 23, bottom: 9 }, W, H: 12, collapsed: true });
  assert.equal(four.region[5 * W + 1], OUT, 'collapsed: the left side is not walked');
  const fourMut = structureRegion({ windowType: { ...windowType, edges: { ...windowType.edges, top: [], bottom: [] } }, cicn, C: { left: 3, top: 3, right: 23, bottom: 9 }, W, H: 12, collapsed: true, mutation: 'fourSidesCollapsed' });
  assert.equal(fourMut.region[5 * W + 1], IN);
});

test('SR3: no template gives no region (HP7 keeps the box)', () => {
  assert.equal(structureRegion({ windowType, cicn: null, C, W, H }), null);
});

test('fixture picker returns uniform-neighbourhood points and avoids C', () => {
  const cicn = template((x, y) => !(y < 3 && x >= 3 && x < 7)); // the top middle (tiled) cell is transparent
  const r = structureRegion({ windowType, cicn, C, W, H });
  const p = pickPoints({ region: r.region, W, H, C }, { r: 1 });
  assert.ok(p.p_out && at(r, ...p.p_out) === OUT && p.p_out[1] < 3);
  assert.ok(p.p_in && at(r, ...p.p_in) === IN);
  assert.deepEqual(p.p_c, [13, 9]);
});

test('PF1 notches and path parsing helpers', () => {
  assert.deepEqual(builtInNotches(30, 20), [[29, 0], [29, 1], [0, 19], [1, 19]]);
  assert.deepEqual(pathNumbers('path("M 0 0 H 4 V 2 H 0 Z")'), [0, 0, 4, 2, 0]);
  assert.deepEqual(pathNumbers('path(nonzero, "M0 0H4V2H0Z")'), [0, 0, 4, 2, 0]);
  assert.equal(pathNumbers('none'), null);
});
