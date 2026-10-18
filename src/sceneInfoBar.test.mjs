import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { loadKaleidoscopeScheme } from '../tools/theme-loader/loadKaleidoscopeScheme.js';
import { resolveSceneInfoBar } from '../scripts/lib/scene-info-bar.mjs';

test('dark header colors do not override the black label on a textured info bar', () => {
  const bg = resolveSceneInfoBar({ headerColors: { active: { fill: '#101010' } },
    chromeElements: { arbitrary: { sourceCicnId: -9567, bgPattern: 'opaque-key' } },
    patterns: { 'opaque-key': { asset: 'blob:header' } }, bodyBackground: { pattern: 'blob:body' } });
  assert.equal(bg.backgroundTier, 1);
  assert.equal(bg.pattern, 'blob:header');
  assert.equal(bg.textColor, '#000');
  assert.equal(bg.textTier, 2);
});

test('missing declared header art falls through to the body pattern before dark solid fill', () => {
  const bg = resolveSceneInfoBar({ headerColors: { active: { fill: '#101010' } },
    chromeElements: { header: { sourceCicnId: -9567, bgPattern: 'missing' } },
    bodyBackground: { pattern: 'body.png' } });
  assert.equal(bg.backgroundTier, 2);
  assert.equal(bg.pattern, 'body.png');
  assert.equal(bg.textColor, '#000');
});

test('solid info bars contrast-pick black or white and absent colors retain the flat default', () => {
  for (const [fill, color, tier] of [['#202020', '#fff', 1], ['#d6ff76', '#000', 2]]) {
    const bg = resolveSceneInfoBar({ headerColors: { active: { fill } } });
    assert.equal(bg.backgroundTier, 3);
    assert.equal(bg.textColor, color);
    assert.equal(bg.textTier, tier);
  }
  const fallback = resolveSceneInfoBar();
  assert.equal(fallback.backgroundTier, 4);
  assert.equal(fallback.fill, '#e6e6e6');
  assert.equal(fallback.textColor, '#000');
  assert.equal(fallback.textTier, 2);
});

test('malformed solid colors flag audit fallback; unused malformed fills do not invalidate patterns', () => {
  const headerColors = { active: { fill: '#zzzzzz' } };
  assert.equal(resolveSceneInfoBar({ headerColors }).textTier, 3);
  assert.equal(resolveSceneInfoBar({ headerColors, bodyBackground: { pattern: 'pattern.png' } }).textTier, 2);
});

test('real textured corpus info bars report the black text drawn by the diagnostic', async () => {
  for (const slug of ['1984', '1990', 'animals', 'dolphin-som', 'evolution', 'monkey-paradise']) {
    const dir = new URL(`../themes/${slug}/`, import.meta.url);
    const source = ['scheme.sit', 'scheme.rsrc'].map(p => new URL(p, dir)).find(existsSync);
    const theme = await loadKaleidoscopeScheme(readFileSync(source), { encodeAssets: false });
    const bg = resolveSceneInfoBar(theme.manifest);
    assert.ok(bg.pattern, slug);
    assert.equal(bg.textColor, '#000', slug);
    assert.equal(bg.textTier, 2, slug);
  }
});
