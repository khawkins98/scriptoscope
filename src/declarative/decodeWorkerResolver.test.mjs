// The decode-worker option as the URL loaders and theme resolvers pass it on:
// where the StuffIt decoder is requested, and resolver disposal while a worker
// decode is pending. No `.sit` is decoded in this process, so a decoder request
// observed here can only have come from the main-thread path.
import '../../tests/helpers/registerTs.mjs';
import { registerHooks } from 'node:module';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { hostedDecodeWorker, silentDecodePort, nextTask } from '../../tests/helpers/decode-worker-ports.mjs';

const decoderRequests = [];
registerHooks({
  resolve(specifier, context, next) {
    if (/sit-wasm\/index\.mjs$/.test(specifier)) decoderRequests.push(specifier);
    return next(specifier, context);
  },
});
const { loadOwnedTheme } = await import('../loadTheme.ts');
const { createOwnedThemeResolver } = await import('./theme.ts');
const { onAssetUrlReleased } = await import('../../tools/theme-loader/assetLifecycle.js');

const fixture = async path => new Uint8Array(await readFile(new URL(`../../themes/${path}`, import.meta.url)));
const rsrc = await fixture('1138/scheme.rsrc'), sit = await fixture('1984/scheme.sit');
const meta = { name: 'fixture' };

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

test('with a decode worker the StuffIt decoder is requested in the worker, with the archive request', async t => {
  const port = silentDecodePort();
  let postedAtRequest;
  serve(t, { 'scheme.sit': () => { postedAtRequest = port.posted.map(message => message.type); return new Response(sit); } });
  const error = await loadOwnedTheme('/themes/fixture', { meta, source: 'scheme.sit', decodeWorker: port, decodeWorkerTimeoutMs: 30 })
    .then(() => assert.fail('the silent worker never answers'), error => error);
  assert.equal(error.code, 'DECODE_WORKER_FAILED');
  assert.deepEqual(postedAtRequest, ['prewarm'], 'the worker is asked for the decoder before the archive arrives');
  assert.deepEqual(port.posted.map(message => message.type), ['prewarm', 'decode']);
  await nextTask();
  assert.deepEqual(decoderRequests, [], 'the main thread never loads the decoder for a worker decode');
});

test('the default cascade asks the worker for the decoder only once the archive responds', async t => {
  const port = silentDecodePort();
  const posted = [];
  serve(t, {
    'scheme.sit': () => { posted.push(port.posted.length); return new Response(null, { status: 404 }); },
    'scheme.rsrc': () => { posted.push(port.posted.length); return new Response(rsrc); },
  });
  await assert.rejects(loadOwnedTheme('/themes/fixture', { meta, decodeWorker: port, decodeWorkerTimeoutMs: 30 }), error => error.code === 'DECODE_WORKER_FAILED');
  assert.deepEqual(posted, [0, 0]);
  assert.deepEqual(port.posted.map(message => message.type), ['decode'], 'a resource-fork bundle never asks for the decoder');
  assert.deepEqual(decoderRequests, []);
});

test('a malformed worker option fails before any request', async t => {
  const seen = serve(t, { 'scheme.rsrc': () => new Response(rsrc) });
  await assert.rejects(loadOwnedTheme('/themes/fixture', { meta, source: 'scheme.rsrc', decodeWorker: {} }), TypeError);
  assert.deepEqual(seen, []);
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
  while (!answer) await nextTask();
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
  while (!worker.held) await nextTask();
  resolver.dispose();
  worker.release();
  assert.equal(await load, 'ThemeResolver: disposed');
  assert.equal(released.length, 1, 'the worker result is disposed exactly like the main-thread one');
  assert.match(released[0], /^scriptoscope-raster:\d+\/$/);
  await assert.rejects(resolver.load('fixture'), /ThemeResolver: disposed/);
  assert.equal(worker.terminated, 0, 'disposing the resolver does not terminate the caller-owned worker');
  assert.deepEqual(worker.requests, ['decode']);

  // And an undisposed resolver passes the option on: one worker decode, usable theme.
  const working = hostedDecodeWorker(t);
  const live = createOwnedThemeResolver({ themeBaseUrl: '/themes', themes, decodeWorker: () => working });
  const theme = await live.load('fixture');
  assert.equal(theme.kind, 'owned-theme');
  assert.equal(theme.origin, '/themes/fixture');
  assert.deepEqual(working.requests, ['decode']);
  live.dispose();
  assert.equal(released.length, 2);
  assert.deepEqual(decoderRequests, []);
});
