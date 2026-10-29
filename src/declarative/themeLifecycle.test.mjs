import '../../tests/helpers/registerTs.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const { createThemeResolver } = await import('./theme.ts');
const bytes = await readFile(new URL('../../themes/1138/scheme.rsrc', import.meta.url));

function setup(t, gate = Promise.resolve()) {
  const prior = globalThis.OffscreenCanvas;
  t.after(() => { globalThis.OffscreenCanvas = prior; });
  const minted = [];
  const revoked = [];
  let markStarted;
  const started = new Promise((resolve) => { markStarted = resolve; });
  globalThis.OffscreenCanvas = class {
    getContext() { return { createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} }; }
    async convertToBlob() { markStarted(); await gate; return new Blob(); }
  };
  t.mock.method(URL, 'createObjectURL', () => {
    const url = `blob:lifecycle-${minted.length}`;
    minted.push(url);
    return url;
  });
  t.mock.method(URL, 'revokeObjectURL', (url) => { revoked.push(url); });
  t.mock.method(globalThis, 'fetch', async (url) => new Response(String(url).endsWith('meta.json') ? '{}' : bytes));
  return { minted, revoked, started };
}
const hints = { themes: [{ slug: '1138', source: 'scheme.rsrc' }, { slug: 'child', source: 'scheme.rsrc' }] };

test('resolver disposal releases internally loaded themes and base once, and invalidates its API', async (t) => {
  const { minted, revoked } = setup(t);
  const resolver = createThemeResolver({ ...hints, baseSlug: '1138' });
  const child = await resolver.load('child');
  assert.ok(child.base);
  assert.ok(minted.length > 1000);
  assert.equal(revoked.length, 0);
  resolver.dispose();
  resolver.dispose();
  assert.deepEqual(revoked, minted);
  await assert.rejects(resolver.load('child'), /disposed/);
  await assert.rejects(resolver.preloadFonts(), /disposed/);
  assert.throws(() => resolver.register('external', child), /disposed/);
});

test('registration borrows the supplied base graph, even a previously owned base and cycles', async (t) => {
  const { minted, revoked } = setup(t);
  const resolver = createThemeResolver(hints);
  const base = await resolver.load('1138');
  let externalDisposals = 0;
  const external = { baseUrl: 'external', manifest: {}, base, dispose: () => { externalDisposals++; } };
  base.base = external;
  resolver.register('external', external);
  assert.equal(await resolver.load('external'), external);
  resolver.dispose();
  assert.deepEqual(revoked, []);
  assert.equal(externalDisposals, 0);
  // Caller owns the borrowed theme lifetime after registration.
  base.dispose();
  assert.deepEqual(revoked, minted);
});

test('pending encoders clean up after disposal without touching a registered replacement', async (t) => {
  let finish;
  const gate = new Promise((resolve) => { finish = resolve; });
  const { minted, revoked, started } = setup(t, gate);
  const resolver = createThemeResolver(hints);
  const pending = resolver.load('1138');
  await started;
  let externalDisposals = 0;
  const external = { manifest: {}, baseUrl: 'external', dispose: () => { externalDisposals++; } };
  resolver.register('1138', external);
  resolver.dispose();
  finish();
  await assert.rejects(pending, /disposed/);
  assert.ok(minted.length > 100);
  assert.deepEqual(revoked, minted);
  assert.equal(externalDisposals, 0);
});

test('disposal during a pending base load prevents starting the child decode', async (t) => {
  let finish;
  const gate = new Promise((resolve) => { finish = resolve; });
  const { minted, revoked, started } = setup(t, gate);
  const requested = [];
  t.mock.method(globalThis, 'fetch', async (url) => {
    requested.push(String(url));
    return new Response(String(url).endsWith('meta.json') ? '{}' : bytes);
  });
  const resolver = createThemeResolver({ ...hints, baseSlug: '1138' });
  const pending = resolver.load('child');
  await started;
  resolver.dispose();
  finish();
  await assert.rejects(pending, /disposed/);
  assert.ok(requested.every((url) => url.startsWith('/themes/1138/')));
  assert.deepEqual(revoked, minted);
});

test('owned resolver shares raw loads, borrows registered mixed base graphs and disposes only its loads', async t => {
  const { createOwnedThemeResolver } = await import('./theme.ts');
  const { rasterOwner } = await import('../../tools/theme-loader/rasterAssets.js');
  const { minted } = setup(t);
  const resolver = createOwnedThemeResolver({ ...hints, baseSlug: '1138' });
  const first = resolver.load('child');
  assert.equal(resolver.load('child'), first);
  const child = await first, base = child.base;
  assert.equal(child.kind, 'owned-theme');
  assert.equal(base.kind, 'owned-theme');
  assert.equal(minted.length, 0, 'resolver loading alone exports no images');
  let externalDisposals = 0;
  const external = { manifest: {}, baseUrl: 'external', base, dispose() { externalDisposals++; } };
  resolver.register('external', external);
  assert.equal(await resolver.load('external'), external);
  resolver.dispose();
  assert.equal(rasterOwner(child.source).disposed, true);
  assert.equal(rasterOwner(child.source).usage().pixelBytes, 0);
  assert.equal(rasterOwner(base.source).disposed, false, 'registered bases are borrowed');
  assert.equal(externalDisposals, 0);
  base.dispose();
});

test('owned resolver rejects a pending load after disposal without encoding images', async t => {
  const { createOwnedThemeResolver } = await import('./theme.ts');
  const { minted } = setup(t);
  let finish;
  t.mock.method(globalThis, 'fetch', url => String(url).endsWith('meta.json')
    ? Promise.resolve(new Response('{}')) : new Promise(resolve => { finish = () => resolve(new Response(bytes)); }));
  const resolver = createOwnedThemeResolver(hints);
  const pending = resolver.load('1138');
  resolver.dispose();
  finish();
  await assert.rejects(pending, /disposed/);
  assert.equal(minted.length, 0);
});
