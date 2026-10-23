// Progress bar (CDEF 5) driver unit tests against docs/spec/engine/progress.md,
// on synthetic forks (no theme). Each test names the spec rows it pins and the
// mutation (spec §7) its assertion separates.
import '../../../tests/helpers/registerTs.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
const {
  ResourceChain, mapProvider, createTrace, rect,
  drawProgress, newProgressRecord, progressIdleAdvance, progressSetData, progressRect, progressResourceIds, engineCinfIds, engineLineSampledCicnIds,
} = await import('../index.ts');

/** A pixmap whose pixel (x, y) encodes its own coordinates: r = x, g = y, b = tag. */
const mapPm = (w, h, tag, mask = () => true) => {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) data.set([x, y, tag, mask(x, y) ? 255 : 0], (y * w + x) * 4);
  return { width: w, height: h, data };
};
const solid = (w, h, rgba) => {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) data.set(rgba, i * 4);
  return { width: w, height: h, data };
};
const cicn = (pixmap, extra = {}) => ({ pixmap, pixelSize: 8, unmasked: null, sampling: 'equivalent', ...extra });
const cinf = (...bytes) => ({ bytes: [...bytes, ...new Array(18 - bytes.length).fill(0)] });
const chainOf = (entries, base) => new ResourceChain([mapProvider('fork', 'archive', entries), ...(base ? [mapProvider('base', 'base', base)] : [])]);
const realize = ([r, g, b]) => ({ r: r >> 8, g: g >> 8, b: b >> 8, a: 255 });
const px = (p, x, y) => Array.from(p.data.slice((y * p.width + x) * 4, (y * p.width + x) * 4 + 4));
const ops = (trace, op) => trace.drawOps.filter(o => o.op === op);
const req = (trace, type) => trace.resolved.filter(r => r.type === type).map(r => r.id);

const FRAME = -10080, FILL = -10079, TRACK = -10078, IFRAME = -10077, IFILL = -10076, ITRACK = -10075;
/** Example A (1138-like): frame 5 × 14 (cinf 2, 2, 0), fill and track 7 × 10 (cinf 3, 3, 0, 0). */
function forkA({ frameMask } = {}) {
  return [
    [`cicn:${FRAME}`, cicn(mapPm(5, 14, 1, frameMask))], [`cinf:${FRAME}`, cinf(2, 2, 0, 0)],
    [`cicn:${FILL}`, cicn(mapPm(7, 10, 2))], [`cinf:${FILL}`, cinf(3, 3, 0, 0)],
    [`cicn:${TRACK}`, cicn(mapPm(7, 10, 3))], [`cinf:${TRACK}`, cinf(3, 3, 0, 0)],
  ];
}
const inA = (o = {}) => ({ rect: rect(0, 0, 14, 100), hilite: 0, min: 0, max: 100, value: 50, ...o });

function run(entries, input, { indeterminate = 0, phase = 0, port, base } = {}) {
  const chain = chainOf(entries, base);
  const trace = createTrace('progress');
  const record = newProgressRecord();
  record.indeterminate = indeterminate;
  record.phase = phase;
  const out = port ?? solid(input.rect.right, Math.max(input.rect.bottom, 20), [0, 0, 0, 0]);
  const res = drawProgress(out, chain, record, input, { realize }, trace);
  return { res, trace, port: out, record, chain };
}

// ── RECT, MSG, HIT, DATA ────────────────────────────────────────────────────
test('RECT1/RECT2: R = (0, 0, 20, 100) is drawn as (0, 0, 14, 100); I rows [2, 12)', () => {
  const { res, trace, port } = run(forkA(), inA({ rect: rect(0, 0, 20, 100) }));
  assert.deepEqual(res.rect, rect(0, 0, 14, 100));
  assert.deepEqual(trace.rects.I, rect(2, 2, 12, 98), 'mutation "caller height" gives I rows [2, 18)');
  for (let y = 14; y < 20; y++) for (let x = 0; x < 100; x++) assert.equal(px(port, x, y)[3], 0, `nothing at (${x}, ${y})`);
  assert.deepEqual(progressRect(rect(5, 3, 9, 40)), rect(5, 3, 19, 40), 'RECT2: top/left/right kept');
});

test('DATA1/DATA3/IDLE4: "inde" sets the flag byte and keeps the phase; another tag is −30581 and changes nothing', () => {
  const r = newProgressRecord();
  r.phase = 5;
  assert.equal(progressSetData(r, 'inde', [7]).result, 0);
  assert.deepEqual([r.indeterminate, r.phase], [7, 5]);
  assert.equal(progressSetData(r, 'abcd', [0]).result, -30581, 'mutation "accept any tag" fails here');
  assert.equal(r.indeterminate, 7);
});

// ── DRAW ────────────────────────────────────────────────────────────────────
test('DRAW1/DRAW2: invisible or empty draw region draws nothing', () => {
  const a = run(forkA(), inA({ visible: false }));
  assert.equal(a.res.path, null);
  assert.ok(a.port.data.every(v => v === 0));
  const b = run(forkA(), inA({ rect: rect(0, 50, 14, 50) }));
  assert.equal(b.res.path, null);
  assert.equal(ops(b.trace, 'skip')[0].row, 'DRAW2');
  assert.equal(ops(run(forkA(), inA()).trace, 'pass')[0].row, 'DRAW4');
});

// ── GATE ────────────────────────────────────────────────────────────────────
test('GATE1: inactive with cinf −10077 draws −10077 / −10076 / −10075; no per-part fallback', () => {
  const e = [
    [`cicn:${IFRAME}`, cicn(mapPm(5, 14, 11))], [`cinf:${IFRAME}`, cinf(2, 2, 0, 0)],
    [`cicn:${FILL}`, cicn(mapPm(7, 10, 2))], [`cinf:${FILL}`, cinf(3, 3, 0, 0)],
    [`cinf:${IFILL}`, cinf(3, 3, 0, 0)],
    [`cicn:${ITRACK}`, cicn(mapPm(7, 10, 13))], [`cinf:${ITRACK}`, cinf(3, 3, 0, 0)],
  ];
  for (const hilite of [254, 255]) {
    const { trace, port } = run(e, inA({ hilite }));
    assert.deepEqual(req(trace, 'cicn'), [IFRAME, IFILL, ITRACK]);
    assert.equal(px(port, 20, 6)[3], 0, 'no fill (mutation "fall back to −10079" draws tag 2 here)');
    assert.equal(px(port, 70, 6)[2], 13, 'inactive track');
  }
});

test('GATE1a: inactive without cinf −10077 draws the whole bar with the active ids (apple-lisa)', () => {
  const { trace, port } = run(forkA(), inA({ hilite: 255 }));
  assert.deepEqual(req(trace, 'cinf').slice(0, 2), [IFRAME, FRAME]);
  assert.deepEqual(req(trace, 'cicn'), [FRAME, FILL, TRACK]);
  assert.equal(px(port, 20, 6)[2], 2);
  assert.ok(ops(trace, 'gate').some(o => o.row === 'GATE1a'));
});

test('GATE2/GATE3: no cinf −10080 → procedural; inactive frame cinf without its cicn → procedural, no −10080 retry', () => {
  const a = run([[`cicn:${FRAME}`, cicn(mapPm(5, 14, 1))]], inA());
  assert.equal(a.res.path, 'procedural', 'mutation "gate on the frame cicn" draws the frame');
  assert.deepEqual(req(a.trace, 'cicn'), [-10224]);
  const b = run([[`cinf:${IFRAME}`, cinf(2, 2, 0, 0)], ...forkA()], inA({ hilite: 254 }));
  assert.equal(b.res.path, 'procedural');
  assert.deepEqual(req(b.trace, 'cicn'), [IFRAME, -10224], 'mutation "retry −10080" requests the active frame');
});

test('GATE4: cinf and cicn −10080 with nothing else draws the frame only, never the procedural bar', () => {
  const { res, trace } = run(forkA().slice(0, 2), inA());
  assert.equal(res.path, 'kaleidoscope', 'mutation "procedural when the fill is missing" fails here');
  assert.equal(req(trace, 'cicn').includes(-10224), false);
  assert.equal(ops(trace, 'paintRect').length, 0);
});

// ── CINF ────────────────────────────────────────────────────────────────────
test('CINF1–CINF3: a frame cinf too short for byte 2 is treated as missing (procedural); bytes 0–2 only', () => {
  const short = [[`cicn:${FRAME}`, cicn(mapPm(5, 14, 1))], [`cinf:${FRAME}`, { bytes: [2, 2] }]];
  const { res, trace } = run(short, inA());
  assert.equal(res.path, 'procedural');
  assert.ok(trace.drawOps.some(o => o.row?.includes('CINF3') && o.unspecified));
  // A fill cinf missing byte 3 draws no fill (SLICE1 via CINF3).
  const e = forkA().map(([k, v]) => (k === `cinf:${FILL}` ? [k, { bytes: [3, 3, 0] }] : [k, v]));
  assert.equal(px(run(e, inA()).port, 20, 6)[3], 0);
});

// ── FRAME ───────────────────────────────────────────────────────────────────
test('FRAME3–FRAME5 example A: piece rects in order; tile = 0 bands are one source column / row drawn as lines', () => {
  const { trace } = run(forkA(), inA());
  const corners = ops(trace, 'frameCorner').map(o => [o.row.split(',')[1], o.src, o.dst]);
  assert.deepEqual(corners, [
    ['TL', rect(0, 0, 2, 2), rect(0, 0, 2, 2)], ['TR', rect(0, 3, 2, 5), rect(0, 98, 2, 100)],
    ['BL', rect(12, 0, 14, 2), rect(12, 0, 14, 2)], ['BR', rect(12, 3, 14, 5), rect(12, 98, 14, 100)],
  ]);
  const bands = ops(trace, 'tileLines').slice(0, 4).map(o => [o.row.split(',')[1], o.row.split(',')[2], o.src, o.dst]);
  assert.deepEqual(bands, [
    ['top', 'BLIT3', rect(0, 2, 2, 3), rect(0, 2, 2, 98)], ['bottom', 'BLIT3', rect(12, 2, 14, 3), rect(12, 2, 14, 98)],
    ['left', 'BLIT4', rect(2, 0, 3, 2), rect(2, 0, 12, 2)], ['right', 'BLIT4', rect(2, 3, 3, 5), rect(2, 98, 12, 100)],
  ]);
  const order = trace.drawOps.filter(o => o.op === 'frameCorner' || (o.op === 'tileLines' && o.row.startsWith('FRAME'))).map(o => o.row.split(',')[1]);
  assert.deepEqual(order, ['TL', 'TR', 'top', 'BL', 'BR', 'bottom', 'left', 'right']);
});

test('FRAME5 (1984-like 16 × 14, tile 0): the top band source is [2, 3) × [0, 2), not the whole middle', () => {
  const e = [[`cicn:${FRAME}`, cicn(mapPm(16, 14, 1))], [`cinf:${FRAME}`, cinf(2, 2, 0, 0)]];
  const { trace, port } = run(e, inA());
  assert.deepEqual(ops(trace, 'tileLines')[0].src, rect(0, 2, 2, 3), 'mutation "whole middle" gives [2, 14)');
  assert.deepEqual(px(port, 60, 0).slice(0, 3), [2, 0, 1]);
});

test('FRAME6 (crayon-os-like 70 × 14, tile 1): top band source [2, 68) tiled forward; second tile from [2, 32)', () => {
  const e = [[`cicn:${FRAME}`, cicn(mapPm(70, 14, 1))], [`cinf:${FRAME}`, cinf(2, 2, 1, 0)]];
  const { trace, port } = run(e, inA());
  const top = ops(trace, 'tile')[0];
  assert.deepEqual([top.src, top.dst, top.anchor], [rect(0, 2, 2, 68), rect(0, 2, 2, 98), 'start']);
  assert.deepEqual(px(port, 67, 0).slice(0, 3), [67, 0, 1]);
  assert.deepEqual(px(port, 68, 0).slice(0, 3), [2, 0, 1], 'second tile starts at source column 2 (mutation "stretch" differs)');
  assert.deepEqual(px(port, 97, 1).slice(0, 3), [31, 1, 1]);
});

test('FRAME8/ERASE1/BLIT1: no body; mask-clear frame pixels keep the prior pixels', () => {
  const prior = solid(100, 14, [9, 9, 9, 255]);
  const e = forkA({ frameMask: (x, y) => !(x === 0 && y === 0) });
  const { port } = run(e.slice(0, 2), inA(), { port: prior });
  assert.deepEqual(px(port, 0, 0), [9, 9, 9, 255], 'mutation "unmasked copy" overwrites');
  assert.deepEqual(px(port, 50, 6), [9, 9, 9, 255], 'interior untouched (no frame centre cell)');
});

// ── INSET ───────────────────────────────────────────────────────────────────
test('INSET1/INSET2: k = 3 → I.left 3; k = 1 → I.left 2; vertical inset is s', () => {
  const at = k => run([[`cicn:${FRAME}`, cicn(mapPm(8, 14, 1))], [`cinf:${FRAME}`, cinf(k, 2, 0, 0)]], inA()).trace.rects.I;
  assert.deepEqual(at(3), rect(2, 3, 12, 97));
  assert.deepEqual(at(1), rect(2, 2, 12, 98));
  assert.deepEqual(run([[`cicn:${FRAME}`, cicn(mapPm(8, 14, 1))], [`cinf:${FRAME}`, cinf(1, 3, 0, 0)]], inA()).trace.rects.I, rect(3, 2, 11, 98));
});

// ── DET ─────────────────────────────────────────────────────────────────────
/** Example B (1984-like): R (0, 0, 14, 40), fill 18 × 10 a = 8, track 18 × 10 a = 9. */
function forkB() {
  return [
    [`cicn:${FRAME}`, cicn(mapPm(16, 14, 1))], [`cinf:${FRAME}`, cinf(2, 2, 0, 0)],
    [`cicn:${FILL}`, cicn(mapPm(18, 10, 2))], [`cinf:${FILL}`, cinf(8, 0, 0, 0)],
    [`cicn:${TRACK}`, cicn(mapPm(18, 10, 3))], [`cinf:${TRACK}`, cinf(9, 0, 0, 0)],
  ];
}
test('DET1/§5.3 example B: x = 12 (truncation; rounding gives 13)', () => {
  const { trace } = run(forkB(), { rect: rect(0, 0, 14, 40), hilite: 0, min: 0, max: 10, value: 3 });
  assert.equal(ops(trace, 'split')[0].x, 12);
  assert.deepEqual(ops(trace, 'fill')[0].dst.right, 12);
});

test('DET2/DET3: max = min → range 1 (x = I.left); value −10 of 0..100 → track starts at −7, unclamped', () => {
  assert.equal(ops(run(forkA(), inA({ min: 5, max: 5, value: 5 })).trace, 'split')[0].x, 2);
  const { trace } = run(forkA(), inA({ value: -10 }));
  const s = ops(trace, 'split')[0];
  assert.equal(s.x, -7, 'mutations: clamp gives 2, floor gives −8');
  assert.ok(s.row.includes('DET3') && s.overflow);
  assert.equal(ops(trace, 'track')[0].dst.left, -7);
  assert.ok(ops(run(forkA(), inA({ value: 150 })).trace, 'split')[0].x > 98);
});

test('DET4: an inverted fill rect copies no pixels; the track runs left of I (DET3)', () => {
  const { port, trace } = run(forkA(), inA({ value: -10 }));
  for (let y = 0; y < 14; y++) for (let x = 0; x < 100; x++) assert.notEqual(px(port, x, y)[2], 2, `no fill pixel at (${x}, ${y})`);
  assert.ok(ops(trace, 'fill')[0].row.includes('DET4'));
  assert.deepEqual(px(port, 0, 6).slice(0, 3), [3, 4, 3], 'track middle covers the frame band left of I');
});

// ── SLICE ───────────────────────────────────────────────────────────────────
test('SLICE1: a fill cicn without its cinf draws no fill (no retry)', () => {
  const e = forkA().filter(([k]) => k !== `cinf:${FILL}`);
  const { port, trace } = run(e, inA());
  assert.equal(px(port, 20, 6)[3], 0, 'mutation "drop the cinf requirement" draws the fill');
  assert.equal(req(trace, 'cinf').filter(id => id === FILL).length, 1);
});

test('SLICE3–SLICE5 example B: fill halves [2,7) ← [0,5), [7,12) ← [13,18); track caps and middle column 9', () => {
  const { trace, port } = run(forkB(), { rect: rect(0, 0, 14, 40), hilite: 0, min: 0, max: 10, value: 3 });
  const halves = ops(trace, 'halves').map(o => [o.src.left, o.src.right, o.dst.left, o.dst.right]);
  assert.deepEqual(halves, [[0, 5, 2, 7], [13, 18, 7, 12]], 'mutation "no halves" overlaps caps of 8');
  const caps = ops(trace, 'cap').map(o => [o.src.left, o.src.right, o.dst.left, o.dst.right]);
  assert.deepEqual(caps, [[0, 9, 12, 21], [9, 18, 29, 38]]);
  const mid = ops(trace, 'tileLines').find(o => o.row.startsWith('SLICE5'));
  assert.deepEqual([mid.src.left, mid.src.right, mid.dst.left, mid.dst.right], [9, 10, 21, 29]);
  assert.deepEqual(px(port, 25, 6).slice(0, 3), [9, 4, 3], 'middle column 9 (mutation "stretch" differs)');
});

test('SLICE6: byte 2 ≠ 0 tiles the middle [a, W − a)', () => {
  const e = forkA().map(([k, v]) => (k === `cinf:${FILL}` ? [k, cinf(2, 0, 1, 0)] : [k, v]));
  const { trace, port } = run(e, inA());
  const t = ops(trace, 'tile').find(o => o.row.startsWith('SLICE6'));
  assert.deepEqual([t.src.left, t.src.right], [2, 5]);
  assert.deepEqual(px(port, 4, 6).slice(0, 3), [2, 4, 2]);
  assert.deepEqual(px(port, 7, 6).slice(0, 3), [2, 4, 2], 'tile period 3 from x = 4');
});

test('SLICE7: byte 3 ≠ 0 tiles the middle from the end; the cut tile keeps its trailing columns', () => {
  const e = [
    [`cicn:${FRAME}`, cicn(mapPm(5, 14, 1))], [`cinf:${FRAME}`, cinf(2, 2, 0, 0)],
    [`cicn:${FILL}`, cicn(mapPm(14, 10, 2))], [`cinf:${FILL}`, cinf(3, 0, 1, 4)],
  ];
  // I.left = 2, x = 31 → L = 29, middle [5, 28) of length 23 from source [3, 11) (8 wide).
  const { trace, port } = run(e, inA({ max: 96, value: 29 }));
  const t = ops(trace, 'tile').find(o => o.row.startsWith('SLICE6'));
  assert.equal(t.anchor, 'end');
  assert.deepEqual([t.dst.left, t.dst.right], [5, 28]);
  assert.deepEqual(px(port, 27, 6).slice(0, 3), [10, 4, 2], 'last column from source 10');
  assert.deepEqual(px(port, 5, 6).slice(0, 3), [4, 4, 2], 'cut first tile starts at source 4 (forward gives 3)');
});

test('SLICE2: 14-row art in I rows [2, 12) keeps its height, rows [0, 14)', () => {
  const e = [
    [`cicn:${FRAME}`, cicn(mapPm(5, 14, 1))], [`cinf:${FRAME}`, cinf(2, 2, 0, 0)],
    [`cicn:${FILL}`, cicn(mapPm(5, 14, 2))], [`cinf:${FILL}`, cinf(2, 0, 0, 0)],
  ];
  const { trace, port } = run(e, inA());
  const f = ops(trace, 'fill')[0];
  assert.deepEqual([f.dst.top, f.dst.bottom], [0, 14], 'mutation "stretch to I" gives [2, 12)');
  assert.deepEqual(px(port, 20, 0).slice(0, 3), [2, 0, 2], 'art row 0 over the frame band');
});

// ── BLIT / COL ──────────────────────────────────────────────────────────────
test('BLIT3/COL1: lines take the sampler colour when the decoded colour differs (sampling "different")', () => {
  const sampled = solid(7, 10, [200, 100, 50, 255]);
  const e = forkA().map(([k, v]) => (k === `cicn:${FILL}` ? [k, cicn(mapPm(7, 10, 2), { sampling: 'different', sampled })] : [k, v]));
  const { port, trace } = run(e, inA());
  assert.deepEqual(px(port, 20, 6), [200, 100, 50, 255], 'mutation "decoded colour" gives (3, 4, 2)');
  assert.deepEqual(px(port, 3, 6).slice(0, 3), [1, 4, 2], 'caps are CopyMask of the decoded pixels');
  assert.ok(ops(trace, 'tileLines').some(o => o.row.includes('COL1')));
});

test('BLIT3: mask-clear source rows leave the line row alone', () => {
  const e = forkA().map(([k, v]) => (k === `cicn:${FILL}` ? [k, cicn(mapPm(7, 10, 2, (x, y) => !(x === 3 && y === 4)))] : [k, v]));
  const { port } = run(e, inA());
  assert.equal(px(port, 20, 6)[3], 0);
  assert.deepEqual(px(port, 20, 5).slice(0, 3), [3, 3, 2]);
});

// ── IND / PAT ───────────────────────────────────────────────────────────────
const pat = (w, h, tag) => mapPm(w, h, tag);
const frameMode = () => [...forkA(), ...[0, 1, 2, 3].map(i => [`ppat:${FRAME + i}`, pat(8, 8, 40 + i)])];
test('IND2/IND4: frame mode phase 2 fills I with ppat −10078 at phase point (2, 2)', () => {
  const { port, record, trace } = run(frameMode(), inA(), { indeterminate: 1, phase: 2 });
  assert.equal(record.phase, 2);
  assert.deepEqual(ops(trace, 'pattern')[0].phase, { x: 2, y: 2 });
  assert.deepEqual(px(port, 2, 2).slice(0, 3), [0, 0, 42]);
  assert.deepEqual(px(port, 13, 5).slice(0, 3), [3, 3, 42]);
});

test('IND2/IND3: phase 4 (no ppat −10076) → −10080 and phase 0 written back; phase 9 → −10080, phase 0', () => {
  const a = run(frameMode(), inA(), { indeterminate: 1, phase: 4 });
  assert.equal(a.record.phase, 0, 'mutation "modulo without write-back" keeps 4');
  assert.equal(a.res.phase, 0);
  assert.equal(px(a.port, 2, 2)[2], 40);
  const b = run([...frameMode(), [`ppat:${FRAME + 9}`, pat(8, 8, 49)]], inA(), { indeterminate: 1, phase: 9 });
  assert.equal(b.record.phase, 0);
  assert.equal(px(b.port, 2, 2)[2], 40, 'mutation "phase 8–255 as frames" draws −10071');
  assert.ok(ops(b.trace, 'pattern')[0].row.startsWith('IND3'));
});

test('IND5: shift mode phase 3 → phase point (14, 2), phase kept; 4·phase not phase', () => {
  const e = [...forkA(), [`ppat:${FRAME}`, pat(64, 16, 40)]];
  const { port, record, trace } = run(e, inA(), { indeterminate: 1, phase: 3 });
  assert.equal(record.phase, 3, 'mutation "reset phase in shift mode" gives 0');
  assert.deepEqual(ops(trace, 'pattern')[0].phase, { x: 14, y: 2 }, 'mutation "shift by phase" gives (5, 2)');
  assert.deepEqual(px(port, 14, 2).slice(0, 3), [0, 0, 40]);
  assert.deepEqual(px(port, 2, 3).slice(0, 3), [52, 1, 40]);
});

test('IND1: probe F_p + 1; −10080 and −10078 without −10079 is shift mode (phase 2 → −10080 at (10, 2))', () => {
  const e = [...forkA(), [`ppat:${FRAME}`, pat(8, 8, 40)], [`ppat:${FRAME + 2}`, pat(8, 8, 42)]];
  const { trace } = run(e, inA(), { indeterminate: 1, phase: 2 });
  assert.equal(trace.resolved.filter(r => r.type === 'ppat')[0].id, FRAME + 1);
  const p = ops(trace, 'pattern')[0];
  assert.deepEqual(p.phase, { x: 10, y: 2 });
  assert.ok(p.row.startsWith('IND5'));
});

test('IND inactive: F_p = −10072 when inactive (cinf −10077 found)', () => {
  const e = [[`cicn:${IFRAME}`, cicn(mapPm(5, 14, 11))], [`cinf:${IFRAME}`, cinf(2, 2, 0, 0)], [`ppat:-10072`, pat(8, 8, 50)], [`ppat:${FRAME}`, pat(8, 8, 40)]];
  const { port, trace } = run(e, inA({ hilite: 254 }), { indeterminate: 1 });
  assert.equal(trace.resolved.filter(r => r.type === 'ppat')[0].id, -10071);
  assert.equal(px(port, 4, 4)[2], 50);
});

test('IND6/IND7/ERASE2/ERASE3: no pattern leaves I transparent; the value is not read; ERASE4: a pattern is opaque', () => {
  const { port, trace } = run(forkA(), inA(), { indeterminate: 1 });
  for (let y = 2; y < 12; y++) for (let x = 2; x < 98; x++) assert.equal(px(port, x, y)[3], 0);
  assert.equal(ops(trace, 'split').length, 0);
  const masked = [...forkA(), [`ppat:${FRAME}`, mapPm(8, 8, 40, () => false)]];
  const b = run(masked, inA(), { indeterminate: 1, port: solid(100, 14, [9, 9, 9, 255]) });
  assert.equal(px(b.port, 50, 6)[2], 40, 'mutation "masked pattern" keeps the prior pixel');
});

test('ERASE2: a mask-clear frame band column leaves row 0 transparent over [2, 98)', () => {
  const e = forkA({ frameMask: (x, y) => !(x === 2 && y === 0) });
  const { port } = run(e.slice(0, 2), inA());
  for (let x = 2; x < 98; x++) assert.equal(px(port, x, 0)[3], 0);
  assert.equal(px(port, 50, 1)[3], 255);
});

// ── FB (procedural bar) ─────────────────────────────────────────────────────
/** Example E: cicn −10224 12 × 14 with (11, 13) white, (0, 0) grey 0x88, (1, 1) black; (11, 11) differs from (11, 13). */
function fbIcon() {
  const p = solid(12, 14, [7, 7, 7, 255]);
  p.data.set([255, 255, 255, 255], (13 * 12 + 11) * 4);
  p.data.set([30, 60, 90, 255], (11 * 12 + 11) * 4);
  p.data.set([0x88, 0x88, 0x88, 255], 0);
  p.data.set([0, 0, 0, 255], (1 * 12 + 1) * 4);
  return cicn(p);
}
test('FB1–FB6 example E: bevel lines, black FrameRect, (0, 13) and (99, 0) untouched', () => {
  const { port, res } = run([[`cicn:-10224`, fbIcon()]], inA({ value: 25 }));
  assert.equal(res.path, 'procedural');
  for (const x of [1, 50, 99]) assert.deepEqual(px(port, x, 13), [255, 255, 255, 255], `row 13 col ${x} white (mutations "sample (0,0)" and "sample (11,11)" differ)`);
  for (const y of [1, 7, 13]) assert.deepEqual(px(port, 99, y), [255, 255, 255, 255]);
  for (const y of [0, 6, 12]) assert.deepEqual(px(port, 0, y), [0x88, 0x88, 0x88, 255]);
  for (const x of [0, 50, 98]) assert.deepEqual(px(port, x, 0), [0x88, 0x88, 0x88, 255]);
  assert.equal(px(port, 0, 13)[3], 0, 'mutation "bevel the whole ring" draws (0, 13)');
  assert.equal(px(port, 99, 0)[3], 0);
  for (const [x, y] of [[1, 1], [98, 1], [1, 12], [98, 12], [50, 1], [50, 12], [1, 6], [98, 6]]) assert.deepEqual(px(port, x, y), [0, 0, 0, 255]);
});

test('FB4: no cicn −10224 → no bevel, black FrameRect; the outer ring stays transparent', () => {
  const { port, trace } = run([], inA());
  assert.ok(ops(trace, 'bevel').some(o => o.row === 'FB4'));
  for (const x of [0, 50, 99]) { assert.equal(px(port, x, 0)[3], 0); assert.equal(px(port, x, 13)[3], 0); }
  assert.deepEqual(px(port, 1, 1), [0, 0, 0, 255]);
});

test('FB7/COL3/COL4 example E: split at 26, dark grey [2, 26), lavender [26, 98), through the display policy', () => {
  const { port, trace } = run([[`cicn:-10224`, fbIcon()]], inA({ value: 25 }));
  assert.equal(ops(trace, 'split')[0].x, 26);
  assert.deepEqual(px(port, 2, 2), [0x44, 0x44, 0x44, 255]);
  assert.deepEqual(px(port, 25, 11), [0x44, 0x44, 0x44, 255]);
  assert.deepEqual(px(port, 26, 2), [0xcc, 0xcc, 0xff, 255], 'mutation "lavender cicn model" draws −10223 art');
  assert.deepEqual(px(port, 97, 11), [0xcc, 0xcc, 0xff, 255]);
  assert.equal(req(trace, 'cicn').includes(-10223), false);
});

test('FB8: indeterminate with ppat −10064 fills I_f at (I_f.left + 4·phase, I_f.top)', () => {
  const { trace, port } = run([[`cicn:-10224`, fbIcon()], ['ppat:-10064', pat(8, 8, 60)]], inA(), { indeterminate: 1, phase: 2 });
  assert.deepEqual(ops(trace, 'pattern')[0].phase, { x: 10, y: 2 });
  assert.deepEqual(px(port, 10, 2).slice(0, 3), [0, 0, 60]);
});

test('FB9/CHAIN3: indeterminate without ppat −10064 draws nothing in I_f and traces the step unspecified', () => {
  const { trace, port } = run([[`cicn:-10224`, fbIcon()]], inA(), { indeterminate: 1 });
  for (let y = 2; y < 12; y++) for (let x = 2; x < 98; x++) assert.equal(px(port, x, y)[3], 0, 'mutation "paint I_f lavender" fails');
  const step = trace.drawOps.find(o => o.row?.startsWith('FB9'));
  assert.ok(step.unspecified && step.row.includes('CHAIN3'));
});

test('FB10: an inactive procedural bar equals the active one pixel for pixel', () => {
  const a = run([[`cicn:-10224`, fbIcon()]], inA({ value: 40 }));
  const b = run([[`cicn:-10224`, fbIcon()]], inA({ value: 40, hilite: 255 }));
  assert.deepEqual(Array.from(a.port.data), Array.from(b.port.data));
});

test('COL2: a sample on a mask-clear pixel still gives its colour', () => {
  const icon = fbIcon();
  icon.pixmap.data[(13 * 12 + 11) * 4 + 3] = 0;
  const { port } = run([[`cicn:-10224`, icon]], inA());
  assert.deepEqual(px(port, 50, 13), [255, 255, 255, 255]);
});

// ── CHAIN ───────────────────────────────────────────────────────────────────
test('CHAIN1–CHAIN3: requests walk the archive then its base; the archive\'s own cicn −10224 wins', () => {
  const own = fbIcon();
  const baseIcon = cicn(solid(12, 14, [1, 2, 3, 255]));
  const { trace, port } = run([[`cicn:-10224`, own]], inA(), { base: [['cicn:-10224', baseIcon], ...forkA()] });
  // The base supplies the frame art too: the chain is one lookup over archive then base.
  assert.equal(trace.resolved.find(r => r.type === 'cicn' && r.id === FRAME).provider, 'base');
  assert.equal(px(port, 50, 13)[3] === 255 && px(port, 50, 13)[0] !== 255, true, 'frame art from the base, not the procedural bar');
  const b = run([[`cicn:-10224`, own]], inA(), { base: [['cicn:-10224', baseIcon]] });
  assert.equal(b.trace.resolved.find(r => r.id === -10224).provider, 'fork');
});

// ── IDLE ────────────────────────────────────────────────────────────────────
test('IDLE1/IDLE2: idle at t + 2 does not advance; t + 3 does and sets the idle time; a determinate bar never advances', () => {
  const r = newProgressRecord();
  assert.deepEqual(r, { indeterminate: 0, idleTime: 0, phase: 0 });
  r.indeterminate = 1; r.idleTime = 100;
  assert.equal(progressIdleAdvance(r, 102), false, 'mutation "≥ t + 2" advances here');
  assert.equal(progressIdleAdvance(r, 103), true, 'mutation ">" does not advance at t + 3');
  assert.deepEqual([r.phase, r.idleTime], [1, 103]);
  r.phase = 255; r.idleTime = 0;
  progressIdleAdvance(r, 3);
  assert.equal(r.phase, 0, '8-bit wrap');
  const det = newProgressRecord();
  assert.equal(progressIdleAdvance(det, 1000), false, 'mutation "advance a determinate bar" fails');
});

// ── loader needs ────────────────────────────────────────────────────────────
test('progressResourceIds / loader needs: frame, fill, track cinfs and cicns, 16 pattern frames, −10224, −10064', () => {
  const ids = progressResourceIds();
  for (const id of [FRAME, FILL, TRACK, IFRAME, IFILL, ITRACK]) {
    assert.ok(ids.some(r => r.type === 'cinf' && r.id === id));
    assert.ok(engineCinfIds().includes(id));
  }
  assert.equal(ids.filter(r => r.type === 'ppat').length, 17);
  assert.ok(ids.some(r => r.type === 'cicn' && r.id === -10224) && ids.some(r => r.type === 'ppat' && r.id === -10064));
  assert.ok(!ids.some(r => r.id === -10223), 'cicn −10223 is never requested');
  assert.ok(engineLineSampledCicnIds().includes(-10224));
});

test('DATA1 reads a byte, never booleanizes it, and ignores subsequent bytes (IDLE4)', () => {
  for (const [input, byte] of [[0, 0], [1, 1], [2, 2], [127, 127], [128, 128], [255, 255], [256, 0], [-1, 255], [511, 255]]) {
    const r = { indeterminate: 17, phase: 251, idleTime: 1234 };
    assert.equal(progressSetData(r, 'inde', [input, 99]).result, 0);
    assert.deepEqual(r, { indeterminate: byte, phase: 251, idleTime: 1234 });
    const before = { ...r };
    assert.equal(progressSetData(r, 'INDE', [1]).result, -30581);
    assert.deepEqual(r, before);
  }
});
