import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeWnd } from './decoders/wnd.js';
import { loadKaleidoscopeScheme } from './loadKaleidoscopeScheme.js';
import { forkOf, onePixelCicn } from '../../tests/resource-provenance/fixtures.mjs';

// Five signed count-minus-one words. Rectangle records are five signed words;
// side records two. Values chosen literally, without any converter oracle.
const words = values => { const bytes = new Uint8Array(values.length * 2), view = new DataView(bytes.buffer);
  values.forEach((value, i) => view.setInt16(i * 2, value)); return bytes; };
const full = words([0, 0, -2, -3, 20, 40, 0, 1, -4, 0, 8, 12, 0, 13, 24, 0, 18, 30]);
const expected = { rectangles: [{ part: 0, rect: { top: -2, left: -3, bottom: 20, right: 40 } }],
  topSide: [{ part: 1, border: -4 }], bottomSide: [{ part: 8, border: 12 }],
  leftSide: [{ part: 13, border: 24 }], rightSide: [{ part: 18, border: 30 }] };

test('literal lists preserve signed fields and every truncated count/record prefix rejects', () => {
  assert.deepEqual(decodeWnd(full), expected);
  for (let length = 0; length < full.length; length++)
    assert.throws(() => decodeWnd(full.subarray(0, length)), /wnd#: truncated/, `prefix ${length}`);
  const backed = new Uint8Array(full.length + 20); backed.set(full, 7);
  assert.deepEqual(decodeWnd(backed.subarray(7, 7 + full.length)), expected);
  assert.throws(() => decodeWnd(backed.subarray(7, 7 + full.length - 1)), /wnd#: truncated/);
});

test('minus-one empty sentinel consumes exactly one count word per list', () => {
  assert.deepEqual(decodeWnd(words([-1, -1, -1, -1, -1])), {
    rectangles: [], topSide: [], bottomSide: [], leftSide: [], rightSide: [],
  });
  assert.deepEqual(decodeWnd(words([-1, 0, -2, -32768, -1, -1, -1])), {
    rectangles: [], topSide: [{ part: -2, border: -32768 }], bottomSide: [], leftSide: [], rightSide: [],
  });
  assert.throws(() => decodeWnd(words([-1, -1, -1, -1])), /wnd#: truncated right side count/);
});

test('negative non-sentinel and oversized declared lists reject before record reads', () => {
  for (const count of [-32768, -2]) for (let list = 0; list < 5; list++) {
    const counts = [-1, -1, -1, -1, -1]; counts[list] = count;
    assert.throws(() => decodeWnd(words(counts)), /wnd#: invalid signed count/);
  }
  assert.throws(() => decodeWnd(words([32767, -1, -1, -1, -1])), /wnd#: truncated rectangle list records/);
  assert.throws(() => decodeWnd(words([-1, 32767, -1, -1, -1])), /wnd#: truncated top side records/);
});

test('converter records truncated wnd as error and emits no successful window binding', async () => {
  const bytes = forkOf([{ type: 'wnd#', id: 1000, data: new Uint8Array([0]) },
    { type: 'cicn', id: 1000, data: onePixelCicn() }]);
  const loaded = await loadKaleidoscopeScheme(bytes, { encodeAssets: false, provenance: true });
  assert.equal(loaded.byteProvenance.resources.find(r => r.resourceIndex === 0).status, 'error');
  assert.equal(loaded.manifest.windowTypes, undefined);
  assert.equal(loaded.byteProvenance.resources.find(r => r.resourceIndex === 1).status, 'decoded');
});
