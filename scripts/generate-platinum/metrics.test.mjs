// scripts/generate-platinum/metrics.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { METRICS } from './metrics.mjs';

test('stipple is the decoded AA00 2-row pattern (8 bytes)', () => {
  assert.deepEqual([...METRICS.stipple], [0xaa, 0x00, 0xaa, 0x00, 0xaa, 0x00, 0xaa, 0x00]);
});
test('frame inset is 1px on sides/bottom; widgets are 7x7', () => {
  assert.equal(METRICS.frameInset, 1);
  assert.equal(METRICS.widget.size, 7);
  assert.equal(METRICS.widget.closeLeftOffset, 4);   // title.left + 4
  assert.equal(METRICS.widget.zoomRightOffset, 4);   // title.right − 4 .. −11
});
test('title bar height is a positive integer ≥ 10 (decode clamp)', () => {
  assert.ok(Number.isInteger(METRICS.titleBarHeight) && METRICS.titleBarHeight >= 10);
});
