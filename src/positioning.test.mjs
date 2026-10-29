import '../tests/helpers/registerTs.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

let rootStyle = { position: 'static', transform: 'none', filter: 'none', perspective: 'none' };
const root = {
  getBoundingClientRect: () => ({ left: 0, top: 41 - window.scrollY }),
  clientLeft: 0, clientTop: 0, scrollLeft: 0, scrollTop: 0,
};
globalThis.document = { documentElement: root };
globalThis.getComputedStyle = el => (el === root ? rootStyle : {});
globalThis.window = { scrollX: 0, scrollY: 0 };
const { offsetInContainingBlock, visualScale } = await import('./positioning.ts');

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

test('a positioned html element is a real containing block, offset by its margin', () => {
  rootStyle = { ...rootStyle, position: 'relative' };
  window.scrollX = 0; window.scrollY = 1800;
  // html has a 41px top margin; a window 400px down the viewport sits 2159px into it.
  assert.deepEqual(offsetInContainingBlock({ left: 170, top: 400 }, root), { x: 170, y: 2159 });
  rootStyle = { ...rootStyle, position: 'static' };
});

test('a scaled ancestor converts viewport distances back to its CSS pixels (#515)', () => {
  window.scrollX = 0; window.scrollY = 0;
  // A 1000x500 box shown at scale(0.8): 800x400 on screen, top-left at (100, 50).
  const ancestor = {
    getBoundingClientRect: () => ({ left: 100, top: 50, width: 800, height: 400 }),
    offsetWidth: 1000, offsetHeight: 500,
    clientLeft: 0, clientTop: 0, scrollLeft: 0, scrollTop: 0,
  };
  assert.deepEqual(visualScale(ancestor), { x: 0.8, y: 0.8 });
  // 160 viewport px right and 80 down of its corner is (200, 100) in its own pixels.
  assert.deepEqual(offsetInContainingBlock({ left: 260, top: 130 }, ancestor), { x: 200, y: 100 });
});

test('visualScale falls back to 1 without a layout box', () => {
  const hidden = { getBoundingClientRect: () => ({ width: 0, height: 0 }), offsetWidth: 0, offsetHeight: 0 };
  assert.deepEqual(visualScale(hidden), { x: 1, y: 1 });
});
