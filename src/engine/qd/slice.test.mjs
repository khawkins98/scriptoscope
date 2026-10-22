// Slicer and axis primitives (docs/spec/engine/scrollbar.md §5.9; qd-primitives L1–L3, SC3).
import '../../../tests/helpers/registerTs.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
const { slicePieces, drawSlices, axis, alongLength, pixmapBounds, rect, newRegion, regionHas, createTrace, expandIdGrid } = await import('../index.ts');

const pm = (w, h, rgba) => {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) data.set(rgba, i * 4);
  return { width: w, height: h, data };
};
const iv = (r, h = true) => (h ? [r.left, r.right] : [r.top, r.bottom]);
const CAP = 3; // the scroll-bar table's mode-0 cap (SCROLLBAR_GEOMETRY.caps.modeZeroCap)

test('axis: along/cross readers and builder swap for vertical', () => {
  const r = rect(1, 2, 11, 32);
  const h = axis(true), v = axis(false);
  assert.deepEqual([h.a0(r), h.a1(r), h.c0(r), h.c1(r)], [2, 32, 1, 11]);
  assert.deepEqual([v.a0(r), v.a1(r), v.c0(r), v.c1(r)], [1, 11, 2, 32]);
  assert.deepEqual(h.mk(0, 5, 1, 2), rect(1, 0, 2, 5));
  assert.deepEqual(v.mk(0, 5, 1, 2), rect(0, 1, 5, 2));
  assert.equal(alongLength(h, r), 30);
  assert.deepEqual(pixmapBounds({ width: 4, height: 3, data: new Uint8ClampedArray(48) }), rect(0, 0, 3, 4));
});

test('§5.9 equal sizes: one 1:1 piece', () => {
  assert.deepEqual(slicePieces(true, rect(0, 0, 16, 17), rect(0, 52, 16, 69), 0, CAP).map(p => p.piece), ['1:1']);
});

test('§5.9 caps: 16 → 11 (k = 3, q1 = 3, q2 = 2), the scroll-bar t = 11 thumb', () => {
  const pieces = slicePieces(true, rect(0, 0, 16, 16), rect(0, 0, 11, 11), 0, CAP).map(p => [p.piece, iv(p.dst), iv(p.src)]);
  assert.deepEqual(pieces, [['caps-1', [0, 3], [0, 3]], ['caps-3', [3, 9], [6, 12]], ['caps-5', [9, 11], [14, 16]]]);
});

test('§5.9 caps with a negative mode use k = −mode; growing adds the one-column pieces 2 and 4', () => {
  const pieces = slicePieces(true, rect(0, 0, 16, 10), rect(0, 0, 16, 20), -2, CAP);
  assert.deepEqual(pieces.map(p => [p.piece, iv(p.dst), iv(p.src), p.line]), [
    ['caps-1', [0, 2], [0, 2], false],
    ['caps-2', [2, 7], [1, 2], true],
    ['caps-3', [7, 14], [2, 9], false],
    ['caps-4', [14, 19], [8, 9], true],
    ['caps-5', [19, 20], [9, 10], true],
  ]);
});

test('§5.9 halves: a = m >> 1, middle column stretched; vertical swaps the axes', () => {
  const h = slicePieces(true, rect(0, 15, 16, 18), rect(0, 15, 16, 53), 1, CAP).map(p => [iv(p.dst), iv(p.src), p.line]);
  assert.deepEqual(h, [[[15, 16], [15, 16], true], [[16, 51], [16, 17], true], [[51, 53], [16, 18], false]]);
  const v = slicePieces(false, rect(15, 0, 18, 16), rect(15, 0, 53, 16), 1, CAP).map(p => [iv(p.dst, false), iv(p.src, false)]);
  assert.deepEqual(v, [[[15, 16], [15, 16]], [[16, 51], [16, 17]], [[51, 53], [16, 18]]]);
});

test('drawSlices: a line piece skips mask-clear rows (L1) and the region unions mapped masks', () => {
  const src = pm(3, 4, [10, 20, 30, 255]);
  src.data[(2 * 3 + 1) * 4 + 3] = 0; // column 1, row 2 mask-clear
  const port = pm(12, 4, [0, 0, 0, 0]);
  const region = newRegion(port);
  const trace = createTrace('slice');
  drawSlices(port, true, src, rect(0, 0, 4, 3), rect(0, 0, 4, 12), 1, { modeZeroCap: CAP, row: 'TEST', region, trace });
  assert.deepEqual(trace.drawOps.map(o => o.op), ['sliceLines', 'sliceLines', 'slice']);
  const at = (x, y) => Array.from(port.data.slice((y * 12 + x) * 4, (y * 12 + x) * 4 + 4));
  assert.deepEqual(at(5, 1), [10, 20, 30, 255]);
  assert.deepEqual(at(5, 2), [0, 0, 0, 0], 'mask-clear row not drawn');
  assert.equal(regionHas(region, 5, 1), true);
  assert.equal(regionHas(region, 5, 2), false);
});

test('expandIdGrid: every base + one term per array, de-duplicated', () => {
  assert.deepEqual(expandIdGrid({ bases: [-10, 100], terms: [[0, 1], [0, 2]] }), [-10, -8, -9, -7, 100, 102, 101, 103]);
  assert.deepEqual(expandIdGrid({ bases: [0], terms: [[0, 4], [4, 0]] }), [4, 0, 8]);
});
