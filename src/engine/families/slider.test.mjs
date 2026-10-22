// Slider (CDEF 3) driver unit tests against docs/spec/engine/slider.md, on
// synthetic forks (no theme). Each test names the spec rows it pins.
import '../../../tests/helpers/registerTs.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
const {
  ResourceChain, mapProvider, createTrace, rect,
  sliderGate, sliderInit, drawSlider, sliderMessage, sliderPartAt, sliderValueFromGhost, sliderPosCntl, sliderThumbCntl,
  sliderFeatures, sliderRegion, sliderResourceIds, engineCinfIds,
} = await import('../index.ts');

const pm = (w, h, rgba = [10, 20, 30, 255]) => {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) data.set(rgba, i * 4);
  return { width: w, height: h, data };
};
/** A pixmap whose pixel (x, y) encodes its own coordinates: r = x, g = y, b = tag. */
const mapPm = (w, h, tag, mask = () => true) => {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) data.set([x, y, tag, mask(x, y) ? 255 : 0], (y * w + x) * 4);
  return { width: w, height: h, data };
};
const cicn = (pixmap) => ({ pixmap, pixelSize: 8, unmasked: null });
const cinf = (...bytes) => ({ bytes: [...bytes, ...new Array(18 - bytes.length).fill(0)] });
const chainOf = (entries) => new ResourceChain([mapProvider('fork', 'archive', entries)]);
const BG = { r: 1, g: 2, b: 3, a: 255 };
const H = { base: -10144 }, V = { base: -10128 };
const px = (p, x, y) => Array.from(p.data.slice((y * p.width + x) * 4, (y * p.width + x) * 4 + 4));

/** 1138-like horizontal fork, every group: c 5, thumb 15 × 64, track 49 × 16 (cinf 5,16,1,0), ticks 5 × 7. */
function forkA({ thumbMask, trackMask } = {}) {
  const e = [];
  for (const g of [0, 6, 12]) {
    const gb = H.base + g;
    for (const t of [0, 1, 2]) { e.push([`cicn:${gb + t}`, cicn(mapPm(49, 16, 10 + t, trackMask))]); e.push([`cinf:${gb + t}`, cinf(5, 16, 1, 0)]); }
    e.push([`cicn:${gb + 3}`, cicn(mapPm(15, 64, 20, thumbMask))]);
    e.push([`cicn:${gb + 4}`, cicn(mapPm(5, 7, 30))]);
    e.push([`cicn:${gb + 5}`, cicn(mapPm(5, 7, 31))]);
  }
  return e;
}
const inA = (o = {}) => ({ rect: rect(0, 0, 32, 120), hilite: 0, min: 0, max: 100, value: 50, variation: 2, ...o });

function run(entries, input, { ticks = 0, message, ghost, port } = {}) {
  const chain = chainOf(entries);
  const trace = createTrace('slider');
  const init = sliderInit(chain, { ...input, value: input.min }, ticks, trace);
  if (!init) return { handedOff: true, trace };
  const out = port ?? pm(input.rect.right, input.rect.bottom, [0, 0, 0, 0]);
  const { state } = drawSlider(out, chain, init.record, input, { background: BG, ...(message !== undefined ? { message } : {}), ...(ghost ? { ghost } : {}) }, trace);
  return { state, trace, port: out, record: init.record, chain };
}
const ops = (trace, op) => trace.drawOps.filter(o => o.op === op);
const iv = (r, h = true) => (h ? [r.left, r.right] : [r.top, r.bottom]);

test('§5.9 example A: band, thumb, track tiles, ticks and hit points (1138-like, group 0)', () => {
  const { state, trace } = run(forkA(), inA(), { ticks: 5 });
  assert.equal(state.c, 5);
  assert.equal(state.record.travel, 95);
  assert.deepEqual(state.B, rect(0, 0, 16, 120));
  assert.deepEqual(state.Th, rect(0, 52, 16, 67));
  const thumb = ops(trace, 'thumb')[0];
  assert.deepEqual(thumb.src, rect(16, 0, 32, 15), 'cell 1: rows [16, 32)');
  const caps = ops(trace, 'cap').map(o => [iv(o.src), iv(o.dst)]);
  assert.deepEqual(caps, [[[0, 5], [0, 5]], [[44, 49], [115, 120]]]);
  const tile = ops(trace, 'tile')[0];
  assert.deepEqual([iv(tile.src), iv(tile.dst), tile.anchor], [[5, 44], [5, 115], 'start']);
  const ticks = ops(trace, 'tick').map(o => o.dst);
  assert.deepEqual(ticks.map(r => r.left), [10, 33, 57, 81, 105]);
  assert.ok(ticks.every(r => r.top === 16 && r.bottom === 23));
  for (const [x, y, part] of [[30, 8, 22], [60, 8, 129], [100, 8, 23], [60, 20, 0]]) assert.equal(sliderPartAt(state, { x, y }).part, part);
});

test('SL6/BL6 example A: the middle is tiled from the start, last tile cut ([83,115) ← [5,37))', () => {
  const { port } = run(forkA(), inA());
  for (const [x, sx] of [[5, 5], [43, 43], [44, 5], [83, 5], [114, 36]]) assert.deepEqual(px(port, x, 3).slice(0, 3), [sx, 3, 11], `x ${x}`);
});

test('§5.9 example B: vertical group 0 thumb and ticks (minimum at the bottom)', () => {
  const e = [];
  for (const t of [0, 1, 2]) { e.push([`cicn:${V.base + t}`, cicn(mapPm(16, 49, 10 + t))]); e.push([`cinf:${V.base + t}`, cinf(5, 16, 1, 0)]); }
  e.push([`cicn:${V.base + 3}`, cicn(mapPm(64, 19, 20))]);
  e.push([`cicn:${V.base + 5}`, cicn(mapPm(7, 3, 30))]);
  const { state, trace } = run(e, { rect: rect(0, 0, 100, 32), hilite: 0, min: 0, max: 100, value: 25, variation: 2 }, { ticks: 3 });
  assert.equal(state.record.travel, 71);
  assert.deepEqual(state.Th, rect(58, 0, 77, 16));
  assert.deepEqual(ops(trace, 'thumb')[0].src, rect(0, 16, 19, 32), 'cell 1: columns [16, 32)');
  assert.deepEqual(ops(trace, 'tick').map(o => iv(o.dst, false)), [[84, 87], [48, 51], [13, 16]]);
  assert.ok(ops(trace, 'tick').every(o => o.dst.left === 16 && o.dst.right === 23));
});

test('§5.9 example C / SL1 / SL4 / BL4: one-column middle drawn as lines, art centred in B', () => {
  const e = [];
  const gb = H.base + 12;
  for (const t of [0, 1, 2]) {
    e.push([`cicn:${gb + t}`, cicn(mapPm(5, 4, 10 + t, (x, y) => !(x === 2 && y === 1)))]);
    e.push([`cinf:${gb + t}`, cinf(2, 4, 0, 0)]);
  }
  e.push([`cicn:${gb + 3}`, cicn(mapPm(11, 64, 20))]);
  const { state, trace, port } = run(e, { rect: rect(0, 0, 16, 100), hilite: 0, min: 0, max: 100, value: 50, variation: 8 });
  assert.equal(state.c, 2);
  assert.deepEqual(state.Th, rect(0, 44, 16, 55));
  assert.deepEqual(ops(trace, 'cap').map(o => [iv(o.src), iv(o.dst), iv(o.dst, false)]), [[[0, 2], [0, 2], [6, 10]], [[3, 5], [98, 100], [6, 10]]]);
  assert.equal(ops(trace, 'tileLines')[0].row.includes('BL4'), true);
  assert.deepEqual(px(port, 30, 6), [2, 0, 11, 255], 'row 6 ← source pixel (2, 0)');
  assert.deepEqual(px(port, 30, 7), [1, 2, 3, 255], 'mask-clear source row 1 leaves the background');
  assert.deepEqual(px(port, 30, 9), [2, 3, 11, 255]);
  assert.deepEqual(px(port, 30, 3), [1, 2, 3, 255], 'outside the art: the O4 background');
});

test('SL2 example D: halves when the along length is ≤ 2k', () => {
  const e = [[`cicn:${V.base + 1}`, cicn(mapPm(16, 30, 10))], [`cinf:${V.base + 1}`, cinf(10, 0, 1, 0)], [`cinf:${V.base}`, cinf(10)]];
  const { trace } = run(e, { rect: rect(0, 0, 15, 14), hilite: 0, min: 0, max: 100, value: 0, variation: 0 });
  assert.deepEqual(ops(trace, 'halves').map(o => [iv(o.src, false), iv(o.dst, false)]), [[[0, 8], [0, 8]], [[23, 30], [8, 15]]]);
});

test('SL6 end-anchored tiles (byte 3 ≠ 0): the first-placed tile ends at D.right − k', () => {
  const e = forkA().map(([k, v]) => (k.startsWith('cinf') ? [k, cinf(5, 16, 1, 1)] : [k, v]));
  const { port } = run(e, inA());
  assert.deepEqual(px(port, 114, 3).slice(0, 3), [43, 3, 11]);
  assert.deepEqual(px(port, 75, 3).slice(0, 3), [43, 3, 11]);
  assert.deepEqual(px(port, 76, 3).slice(0, 3), [5, 3, 11]);
  assert.deepEqual(px(port, 5, 3).slice(0, 3), [12, 3, 11], 'the last tile is cut at D.left + k, source cut from the start');
});

test('G1–G3 gate: cinf only; base, base+12 (bit 3), base+6 (bit 2)', () => {
  const g = (entries, variation) => sliderGate(chainOf(entries), { rect: rect(0, 0, 16, 100), hilite: 0, min: 0, max: 100, value: 0, variation });
  assert.equal(g([[`cinf:${H.base}`, cinf(5)]], 4), 'G1', 'only cinf base with bit 2: draws');
  assert.equal(g([[`cinf:${H.base + 12}`, cinf(5)]], 8), 'G1', 'only cinf −10132 with bit 3: draws');
  assert.equal(g([[`cinf:${H.base + 12}`, cinf(5)]], 4), 'G2', 'only cinf −10132 with bit 2 alone: handed off');
  // floppies-like: slider cicns but no slider cinf.
  const cicnsOnly = forkA().filter(([k]) => k.startsWith('cicn'));
  assert.equal(g(cicnsOnly, 8), 'G2');
  assert.equal(run(cicnsOnly, inA({ variation: 8 })).handedOff, true);
  const t = createTrace('slider');
  sliderGate(chainOf([]), { rect: rect(0, 0, 16, 100), hilite: 0, min: 0, max: 100, value: 0, variation: 12 }, t);
  assert.deepEqual(t.resolved.map(r => [r.type, r.id]), [['cinf', H.base], ['cinf', H.base + 12], ['cinf', H.base + 6]]);
});

test('TR1/TH3 state map: hilite 0/22/129/254/255 → track tier 1/2/2/0/0, thumb cell 1/1/2/0/0', () => {
  for (const [hilite, tier, cell] of [[0, 1, 1], [22, 2, 1], [23, 2, 1], [129, 2, 2], [254, 0, 0], [255, 0, 0]]) {
    const { trace } = run(forkA(), inA({ hilite, variation: 8 }));
    const track = ops(trace, 'track').find(o => o.id !== undefined);
    assert.equal(track.id, H.base + 12 + tier, `hilite ${hilite} tier`);
    assert.equal(ops(trace, 'thumb')[0].src.top, 16 * cell, `hilite ${hilite} cell`);
  }
});

test('TR3/TR4: pressed tier missing → gb + 1; a cicn without its cinf is skipped', () => {
  const noPressed = forkA().filter(([k]) => k !== `cicn:${H.base + 14}`);
  assert.equal(ops(run(noPressed, inA({ hilite: 129, variation: 8 })).trace, 'track').find(o => o.id).id, H.base + 13);
  const noPressedCinf = forkA().filter(([k]) => k !== `cinf:${H.base + 14}`);
  const { trace } = run(noPressedCinf, inA({ hilite: 129, variation: 8 }));
  assert.equal(ops(trace, 'track').find(o => o.id && o.row.startsWith('TR6')).id, H.base + 13);
  assert.ok(ops(trace, 'track').some(o => o.row === 'TR4'));
  const cinfsOnly = forkA().filter(([k]) => k.startsWith('cinf'));
  assert.ok(ops(run(cinfsOnly, inA({ variation: 8 })).trace, 'track').some(o => o.row === 'TR5'));
});

test('TH4/BL1/OS4: mask-clear thumb and track pixels show the O4 background, not the port', () => {
  const port = pm(120, 32, [200, 200, 200, 255]);
  const { state } = run(forkA({ thumbMask: (x) => x !== 0, trackMask: (x, y) => y !== 0 }), inA({ variation: 8 }), { port });
  const Th = state.Th, top = state.B.top;
  // Track shows under a mask-clear thumb column.
  assert.deepEqual(px(port, Th.left, top + 5).slice(2, 3), [11]);
  // A mask-clear track row: background, never the port's old pixels.
  assert.deepEqual(px(port, 3, top), [1, 2, 3, 255]);
  assert.deepEqual(px(port, 3, 28), [1, 2, 3, 255], 'outside B: the background');
});

test('O-order: erase, track, (ghost), thumb, ticks, composite', () => {
  const { trace } = run(forkA(), inA(), { ticks: 3, message: 13, ghost: rect(0, 20, 16, 35) });
  const order = trace.drawOps.map(o => o.op).filter(o => ['erase', 'cap', 'ghost', 'thumb', 'tick', 'composite'].includes(o));
  assert.deepEqual([...new Set(order)], ['erase', 'cap', 'ghost', 'thumb', 'tick', 'composite']);
  assert.equal(ops(trace, 'ghost')[0].src.top, 48, 'TH5: cell 3');
  const plain = run(forkA(), inA(), { ticks: 3 }).trace;
  assert.equal(ops(plain, 'ghost').length, 0, 'no ghost outside message 13');
});

test('§5.1 group bands: top / bottom / centre; group-2 centre uses trunc of the 16-bit sum', () => {
  const band = (variation, R) => run(forkA(), { rect: R, hilite: 0, min: 0, max: 100, value: 0, variation }).state.B;
  assert.deepEqual(iv(band(0, rect(0, 0, 32, 120)), false), [0, 16]);
  assert.deepEqual(iv(band(4, rect(0, 0, 32, 120)), false), [16, 32]);
  assert.deepEqual(iv(band(8, rect(0, 0, 32, 120)), false), [8, 24]);
  assert.deepEqual(iv(band(8, rect(-10, 0, 5, 120)), false), [-10, 6]);
});

test('§5.2 range 0: Th at R.left with no corner inset', () => {
  assert.equal(run(forkA(), inA({ min: 10, max: 10, value: 10, variation: 8 })).state.Th.left, 0);
});

test('TK1–TK3 and §5.4 v_i rounding: range 0..10, n = 4 → v 0, 3, 7, 10', () => {
  const xs = run(forkA(), inA({ max: 10, value: 0 }), { ticks: 4 }).trace;
  const c = 5, T = 95;
  assert.deepEqual(ops(xs, 'tick').map(o => o.dst.left), [0, 3, 7, 10].map(v => c + Math.trunc((T * v) / 10) + 5));
  assert.equal(ops(run(forkA(), inA(), { ticks: 1 }).trace, 'tick').length, 0, 'n = 1');
  assert.equal(ops(run(forkA(), inA({ min: 5, max: 5, value: 5 }), { ticks: 5 }).trace, 'tick').length, 0, 'range 0');
  const thin = run(forkA(), inA({ rect: rect(0, 0, 23, 120) }), { ticks: 5 }).trace;
  assert.equal(ops(thin, 'tick').length, 0, 'R cross 23');
  assert.ok(thin.resolved.some(r => r.id === H.base + 5), 'TK3: the tick cicn is still requested');
  assert.equal(ops(run(forkA(), inA({ variation: 10 }), { ticks: 5 }).trace, 'tick').length, 0, 'group 2 never ticks (ID4)');
});

test('§5.6–§5.8 tracking: value from G, posCntl sign, thumbCntl limit and slop', () => {
  const { state } = run(forkA(), inA({ variation: 8 }));
  assert.equal(sliderValueFromGhost(state, rect(0, 52, 16, 67)), 49);
  assert.equal(sliderValueFromGhost(state, rect(0, 53, 16, 68)), 51);
  assert.equal(sliderPosCntl(state, 10), 50 + Math.trunc((10 * 100 + 47) / 95));
  assert.equal(sliderPosCntl(state, -10), 50 - Math.trunc((10 * 100 + 47) / 95));
  const vFork = forkA().map(([k, x]) => { const [type, id] = k.split(':'); return [`${type}:${Number(id) + 16}`, x.pixmap ? cicn(mapPm(x.pixmap.height, x.pixmap.width, 9)) : x]; });
  const v = run(vFork, { rect: rect(0, 0, 120, 16), hilite: 0, min: 0, max: 100, value: 50, variation: 8 }).state;
  assert.equal(v.record.travel, 95);
  assert.equal(sliderPosCntl(v, 10), 50 - Math.trunc((10 * 100 + 47) / 95), 'vertical: a downward drag lowers the value');
  assert.equal(sliderPosCntl(v, -10), 50 + Math.trunc((10 * 100 + 47) / 95));
  const tc = sliderThumbCntl(state, { x: 60, y: 8 });
  assert.equal(tc.axis, 1);
  assert.deepEqual([tc.limit.left, tc.limit.right], [60 - 47, 60 - 47 + 96]);
  assert.deepEqual(tc.slop, rect(8 - 15, -15, 24 + 15, 135), 'B (group 2: rows [8, 24)) outset by 15');
});

test('messages 2/10/11/19 and the no-thumb rows (TH2)', () => {
  const { state } = run(forkA(), inA({ variation: 8 }));
  assert.deepEqual(sliderRegion(state, 10), state.input.rect);
  assert.deepEqual(sliderRegion(state, 11), state.Th);
  assert.deepEqual(sliderRegion(state, 2, true), state.Th);
  assert.equal(sliderFeatures(0), 1 + 8192);
  assert.equal(sliderFeatures(1), 1 + 8192 + 1024);
  const noThumb = run(forkA().filter(([k]) => !k.endsWith(String(H.base + 15)) && !k.endsWith(String(H.base + 3))), inA({ variation: 8 }));
  assert.deepEqual(noThumb.state.Th, rect(0, 0, 0, 0));
  assert.equal(sliderPartAt(noThumb.state, { x: 30, y: 8 }).part, 23);
  assert.equal(sliderValueFromGhost(noThumb.state, rect(0, 30, 16, 40)), 50);
});

test('loader needs: every slider cinf id is requested from the loader', () => {
  const ids = new Set(engineCinfIds());
  for (const h of [true, false]) for (const { type, id } of sliderResourceIds(h)) if (type === 'cinf') assert.ok(ids.has(id), String(id));
  assert.ok(sliderMessage);
});

test('BL8/BL12: line colours follow the sampler companion, or the shortcut is guarded / traced', () => {
  const gb = H.base + 12;
  const mk = (extra) => {
    const e = [];
    for (const t of [0, 1, 2]) {
      e.push([`cicn:${gb + t}`, { ...cicn(mapPm(5, 4, 10 + t)), ...extra }]);
      e.push([`cinf:${gb + t}`, cinf(2, 4, 0, 0)]);
    }
    return e;
  };
  const input = { rect: rect(0, 0, 16, 100), hilite: 0, min: 0, max: 100, value: 50, variation: 8 };
  // equivalent: decoded colour, guarded shortcut, no unspecified.
  const eq = run(mk({ sampling: 'equivalent' }), input);
  const eqOp = ops(eq.trace, 'tileLines')[0];
  assert.match(eqOp.row, /BL8,BL12/);
  assert.equal(eqOp.unspecified, undefined);
  assert.deepEqual(px(eq.port, 30, 6), [2, 0, 11, 255]);
  // different with a companion: BL8 colours from the companion.
  const sampled = pm(5, 4, [90, 91, 92, 255]);
  const diff = run(mk({ sampling: 'different', sampled }), input);
  assert.deepEqual(px(diff.port, 30, 6), [90, 91, 92, 255]);
  assert.equal(ops(diff.trace, 'tileLines')[0].unspecified, undefined);
  // unknown, no companion: decoded colour, shortcut traced.
  const unk = run(mk({ sampling: 'unknown' }), input);
  assert.match(ops(unk.trace, 'tileLines')[0].unspecified, /without an equivalence record/);
});

test('BL11: a cicn with a non-zero bounds origin is traced', () => {
  const e = forkA().map(([k, v]) => (k === `cicn:${H.base + 15}` ? [k, { ...v, origin: { top: 0, left: 3 } }] : [k, v]));
  const { trace } = run(e, inA({ variation: 8 }));
  const o = ops(trace, 'origin');
  assert.equal(o.length, 1);
  assert.equal(o[0].id, H.base + 15);
  assert.equal(ops(run(forkA().map(([k, v]) => [k, v.pixmap ? { ...v, origin: { top: 0, left: 0 } } : v]), inA()).trace, 'origin').length, 0);
});

test('CF1–CF3: a zero-length cinf passes the gate; short reads are traced, corner not found, track candidate failed', () => {
  assert.equal(sliderGate(chainOf([[`cinf:${H.base}`, { bytes: [] }]]), { rect: rect(0, 0, 16, 100), hilite: 0, min: 0, max: 100, value: 0, variation: 0 }), 'G1');
  // Short corner cinf at gb: falls through to... the probe stops at the first found id, so c stays undefined (ID8).
  const e = forkA().map(([k, v]) => (k === `cinf:${H.base + 12}` ? [k, { bytes: [] }] : [k, v]));
  const { state, trace } = run(e, inA({ variation: 8, hilite: 254 }));
  assert.equal(state.c, null);
  assert.ok(trace.drawOps.some(o => o.row?.includes('CF3') && o.row.includes('ID8')));
  // The short cinf at gb + 0 fails the inactive track candidate; gb + 1 is used.
  assert.ok(ops(trace, 'track').some(o => o.row === 'CF3,TR4' && o.id === H.base + 12));
  assert.equal(ops(trace, 'track').find(o => o.row.startsWith('TR6')).id, H.base + 13);
});
