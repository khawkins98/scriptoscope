import '../tests/helpers/registerTs.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const { loadOwnedKaleidoscopeScheme } = await import('./loadKaleidoscopeScheme.ts');
const { composeButton } = await import('./controls.ts');
const { themeView } = await import('./ownedTheme.ts');
const { loadOwnedTheme } = await import('./loadTheme.ts');
import { rasterOwner, createRasterAssetOwner, bindRasterOwner } from '../tools/theme-loader/rasterAssets.js';
const { themeResourceChain } = await import('./engine/resources/theme.ts');
const { createTrace } = await import('./engine/trace.ts');

const bytes = await readFile(new URL('../themes/1138/scheme.rsrc', import.meta.url));

test('owned push/default rendering needs no image encoding or browser image decoder', async t => {
  const previous = globalThis.Image;
  globalThis.Image = class { constructor() { throw new Error('Unexpected image decoder'); } };
  t.after(() => { globalThis.Image = previous; });
  const theme = await loadOwnedKaleidoscopeScheme(bytes);
  t.after(theme.dispose);
  assert.equal('manifest' in theme, false, 'owned input cannot masquerade as a ready-image theme');
  assert.equal(themeView(theme), themeView(theme), 'normalization has stable identity');
  const owner = rasterOwner(theme.source);
  assert.equal(owner.usage().images, 0);
  for (const state of [{}, { pressed: true }, { disabled: true }]) {
    const pixels = await composeButton(theme, { minWidth: 80, height: 20, default: true, ...state });
    assert.ok(pixels?.data.some(value => value !== 0));
  }
  assert.equal(owner.usage().images, 0);
  theme.dispose();
  assert.equal(owner.usage().pixelBytes, 0);
  await assert.rejects(composeButton(theme), { name: 'AbortError' });
});

test('owned composition observes abort and owner disposal before publishing output', async t => {
  const theme = await loadOwnedKaleidoscopeScheme(bytes); t.after(theme.dispose);
  const controller = new AbortController();
  const pending = composeButton(theme, { minWidth: 80 }, controller.signal);
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  assert.equal(rasterOwner(theme.source).usage().images, 0);
  const disposed = composeButton(theme, { minWidth: 80 });
  theme.dispose();
  await assert.rejects(disposed, { name: 'AbortError' });
});

test('normalized owned sources retain live manifest and base reads', async t => {
  const theme = await loadOwnedKaleidoscopeScheme(bytes); t.after(theme.dispose);
  const view = themeView(theme);
  const base = { baseUrl: '/legacy', manifest: theme.source.manifest };
  theme.base = base;
  assert.equal(view.base, themeView(base));
  theme.source.manifest = { ...theme.source.manifest, name: 'changed' };
  assert.equal(view.manifest.name, 'changed');
  delete theme.base;
  assert.equal(view.base, undefined);
});

test('owned bundle loading preserves URL identity and borrows its base', async t => {
  const base = await loadOwnedKaleidoscopeScheme(bytes); t.after(base.dispose);
  const previous = globalThis.fetch;
  globalThis.fetch = async url => {
    assert.equal(url, '/themes/1138/scheme.rsrc');
    return new Response(bytes);
  };
  t.after(() => { globalThis.fetch = previous; });
  const theme = await loadOwnedTheme('/themes/1138/', { source: 'scheme.rsrc', meta: { name: '1138' }, base });
  assert.equal(theme.origin, '/themes/1138');
  assert.equal('baseUrl' in theme.source, false);
  assert.equal(theme.base, base);
  assert.ok(await composeButton(theme));
  assert.equal(rasterOwner(theme.source).usage().images, 0);
  theme.dispose();
  assert.ok(rasterOwner(base.source).usage().pixelBytes > 0);
});

test('owned custom encoders remain authoritative at the browser decode boundary', async t => {
  const previous = globalThis.Image;
  globalThis.Image = class { async decode() { throw new Error('custom image adapter reached'); } };
  t.after(() => { globalThis.Image = previous; });
  let calls = 0;
  const theme = await loadOwnedKaleidoscopeScheme(bytes, { assetUrlFactory: () => { calls++; return 'https://example.test/transformed.png'; } });
  t.after(theme.dispose);
  assert.equal(calls, 0);
  await assert.rejects(composeButton(theme), /custom image adapter reached/);
  assert.ok(calls > 0);
});

test('diagnostic image export cannot replace the selected pixel snapshot during its await', async t => {
  let release, started;
  const held = new Promise(resolve => { release = resolve; });
  const entered = new Promise(resolve => { started = resolve; });
  const owner = createRasterAssetOwner([
    { path: 'first', width: 1, height: 1, rgba: new Uint8Array([1, 2, 3, 255]) },
    { path: 'replacement', width: 1, height: 1, rgba: new Uint8Array([200, 201, 202, 255]) },
  ], () => { started(); return held; });
  t.after(owner.dispose);
  const face = { sourceCicnId: -1, asset: owner.references.get('first') };
  const theme = { baseUrl: '', manifest: { chromeElements: { face }, patterns: {} } };
  bindRasterOwner(theme, owner);
  const pending = themeResourceChain(theme, [{ type: 'cicn', id: -1 }], { traceProvenance: true, signal: new AbortController().signal });
  await entered;
  face.asset = owner.references.get('replacement');
  release('blob:initial-selected-image');
  const chain = await pending;
  const trace = createTrace('snapshot');
  const selected = chain.getResource('cicn', -1, { trace });
  assert.deepEqual([...selected.value.pixmap.data], [1, 2, 3, 255]);
  assert.equal(trace.resolved[0].selection.resource.assetUrl, 'blob:initial-selected-image');
});

test('legacy sampled references resolve against the selected owner exactly once', async t => {
  const previous = { Image: globalThis.Image, document: globalThis.document };
  t.after(() => Object.assign(globalThis, previous));
  const requested = [];
  globalThis.Image = class {
    naturalWidth = 1; naturalHeight = 1;
    async decode() { requested.push(this.src); }
  };
  globalThis.document = { createElement: () => ({ getContext: () => ({
    drawImage() {}, getImageData: () => ({ data: new Uint8ClampedArray([1, 2, 3, 255]) }),
  }) }) };
  const declaration = { model: 'kaleidoscope-2.3.1-opaque-sampling-v1', comparison: 'opaque-current-display-rgb',
    displayPolicy: 'mac-1.8-to-2.2-high-byte', width: 1, height: 1 };
  const theme = { baseUrl: '/legacy-relative', manifest: { chromeElements: { face: {
    sourceCicnId: -1, asset: 'cicns/face.png',
    samplingEquivalence: { ...declaration, status: 'different', reason: 'opaque-display-mismatch' },
    sampledBandAsset: { ...declaration, asset: 'cicn-sampled/test.png', derivedPath: 'cicn-sampled/test.png' },
  } } } };
  await themeResourceChain(theme, [{ type: 'cicn', id: -1 }], { prepareSamples: async chain => {
    await chain.getResource('cicn', -1).value.prepareSampled();
  } });
  assert.deepEqual(requested, ['/legacy-relative/cicns/face.png', '/legacy-relative/cicn-sampled/test.png']);
});
