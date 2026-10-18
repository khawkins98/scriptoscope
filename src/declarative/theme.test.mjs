import '../../tests/helpers/registerTs.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const { createThemeResolver } = await import('./theme.ts');
const bytes = await readFile(new URL('../../themes/1138/scheme.rsrc', import.meta.url));

test('failed theme loads retry, while concurrent loads share one attempt', async (t) => {
  let requests = 0;
  let online = false;
  t.mock.method(globalThis, 'fetch', async (url) => {
    requests++;
    if (!online) throw new Error('offline');
    return new Response(String(url).endsWith('meta.json') ? '{}' : bytes);
  });
  const resolver = createThemeResolver({ themes: [{ slug: '1138', source: 'scheme.rsrc' }] });
  const first = resolver.load('1138');
  assert.equal(resolver.load('1138'), first);
  await assert.rejects(first, /no scheme.rsrc found/);
  assert.equal(requests, 1);
  online = true;
  const retried = await resolver.load('1138');
  assert.equal(retried.baseUrl, '/themes/1138');
  assert.equal(await resolver.load('1138'), retried);
  assert.equal(requests, 3);
});

test('failure from an older load cannot evict a registered replacement', async (t) => {
  let rejectFetch;
  t.mock.method(globalThis, 'fetch', () => new Promise((_resolve, reject) => { rejectFetch = reject; }));
  const resolver = createThemeResolver({ themes: [{ slug: '1138', source: 'scheme.rsrc' }] });
  const pending = resolver.load('1138');
  const replacement = { manifest: {}, baseUrl: 'registered' };
  resolver.register('1138', replacement);
  rejectFetch(new Error('offline'));
  await assert.rejects(pending);
  assert.equal(await resolver.load('1138'), replacement);
});
