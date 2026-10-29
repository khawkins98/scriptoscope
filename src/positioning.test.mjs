import '../tests/helpers/registerTs.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

let rootStyle = { position: 'static', transform: 'none', filter: 'none', perspective: 'none' };
const root = {
  getBoundingClientRect: () => ({ left: 0, top: 41 - window.scrollY }),
  clientLeft: 0, clientTop: 0, scrollLeft: 0, scrollTop: 0,
};
globalThis.document = { documentElement: root };
globalThis.getComputedStyle = el => (el === root ? rootStyle : el.computed ?? {});
globalThis.window = { scrollX: 0, scrollY: 0 };
const { offsetInContainingBlock, visualScale, viewportFrame } = await import('./positioning.ts');

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

// A 200x100 box rotated 90deg about its top-left: on screen it is 100 wide and
// 200 tall, and its origin corner is the bounding rect's top-RIGHT.
const near = (actual, expected) => {
  for (const k of Object.keys(expected)) assert.ok(Math.abs(actual[k] - expected[k]) < 1e-9, `${k}: ${actual[k]} vs ${expected[k]}`);
};
const box = (computed, rect, parentElement = null) => ({
  computed, parentElement,
  getBoundingClientRect: () => rect,
  offsetWidth: 200, offsetHeight: 100,
  clientLeft: 0, clientTop: 0, scrollLeft: 0, scrollTop: 0,
});

test('a rotated ancestor maps viewport points through the inverse rotation (#519)', () => {
  const rotated = box({ transform: 'matrix(0, 1, -1, 0, 0, 0)' }, { left: 400, top: 50, width: 100, height: 200 });
  const f = viewportFrame(rotated);
  near(f.origin, { left: 500, top: 50 });
  // 30 viewport px down the screen is 30 px along the box's own x axis.
  near(f.toLocal(500, 80), { x: 30, y: 0 });
  near(f.toLocal(480, 50), { x: 0, y: 20 });
  near(offsetInContainingBlock({ left: 480, top: 80 }, rotated), { x: 30, y: 20 });
});

test('the rotate property and an ancestor transform compose (#519)', () => {
  // A parent at rotate(90deg) holding an unrotated child: the child inherits it.
  const parent = box({ rotate: '90deg' }, { left: 0, top: 0, width: 100, height: 200 });
  const child = box({}, { left: 400, top: 50, width: 100, height: 200 }, parent);
  near(viewportFrame(child).toLocal(500, 80), { x: 30, y: 0 });
});

test('a skewed ancestor undoes the shear (#519)', () => {
  // skewX(45deg): local (x, y) -> (x + y, y). Bounds of 200x100 are 300x100.
  const skewed = box({ transform: 'matrix(1, 0, 1, 1, 0, 0)' }, { left: 10, top: 20, width: 300, height: 100 });
  const f = viewportFrame(skewed);
  near(f.origin, { left: 10, top: 20 });
  near(f.toLocal(110, 70), { x: 50, y: 50 });
  // Moving the pointer straight down moves back along local x as well.
  const a = f.toLocal(110, 20), b = f.toLocal(110, 60);
  near({ dx: b.x - a.x, dy: b.y - a.y }, { dx: -40, dy: 40 });
});

test('a pure scale keeps the bounding-rect ratio path', () => {
  const scaled = box({ transform: 'matrix(0.5, 0, 0, 0.5, 0, 0)' }, { left: 10, top: 20, width: 100, height: 50 });
  near(viewportFrame(scaled).toLocal(60, 45), { x: 100, y: 50 });
});
