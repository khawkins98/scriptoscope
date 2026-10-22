// DECISIONS #7: the opaque icon-blit companion is used only when it is the same
// occurrence as the element's asset; otherwise the icon falls back to the masked
// copy of the current asset and the trace records the fallback.
import '../../../tests/helpers/registerTs.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { cicnIconSource, sameOccurrence, OPAQUE_COMPANION_MISMATCH } = await import('./iconSource.ts');
const { iconBlit } = await import('../qd/region.ts');
const { createTrace } = await import('../trace.ts');

// 2 x 1 icon: pixel 0 mask set (red), pixel 1 mask clear with stored colour green.
const pm = px => ({ width: px.length, height: 1, data: new Uint8ClampedArray(px.flat()) });
const asset = pm([[200, 0, 0, 255], [0, 0, 0, 0]]);
const companion = pm([[200, 0, 0, 255], [0, 180, 0, 255]]);
// A consumer replaced the asset: blue where the mask is set, so the companion no longer matches.
const replaced = pm([[0, 0, 220, 255], [0, 0, 0, 0]]);
const rect = { left: 0, top: 0, right: 2, bottom: 1 };
const port = () => pm([[9, 9, 9, 255], [9, 9, 9, 255]]);
const draw = icon => { const p = port(), t = createTrace('test'); iconBlit(p, icon, rect, rect, t, 'AC5'); return { px: [...p.data], op: t.drawOps[0] }; };

test('sameOccurrence: equal size and equal RGB wherever the mask is set', () => {
  assert.equal(sameOccurrence(asset, companion), true);
  assert.equal(sameOccurrence(replaced, companion), false);
  assert.equal(sameOccurrence(asset, pm([[200, 0, 0, 255]])), false, 'size differs');
});

test('matching companion: the I3 copy is opaque (the mask-clear pixel draws its stored colour)', () => {
  const icon = cicnIconSource(asset, 8, companion);
  assert.equal(icon.unmasked, companion);
  assert.equal(icon.fallback, undefined);
  const { px, op } = draw(icon);
  assert.deepEqual(px, [200, 0, 0, 255, 0, 180, 0, 255]);
  assert.equal(op.row, 'AC5,I3');
  assert.equal(op.transfer, 'copyBits');
  assert.ok(!('fallback' in op) && !('unimplemented' in op));
});

test('mismatched companion: masked copy of the current asset is drawn and the trace marks the fallback', () => {
  const icon = cicnIconSource(replaced, 8, companion);
  assert.equal(icon.unmasked, null, 'stale hidden pixels are never used');
  assert.equal(icon.fallback, OPAQUE_COMPANION_MISMATCH);
  const { px, op } = draw(icon);
  // Mask-set pixel from the CURRENT asset; mask-clear pixel left as the port had it.
  assert.deepEqual(px, [0, 0, 220, 255, 9, 9, 9, 255]);
  assert.equal(op.row, 'AC5,I3');
  assert.equal(op.transfer, 'copyMask');
  assert.equal(op.fallback, OPAQUE_COMPANION_MISMATCH);
  assert.ok(!('unimplemented' in op), 'a recorded policy, not an unimplemented gap');
});

test('no companion at all stays the unimplemented masked case, with no fallback mark', () => {
  const icon = cicnIconSource(asset, 8, null);
  assert.deepEqual(icon, { pixmap: asset, pixelSize: 8, unmasked: null });
  const { px, op } = draw(icon);
  assert.deepEqual(px, [200, 0, 0, 255, 9, 9, 9, 255]);
  assert.match(op.unimplemented, /unmasked pixels unavailable/);
  assert.ok(!('fallback' in op));
});

test('mismatch with unknown depth keeps both the fallback and the unimplemented note', () => {
  const { op } = draw(cicnIconSource(replaced, null, companion));
  assert.equal(op.fallback, OPAQUE_COMPANION_MISMATCH);
  assert.match(op.unimplemented, /pixel depth/);
});
