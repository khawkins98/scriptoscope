// The decode-worker option as the URL loaders and theme resolvers pass it on: where
// the StuffIt decoder is requested, when a factory is called, what is forwarded, and
// resolver disposal while a worker decode is pending. Main-thread decoder requests
// are observed at the module boundary; the cases that must not make one run first.
import '../../tests/helpers/registerTs.mjs';
import { registerHooks } from 'node:module';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { hostedDecodeWorker, silentDecodePort, nextTask, within, until } from '../../tests/helpers/decode-worker-ports.mjs';

const decoderRequests = [];
registerHooks({
  resolve(specifier, context, next) {
    if (/sit-wasm\/index\.mjs$/.test(specifier)) decoderRequests.push(specifier);
    return next(specifier, context);
  },
});
const { loadOwnedTheme, loadTheme } = await import('../loadTheme.ts');
const { createOwnedThemeResolver, createThemeResolver } = await import('./theme.ts');
const { onAssetUrlReleased } = await import('../../tools/theme-loader/assetLifecycle.js');

const fixture = async path => new Uint8Array(await readFile(new URL(`../../themes/${path}`, import.meta.url)));
const rsrc = await fixture('1138/scheme.rsrc'), sit = await fixture('1984/scheme.sit');
const meta = { name: 'fixture' };
const failed = error => error instanceof Error && error.code === 'DECODE_WORKER_FAILED';

/** Serve `routes[filename]()`; unlisted files are 404. */
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

test('a named .sit bound for the worker asks the worker for the decoder, with the archive request', async t => {
  const port = silentDecodePort({ alive: true });
  let postedAtRequest;
  serve(t, { 'scheme.sit': () => { postedAtRequest = port.types(); return new Response(sit); } });
  const outcome = await within(loadOwnedTheme('/themes/fixture', { meta, source: 'scheme.sit', decodeWorker: port, decodeWorkerTimeoutMs: 40 }), 2000);
  assert.ok(failed(outcome.rejected));
  assert.equal(outcome.rejected.message, 'Scriptoscope decode worker failed: no response within 40 ms', 'loadTheme forwards the timeout');
  assert.deepEqual(postedAtRequest, ['ping', 'prewarm'], 'the worker is checked and asked for the decoder before the archive arrives');
  assert.deepEqual(port.types(), ['ping', 'prewarm', 'decode']);
  await nextTask();
  assert.deepEqual(decoderRequests, [], 'the main thread never loads the decoder for a worker decode');
});

test('only a named .sit asks for the decoder; every worker-bound load starts the worker with its download', async t => {
  for (const [label, options, file] of [['default cascade', {}, 'scheme.rsrc'], ['named resource fork', { source: 'scheme.rsrc' }, 'scheme.rsrc'],
    ['query that only mentions .sit', { source: 'scheme.rsrc?from=x.sit' }, 'scheme.rsrc?from=x.sit']]) {
    const created = [];
    const factory = () => { const port = silentDecodePort({ alive: true }); created.push(port); return port; };
    let createdAtRequest;
    serve(t, { [file]: () => { createdAtRequest ??= created.length; return new Response(rsrc); }, 'scheme.sit': () => { createdAtRequest ??= created.length; return new Response(null, { status: 404 }); } });
    const outcome = await within(loadOwnedTheme('/themes/fixture', { meta, ...options, decodeWorker: factory, decodeWorkerTimeoutMs: 30 }), 2000);
    assert.ok(failed(outcome.rejected), label);
    assert.equal(createdAtRequest, 1, `${label}: the factory's worker exists before the first request`);
    assert.equal(created.length, 1, label);
    assert.deepEqual(created[0].types(), ['ping', 'decode'], `${label}: no decoder request`);
  }
  assert.deepEqual(decoderRequests, []);
});

test('a malformed worker option fails before any request', async t => {
  const seen = serve(t, { 'scheme.rsrc': () => new Response(rsrc) });
  await assert.rejects(loadOwnedTheme('/themes/fixture', { meta, source: 'scheme.rsrc', decodeWorker: {} }), TypeError);
  await assert.rejects(loadOwnedTheme('/themes/fixture', { meta, source: 'scheme.rsrc', decodeWorker: silentDecodePort(), decodeWorkerTimeoutMs: -5 }), TypeError);
  assert.deepEqual(seen, []);
});

test('resolvers forward the worker and its timeout', async t => {
  serve(t, { 'scheme.rsrc': () => new Response(rsrc) });
  const themes = [{ slug: 'fixture', source: 'scheme.rsrc', meta }];
  for (const create of [createOwnedThemeResolver, createThemeResolver]) {
    const port = silentDecodePort({ alive: true });
    const resolver = create({ themeBaseUrl: '/themes', themes, decodeWorker: port, decodeWorkerTimeoutMs: 45 });
    const outcome = await within(resolver.load('fixture'), 2000);
    assert.equal(outcome.rejected?.message, 'Scriptoscope decode worker failed: no response within 45 ms');
    assert.equal(port.decodes().length, 1);
    resolver.dispose();
  }
});

test('reactive (Proxy) metadata loads through loaders and resolver, on the calling thread', async t => {
  serve(t, { 'scheme.rsrc': () => new Response(rsrc) });
  const reactive = object => new Proxy(object, { get: (target, key) => (target[key] && typeof target[key] === 'object') ? reactive(target[key]) : target[key] });
  const proxied = reactive({ name: 'reactive', author: { name: 'store' } });
  const worker = hostedDecodeWorker(t);
  const viaLoader = await within(loadOwnedTheme('/themes/fixture', { source: 'scheme.rsrc', meta: proxied, decodeWorker: worker }), 5000);
  assert.equal(viaLoader.resolved?.source.manifest.name, 'reactive', viaLoader.rejected?.message);
  const resolver = createOwnedThemeResolver({ themeBaseUrl: '/themes', themes: [{ slug: 'fixture', source: 'scheme.rsrc', meta: proxied }], decodeWorker: worker });
  const viaResolver = await within(resolver.load('fixture'), 5000);
  assert.equal(viaResolver.resolved?.source.manifest.name, 'reactive', viaResolver.rejected?.message);
  assert.deepEqual(worker.requests, [], 'a load known to stay on the calling thread never touches the worker');
  viaLoader.resolved.dispose(); resolver.dispose();
});

test('disposing a resolver during a pending worker decode behaves like a pending main-thread load', async t => {
  const released = [];
  t.after(onAssetUrlReleased(url => released.push(url)));
  const themes = [{ slug: 'fixture', source: 'scheme.rsrc', meta }];
  const outcome = promise => promise.then(() => 'resolved', error => error.message);

  // Main thread: the load is held at its archive request.
  let answer;
  serve(t, { 'scheme.rsrc': () => new Promise(resolve => { answer = () => resolve(new Response(rsrc)); }) });
  const plain = createOwnedThemeResolver({ themeBaseUrl: '/themes', themes });
  const plainLoad = outcome(plain.load('fixture'));
  await until(() => answer, 10_000, 'the archive request');
  plain.dispose();
  answer();
  assert.equal(await plainLoad, 'ThemeResolver: disposed');
  const expected = released.splice(0);
  assert.equal(expected.length, 1, 'the late result is disposed');
  assert.match(expected[0], /^scriptoscope-raster:\d+\/$/);

  // Worker: the load is held at the worker's answer.
  serve(t, { 'scheme.rsrc': () => new Response(rsrc) });
  const worker = hostedDecodeWorker(t, { hold: true });
  const resolver = createOwnedThemeResolver({ themeBaseUrl: '/themes', themes, decodeWorker: worker });
  const load = outcome(resolver.load('fixture'));
  await until(() => worker.held, 10_000, 'the worker answer');
  resolver.dispose();
  worker.release();
  assert.equal(await load, 'ThemeResolver: disposed');
  assert.equal(released.length, 1, 'the worker result is disposed exactly like the main-thread one');
  assert.match(released[0], /^scriptoscope-raster:\d+\/$/);
  await assert.rejects(resolver.load('fixture'), /ThemeResolver: disposed/);
  assert.equal(worker.terminated, 0, 'disposing the resolver does not terminate the worker');
  assert.deepEqual(worker.requests, ['ping', 'decode']);

  // And an undisposed resolver passes the option on: one worker decode, usable theme.
  const working = hostedDecodeWorker(t);
  const live = createOwnedThemeResolver({ themeBaseUrl: '/themes', themes, decodeWorker: () => working });
  const theme = await live.load('fixture');
  assert.equal(theme.kind, 'owned-theme');
  assert.equal(theme.origin, '/themes/fixture');
  assert.deepEqual(working.requests, ['ping', 'decode']);
  live.dispose();
  assert.equal(released.length, 2);
  assert.equal(working.terminated, 0, 'a healthy factory worker is not stopped by disposing the resolver');
  assert.deepEqual(decoderRequests, []);
});

// Last: these loads end on the calling thread and so DO request the decoder there.
test('a named .sit that will decode on the calling thread keeps its download-time warm-up and leaves the worker alone', async t => {
  assert.deepEqual(decoderRequests, []);
  const created = [];
  const factory = () => { const port = silentDecodePort({ alive: true }); created.push(port); return port; };
  class Origin { kind = 'custom'; }
  let requestsAtFetch;
  serve(t, { 'scheme.sit': () => { requestsAtFetch = decoderRequests.length; return new Response(sit); } });
  const loaded = await within(loadTheme('/themes/fixture', { source: 'scheme.sit', meta: { name: 'm', extra: new Origin() }, decodeWorker: factory }), 10_000);
  assert.equal(loaded.resolved?.manifest.name, 'm', loaded.rejected?.message);
  assert.equal(requestsAtFetch, 1, 'the main-thread decoder was requested with the archive, as without a worker');
  assert.equal(created.length, 0, 'the factory is not called for a load that cannot use its worker');

  // The same holds for a prepared handle, with a worker passed directly.
  const { prepareCinfEnvironment } = await import('../../tools/theme-loader/cinf-environment.js');
  const cinfEnvironment = await prepareCinfEnvironment({ version: 1, complete: true, providers: [{ kind: 'theme-fork', id: 'theme', complete: true }] });
  const port = silentDecodePort();
  const withHandle = await within(loadTheme('/themes/fixture', { source: 'scheme.sit', meta, cinfEnvironment, decodeWorker: port }), 10_000);
  assert.ok(withHandle.resolved?.manifest.cinfEnvironment, withHandle.rejected?.message);
  assert.deepEqual(port.posted, []);
});
