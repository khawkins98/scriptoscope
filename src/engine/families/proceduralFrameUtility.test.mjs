// Built-in window frame driver, round 2: the utility family (procedural-frame
// §9, rows UI/UG/UP/UFA/UFC/UFH/UFS/UFT/US/UW/UT/UGB/UM/UH) and the #412
// corrections (GB1/GB3 masked grow box, TG1–TG4 toggle, WP1–WP4 drops, CT1–CT4
// colour-table lookup, SH2, HT2, M6L1–M6L6). Synthetic forks only: every frame
// cicn pixel (x, y) has colour (x·16, y·16, tag), so each sample point is
// identifiable. Each test names the rows it pins.
import '../../../tests/helpers/registerTs.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
const E = await import('../index.ts');
const {
  ResourceChain, mapProvider, createTrace, rect,
  drawProceduralFrame, drawProceduralFrameGrowIcon, proceduralFrameGeometry, proceduralFramePartAt, colorTableEntry,
  PF_WIDGET_IDS, PF_UTILITY_WIDGET_IDS,
} = E;

const gridIcon = (w, h, tag, alpha = () => 255) => {
  const data = new Uint8ClampedArray(w * h * 4), un = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    data.set([x * 16, y * 16, tag, alpha(x, y)], (y * w + x) * 4);
    un.set([x * 16, y * 16, tag, 255], (y * w + x) * 4);
  }
  return { pixmap: { width: w, height: h, data }, pixelSize: 8, unmasked: { width: w, height: h, data: un } };
};
const solid = (w, h, rgba) => { const d = new Uint8ClampedArray(w * h * 4); for (let i = 0; i < w * h; i++) d.set(rgba, i * 4); return { width: w, height: h, data: d }; };
const planes = () => [...new Array(32).fill(0), ...new Array(32).fill(0xff)];
/** A stripes cicn whose column x has red 200 + x and row y green 100 + y. */
const stripes = (w = 9, h = 9) => {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) d.set([200 + x, 100 + y, 50, 255], (y * w + x) * 4);
  const pm = { width: w, height: h, data: d };
  return { pixmap: pm, pixelSize: 8, unmasked: pm };
};

const TAG = { '-14316': 1, '-14320': 2, '-14315': 3, '-14319': 4 };
function ufork({ frame = ['-14316', '-14320', '-14315', '-14319'], sideStripes = false, stripesCicn = true, growSmall = false, grow = 16,
  shadowEqualsFill = false, docGrowHole = false, actb = null } = {}) {
  const e = [];
  for (const id of frame) {
    const icon = gridIcon(12, 12, TAG[id]);
    if (shadowEqualsFill) for (const pm of [icon.pixmap, icon.unmasked]) pm.data.set(pm.data.subarray((3 * 12 + 4) * 4, (3 * 12 + 4) * 4 + 3), (3 * 12 + 7) * 4);
    e.push([`cicn:${id}`, icon]);
  }
  if (stripesCicn) e.push(['cicn:-14314', stripes()]);
  if (sideStripes) e.push(['cicn:-14318', { ...stripes(), pixmap: solid(9, 9, [7, 7, 7, 255]), unmasked: solid(9, 9, [7, 7, 7, 255]) }]);
  // Utility grow -14313 / -14317: pixel (x, y) = (x, y, 99 / 98), transparent at (5, 5).
  for (const [id, tag] of [[-14313, 99], [-14317, 98]]) {
    const d = new Uint8ClampedArray(grow * grow * 4);
    for (let y = 0; y < grow; y++) for (let x = 0; x < grow; x++) d.set([x, y, tag, x === 5 && y === 5 ? 0 : 255], (y * grow + x) * 4);
    e.push([`cicn:${id}`, { pixmap: { width: grow, height: grow, data: d }, pixelSize: 8, unmasked: null }]);
  }
  if (growSmall) e.push(['cicn:-14285', { pixmap: solid(12, 12, [77, 77, 77, 255]), pixelSize: 8, unmasked: null }]);
  for (const r of [...PF_UTILITY_WIDGET_IDS, ...PF_WIDGET_IDS]) for (const id of [r.normal, r.pressed])
    e.push([`ics#:${id}`, { planes: planes() }], [`ics8:${id}`, solid(16, 16, [id & 0xff, 1, 1, 255])]);
  // Document art for the #412 corrections.
  for (const id of [-14336, -14332]) e.push([`cicn:${id}`, gridIcon(16, 16, id === -14332 ? 11 : 12)]);
  for (const id of [-14330, -14334]) {
    const pm = solid(17, 17, [9, 9, 9, 255]);
    if (docGrowHole) pm.data[(3 * 17 + 3) * 4 + 3] = 0;
    e.push([`cicn:${id}`, { pixmap: pm, pixelSize: 8, unmasked: solid(17, 17, [9, 9, 9, 255]) }]);
  }
  if (actb) e.push(['actb:-14336', { entries: actb }]);
  return new ResourceChain([mapProvider('fork', 'archive', e)]);
}

const C = rect(60, 40, 140, 200); // 160 × 80
const util = (o = {}) => ({ content: C, family: 'utility', variation: 1, hilited: true, goAway: true, shadeOn: true, titleWidth: 0, ...o });
const port = () => solid(300, 220, [0, 0, 0, 0]);
const at = (p, x, y) => [...p.data.subarray((y * p.width + x) * 4, (y * p.width + x) * 4 + 4)];
const rgb = (p, x, y) => at(p, x, y).slice(0, 3);
const P = (x, y, tag) => [x * 16, y * 16, tag];
function draw(input, chain = ufork(), opts = {}) {
  const p = port(), t = createTrace('proceduralFrame');
  const r = drawProceduralFrame(p, chain, input, opts, t);
  return { ...r, port: p, trace: t, g: r.geometry };
}
const F = g => ({ Fl: g.bounds.left, Ft: g.bounds.top, Fr: g.bounds.right - 1, Fb: g.bounds.bottom - 1 });

// ── §9.1 inputs, §9.2 geometry ───────────────────────────────────────────────

test('UI1 / UI6: variation bit 0 clear draws active whatever hilited; set + not hilited draws inactive', () => {
  assert.equal(proceduralFrameGeometry(null, util({ variation: 0, hilited: false })).state.drawnActive, true);
  assert.equal(proceduralFrameGeometry(null, util({ variation: 1, hilited: false })).state.drawnActive, false);
  const { trace } = draw(util({ variation: 1, hilited: false }));
  assert.ok(!trace.drawOps.some(o => o.op === 'widget' || o.op === 'stripes'), 'inactive: no widgets, no stripes');
});

test('UI2–UI5: grow bit 1, zoom bit 2, side bit 3, smallGrow bit 4', () => {
  const st = v => proceduralFrameGeometry(null, util({ variation: v })).state;
  assert.deepEqual([st(2).grow, st(4).zoom, st(8).side, st(16).smallGrow], [true, true, true, true]);
  assert.deepEqual([st(1).grow, st(1).zoom, st(1).side, st(1).smallGrow], [false, false, false, false]);
});

test('UI10 / UG1 / UG2: H 15 titled, 13 untitled or side; T and the structure share the outer edge; 1-px shadow', () => {
  const g15 = proceduralFrameGeometry(null, util({ titleWidth: 30 }));
  assert.equal(g15.H, 15);
  assert.deepEqual(g15.T, rect(60 - 16, 36, 60, 204));
  assert.deepEqual(g15.structureBox, rect(44, 36, 144, 204));
  assert.deepEqual(g15.bounds, rect(44, 36, 145, 205));
  const g13 = proceduralFrameGeometry(null, util());
  assert.equal(g13.H, 13);
  assert.deepEqual(g13.T, rect(46, 36, 60, 204));
  const side = proceduralFrameGeometry(null, util({ variation: 9, titleWidth: 30 }));
  assert.equal(side.H, 13);
  assert.deepEqual(side.T, rect(56, 40 - 14, 144, 40));
  assert.deepEqual(side.structureBox, rect(56, 26, 144, 204));
});

test('UG3: collapsed structure is T plus the shadow; content a degenerate rect at C\'s edge', () => {
  const g = proceduralFrameGeometry(null, util({ collapsed: true, content: rect(60, 40, 60, 200) }));
  assert.deepEqual(g.structureBox, g.T);
  assert.deepEqual(g.bounds, rect(g.T.top, g.T.left, g.T.bottom + 1, g.T.right + 1));
  assert.deepEqual(g.content, rect(60, 40, 60, 200));
  const s = proceduralFrameGeometry(null, util({ variation: 9, collapsed: true, content: rect(60, 40, 140, 40) }));
  assert.deepEqual(s.content, rect(60, 40, 140, 40));
});

test('UG5 (§12): a 15-px bar puts close at (T.l + 2, T.t + 3), a 13-px bar at (T.l + 2, T.t + 2); 10 × 10', () => {
  const g15 = proceduralFrameGeometry(null, util({ titleWidth: 30 }));
  assert.deepEqual(g15.widgets.close, rect(g15.T.top + 3, g15.T.left + 2, g15.T.top + 13, g15.T.left + 12));
  const g13 = proceduralFrameGeometry(null, util());
  assert.deepEqual(g13.widgets.close, rect(g13.T.top + 2, g13.T.left + 2, g13.T.top + 12, g13.T.left + 12));
  const side = proceduralFrameGeometry(null, util({ variation: 9 }));
  assert.deepEqual(side.widgets.close, rect(side.T.top + 2, side.T.left + 2, side.T.top + 12, side.T.left + 12));
});

test('UG6 / UG7: collapse at T.r − 12; zoom 11 further toward the start while shadeOn (side: T.b − 12, upward)', () => {
  const g = proceduralFrameGeometry(null, util({ variation: 5 }));
  assert.equal(g.widgets.collapse.left, g.T.right - 12);
  assert.equal(g.widgets.zoom.left, g.T.right - 12 - 11);
  assert.equal(proceduralFrameGeometry(null, util({ variation: 5, shadeOn: false })).widgets.zoom.left, g.T.right - 12);
  const s = proceduralFrameGeometry(null, util({ variation: 13 }));
  assert.equal(s.widgets.collapse.top, s.T.bottom - 12);
  assert.equal(s.widgets.zoom.top, s.T.bottom - 23);
});

test('UG8 / UG9: Lu = close.r + 2 or T.l + 5; Ru = zoom.l − 2, else collapse.l − 2, else T.r − 5', () => {
  const g = proceduralFrameGeometry(null, util({ variation: 5 }));
  assert.equal(g.L, g.widgets.close.right + 2);
  assert.equal(g.R, g.widgets.zoom.left - 2);
  assert.equal(proceduralFrameGeometry(null, util()).R, g.widgets.collapse.left - 2);
  const bare = proceduralFrameGeometry(null, util({ goAway: false, shadeOn: false }));
  assert.deepEqual([bare.L, bare.R], [bare.T.left + 5, bare.T.right - 5]);
  const side = proceduralFrameGeometry(null, util({ variation: 9 }));
  assert.deepEqual([side.L, side.R], [side.widgets.close.bottom + 2, side.widgets.collapse.top - 2]);
});

test('UG10 / UG4: grow 16 × 16 at (C.r − 14, C.b − 14), small 12 × 12; only the small one leaves the content', () => {
  const g = proceduralFrameGeometry(null, util({ variation: 3 }));
  assert.deepEqual(g.grow, rect(126, 186, 142, 202));
  assert.equal(g.contentMinus, null);
  const s = proceduralFrameGeometry(null, util({ variation: 19 }));
  assert.deepEqual(s.grow, rect(130, 190, 142, 202));
  assert.deepEqual(s.contentMinus, s.grow);
});

// ── §9.3 presence and drops ──────────────────────────────────────────────────

const narrowT = (tw, o) => proceduralFrameGeometry(null, util({ content: rect(60, 40, 140, 40 + tw - 8), ...o }));

test('UP1 (§12): goAway + zoom drop with a 7-px outset; the recomputed zoom box is not outset', () => {
  // z⁺ ∩ c⁺ is non-empty below T.w = 49 (with no outset it would be 35).
  assert.deepEqual(narrowT(49, { variation: 5 }).shown, { close: true, zoom: true, collapse: true });
  assert.deepEqual(narrowT(40, { variation: 5 }).shown, { close: true, zoom: true, collapse: false });
  assert.equal(narrowT(40, { variation: 5 }).widgets.zoom.left, narrowT(40, { variation: 5 }).T.right - 12, 'zoom recomputed with no shift');
  // The recomputed zoom box meets c⁺ below T.w = 31 (outset on the zoom box too: 45).
  assert.equal(narrowT(31, { variation: 5 }).shown.zoom, true);
  assert.equal(narrowT(30, { variation: 5 }).shown.zoom, false);
  assert.ok(narrowT(40, { variation: 5 }).rows.includes('UP1:dropped'));
});

test('UP2 / UP3 / UP4: collapse dropped against c⁺; zoom never dropped without goAway; nothing without either', () => {
  assert.equal(narrowT(38, {}).shown.collapse, true);
  assert.equal(narrowT(37, {}).shown.collapse, false, 'UP2');
  const up3 = narrowT(20, { variation: 5, goAway: false });
  assert.deepEqual([up3.shown.zoom, up3.shown.collapse], [true, false], 'UP3');
  const up4 = narrowT(20, { goAway: false });
  assert.equal(up4.shown.collapse, true, 'UP4');
});

// ── §9.4 frame ───────────────────────────────────────────────────────────────

test('UFH1–UFH12 (§12): horizontal frame rows sample P(4, i), P(4, 11 − i), P(i, 6), P(11 − i, 6), P(4, 5 − i); interior', () => {
  for (const [hilited, tag] of [[true, 1], [false, 2]]) {
    const { port: p, g } = draw(util({ hilited, goAway: false, shadeOn: false }));
    const { Fl, Ft, Fr, Fb } = F(g);
    assert.deepEqual(rgb(p, Fl, Ft), P(0, 0, tag), 'UFH1');
    assert.deepEqual(rgb(p, Fr - 1, Ft + 1), P(11, 1, tag), 'UFH2 (row 2 is under UFH10)');
    assert.deepEqual(rgb(p, Fl + 3, Fb - 1), P(3, 11, tag), 'UFH3');
    assert.deepEqual(rgb(p, Fr - 1, Fb - 1), P(11, 11, tag), 'UFH4');
    assert.deepEqual(rgb(p, C.left - 1, C.top - 3), P(3, 3, tag), 'UFH5');
    assert.deepEqual(rgb(p, C.right, C.top - 1), P(8, 5, tag), 'UFH6');
    for (let i = 0; i < 3; i++) assert.deepEqual(rgb(p, 100, Ft + i), P(4, i, tag), `UFH7 i=${i}`);
    for (let i = 0; i < 4; i++) assert.deepEqual(rgb(p, 100, Fb - 1 - i), P(4, 11 - i, tag), `UFH8 i=${i}`);
    for (let i = 0; i < 4; i++) assert.deepEqual(rgb(p, Fl + i, 100), P(i, 6, tag), `UFH9 i=${i}`);
    for (let i = 0; i < 4; i++) assert.deepEqual(rgb(p, Fr - 1 - i, 100), P(11 - i, 6, tag), `UFH10 i=${i}`);
    for (let i = 0; i < 3; i++) assert.deepEqual(rgb(p, 100, C.top - 1 - i), P(4, 5 - i, tag), `UFH11 i=${i}`);
    // UFH9 i = 2 starts at C.t, so the bar beside column Fl + 2 is interior (fill P(4, 3)).
    assert.deepEqual(rgb(p, Fl + 2, Ft + 5), P(4, 3, tag), 'UFH9 i=2 starts at C.t');
    // UFH12 interior (Fl + 2, Ft + 3, Fr − 2, C.t − 3) painted in the fill colour, nothing else.
    assert.deepEqual(rgb(p, Fl + 2, Ft + 3), P(4, 3, tag));
    assert.deepEqual(rgb(p, Fr - 3, C.top - 4), P(4, 3, tag));
    assert.deepEqual(rgb(p, Fr - 2, Ft + 5), P(10, 6, tag), 'right of the interior is UFH10 i = 1');
    assert.equal(at(p, 100, 100)[3], 0, 'content untouched');
  }
});

test('UFS1–UFS12: side frame rows sample P(i, 4), P(11 − i, 4), P(6, i), P(6, 11 − i), P(5 − i, 4); interior', () => {
  for (const [hilited, tag] of [[true, 3], [false, 4]]) {
    const { port: p, g } = draw(util({ variation: 9, hilited, goAway: false, shadeOn: false }), ufork({ stripesCicn: false }));
    const { Fl, Ft, Fr, Fb } = F(g);
    assert.deepEqual(rgb(p, Fl + 1, Fb - 1), P(1, 11, tag), 'UFS2 (column 2 is under UFS10)');
    assert.deepEqual(rgb(p, Fr - 4, Ft + 3), P(8, 3, tag), 'UFS3');
    assert.deepEqual(rgb(p, C.left - 3, C.top - 2), P(3, 2, tag), 'UFS5');
    assert.deepEqual(rgb(p, C.left - 1, C.bottom + 1), P(5, 9, tag), 'UFS6');
    for (let i = 0; i < 3; i++) assert.deepEqual(rgb(p, Fl + i, 100), P(i, 4, tag), `UFS7 i=${i}`);
    for (let i = 0; i < 4; i++) assert.deepEqual(rgb(p, Fr - 1 - i, 100), P(11 - i, 4, tag), `UFS8 i=${i}`);
    for (let i = 0; i < 4; i++) assert.deepEqual(rgb(p, 120, Ft + i), P(6, i, tag), `UFS9 i=${i}`);
    for (let i = 0; i < 4; i++) assert.deepEqual(rgb(p, 120, Fb - 1 - i), P(6, 11 - i, tag), `UFS10 i=${i}`);
    for (let i = 0; i < 3; i++) assert.deepEqual(rgb(p, C.left - 1 - i, 100), P(5 - i, 4, tag), `UFS11 i=${i}`);
    assert.deepEqual(rgb(p, Fl + 5, Ft + 2), P(3, 4, tag), 'UFS9 i=2 starts at C.l: the bar is interior (fill P(3, 4))');
    assert.deepEqual(rgb(p, Fl + 3, Fb - 3), P(3, 4, tag), 'UFS12 interior');
  }
});

test('UFC1–UFC6 (§12): a collapsed utility window has 2 × 2 corners and a 2-px box', () => {
  const { port: p, g } = draw(util({ collapsed: true, content: rect(60, 40, 60, 200), goAway: false, shadeOn: false }));
  const { Fl, Ft, Fr, Fb } = F(g);
  assert.deepEqual(rgb(p, Fl + 1, Ft + 1), P(1, 1, 1), 'UFC1 TL');
  assert.deepEqual(rgb(p, Fr - 1, Fb - 1), P(11, 11, 1), 'UFC1 BR');
  assert.deepEqual(rgb(p, Fr - 2, Ft), P(10, 0, 1), 'UFC1 TR');
  for (let i = 0; i < 2; i++) {
    assert.deepEqual(rgb(p, Fl + i, Ft + 5), P(i, 6, 1), 'UFC2');
    assert.deepEqual(rgb(p, Fr - 1 - i, Ft + 5), P(11 - i, 6, 1), 'UFC3');
    assert.deepEqual(rgb(p, 100, Ft + i), P(6, i, 1), 'UFC4');
    assert.deepEqual(rgb(p, 100, Fb - 1 - i), P(6, 11 - i, 1), 'UFC5');
  }
  assert.deepEqual(rgb(p, Fl + 2, Ft + 2), P(4, 3, 1), 'UFC6 interior is fill');
  assert.deepEqual(rgb(p, Fl + 2, Fb - 2), P(6, 10, 1), 'UFC5 i=1 below the interior');
});

test('UFT1 (§12): fill P(4, 3), text P(5, 3), shadow P(7, 3); side P(3, 4) / P(3, 5) / P(3, 7)', () => {
  const s = draw(util()).trace.drawOps.find(o => o.op === 'sample');
  assert.deepEqual([s.fill, s.text, s.shadow].map(c => [c.r, c.g, c.b]), [P(4, 3, 1), P(5, 3, 1), P(7, 3, 1)]);
  const t = draw(util({ variation: 9 })).trace.drawOps.find(o => o.op === 'sample');
  assert.deepEqual([t.fill, t.text, t.shadow].map(c => [c.r, c.g, c.b]), [P(3, 4, 3), P(3, 5, 3), P(3, 7, 3)]);
});

test('UFT3: shadow P(0, 0) along row Fb from Fl + 2 to Fr and column Fr up to Ft + 2', () => {
  const { port: p, g } = draw(util());
  const { Fl, Ft, Fr, Fb } = F(g);
  assert.deepEqual(rgb(p, Fl + 2, Fb), P(0, 0, 1));
  assert.equal(at(p, Fl + 1, Fb)[3], 0);
  assert.deepEqual(rgb(p, Fr, Fb - 5), P(0, 0, 1));
  assert.equal(at(p, Fr, Ft + 1)[3], 0);
  const col = draw(util()).trace.drawOps.filter(o => o.row === 'UFT3')[1];
  assert.deepEqual([col.from, col.to], [{ x: Fr, y: Fb }, { x: Fr, y: Ft + 2 }]);
});

test('UFT2 / §9.8: the small grow box is part of the frame; the normal one is drawn only by message 6 (UM4)', () => {
  assert.ok(draw(util({ variation: 19 })).trace.drawOps.some(o => o.row?.startsWith('UGB2')));
  const normal = draw(util({ variation: 3 }));
  assert.ok(!normal.trace.drawOps.some(o => o.row?.startsWith('UGB')));
  const t = createTrace('proceduralFrame'), p = port();
  drawProceduralFrameGrowIcon(p, ufork(), util({ variation: 3 }), t);
  assert.deepEqual(rgb(p, 186 + 2, 126 + 3), [2, 3, 99], 'UGB2 whole cicn at the grow rect');
  assert.ok(!t.drawOps.some(o => o.op === 'line'), 'UM4: no lines');
  const none = createTrace('proceduralFrame');
  drawProceduralFrameGrowIcon(port(), ufork(), util({ variation: 3, collapsed: true }), none);
  assert.ok(none.drawOps.some(o => o.row === 'UM4' && o.op === 'skip'));
});

test('UFA2 / UFA3: inactive art absent → active art; no art → no frame, no samples, no fill', () => {
  const fb = draw(util({ hilited: false }), ufork({ frame: ['-14316'] }));
  assert.ok(fb.trace.resolved.some(r => r.id === -14316 && r.found && r.row === 'UFA2'));
  const none = draw(util(), ufork({ frame: [] }));
  assert.ok(none.trace.drawOps.some(o => o.row === 'UFA3'));
  assert.ok(!none.trace.drawOps.some(o => o.op === 'sample' || o.op === 'line'));
  assert.ok(none.trace.drawOps.some(o => o.op === 'paintRgn' && o.unspecified));
});

// ── §9.5 stripes ─────────────────────────────────────────────────────────────

test('US1 / US5 (§12): 9-row band from T.t + trunc((t − 8) / 2), Lu .. Ru; the cicn tiled 1:1, never stretched', () => {
  const { port: p, g, trace } = draw(util({ titleWidth: 0, goAway: false }));
  const band = trace.drawOps.find(o => o.op === 'stripes').dst;
  assert.deepEqual(band, rect(g.T.top + 3, g.L, g.T.top + 12, g.R));
  for (const dx of [0, 3, 9, 12, 20]) assert.deepEqual(rgb(p, band.left + dx, band.top + 2), [200 + (dx % 9), 102, 50], `column ${dx}`);
});

test('US2: the band is clipped to the interior (13-px bar: its last row is the separator)', () => {
  const { port: p, g } = draw(util({ goAway: false }));
  assert.deepEqual(rgb(p, g.L + 2, g.T.top + 10), [202, 107, 50]);
  assert.deepEqual(rgb(p, g.L + 2, g.T.top + 11), P(4, 3, 1), 'row C.t − 3 is UFH11 i = 2, not stripe');
});

test('US3: side prefers -14318, else -14314; absent → nothing drawn but the band leaves the interior (US6)', () => {
  const s = draw(util({ variation: 9 }), ufork({ sideStripes: true }));
  assert.ok(s.trace.resolved.some(r => r.id === -14318 && r.found));
  const band = s.trace.drawOps.find(o => o.op === 'stripes').dst;
  assert.deepEqual(rgb(s.port, band.left + 2, band.top + 4), [7, 7, 7]);
  const s2 = draw(util({ variation: 9 }));
  assert.ok(s2.trace.resolved.some(r => r.id === -14314 && r.found));
  const none = draw(util({ goAway: false }), ufork({ stripesCicn: false }));
  const b = none.trace.drawOps.find(o => o.op === 'stripes').dst;
  assert.equal(at(none.port, b.left + 3, b.top + 3)[3], 0, 'band not filled');
  assert.ok(none.trace.drawOps.some(o => o.row === 'US6'));
});

test('US4: a band narrower than 4 px along its length is painted with the fill colour', () => {
  // No goAway, no zoom (UP4): Lu = T.l + 5, Ru = collapse.l − 2 = T.r − 14; T.w = 22 gives a 3-px band.
  const input = util({ goAway: false, content: rect(60, 40, 140, 54) });
  const g = proceduralFrameGeometry(null, input);
  assert.equal(g.R - g.L, 3);
  const { port: p, trace } = draw(input);
  assert.ok(trace.drawOps.some(o => o.op === 'paintRect' && o.row.startsWith('US4')));
  assert.deepEqual(rgb(p, g.L + 1, g.T.top + 5), P(4, 3, 1));
});

// ── §9.6 paint order, title ──────────────────────────────────────────────────

test('UW4 / UW5 (§12): the fill does not cover the widget boxes; glyph pixels outside the box are painted over', () => {
  const { port: p, g } = draw(util());
  const b = g.widgets.close;
  assert.deepEqual(rgb(p, b.left + 9, b.top + 1), [-14320 & 0xff, 1, 1], 'inside the 10 × 10 box: glyph');
  assert.deepEqual(rgb(p, b.left + 10, b.top + 1), P(4, 3, 1), 'glyph column 10 is interior: fill');
  const inactive = draw(util({ hilited: false, titleWidth: 30 }));
  assert.deepEqual(rgb(inactive.port, b.left + 1, b.top + 1), P(4, 3, 2), 'inactive: interior is fill');
  assert.ok(inactive.trace.drawOps.some(o => o.op === 'erase' && o.row.startsWith('UT5')));
});

test('UT1: centred in T; crossing Lu or Ru re-measures condensed and clamps to Lu', () => {
  const g = proceduralFrameGeometry(null, util({ titleWidth: 40 }));
  assert.deepEqual(g.titleText, rect(g.T.top + 3, g.T.left + Math.trunc((168 - 40) / 2), g.T.bottom - 3, g.T.left + 64 + 40));
  const wide = proceduralFrameGeometry(null, util({ titleWidth: 160, titleWidthCondensed: 150 }));
  assert.equal(wide.utility.condensed, true);
  assert.equal(wide.titleText.left, Math.max(wide.T.left + Math.trunc((168 - 150) / 2), wide.L));
  assert.equal(wide.titleText.right - wide.titleText.left, 150);
  assert.deepEqual(proceduralFrameGeometry(null, util({ variation: 9, titleWidth: 40 })).titleText, rect(0, 0, 0, 0), 'side: empty');
});

test('UT2–UT8: skip, condensed truncation, clip, erase, pen, shadow vs fill, main pass', () => {
  const passes = [];
  const font = { ascent: 9, descent: 2 };
  const { g, trace } = draw(util({ titleWidth: 40, font }), ufork(), { renderTitle: (_p, pass) => passes.push(pass) });
  const r = rect(g.titleText.top, g.titleText.left, g.titleText.bottom + 1, g.titleText.right);
  assert.deepEqual(passes.map(x => x.pass), ['shadow', 'main']);
  const [sh, main] = passes;
  assert.equal(main.x, r.left, 'UT6 x = r.l (no +3)');
  assert.equal(main.y, r.top + Math.trunc((r.bottom - r.top - 1 - 11) / 2) + 9, 'UT6 y');
  assert.deepEqual([sh.x - main.x, sh.y - main.y], [1, 1], 'UT7');
  assert.deepEqual(main.clip, rect(r.top, g.L, r.bottom, g.R), 'UT4');
  assert.deepEqual([main.background.r, main.background.g], [64, 48], 'UT8 background = fill');
  const erase = trace.drawOps.find(o => o.op === 'erase');
  assert.deepEqual(erase.dst, rect(r.top, r.left - 2, r.bottom, r.right + 2), 'UT5 e = r widened by 2');
  // UT7: skipped when shadow = fill (not when shadow = text).
  const p2 = [];
  draw(util({ titleWidth: 40, font }), ufork({ shadowEqualsFill: true }), { renderTitle: (_p, pass) => p2.push(pass.pass) });
  assert.deepEqual(p2, ['main']);
  // UT3: bold wider than the (condensed) rect → condensed, truncated to Ru − r.l.
  const p3 = [];
  const n = draw(util({ titleWidth: 160, titleWidthCondensed: 150, font }), ufork(), { renderTitle: (_p, pass) => p3.push(pass) });
  assert.equal(p3[0].condensed, true);
  assert.equal(p3[0].truncateTo, n.g.R - n.g.titleText.left);
  // UT2: r.l + 2 > Ru → nothing.
  const q = draw(util({ titleWidth: 10, font, content: rect(60, 40, 140, 42), goAway: false, shadeOn: false }));
  if (q.g.titleText.left + 2 > q.g.R) assert.ok(q.trace.drawOps.some(o => o.row === 'UT2'));
  else assert.fail('fixture should trigger UT2');
});

// ── §9.7 grow, §9.8 messages, §9.9 hits ──────────────────────────────────────

test('UGB2 (§12): with smallGrow a 16 × 16 -14313 copies its top-left 11 × 11 unscaled; 17 × 17 gives 12 × 12; masked (GB3)', () => {
  const { port: p, g } = draw(util({ variation: 19 }));
  assert.deepEqual(rgb(p, g.grow.left + 10, g.grow.top + 10), [10, 10, 99], 'unscaled: offset 10 is source pixel 10');
  assert.equal(at(p, g.grow.left + 11, g.grow.top + 2)[3] === 0 || rgb(p, g.grow.left + 11, g.grow.top + 2)[2] !== 99, true, 'column 11 not copied');
  assert.notDeepEqual(rgb(p, g.grow.left + 5, g.grow.top + 5), [5, 5, 99], 'masked-off pixel keeps what is underneath');
  const big = draw(util({ variation: 19 }), ufork({ grow: 17 }));
  assert.deepEqual(rgb(big.port, big.g.grow.left + 11, big.g.grow.top + 11), [11, 11, 99]);
  const small = draw(util({ variation: 19 }), ufork({ growSmall: true }));
  assert.deepEqual(rgb(small.port, small.g.grow.left + 3, small.g.grow.top + 3), [77, 77, 77], 'UGB1: -14285 first');
});

test('UM1 / UM3: parts 4, 5/6, 9 draw one utility glyph in the toggled state, active or not', () => {
  for (const [part, id] of [[4, -14317], [5, -14315], [6, -14315], [9, -14316]]) {
    const r = draw(util({ variation: 5, hilited: false }), ufork(), { part });
    assert.equal(r.trace.drawOps.find(o => o.op === 'widget').id, id, `part ${part}`);
    assert.equal(r.toggle, true, 'flipped');
  }
});

test('UM2 / TG3: part 258 flips the bit in the document family only', () => {
  assert.equal(draw(util(), ufork(), { part: 258, toggle: false }).toggle, false);
  const doc = { content: C, variation: 8, hilited: true, goAway: true, shadeOn: true };
  assert.equal(draw(doc, ufork(), { part: 258, toggle: false }).toggle, true);
});

test('TG1 / TG2 (§12): a part-0 draw then two part-4 calls give pressed then normal, whatever the bit held', () => {
  for (const family of ['document', 'utility']) {
    const input = family === 'utility' ? util() : { content: C, variation: 8, hilited: true, goAway: true, shadeOn: true };
    const ids = family === 'utility' ? PF_UTILITY_WIDGET_IDS[0] : PF_WIDGET_IDS[0];
    const a = draw(input, ufork(), { part: 0, toggle: true });
    assert.equal(a.toggle, false, `${family}: part 0 clears`);
    const b = draw(input, ufork(), { part: 4, toggle: a.toggle });
    const c = draw(input, ufork(), { part: 4, toggle: b.toggle });
    assert.deepEqual([b, c].map(r => r.trace.drawOps.find(o => o.op === 'widget').id), [ids.pressed, ids.normal], family);
  }
  for (const part of [1, 3, -1]) assert.equal(draw(util(), ufork(), { part, toggle: true }).toggle, false, `part ${part} < 4 clears (signed)`);
  assert.equal(draw(util(), ufork(), { part: 7, toggle: true }).toggle, true, 'part 7 leaves it');
});

test('UH1–UH8: utility hits; UH4 (§12) the close box inset 1, its corner pixel is not 4', () => {
  const chain = ufork();
  const g = proceduralFrameGeometry(chain, util({ variation: 7, titleWidth: 30 }));
  const hit = (x, y, gg = g) => proceduralFramePartAt(gg, chain, { x, y });
  const c = g.widgets.close;
  assert.equal(hit(0, 0).part, 0);
  assert.deepEqual(hit(c.left + 4, c.top + 4), { part: 4, row: 'UH4' });
  assert.notEqual(hit(c.left, c.top).part, 4);
  assert.ok([1, 2].includes(hit(c.left, c.top).part));
  assert.equal(hit(g.widgets.zoom.left + 3, g.widgets.zoom.top + 3).part, 6, 'UH5');
  assert.equal(hit(g.widgets.collapse.left + 3, g.widgets.collapse.top + 3).part, 9, 'UH6');
  assert.equal(hit(100, 100).part, 1, 'UH3');
  assert.deepEqual(hit(g.grow.left + 2, g.grow.top + 2), { part: 3, row: 'UH2' });
  assert.equal(hit(g.bounds.right - 1, g.grow.top + 2).part, 3, 'UH2: the shadow column hits grow');
  assert.equal(hit(g.C.left - 2, 100).part, 2, 'UH7 frame band');
  assert.equal(hit(100, g.T.top + 1).part, 2, 'UH7 bar');
  const inactive = proceduralFrameGeometry(chain, util({ variation: 7, hilited: false }));
  assert.equal(hit(c.left + 4, c.top + 4, inactive).part, 2, 'widgets only when active');
  assert.equal(hit(g.grow.left + 2, g.grow.top + 2, inactive).part, 1, 'UH2 needs active');
});

// ── #412 corrections ─────────────────────────────────────────────────────────

test('GB1 / GB3 (§12): a grow cicn\'s transparent mask pixel leaves the frame pixel underneath', () => {
  const doc = { content: C, variation: 8, hilited: true, goAway: true, shadeOn: true };
  const { port: p, g } = draw(doc, ufork({ docGrowHole: true }));
  assert.deepEqual(rgb(p, g.grow.left + 4, g.grow.top + 4), [9, 9, 9]);
  assert.notDeepEqual(rgb(p, g.grow.left + 3, g.grow.top + 3), [9, 9, 9]);
});

test('WP1–WP4: drops only as the four cases say (WP3 keeps zoom however narrow; WP4 drops nothing)', () => {
  const narrow = (w, o) => proceduralFrameGeometry(null, { content: rect(60, 40, 140, 40 + w), variation: 8, hilited: true, goAway: true, shadeOn: true, ...o }).shown;
  assert.deepEqual(narrow(10, { goAway: false }), { close: false, zoom: true, collapse: false }, 'WP3');
  assert.deepEqual(narrow(10, { goAway: false, variation: 0 }), { close: false, zoom: false, collapse: true }, 'WP4');
  assert.deepEqual(narrow(10, { variation: 0 }), { close: true, zoom: false, collapse: false }, 'WP2');
  assert.deepEqual(narrow(40, {}), { close: true, zoom: true, collapse: false }, 'WP1 drops collapse first');
});

test('CT1–CT4 (§12): entry 0 is found by value; exact 16-bit equality decides the alert', () => {
  const white = [0xffff, 0xffff, 0xffff];
  const t = { entries: [{ value: 5, rgb16: [1, 2, 3], rgb: [0, 0, 0] }, { value: 0, rgb16: white, rgb: [255, 255, 255] }, { value: 7, rgb16: [4, 5, 6], rgb: [0, 0, 0] }] };
  assert.deepEqual(colorTableEntry(t, 0), { entry: t.entries[1], row: 'CT3' });
  assert.equal(colorTableEntry({ entries: [{ value: 0, rgb16: white, rgb: [255, 255, 255] }] }, 0).row, 'CT1');
  assert.equal(colorTableEntry({ entries: [{ value: 3, rgb16: [1, 1, 1], rgb: [0, 0, 0] }, { value: 0, rgb16: white, rgb: [0, 0, 0] }] }, 0).entry.value, 3, 'CT2: position n');
  const dlg = actb => proceduralFrameGeometry(ufork({ actb }), { content: C, variation: 1, hilited: true, goAway: false, shadeOn: true, colorTable: 'default' }).alert;
  assert.equal(dlg(t.entries), true, 'value-0 entry at position 1 is white = the default content');
  assert.equal(dlg([t.entries[0], { ...t.entries[1], rgb16: [0xffff, 0xfffe, 0xffff] }, t.entries[2]]), false, 'one stored channel differs');
});

test('SH2 (§12): a collapsed document window\'s shadow row is T.b, not C.b + 6', () => {
  const doc = { content: rect(60, 40, 60, 200), variation: 8, hilited: true, goAway: true, shadeOn: true, collapsed: true };
  const { port: p, g } = draw(doc);
  assert.deepEqual(rgb(p, g.T.left + 2, g.T.bottom), P(0, 0, 11));
  assert.deepEqual(rgb(p, g.T.right, g.T.top + 2), P(0, 0, 11));
  assert.equal(at(p, g.T.left + 2, 60 + 6)[3], 0);
});

test('HT2 (§12): a point in the grow rect\'s extension to the shadow column hits grow (document)', () => {
  const chain = ufork();
  const g = proceduralFrameGeometry(chain, { content: C, variation: 8, hilited: true, goAway: true, shadeOn: true });
  assert.deepEqual(proceduralFramePartAt(g, chain, { x: g.bounds.right - 1, y: g.grow.top + 3 }), { part: 3, row: 'HT2' });
});

test('M6L2–M6L4 (§12): message 6 lines span portRect.l..r on row b − 15 and t..b − 15 on column r − 15, colour P(0, 0)', () => {
  const p = port(), t = createTrace('proceduralFrame');
  const doc = { content: C, variation: 8, hilited: true, goAway: true, shadeOn: true, growFlag: false };
  const r = drawProceduralFrameGrowIcon(p, ufork(), doc, t);
  assert.equal(r.growFlag, true, 'M6L5');
  assert.deepEqual(rgb(p, C.left, C.bottom - 15), P(0, 0, 11));
  const h = t.drawOps.find(o => o.row === 'M6L3');
  assert.deepEqual([h.from, h.to], [{ x: C.left, y: C.bottom - 15 }, { x: C.right - 1, y: C.bottom - 15 }], 'portRect.r itself is clipped');
  assert.deepEqual(rgb(p, C.right - 16, C.bottom - 15), P(0, 0, 11));
  assert.deepEqual(rgb(p, C.right - 15, C.top), P(0, 0, 11));
  assert.ok(t.drawOps.some(o => o.row?.startsWith('GB1')), 'M6L6 grow box');
});

test('UFT1 / UFH7–UFH11 (§12 corpus): each no-wnd# bundle, both states, samples its own -14316 / -14320', async () => {
  const cases = await import('../../../tests/engine-diff/cases.mjs');
  let discriminating = 0;
  for (const slug of ['apple-platinum-2', 'black-platinum', 'platinum-8', 'slimes', 'system7-nostalgia-silver']) {
    const decoded = await cases.decode(slug);
    const chain = cases.__frameChain(E, slug, decoded);
    for (const hilited of [true, false]) {
      const t = createTrace('proceduralFrame');
      drawProceduralFrame(port(), chain, util({ hilited }), {}, t);
      const hit = chain.getResource('cicn', hilited ? -14316 : -14320) ?? chain.getResource('cicn', -14316);
      const pm = hit.value.unmasked ?? hit.value.pixmap;
      const Q = (x, y) => { const i = (y * pm.width + x) * 4; return [pm.data[i], pm.data[i + 1], pm.data[i + 2]]; };
      const s = t.drawOps.find(o => o.op === 'sample');
      assert.deepEqual([s.fill, s.text, s.shadow].map(c => [c.r, c.g, c.b]), [Q(4, 3), Q(5, 3), Q(7, 3)], `${slug} ${hilited}`);
      const lines = t.drawOps.filter(o => o.op === 'line' && o.rgb);
      for (const [row, n, pt] of [['UFH7', 3, i => Q(4, i)], ['UFH8', 4, i => Q(4, 11 - i)], ['UFH11', 3, i => Q(4, 5 - i)]]) {
        const got = lines.filter(o => o.row === row).map(o => [o.rgb.r, o.rgb.g, o.rgb.b]);
        assert.deepEqual(got, Array.from({ length: n }, (_, i) => pt(i)), `${slug} ${hilited} ${row}`);
      }
      if (String(Q(4, 3)) !== String(Q(6, 3)) || String(Q(5, 3)) !== String(Q(7, 3))) discriminating++;
    }
  }
  assert.ok(discriminating >= 1, `the document sample points give a different colour in ${discriminating} of 10 cells`);
});
