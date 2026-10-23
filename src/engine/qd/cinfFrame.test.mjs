// cinf body + border engine tests (qd-primitives.md §3, §4 B0–B6, P1–P5,
// E1–E3, §5 body rects; cinf-lookup-contract.md). Expected values are
// hand-derived from the spec rows.
import '../../../tests/helpers/registerTs.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { drawCinfFrame, cinfBodyRects, cinfPhase, rect, getPixel, setPixel } = await import('./index.ts');
const { ResourceChain, mapProvider } = await import('../resources/chain.ts');
const { createTrace } = await import('../trace.ts');

const pm = (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) });
function labelled(w, h) {
  const p = pm(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) setPixel(p, x, y, 10 * (x + 1), 10 * (y + 1), 0, 255);
  return p;
}
const cinf = (over = {}) => ({
  cornerSize: 2, sideThickness: 1, tileSides: 0, patternAnchor: 0, bgPatternId: 77,
  bgPixel: { x: 3, y: 3 }, textPixel: { x: 4, y: 2 }, embossPixel: { x: 0, y: 0 }, ...over,
});
const chainOf = (entries) => new ResourceChain([mapProvider('archive', 'archive', entries)]);
const D = rect(1, 1, 9, 11); // 10 × 8 at (1, 1)

test('cinf NULL → one retry (0 for a face, 1 for a ring) → skip; a second NULL is never retried', () => {
  for (const [bodyFill, retry] of [[true, 0], [false, 1]]) {
    const t = createTrace('test'), port = pm(12, 10);
    const res = drawCinfFrame(port, chainOf([]), { id: 300, cicn: labelled(6, 6), dstRect: D, bodyFill }, t);
    assert.equal(res.drawn, false);
    assert.deepEqual(t.resolved.map(r => [r.type, r.id, r.found]), [['cinf', 300, false], ['cinf', retry, false]]);
    assert.ok(port.data.every(v => v === 0), 'nothing drawn');
  }
  const t = createTrace('test');
  const res = drawCinfFrame(pm(12, 10), chainOf([['cinf:0', cinf()]]), { id: 300, cicn: labelled(6, 6), dstRect: D, bodyFill: true }, t);
  assert.equal(res.cinfId, 0);
  assert.deepEqual(t.resolved.slice(0, 2).map(r => [r.id, r.found]), [[300, false], [0, true]]);
});

test('a requested id equal to the retry id is still requested twice', () => {
  const t = createTrace('test');
  drawCinfFrame(pm(12, 10), chainOf([]), { id: 0, cicn: labelled(6, 6), dstRect: D, bodyFill: true }, t);
  assert.deepEqual(t.resolved.map(r => r.id), [0, 0]);
});

test('B0: a ring requests no body resource; border continues', () => {
  const t = createTrace('test'), port = pm(12, 10);
  drawCinfFrame(port, chainOf([['cinf:5', cinf()], ['ppat:77', labelled(2, 2)]]), { id: 5, cicn: labelled(6, 6), dstRect: D, bodyFill: false }, t);
  assert.deepEqual(t.resolved.map(r => r.type), ['cinf']);
  assert.equal(t.drawOps[0].row, 'B0');
  assert.equal(getPixel(port, 5, 5).a, 0, 'body interior untouched');
  assert.equal(getPixel(port, 1, 1).a, 255, 'TL corner drawn');
});

test('B4/B5: mode ≠ 5 requests a ppat at backgroundId (zero included) and fills R1/R2 at phase P', () => {
  const pat = pm(2, 2); setPixel(pat, 0, 0, 1, 0, 0, 255); setPixel(pat, 1, 0, 2, 0, 0, 255); setPixel(pat, 0, 1, 3, 0, 0, 255); setPixel(pat, 1, 1, 4, 0, 0, 255);
  const t = createTrace('test'), port = pm(12, 10);
  drawCinfFrame(port, chainOf([['cinf:5', cinf({ patternAnchor: 1, bgPatternId: 0 })], ['ppat:0', pat]]), { id: 5, cicn: labelled(6, 6), dstRect: D, bodyFill: true }, t);
  assert.deepEqual(t.resolved.map(r => [r.type, r.id]), [['cinf', 5], ['ppat', 0]]);
  // P1: phase (D.left, D.top) = (1, 1). Port pixel (3, 2) → pattern ((3−1)%2, (2−1)%2) = (0, 1) → 3.
  assert.equal(getPixel(port, 3, 2).r, 3);
  assert.equal(getPixel(port, 4, 2).r, 4);
  assert.ok(t.drawOps.filter(o => o.op === 'fillPattern').every(o => o.row === 'B5,P1'));
});

test('B6: ppat absent → erase R1/R2 with the background sample', () => {
  const port = pm(12, 10), cicn = labelled(6, 6);
  drawCinfFrame(port, chainOf([['cinf:5', cinf()]]), { id: 5, cicn, dstRect: D, bodyFill: true });
  assert.deepEqual(getPixel(port, 5, 5), { r: 40, g: 40, b: 0, a: 255 }, 'bgPixel (3,3) → r 40, g 40');
});

test('B1/B3/B2: mode 5 requests cicn; absent erases R1/R2; found blits inside side inset (0x109ea..0x10a00)', () => {
  const t = createTrace('test'), port = pm(12, 10);
  drawCinfFrame(port, chainOf([['cinf:5', cinf({ patternAnchor: 5 })], ['ppat:77', labelled(2, 2)]]), { id: 5, cicn: labelled(6, 6), dstRect: D, bodyFill: true }, t);
  assert.deepEqual(t.resolved.map(r => [r.type, r.id, r.found]), [['cinf', 5, true], ['cicn', 77, false]]);
  assert.equal(getPixel(port, 5, 5).r, 40, 'B3 erase');
  const t2 = createTrace('test'), port2 = pm(12, 10);
  drawCinfFrame(port2, chainOf([['cinf:5', cinf({ patternAnchor: 5 })], ['cicn:77', { pixmap: labelled(3, 3), pixelSize: 8, unmasked: labelled(3, 3) }]]), { id: 5, cicn: labelled(6, 6), dstRect: D, bodyFill: true }, t2);
  // B2 uses inset(D,s,s), independent of c; deep I3 is opaque.
  // Under declared nearest-neighbor scaling (modern policy), (5,5) reads (1,1).
  assert.ok(t2.drawOps[0].row.includes('B2'));
  assert.equal(t2.drawOps[0].unimplemented, undefined);
  assert.deepEqual(getPixel(port2, 5, 5), { r: 20, g: 20, b: 0, a: 255 });
  assert.equal(getPixel(port2, 2, 2).a, 255, 's=1 body reaches x=2 despite c=2');
});

test('table P: phase per mode', () => {
  const d = rect(10, 20, 30, 50);
  const cases = { 1: ['P1', 20, 10], 2: ['P2', 50, 10], 3: ['P3', 20, 30], 4: ['P4', 50, 30], 0: ['P5', 0, 0], 6: ['P5', 0, 0], 255: ['P5', 0, 0] };
  for (const [mode, [row, x, y]] of Object.entries(cases)) {
    const r = cinfPhase(d, Number(mode));
    assert.deepEqual([r.row.id, r.phase.x, r.phase.y], [row, x, y], `mode ${mode}`);
  }
});

test('§5 body inset rects: R1 = (c,s,W−2c,H−2s), R2 = (s,c,W−2s,H−2c); R2 skipped when c == s; empty dropped', () => {
  assert.deepEqual(cinfBodyRects(rect(0, 0, 8, 10), 2, 1), [rect(1, 2, 7, 8), rect(2, 1, 6, 9)]);
  assert.deepEqual(cinfBodyRects(rect(0, 0, 8, 10), 2, 2), [rect(2, 2, 6, 8)]);
  assert.deepEqual(cinfBodyRects(rect(0, 0, 4, 4), 2, 1), [rect(1, 2, 3, 2), rect(2, 1, 2, 3)].filter(r => r.right > r.left && r.bottom > r.top));
});

test('E1/E3 border: square c × c corners copied 1:1; edges use the first middle column/row', () => {
  const port = pm(12, 10), cicn = labelled(6, 6);
  drawCinfFrame(port, chainOf([['cinf:5', cinf({ cornerSize: 2, sideThickness: 1 })]]), { id: 5, cicn, dstRect: D, bodyFill: false });
  // TL corner: port (1..2, 1..2) = cicn (0..1, 0..1).
  assert.deepEqual(getPixel(port, 2, 2), { r: 20, g: 20, b: 0, a: 255 });
  // BR corner: port (9..10, 7..8) = cicn (4..5, 4..5).
  assert.deepEqual(getPixel(port, 10, 8), { r: 60, g: 60, b: 0, a: 255 });
  // Top band: row D.top, x in [3, 9): every pixel = cicn column c = 2, row 0.
  assert.deepEqual([3, 5, 8].map(x => getPixel(port, x, 1)), Array(3).fill({ r: 30, g: 10, b: 0, a: 255 }));
  assert.equal(getPixel(port, 5, 2).a, 0, 'band is s = 1 thick');
  // Left band: column D.left, y in [3, 7): cicn row c = 2, column 0.
  assert.deepEqual(getPixel(port, 1, 5), { r: 10, g: 30, b: 0, a: 255 });
  // Right band: column D.right − 1 = 10: cicn column 5, row 2.
  assert.deepEqual(getPixel(port, 10, 4), { r: 60, g: 30, b: 0, a: 255 });
});

test('E2: masked border pixels preserve the body (transparent edge reveals it); draw order is body then TL,TR,top,BL,BR,bottom,left,right', () => {
  // c = 1, s = 2: the top band is rows [D.top, D.top + 2), sampling the first
  // middle column c = 1. Clear its second row: there the body (R2 starts at
  // D.top + c) must show through.
  const cicn = labelled(6, 6); setPixel(cicn, 1, 1, 0, 0, 0, 0);
  const port = pm(12, 10), t = createTrace('test');
  drawCinfFrame(port, chainOf([['cinf:5', cinf({ cornerSize: 1, sideThickness: 2 })]]), { id: 5, cicn, dstRect: D, bodyFill: true }, t);
  assert.deepEqual(getPixel(port, 5, 1), { r: 20, g: 10, b: 0, a: 255 }, 'row D.top: opaque band pixel (1,0)');
  assert.deepEqual(getPixel(port, 5, 2), { r: 40, g: 40, b: 0, a: 255 }, 'row D.top+1: clear band pixel reveals the erased body');
  const pieces = t.drawOps.filter(o => o.piece).map(o => o.piece);
  assert.deepEqual(pieces, ['TL', 'TR', 'top', 'BL', 'BR', 'bottom', 'left', 'right']);
  const firstBorder = t.drawOps.findIndex(o => o.piece);
  assert.ok(t.drawOps.slice(0, firstBorder).every(o => o.op === 'erase'), 'body before border');
});

test('E4 (0x10cee..0x10cfc): middle strip repeats forward; partial tile starts at its first sample', () => {
  const t = createTrace('test'), port = pm(12, 10);
  drawCinfFrame(port, chainOf([['cinf:5', cinf({ tileSides: 1 })]]), { id: 5, cicn: labelled(6, 6), dstRect: D, bodyFill: false }, t);
  const edges = t.drawOps.filter(o => o.op === 'cinfEdge');
  assert.equal(edges.length, 4);
  assert.ok(edges.every(o => o.row === 'E2,E4' && !o.unimplemented));
  // W=6,c=2 gives source columns [2,4), destination [3,9): 30,40 repeated.
  assert.deepEqual([3,4,5,6,7,8].map(x => getPixel(port,x,1).r), [30,40,30,40,30,40]);
});

test('B0 (0x1089e..0x109aa): ring skips every colour sample; face still samples text/emboss', () => {
  const cicn = labelled(6, 6);
  let calls = 0;
  const ring = drawCinfFrame(pm(12,10), chainOf([['cinf:5',cinf()]]), { id:5, cicn, dstRect:D, bodyFill:false, icon: { pixmap:cicn, sampleRgb16:()=>{ calls++; throw Error('ring sample'); } } });
  assert.equal(calls,0);
  assert.deepEqual([ring.backgroundRGB,ring.textRGB,ring.embossRGB],[null,null,null]);
  const a = drawCinfFrame(pm(12, 10), chainOf([['cinf:5', cinf()]]), { id: 5, cicn, dstRect: D, bodyFill: true });
  assert.deepEqual(a.textRGB, { r: 50, g: 30, b: 0, a: 255 });
  assert.equal(a.embossRGB, null);
  assert.deepEqual(a.backgroundRGB, { r: 40, g: 40, b: 0, a: 255 });
  const b = drawCinfFrame(pm(12, 10), chainOf([['cinf:5', cinf({ embossPixel: { x: 1, y: 0 } })]]), { id: 5, cicn, dstRect: D, bodyFill: true });
  assert.deepEqual(b.embossRGB, { r: 20, g: 10, b: 0, a: 255 });
});
