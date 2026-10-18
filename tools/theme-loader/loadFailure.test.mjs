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
