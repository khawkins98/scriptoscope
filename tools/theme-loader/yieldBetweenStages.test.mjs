// `yieldBetweenStages`: an opt-in that ends the current task between decode stages.
// Without it a load must stay exactly as it was: same microtask tick, same option
// reads, no task boundary. With it the result is the same and only arrives later.
import '../../tests/helpers/registerTs.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const { loadKaleidoscopeScheme, loadOwnedKaleidoscopeScheme } = await import('./loadKaleidoscopeScheme.js');
const { loadTheme, loadOwnedTheme } = await import('../../src/loadTheme.ts');
const { createThemeResolver, createOwnedThemeResolver } = await import('../../src/declarative/theme.ts');

const fixture = async path => new Uint8Array(await readFile(new URL(`../../themes/${path}`, import.meta.url)));
const rsrc = await fixture('1138/scheme.rsrc'), sit = await fixture('1984/scheme.sit');
const raw = (bytes, options = {}) => loadKaleidoscopeScheme(bytes, { encodeAssets: false, ...options });
const nextTask = () => new Promise(resolve => setImmediate(resolve));
await raw(sit); // import and instantiate the StuffIt decoder once, outside every count below

/** Replace `scheduler.yield` with a counter that still resolves on a later microtask. */
function countYields(t, onYield = () => {}) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'scheduler');
  const calls = { count: 0 };
  globalThis.scheduler = { yield() { calls.count++; onYield(calls.count); return Promise.resolve(); } };
  t.after(() => { if (previous) Object.defineProperty(globalThis, 'scheduler', previous); else delete globalThis.scheduler; });
  return calls;
}

/** Microtask ticks until `start()` settles, or 'crossed a task'. The spin is bounded:
 *  an unbounded microtask loop would starve the very task it is waiting for. */
async function ticks(start) {
  let count = 0, done = false;
  const spin = () => { if (!done && count < 1000) { count++; queueMicrotask(spin); } };
  const promise = start();
  queueMicrotask(spin);
  const finish = () => { done = true; };
  promise.then(finish, finish);
  await nextTask();
  return done ? count : 'crossed a task';
}

test('without the option a load settles on the same microtask tick and never yields', async t => {
  const calls = countYields(t);
  // Tick counts of the loader before the option existed (origin/main at e4250ef9).
  assert.equal(await ticks(() => raw(rsrc)), 5);
  assert.equal(await ticks(() => raw(rsrc.slice(0, 100))), 5);
  assert.equal(await ticks(() => raw(new Uint8Array(0))), 2);
  assert.equal(await ticks(() => loadOwnedKaleidoscopeScheme(rsrc, {})), 5);
  assert.equal(await ticks(() => raw(sit)), 16);
  for (const value of [undefined, false, 0, '', null]) {
    assert.equal(await ticks(() => raw(rsrc, { yieldBetweenStages: value })), 5, String(value));
  }
  assert.equal(calls.count, 0);
});

test('the option is read once, after the existing synchronous validation and before any await', async () => {
  const reads = [];
  const options = new Proxy({ encodeAssets: false, meta: { name: 'm' }, source: 's', engineCinfIds: [] },
    { get(target, key) { if (typeof key === 'string') reads.push(key); return target[key]; } });
  const load = loadKaleidoscopeScheme(rsrc, options);
  const beforeAwait = [...reads];
  await load;
  // main's reads with exactly one addition: `yieldBetweenStages`.
  assert.deepEqual(beforeAwait, ['displayProfile', 'cicnTransfer', 'cinfEnvironment', 'sliderLayoutEnvironment', 'yieldBetweenStages', 'provenance', 'provenance']);
  assert.deepEqual(reads.slice(beforeAwait.length), ['provenance', 'meta', 'source', 'iconBlitCicnIds', 'unmaskedIconIds', 'engineCinfIds', 'engineCinfIds', 'encodeAssets']);
  // An invalid existing option still fails first; the new option is not reached.
  let reached = false;
  for (const invalid of [{ displayProfile: {} }, { cicnTransfer: 'x' }, { cinfEnvironment: {} }, { sliderLayoutEnvironment: {} }]) {
    Object.defineProperty(invalid, 'yieldBetweenStages', { enumerable: true, get() { reached = true; return true; } });
    await assert.rejects(loadKaleidoscopeScheme(rsrc, invalid), /^(DisplayProfile|CicnTransfer|CinfEnvironment)Error/);
  }
  assert.equal(reached, false);
});

test('with the option the stages run in separate tasks, in order', async t => {
  // Which id list each conversion half has consulted by the time of each yield.
  const touched = new Set();
  const watched = (name, ids) => new Proxy(ids, { get(target, key, receiver) { touched.add(name); return Reflect.get(target, key, receiver); } });
  const seen = [];
  const calls = countYields(t, () => seen.push([...touched].sort().join('+')));
  const options = () => ({ yieldBetweenStages: true, engineCinfIds: watched('chrome', [128]), unmaskedIconIds: watched('icons', [-3999]) });

  touched.clear(); seen.length = 0;
  await raw(rsrc, options());
  assert.deepEqual(seen, ['chrome', 'chrome+icons'], 'raw fork: between the halves, then after conversion');

  touched.clear(); seen.length = 0; calls.count = 0;
  await raw(sit, options());
  assert.deepEqual(seen, ['', 'chrome', 'chrome+icons'], 'StuffIt: also after the unwrap, before any conversion');
  assert.equal(calls.count, 3);

  calls.count = 0;
  (await loadOwnedKaleidoscopeScheme(rsrc, { yieldBetweenStages: true })).dispose();
  assert.equal(calls.count, 2, 'owned loads yield at the same stages');
  calls.count = 0;
  await raw(rsrc, { yieldBetweenStages: 1 });
  assert.equal(calls.count, 2, 'any truthy value opts in, like `provenance`');
});

test('the yielded result is the same as the default one', async t => {
  countYields(t);
  for (const [label, bytes] of [['raw fork', rsrc], ['StuffIt', sit]]) {
    const meta = { name: label };
    const plain = await raw(bytes, { meta }), yielded = await raw(bytes, { meta, yieldBetweenStages: true });
    assert.deepStrictEqual(Object.keys(yielded), Object.keys(plain), label);
    assert.deepStrictEqual(yielded, plain, label);
    assert.ok(yielded.assets.length > 100 && yielded.iconIndex.length > 0, label);
  }
  const plain = await loadOwnedKaleidoscopeScheme(rsrc), yielded = await loadOwnedKaleidoscopeScheme(rsrc, { yieldBetweenStages: true });
  assert.deepStrictEqual(yielded.source.manifest, plain.source.manifest);
  assert.deepStrictEqual(yielded.source.inspector.iconIndex.length, plain.source.inspector.iconIndex.length);
  plain.dispose(); yielded.dispose();
});

test('caller-owned input bytes are snapshotted, so changes between the stages do not reach the decode', async t => {
  const expected = await raw(rsrc);
  for (const make of [() => rsrc.slice(), () => rsrc.slice().buffer]) {
    const input = make();
    let scribbled = 0;
    countYields(t, () => { new Uint8Array(ArrayBuffer.isView(input) ? input.buffer : input).fill(0xff); scribbled++; });
    const theme = await raw(input, { yieldBetweenStages: true });
    assert.equal(scribbled, 2);
    assert.deepStrictEqual(theme, expected);
  }
});

test('without scheduler.yield each boundary is a real task, and nothing is left open', async t => {
  for (const scheduler of [undefined, { postTask() { throw new Error('not used'); } }]) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, 'scheduler');
    if (scheduler) globalThis.scheduler = scheduler; else delete globalThis.scheduler;
    t.after(() => { if (previous) Object.defineProperty(globalThis, 'scheduler', previous); else delete globalThis.scheduler; });
    const opened = [];
    const Channel = globalThis.MessageChannel;
    globalThis.MessageChannel = class extends Channel { constructor() { super(); opened.push(this); } };
    t.after(() => { globalThis.MessageChannel = Channel; });
    assert.equal(await ticks(() => raw(rsrc, { yieldBetweenStages: true })), 'crossed a task');
    let tasks = 0, done = false;
    const spin = () => { if (!done) { tasks++; setImmediate(spin); } };
    setImmediate(spin);
    const theme = await raw(sit, { yieldBetweenStages: true });
    done = true;
    assert.ok(tasks >= 1, `other tasks ran before the load settled (${tasks})`);
    assert.ok(theme.assets.length > 100);
    assert.equal(opened.length, 2 + 3);
    // A closed port no longer delivers: every boundary released its channel.
    for (const channel of opened) {
      let delivered = false;
      channel.port1.onmessage = () => { delivered = true; };
      channel.port2.postMessage(0);
      await nextTask(); await nextTask();
      assert.equal(delivered, false);
      channel.port2.close();
    }
    globalThis.MessageChannel = Channel;
  }
});

test('errors are the same ones, with or without the option', async t => {
  const calls = countYields(t);
  const message = async promise => { try { await promise; } catch (error) { return `${error.constructor.name}: ${error.message}`; } return 'resolved'; };
  for (const [label, bytes] of [['empty', new Uint8Array(0)], ['truncated fork', rsrc.slice(0, 100)], ['truncated archive', sit.slice(0, 400)], ['not a theme', new TextEncoder().encode('<!doctype html><html></html>'.repeat(8))]]) {
    const plain = await message(raw(bytes));
    assert.notEqual(plain, 'resolved', label);
    assert.equal(await message(raw(bytes, { yieldBetweenStages: true })), plain, label);
  }
  // Input and validation failures happen before the first boundary.
  calls.count = 0;
  await assert.rejects(raw(new Uint8Array(0), { yieldBetweenStages: true }), /empty input/);
  await assert.rejects(raw(rsrc, { yieldBetweenStages: true, cinfEnvironment: {} }));
  assert.equal(calls.count, 0);
});

test('a boundary that rejects fails the load with that reason, and provenance still settles', async t => {
  const unhandled = [];
  const onUnhandled = reason => unhandled.push(reason);
  process.on('unhandledRejection', onUnhandled);
  t.after(() => process.off('unhandledRejection', onUnhandled));
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'scheduler');
  t.after(() => { if (previous) Object.defineProperty(globalThis, 'scheduler', previous); else delete globalThis.scheduler; });
  for (const failAt of [1, 2]) {
    let count = 0;
    const reason = new DOMException('task aborted', 'AbortError');
    globalThis.scheduler = { yield: () => (++count === failAt ? Promise.reject(reason) : Promise.resolve()) };
    await assert.rejects(raw(rsrc, { yieldBetweenStages: true, provenance: true }), error => error === reason);
    assert.equal(count, failAt);
  }
  globalThis.scheduler = { yield: () => Promise.resolve() };
  const proven = await raw(rsrc, { yieldBetweenStages: true, provenance: true });
  assert.ok(proven.byteProvenance, 'provenance is still collected across the boundaries');
  for (let i = 0; i < 5; i++) await nextTask();
  assert.deepEqual(unhandled, []);
});

test('loadTheme, loadOwnedTheme and the resolvers pass the option through, and only when set', async t => {
  const calls = countYields(t);
  t.mock.method(globalThis, 'fetch', async url => new Response(String(url).endsWith('meta.json') ? '{}' : rsrc));
  const source = { source: 'scheme.rsrc' };
  for (const load of [loadTheme, loadOwnedTheme]) {
    calls.count = 0;
    (await load('/themes/1138', source)).dispose?.();
    assert.equal(calls.count, 0, `${load.name} default`);
    (await load('/themes/1138', { ...source, yieldBetweenStages: true })).dispose?.();
    assert.equal(calls.count, 2, `${load.name} opted in`);
  }
  for (const create of [createThemeResolver, createOwnedThemeResolver]) {
    const themes = [{ slug: '1138', ...source }];
    calls.count = 0;
    const plain = create({ themes });
    await plain.load('1138');
    plain.dispose();
    assert.equal(calls.count, 0, `${create.name} default`);
    // Read once, at creation: later changes to the caller's object do not matter.
    const options = { themes, yieldBetweenStages: true };
    const yielding = create(options);
    options.yieldBetweenStages = false;
    await yielding.load('1138');
    yielding.dispose();
    assert.equal(calls.count, 2, `${create.name} opted in`);
  }
});
