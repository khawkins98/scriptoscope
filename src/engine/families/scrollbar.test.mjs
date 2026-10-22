// Scroll-bar driver unit tests against docs/spec/engine/scrollbar.md, on
// synthetic forks (no theme). Each test names the spec rows it pins.
import '../../../tests/helpers/registerTs.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
const {
  ResourceChain, mapProvider, createTrace, rect,
  drawScrollbar, scrollbarGeometry, scrollbarPartAt, slicePieces,
} = await import('../index.ts');

const pm = (w, h, rgba = [10, 20, 30, 255]) => {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) data.set(rgba, i * 4);
  return { width: w, height: h, data };
};
const cicn = (w, h, opts = {}) => ({ pixmap: opts.pixmap ?? pm(w, h, opts.rgba), pixelSize: opts.pixelSize ?? 8, unmasked: opts.unmasked ?? null });
const chainOf = (entries) => new ResourceChain([mapProvider('fork', 'archive', entries)]);
const port = (w, h) => pm(w, h, [0, 0, 0, 0]);
const H120 = rect(0, 0, 16, 120);
const iv = (r, h = true) => (h ? [r.left, r.right] : [r.top, r.bottom]);

/** 1138-like horizontal fork: composite 33 × 16 tracks, 17 × 16 thumbs. */
function fork1138() {
  const e = [];
  for (const id of [-8288, -8287, -8286, -8285]) e.push([`cicn:${id}`, cicn(33, 16)]);
  for (const id of [-10205, -10206]) e.push([`cicn:${id}`, cicn(17, 16)]);
  return e;
}
const requested = (trace, type) => trace.resolved.filter(r => r.type === type).map(r => r.id);

test('§5.2–§5.8 worked example: 1138 horizontal 120 × 16, value 50 of 0..100', () => {
  const trace = createTrace('scrollbar');
  const { geometry: g } = drawScrollbar(port(120, 16), chainOf(fork1138()), { rect: H120, hilite: 0, min: 0, max: 100, value: 50 }, trace);
  assert.equal(g.composite, true);
  assert.deepEqual(iv(g.T), [15, 105]);
  assert.deepEqual(iv(g.boxes[0]), [0, 15]);
  assert.deepEqual(iv(g.boxes[3]), [105, 120]);
  assert.equal(g.len, 17);
  assert.deepEqual(iv(g.Th), [52, 69]);
  assert.deepEqual(iv(trace.rects.cell0), [0, 15]);
  assert.deepEqual(iv(trace.rects.cell3), [18, 33]);
  const segs = trace.drawOps.filter(o => o.op === 'segment' && o.dst).map(o => iv(o.dst));
  assert.deepEqual(segs, [[15, 53], [68, 105]]);
  // Draw order: arrow 0, arrow 3, thumb, then track (§3).
  const order = trace.drawOps.filter(o => ['arrow', 'slice', 'segment'].includes(o.op)).map(o => o.op);
  assert.deepEqual([...new Set(order)], ['arrow', 'slice', 'segment']);
  const sliceSrc = trace.drawOps.filter(o => o.row?.startsWith('TF8')).map(o => iv(o.src));
  assert.deepEqual(sliceSrc[0], [15, 16], 'track source [15,18) halves piece 1');
});

test('TR1–TR4: tier per state (pressed 3, normal 2, disabled 1, inactive 0)', () => {
  const at = (hilite) => {
    const trace = createTrace('scrollbar');
    scrollbarGeometry(chainOf(fork1138()), { rect: H120, hilite, min: 0, max: 100, value: 0 }, trace);
    return requested(trace, 'cicn')[0];
  };
  assert.equal(at(0), -8286);
  assert.equal(at(129), -8285);
  assert.equal(at(20), -8285);
  assert.equal(at(255), -8287);
  assert.equal(at(254), -8288);
});

test('CF1/CF2: 31 × 16 is composite, 16 × 16 is icon lane with t × t boxes', () => {
  const g31 = scrollbarGeometry(chainOf([['cicn:-8286', cicn(31, 16)]]), { rect: H120, hilite: 0, min: 0, max: 1, value: 0 });
  assert.equal(g31.composite, true);
  const g16 = scrollbarGeometry(chainOf([['cicn:-8286', cicn(16, 16)]]), { rect: H120, hilite: 0, min: 0, max: 1, value: 0 });
  assert.equal(g16.composite, false);
  assert.deepEqual(iv(g16.boxes[0]), [0, 16]);
  assert.deepEqual(iv(g16.boxes[3]), [104, 120]);
  assert.deepEqual(iv(g16.T), [15, 105]);
});

test('AH1/AC2/AC3: pressed 20 draws the hit low box from the track, the high box requests trackId − 1', () => {
  const trace = createTrace('scrollbar');
  drawScrollbar(port(120, 16), chainOf(fork1138()), { rect: H120, hilite: 20, min: 0, max: 100, value: 0 }, trace);
  const arrows = trace.drawOps.filter(o => o.op === 'arrow');
  assert.match(arrows[0].row, /AH1,AC1,AC3/);
  assert.match(arrows[1].row, /AH1,AC1,AC2/);
  assert.deepEqual(trace.resolved.filter(r => r.row === 'AC2').map(r => `${r.type}:${r.id}`), ['cicn:-8286', 'ppat:-8286']);
});

test('pressed 22/23/129: both boxes come from trackId − 1 (no hit arrow)', () => {
  for (const hilite of [22, 23, 129]) {
    const trace = createTrace('scrollbar');
    drawScrollbar(port(120, 16), chainOf(fork1138()), { rect: H120, hilite, min: 0, max: 100, value: 0 }, trace);
    assert.equal(trace.resolved.filter(r => r.row === 'AC2' && r.type === 'cicn').length, 2, `hilite ${hilite}`);
  }
});

test('AD4, TH2: inactive draws no arrows and no thumb; disabled draws arrows, no thumb, whole T', () => {
  const inactive = createTrace('scrollbar');
  drawScrollbar(port(120, 16), chainOf(fork1138()), { rect: H120, hilite: 254, min: 0, max: 100, value: 0 }, inactive);
  assert.ok(inactive.drawOps.filter(o => o.op === 'arrow').every(o => /AD4/.test(o.row)));
  assert.ok(!inactive.drawOps.some(o => o.row?.includes('TH7')));
  assert.ok(!requested(inactive, 'cicn').includes(-10206));
  const disabled = createTrace('scrollbar');
  const { geometry: g } = drawScrollbar(port(120, 16), chainOf(fork1138()), { rect: H120, hilite: 255, min: 0, max: 100, value: 0 }, disabled);
  assert.ok(disabled.drawOps.filter(o => o.op === 'arrow').every(o => !/AD4/.test(o.row)));
  assert.deepEqual([g.Th.left, g.Th.right], [0, 0]);
  const seg = disabled.drawOps.filter(o => o.op === 'segment' && o.dst);
  assert.equal(seg.length, 1);
  assert.deepEqual(iv(seg[0].dst), [15, 105]);
});

test('AI1–AI4: icon-lane ids (raised, hit only on the hit arrow, disabled) and ics8 from the ics# file', () => {
  const entries = [['cicn:-8286', cicn(16, 16)], ['cicn:-8285', cicn(16, 16)], ['cicn:-8287', cicn(16, 16)]];
  for (const id of [-10197, -10198, -10201, -10202, -10205, -10206]) entries.push([`ics#:${id}`, { id }], [`ics8:${id}`, pm(16, 16)]);
  const icons = (hilite) => {
    const trace = createTrace('scrollbar');
    drawScrollbar(port(120, 16), chainOf(entries), { rect: H120, hilite, min: 0, max: 100, value: 0 }, trace);
    return { mask: requested(trace, 'ics#'), color: requested(trace, 'ics8'), ics4: requested(trace, 'ics4') };
  };
  assert.deepEqual(icons(0).mask, [-10202, -10201]);
  assert.deepEqual(icons(20).mask, [-10198, -10201]);
  assert.deepEqual(icons(255).mask, [-10206, -10205]);
  assert.deepEqual(icons(0).color, [-10202, -10201]);
  assert.deepEqual(icons(0).ics4, []);
});

test('TR7 quirk: t ≤ 11 without small art keeps trackId + 18; pressed non-hit arrows ask base + 2 + 18', () => {
  const e = [['cicn:-8285', cicn(48, 16)], ['cicn:-8286', cicn(48, 16)], ['cicn:-10205', cicn(16, 16)], ['cicn:-10206', cicn(16, 16)]];
  const trace = createTrace('scrollbar');
  const { geometry: g } = drawScrollbar(port(120, 11), chainOf(e), { rect: rect(0, 0, 11, 120), hilite: 20, min: 0, max: 100, value: 0 }, trace);
  assert.equal(g.trackId, -8285 + 18);
  assert.deepEqual(requested(trace, 'cicn').slice(0, 2), [-8285 + 18, -8285]);
  assert.ok(trace.resolved.some(r => r.row === 'AC2' && r.id === -8286 + 18));
  // §5.6: no small thumb → minLen 16 − 5.
  assert.equal(g.len, 11);
});

test('§5.9 caps: t = 11 thumb 16 → 11 (k = 3, q1 = 3, q2 = 2)', () => {
  const pieces = slicePieces(true, rect(0, 0, 16, 16), rect(0, 0, 11, 11), 0).map(p => [p.piece, iv(p.dst), iv(p.src)]);
  assert.deepEqual(pieces, [['caps-1', [0, 3], [0, 3]], ['caps-3', [3, 9], [6, 12]], ['caps-5', [9, 11], [14, 16]]]);
});

test('§5.9 halves for the track: a = m >> 1, middle column stretched', () => {
  const pieces = slicePieces(true, rect(0, 15, 16, 18), rect(0, 15, 16, 53), 1).map(p => [iv(p.dst), iv(p.src), p.line]);
  assert.deepEqual(pieces, [[[15, 16], [15, 16], true], [[16, 51], [16, 17], true], [[51, 53], [16, 18], false]]);
});

test('HT1–HT8: part codes', () => {
  const g = scrollbarGeometry(chainOf(fork1138()), { rect: H120, hilite: 0, min: 0, max: 100, value: 50 });
  const at = (x) => scrollbarPartAt(g, { x, y: 8 }).part;
  assert.deepEqual([at(3), at(110), at(55), at(20), at(100), at(-1)], [20, 21, 129, 22, 23, 0]);
  const gd = scrollbarGeometry(chainOf(fork1138()), { rect: H120, hilite: 255, min: 0, max: 100, value: 50 });
  assert.equal(scrollbarPartAt(gd, { x: 3, y: 8 }).part, 0);
});

test('AC5 / I2–I3: a deep cell copies opaque (mask ignored); a 1-bit cell copies through its mask', () => {
  const masked = pm(33, 16, [200, 0, 0, 0]); // every mask bit clear
  const unmasked = pm(33, 16, [200, 0, 0, 255]);
  const run = (pixelSize) => {
    const out = port(120, 16);
    const e = [['cicn:-8286', cicn(33, 16, { pixmap: masked, unmasked, pixelSize })]];
    drawScrollbar(out, chainOf(e), { rect: H120, hilite: 0, min: 0, max: 100, value: 0 });
    return Array.from(out.data.slice(4 * (8 * 120 + 3), 4 * (8 * 120 + 3) + 4));
  };
  assert.deepEqual(run(8), [200, 0, 0, 255]);
  assert.deepEqual(run(1), [0, 0, 0, 0]);
});

test('AC4 / R1: with a pattern, mask-clear cell pixels show the pattern anchored at R', () => {
  const cell = pm(33, 16, [1, 2, 3, 255]);
  cell.data[(0 * 33 + 0) * 4 + 3] = 0;
  const pat = pm(8, 8, [9, 9, 9, 255]);
  pat.data.set([7, 7, 7, 255], (1 * 8 + 3) * 4);
  const out = port(130, 20);
  drawScrollbar(out, chainOf([['cicn:-8286', cicn(33, 16, { pixmap: cell })], ['ppat:-8286', pat]]),
    { rect: rect(1, 3, 17, 123), hilite: 0, min: 0, max: 100, value: 0 });
  // Box 0's top-left pixel (3, 1) is mask-clear: pattern pixel ((3−3) mod 8, (1−1) mod 8) = (0, 0).
  assert.deepEqual(Array.from(out.data.slice((1 * 130 + 3) * 4, (1 * 130 + 3) * 4 + 4)), [9, 9, 9, 255]);
});
