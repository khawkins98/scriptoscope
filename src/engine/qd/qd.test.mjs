// Unit tests for the engine's QuickDraw primitives. Expected pixels are
// derived by hand from docs/spec/engine/qd-primitives.md (§4 T-rows, §5 tile
// formula) and Inside Macintosh, not from the implementation's output.
import '../../../tests/helpers/registerTs.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const qd = await import('./index.ts');
const { createTrace } = await import('../trace.ts');
const { rect, rectXYWH, tileBlit, scaleBlit, cornerBlit, copyBits, copyMask, fillPattern, eraseRect, getPixel, setPixel, newPen, moveTo, lineTo, tileSourceOffset, transferForPort, tileFastPathRow } = qd;

const pm = (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) });
/** A pixmap whose pixel (x, y) is r = 10·(x+1), g = 10·(y+1), opaque. */
function labelled(w, h) {
  const p = pm(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) setPixel(p, x, y, 10 * (x + 1), 10 * (y + 1), 0, 255);
  return p;
}
/** Source column index read at each dst column of row y (via the r label), or null where untouched. */
const rowLabels = (p, y, x0, x1) => Array.from({ length: x1 - x0 }, (_, i) => { const px = getPixel(p, x0 + i, y); return px.a ? px.r / 10 - 1 : null; });
const colLabels = (p, x, y0, y1) => Array.from({ length: y1 - y0 }, (_, i) => { const px = getPixel(p, x, y0 + i); return px.a ? px.g / 10 - 1 : null; });

test('§5 tile formula: forward k % sw; reverse flush at the far end; equal when dw is a multiple of sw', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6].map(k => tileSourceOffset(k, 3, 7, 1)), [0, 1, 2, 0, 1, 2, 0]);
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6].map(k => tileSourceOffset(k, 3, 7, 0)), [2, 0, 1, 2, 0, 1, 2]);
  for (const dir of [0, 1]) assert.deepEqual([0, 1, 2, 3, 4, 5].map(k => tileSourceOffset(k, 3, 6, dir)), [0, 1, 2, 0, 1, 2]);
  assert.deepEqual([0, 1].map(k => tileSourceOffset(k, 3, 2, 0)), [1, 2], 'reverse dw < sw shows the last dw pixels');
});

test('T5 forward horizontal: first tile at dst left, far partial tile keeps the leading source columns', () => {
  const src = labelled(5, 2), port = pm(12, 4);
  tileBlit(port, src, rect(0, 1, 2, 4), rect(1, 2, 3, 9), 1, 'copyBits'); // sw 3, dw 7
  assert.deepEqual(rowLabels(port, 1, 0, 11), [null, null, 1, 2, 3, 1, 2, 3, 1, null, null]);
  assert.deepEqual(rowLabels(port, 0, 0, 11).every(v => v === null), true, 'rows outside dst untouched');
  assert.equal(getPixel(port, 2, 2).g, 20, 'rows map 1:1 (second source row)');
});

test('T6 reverse horizontal: first tile at dst right, near partial tile keeps the trailing source columns', () => {
  const src = labelled(5, 2), port = pm(12, 4);
  tileBlit(port, src, rect(0, 1, 2, 4), rect(1, 2, 3, 9), 0, 'copyBits');
  assert.deepEqual(rowLabels(port, 1, 2, 9), [3, 1, 2, 3, 1, 2, 3]);
});

test('reverse edge cases: dw < sw keeps the last dw columns; dw a multiple of sw equals forward', () => {
  const src = labelled(4, 1);
  const a = pm(8, 1); tileBlit(a, src, rect(0, 0, 1, 4), rect(0, 0, 1, 3), 0, 'copyBits');
  assert.deepEqual(rowLabels(a, 0, 0, 3), [1, 2, 3]);
  const b = pm(8, 1); tileBlit(b, src, rect(0, 0, 1, 4), rect(0, 0, 1, 3), 1, 'copyBits');
  assert.deepEqual(rowLabels(b, 0, 0, 3), [0, 1, 2]);
  const f = pm(8, 1), r = pm(8, 1);
  tileBlit(f, src, rect(0, 0, 1, 4), rect(0, 0, 1, 8), 1, 'copyBits');
  tileBlit(r, src, rect(0, 0, 1, 4), rect(0, 0, 1, 8), 0, 'copyBits');
  assert.deepEqual(rowLabels(f, 0, 0, 8), [0, 1, 2, 3, 0, 1, 2, 3]);
  assert.deepEqual(rowLabels(r, 0, 0, 8), rowLabels(f, 0, 0, 8));
});

test('T4 step axis: source height ≠ dst height steps vertically; the byte never picks the axis', () => {
  const src = labelled(2, 3);
  for (const dir of [0, 1]) {
    const port = pm(2, 8);
    tileBlit(port, src, rect(0, 0, 3, 2), rect(0, 0, 7, 2), dir, 'copyBits');
    assert.deepEqual(colLabels(port, 1, 0, 7), dir ? [0, 1, 2, 0, 1, 2, 0] : [2, 0, 1, 2, 0, 1, 2]);
    assert.deepEqual(rowLabels(port, 0, 0, 2), dir ? [0, 1] : [0, 1], 'cross axis 1:1');
  }
  // Equal heights: horizontal even for a run exactly srcH long (one full copy).
  const t = createTrace('test');
  tileBlit(pm(6, 3), src, rect(0, 0, 3, 2), rect(0, 0, 3, 5), 1, 'copyBits', t);
  assert.equal(t.drawOps[0].axis, 'horizontal');
});

test('vertical step with unequal cross widths is unspecified: nothing drawn, traced', () => {
  const port = pm(4, 8), t = createTrace('test');
  tileBlit(port, labelled(2, 3), rect(0, 0, 3, 2), rect(0, 0, 7, 3), 1, 'copyBits', t);
  assert.ok(port.data.every(v => v === 0));
  assert.match(t.drawOps[0].unspecified, /cross/);
});

test('T1/T2 fast-path rows are identified and traced as deferred (spec §6 Q3)', () => {
  assert.equal(tileFastPathRow(rect(0, 0, 4, 1), rect(0, 0, 4, 9)), 'T1');
  assert.equal(tileFastPathRow(rect(0, 0, 1, 4), rect(0, 0, 9, 4)), 'T2');
  assert.equal(tileFastPathRow(rect(0, 0, 1, 1), rect(0, 0, 1, 1)), null);
  assert.equal(tileFastPathRow(rect(0, 0, 4, 3), rect(0, 0, 4, 9)), null);
  const t = createTrace('test');
  tileBlit(pm(9, 4), labelled(1, 4), rect(0, 0, 4, 1), rect(0, 0, 4, 9), 1, 'copyBits', t);
  assert.equal(t.drawOps[0].fastPathDeferred, 'T1');
  assert.equal(t.drawOps[0].row, 'T3,T4,T5');
});

test('degenerate rects draw nothing', () => {
  const port = pm(4, 4);
  tileBlit(port, labelled(2, 2), rect(0, 0, 2, 0), rect(0, 0, 4, 4), 1, 'copyBits');
  tileBlit(port, labelled(2, 2), rect(0, 0, 2, 2), rect(1, 1, 1, 4), 0, 'copyBits');
  scaleBlit(port, labelled(2, 2), rect(0, 0, 2, 2), rect(3, 0, 1, 4), 'copyBits');
  assert.ok(port.data.every(v => v === 0));
});

test('transfer: CopyBits overwrites with transparent source pixels; CopyMask leaves them', () => {
  const src = labelled(2, 1); setPixel(src, 1, 0, 0, 0, 0, 0);
  const under = { r: 7, g: 8, b: 9, a: 255 };
  const a = pm(2, 1), b = pm(2, 1);
  for (const p of [a, b]) for (let x = 0; x < 2; x++) setPixel(p, x, 0, under.r, under.g, under.b, 255);
  copyBits(a, src, rect(0, 0, 1, 2), rect(0, 0, 1, 2));
  copyMask(b, src, rect(0, 0, 1, 2), rect(0, 0, 1, 2));
  assert.deepEqual(getPixel(a, 1, 0), { r: 0, g: 0, b: 0, a: 0 });
  assert.deepEqual(getPixel(b, 1, 0), under);
  assert.deepEqual(getPixel(b, 0, 0), { r: 10, g: 10, b: 0, a: 255 }, 'mask edge: the set pixel next to the clear one is copied');
  assert.equal(transferForPort({ customBottlenecks: true }), 'copyBits');
  assert.equal(transferForPort({ customBottlenecks: false }), 'copyMask');
});

test('tile blit honours the transfer per tile (masked tiles keep what is underneath)', () => {
  const src = labelled(2, 1); setPixel(src, 0, 0, 0, 0, 0, 0);
  const port = pm(5, 1); for (let x = 0; x < 5; x++) setPixel(port, x, 0, 1, 1, 1, 255);
  tileBlit(port, src, rect(0, 0, 1, 2), rect(0, 0, 1, 5), 1, 'copyMask');
  assert.deepEqual([0, 1, 2, 3, 4].map(x => getPixel(port, x, 0).r), [1, 20, 1, 20, 1]);
});

test('scale blit: one transfer, sample-and-hold when rects differ', () => {
  const src = labelled(4, 1);
  const up = pm(8, 1); scaleBlit(up, src, rect(0, 0, 1, 2), rect(0, 0, 1, 4), 'copyBits');
  assert.deepEqual(rowLabels(up, 0, 0, 4), [0, 0, 1, 1]);
  const down = pm(8, 1); scaleBlit(down, src, rect(0, 0, 1, 4), rect(0, 0, 1, 2), 'copyBits');
  assert.deepEqual(rowLabels(down, 0, 0, 2), [0, 2]);
});

test('corner 1:1: srcRect offset to (dstX, dstY) at source size', () => {
  const src = labelled(6, 6), port = pm(30, 30), t = createTrace('test');
  cornerBlit(port, src, rect(1, 2, 3, 4), 20, 10, 'copyBits', t);
  assert.deepEqual(t.drawOps[0].dst, rect(10, 20, 12, 22));
  assert.deepEqual(getPixel(port, 20, 10), { r: 30, g: 20, b: 0, a: 255 });
  assert.deepEqual(getPixel(port, 21, 11), { r: 40, g: 30, b: 0, a: 255 });
  assert.equal(getPixel(port, 22, 10).a, 0);
});

test('pattern fill: pattern (0,0) lands on the phase point, including a non-zero origin', () => {
  const pat = pm(2, 2); // P Q / R S
  setPixel(pat, 0, 0, 1, 0, 0, 255); setPixel(pat, 1, 0, 2, 0, 0, 255);
  setPixel(pat, 0, 1, 3, 0, 0, 255); setPixel(pat, 1, 1, 4, 0, 0, 255);
  const at = (phase) => { const p = pm(8, 6); fillPattern(p, rect(1, 3, 3, 5), pat, phase); return [getPixel(p, 3, 1).r, getPixel(p, 4, 1).r, getPixel(p, 3, 2).r, getPixel(p, 4, 2).r]; };
  assert.deepEqual(at({ x: 0, y: 0 }), [4, 3, 2, 1], 'port-origin phase');
  assert.deepEqual(at({ x: 3, y: 1 }), [1, 2, 3, 4], 'phase at the rect top-left');
  assert.deepEqual(at({ x: 5, y: 3 }), [1, 2, 3, 4], 'phase beyond the rect (negative offsets wrap)');
  assert.deepEqual(at({ x: 4, y: 1 }), [2, 1, 4, 3], 'odd phase x shifts by one column');
  const p = pm(8, 6); fillPattern(p, rect(1, 3, 3, 5), pat, { x: 0, y: 0 });
  assert.equal(getPixel(p, 2, 1).a, 0, 'outside the rect untouched');
});

test('erase fills with the background colour, opaque', () => {
  const p = pm(3, 3); eraseRect(p, rect(1, 1, 2, 3), { r: 9, g: 8, b: 7, a: 0 });
  assert.deepEqual(getPixel(p, 1, 1), { r: 9, g: 8, b: 7, a: 255 });
  assert.deepEqual(getPixel(p, 2, 1), { r: 9, g: 8, b: 7, a: 255 });
  assert.equal(getPixel(p, 0, 1).a, 0);
});

test('GetPixel: in-range RGBA, null outside; setPixel clips', () => {
  const p = labelled(2, 2);
  assert.deepEqual(getPixel(p, 1, 0), { r: 20, g: 10, b: 0, a: 255 });
  assert.equal(getPixel(p, 2, 0), null);
  assert.equal(getPixel(p, -1, 0), null);
  setPixel(p, 5, 5, 1, 1, 1, 1);
  assert.equal(p.data.length, 16);
});

test('pen: LineTo covers both endpoints and moves the pen; diagonals are refused', () => {
  const p = pm(6, 6), pen = newPen({ r: 5, g: 6, b: 7, a: 255 });
  moveTo(pen, 1, 2); lineTo(p, pen, 4, 2);
  assert.deepEqual([0, 1, 2, 3, 4, 5].map(x => getPixel(p, x, 2).a), [0, 255, 255, 255, 255, 0]);
  lineTo(p, pen, 4, 0);
  assert.deepEqual([0, 1, 2].map(y => getPixel(p, 4, y).r), [5, 5, 5]);
  assert.deepEqual([pen.x, pen.y], [4, 0]);
  assert.throws(() => lineTo(p, pen, 5, 5), /diagonal/);
});

test('rectXYWH converts the legacy box form', () => {
  assert.deepEqual(rectXYWH(2, 3, 4, 5), rect(3, 2, 8, 6));
});

test('tile traversal preserves in-place transfer order on both axes', () => {
  for (const vertical of [false, true]) for (const direction of [0, 1]) {
    const port = labelled(vertical ? 1 : 8, vertical ? 8 : 1);
    const source = vertical ? rect(0, 0, 2, 1) : rect(0, 0, 1, 2);
    const destination = vertical ? rect(1, 0, 8, 1) : rect(0, 1, 1, 8);
    tileBlit(port, port, source, destination, direction, 'copyBits');
    const labels = vertical ? colLabels(port, 0, 0, 8) : rowLabels(port, 0, 0, 8);
    assert.deepEqual(labels, direction ? [0, 0, 0, 0, 0, 0, 0, 0] : [0, 1, 0, 1, 0, 1, 0, 1]);
  }
});
