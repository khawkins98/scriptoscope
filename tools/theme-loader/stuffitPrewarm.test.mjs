// When loadTheme asks for the lazy StuffIt decoder. The decoder is observed at
// the module boundary (requests for tools/sit-wasm/index.mjs) and at WASM
// instantiation. Order matters: the instantiation test must be the first thing
// in this process to reach the decoder, because it instantiates once.
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
let instantiations = 0;
const instantiate = WebAssembly.instantiate;
WebAssembly.instantiate = function (...args) { instantiations++; return instantiate.apply(this, args); };

const { loadTheme, loadOwnedTheme } = await import('../../src/loadTheme.ts');
const { prewarmStuffItDecoder } = await import('./loadKaleidoscopeScheme.js');

const fixture = async path => new Uint8Array(await readFile(new URL(`../../themes/${path}`, import.meta.url)));
const rsrc = await fixture('1138/scheme.rsrc'), sit = await fixture('1984/scheme.sit');
const tick = () => new Promise(resolve => setImmediate(resolve));
const settle = async () => { for (let i = 0; i < 20; i++) await tick(); };
const html = '<!doctype html><html><body>not found</body></html>';

/** Serve `routes[file]()` (file = last path segment without query or fragment); the
 *  rest are 404. Records each requested name and the decoder requests made by then. */
function serve(t, routes) {
  const previous = globalThis.fetch, seen = [];
  globalThis.fetch = async url => {
    const name = String(url).split('/').pop();
    seen.push({ name, decoderRequests: decoderRequests.length });
    const route = routes[name.split(/[?#]/)[0]];
    return route ? route() : new Response(null, { status: 404 });
  };
  t.after(() => { globalThis.fetch = previous; });
  return seen;
}
const options = { meta: { name: 'fixture' } };

test('no decoder request for anything that is not a named .sit path', async t => {
  const headerless = body => ({ ok: true, arrayBuffer: async () => body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength) });
  // What answers for scheme.sit in the default cascade; every case then loads scheme.rsrc.
  const cascade = {
    'absent (404)': undefined,
    'html, text/html': () => new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } }),
    'html, default content type': () => new Response(html),
    'html, no content type': () => { const response = new Response(new TextEncoder().encode(html)); response.headers.delete('content-type'); return response; },
    'html, octet-stream': () => new Response(html, { headers: { 'content-type': 'application/octet-stream' } }),
    'html, xhtml': () => new Response(html, { headers: { 'content-type': 'application/xhtml+xml' } }),
    'json error body': () => new Response('{"error":"not found","status":404}', { headers: { 'content-type': 'application/json' } }),
    'empty body': () => new Response(new Uint8Array(0), { headers: { 'content-type': 'application/octet-stream' } }),
    'header-less mock holding html': () => headerless(new TextEncoder().encode(html)),
    'body read rejects': () => ({ ok: true, headers: new Headers(), arrayBuffer: async () => { throw new Error('connection reset'); } }),
    'request rejects': () => { throw new TypeError('fetch failed'); },
  };
  for (const [label, answer] of Object.entries(cascade)) {
    const seen = serve(t, { ...(answer ? { 'scheme.sit': answer } : {}), 'scheme.rsrc': () => new Response(rsrc) });
    const theme = await loadTheme('/themes/fixture', options);
    theme.dispose?.();
    await settle();
    assert.deepEqual(seen.map(request => request.name), ['scheme.sit', 'scheme.rsrc'], label);
    assert.deepEqual(decoderRequests, [], label);
  }
  // Named sources whose path is not a .sit, however the rest of the name reads.
  for (const source of ['scheme.rsrc', 'scheme.rsrc?orig=scheme.sit', 'scheme.rsrc#1984.sit', 'scheme.sit.rsrc', 'sit']) {
    const seen = serve(t, { [source.split(/[?#]/)[0]]: () => new Response(rsrc) });
    for (const load of [loadTheme, loadOwnedTheme]) {
      const theme = await load('/themes/fixture', { ...options, source });
      theme.dispose?.();
    }
    await settle();
    assert.deepEqual(seen.map(request => request.name), [source, source]);
    assert.deepEqual(decoderRequests, [], source);
  }
  assert.equal(instantiations, 0);
});

test('warming requests the decoder and reaches WASM instantiation, without a result', async () => {
  assert.equal(instantiations, 0, 'nothing has instantiated the decoder yet');
  assert.equal(prewarmStuffItDecoder(), undefined);
  assert.equal(decoderRequests.length, 1, 'requested synchronously');
  for (let i = 0; i < 2000 && instantiations === 0; i++) await tick();
  assert.equal(instantiations, 1, 'importing the decoder module alone is not a warm decoder');
  decoderRequests.length = 0;
});

test('the default cascade leaves a present archive to the loader: one decoder request, after the body', async t => {
  let atBody;
  const seen = serve(t, { 'scheme.sit': () => {
    const response = new Response(sit);
    return { ok: true, headers: response.headers, arrayBuffer: async () => { await settle(); atBody = decoderRequests.length; return response.arrayBuffer(); } };
  } });
  const theme = await loadTheme('/themes/fixture', options);
  theme.dispose?.();
  assert.deepEqual(seen, [{ name: 'scheme.sit', decoderRequests: 0 }]);
  assert.equal(atBody, 0);
  assert.equal(decoderRequests.length, 1);
  assert.equal(theme.manifest.name, 'fixture');
  decoderRequests.length = 0;
});

test('a named .sit requests the decoder with the archive request, by path only', async t => {
  for (const load of [loadTheme, loadOwnedTheme]) for (const source of ['scheme.sit', 'scheme.sit?v=2', 'scheme.sit#top', 'Scheme.SIT']) {
    const seen = serve(t, { [source.split(/[?#]/)[0]]: () => new Response(sit) });
    const theme = await load('/themes/fixture', { ...options, source });
    theme.dispose?.();
    assert.deepEqual(seen, [{ name: source, decoderRequests: 1 }], source);
    assert.equal(decoderRequests.length, 2, 'the warm-up, then the import that decodes');
    decoderRequests.length = 0;
  }
});

test('a named .sit that is missing or holds a raw fork has still requested the decoder', async t => {
  const rejections = [], onRejection = reason => rejections.push(reason);
  process.on('unhandledRejection', onRejection);
  t.after(() => process.off('unhandledRejection', onRejection));

  let seen = serve(t, {});
  await assert.rejects(loadTheme('/themes/fixture', { ...options, source: 'scheme.sit' }),
    { message: 'loadTheme: /themes/fixture — no scheme.sit found' });
  await settle();
  assert.deepEqual(seen, [{ name: 'scheme.sit', decoderRequests: 1 }]);
  assert.equal(decoderRequests.length, 1);
  decoderRequests.length = 0;

  seen = serve(t, { 'scheme.sit': () => new Response(rsrc) });
  const theme = await loadTheme('/themes/fixture', { ...options, source: 'scheme.sit' });
  theme.dispose?.();
  await settle();
  assert.deepEqual(seen, [{ name: 'scheme.sit', decoderRequests: 1 }]);
  assert.equal(decoderRequests.length, 1, 'a raw fork never reaches the decoding import');
  assert.equal(theme.baseUrl, '/themes/fixture');
  assert.deepEqual(rejections, []);
});
