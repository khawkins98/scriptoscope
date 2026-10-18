import test from 'node:test';
import assert from 'node:assert/strict';
import { snapshotControlComposition, bodyPatternAnchor, bodyPatternSample, controlPointVisible } from './controlComposition.ts';
const context = (controlOrigin = [0, 0], portOrigin = [0, 0], offset = [0, 0]) => snapshotControlComposition({
  controlOrigin, portOrigin, patternOrigin: { status: 'known', offset }, clip: { kind: 'unbounded' },
});

test('exclusive original control corners remain independent of ring reservation', () => {
  const rect = { x: -3, y: 7, w: 13, h: 9 };
  assert.deepEqual([0, 1, 2, 3, 4, 6, 255].map(mode => bodyPatternAnchor(mode, rect)),
    [[0, 0], [-3, 7], [10, 7], [-3, 16], [10, 16], [0, 0], [0, 0]]);
  // A 4px reserved ring places the face at buffer(4,4); it never alters this Rect.
  assert.deepEqual(bodyPatternSample(context([-3, 7]), 2, 13, 9, 3, 1, 5, 3), [0, 1]);
});

test('asymmetric independent literal body rows distinguish continuous phase from inset-local tiling', () => {
  const tile = ['ABCD', 'EFGH'];
  function rows(c) {
    return Array.from({ length: 9 }, (_, y) => Array.from({ length: 13 }, (_, x) => {
      const body = (x >= 3 && x < 10 && y >= 1 && y < 8) || (x >= 1 && x < 12 && y >= 3 && y < 6);
      if (!body || !controlPointVisible(c, x, y)) return '.';
      const [sx, sy] = bodyPatternSample(c, 0, 13, 9, x, y, 4, 2); return tile[sy][sx];
    }).join(''));
  }
  assert.deepEqual(rows(context([20, 20])), ['.............', '...HEFGHEF...', '...DABCDAB...', '.FGHEFGHEFGH.', '.BCDABCDABCD.', '.FGHEFGHEFGH.', '...DABCDAB...', '...HEFGHEF...', '.............']);
  assert.deepEqual(rows(context([23, 25], [3, 5])), ['.............', '...CDABCDA...', '...GHEFGHE...', '.ABCDABCDABC.', '.EFGHEFGHEFG.', '.ABCDABCDABC.', '...GHEFGHE...', '...CDABCDA...', '.............']);
  assert.deepEqual(bodyPatternSample(context([-3, -5]), 0, 13, 9, 3, 1, 4, 2), [0, 0]);
  assert.deepEqual(bodyPatternSample(context([-3, -5]), 0, 13, 9, 4, 1, 4, 2), [1, 0]);
});

test('non-power-of-two tile distinguishes offset sign, exclusive corners and coordinate translation', () => {
  // D=(23,25), q=(4,2), R=(-3,5), 5x3 tile. Literal samples hand-derived per mode.
  const c = context([23, 25], [3, 5], [-3, 5]);
  assert.deepEqual([0, 1, 2, 3, 4].map(mode => bodyPatternSample(c, mode, 13, 8, 4, 2, 5, 3)),
    [[4, 2], [1, 1], [3, 1], [1, 2], [3, 2]]);
  // UI3.4.1: SetOrigin(+10,+10), pattern-origin(-10,-10) preserves content alignment.
  assert.deepEqual(bodyPatternSample(context([10, 10], [10, 10], [-10, -10]), 0, 13, 8, 0, 0, 7, 3), [0, 0]);
  assert.deepEqual(bodyPatternSample(context([3, 3]), 0, 13, 8, 0, 0, 10, 10), [3, 3]);
  // Changing O with D fixed changes physical placement, not default local phase.
  assert.deepEqual(bodyPatternSample(context([23, 25], [-7, 9]), 0, 13, 8, 4, 2, 5, 3), [2, 0]);
  assert.throws(() => bodyPatternSample(c, 5, 13, 8, 0, 0, 5, 3), /cicn/);
});

test('finite clipping changes coverage without restarting phase; snapshots isolate caller mutation', () => {
  const input = { controlOrigin: [-3, -5], portOrigin: [0, 0], patternOrigin: { status: 'known', offset: [1, 2] },
    clip: { kind: 'rect', rect: { x: 1, y: -3, w: 5, h: 4 } } };
  const c = snapshotControlComposition(input);
  input.controlOrigin[0] = 100; input.patternOrigin.offset[0] = 99; input.clip.rect.x = 90;
  assert.equal(controlPointVisible(c, 3, 2), false); assert.equal(controlPointVisible(c, 4, 2), true);
  assert.equal(controlPointVisible(c, 8, 5), true); assert.equal(controlPointVisible(c, 9, 5), false);
  assert.deepEqual(bodyPatternSample(c, 0, 13, 9, 4, 2, 5, 3), [2, 2]);
  assert.ok(Object.isFrozen(c) && Object.isFrozen(c.controlOrigin) && Object.isFrozen(c.clip.rect));
  const unknown = snapshotControlComposition();
  assert.equal(unknown.basis, 'compatibility-default'); assert.equal(unknown.patternOrigin.status, 'unknown'); assert.equal(unknown.clip.kind, 'unknown');
});

test('unsupported coordinate overflow and malformed persisted context are not silently rounded', () => {
  for (const origin of [[0.5, 0], [32768, 0], [NaN, 0], [0]]) assert.throws(() => context(origin));
  assert.throws(() => bodyPatternAnchor(0, { x: 32760, y: 0, w: 13, h: 9 }), /control.right/);
  assert.throws(() => snapshotControlComposition({ ...context(), clip: { kind: 'rect', rect: { x: 0, y: 0, w: -1, h: 3 } } }), /dimensions/);
});

test('co-translated D/O/port clip preserves physical coverage and mode-corner phase', () => {
  const create = (d, o, clip) => snapshotControlComposition({ controlOrigin: d, portOrigin: o,
    patternOrigin: { status: 'known', offset: [0, 0] }, clip: { kind: 'rect', rect: clip } });
  const first = create([20, 20], [0, 0], { x: 24, y: 22, w: 5, h: 4 });
  const moved = create([23, 25], [3, 5], { x: 27, y: 27, w: 5, h: 4 });
  for (const c of [first, moved]) {
    assert.deepEqual([[3, 2], [4, 2], [8, 5], [9, 5], [4, 6]].map(([x, y]) => controlPointVisible(c, x, y)), [false, true, true, false, false]);
    // Right/top anchor P is(33,20) or(36,25). D+q-P is(-9,2)
    // at q(4,2), independent of the physical translation.
    assert.deepEqual(bodyPatternSample(c, 2, 13, 8, 4, 2, 5, 3), [1, 2]);
  }
  assert.deepEqual(bodyPatternSample(first, 0, 13, 8, 4, 2, 5, 3), [4, 1]);
  assert.deepEqual(bodyPatternSample(moved, 0, 13, 8, 4, 2, 5, 3), [2, 0]);
});

// 109be tests only equality with5. 10ab0 zero-extends the byte; the four
// SUBQ/BEQ pairs select1..4 and every other byte falls through to P=(0,0).
test('every non-cicn raw byte uses the established corner or zero anchor', () => {
  const rect = { x: -3, y: 7, w: 13, h: 9 };
  const corners = { 1: [-3, 7], 2: [10, 7], 3: [-3, 16], 4: [10, 16] };
  for (let mode = 0; mode <= 255; mode++) {
    if (mode === 5) continue;
    assert.deepEqual(bodyPatternAnchor(mode, rect), corners[mode] ?? [0, 0], `raw byte ${mode}`);
  }
});
