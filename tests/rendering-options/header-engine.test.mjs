import '../helpers/registerTs.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HEADER_NATIVE_LITERALS, HEADER_COLUMN_LITERALS, HEADER_MASK_CLEAR_LITERALS, HEADER_STATE_DECISIONS, HEADER_COLUMN_DECISIONS, markerRgba, literalPixels } from './header-engine-oracle.mjs';

// Resolve production .js specifiers only after the shared TS hook is registered.
const E = await import('../../src/engine/index.ts');

const names = ['headerResourceId', 'planHeaderSurface', 'planHeaderGeometry', 'drawHeaderSurface', 'planHeaderColumns', 'drawHeaderColumns'];
const available = names.every(n => typeof E[n] === 'function');
const enabled = { skip: !available && 'new pure header module absent: structural baseline, not a behavioral red' };
const pixmap = rows => ({ width: rows[0]?.length ?? 0, height: rows.length, data: new Uint8ClampedArray(literalPixels(rows)) });
const blank = (width, height) => ({ width, height, data: new Uint8ClampedArray(width * height * 4) });
const background = { r: 48, g: 48, b: 48, a: 255 };
export function surfaceInput(fixture) {
  const [x, y] = fixture.origin, c = fixture.clip;
  const context = { basis: 'caller-declared', controlOrigin: [x, y], portOrigin: [13, -11], patternOrigin: { status: 'known', offset: fixture.offset },
    clip: c ? { kind: 'rect', rect: { x: x + c[0], y: y + c[1], w: c[2], h: c[3] } } : { kind: 'unbounded' } };
  const plan = E.planHeaderSurface({ kind: fixture.kind, width: fixture.width, height: fixture.height, drawState: 1, context });
  const sampledRows = fixture.source.map(row => [...row].map(c => c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase()).join(''));
  return { source: pixmap(fixture.source), plan, slice: { corner: fixture.corner, side: fixture.side, tile: fixture.tile },
    mode: fixture.patternMode ?? 0, background, samplingEquivalent: !fixture.sampled,
    ...(fixture.sampled ? { sampled: pixmap(sampledRows) } : {}), ...(fixture.patternMode !== undefined ? { pattern: pixmap(['0123', '4567']) } : {}) };
}

test('structural: approved pure header entrypoints exist', () => {
  for (const name of names) assert.equal(typeof E[name], 'function', `${name}: missing engine module is a structural baseline failure`);
});

test('header state selection distinguishes number zero from inactive Boolean', enabled, () => {
  for (const [state, expected] of HEADER_STATE_DECISIONS) assert.equal(E.headerResourceId(state), expected);
  for (const [inactive, expected] of HEADER_COLUMN_DECISIONS.inactiveIds) assert.equal(E.headerResourceId(inactive), expected);
});

for (const fixture of HEADER_NATIVE_LITERALS) test(`header native literal: ${fixture.name}`, enabled, () => {
  const input = surfaceInput(fixture), port = blank(fixture.width, fixture.height);
  const result = E.drawHeaderSurface(port, input);
  assert.equal(result.unsupported, undefined, fixture.name);
  assert.deepEqual(Array.from(port.data), literalPixels(fixture.rows), fixture.name);
  assert.equal(result.painted, fixture.name !== 'empty-clip');
  assert.equal(input.plan.paintRect.h, fixture.height + (fixture.kind === 'list-view-header' ? 1 : 0));
  if (fixture.sampled) assert.equal(result.lineSampling, 'sampled-companion');
  if (fixture.name === 'empty-clip') {
    assert.deepEqual(result.sampledRegions, []);
    assert.equal(E.planHeaderGeometry(input.source, input.slice, input.plan).bodyVisible, false);
  }
});

for (const fixture of HEADER_MASK_CLEAR_LITERALS) test(`header needed-only sample: ${fixture.name}`, enabled, () => {
  const input = { ...surfaceInput(fixture), samplingEquivalent: false, sampled: null,
    background: fixture.noBackground ? null : background };
  const port = blank(fixture.width, fixture.height), result = E.drawHeaderSurface(port, input);
  assert.equal(result.unsupported, fixture.expectedReason);
  if (!fixture.expectedReason) {
    assert.deepEqual(Array.from(port.data), literalPixels(fixture.rows));
    assert.equal(result.lineSampling, 'not-required');
    assert.deepEqual(result.sampledRegions, []);
    assert.equal(result.painted, fixture.name !== 'opaque-sample-outside-clip');
  }
});

test('header geometry exposes literal native regions and required branches', enabled, () => {
  const input = surfaceInput(HEADER_NATIVE_LITERALS[0]);
  const g = E.planHeaderGeometry(input.source, input.slice, input.plan);
  const rect = (x, y, w, h) => ({ x, y, w, h });
  const expected = [
    [rect(0, 0, 2, 2), rect(0, 0, 2, 2)], [rect(5, 0, 2, 2), rect(9, 0, 2, 2)],
    [rect(2, 0, 3, 3), rect(2, 0, 7, 3)], [rect(0, 5, 2, 2), rect(0, 7, 2, 2)],
    [rect(5, 5, 2, 2), rect(9, 7, 2, 2)], [rect(2, 4, 3, 3), rect(2, 6, 7, 3)],
    [rect(0, 2, 3, 3), rect(0, 2, 3, 5)], [rect(4, 2, 3, 3), rect(8, 2, 3, 5)],
  ];
  assert.deepEqual(g.bands.map(b => [b.source, b.destination]), expected);
  assert.deepEqual(g.bodyRects, [rect(2, 3, 7, 3), rect(3, 2, 5, 5)]);
  assert.equal(g.bodyVisible, true); assert.equal(g.needsSampling, false); assert.equal(g.unsafeSource, false);
  const sampled = surfaceInput(HEADER_NATIVE_LITERALS.find(f => f.name === 'first-strip-sampled'));
  const sg = E.planHeaderGeometry(sampled.source, sampled.slice, sampled.plan);
  assert.deepEqual(sg.bands.filter(b => b.branch !== 'copy').map(b => [b.region, b.branch]), [[2, 'horizontal-lines'], [5, 'horizontal-lines'], [6, 'vertical-lines'], [7, 'vertical-lines']]);
});

for (const fixture of HEADER_COLUMN_LITERALS) test(`header column literal: ${fixture.name}`, enabled, () => {
  const source = pixmap(fixture.source), port = blank(fixture.widths.reduce((a, b) => a + b, 0), fixture.height);
  const plan = E.planHeaderColumns({ source, slice: { corner: 2, side: 3, tile: fixture.tile }, hasBgPattern: !fixture.centerFill,
    ...(fixture.centerFill ? { bgAnchor: [1, 1] } : {}), columns: fixture.widths.map(width => ({ label: '', width })), height: fixture.height });
  E.drawHeaderColumns(port, { source, plan, glyphs: fixture.widths.map(() => null) });
  assert.deepEqual(Array.from(port.data), literalPixels(fixture.rows), fixture.name);
  assert.deepEqual([plan.width, plan.height, plan.corner, plan.side, plan.fontSize], [port.width, 16, 2, 3, 10]);
  assert.equal(plan.foreground, fixture.centerFill ? '#000000' : '#ffffff');
});

test('header columns retain literal defaults, metric thresholds and label placement', enabled, () => {
  const source = pixmap(HEADER_NATIVE_LITERALS[0].source);
  const p = E.planHeaderColumns({ source, hasBgPattern: false });
  assert.deepEqual(p.columns, [{ label: 'Name', width: 140 }, { label: 'Size', width: 56 }, { label: 'Kind', width: 90 }]);
  assert.deepEqual([p.width, p.height, p.fontSize], [286, 16, 10]);
  for (const [sourceHeight, requested, height, fontSize] of [[5, undefined, 16, 10], [28, undefined, 28, 17], [29, undefined, 20, 12], [7, 8, 16, 10], [7, 31, 31, 19]]) {
    const plan = E.planHeaderColumns({ source: pixmap(Array(sourceHeight).fill('AAAAAAA')), height: requested, hasBgPattern: false, columns: [] });
    assert.deepEqual([plan.width, plan.height, plan.fontSize], [0, height, fontSize]);
  }
  const fixture = HEADER_COLUMN_LITERALS.find(f => f.tile && f.centerFill && f.widths.length === 1);
  const plan = E.planHeaderColumns({ source, slice: { corner: 2, side: 3, tile: true }, bgAnchor: [1, 1], hasBgPattern: false, columns: [{ label: 'literal glyph', width: 11 }], height: 16 });
  const port = blank(11, 16), glyph = pixmap(['~~', '~~', '~~']);
  E.drawHeaderColumns(port, { source, plan, glyphs: [glyph] });
  const expected = literalPixels(fixture.rows);
  for (const y of [7, 8, 9]) for (const x of [6, 7]) expected.splice((y * 11 + x) * 4, 4, ...markerRgba('~'));
  assert.deepEqual(Array.from(port.data), expected);
});
