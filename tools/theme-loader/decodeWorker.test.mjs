// The opt-in decode worker, exercised in Node over a real MessageChannel (the same
// structured clone and buffer transfer a browser Worker performs). The real-browser
// counterpart is src/decodeWorker.browser.test.mjs. Every wait here is bounded: a
// load that would hang is reported as "pending", never waited for.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import { loadKaleidoscopeScheme, loadOwnedKaleidoscopeScheme } from './loadKaleidoscopeScheme.js';
import { DECODE_WORKER_HANDSHAKE_MS } from './decodeWorkerClient.js';
import { packDecodeError, packDecodeResult, unpackDecodeResult, unpackDecodeError } from './decodeWorkerProtocol.js';
import { prepareDisplayProfile, DisplayProfileError } from './display-profile.js';
import { prepareCinfEnvironment, CinfEnvironmentError } from './cinf-environment.js';
import { prepareCicnTransferResults, CicnTransferError } from './cicn-transfer-results.js';
import { ThemeValidationError } from './validateTheme.js';
import { canonicalGraph, firstDifference } from '../../tests/helpers/canonical-graph.mjs';
import { hostedDecodeWorker as decodeWorker, silentDecodePort as silentPort, nextTask, sleep, within, until } from '../../tests/helpers/decode-worker-ports.mjs';
import { forkOf } from '../../tests/resource-provenance/fixtures.mjs';
import { solidBackgroundIcon, solidBackgroundInfo } from '../../tests/decoder-fixtures/solid-background.mjs';
import { syntheticDisplayProfile, profilePpat, profileClut } from '../../tests/decoder-fixtures/display-profile.mjs';

const themesRoot = new URL('../../themes/', import.meta.url);
const bundled = [];
for (const slug of (await readdir(themesRoot)).sort()) {
  for (const file of ['scheme.sit', 'scheme.rsrc']) {
    try { bundled.push({ slug, file, bytes: new Uint8Array(await readFile(new URL(`${slug}/${file}`, themesRoot))) }); break; }
    catch { /* the other container, or not a theme directory */ }
  }
}
const archive = slug => bundled.find(theme => theme.slug === slug).bytes;
const failed = error => error instanceof Error && error.constructor === Error && error.code === 'DECODE_WORKER_FAILED';
const raw = (input, extra = {}) => loadKaleidoscopeScheme(input, { encodeAssets: false, ...extra });
const describeError = error => ({ prototype: Object.getPrototypeOf(error)?.constructor?.name, name: error?.name, message: error?.message, entries: error && typeof error === 'object' ? Object.entries(error) : typeof error });

const canonical = async value => {
  const loadId = value.byteProvenance?.loadId;
  return canonicalGraph(value, { mask: loadId ? [loadId] : [] });
};
async function assertSame(expected, actual, label, { viaWorker = true } = {}) {
  const [a, b] = await Promise.all([canonical(expected), canonical(actual)]);
  if (viaWorker) assert.deepEqual(a.foreign, [], `${label}: the main-thread result holds objects the worker codec does not model`);
  assert.equal(firstDifference(a.text, b.text), null, `${label}: worker result differs`);
  return a;
}

test('every bundled theme decodes to the identical result through the worker (raw assets and owned)', async t => {
  assert.ok(bundled.length >= 18, 'expected the bundled corpus');
  const worker = decodeWorker(t);
  let typedArrays = 0, bytes = 0;
  for (const { slug, file, bytes: input } of bundled) {
    const options = { meta: { name: slug, author: { name: 'fixture' } }, source: `${slug}/${file}`, provenance: true, encodeAssets: false };
    const before = input.slice();
    const main = await loadKaleidoscopeScheme(input, options);
    const off = await loadKaleidoscopeScheme(input, { ...options, decodeWorker: worker });
    const stats = await assertSame(main, off, `${slug} raw`);
    typedArrays += stats.typedArrays; bytes += stats.bytes;
    assert.deepEqual(input, before, `${slug}: the caller's bytes must stay attached and unchanged`);
    assert.notEqual(main.byteProvenance.loadId, off.byteProvenance.loadId);
    assert.ok(Object.isFrozen(off.byteProvenance) && Object.isFrozen(off.byteProvenance.resources[0]));
    // The host hands pixels over by transfer; a copying host would leave them attached.
    const pixelBytes = new Set(off.assets.map(asset => asset.rgba.buffer)).values().reduce((sum, buffer) => sum + buffer.byteLength, 0);
    assert.ok(worker.transferred.at(-1) >= pixelBytes && pixelBytes > 0, `${slug}: result buffers must be transferred`);

    const ownedMain = await loadOwnedKaleidoscopeScheme(input, { meta: options.meta, source: options.source });
    const ownedOff = await loadOwnedKaleidoscopeScheme(input, { meta: options.meta, source: options.source, decodeWorker: worker });
    await assertSame({ ...ownedMain, source: ownedMain.source }, { ...ownedOff, source: ownedOff.source }, `${slug} owned`);
    ownedMain.dispose(); ownedOff.dispose();
  }
  assert.equal(worker.requests.filter(type => type === 'decode').length, bundled.length * 2);
  assert.equal(worker.requests.filter(type => type === 'ping').length, 1, 'a worker is asked for a sign of life once');
  assert.ok(typedArrays > 5000 && bytes > 10_000_000, `compared ${typedArrays} typed arrays / ${bytes} bytes`);
  assert.equal(worker.terminated, 0, 'the loader never terminates a caller-supplied worker');
});

test('caller metadata keeps its identity and state; an asset encoder still runs on the calling thread', async t => {
  const worker = decodeWorker(t);
  const meta = { name: 'Fixture', author: Object.freeze({ name: 'Somebody', year: 1999 }), origin: { kind: 'kaleidoscope-port', nested: { kept: true } }, palette: { accent: '#336699' }, tags: ['kept', { nested: true }] };
  const off = await raw(archive('1138'), { meta, decodeWorker: worker });
  const main = await raw(archive('1138'), { meta });
  for (const result of [main, off]) {
    assert.equal(result.manifest.author, meta.author);
    assert.equal(result.manifest.palette, meta.palette);
    assert.equal(result.manifest.origin.nested, meta.origin.nested);
  }
  assert.ok(Object.isFrozen(meta.author) && !Object.isFrozen(meta.palette) && !Object.isFrozen(meta.origin.nested));
  await assertSame(main, off, 'metadata');

  const encoded = { main: [], off: [] };
  const encoder = list => (rgba, width, height, path) => { list.push([path, width, height, rgba.length]); return `memory:${path}`; };
  const a = await loadKaleidoscopeScheme(archive('1138'), { meta, encodeAssets: true, assetUrlFactory: encoder(encoded.main) });
  const b = await loadKaleidoscopeScheme(archive('1138'), { meta, encodeAssets: true, assetUrlFactory: encoder(encoded.off), decodeWorker: worker });
  assert.ok(encoded.main.length > 100);
  assert.deepEqual(encoded.off, encoded.main);
  await assertSame(a, b, 'custom encoder');
  assert.equal(worker.requests.filter(type => type === 'decode').length, 2);
});

test('the restore codec keeps sealed, closed and frozen apart and never takes metadata state from the clone', () => {
  const meta = { name: 'm', author: { name: 'open on the caller side' } };
  const workerMeta = structuredClone(meta);
  Object.freeze(workerMeta.author); // whatever the worker did to its copy must not reach the caller's object
  const value = { converted: { theme: { author: workerMeta.author, sealed: Object.seal({ a: 1 }), closed: Object.preventExtensions({ b: 2 }),
    frozen: Object.freeze({ c: 3 }), open: { d: 4 }, list: Object.freeze([Object.seal({ e: 5 })]) } }, byteProvenance: undefined };
  const { message, transfer } = packDecodeResult(value, workerMeta);
  const restored = unpackDecodeResult(structuredClone(message, { transfer }), meta);
  const theme = restored.converted.theme;
  const state = object => [Object.isFrozen(object), Object.isSealed(object), Object.isExtensible(object)];
  assert.deepEqual(state(theme.sealed), [false, true, false]);
  assert.deepEqual(state(theme.closed), [false, false, false]);
  assert.deepEqual(state(theme.frozen), [true, true, false]);
  assert.deepEqual(state(theme.open), [false, false, true]);
  assert.deepEqual(state(theme.list), [true, true, false]);
  assert.deepEqual(state(theme.list[0]), [false, true, false]);
  assert.equal(theme.author, meta.author);
  assert.deepEqual(state(meta.author), [false, false, true], 'the caller\'s metadata object is left as the caller made it');
  // A hostile or buggy worker naming the borrowed node as frozen changes nothing either.
  const forged = structuredClone(packDecodeResult(value, workerMeta).message);
  forged.integrity.fill(1);
  unpackDecodeResult(forged, meta);
  assert.deepEqual(state(meta.author), [false, false, true]);
});

test('options a worker cannot honour keep that load on the calling thread, with the same result', async t => {
  const worker = decodeWorker(t);
  const fork = forkOf([{ type: 'cicn', id: -10239, data: solidBackgroundIcon({ collision: true, opaqueBackground: true }) },
    { type: 'cinf', id: -10239, data: solidBackgroundInfo() }, { type: 'ppat', id: 77, data: profilePpat() }, { type: 'clut', id: -14336, data: profileClut() }]);
  const displayProfile = await prepareDisplayProfile(syntheticDisplayProfile());
  const environment = () => prepareCinfEnvironment({ version: 1, complete: true, providers: [{ kind: 'theme-fork', id: 'theme', complete: true }] });
  const reactive = object => new Proxy(object, { get: (target, key) => (target[key] && typeof target[key] === 'object') ? reactive(target[key]) : target[key] });
  const sparse = ['a', , 'c']; // eslint-disable-line no-sparse-arrays
  const named = Object.assign(['a'], { extra: 1 });
  let deep = { name: 'deep' };
  for (let i = 0, at = deep; i < 20000; i++) at = at.next = {};
  const cases = {
    displayProfile: { displayProfile },
    cinfEnvironment: { cinfEnvironment: await environment() },
    sliderLayoutEnvironment: { sliderLayoutEnvironment: await environment() },
    'inherited displayProfile': Object.create({ displayProfile }),
    'non-enumerable cinfEnvironment': Object.defineProperty({}, 'cinfEnvironment', { value: await environment(), enumerable: false }),
    'function-valued meta': { meta: { name: 'x', onLoad: () => 'not data' } },
    'class-instance meta': { meta: { name: 'x', origin: new (class Origin { kind = 'custom'; })() } },
    'date-valued meta': { meta: { name: 'x', imported: new Date(0) } },
    'symbol-keyed meta': { meta: { name: 'x', [Symbol('private')]: 1 } },
    'accessor meta': { meta: Object.defineProperty({ name: 'x' }, 'author', { enumerable: true, get: () => ({ name: 'late' }) }) },
    'sparse-array meta': { meta: { name: 'x', tags: sparse } },
    'named-property-array meta': { meta: { name: 'x', tags: named } },
    'proxy meta': { meta: new Proxy({ name: 'x' }, {}) },
    'nested reactive proxy meta': { meta: reactive({ name: 'x', author: { name: 'a' } }) },
    'meta too deep to walk': { meta: deep },
    'typed-array id list': { engineCinfIds: Int16Array.of(-10239) },
  };
  for (const [label, extra] of Object.entries(cases)) {
    const options = (more = {}) => Object.defineProperties(Object.create(Object.getPrototypeOf(extra)), { ...Object.getOwnPropertyDescriptors(extra),
      encodeAssets: { value: false, enumerable: true }, ...Object.fromEntries(Object.entries(more).map(([key, value]) => [key, { value, enumerable: true }])) });
    const main = await within(loadKaleidoscopeScheme(fork, options()), 5000);
    const withWorker = await within(loadKaleidoscopeScheme(fork, options({ decodeWorker: worker })), 5000);
    assert.ok(main.resolved && withWorker.resolved, `${label}: ${withWorker.rejected?.message ?? main.rejected?.message ?? 'pending'}`);
    if (label !== 'meta too deep to walk') await assertSame(main.resolved, withWorker.resolved, label, { viaWorker: false });
    assert.deepEqual(worker.requests, [], `${label}: nothing may be sent to the worker`);
  }
  const kept = await raw(fork, { displayProfile, decodeWorker: worker });
  assert.equal(kept.manifest.displayProfile, displayProfile, 'the prepared profile handle is kept, not cloned');

  // A valid finite transfer is honoured on the calling thread, not dropped.
  const fixture = JSON.parse(readFileSync(new URL('../../tests/decoder-fixtures/finite-cicn-transfer.json', import.meta.url)));
  const results = await prepareCicnTransferResults(fixture.data);
  const transfer = { displayProfile: await prepareDisplayProfile(fixture.profile), cicnTransfer: { results, contractId: results.contractId, maskPolicy: 'source-mask-alpha' } };
  const transferred = await raw(Uint8Array.from(fixture.fork), { ...transfer, decodeWorker: worker });
  assert.deepEqual([...transferred.assets[0].rgba], fixture.expectedRgba);
  assert.equal(transferred.manifest.chromeElements.owned.cicnTransfer.resultsId, results.id);
  await assertSame(await raw(Uint8Array.from(fixture.fork), transfer), transferred, 'cicnTransfer', { viaWorker: false });

  // The validation errors of those options are unchanged by the presence of a worker.
  await assert.rejects(raw(fork, { displayProfile: JSON.parse(JSON.stringify(displayProfile)), decodeWorker: worker }), DisplayProfileError);
  await assert.rejects(raw(fork, { cinfEnvironment: { id: 'cinf-environment:x', data: {} }, decodeWorker: worker }), CinfEnvironmentError);
  await assert.rejects(raw(fork, { cicnTransfer: { results: {}, contractId: 'x', maskPolicy: 'source-mask-alpha' }, decodeWorker: worker }), CicnTransferError);
  assert.deepEqual(worker.requests, []);
});

test('inherited and non-enumerable options reach the worker exactly as the calling thread reads them', async t => {
  const worker = decodeWorker(t);
  const inherited = { meta: { name: 'Inherited name', author: { name: 'proto' } }, source: 'inherited/source', provenance: true, encodeAssets: false };
  const options = () => Object.defineProperty(Object.create(inherited), 'engineCinfIds', { value: [-10239], enumerable: false });
  const main = await loadKaleidoscopeScheme(archive('1138'), options());
  const off = await loadKaleidoscopeScheme(archive('1138'), Object.defineProperty(options(), 'decodeWorker', { value: worker, enumerable: false }));
  assert.equal(off.manifest.name, 'Inherited name');
  assert.equal(off.manifest.source, 'inherited/source');
  assert.equal(off.manifest.author, inherited.meta.author);
  assert.ok(off.byteProvenance && off.manifest.engineCinfs, 'inherited provenance and a non-enumerable id list are honoured');
  await assertSame(main, off, 'inherited options');
  assert.deepEqual(worker.requests, ['ping', 'decode']);
});

test('a request that cannot be cloned after all decodes on the calling thread and leaves the worker usable', async t => {
  const worker = decodeWorker(t);
  const meta = new Proxy({ name: 'proxied' }, {});
  // Without a trial clone the proxy is only discovered when the request is posted.
  const trial = globalThis.structuredClone;
  globalThis.structuredClone = undefined;
  t.after(() => { globalThis.structuredClone = trial; });
  const outcome = await within(raw(archive('1138'), { meta, decodeWorker: worker }), 5000);
  globalThis.structuredClone = trial;
  assert.ok(outcome.resolved, outcome.rejected?.message ?? 'pending');
  assert.equal(outcome.resolved.manifest.name, 'proxied');
  assert.deepEqual(worker.requests, ['ping', 'decode'], 'the request was attempted');
  const next = await within(raw(archive('1138'), { decodeWorker: worker }), 5000);
  assert.ok(next.resolved, 'a clone failure is the load\'s problem, not the worker\'s');
  assert.deepEqual(worker.requests, ['ping', 'decode', 'decode']);
});

test('caller bytes are never detached, whatever kind of byte container they are', async t => {
  const worker = decodeWorker(t);
  const bytes = archive('1138');
  class Sneaky extends Uint8Array { slice() { return this; } subarray() { return this; } }
  const big = new Uint8Array(bytes.length + 64);
  big.set(bytes, 32);
  const inputs = {
    'Uint8Array': bytes.slice(),
    'Node Buffer': Buffer.from(bytes),
    'subarray view of a larger buffer': big.subarray(32, 32 + bytes.length),
    'typed-array subclass overriding slice': Sneaky.from(bytes),
    'ArrayBuffer': bytes.slice().buffer,
  };
  for (const [label, input] of Object.entries(inputs)) {
    const buffer = input.buffer ?? input, length = buffer.byteLength;
    const result = await within(raw(input, { decodeWorker: worker }), 5000);
    assert.ok(result.resolved, `${label}: ${result.rejected?.message ?? 'pending'}`);
    assert.equal(buffer.byteLength, length, `${label}: the caller's buffer was detached`);
    assert.deepEqual(new Uint8Array(buffer, input.byteOffset ?? 0, bytes.length), bytes, `${label}: bytes changed`);
  }
  // A small Buffer lives in Node's shared pool: transferring it would detach its neighbours.
  const small = Buffer.from(`SIT!${'x'.repeat(200)}`), neighbour = Buffer.from('neighbour-data-in-the-same-pool');
  const viaMain = await within(raw(small), 5000), viaWorker = await within(raw(small, { decodeWorker: worker }), 5000);
  assert.ok(viaMain.rejected && viaWorker.rejected);
  assert.deepEqual(describeError(viaWorker.rejected), describeError(viaMain.rejected));
  assert.equal(neighbour.toString(), 'neighbour-data-in-the-same-pool');
  assert.equal(small.toString(), `SIT!${'x'.repeat(200)}`);
});

test('a failed decode rejects with the error the calling thread would have thrown', async t => {
  const worker = decodeWorker(t);
  const outcome = async (input, extra = {}) => {
    const result = await within(raw(input, extra), 10_000);
    assert.ok('rejected' in result, 'the fixture must not decode');
    return result.rejected;
  };
  const sit = archive('1984');
  const fixtures = {
    'random bytes': Uint8Array.from({ length: 512 }, (_, i) => (i * 37 + 11) & 255),
    'truncated StuffIt archive': sit.slice(0, Math.floor(sit.length / 2)),
    'truncated resource fork': archive('1138').slice(0, 4096),
    'empty input': new Uint8Array(0),
    'archive without a scheme': new TextEncoder().encode('SIT!' + 'x'.repeat(200)),
  };
  // Deterministic corruptions, including the ones that abort inside the StuffIt WASM.
  let seed = 12345;
  const random = n => (seed = (seed * 1103515245 + 12345) >>> 0) % n;
  for (const slug of ['1138', '1984', 'windows-95', 'crayon-os', 'apple-lisa']) for (let i = 0; i < 60; i++) {
    let bytes = archive(slug).slice();
    const mode = i % 4;
    if (mode === 0) bytes = bytes.slice(0, 1 + random(bytes.length));
    else if (mode === 1) for (let k = 0; k < 1 + random(40); k++) bytes[random(Math.min(bytes.length, 4096))] = random(256);
    else if (mode === 2) for (let k = 0; k < 1 + random(200); k++) bytes[random(bytes.length)] = random(256);
    else { const at = random(bytes.length - 64); bytes.fill(random(2) ? 0xff : 0, at, at + 1 + random(4096)); }
    fixtures[`${slug} corruption ${i}`] = bytes;
  }
  const classes = new Set();
  for (const [label, input] of Object.entries(fixtures)) {
    const main = await within(raw(input.slice()), 10_000), off = await within(raw(input.slice(), { decodeWorker: worker }), 10_000);
    assert.equal('pending' in main || 'pending' in off, false, label);
    assert.equal('rejected' in off, 'rejected' in main, label);
    if (!('rejected' in main)) continue;
    classes.add(Object.getPrototypeOf(main.rejected).constructor.name);
    assert.deepEqual(describeError(off.rejected), describeError(main.rejected), label);
    assert.equal(Object.getPrototypeOf(off.rejected), Object.getPrototypeOf(main.rejected), label);
  }
  assert.ok(classes.has('RuntimeError') && classes.has('Error') && classes.has('ThemeValidationError'), `error classes exercised: ${[...classes]}`);

  // Every listed class crosses the boundary as itself, with the worker's stack.
  const samples = [new DisplayProfileError('Missing exact joint RGB16 mapping: 1,2,3', 'MISSING_MAPPING'), new CinfEnvironmentError('Empty external fork'),
    new CicnTransferError('Transfer source changed after binding'), new ThemeValidationError('expected a number', 'theme.windowTypes.document'),
    new RangeError('Offset is outside the bounds of the DataView'), new TypeError('x is not iterable'), new SyntaxError('s'), new ReferenceError('r'),
    new EvalError('e'), new URIError('u'), new Error('plain'), new WebAssembly.RuntimeError('unreachable'), new WebAssembly.CompileError('bad module'),
    new WebAssembly.LinkError('bad import'), Object.assign(new Error('with fields'), { code: 'E_CUSTOM', retries: 3, nested: { dropped: true } })];
  for (const sample of samples) {
    const error = unpackDecodeError(structuredClone(packDecodeError(sample)));
    assert.equal(Object.getPrototypeOf(error), Object.getPrototypeOf(sample), sample.name);
    assert.deepEqual(describeError(error), { ...describeError(sample), entries: Object.entries(sample).filter(([, value]) => typeof value !== 'object') });
    assert.equal(error.stack, sample.stack, 'the stack is the worker\'s, where the failure happened');
  }
  // Anything else is a plain Error that keeps the name and message; never a DOMException.
  class Custom extends Error {}
  Custom.prototype.name = 'CustomFailure';
  for (const sample of [new Custom('custom'), new DOMException('aborted', 'AbortError'), { name: 'NotAnError', message: 'thrown object' }]) {
    const error = unpackDecodeError(structuredClone(packDecodeError(sample)));
    assert.equal(Object.getPrototypeOf(error), Error.prototype);
    assert.deepEqual([error.name, error.message], [sample.name, sample.message]);
  }
  for (const thrown of ['a string', 7, null, undefined]) assert.equal(unpackDecodeError(structuredClone(packDecodeError(thrown))), thrown);
  await outcome(new Uint8Array(0), { decodeWorker: worker });
});

test('a malformed reply rejects its load as a worker failure instead of hanging or throwing', async () => {
  const good = { kind: 'Error', name: 'Error', message: 'm', fields: [] };
  const replies = {
    'error reply without a description': { type: 'error' },
    'error: null': { type: 'error', error: null },
    'error: a string': { type: 'error', error: 'x' },
    'kind __proto__': { type: 'error', error: { ...good, kind: '__proto__' } },
    'kind constructor': { type: 'error', error: { ...good, kind: 'constructor' } },
    'kind toString': { type: 'error', error: { ...good, kind: 'toString' } },
    'unlisted kind': { type: 'error', error: { ...good, kind: 'DOMException' } },
    'no fields': { type: 'error', error: { kind: 'Error', name: 'Custom', message: 'm' } },
    'object-valued field': { type: 'error', error: { ...good, fields: [['code', {}]] } },
    'non-string message': { type: 'error', error: { ...good, message: { toString() { throw new Error('boom'); } } } },
    'thrown object': { type: 'error', error: { thrown: { not: 'primitive' } } },
    'result without a value': { type: 'result' },
    'result value: null': { type: 'result', value: null, integrity: new Uint8Array(0), metaRefs: [] },
    'result without restore data': { type: 'result', value: { converted: {} } },
    'result with short restore data': { type: 'result', value: { converted: { theme: {} } }, integrity: new Uint8Array(1), metaRefs: [] },
    'result naming unknown metadata': { type: 'result', value: { converted: {} }, integrity: new Uint8Array(2), metaRefs: [1, 99] },
    'unknown reply type': { type: 'bogus' },
  };
  for (const [label, reply] of Object.entries(replies)) {
    const port = silentPort({ alive: true });
    const load = raw(archive('1138'), { decodeWorker: port, decodeWorkerTimeoutMs: 10_000 });
    await nextTask();
    assert.doesNotThrow(() => port.reply({ id: 1, ...reply }), label);
    const outcome = await within(load, 1000);
    assert.ok(outcome.rejected, `${label}: ${'pending' in outcome ? 'still pending' : 'resolved'}`);
    assert.ok(failed(outcome.rejected), `${label}: ${outcome.rejected}`);
    assert.match(outcome.rejected.message, /^Scriptoscope decode worker failed: it sent a malformed reply/, label);
    assert.ok(failed((await within(raw(archive('1138'), { decodeWorker: port }), 1000)).rejected), `${label}: the worker is not trusted again`);
    assert.equal(port.terminated, 0);
  }
  // Hostile field names are copied as inert data properties or not at all.
  const port = silentPort({ alive: true });
  const load = raw(archive('1138'), { decodeWorker: port });
  await nextTask();
  port.reply({ type: 'error', id: 1, error: { ...good, fields: [['__proto__', 'x'], ['constructor', 'y'], ['prototype', 'z'], ['message', 'overridden'], ['stack', 'fake'], ['code', 'KEPT']] } });
  const { rejected } = await within(load, 1000);
  assert.equal(Object.getPrototypeOf(rejected), Error.prototype);
  assert.equal(rejected.constructor, Error);
  assert.deepEqual([rejected.message, Object.entries(rejected)], ['m', [['code', 'KEPT']]]);
  assert.equal(({}).x, undefined);

  // Late, duplicate and foreign answers are ignored without failing anything.
  const patient = silentPort({ alive: true });
  const waiting = raw(archive('1138'), { decodeWorker: patient, decodeWorkerTimeoutMs: 10_000 });
  await nextTask();
  patient.reply({ type: 'error', id: 999, error: { ...good, message: 'unknown id' } });
  patient.reply({ type: 'error', id: '1', error: { ...good, message: 'string id' } });
  patient.emit('message', { data: { type: 'error', id: 1 } });
  patient.emit('message', { data: 'hello' });
  patient.emit('message', { data: null });
  assert.ok((await within(waiting, 50)).pending);
  patient.reply({ type: 'error', id: 1, error: { ...good, message: 'first' } });
  patient.reply({ type: 'error', id: 1, error: { ...good, message: 'duplicate' } });
  assert.equal((await within(waiting, 1000)).rejected.message, 'first');
});

test('two copies of the library sharing one worker each receive only their own answers', async t => {
  const second = await import('./decodeWorkerClient.js?second-copy');
  const worker = decodeWorker(t, { hold: true });
  // Both copies number their requests from 1, so only the client id tells them apart.
  const mine = raw(archive('1138'), { meta: { name: 'first copy' }, decodeWorker: worker });
  const theirs = second.decodeWithWorker(archive('1984'), { meta: { name: 'second copy' }, decodeWorker: worker });
  await until(() => worker.held >= 2, 10_000, 'both answers');
  worker.release({ reverse: true });
  const [a, b] = await Promise.all([within(mine, 5000), within(theirs, 5000)]);
  assert.equal(a.resolved.manifest.name, 'first copy');
  assert.equal(b.resolved.converted.theme.name, 'second copy');
  await assertSame(await raw(archive('1138'), { meta: { name: 'first copy' } }), a.resolved, 'first copy');

  const port = silentPort({ alive: true });
  const load = raw(archive('1138'), { decodeWorker: port, decodeWorkerTimeoutMs: 10_000 });
  await nextTask();
  const { client } = port.posted.at(-1);
  assert.match(client, /^[0-9a-f]{32}$/);
  const description = { kind: 'Error', name: 'Error', message: 'for someone else', fields: [] };
  port.emit('message', { data: { protocol: port.posted[0].protocol, client: 'f'.repeat(32), type: 'error', id: 1, error: description } });
  port.emit('message', { data: { protocol: port.posted[0].protocol, type: 'error', id: 1, error: description } });
  assert.ok((await within(load, 50)).pending, 'an answer addressed to another client is not this load\'s answer');
  port.reply({ type: 'error', id: 1, error: { ...description, message: 'for me' } });
  assert.equal((await within(load, 1000)).rejected.message, 'for me');
});

test('concurrent loads share one worker and each receives its own result, in any answer order', async t => {
  const worker = decodeWorker(t, { hold: true });
  const slugs = ['1138', '1984', 'beos-r503', 'windows-95', 'platinum-8', '1138'];
  const options = slug => ({ meta: { name: slug }, source: slug, provenance: true, encodeAssets: false });
  const loads = slugs.map(slug => loadKaleidoscopeScheme(archive(slug), { ...options(slug), decodeWorker: worker }));
  await until(() => worker.held >= slugs.length, 20_000, 'every answer');
  assert.deepEqual(worker.requests, ['ping', ...slugs.map(() => 'decode')]);
  worker.release({ reverse: true });
  const results = await Promise.all(loads);
  for (const [index, slug] of slugs.entries()) {
    await assertSame(await loadKaleidoscopeScheme(archive(slug), options(slug)), results[index], `${slug} #${index}`);
  }
  assert.equal(new Set(results.map(result => result.byteProvenance.loadId)).size, slugs.length);
});

test('a worker that was dead before its first load is noticed by a liveness check, not the decode timeout', async t => {
  // A Worker whose script 404s dispatches `error` once, possibly before anyone listens;
  // afterwards it is indistinguishable from a silent one. Default timeout: 30 s.
  const dead = silentPort();
  const started = performance.now();
  const outcome = await within(raw(archive('1138'), { decodeWorker: dead }), DECODE_WORKER_HANDSHAKE_MS + 3000);
  const waited = performance.now() - started;
  assert.ok(failed(outcome.rejected), 'pending' in outcome ? 'still pending' : 'resolved');
  assert.equal(outcome.rejected.message, `Scriptoscope decode worker failed: it did not answer a liveness check within ${DECODE_WORKER_HANDSHAKE_MS} ms`);
  assert.ok(waited >= DECODE_WORKER_HANDSHAKE_MS - 50 && waited < DECODE_WORKER_HANDSHAKE_MS + 2000, `waited ${waited} ms`);
  assert.deepEqual(dead.types(), ['ping', 'decode'], 'the check and the request are posted together: a healthy worker is not delayed');
  assert.ok(failed((await within(raw(archive('1138'), { decodeWorker: dead }), 500)).rejected), 'later loads fail at once');
  assert.equal(dead.posted.length, 2);

  // The wait never exceeds the load's own timeout.
  const quick = silentPort();
  const quickStart = performance.now();
  const quickOutcome = await within(raw(archive('1138'), { decodeWorker: quick, decodeWorkerTimeoutMs: 60 }), 2000);
  assert.equal(quickOutcome.rejected?.message, 'Scriptoscope decode worker failed: it did not answer a liveness check within 60 ms');
  assert.ok(performance.now() - quickStart < 1500);

  // A healthy worker is asked once, in the same task as its first request, then trusted.
  const healthy = decodeWorker(t);
  const first = raw(archive('1138'), { decodeWorker: healthy });
  await nextTask();
  assert.deepEqual(healthy.requests, ['ping', 'decode']);
  assert.ok((await within(first, 5000)).resolved);
  assert.ok((await within(raw(archive('1138'), { decodeWorker: healthy }), 5000)).resolved);
  assert.deepEqual(healthy.requests, ['ping', 'decode', 'decode']);

  // The host answers the check itself, ahead of any decode: with the decode's answer
  // held back, the load ends on its own timeout, not on a failed liveness check.
  const busy = decodeWorker(t, { hold: true });
  const held = await within(raw(archive('1138'), { decodeWorker: busy, decodeWorkerTimeoutMs: 300 }), 3000);
  assert.equal(held.rejected?.message, 'Scriptoscope decode worker failed: no response within 300 ms');

  // The decode's own answer proves liveness too, when it arrives before any pong.
  const answering = silentPort();
  const load = raw(archive('1138'), { decodeWorker: answering, decodeWorkerTimeoutMs: 80 });
  await nextTask();
  answering.reply({ type: 'error', id: 1, error: { kind: 'Error', name: 'Error', message: 'decoded badly', fields: [] } });
  assert.equal((await within(load, 500)).rejected.message, 'decoded badly');
  const second = raw(archive('1138'), { decodeWorker: answering, decodeWorkerTimeoutMs: 10_000 });
  await sleep(200);
  assert.ok((await within(second, 20)).pending, 'no liveness failure after the worker has spoken');
  assert.deepEqual(answering.types(), ['ping', 'decode', 'decode']);
});

test('error and messageerror events fail the worker; nothing is retried on the calling thread', async () => {
  const load = (port, extra = {}) => raw(archive('1138'), { decodeWorker: port, ...extra });
  const crashing = silentPort({ alive: true });
  const pending = [load(crashing), load(crashing)].map(promise => within(promise, 2000));
  await nextTask();
  assert.equal(crashing.decodes().length, 2);
  crashing.emit('error', { message: 'Uncaught SyntaxError: Unexpected token' });
  for (const outcome of await Promise.all(pending)) {
    assert.ok(failed(outcome.rejected));
    assert.equal(outcome.rejected.message, 'Scriptoscope decode worker failed: Uncaught SyntaxError: Unexpected token');
  }
  // The worker is known bad: later loads fail at once instead of waiting on it.
  assert.ok(failed((await within(load(crashing), 500)).rejected));
  assert.equal(crashing.decodes().length, 2);
  assert.equal(crashing.terminated, 0, 'a caller-supplied worker is never terminated, not even a failed one');

  const undecodable = silentPort({ alive: true });
  const lost = within(load(undecodable), 2000);
  await nextTask();
  undecodable.emit('messageerror');
  assert.equal((await lost).rejected.message, 'Scriptoscope decode worker failed: a worker message could not be deserialized');
  assert.equal(undecodable.terminated, 0);

  // An error event with nothing pending is remembered for the next load.
  const early = silentPort({ alive: true });
  assert.ok((await within(load(early, { decodeWorkerTimeoutMs: 30 }), 1000)).rejected);
  early.emit('error', {});
  assert.equal((await within(load(early), 500)).rejected.message, 'Scriptoscope decode worker failed: the worker reported an error');
});

test('each load has its own timeout; new requests do not postpone it and answers restart it', async t => {
  const stuck = { decodeWorkerTimeoutMs: 100 };
  // (a) A live worker that never finishes, with a new load arriving every 30 ms.
  const starved = silentPort({ alive: true });
  const begun = performance.now(), rejectedAt = [];
  for (let i = 0; i < 12; i++) {
    raw(archive('1138'), { decodeWorker: starved, ...stuck }).catch(error => { assert.ok(failed(error)); rejectedAt.push(performance.now() - begun); });
    await sleep(30);
  }
  await sleep(250);
  assert.equal(rejectedAt.length, 12);
  assert.ok(rejectedAt[0] >= 90 && rejectedAt[0] < 300, `the first load rejected after ${rejectedAt[0]} ms while later loads kept arriving`);

  // (b) A short timeout rejects only its own load; the worker stays in use.
  const mixed = silentPort({ alive: true });
  const patient = raw(archive('1138'), { decodeWorker: mixed, decodeWorkerTimeoutMs: 60_000 });
  const hasty = raw(archive('1138'), { decodeWorker: mixed, decodeWorkerTimeoutMs: 80 });
  const hastyOutcome = await within(hasty, 2000);
  assert.equal(hastyOutcome.rejected?.message, 'Scriptoscope decode worker failed: no response within 80 ms');
  assert.ok((await within(patient, 50)).pending, 'the other load keeps waiting for its own, longer timeout');
  mixed.reply({ type: 'error', id: 1, error: { kind: 'RangeError', name: 'RangeError', message: 'answered late', fields: [] } });
  const patientOutcome = await within(patient, 1000);
  assert.ok(patientOutcome.rejected instanceof RangeError && patientOutcome.rejected.message === 'answered late');
  // After a timeout the worker is unproven: its next use starts with a fresh liveness check.
  const before = mixed.types().filter(type => type === 'ping').length;
  mixed.reply({ type: 'error', id: 2, error: { kind: 'Error', name: 'Error', message: 'late answer to the timed-out load', fields: [] } });
  const silentNow = silentPort();
  const recheck = raw(archive('1138'), { decodeWorker: silentNow, decodeWorkerTimeoutMs: 40 }).catch(() => {});
  await recheck;
  const again = raw(archive('1138'), { decodeWorker: mixed, decodeWorkerTimeoutMs: 60_000 });
  await nextTask();
  assert.equal(mixed.types().filter(type => type === 'ping').length, before, 'a worker that has answered since is still trusted');
  mixed.reply({ type: 'error', id: 3, error: { kind: 'Error', name: 'Error', message: 'done', fields: [] } });
  assert.equal((await within(again, 500)).rejected.message, 'done');

  const unproven = silentPort({ alive: true });
  assert.ok((await within(raw(archive('1138'), { decodeWorker: unproven, decodeWorkerTimeoutMs: 40 }), 1000)).rejected);
  const reprobed = raw(archive('1138'), { decodeWorker: unproven, decodeWorkerTimeoutMs: 60_000 });
  await nextTask();
  assert.deepEqual(unproven.types(), ['ping', 'decode', 'ping', 'decode'], 'a timed-out worker is checked again before it is trusted');
  unproven.reply({ type: 'error', id: 2, error: { kind: 'Error', name: 'Error', message: 'still alive', fields: [] } });
  assert.equal((await within(reprobed, 500)).rejected.message, 'still alive');

  // (c) Waits a timer cannot represent are not timed, rather than firing at once.
  for (const decodeWorkerTimeoutMs of [2 ** 31, 2 ** 40, Number.MAX_SAFE_INTEGER, Infinity]) {
    const port = silentPort({ alive: true });
    const load = raw(archive('1138'), { decodeWorker: port, decodeWorkerTimeoutMs });
    assert.ok((await within(load, 150)).pending, `timeout ${decodeWorkerTimeoutMs} rejected early`);
    port.reply({ type: 'error', id: 1, error: { kind: 'Error', name: 'Error', message: 'eventually', fields: [] } });
    assert.equal((await within(load, 500)).rejected.message, 'eventually');
  }
  const longest = silentPort({ alive: true });
  const justFits = raw(archive('1138'), { decodeWorker: longest, decodeWorkerTimeoutMs: 2 ** 31 - 1 });
  assert.ok((await within(justFits, 100)).pending);
  longest.emit('error', { message: 'stop' });
  await justFits.catch(() => {});

  // (d) Any message from the worker to this client restarts the wait of every pending load.
  const working = silentPort({ alive: true });
  const slow = raw(archive('1138'), { decodeWorker: working, decodeWorkerTimeoutMs: 200 });
  const other = raw(archive('1138'), { decodeWorker: working, decodeWorkerTimeoutMs: 200 });
  const slowStart = performance.now();
  await sleep(120);
  working.reply({ type: 'error', id: 2, error: { kind: 'Error', name: 'Error', message: 'other finished', fields: [] } });
  await other.catch(() => {});
  await sleep(140);
  assert.ok((await within(slow, 10)).pending, 'the worker answered another load 140 ms ago: this one is still within its 200 ms');
  const slowOutcome = await within(slow, 1000);
  assert.equal(slowOutcome.rejected?.message, 'Scriptoscope decode worker failed: no response within 200 ms');
  assert.ok(performance.now() - slowStart >= 300);

  // (e) A settled load leaves no timer behind: nothing later marks the worker unproven.
  const healthy = decodeWorker(t);
  assert.ok((await within(raw(archive('1138'), { decodeWorker: healthy, decodeWorkerTimeoutMs: 60 }), 5000)).resolved);
  await sleep(150);
  assert.ok((await within(raw(archive('1138'), { decodeWorker: healthy, decodeWorkerTimeoutMs: 60 }), 5000)).resolved);
  assert.deepEqual(healthy.requests, ['ping', 'decode', 'decode'], 'a cleared timeout cannot fire after its load settled');
});

test('a factory worker is library-held: created once, terminated when it fails, replaced once', async t => {
  const spawned = [];
  const factory = () => { const worker = decodeWorker(t); spawned.push(worker); return worker; };
  const environment = await prepareCinfEnvironment({ version: 1, complete: true, providers: [{ kind: 'theme-fork', id: 'theme', complete: true }] });
  await raw(archive('1138'), { decodeWorker: factory, cinfEnvironment: environment });
  assert.equal(spawned.length, 0, 'a load that stays on the calling thread does not create the worker');
  const first = await raw(archive('1138'), { decodeWorker: factory });
  const second = await raw(archive('1984'), { decodeWorker: factory });
  assert.equal(spawned.length, 1);
  assert.deepEqual(spawned[0].requests, ['ping', 'decode', 'decode']);
  assert.ok(first.manifest && second.manifest);
  assert.equal(spawned[0].terminated, 0, 'a working worker is left running');

  // Five concurrent loads on a worker that then fails: one termination, one replacement.
  const ports = [];
  const failing = () => { const port = silentPort({ alive: ports.length > 0 }); ports.push(port); return port; };
  const round = [1, 2, 3, 4, 5].map(() => within(raw(archive('1138'), { decodeWorker: failing, decodeWorkerTimeoutMs: 60 }), 2000));
  for (const outcome of await Promise.all(round)) assert.ok(failed(outcome.rejected));
  assert.equal(ports.length, 1, 'concurrent loads share the one worker');
  assert.equal(ports[0].terminated, 1, 'the failed worker is stopped before it is replaced');
  const retries = [1, 2, 3].map(() => raw(archive('1138'), { decodeWorker: failing, decodeWorkerTimeoutMs: 60_000 }));
  await nextTask();
  assert.equal(ports.length, 2, 'one replacement, shared by the concurrent retries');
  assert.equal(ports[1].decodes().length, 3);
  ports[1].emit('error', { message: 'gone again' });
  for (const retry of retries) assert.ok(failed((await within(retry, 1000)).rejected));
  assert.deepEqual(ports.map(port => port.terminated), [1, 1]);
  assert.ok((await within(raw(archive('1138'), { decodeWorker: failing, decodeWorkerTimeoutMs: 40 }), 1000)).rejected);
  assert.equal(ports.length, 3);
  assert.equal(ports[2].terminated, 0, 'a load that merely timed out does not stop a live worker');

  // A malformed reply also stops a held worker.
  const liars = [];
  const lying = () => { const port = silentPort({ alive: true }); liars.push(port); return port; };
  const lied = raw(archive('1138'), { decodeWorker: lying });
  await nextTask();
  liars[0].reply({ type: 'bogus' });
  assert.ok(failed((await within(lied, 1000)).rejected));
  assert.equal(liars[0].terminated, 1);

  // A worker the caller also passes directly is the caller's, even if a factory returns it.
  const shared = silentPort();
  assert.ok((await within(raw(archive('1138'), { decodeWorker: shared, decodeWorkerTimeoutMs: 30 }), 1000)).rejected);
  const viaSharedFactory = await within(raw(archive('1138'), { decodeWorker: () => shared }), 1000);
  assert.ok(failed(viaSharedFactory.rejected), 'a factory returning a known-failed worker gets that failure');
  const own = silentPort();
  const viaFactory = within(raw(archive('1138'), { decodeWorker: () => own, decodeWorkerTimeoutMs: 40 }), 1000);
  const direct = within(raw(archive('1138'), { decodeWorker: own, decodeWorkerTimeoutMs: 60_000 }), 1000);
  assert.ok(failed((await direct).rejected) && failed((await viaFactory).rejected));
  assert.equal(own.terminated + shared.terminated, 0);

  // A factory that throws or returns something else rejects the load with that error.
  await assert.rejects(raw(archive('1138'), { decodeWorker: () => { throw new RangeError('factory boom'); } }), /factory boom/);
  await assert.rejects(raw(archive('1138'), { decodeWorker: () => 42 }), TypeError);
  await assert.rejects(raw(archive('1138'), { decodeWorker: async () => silentPort() }), TypeError);
});

test('a malformed worker option is a TypeError, not a silent main-thread load', async () => {
  for (const decodeWorker of [null, {}, 'worker.js', { postMessage() {} }, () => ({})]) {
    await assert.rejects(raw(archive('1138'), { decodeWorker }), TypeError);
  }
  const port = silentPort();
  for (const decodeWorkerTimeoutMs of [0, -1, NaN, '30']) {
    await assert.rejects(raw(archive('1138'), { decodeWorker: port, decodeWorkerTimeoutMs }), TypeError);
  }
  assert.equal(port.posted.length, 0);
});

test('without the option a load settles on the same microtask tick, and reads options in the same order, as before', async () => {
  const bytes = archive('1138');
  const ticks = async start => {
    let count = 0, done = false;
    const spin = () => { if (!done) { count++; queueMicrotask(spin); } };
    const promise = start();
    queueMicrotask(spin);
    const finish = () => { done = true; };
    promise.then(finish, finish);
    await nextTask();
    return done ? count : 'crossed a task';
  };
  // Tick counts of the loader before the option existed (base of this change).
  assert.equal(await ticks(() => raw(bytes)), 5);
  assert.equal(await ticks(() => raw(bytes.slice(0, 100))), 5);
  assert.equal(await ticks(() => raw(new Uint8Array(0))), 2);
  assert.equal(await ticks(() => loadOwnedKaleidoscopeScheme(bytes, {})), 5);
  const order = [];
  const chain = length => { let promise = Promise.resolve(); for (let i = 0; i < length; i++) promise = promise.then(() => {}); return promise.then(() => order.push(`chain${length}`)); };
  raw(bytes.slice(0, 100)).catch(() => order.push('load-rejected'));
  chain(3); chain(5); chain(7);
  await nextTask();
  assert.deepEqual(order, ['chain3', 'load-rejected', 'chain5', 'chain7']);

  // Option reads relative to the awaits: `meta`, `source` and the id lists are read
  // only after the input has been awaited, never before.
  const reads = [];
  const options = new Proxy({ encodeAssets: false, meta: { name: 'm' }, source: 's', engineCinfIds: [] }, { get(target, key) { if (typeof key === 'string') reads.push(key); return target[key]; } });
  const load = loadKaleidoscopeScheme(bytes, options);
  const beforeAwait = [...reads];
  await load;
  assert.deepEqual(beforeAwait, ['decodeWorker', 'displayProfile', 'cicnTransfer', 'cinfEnvironment', 'sliderLayoutEnvironment', 'provenance', 'provenance']);
  assert.deepEqual(reads.slice(beforeAwait.length), ['provenance', 'meta', 'source', 'iconBlitCicnIds', 'unmaskedIconIds', 'engineCinfIds', 'engineCinfIds', 'encodeAssets']);
});
