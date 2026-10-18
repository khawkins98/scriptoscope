import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { loadKaleidoscopeScheme } from '../tools/theme-loader/loadKaleidoscopeScheme.js';

import '../tests/helpers/registerTs.mjs';
const { resolveWindowType, resolveWindowSelection, resolveCollapsedWindowTypeSlug } = await import('./resolveWindowType.ts');

const frame = (asset) => ({ chrome: { active: asset }, parts: { 'part-0': { rect: [1, 10, 40, 30] } }, edges: { top: [{ at: 1, part: 'part-1' }] } });
test('utility aliases use type identity and reject author-labelled grow boxes', () => {
  const titled = frame('blob:titled');
  const side = frame('blob:side');
  const modal = frame('blob:modal');
  const theme = { manifest: { windowTypes: { 'movable-modal': modal, 'side-floating-utility-window': side, 'titled-utility-window': titled } } };
  for (const alias of ['utility', 'mini', 'floating', 'palette']) assert.equal(resolveWindowType(theme, alias), titled);
  assert.equal(resolveWindowType(theme, 'side-floating-utility-window'), side);
  theme.manifest.chromeElements = { arbitrary: { asset: 'blob:titled', authorLabel: 'Active Grow Box' } };
  assert.equal(resolveWindowType(theme, 'utility'), side);
  delete side.edges;
  assert.equal(resolveWindowType(theme, 'utility'), modal);
});

test('legacy raw wnd# keys retain utility identity with opaque assets', () => {
  const titled = frame('blob:raw-titled');
  const side = frame('blob:raw-side');
  const theme = { manifest: { windowTypes: {
    'wnd--14300': frame('blob:collapsed'),
    'movable-modal': frame('blob:modal'),
    'wnd--14296': side,
    'wnd--14304': titled,
  } } };
  for (const alias of ['utility', 'mini', 'floating', 'palette']) assert.equal(resolveWindowType(theme, alias), titled);
  assert.equal(resolveWindowType(theme, 'wnd--14296'), side);
  delete theme.manifest.windowTypes['wnd--14304'];
  assert.equal(resolveWindowType(theme, 'utility'), side);
});

test('every corpus alias and canonical type resolves identically with filenames and opaque URLs', async () => {
  const root = new URL('../themes/', import.meta.url);
  let checked = 0;
  for (const dir of await readdir(root, { withFileTypes: true })) {
    if (!dir.isDirectory()) continue;
    const files = await readdir(new URL(`${dir.name}/`, root));
    const archive = ['scheme.sit', 'scheme.rsrc'].find((name) => files.includes(name));
    if (!archive) continue;
    const bytes = await readFile(new URL(`${dir.name}/${archive}`, root));
    let sequence = 0;
    const named = await loadKaleidoscopeScheme(bytes, { encodeAssets: true, assetUrlFactory: (_rgba, _w, _h, path) => path });
    const opaque = await loadKaleidoscopeScheme(bytes, { encodeAssets: true, assetUrlFactory: () => `blob:opaque-${sequence++}` });
    const key = (theme, slug) => Object.entries(theme.manifest.windowTypes).find(([, value]) => value === resolveWindowType(theme, slug))?.[0];
    for (const slug of ['utility', 'mini', 'floating', 'palette', ...Object.keys(named.manifest.windowTypes)]) {
      assert.equal(key(opaque, slug), key(named, slug), `${dir.name}: ${slug}`);
    }
    checked++;
  }
  assert.ok(checked >= 18);
});

test('exact custom and conflicting equivalent keys win before deterministic aliases and fallback', () => {
  const canonical = frame('opaque:a'), legacy = frame('opaque:b'), raw = frame('opaque:c'), base = frame('opaque:d');
  const theme = { manifest: { windowTypes: {
    'collapsed-titled-utility-window': canonical, 'collapsed-titled-utility': legacy,
    'wnd--14300': raw, 'titled-utility-window': base, 'my-tools': raw,
  } } };
  assert.equal(resolveWindowType(theme, 'collapsed-titled-utility-window'), canonical);
  assert.equal(resolveWindowType(theme, 'collapsed-titled-utility'), legacy);
  assert.equal(resolveWindowType(theme, 'wnd--14300'), raw);
  assert.equal(resolveWindowType(theme, 'my-tools'), raw);
  delete theme.manifest.windowTypes['collapsed-titled-utility-window'];
  assert.equal(resolveWindowType(theme, 'collapsed-titled-utility-window'), legacy);
  delete theme.manifest.windowTypes['collapsed-titled-utility'];
  assert.equal(resolveWindowType(theme, 'collapsed-titled-utility-window'), raw);
  delete theme.manifest.windowTypes['wnd--14300'];
  assert.equal(resolveWindowType(theme, 'collapsed-titled-utility-window'), base);
});
test('historical fallback attempts expand legacy and raw keys, without mutating the manifest', () => {
  const collapsed = frame('opaque:c'), expanded = frame('opaque:e');
  for (const key of ['collapsed-titled-utility', 'wnd--14300']) {
    const theme = { manifest: { windowTypes: { [key]: collapsed, 'titled-utility-window': expanded } } };
    const before = JSON.stringify(theme.manifest);
    assert.equal(resolveWindowType(theme, 'collapsed-no-title-utility-window'), collapsed);
    assert.equal(JSON.stringify(theme.manifest), before);
  }
});
test('collapse discovery accepts corner sprites and retains expanded selection ownership', () => {
  const expanded = frame('opaque:expanded'), collapsed = { ...frame('opaque:collapsed'), model: 'corner-sprite' };
  delete collapsed.edges;
  const base = { manifest: { windowTypes: { 'titled-utility-window': expanded, 'collapsed-titled-utility': collapsed } } };
  const childFallback = frame('opaque:child');
  const child = { manifest: { windowTypes: { 'document-window': childFallback } }, base };
  assert.equal(resolveWindowSelection(child, 'titled-utility-window').owner, child);
  assert.equal(resolveCollapsedWindowTypeSlug(child, 'titled-utility-window'), undefined);
  child.manifest.windowTypes = {};
  assert.equal(resolveWindowSelection(child, 'titled-utility-window').owner, base);
  assert.equal(resolveCollapsedWindowTypeSlug(child, 'titled-utility-window'), 'collapsed-titled-utility');
  assert.equal(resolveCollapsedWindowTypeSlug(child, 'wnd--14304'), 'collapsed-titled-utility');
  child.manifest.windowTypes = { 'my-tool': expanded, 'collapsed-my-tool': collapsed };
  assert.equal(resolveCollapsedWindowTypeSlug(child, 'my-tool'), 'collapsed-my-tool');
  assert.equal(resolveCollapsedWindowTypeSlug(child, 'unknown'), undefined);
});
