// Scheme-specific frame behavior; common build and asset contracts live in authored-schemes.test.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildScheme } from '../../authoring/schemes/bonn/scheme.mjs';
import { decodeWnd } from '../theme-loader/decoders/wnd.js';

const { resources } = await buildScheme();
const find = (type, id) => resources.find((r) => r.type === type && r.id === id);

test('the skyline stands over the title caps (code 6) and one bridge is centred on the water, 11 | bridge | 8', () => {
  const wnd = decodeWnd(find('wnd#', -14336).data);
  const codes = (side) => side.slice(1).map((e) => e.part ?? e.code);
  const widths = (side) => side.slice(1).map((e, i) => e.border - side[i].border);
  const top = codes(wnd.topSide);
  assert.deepEqual(top, [1, 11, 6, 5, 6, 8, 1]);
  assert.equal(top.filter((c) => c === 12).length, 0, 'no code 12: it would repeat the skyline');
  const w = widths(wnd.topSide);
  assert.ok(w[2] > 30 && w[4] > 30, 'the caps are wide enough to carry the Minster and the Town Hall');
  assert.deepEqual(codes(wnd.bottomSide), [1, 0, 11, 1, 8, 1]);
});

test('utility windows keep only the close widget', () => {
  const rects = decodeWnd(find('wnd#', -14304).data).rectangles;
  const closeWidth = (rs) => { const { left, right } = rs.find((r) => r.part === 1).rect; return right - left; };
  assert.equal(closeWidth(rects), closeWidth(decodeWnd(find('wnd#', -14336).data).rectangles));
  for (const part of [2, 3]) {
    const { left, right } = rects.find((r) => r.part === part).rect;
    assert.equal(right - left, 0);
  }
});
