import '../tests/helpers/registerTs.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const root = {};
globalThis.document = { documentElement: root };
globalThis.window = { scrollX: 0, scrollY: 0 };
const { offsetInContainingBlock } = await import('./positioning.ts');

test('page-level absolute positions include the page scroll', () => {
  window.scrollX = 12; window.scrollY = 1800;
  // A window 400px down the viewport on a page scrolled by 1800px sits at 2200px.
  assert.deepEqual(offsetInContainingBlock({ left: 170, top: 400 }, root), { x: 182, y: 2200 });
  assert.deepEqual(offsetInContainingBlock({ left: 170, top: 400 }, null), { x: 182, y: 2200 });
});

test('positioned ancestors use their padding box and own scroll offset', () => {
  window.scrollX = 0; window.scrollY = 900;
  const ancestor = {
    getBoundingClientRect: () => ({ left: 100, top: -50 }),
    clientLeft: 2, clientTop: 3, scrollLeft: 0, scrollTop: 40,
  };
  assert.deepEqual(offsetInContainingBlock({ left: 130, top: 20 }, ancestor), { x: 28, y: 107 });
});
