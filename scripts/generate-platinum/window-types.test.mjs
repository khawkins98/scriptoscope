// scripts/generate-platinum/window-types.test.mjs
// Geometry contract for the generalized title-plate path: EVERY titled type now
// gets the faithful 5-cell plate scaled to its own titleBarHeight + widget set,
// and the document-window's reference dims must fall out of the general formula.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { geometryFor, WINDOW_TYPES } from './window-types.mjs';

const bySlug = (s) => WINDOW_TYPES.find((c) => c.slug === s);

test('document-window reproduces the reference plate dims (98×24, borders 21,27,57,63,98)', () => {
  const g = geometryFor(bySlug('document-window'));
  assert.equal(g.width, 98);
  assert.equal(g.height, 24); // title(21) + body stub(1) + 2px real bottom band
  assert.equal(g.bottomFrame, 2);
  assert.equal(g.barH, 20);
  const borders = [g.leftFixed, g.leftFixed + g.leftFill, g.leftFixed + g.leftFill + g.plate,
    g.leftFixed + g.leftFill + g.plate + g.rightFill, g.width];
  assert.deepEqual(borders, [21, 27, 57, 63, 98]);
  // widgets unchanged: close@5, collapse@66, zoom@81, all 13px.
  assert.deepEqual(g.widgetSlots.map((s) => [s.glyph, s.x, s.size]),
    [['close', 5, 13], ['collapse', 66, 13], ['zoom', 81, 13]]);
});

test('every titlePlate type gets hasPlate + a non-degenerate 5-cell top scaled to its barH', () => {
  for (const cfg of WINDOW_TYPES.filter((c) => c.titlePlate)) {
    const g = geometryFor(cfg);
    assert.ok(g.hasPlate, `${cfg.slug} hasPlate`);
    assert.equal(g.barH, cfg.titleBarHeight, `${cfg.slug} bar height matches config`);
    // Strictly-increasing borders → no zero-width / collapsing fixed cells.
    const borders = [g.leftFixed, g.leftFixed + g.leftFill, g.leftFixed + g.leftFill + g.plate,
      g.leftFixed + g.leftFill + g.plate + g.rightFill, g.width];
    let prev = 0;
    for (const b of borders) { assert.ok(b > prev, `${cfg.slug} border ${b} !> ${prev}`); prev = b; }
    assert.ok(g.plate >= 12, `${cfg.slug} plate readable (${g.plate})`);
    // Widget boxes obey clamp(barH-7,5,13) and fit inside the bar.
    const want = Math.max(5, Math.min(13, cfg.titleBarHeight - 7));
    for (const s of g.widgetSlots) {
      assert.equal(s.size, want, `${cfg.slug} widget size`);
      assert.ok(s.size <= g.barH, `${cfg.slug} widget fits bar`);
    }
  }
});

test('title-less types stay no-plate 3-cell frames', () => {
  for (const slug of ['dialog', 'alert', 'no-title-utility-window', 'collapsed-no-title-utility']) {
    const g = geometryFor(bySlug(slug));
    assert.ok(!g.hasPlate, `${slug} has no plate`);
    assert.equal(g.barH, 0, `${slug} is title-less`);
    assert.equal(g.widgetSlots.length, 0, `${slug} has no widgets`);
  }
});

test('side-floating utility (titled, no widgets) still ships a full 5-cell plate', () => {
  const g = geometryFor(bySlug('side-floating-utility-window'));
  assert.ok(g.hasPlate);
  assert.equal(g.widgetSlots.length, 0);
  // Bare margins on both corners, plate + flanks in the middle.
  assert.ok(g.leftFixed > 0 && g.rightFixed > 0 && g.plate >= 12);
});
