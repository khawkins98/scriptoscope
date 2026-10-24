// Independent acceptance inputs frozen on 009af115 before candidate source review.
// Behavioral contract: bevel-border-retirement BG01–12/F01–06/F13 and qd geometry.
// Literal expected rectangles/spans preserve current compatibility; no native claim.
import '../../../tests/helpers/registerTs.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
const api = await import('./cinfFrame.ts');
const rect = ([left, top, right, bottom]) => ({ left, top, right, bottom });
const tuple = value => [value.left, value.top, value.right, value.bottom];
const plan = (width, height, cornerSize, sideThickness, tileSides, D) =>
  api.cinfBorderPlan({ width, height }, { cornerSize, sideThickness, tileSides }, rect(D));
// PM interface-only relay: extents are raw [sourceW, sourceH, destinationW, destinationH].
const spans = piece => ({ rw: piece.extents[0], rh: piece.extents[1], dw: piece.extents[2], dh: piece.extents[3] });
const order = ['TL', 'TR', 'top', 'BL', 'BR', 'bottom', 'left', 'right'];

test('eight ordered pieces retain independent source/target geometry and fast rows', () => {
  const parts = plan(9, 9, 4, 1, 0, [0, 0, 29, 9]);
  assert.deepEqual(parts.map(p => [p.piece, tuple(p.src), tuple(p.dst), p.fast]), [
    ['TL', [0, 0, 4, 4], [0, 0, 4, 4], null],
    ['TR', [5, 0, 9, 4], [25, 0, 29, 4], null],
    ['top', [4, 0, 5, 1], [4, 0, 25, 1], 'T1'],
    ['BL', [0, 5, 4, 9], [0, 5, 4, 9], null],
    ['BR', [5, 5, 9, 9], [25, 5, 29, 9], null],
    ['bottom', [4, 8, 5, 9], [4, 8, 25, 9], 'T1'],
    ['left', [0, 4, 1, 5], [0, 4, 1, 5], null],
    ['right', [8, 4, 9, 5], [28, 4, 29, 5], null],
  ]);
});

test('tiny targets keep overlapping corners and inverted side destinations', () => {
  const parts = plan(9, 9, 4, 1, 0, [0, 0, 16, 1]);
  assert.deepEqual(parts.map(p => p.piece), order);
  assert.deepEqual(tuple(parts[3].src), [0, 5, 4, 9]);
  assert.deepEqual(tuple(parts[3].dst), [0, -3, 4, 1]);
  assert.deepEqual(tuple(parts[6].dst), [0, 4, 1, -3]);
  assert.deepEqual(tuple(parts[7].dst), [15, 4, 16, -3]);
});

test('side thicker than corner keeps source-clamped thickness and late side pieces', () => {
  const parts = plan(21, 21, 7, 14, 0, [0, 0, 29, 29]);
  assert.deepEqual([tuple(parts[2].src), tuple(parts[2].dst)], [[7, 0, 8, 14], [7, 0, 22, 14]]);
  assert.deepEqual([tuple(parts[6].src), tuple(parts[6].dst)], [[0, 7, 14, 8], [0, 7, 14, 22]]);
  assert.deepEqual(parts.map(p => p.piece), order);
  const clamped = plan(3, 5, 1, 14, 0, [0, 0, 16, 9]);
  assert.deepEqual(tuple(clamped[2].src), [1, 0, 2, 5]);
  assert.deepEqual(tuple(clamped[6].src), [0, 1, 3, 2]);
});

test('engine out-of-source and negative repeat rectangles remain observable', () => {
  const normal = plan(3, 5, 3, 1, 0, [0, 0, 16, 9]);
  assert.deepEqual([tuple(normal[2].src), tuple(normal[2].dst), normal[2].fast], [[3, 0, 4, 1], [3, 0, 13, 1], 'T1']);
  const repeat = plan(3, 5, 3, 1, 1, [0, 0, 16, 9]);
  assert.deepEqual(tuple(repeat[2].src), [3, 0, 0, 1]);
  assert.deepEqual(tuple(repeat[6].src), [0, 3, 1, 2]);
});

test('engine negative inputs receive no new normalization or empty-plan filtering', () => {
  const parts = plan(6, 6, -2, -1, 0, [0, 0, 16, 9]);
  assert.equal(parts.length, 8);
  assert.deepEqual(tuple(parts[0].src), [0, 0, -2, -2]);
  assert.deepEqual(tuple(parts[0].dst), [0, 0, -2, -2]);
  assert.deepEqual([tuple(parts[2].src), tuple(parts[2].dst), parts[2].fast], [[-2, 0, -1, -1], [-2, 0, 18, -1], 'T1']);
});

test('destination translation and tile phase retain original uncropped starts', () => {
  const parts = plan(7, 7, 2, 1, 1, [10, 20, 20, 27]);
  assert.deepEqual([tuple(parts[2].src), tuple(parts[2].dst)], [[2, 0, 5, 1], [12, 20, 18, 21]]);
  assert.deepEqual([tuple(parts[7].src), tuple(parts[7].dst)], [[6, 2, 7, 5], [19, 22, 20, 25]]);
});

test('nonbinary target spans retain scalar operation order separately from Rect lengths', () => {
  for (const [c, expectedRaw, expectedRect] of [
    [.1, 15.900000000000002, 15.9],
    [.2, 15.700000000000001, 15.700000000000003],
    [.3, 15.500000000000002, 15.5],
  ]) {
    const top = plan(6, 6, c, 1, 0, [0, 0, 16.1, 9])[2];
    assert.equal(spans(top).dw, expectedRaw);
    assert.equal(top.dst.right - top.dst.left, expectedRect);
  }
});

test('raw one-pixel spans cannot be replaced with engine endpoint fast classification', () => {
  const top = plan(6, 6, .9, 1, 0, [0, 0, 19.1, 9])[2];
  assert.equal(spans(top).rw, 1);
  assert.equal(spans(top).dw, 17.3);
  assert.equal(top.src.right - top.src.left, .9999999999999999);
  assert.equal(top.dst.right - top.dst.left, 17.300000000000004);
  assert.equal(top.fast, null);
  const nearOne = plan(6, 6, .9, 1, 0, [0, 0, 2.8, 9])[2];
  assert.equal(spans(nearOne).dw, .9999999999999998);
  assert.equal(nearOne.dst.right - nearOne.dst.left, .9999999999999999);
});
