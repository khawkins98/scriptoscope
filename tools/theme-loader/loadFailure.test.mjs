import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadKaleidoscopeScheme } from './loadKaleidoscopeScheme.js';

const bytes = await readFile(new URL('../../themes/1138/scheme.rsrc', import.meta.url));
for (const synchronous of [false, true]) {
  test(`failed ${synchronous ? 'synchronous' : 'asynchronous'} encoder revokes all completed URLs, including late workers`, async (t) => {
    const minted = new Set();
    const revoked = [];
    t.mock.method(URL, 'revokeObjectURL', (url) => revoked.push(url));
    const failure = new Error('encoder failed');
    let calls = 0;
    await assert.rejects(loadKaleidoscopeScheme(bytes, {
      encodeAssets: true,
      assetUrlFactory() {
        const index = calls++;
        if (index === 2) {
          if (synchronous) throw failure;
          return Promise.reject(failure);
        }
        return new Promise((resolve) => setImmediate(() => {
          const url = `blob:worker-${index}`;
          minted.add(url);
          resolve(url);
        }));
      },
    }), (error) => error === failure);
    assert.ok(minted.size > 100);
    assert.deepEqual(new Set(revoked), minted);
    assert.equal(revoked.length, minted.size);
  });
}

test('successful decode retains URLs until idempotent dispose, without revoking base resources', async (t) => {
  const revoked = [];
  t.mock.method(URL, 'revokeObjectURL', (url) => revoked.push(url));
  const theme = await loadKaleidoscopeScheme(bytes, { encodeAssets: true, assetUrlFactory: () => 'blob:owned' });
  let baseDisposals = 0;
  theme.base = { dispose() { baseDisposals++; } };
  assert.deepEqual(revoked, []);
  theme.dispose();
  theme.dispose();
  assert.deepEqual(revoked, ['blob:owned']);
  assert.equal(baseDisposals, 0);
});

test('post-encoding assembly failure releases registered pixels and every owned URL', async (t) => {
  const { decodedRaster } = await import('./rasterAssets.js');
  const previous = globalThis.OffscreenCanvas;
  t.after(() => { globalThis.OffscreenCanvas = previous; });
  globalThis.OffscreenCanvas = class {
    getContext() { return { createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} }; }
    async convertToBlob() { return new Blob([]); }
  };
  const minted = [], revoked = [];
  t.mock.method(URL, 'createObjectURL', () => { const url = `blob:assembly-${minted.length}`; minted.push(url); return url; });
  t.mock.method(URL, 'revokeObjectURL', url => revoked.push(url));
  let reads = 0;
  const failure = new Error('assembly failed after encoding');
  await assert.rejects(loadKaleidoscopeScheme(bytes, {
    encodeAssets: true,
    get meta() { if (++reads > 1) throw failure; return {}; },
  }), error => error === failure);
  assert.ok(minted.length > 100);
  assert.deepEqual(new Set(revoked), new Set(minted));
  for (const url of minted) assert.equal(decodedRaster(url), undefined);
});
