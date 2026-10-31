import '../tests/helpers/registerTs.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const { loadOwnedKaleidoscopeScheme } = await import('./loadKaleidoscopeScheme.ts');
const { composeButton, composeSlider, composeProgress, composeDisclosure, composeTab, composeBevelButton, composeHeaderSurface } = await import('./controls.ts');
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
  const face = { sourceCicnId: -1, asset: 'first' };
  const source = { manifest: { chromeElements: { face }, patterns: {} } };
  const theme = { kind: 'owned-theme', origin: '', source, imageUrl: owner.imageUrl, dispose: owner.dispose };
  bindRasterOwner(source, owner);
  const pending = themeResourceChain(theme, [{ type: 'cicn', id: -1 }], { traceProvenance: true, signal: new AbortController().signal });
  await entered;
  face.asset = 'replacement';
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


test('owned slider, progress and disclosure rendering use owned pixels through disposal', async t => {
  const previous = globalThis.Image;
  globalThis.Image = class { constructor() { throw new Error('Unexpected image decoder'); } };
  t.after(() => { globalThis.Image = previous; });
  const theme = await loadOwnedKaleidoscopeScheme(bytes); t.after(theme.dispose);
  const calls = [() => composeSlider(theme), () => composeProgress(theme), () => composeDisclosure(theme)];
  for (const render of calls) await render();
  assert.equal(rasterOwner(theme.source).usage().images, 0);
  theme.dispose();
  for (const render of calls) await assert.rejects(render(), { name: 'AbortError' });
});


test('captured raster sources keep transport identity without starting work', async t => {
  const owner = createRasterAssetOwner([
    { path: 'first', width: 1, height: 1, rgba: new Uint8Array([21, 34, 55, 255]) },
    { path: 'replacement', width: 1, height: 1, rgba: new Uint8Array([200, 201, 202, 255]) },
  ], (_rgba, _w, _h, path) => `https://example.test/${path}.png`);
  const source = { manifest: { chromeElements: {} } };
  bindRasterOwner(source, owner); t.after(owner.dispose);
  const theme = { kind: 'owned-theme', origin: '', source, imageUrl: owner.imageUrl, dispose: owner.dispose };
  const first = themeView(theme).asset('first');
  assert.equal(owner.usage().images, 0);
  theme.source = { manifest: { chromeElements: {} } }; // captured owner survives source replacement
  assert.equal(await first.imageUrl(), 'https://example.test/first.png');
  assert.deepEqual([...(await first.pixels()).data], [21, 34, 55, 255]);
  owner.dispose();
  await assert.rejects(first.pixels(), { name: 'AbortError' });
  await assert.rejects(first.imageUrl(), { name: 'AbortError' });
  await assert.rejects(first.dimensions(), { name: 'AbortError' });
  const legacy = { baseUrl: '/before', manifest: { chromeElements: {} } };
  const captured = themeView(legacy).asset('image.png');
  legacy.baseUrl = '/after';
  assert.equal(await captured.imageUrl(), '/before/image.png');
});

const diagnosticFamilies = [
  ['tab', -9975, (theme, diagnostics) => composeTab(theme, { diagnostics })],
  ['bevel', -10163, (theme, diagnostics) => composeBevelButton(theme, { on: true, diagnostics })],
  ['header', -9567, (theme, diagnostics) => composeHeaderSurface(theme, {
    kind: 'window-header', width: 30, height: 20, drawState: 1, diagnostics,
    compositionContext: { controlOrigin: [0, 0], portOrigin: [0, 0], patternOrigin: { status: 'known', offset: [0, 0] },
      clip: { kind: 'rect', rect: { x: 0, y: 0, w: 30, h: 20 } } },
  })],
];
function diagnosticTheme(id, encoder) {
  const owner = createRasterAssetOwner(['first', 'replacement'].map((path, i) => ({ path, width: 3, height: 3,
    rgba: new Uint8Array(Array.from({ length: 9 }, () => i ? [200, 201, 202, 255] : [21, 34, 55, 255]).flat()) })), encoder);
  const face = { sourceCicnId: id, sourceCinfId: null, asset: 'first', width: 3, height: 3 };
  const source = { manifest: { chromeElements: { face }, patterns: {} } };
  bindRasterOwner(source, owner);
  return { owner, face, theme: { kind: 'owned-theme', origin: '/diagnostic', source, imageUrl: owner.imageUrl, dispose: owner.dispose } };
}
for (const [family, id, render] of diagnosticFamilies) {
  test(`${family} diagnostic export preserves primary errors and completes once`, async t => {
    const primary = new Error('selected image export failed');
    const { theme } = diagnosticTheme(id, () => { throw primary; }); t.after(theme.dispose);
    let completed = 0;
    await assert.rejects(render(theme, { onComplete(trace) {
      completed++; assert.equal(trace.outcome.status, 'error');
      assert.equal(JSON.stringify(trace).includes('scriptoscope-raster:'), false);
      throw new Error('diagnostic callback failed too');
    } }), error => error === primary);
    assert.equal(completed, 1);
  });
  test(`${family} held image export keeps selected identity and aborts on owner disposal`, async t => {
    for (const dispose of [false, true]) {
      let begin, release;
      const entered = new Promise(resolve => { begin = resolve; });
      const held = new Promise(resolve => { release = resolve; });
      const { theme, owner, face } = diagnosticTheme(id, async (_rgba, _w, _h, path) => {
        begin(); await held; return `https://example.test/${path}.png`;
      }); t.after(theme.dispose);
      let completed = 0, observed;
      const pending = render(theme, { onComplete(trace) { completed++; observed = trace; } });
      await entered;
      face.asset = 'replacement';
      if (dispose) theme.dispose();
      release();
      if (dispose) await assert.rejects(pending, { name: 'AbortError' }); else await pending;
      assert.equal(completed, 1);
      assert.equal(JSON.stringify(observed).includes('scriptoscope-raster:'), false);
      if (!dispose) {
        assert.ok(observed.steps.some(step => step.resource?.assetUrl === 'https://example.test/first.png'));
        assert.equal(observed.steps.some(step => step.resource?.assetUrl === 'https://example.test/replacement.png'), false);
        assert.equal(owner.usage().images, 1);
      } else {
        assert.equal(observed.outcome.status, 'error');
        assert.equal(owner.usage().pixelBytes, 0);
        assert.equal(owner.usage().pending, 0);
      }
    }
  });
}

test('clipped owned body diagnostics export a real image without decoding skipped pixels', async t => {
  const { CINF_HEADER, CINF_SAMPLE } = await import('./engine/tables/cinfFrame.ts');
  const header = new Uint8Array(CINF_SAMPLE.headerLength);
  header[CINF_HEADER.mode] = 5;
  new DataView(header.buffer).setInt16(CINF_HEADER.backgroundId, 42);
  const owner = createRasterAssetOwner([{ path: 'body', width: 1, height: 1,
    rgba: new Uint8Array([1, 2, 3, 255]) }], () => 'blob:clipped-body');
  t.after(owner.dispose);
  const previous = globalThis.Image;
  globalThis.Image = class { constructor() { throw new Error('Clipped pixels must not decode'); } };
  t.after(() => { globalThis.Image = previous; });
  const source = { manifest: { chromeElements: { body: { sourceCicnId: 42, asset: 'body' } },
    engineCinfs: { 1: [...header] } } };
  bindRasterOwner(source, owner);
  const theme = { kind: 'owned-theme', source, origin: '', imageUrl: owner.imageUrl, dispose: owner.dispose };
  const chain = await themeResourceChain(theme, [], { cinfBodies: [1], traceProvenance: true,
    bodyEnvironment: { owner: theme, face: {}, width: 0, height: 0 } });
  const trace = createTrace('clipped-transport');
  assert.equal(chain.getResource('cicn', 42, { trace }).value.status, 'clipped');
  assert.equal(trace.resolved[0].selection.resource.assetUrl, 'blob:clipped-body');
  assert.equal(owner.usage().images, 1);
});

test('eager results carry a pixel-free lifetime that disposal ends for every copy (#589)', async () => {
  const { loadKaleidoscopeScheme } = await import('./loadKaleidoscopeScheme.ts');
  const { assertThemeAlive } = await import('./ownedTheme.ts');
  const copyModule = await import('../tools/theme-loader/rasterAssets.js?eager-lifetime-copy');
  const theme = await loadKaleidoscopeScheme(bytes, { encodeAssets: true, assetUrlFactory: () => 'data:,never-revoked' });
  const copy = { ...theme, baseUrl: '/copy' };
  const life = copyModule.rasterLifetime(copy);
  assert.equal(life?.disposed, false, 'module copies and spread copies share the eager lifetime');
  assert.equal(rasterOwner(theme), undefined, 'eager results expose no private raster references');
  assert.equal(life.usage().pixelBytes, 0, 'the marker retains no pixels');
  assert.doesNotThrow(() => assertThemeAlive(themeView(copy)));
  theme.dispose();
  for (const input of [theme, copy]) {
    assert.equal(themeView(input).lifetime.disposed, true);
    assert.throws(() => assertThemeAlive(themeView(input)), { name: 'AbortError' });
    await assert.rejects(composeButton(input, { label: 'OK', minWidth: 60, height: 20 }), { name: 'AbortError' });
  }
  const ref = Object.values(theme.manifest.chromeElements)[0].asset;
  await assert.rejects(themeView({ ...theme }).asset(ref).pixels(), { name: 'AbortError' });
});
