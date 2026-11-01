// Scheme-specific frame behavior; common build and asset contracts live in authored-schemes.test.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildScheme } from '../../authoring/schemes/castle/scheme.mjs';
import { decodeWnd } from '../theme-loader/decoders/wnd.js';

const { resources } = await buildScheme();
const find = (type, id) => resources.find((r) => r.type === type && r.id === id);

test('utility windows keep only the close widget', () => {
  const rects = decodeWnd(find('wnd#', -14304).data).rectangles;
  for (const part of [2, 3]) {
    const { left, right } = rects.find((r) => r.part === part).rect;
    assert.equal(right - left, 0);
  }
});
