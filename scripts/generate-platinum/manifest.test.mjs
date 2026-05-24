// scripts/generate-platinum/manifest.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildAllWindowAssets, cicnFiles } from './manifest.mjs';
import { WINDOW_TYPES, geometryFor } from './window-types.mjs';
import { buildThemeJson } from '../../tools/theme-loader/buildThemeJson.js';
import { validateTheme } from '../../tools/theme-loader/validateTheme.js';

// Synthesize a minimal "drawn" map (only dims are read by the manifest).
function fakeDrawn() {
  const out = {};
  for (const cfg of WINDOW_TYPES) {
    const geo = geometryFor(cfg);
    const img = { width: geo.width, height: geo.height };
    out[cfg.slug] = { active: img, inactive: img, geo };
  }
  return out;
}
const STIPPLE = { width: 8, height: 8 };

test('document-window keeps its canonical IDs (inactive -14336, active -14335)', () => {
  const assets = buildAllWindowAssets(fakeDrawn(), { stipple: STIPPLE });
  const docCicns = assets.filter(a => a.type === 'cicn' && (a.id === -14336 || a.id === -14335));
  assert.equal(docCicns.length, 2);
  assert.ok(assets.some(a => a.type === 'wnd#' && a.id === -14336));
});

test('all 13 types emit a cicn pair + wnd# + cinf', () => {
  const assets = buildAllWindowAssets(fakeDrawn(), { stipple: STIPPLE });
  assert.equal(assets.filter(a => a.type === 'wnd#').length, 13);
  assert.equal(assets.filter(a => a.type === 'cinf').length, 13);
  assert.equal(assets.filter(a => a.type === 'cicn').length, 26); // 13 × active/inactive
});

test('every wnd# body rect is non-degenerate (lint requires right>left, bottom>top)', () => {
  const assets = buildAllWindowAssets(fakeDrawn(), { stipple: STIPPLE });
  for (const a of assets.filter(x => x.type === 'wnd#')) {
    const body = a.data.rectangles.find(r => r.part === 0);
    assert.ok(body, `${a.name} has a part-0 body rect`);
    const { top, left, bottom, right } = body.rect;
    assert.ok(right > left && bottom > top, `${a.name} body degenerate: ${JSON.stringify(body.rect)}`);
  }
});

test('top recipe is fixed-corner / GROW-fill / fixed-corner (no collapse codes)', () => {
  const assets = buildAllWindowAssets(fakeDrawn(), { stipple: STIPPLE });
  for (const a of assets.filter(x => x.type === 'wnd#')) {
    const parts = a.data.topSide.map(s => s.part);
    assert.deepEqual(parts, [1, 8, 1], `${a.name} top recipe parts`);
    // Borders strictly increase (no zero-width / collapsing cells).
    let prev = 0;
    for (const s of a.data.topSide) { assert.ok(s.border > prev, `${a.name} border ${s.border} !> ${prev}`); prev = s.border; }
  }
});

test('collapsed types ship ONLY a top recipe (empty bottom/left/right)', () => {
  const assets = buildAllWindowAssets(fakeDrawn(), { stipple: STIPPLE });
  const collapsedNames = WINDOW_TYPES.filter(c => c.collapsed).map(c => c.name);
  for (const a of assets.filter(x => x.type === 'wnd#' && collapsedNames.includes(x.name))) {
    assert.ok(a.data.topSide.length > 0, `${a.name} has a top recipe`);
    assert.equal(a.data.bottomSide.length, 0);
    assert.equal(a.data.leftSide.length, 0);
    assert.equal(a.data.rightSide.length, 0);
  }
});

test('buildThemeJson yields all 13 named windowTypes with active+inactive chrome, and validates', () => {
  const assets = buildAllWindowAssets(fakeDrawn(), { stipple: STIPPLE });
  const theme = buildThemeJson({ source: 'generated', extractedAt: 'x', counts: {}, assets });
  for (const cfg of WINDOW_TYPES) {
    const wt = theme.windowTypes[cfg.slug];
    assert.ok(wt, `windowType ${cfg.slug} present`);
    assert.ok(wt.chrome.active && wt.chrome.inactive, `${cfg.slug} has both chrome states`);
  }
  assert.doesNotThrow(() => validateTheme(theme));
});

test('cicnFiles produces stable n<absId> filenames', () => {
  const cfg = WINDOW_TYPES[0];
  const f = cicnFiles(cfg, cfg.wndId, cfg.wndId + 1);
  assert.match(f.inactive, /cicns\/cicn-n14336-document-window-inactive\.png/);
  assert.match(f.active, /cicns\/cicn-n14335-document-window-active\.png/);
});
