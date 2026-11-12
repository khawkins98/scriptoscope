// The opt-in decode worker, exercised in Node over a real MessageChannel (the same
// structured clone and buffer transfer a browser Worker performs). The real-browser
// counterpart is src/decodeWorker.browser.test.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { loadKaleidoscopeScheme, loadOwnedKaleidoscopeScheme } from './loadKaleidoscopeScheme.js';
import { DECODE_PROTOCOL, packDecodeError } from './decodeWorkerProtocol.js';
import { prepareDisplayProfile, DisplayProfileError } from './display-profile.js';
import { prepareCinfEnvironment, CinfEnvironmentError } from './cinf-environment.js';
import { CicnTransferError } from './cicn-transfer-results.js';
import { ThemeValidationError } from './validateTheme.js';
import { canonicalGraph, firstDifference } from '../../tests/helpers/canonical-graph.mjs';
import { hostedDecodeWorker as decodeWorker, silentDecodePort as silentPort, nextTask } from '../../tests/helpers/decode-worker-ports.mjs';
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

    const ownedMain = await loadOwnedKaleidoscopeScheme(input, { meta: options.meta, source: options.source });
    const ownedOff = await loadOwnedKaleidoscopeScheme(input, { meta: options.meta, source: options.source, decodeWorker: worker });
    await assertSame({ ...ownedMain, source: ownedMain.source }, { ...ownedOff, source: ownedOff.source }, `${slug} owned`);
    ownedMain.dispose(); ownedOff.dispose();
  }
  assert.equal(worker.requests.filter(type => type === 'decode').length, bundled.length * 2);
  assert.ok(typedArrays > 5000 && bytes > 10_000_000, `compared ${typedArrays} typed arrays / ${bytes} bytes`);
  assert.equal(worker.terminated, 0, 'the loader never terminates a caller-owned worker');
});

test('caller metadata keeps its identity and state; an asset encoder still runs on the calling thread', async t => {
  const worker = decodeWorker(t);
  const meta = { name: 'Fixture', author: Object.freeze({ name: 'Somebody', year: 1999 }), origin: { kind: 'kaleidoscope-port', nested: { kept: true } }, palette: { accent: '#336699' }, tags: ['kept', { nested: true }] };
  const off = await loadKaleidoscopeScheme(archive('1138'), { meta, encodeAssets: false, decodeWorker: worker });
  const main = await loadKaleidoscopeScheme(archive('1138'), { meta, encodeAssets: false });
  for (const result of [main, off]) {
    assert.equal(result.manifest.author, meta.author);
    assert.equal(result.manifest.palette, meta.palette);
    assert.equal(result.manifest.origin.nested, meta.origin.nested);
  }
  await assertSame(main, off, 'metadata');

  const encoded = { main: [], off: [] };
  const encoder = list => (rgba, width, height, path) => { list.push([path, width, height, rgba.length]); return `memory:${path}`; };
  const a = await loadKaleidoscopeScheme(archive('1138'), { meta, encodeAssets: true, assetUrlFactory: encoder(encoded.main) });
  const b = await loadKaleidoscopeScheme(archive('1138'), { meta, encodeAssets: true, assetUrlFactory: encoder(encoded.off), decodeWorker: worker });
  assert.ok(encoded.main.length > 100);
  assert.deepEqual(encoded.off, encoded.main);
  await assertSame(a, b, 'custom encoder');
  assert.equal(worker.requests.length, 2);
});

test('options a worker cannot honour keep that load on the calling thread, with the same result', async t => {
  const worker = decodeWorker(t);
  const fork = forkOf([{ type: 'cicn', id: -10239, data: solidBackgroundIcon({ collision: true, opaqueBackground: true }) },
    { type: 'cinf', id: -10239, data: solidBackgroundInfo() }, { type: 'ppat', id: 77, data: profilePpat() }, { type: 'clut', id: -14336, data: profileClut() }]);
  const displayProfile = await prepareDisplayProfile(syntheticDisplayProfile());
  const environment = () => prepareCinfEnvironment({ version: 1, complete: true, providers: [{ kind: 'theme-fork', id: 'theme', complete: true }] });
  const cases = {
    displayProfile: { displayProfile },
    cinfEnvironment: { cinfEnvironment: await environment() },
    sliderLayoutEnvironment: { sliderLayoutEnvironment: await environment() },
    'function-valued meta': { meta: { name: 'x', onLoad: () => 'not data' } },
    'class-instance meta': { meta: { name: 'x', origin: new (class Origin { kind = 'custom'; })() } },
    'date-valued meta': { meta: { name: 'x', imported: new Date(0) } },
    'symbol-keyed meta': { meta: { name: 'x', [Symbol('private')]: 1 } },
    'accessor meta': { meta: Object.defineProperty({ name: 'x' }, 'author', { enumerable: true, get: () => ({ name: 'late' }) }) },
    'unknown option': { futureOption: true },
    'typed-array id list': { engineCinfIds: Int16Array.of(-10239) },
  };
  for (const [label, extra] of Object.entries(cases)) {
    const main = await loadKaleidoscopeScheme(fork, { encodeAssets: false, ...extra });
    const withWorker = await loadKaleidoscopeScheme(fork, { encodeAssets: false, ...extra, decodeWorker: worker });
    await assertSame(main, withWorker, label, { viaWorker: false });
    assert.deepEqual(worker.requests, [], `${label}: nothing may be sent to the worker`);
  }
  const kept = await loadKaleidoscopeScheme(fork, { encodeAssets: false, displayProfile, decodeWorker: worker });
  assert.equal(kept.manifest.displayProfile, displayProfile, 'the prepared profile handle is kept, not cloned');

  // The validation errors of those options are unchanged by the presence of a worker.
  await assert.rejects(loadKaleidoscopeScheme(fork, { displayProfile: JSON.parse(JSON.stringify(displayProfile)), decodeWorker: worker }), DisplayProfileError);
  await assert.rejects(loadKaleidoscopeScheme(fork, { cinfEnvironment: { id: 'cinf-environment:x', data: {} }, decodeWorker: worker }), CinfEnvironmentError);
  await assert.rejects(loadKaleidoscopeScheme(fork, { cicnTransfer: { results: {}, contractId: 'x', maskPolicy: 'source-mask-alpha' }, decodeWorker: worker }), CicnTransferError);
  assert.deepEqual(worker.requests, []);
});

test('a failed decode rejects with the error the calling thread would have thrown', async t => {
  const worker = decodeWorker(t);
  const describe = error => ({ constructor: error.constructor.name, name: error.name, message: error.message, code: error.code, path: error.path });
  const outcome = async (input, extra = {}) => {
    try { await loadKaleidoscopeScheme(input, { encodeAssets: false, ...extra }); } catch (error) { return error; }
    return assert.fail('the fixture must not decode');
  };
  const sit = archive('1984');
  const fixtures = {
    'random bytes': Uint8Array.from({ length: 512 }, (_, i) => (i * 37 + 11) & 255),
    'truncated StuffIt archive': sit.slice(0, Math.floor(sit.length / 2)),
    'truncated resource fork': archive('1138').slice(0, 4096),
    'empty input': new Uint8Array(0),
    'archive without a scheme': new TextEncoder().encode('SIT!' + 'x'.repeat(200)),
  };
  for (const [label, input] of Object.entries(fixtures)) {
    const main = await outcome(input), off = await outcome(input, { decodeWorker: worker });
    assert.ok(main instanceof Error, label);
    assert.deepEqual(describe(off), describe(main), label);
    assert.equal(Object.getPrototypeOf(off), Object.getPrototypeOf(main), label);
  }

  // Every loader error class crosses the boundary as itself.
  const port = silentPort();
  const samples = [new DisplayProfileError('Missing exact joint RGB16 mapping: 1,2,3', 'MISSING_MAPPING'), new CinfEnvironmentError('Empty external fork'),
    new CicnTransferError('Transfer source changed after binding'), new ThemeValidationError('expected a number', 'theme.windowTypes.document'),
    new RangeError('Offset is outside the bounds of the DataView'), new TypeError('x is not iterable')];
  for (const [index, sample] of samples.entries()) {
    const pending = loadKaleidoscopeScheme(archive('1138'), { encodeAssets: false, decodeWorker: port });
    await nextTask();
    port.emit('message', { data: { protocol: DECODE_PROTOCOL, type: 'error', id: index + 1, error: structuredClone(packDecodeError(sample)) } });
    const error = await pending.then(() => assert.fail('must reject'), error => error);
    assert.ok(error instanceof sample.constructor, sample.name);
    assert.deepEqual(describe(error), describe(sample));
  }
});

test('concurrent loads share one worker and each receives its own result, in any answer order', async t => {
  const worker = decodeWorker(t, { hold: true });
  const slugs = ['1138', '1984', 'beos-r503', 'windows-95', 'platinum-8', '1138'];
  const options = slug => ({ meta: { name: slug }, source: slug, provenance: true, encodeAssets: false });
  const loads = slugs.map(slug => loadKaleidoscopeScheme(archive(slug), { ...options(slug), decodeWorker: worker }));
  while (worker.held < slugs.length) await nextTask();
  assert.equal(worker.requests.filter(type => type === 'decode').length, slugs.length);
  worker.release({ reverse: true });
  const results = await Promise.all(loads);
  for (const [index, slug] of slugs.entries()) {
    await assertSame(await loadKaleidoscopeScheme(archive(slug), options(slug)), results[index], `${slug} #${index}`);
  }
  assert.equal(new Set(results.map(result => result.byteProvenance.loadId)).size, slugs.length);
});

test('a worker that errors or stays silent rejects its loads; nothing is retried on the calling thread', async () => {
  const failed = error => error instanceof Error && error.code === 'DECODE_WORKER_FAILED';
  const load = (port, extra = {}) => loadKaleidoscopeScheme(archive('1138'), { encodeAssets: false, decodeWorker: port, ...extra });

  const crashing = silentPort();
  const pending = [load(crashing), load(crashing)].map(promise => promise.then(() => 'resolved', error => error));
  await nextTask();
  assert.equal(crashing.posted.length, 2);
  crashing.emit('error', { message: 'Uncaught SyntaxError: Unexpected token' });
  for (const error of await Promise.all(pending)) {
    assert.ok(failed(error));
    assert.equal(error.message, 'Scriptoscope decode worker failed: Uncaught SyntaxError: Unexpected token');
  }
  // The worker is known bad: later loads fail at once instead of waiting on it.
  await assert.rejects(load(crashing), failed);
  assert.equal(crashing.posted.length, 2);

  const undecodable = silentPort();
  const lost = load(undecodable).then(() => 'resolved', error => error);
  await nextTask();
  undecodable.emit('messageerror');
  assert.match((await lost).message, /^Scriptoscope decode worker failed: a worker message could not be deserialized$/);

  const silent = silentPort();
  const started = performance.now();
  await assert.rejects(load(silent, { decodeWorkerTimeoutMs: 40 }), error => failed(error) && error.message === 'Scriptoscope decode worker failed: no response within 40 ms');
  assert.ok(performance.now() - started < 5000);
  assert.equal(silent.posted.length, 1);

  // Unrelated traffic on the same worker is ignored rather than mistaken for an answer.
  const shared = silentPort();
  const waiting = load(shared, { decodeWorkerTimeoutMs: 60 }).then(() => 'resolved', error => error);
  await nextTask();
  shared.emit('message', { data: { type: 'result', id: 1 } });
  shared.emit('message', { data: 'hello' });
  assert.ok(failed(await waiting));
});

test('a factory is called once, on first use, and again only after its worker failed', async t => {
  const spawned = [];
  const factory = () => { const worker = decodeWorker(t); spawned.push(worker); return worker; };
  const environment = await prepareCinfEnvironment({ version: 1, complete: true, providers: [{ kind: 'theme-fork', id: 'theme', complete: true }] });
  await loadKaleidoscopeScheme(archive('1138'), { encodeAssets: false, decodeWorker: factory, cinfEnvironment: environment });
  assert.equal(spawned.length, 0, 'a load that stays on the calling thread does not create the worker');
  const first = await loadKaleidoscopeScheme(archive('1138'), { encodeAssets: false, decodeWorker: factory });
  const second = await loadKaleidoscopeScheme(archive('1984'), { encodeAssets: false, decodeWorker: factory });
  assert.equal(spawned.length, 1);
  assert.deepEqual(spawned[0].requests, ['decode', 'decode']);
  assert.ok(first.manifest && second.manifest);
  assert.equal(spawned[0].terminated, 0);

  const ports = [];
  const failing = () => { const port = silentPort(); ports.push(port); return port; };
  const lost = loadKaleidoscopeScheme(archive('1138'), { encodeAssets: false, decodeWorker: failing }).catch(error => error);
  await nextTask();
  ports[0].emit('error', { message: 'gone' });
  assert.equal((await lost).code, 'DECODE_WORKER_FAILED');
  const retry = loadKaleidoscopeScheme(archive('1138'), { encodeAssets: false, decodeWorker: failing, decodeWorkerTimeoutMs: 20 }).catch(error => error);
  assert.equal((await retry).code, 'DECODE_WORKER_FAILED');
  assert.equal(ports.length, 2, 'the next load asks the factory for a replacement');
});

test('a malformed worker option is a TypeError, not a silent main-thread load', async () => {
  for (const decodeWorker of [null, {}, 'worker.js', { postMessage() {} }, () => ({})]) {
    await assert.rejects(loadKaleidoscopeScheme(archive('1138'), { encodeAssets: false, decodeWorker }), TypeError);
  }
  const port = silentPort();
  for (const decodeWorkerTimeoutMs of [0, -1, NaN, '30']) {
    await assert.rejects(loadKaleidoscopeScheme(archive('1138'), { encodeAssets: false, decodeWorker: port, decodeWorkerTimeoutMs }), TypeError);
  }
  assert.equal(port.posted.length, 0);
});
