// Scheme-specific frame behavior; common build and asset contracts live in authored-schemes.test.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildScheme } from '../../authoring/schemes/new-year-2027/scheme.mjs';
import { windowTypes } from '../../authoring/schemes/new-year-2027/frames.mjs';
import { decodeWnd } from '../theme-loader/decoders/wnd.js';

const { resources } = await buildScheme();
const find = (type, id) => resources.find((r) => r.type === type && r.id === id);

test('document ornaments drop whole, the plate keeps its end caps, and a 90px title fits at 340px', () => {
  const doc = windowTypes().find((t) => t.id === -14336).layout;
  for (const name of ['burst', 'year']) assert.equal(doc.named(name).code, 10, `${name} drops as a whole ornament`);
  const codes = doc.cells.top.map((c) => c.code);
  const plate = codes.indexOf(5);
  assert.ok(plate > 0, 'a title plate exists');
  assert.deepEqual(codes.slice(plate - 1, plate + 2), [6, 5, 6], 'title end caps move with the plate');
  // The concept-scaled fireworks, year and widgets reserve a wider fixed band.
  assert.ok(doc.minWidthForTitle(90) <= 340, 'ornaments leave room for a 90px title in a 340px window');
  const rects = decodeWnd(find('wnd#', -14336).data).rectangles;
  const t4 = rects.find((r) => r.part === 4).rect;
  assert.ok(t4.bottom - t4.top >= 17, 'title rect is at least 17px tall (R28)');
});

test('utility windows keep only the close widget', () => {
  const rects = decodeWnd(find('wnd#', -14304).data).rectangles;
  for (const part of [2, 3]) {
    const { left, right } = rects.find((r) => r.part === part).rect;
    assert.equal(right - left, 0);
  }
});
