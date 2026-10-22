import '../../tests/helpers/registerTs.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { createTrace, canonicalTrace } = await import('./trace.ts');
const { tileBlit, rect } = await import('./qd/index.ts');

test('trace shape and canonical form are key-order independent', () => {
  const inputs = { b: 1, a: { d: 2, c: 3 } };
  const t = createTrace('scrollbar', inputs);
  inputs.b = 9;
  assert.equal(t.inputs.b, 1, 'inputs are copied');
  assert.deepEqual(Object.keys(t), ['family', 'inputs', 'resolved', 'rects', 'drawOps']);
  const u = createTrace('scrollbar', { a: { c: 3, d: 2 }, b: 1 });
  assert.equal(canonicalTrace(t), canonicalTrace(u));
  u.drawOps.push({ op: 'x' });
  assert.notEqual(canonicalTrace(t), canonicalTrace(u));
});

test('a traced tile records rects, direction and the T rows taken', () => {
  const t = createTrace('qd');
  const pm = (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) });
  tileBlit(pm(8, 2), pm(3, 2), rect(0, 0, 2, 3), rect(0, 0, 2, 8), 0, 'copyMask', t);
  assert.deepEqual(t.drawOps, [{ op: 'tile', row: 'T3,T4,T6', src: rect(0, 0, 2, 3), dst: rect(0, 0, 2, 8), direction: 0, transfer: 'copyMask', axis: 'horizontal' }]);
});
