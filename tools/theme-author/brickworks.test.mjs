// Scheme-specific frame behavior; common build and asset contracts live in authored-schemes.test.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildScheme } from '../../authoring/schemes/brickworks/scheme.mjs';
import { decodeWnd } from '../theme-loader/decoders/wnd.js';

const { resources } = await buildScheme();
const find = (type, id) => resources.find((r) => r.type === type && r.id === id);

test('stud runs tile one brick from the title outward (code 11 left, code 8 right), and the document crane is a droppable code-10 cell', () => {
  for (const id of [-14336, -14328, -14304]) {
    const top = decodeWnd(find('wnd#', id).data).topSide.map((e) => e.part);
    assert.ok(top.includes(11) && top.includes(8), `wnd# ${id} top recipe ${top}`);
  }
  const doc = decodeWnd(find('wnd#', -14336).data).topSide.map((e) => e.part);
  assert.equal(doc.filter((p) => p === 10).length, 1, `document top recipe ${doc}`);
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
