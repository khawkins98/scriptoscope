// scripts/generate-platinum/manifest.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildDocumentWindowAssets } from './manifest.mjs';
import { buildThemeJson } from '../../tools/theme-loader/buildThemeJson.js';
import { validateTheme } from '../../tools/theme-loader/validateTheme.js';

const drawn = {
  active:   { width: 40, height: 22 },
  inactive: { width: 40, height: 22 },
  stipple:  { width: 8, height: 8 },
};

test('assets carry canonical document-window IDs (inactive -14336, active -14335)', () => {
  const assets = buildDocumentWindowAssets(drawn);
  const ids = assets.filter(a => a.type === 'cicn').map(a => a.id).sort((x, y) => x - y);
  assert.deepEqual(ids, [-14336, -14335]);
  assert.ok(assets.some(a => a.type === 'wnd#' && a.id === -14336));
});

test('buildThemeJson yields a document-window type with active+inactive chrome, and validates', () => {
  const assets = buildDocumentWindowAssets(drawn);
  const theme = buildThemeJson({ source: 'generated', extractedAt: 'x', counts: {}, assets });
  assert.ok(theme.windowTypes['document-window'], 'document-window window type present');
  assert.ok(theme.windowTypes['document-window'].chrome.active);
  assert.ok(theme.windowTypes['document-window'].chrome.inactive);
  assert.doesNotThrow(() => validateTheme(theme));
});
