// A failed warm-up must stay silent, and the load that needs the decoder must be
// the one that reports the failure. Kept in its own process: the last case leaves
// the real decoder with a failed, cached WASM instantiation.
import '../../tests/helpers/registerTs.mjs';
import { registerHooks } from 'node:module';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const module = source => `data:text/javascript,${encodeURIComponent(source)}`;
const BROKEN_IMPORT = module('throw new Error("decoder module unavailable");');
const BROKEN_DECODE = module('export const decodeArchive = () => Promise.reject(new Error("decoder cannot start"));'
  + 'export const stuffItResourceForkWithSelection = () => Promise.reject(new Error("decoder cannot start"));');
let decoder = null, decoderRequests = 0;
registerHooks({
  resolve(specifier, context, next) {
    if (!/sit-wasm\/index\.mjs$/.test(specifier)) return next(specifier, context);
    decoderRequests++;
    return decoder ? { url: decoder, shortCircuit: true } : next(specifier, context);
  },
});

const { loadTheme } = await import('../../src/loadTheme.ts');
const { prewarmStuffItDecoder } = await import('./loadKaleidoscopeScheme.js');
const sit = new Uint8Array(await readFile(new URL('../../themes/1984/scheme.sit', import.meta.url)));
const settle = async () => { for (let i = 0; i < 50; i++) await new Promise(resolve => setImmediate(resolve)); };

function watch(t) {
  const rejections = [], onRejection = reason => rejections.push(reason);
  process.on('unhandledRejection', onRejection);
  const previous = globalThis.fetch;
  globalThis.fetch = async () => new Response(sit);
  t.after(() => { process.off('unhandledRejection', onRejection); globalThis.fetch = previous; decoder = null; });
  return rejections;
}
const loadNamedSit = () => loadTheme('/themes/fixture', { meta: { name: 'fixture' }, source: 'scheme.sit' });

test('a decoder module that fails to import: silent warm-up, error reported by the load', async t => {
  const rejections = watch(t);
  decoder = BROKEN_IMPORT;
  const before = decoderRequests;
  assert.equal(prewarmStuffItDecoder(), undefined);
  await settle();
  assert.equal(decoderRequests, before + 1, 'the failing import was attempted');
  assert.deepEqual(rejections, []);
  await assert.rejects(loadNamedSit(), { message: 'decoder module unavailable' });
  await settle();
  assert.deepEqual(rejections, []);
});

test('a decoder that imports but cannot start: silent warm-up, error reported by the load', async t => {
  const rejections = watch(t);
  decoder = BROKEN_DECODE;
  const before = decoderRequests;
  assert.equal(prewarmStuffItDecoder(), undefined);
  await settle();
  assert.equal(decoderRequests, before + 1);
  assert.deepEqual(rejections, []);
  await assert.rejects(loadNamedSit(), { message: 'decoder cannot start' });
  await settle();
  assert.deepEqual(rejections, []);
});

test('WASM that cannot instantiate: logged by the runtime, silent warm-up, failure stays cached for the load', async t => {
  const rejections = watch(t);
  const instantiate = WebAssembly.instantiate, consoleError = console.error, logged = [];
  let attempts = 0;
  WebAssembly.instantiate = async () => { attempts++; throw new Error('wasm blocked'); };
  console.error = (...args) => { logged.push(args.join(' ')); };
  t.after(() => { WebAssembly.instantiate = instantiate; console.error = consoleError; });

  assert.equal(prewarmStuffItDecoder(), undefined);
  for (let i = 0; i < 2000 && attempts === 0; i++) await new Promise(resolve => setImmediate(resolve));
  await settle();
  assert.equal(attempts, 1, 'the warm-up reached instantiation');
  assert.deepEqual(rejections, []);
  assert.equal(logged.length, 2, 'the Emscripten runtime reports the failure on console.error');
  assert.match(logged[0], /failed to asynchronously prepare wasm: Error: wasm blocked/);

  // Instantiation works again, but the decoder keeps its failed attempt.
  WebAssembly.instantiate = instantiate;
  await assert.rejects(loadNamedSit(), /wasm blocked/);
  await settle();
  assert.equal(attempts, 1);
  assert.deepEqual(rejections, []);
});
