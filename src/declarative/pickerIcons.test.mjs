import '../../tests/helpers/registerTs.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const { createPickerIconLoader } = await import('./pickerIcons.ts');
const source = await readFile(new URL('../../themes/1138/scheme.rsrc', import.meta.url));
const sparse = await readFile(new URL('../../themes/apple-platinum-2/scheme.sit', import.meta.url));

function canvas(t) {
  const previous = globalThis.document;
  let encodes = 0;
  globalThis.document = { createElement: () => ({
    getContext: () => ({ createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} }),
    toBlob: (done) => { encodes++; done(new Blob(['png'], { type: 'image/png' })); },
  }) };
  t.after(() => { globalThis.document = previous; });
  return () => encodes;
}

test('folder loader honors source hints, deduplicates and retries failed attempts', async (t) => {
  const encodes = canvas(t);
  const requests = [];
  let online = false;
  t.mock.method(globalThis, 'fetch', async (url) => {
    requests.push(url);
    if (!online) throw new Error('offline');
    return new Response(source);
  });
  const load = createPickerIconLoader({ themes: [{ slug: '1138', source: 'scheme.rsrc' }] });
  const first = load('1138', -3983, -3999);
  assert.equal(load('1138', -3983, -3999), first);
  await assert.rejects(first, /offline/);
  online = true;
  const url = await load('1138', -3983, -3999);
  assert.match(url, /^data:image\/png;base64,/);
  assert.equal(await load('1138', -3983, -3999), url);
  assert.deepEqual(requests, ['/themes/1138/scheme.rsrc', '/themes/1138/scheme.rsrc']);
  assert.equal(encodes(), 1);
});

test('folder loader falls through HTML responses and preserves sparse base inheritance', async (t) => {
  const encodes = canvas(t);
  const requests = [];
  t.mock.method(globalThis, 'fetch', async (url) => {
    requests.push(url);
    if (url.includes('apple-platinum-2')) return new Response(sparse);
    if (url.endsWith('scheme.sit')) return new Response('<!doctype html><html>SPA fallback</html>');
    return new Response(source);
  });
  const load = createPickerIconLoader({ baseSlug: '1138', themes: [{ slug: 'apple-platinum-2', source: 'scheme.sit' }] });
  assert.match(await load('apple-platinum-2', -3983, -3999), /^data:image\/png;base64,/);
  assert.deepEqual(requests, ['/themes/apple-platinum-2/scheme.sit', '/themes/1138/scheme.sit', '/themes/1138/scheme.rsrc']);
  assert.equal(encodes(), 1);
});
