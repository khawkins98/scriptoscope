import { test } from 'node:test';
import assert from 'node:assert/strict';
import { borderWriter, boundarySizes, boundaryVariants } from './border-boundary-model.mjs';
const opaque = () => 255;
const at = (input, size, x, y, alpha = opaque, clip) => borderWriter(input, { width: size[0], height: size[1], clip }, x, y, alpha);
test('reverse source model retains literal square corners and unequal-band overlap order', () => {
  const a = { width: 9, height: 9, corner: 4, side: 1, tile: false };
  assert.deepEqual(at(a, [53, 40], 2, 2), { region: 0, source: [2, 2], branch: 'copy' });
  assert.deepEqual(at(a, [53, 40], 51, 2), { region: 1, source: [7, 2], branch: 'copy' });
  assert.equal(at(a, [53, 40], 2, 6), null); // body, not a border claim
  const b = { width: 21, height: 21, corner: 7, side: 14, tile: true };
  assert.deepEqual(at(b, [53, 40], 9, 30), { region: 6, source: [9, 9], branch: 'copy' });
  assert.deepEqual(at(b, [53, 40], 45, 30), { region: 7, source: [13, 9], branch: 'copy' });
});
test('short destination overlap preserves original corner origin; later transparent writer exposes earlier corner', () => {
  const a = { width: 9, height: 9, corner: 4, side: 1, tile: true };
  // Height3 is shorter than one corner: BL starts at -1, so source y6
  // survives at output y0. It is not rescaled/clamped to half destination.
  assert.deepEqual(at(a, [24, 3], 2, 0), { region: 3, source: [2, 6], branch: 'copy' });
  assert.deepEqual(at(a, [24, 3], 2, 0, (x, y) => x === 2 && y === 6 ? 0 : 255),
    { region: 0, source: [2, 0], branch: 'copy' });
});
test('masked partial tile tail and clipping retain source phase; width-one sampling wins', () => {
  const a = { width: 11, height: 9, corner: 4, side: 1, tile: true };
  assert.deepEqual(at(a, [25, 12], 20, 0), { region: 2, source: [5, 0], branch: 'copy' }); // 17px middle: final tail is source4,5
  assert.equal(at(a, [25, 12], 20, 0, (x, y) => x === 5 && y === 0 ? 0 : 255), null);
  assert.deepEqual(at(a, [25, 12], 20, 0, opaque, [20, 0, 1, 1]), { region: 2, source: [5, 0], branch: 'copy' });
  assert.equal(at(a, [25, 12], 21, 0, opaque, [20, 0, 1, 1]), null);
  const b = { width: 7, height: 7, corner: 3, side: 1, tile: true };
  assert.deepEqual(at(b, [29, 17], 4, 0), { region: 2, source: [3, 0], branch: 'horizontal-lines' });
  assert.deepEqual(at(b, [29, 17], 0, 4), { region: 6, source: [0, 3], branch: 'vertical-lines' });
});
test('finite thresholds retain public minimum exclusions and all state option tuples', () => {
  assert.equal(boundaryVariants.length, 15);
  const plan = boundarySizes({ width: 7, height: 7, corner: 3, tile: true }, 'push');
  assert.deepEqual(plan.axes[0].map(r => [r.middle, r.reachable]), [[0, false], [1, false], [2, false], [3, false]]);
  assert.deepEqual(plan.sizes, [[24, 6], [24, 7], [24, 8], [24, 9]]);
});
