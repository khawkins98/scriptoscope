// When loadTheme asks for the lazy StuffIt decoder. The decoder is observed at
// the module boundary (requests for tools/sit-wasm/index.mjs), so the cases that
// must never request it run first, before anything in this process has.
import '../../tests/helpers/registerTs.mjs';
import { registerHooks } from 'node:module';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const decoderRequests = [];
registerHooks({
  resolve(specifier, context, next) {
    if (/sit-wasm\/index\.mjs$/.test(specifier)) decoderRequests.push(specifier);
    return next(specifier, context);
  },
});
const { loadTheme } = await import('../../src/loadTheme.ts');
const { prewarmStuffItDecoder } = await import('./loadKaleidoscopeScheme.js');

const fixture = async path => new Uint8Array(await readFile(new URL(`../../themes/${path}`, import.meta.url)));
const rsrc = await fixture('1138/scheme.rsrc'), sit = await fixture('1984/scheme.sit');
const tick = () => new Promise(resolve => setImmediate(resolve));

/** Serve `routes[filename]()`; unlisted files are 404. Records request order. */
function serve(t, routes) {
  const previous = globalThis.fetch, seen = [];
  globalThis.fetch = async url => {
    const name = String(url).split('/').pop();
    seen.push(name);
    return routes[name] ? routes[name]() : new Response(null, { status: 404 });
  };
  t.after(() => { globalThis.fetch = previous; });
  return seen;
}
const options = { meta: { name: 'fixture' } };

test('a named resource fork never requests the decoder', async t => {
  const seen = serve(t, { 'scheme.rsrc': () => new Response(rsrc) });
  const theme = await loadTheme('/themes/fixture', { ...options, source: 'scheme.rsrc' });
  theme.dispose?.();
  await tick();
  assert.deepEqual(seen, ['scheme.rsrc']);
  assert.deepEqual(decoderRequests, []);
});

test('the default cascade never requests the decoder when only the resource fork exists', async t => {
  const seen = serve(t, { 'scheme.rsrc': () => new Response(rsrc) });
  const theme = await loadTheme('/themes/fixture', options);
  theme.dispose?.();
  await tick();
  assert.deepEqual(seen, ['scheme.sit', 'scheme.rsrc']);
  assert.deepEqual(decoderRequests, []);
});

test('an HTML fallback answering for the absent archive does not request the decoder', async t => {
  serve(t, {
    'scheme.sit': () => new Response('<!doctype html><html><body>not found</body></html>', { headers: { 'content-type': 'text/html; charset=utf-8' } }),
    'scheme.rsrc': () => new Response(rsrc),
  });
  const theme = await loadTheme('/themes/fixture', options);
  theme.dispose?.();
  await tick();
  assert.deepEqual(decoderRequests, []);
});

test('the default cascade requests the decoder once the archive responds, before its body arrives', async t => {
  let requestsAtResponse, requestsBeforeBody;
  serve(t, { 'scheme.sit': () => {
    requestsAtResponse = decoderRequests.length;
    const response = new Response(sit);
    return { ok: true, headers: response.headers, arrayBuffer: async () => {
      requestsBeforeBody = decoderRequests.length;
      return response.arrayBuffer();
    } };
  } });
  const theme = await loadTheme('/themes/fixture', options);
  theme.dispose?.();
  assert.equal(requestsAtResponse, 0);
  assert.equal(requestsBeforeBody, 1);
  assert.equal(theme.manifest.name, 'fixture');
});

test('a named archive requests the decoder with the request, and a failed request stays the reported error', async t => {
  let requestsAtFetch;
  const before = decoderRequests.length;
  serve(t, { 'scheme.sit': () => { requestsAtFetch = decoderRequests.length - before; return new Response(null, { status: 404 }); } });
  const rejections = [];
  const onRejection = reason => rejections.push(reason);
  process.on('unhandledRejection', onRejection);
  t.after(() => process.off('unhandledRejection', onRejection));
  await assert.rejects(loadTheme('/themes/fixture', { ...options, source: 'scheme.sit' }),
    { message: 'loadTheme: /themes/fixture — no scheme.sit found' });
  assert.equal(requestsAtFetch, 1);
  await tick();
  assert.deepEqual(rejections, []);
});

test('warming is silent and leaves the decode result unchanged', async t => {
  assert.equal(prewarmStuffItDecoder(), undefined);
  serve(t, { 'scheme.sit': () => new Response(sit) });
  const theme = await loadTheme('/themes/fixture', { ...options, source: 'scheme.sit' });
  theme.dispose?.();
  assert.equal(theme.baseUrl, '/themes/fixture');
  assert.ok(Object.keys(theme.manifest.elements ?? theme.manifest).length > 0);
});
