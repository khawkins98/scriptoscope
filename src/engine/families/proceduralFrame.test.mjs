// Built-in window frame driver tests against docs/spec/engine/procedural-frame.md,
// on synthetic forks (no theme) plus one corpus check (§12 first hook). Each
// test names the spec rows it pins; the §12 test hooks are all here.
import '../../../tests/helpers/registerTs.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
const E = await import('../index.ts');
const {
  ResourceChain, mapProvider, createTrace, rect,
  drawProceduralFrame, proceduralFrameGeometry, proceduralFrameTitleHeight, proceduralFrameFeatures, proceduralFrameRegion,
  proceduralFramePartAt, proceduralFrameResourceIds, engineIconBlitCicnIds, PF_WIDGET_IDS,
} = E;

/** A 16 × 16 cicn whose pixel (x, y) has colour (x * 16, y * 16, 7): every sample point is identifiable. */
function gridIcon(w = 16, h = 16, tag = 7) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) data.set([x * 16, y * 16, tag, 255], (y * w + x) * 4);
  return { pixmap: { width: w, height: h, data }, pixelSize: 8, unmasked: { width: w, height: h, data } };
}
const solid = (w, h, rgba) => { const d = new Uint8ClampedArray(w * h * 4); for (let i = 0; i < w * h; i++) d.set(rgba, i * 4); return { width: w, height: h, data: d }; };
const planes = (maskAll = true) => [...new Array(32).fill(0), ...new Array(32).fill(maskAll ? 0xff : 0)];

function fork({ withStripeCicn = true, withStripePpat = false, actb0 = [0xdede, 0xdede, 0xdede] } = {}) {
  const e = [];
  for (const id of [-14336, -14332]) e.push([`cicn:${id}`, gridIcon(16, 16, id === -14332 ? 1 : 2)]);
  for (const id of [-14328, -14326, -14324, -14322]) e.push([`cicn:${id}`, gridIcon(16, 16, 100 + (id & 0xff))]);
  for (const id of [-14330, -14334]) e.push([`cicn:${id}`, { pixmap: solid(17, 17, [9, 9, 9, 255]), pixelSize: 8, unmasked: solid(17, 17, [9, 9, 9, 255]) }]);
  if (withStripeCicn) for (const id of [-14331, -14325, -14321]) e.push([`cicn:${id}`, { pixmap: solid(16, 13, [50, 50, 50, 255]), pixelSize: 8, unmasked: null }]);
  if (withStripePpat) for (const id of [-14331, -14325, -14321]) e.push([`ppat:${id}`, solid(8, 8, [60, 60, 60, 255])]);
  for (const r of PF_WIDGET_IDS) for (const id of [r.normal, r.pressed]) {
    e.push([`ics#:${id}`, { planes: planes() }], [`ics8:${id}`, solid(16, 16, [id & 0xff, 1, 1, 255])]);
  }
  e.push(['actb:-14336', { entries: [{ value: 0, rgb16: actb0, rgb: actb0.map(v => v >> 8) }] }]);
  return new ResourceChain([mapProvider('fork', 'archive', e)]);
}
const C = rect(40, 30, 120, 230); // 200 × 80 content
const doc = (o = {}) => ({ content: C, variation: 8, hilited: true, goAway: true, shadeOn: true, titleWidth: 40, ...o });
const port = () => solid(300, 200, [0, 0, 0, 0]);
const draw = (input, chain = fork(), opts = {}) => { const t = createTrace('proceduralFrame'); const r = drawProceduralFrame(port(), chain, input, opts, t); return { ...r, trace: t }; };

test('§3.2 title height: H = 22 for Chicago 12; parity step; floor raises the ascent', () => {
  assert.deepEqual(proceduralFrameTitleHeight(), { H: 22, ascent: 12, descent: 3 });
  // 14 + 4 + 6 = 24, even → 23 (the parity step; dropping it gives 24).
  assert.equal(proceduralFrameTitleHeight({ ascent: 14, descent: 4 }).H, 23);
  // 9 + 2 + 6 = 17 → floor 22, ascent += trunc(5 / 2).
  assert.deepEqual(proceduralFrameTitleHeight({ ascent: 9, descent: 2 }), { H: 22, ascent: 11, descent: 2 });
});

test('§3.3 structure: width = content + 12 + 1 shadow; height = content + H + 6 + 1', () => {
  const g = proceduralFrameGeometry(fork(), doc());
  assert.equal(g.bounds.right - g.bounds.left, 200 + 12 + 1);
  assert.equal(g.bounds.bottom - g.bounds.top, 80 + 22 + 6 + 1);
  assert.deepEqual(g.structureBox, rect(40 - 22, 30 - 6, 120 + 6, 230 + 6));
  assert.deepEqual(g.T, rect(18, 24, 40, 236));
});

test('§3.3 widget rects: close T.l + 4, collapse T.r − 17, zoom T.r − 33, top T.t + 4; grow 17 × 17 at (C.r − 15, C.b − 15)', () => {
  const g = proceduralFrameGeometry(fork(), doc());
  assert.deepEqual(g.widgets.close, rect(22, 28, 38, 44));
  assert.deepEqual(g.widgets.collapse, rect(22, 219, 38, 235));
  assert.deepEqual(g.widgets.zoom, rect(22, 203, 38, 219));
  assert.deepEqual(g.shown, { close: true, zoom: true, collapse: true });
  assert.deepEqual(g.grow, rect(105, 215, 122, 232));
  assert.equal(g.growBelongs, true);
  // No collapse option: zoom moves to T.r − 17.
  assert.equal(proceduralFrameGeometry(fork(), doc({ shadeOn: false })).widgets.zoom.left, 236 - 17);
});

test('§3.3 widget presence: a narrow window drops the collapse box, then the zoom box', () => {
  const narrow = (w) => proceduralFrameGeometry(fork(), doc({ content: rect(40, 30, 120, 30 + w) })).shown;
  assert.deepEqual(narrow(40), { close: true, zoom: true, collapse: false }); // zoom at T.r − 33 meets close
  assert.deepEqual(narrow(10), { close: true, zoom: false, collapse: false }); // zoom at T.r − 17 still meets close
});

test('§3.3 title text: centred, clamped at L, vertical T inset 3; L/R limits', () => {
  const g = proceduralFrameGeometry(fork(), doc());
  assert.equal(g.L, 28 + 17);
  assert.equal(g.R, 203 - 4);
  assert.deepEqual(g.titleText, rect(21, 24 + Math.trunc((212 - 40) / 2), 37, 24 + 86 + 40));
  const wide = proceduralFrameGeometry(fork(), doc({ titleWidth: 400 }));
  assert.equal(wide.titleText.left, wide.L);
  assert.ok(proceduralFrameGeometry(fork(), doc({ titleWidth: 0 })).titleText.right === 0);
});

test('§5.1 samples (§12): fill P(6, 3), text P(7, 3), shadow P(9, 3) of -14332 (hilited) / -14336', () => {
  for (const [hilited, tag] of [[true, 1], [false, 2]]) {
    const { trace } = draw(doc({ hilited }));
    const s = trace.drawOps.find(o => o.op === 'sample');
    assert.deepEqual([s.fill.r, s.fill.g, s.fill.b], [6 * 16, 3 * 16, tag]);
    assert.deepEqual([s.text.r, s.text.g, s.text.b], [7 * 16, 3 * 16, tag]);
    assert.deepEqual([s.shadow.r, s.shadow.g, s.shadow.b], [9 * 16, 3 * 16, tag]);
  }
});

test('§5.1 title text passes: shadow at (+1, +1) first, then main; baseline from the ascent; clip (L, T.t, R, T.b)', () => {
  const passes = [];
  draw(doc(), fork(), { renderTitle: (_p, pass) => passes.push(pass) });
  assert.deepEqual(passes.map(p => p.pass), ['shadow', 'main']);
  const [sh, main] = passes;
  assert.equal(main.x, 24 + 86);
  assert.equal(main.y, 21 + Math.trunc((16 - 15) / 2) + 12);
  assert.deepEqual([sh.x - main.x, sh.y - main.y], [1, 1]);
  assert.deepEqual(main.clip, rect(18, 45, 40, 199));
});

test('§3.5 widget ids (#387, §12): zoom normal -14334, collapse -14335, close -14336', () => {
  const { trace } = draw(doc());
  const ids = trace.drawOps.filter(o => o.op === 'widget' && o.dst).map(o => [o.dst.left, o.id]);
  assert.deepEqual(ids, [[28, -14336], [203, -14334], [219, -14335]]);
});

test('§2 parts 4 / 5 / 9 draw the pressed glyph (close -14333, zoom -14331, collapse -14332) and flip the toggle', () => {
  for (const [part, id] of [[4, -14333], [5, -14331], [6, -14331], [9, -14332]]) {
    const r = draw(doc(), fork(), { part });
    assert.equal(r.trace.drawOps.find(o => o.op === 'widget').id, id, `part ${part}`);
    assert.equal(r.toggle, true);
    const again = draw(doc(), fork(), { part, toggle: true });
    assert.equal(again.trace.drawOps.find(o => o.op === 'widget').id, PF_WIDGET_IDS.find(w => w.pressed === id).normal);
  }
  assert.equal(draw(doc(), fork(), { part: 7 }).drawn, false);
});

test('§5 rows 11–12 (§12): no widget and no stripe op when not hilited', () => {
  const { trace } = draw(doc({ hilited: false }));
  assert.equal(trace.drawOps.filter(o => o.op === 'widget' || o.op === 'stripes' || o.op === 'fillPattern' || o.op === 'slice').length, 0);
  assert.ok(trace.resolved.every(r => r.type !== 'ics#'));
});

test('§5.2 stripes: 13 rows from close.t, segments around the title with a 3 px gap; ppat then cicn', () => {
  const { trace } = draw(doc(), fork({ withStripePpat: true }));
  const segs = trace.drawOps.filter(o => o.op === 'stripes').map(o => o.dst);
  assert.deepEqual(segs, [rect(22, 45, 35, 110 - 3), rect(22, 150 + 3, 35, 199)]);
  const ops = trace.drawOps.filter(o => ['fillPattern', 'slice', 'sliceLines'].includes(o.op)).map(o => o.op);
  assert.equal(ops[0], 'fillPattern');
  assert.ok(ops.includes('slice'));
});

test('§5.2 (§12): a slimes-like fork (ppat -14331, no cicn -14331) emits a pattern fill and no cicn op', () => {
  const { trace } = draw(doc(), fork({ withStripeCicn: false, withStripePpat: true }));
  assert.ok(trace.drawOps.some(o => o.op === 'fillPattern' && o.row === '§5.2.ppat'));
  assert.ok(!trace.drawOps.some(o => o.op === 'slice' || o.op === 'sliceLines'));
});

test('§5.2 minimum: a segment 7 px wide or less is skipped', () => {
  // Title width chosen so the left segment is exactly 7 px.
  const g = proceduralFrameGeometry(fork(), doc());
  const w = 212 - 2 * (g.L + 7 + 3 - 24);
  const { trace } = draw(doc({ titleWidth: w }));
  const skipped = trace.drawOps.filter(o => o.op === 'stripes' && o.drawn === false);
  assert.equal(skipped.length, 2);
});

test('§4 document frame: bottom band P(6, 15 − i), side bands P(i, 6) / P(15 − i, 6), shadow P(0, 0); joined title', () => {
  const p = port();
  drawProceduralFrame(p, fork(), doc());
  const at = (x, y) => [...p.data.subarray((y * p.width + x) * 4, (y * p.width + x) * 4 + 3)];
  assert.deepEqual(at(100, 120 + 5), [6 * 16, 15 * 16, 1]); // row C.b + 5 − 0
  assert.deepEqual(at(100, 120), [6 * 16, 10 * 16, 1]); // i = 5
  assert.deepEqual(at(24, 60), [0, 6 * 16, 1]); // column L
  assert.deepEqual(at(235, 60), [15 * 16, 6 * 16, 1]); // column C.r + 5
  assert.deepEqual(at(236, 60), [0, 0, 1]); // shadow column R
  assert.deepEqual(at(26, 126), [0, 0, 1]); // shadow row B from L + 2
  assert.equal(p.data[(126 * p.width + 25) * 4 + 3], 0, 'shadow row starts at L + 2');
  assert.deepEqual(at(24, 18), [0, 0, 1]); // title top-left corner F(0, 0)
  assert.deepEqual(at(28, 38), [4 * 16, 4 * 16, 1]); // joined piece F rows 3–5, cols 4–5 at (T.l + 4, T.b − 3); row T.b − 3 is under the close icon
  assert.deepEqual(at(130, 25), [6 * 16, 3 * 16, 1]); // interior in the fill colour (the title gap between the stripe segments)
  // Grow box (§4 row 7) over the corner.
  assert.deepEqual(at(216, 106), [9, 9, 9]);
});

test('§4 collapsed: edges and grow box skipped, title in box mode, structure is the title bar', () => {
  const input = doc({ collapsed: true, content: rect(40, 30, 40, 230) });
  const { trace, geometry: g } = draw(input);
  assert.deepEqual(g.structureBox, rect(18, 24, 40, 236));
  assert.deepEqual(g.content, rect(0, 0, 0, 0));
  assert.ok(trace.drawOps.some(o => o.row === '§4.collapsed'));
  assert.ok(trace.drawOps.some(o => o.op === 'titleMode' && o.mode === 'box'));
  assert.ok(!trace.drawOps.some(o => o.row === '§4.1' || o.row === '§4.3'));
});

test('§3.5 alert colouring: dBox with the actb colour table is alert; default table compares entry 0', () => {
  const dlg = (o) => proceduralFrameGeometry(fork(o?.fork), { content: C, variation: 1, hilited: true, goAway: false, shadeOn: true, ...o });
  assert.equal(dlg({ colorTable: 'actb' }).alert, true);
  assert.equal(dlg({ colorTable: 'default' }).alert, false);
  assert.equal(dlg({ colorTable: 'default', fork: { actb0: [0xffff, 0xffff, 0xffff] } }).alert, true, 'entry 0 white = the default content colour');
  assert.equal(dlg({ colorTable: 'actb', variation: 1 | 16 }).alertRow, '§3.5.AL1', 'thin: the alert bit decides');
  assert.equal(proceduralFrameGeometry(fork(), doc({ colorTable: 'actb' })).alert, false, 'document kind: never alert');
});

test('§5A dialog ring: corners from D rows 5–7 / 8–10, edges P_D(5 + i, 7) …, gap = window colour table entry 0', () => {
  const p = port();
  const input = { content: C, variation: 1, hilited: true, goAway: false, shadeOn: true, colorTable: 'actb' };
  const { geometry: g } = drawProceduralFrame(p, fork(), input);
  assert.deepEqual(g.structureBox, rect(34, 24, 126, 236));
  const at = (x, y) => [...p.data.subarray((y * p.width + x) * 4, (y * p.width + x) * 4 + 3)];
  const tag = 100 + (-14322 & 0xff); // alert, hilited
  assert.deepEqual(at(24, 34), [5 * 16, 5 * 16, tag]); // TL corner = D(5, 5)
  assert.deepEqual(at(25, 60), [6 * 16, 7 * 16, tag]); // left column i = 1: P_D(6, 7)
  assert.deepEqual(at(235, 60), [10 * 16, 8 * 16, tag]); // right column i = 0: P_D(10, 8)
  assert.deepEqual(at(100, 35), [7 * 16, 6 * 16, tag]); // top row i = 1: P_D(7, 6)
  assert.deepEqual(at(28, 60), [0xde, 0xde, 0xde]); // gap: actb entry 0
  assert.deepEqual(at(236, 60), [0, 0, tag]); // shadow P_D(0, 0)
});

test('§5A movable modal (kind 5): title in box mode above the ring, no collapse, stripes -14325', () => {
  const { trace, geometry: g } = draw({ content: C, variation: 5, hilited: true, goAway: true, shadeOn: true, titleWidth: 40 });
  assert.deepEqual(g.T, rect(40 - 5 - 22, 24, 35, 236));
  assert.equal(g.shown.collapse, false);
  assert.ok(trace.drawOps.some(o => o.op === 'titleMode' && o.mode === 'box'));
  assert.ok(trace.resolved.some(r => r.type === 'cicn' && r.id === -14325));
});

test('§6.3 hit test: grow 3 / 1, content 1, close 4, zoom 6, collapse 9, frame 2, outside 0', () => {
  const chain = fork();
  const g = proceduralFrameGeometry(chain, doc());
  const hit = (x, y, gg = g) => proceduralFramePartAt(gg, chain, { x, y }).part;
  assert.equal(hit(0, 0), 0);
  assert.equal(hit(225, 115), 3);
  assert.equal(hit(100, 80), 1);
  assert.equal(hit(30, 25), 4);
  assert.equal(hit(205, 25), 6);
  assert.equal(hit(225, 25), 9);
  assert.equal(hit(100, 20), 2);
  assert.equal(hit(26, 80), 2);
  const inactive = proceduralFrameGeometry(chain, doc({ hilited: false }));
  assert.equal(hit(30, 25, inactive), 2, 'widgets hit only when hilited');
  assert.equal(hit(225, 115, inactive), 1);
});

test('§3.1 features and §3.4 regions', () => {
  assert.equal(proceduralFrameFeatures(doc()), 1 | 2 | 4 | 16 | 64 | 0x0f80);
  assert.equal(proceduralFrameFeatures({ content: C, variation: 5, hilited: true, goAway: false, shadeOn: true }), 8 | 16 | 64 | 0x0f80);
  const g = proceduralFrameGeometry(fork(), doc());
  assert.deepEqual(proceduralFrameRegion(g, 6).rect, g.grow);
  assert.deepEqual(proceduralFrameRegion(g, 1).rect, rect(20, g.titleText.left, 38, g.titleText.right));
  assert.equal(proceduralFrameRegion(g, 4), null);
});

test('loader needs: every frame and grow cicn is an icon-blit cicn; resource ids cover widgets and actb', () => {
  const blit = new Set(engineIconBlitCicnIds());
  for (const id of [-14336, -14332, -14328, -14326, -14324, -14322, -14330, -14334]) assert.ok(blit.has(id), String(id));
  const ids = proceduralFrameResourceIds();
  assert.ok(ids.some(r => r.type === 'ics8' && r.id === -14331));
  assert.ok(ids.some(r => r.type === 'actb' && r.id === -14336));
});

test('§12 corpus: each no-wnd# bundle, both states, samples equal P(6, 3) / P(7, 3) / P(9, 3) of its own frame cicn', async () => {
  const cases = await import('../../../tests/engine-diff/cases.mjs');
  let discriminating = 0;
  for (const slug of ['apple-platinum-2', 'black-platinum', 'platinum-8', 'slimes', 'system7-nostalgia-silver']) {
    const decoded = await cases.decode(slug);
    const chain = cases.__frameChain(E, slug, decoded);
    for (const hilited of [true, false]) {
      const t = createTrace('proceduralFrame');
      drawProceduralFrame(port(), chain, doc({ hilited }), {}, t);
      const s = t.drawOps.find(o => o.op === 'sample');
      const cicn = chain.getResource('cicn', hilited ? -14332 : -14336).value;
      const P = (x, y) => { const pm = cicn.unmasked ?? cicn.pixmap; const i = (y * pm.width + x) * 4; return [pm.data[i], pm.data[i + 1], pm.data[i + 2]]; };
      assert.deepEqual([s.fill.r, s.fill.g, s.fill.b], P(6, 3), `${slug} ${hilited}`);
      assert.deepEqual([s.text.r, s.text.g, s.text.b], P(7, 3));
      assert.deepEqual([s.shadow.r, s.shadow.g, s.shadow.b], P(9, 3));
      if (String(P(6, 3)) !== String(P(6, 4))) discriminating++;
    }
  }
  assert.ok(discriminating >= 5, `sampling row 4 instead of row 3 changes the fill in ${discriminating} of 10 cells`);
});
