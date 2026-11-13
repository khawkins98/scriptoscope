// `yieldBetweenStages`: an opt-in that ends the current task between decode stages.
// Without it a load must stay exactly as it was: same microtask tick, same option
// reads, no task boundary. With it the result is the same and only arrives later.
import '../../tests/helpers/registerTs.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const { loadKaleidoscopeScheme, loadOwnedKaleidoscopeScheme } = await import('./loadKaleidoscopeScheme.js');
const { prepareDisplayProfile } = await import('./display-profile.js');
const { prepareCinfEnvironment } = await import('./cinf-environment.js');
const { prepareCicnTransferResults } = await import('./cicn-transfer-results.js');
const { loadTheme, loadOwnedTheme } = await import('../../src/loadTheme.ts');
const { createThemeResolver, createOwnedThemeResolver } = await import('../../src/declarative/theme.ts');

const fixture = async path => new Uint8Array(await readFile(new URL(`../../themes/${path}`, import.meta.url)));
const json = async path => JSON.parse(await readFile(new URL(`../../tests/decoder-fixtures/${path}`, import.meta.url), 'utf8'));
const rsrc = await fixture('1138/scheme.rsrc'), sit = await fixture('1984/scheme.sit'), crayon = await fixture('crayon-os/scheme.sit');
const raw = (bytes, options = {}) => loadKaleidoscopeScheme(bytes, { encodeAssets: false, ...options });
const nextTask = () => new Promise(resolve => setImmediate(resolve));
await raw(sit); // import and instantiate the StuffIt decoder once, outside every count below
const RealChannel = globalThis.MessageChannel;

/**
 * Stand-in channel that delivers on a later task and reports each boundary first.
 * `onBoundary(n)` runs between the stages, where a caller's own code would.
 */
function boundaries(t, onBoundary = () => {}) {
  const state = { count: 0, open: 0 };
  globalThis.MessageChannel = class {
    constructor() {
      const n = ++state.count;
      state.open++;
      this.port1 = { onmessage: null, close: () => { state.open--; } };
      this.port2 = { postMessage: () => setImmediate(() => { onBoundary(n); this.port1.onmessage?.({ data: 0 }); }) };
    }
  };
  t.after(() => { globalThis.MessageChannel = RealChannel; });
  return state;
}

/** The real MessageChannel, with every port it hands out closed when the test ends, pass or fail. */
function trackedChannels(t) {
  const opened = [];
  globalThis.MessageChannel = class extends RealChannel { constructor() { super(); opened.push(this); } };
  t.after(() => {
    globalThis.MessageChannel = RealChannel;
    for (const channel of opened) { channel.port1.onmessage = null; channel.port1.close(); channel.port2.close(); }
  });
  return opened;
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
  const result = done ? count : 'crossed a task';
  await promise.catch(() => {});
  return result;
}

/**
 * A short digest of a whole decoded graph: key order, frozen state, repeated identities
 * and a hash of every typed array, with the random provenance load id masked. Two loads
 * are compared by digest because a structural diff of megabytes of pixels takes minutes
 * to print, which turns a failing comparison into an apparent hang.
 */
function digest(root) {
  const hash = createHash('sha256'), seen = new Map();
  const walk = (value, key) => {
    if (value === null || typeof value !== 'object') { hash.update(key === 'loadId' ? 'L' : `${typeof value}:${Object.is(value, -0) ? '-0' : String(value)};`); return; }
    if (seen.has(value)) { hash.update(`ref${seen.get(value)};`); return; }
    seen.set(value, seen.size);
    hash.update(`${value.constructor?.name}${Object.isFrozen(value) ? 'F' : ''}{`);
    if (ArrayBuffer.isView(value)) hash.update(new Uint8Array(value.buffer, value.byteOffset, value.byteLength));
    else for (const name of Reflect.ownKeys(value)) { hash.update(`${String(name)}=`); walk(value[name], name); }
    hash.update('}');
  };
  walk(root);
  return hash.digest('hex').slice(0, 24);
}
const same = (actual, expected, label) => assert.equal(digest(actual), digest(expected), label);
const different = (actual, expected, label) => assert.notEqual(digest(actual), digest(expected), label);

test('without the option a load settles on the same microtask tick and never opens a channel', async t => {
  const state = boundaries(t);
  // Tick counts of the loader before the option existed (origin/main at e4250ef9).
  assert.equal(await ticks(() => raw(rsrc)), 5);
  assert.equal(await ticks(() => raw(rsrc.slice(0, 100))), 5);
  assert.equal(await ticks(() => raw(new Uint8Array(0))), 2);
  assert.equal(await ticks(() => loadOwnedKaleidoscopeScheme(rsrc, {})), 5);
  assert.equal(await ticks(() => raw(sit)), 16);
  for (const value of [undefined, false, 0, '', null, NaN]) {
    assert.equal(await ticks(() => raw(rsrc, { yieldBetweenStages: value })), 5, String(value));
  }
  assert.equal(state.count, 0);
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

test('any truthy value opts in, like `provenance`', async t => {
  const state = boundaries(t);
  for (const value of [true, 1, 'false', {}, []]) {
    state.count = 0;
    await raw(rsrc, { yieldBetweenStages: value });
    assert.equal(state.count, 2, JSON.stringify(value));
  }
});

test('with the option the stages run in separate tasks: unwrap, chrome, icons', async t => {
  // What has run by the time of each boundary. The StuffIt unwrap decodes entry names;
  // chrome conversion reads `meta`; icon conversion consults the unmasked id list
  // (a list that is not an Array is used as given, so its lookups are visible).
  const done = new Set();
  const decode = TextDecoder.prototype.decode;
  TextDecoder.prototype.decode = function (...args) { done.add('unwrap'); return decode.apply(this, args); };
  t.after(() => { TextDecoder.prototype.decode = decode; });
  const seen = [];
  const state = boundaries(t, () => seen.push([...done].sort().join('+')));
  const options = () => ({
    yieldBetweenStages: true,
    meta: { get name() { done.add('chrome'); return 'observed'; } },
    unmaskedIconIds: { includes() { done.add('icons'); return false; } },
  });

  done.clear(); seen.length = 0;
  await raw(rsrc, options());
  assert.deepEqual(seen, ['chrome', 'chrome+icons'], 'raw fork: between the halves, then after conversion');

  done.clear(); seen.length = 0; state.count = 0;
  await raw(sit, options());
  assert.deepEqual(seen, ['unwrap', 'chrome+unwrap', 'chrome+icons+unwrap'], 'StuffIt: also after the unwrap and before any conversion');
  assert.equal(state.count, 3);
  assert.equal(state.open, 0, 'every boundary closed its port');

  state.count = 0;
  (await loadOwnedKaleidoscopeScheme(rsrc, { yieldBetweenStages: true })).dispose();
  assert.equal(state.count, 2, 'owned loads yield at the same stages');
});

// Every option that reaches a conversion stage, so a stage that drops one is caught.
const profile = await prepareDisplayProfile(await json('measured-display-profile-crayon.json')); // measured for crayon-os
const environment = await prepareCinfEnvironment({ version: 1, complete: true, providers: [{ kind: 'theme-fork', id: 't', complete: true }] });
const transferFixture = await json('finite-cicn-transfer.json');
const transferResults = await prepareCicnTransferResults(transferFixture.data);
const transferOptions = {
  displayProfile: await prepareDisplayProfile(transferFixture.profile),
  cicnTransfer: { results: transferResults, contractId: transferResults.contractId, maskPolicy: 'source-mask-alpha' },
};
const ids = { unmaskedIconIds: [-3999, -3983, 128], iconBlitCicnIds: [128, -10239], engineCinfIds: [128, -10239] };
const optionSets = {
  plain: [rsrc, {}],
  'plain .sit': [sit, {}],
  'meta and source': [rsrc, { meta: { name: 'Named', author: { name: 'A' } }, source: 'x/y.rsrc' }],
  'id lists': [sit, ids],
  provenance: [sit, { provenance: true, ...ids }],
  displayProfile: [crayon, { displayProfile: profile, ...ids }],
  cinfEnvironment: [rsrc, { cinfEnvironment: environment, engineCinfIds: ids.engineCinfIds }],
  sliderLayoutEnvironment: [rsrc, { sliderLayoutEnvironment: environment }],
  'cinfEnvironment with provenance': [sit, { cinfEnvironment: environment, provenance: true }],
  cicnTransfer: [Uint8Array.from(transferFixture.fork), transferOptions],
};

test('the yielded result is the same as the default one under every stage option', async t => {
  boundaries(t);
  // The options must matter, or dropping one from a stage would go unnoticed.
  for (const label of ['displayProfile', 'cinfEnvironment', 'id lists', 'meta and source']) {
    const [bytes, options] = optionSets[label];
    different(await raw(bytes, options), await raw(bytes), `${label} changes the result`);
  }
  const iconsOf = theme => theme.assets.filter(asset => asset.path.startsWith('icons/'));
  different(iconsOf(await raw(crayon, { displayProfile: profile })), iconsOf(await raw(crayon)), 'displayProfile reaches icon pixels');
  for (const [label, [bytes, options]] of Object.entries(optionSets)) {
    const expected = await raw(bytes.slice(), options), yielded = await raw(bytes.slice(), { ...options, yieldBetweenStages: true });
    assert.deepStrictEqual(Object.keys(yielded), Object.keys(expected), label);
    same(yielded, expected, label);
    if (options.provenance) assert.ok(yielded.byteProvenance.resources.length > 10, `${label}: resources observed`);
  }
  const owned = await loadOwnedKaleidoscopeScheme(rsrc), yielded = await loadOwnedKaleidoscopeScheme(rsrc, { yieldBetweenStages: true });
  same(yielded.source.manifest, owned.source.manifest, 'owned manifest');
  assert.deepStrictEqual(yielded.source.inspector.iconIndex.length, owned.source.inspector.iconIndex.length);
  owned.dispose(); yielded.dispose();
});

test('input bytes are copied when the load is called, not at the first await', async t => {
  const expected = await raw(rsrc);
  const scribble = input => new Uint8Array(ArrayBuffer.isView(input) ? input.buffer : input).fill(0xff);
  for (const [label, make] of [['Uint8Array', () => rsrc.slice()], ['ArrayBuffer', () => rsrc.slice().buffer]]) {
    // Changed at every boundary.
    let input = make(), scribbled = 0;
    boundaries(t, () => { scribble(input); scribbled++; });
    same(await raw(input, { yieldBetweenStages: true }), expected, `${label}: at the boundaries`);
    assert.equal(scribbled, 2);
    // Changed synchronously after the call, before the loader's first await resumes.
    boundaries(t);
    input = make();
    let load = raw(input, { yieldBetweenStages: true });
    scribble(input);
    same(await load, expected, `${label}: synchronously after the call`);
    // Changed in the first microtask after the call.
    input = make();
    load = raw(input, { yieldBetweenStages: true });
    queueMicrotask(() => scribble(input));
    same(await load, expected, `${label}: in a microtask`);
    // Detached straight after the call.
    input = make();
    load = raw(input, { yieldBetweenStages: true });
    structuredClone(ArrayBuffer.isView(input) ? input.buffer : input, { transfer: [ArrayBuffer.isView(input) ? input.buffer : input] });
    assert.equal(input.byteLength, 0, 'the caller buffer is detached');
    same(await load, expected, `${label}: detached`);
  }
});

test('id lists, meta and source are taken when the load is called: no hybrid from changes at a boundary', async t => {
  for (const [label, bytes] of [['raw fork', rsrc], ['StuffIt', sit]]) {
    const meta = { name: 'Held' };
    const expected = await raw(bytes, { ...ids, meta, source: 'held/source' });
    const options = { yieldBetweenStages: true, meta, source: 'held/source', unmaskedIconIds: [...ids.unmaskedIconIds], iconBlitCicnIds: [...ids.iconBlitCicnIds], engineCinfIds: [...ids.engineCinfIds] };
    let changed = 0;
    const change = () => {
      options.unmaskedIconIds.length = 0; options.iconBlitCicnIds.length = 0; options.engineCinfIds.length = 0;
      options.meta = { name: 'Changed' }; options.source = 'changed';
    };
    boundaries(t, () => { changed++; change(); });
    same(await raw(bytes, options), expected, `${label}: changed at the boundaries`);
    assert.ok(changed >= 2);
    // And synchronously after the call, before the loader's first await resumes.
    const again = { ...options, meta, source: 'held/source', unmaskedIconIds: [...ids.unmaskedIconIds], iconBlitCicnIds: [...ids.iconBlitCicnIds], engineCinfIds: [...ids.engineCinfIds] };
    const load = raw(bytes, again);
    again.unmaskedIconIds.length = 0; again.iconBlitCicnIds.length = 0; again.engineCinfIds.length = 0;
    again.meta = { name: 'Changed' }; again.source = 'changed';
    same(await load, expected, `${label}: changed straight after the call`);
  }
});

test('each boundary is a real MessageChannel task, and every port is closed', async t => {
  const opened = trackedChannels(t);
  assert.equal(await ticks(() => raw(rsrc, { yieldBetweenStages: true })), 'crossed a task');
  let tasks = 0, done = false;
  const spin = () => { if (!done) { tasks++; setImmediate(spin); } };
  setImmediate(spin);
  let theme;
  try { theme = await raw(sit, { yieldBetweenStages: true }); } finally { done = true; }
  assert.ok(tasks >= 1, `other tasks ran before the load settled (${tasks})`);
  assert.ok(theme.assets.length > 100);
  assert.equal(opened.length, 2 + 3);
  // A closed port no longer delivers. Collect every observation first, then assert once:
  // trackedChannels closes all ports afterwards whatever the outcome.
  const delivered = [];
  await nextTask(); await nextTask(); // a port finishes closing on a later task
  for (const channel of opened) {
    channel.port1.onmessage = () => delivered.push(opened.indexOf(channel));
    channel.port2.postMessage(0);
  }
  await nextTask(); await nextTask(); await nextTask();
  assert.deepEqual(delivered, []);
});

test('scheduler.yield is not used: no inherited priority or abort signal', async t => {
  boundaries(t);
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'scheduler');
  let used = 0;
  // The stand-ins resolve, so a loader that did call them fails this test instead of hanging it.
  globalThis.scheduler = { yield() { used++; return Promise.resolve(); }, postTask() { used++; return Promise.resolve(); } };
  t.after(() => { if (previous) Object.defineProperty(globalThis, 'scheduler', previous); else delete globalThis.scheduler; });
  assert.ok((await raw(sit, { yieldBetweenStages: true })).assets.length > 100);
  assert.equal(used, 0);
});

test('without MessageChannel an opted-in load rejects before any stage runs; a default load is unaffected', async t => {
  globalThis.MessageChannel = undefined;
  t.after(() => { globalThis.MessageChannel = RealChannel; });
  let reads = 0;
  const options = { encodeAssets: false, yieldBetweenStages: true, get meta() { reads++; return undefined; } };
  for (const bytes of [rsrc, sit, new Uint8Array(0)]) {
    await assert.rejects(loadKaleidoscopeScheme(bytes, options), /yieldBetweenStages needs MessageChannel/);
    await assert.rejects(loadOwnedKaleidoscopeScheme(bytes, options), /yieldBetweenStages needs MessageChannel/);
  }
  assert.equal(reads, 0, 'nothing past the check ran');
  // Existing option validation still comes first.
  await assert.rejects(raw(rsrc, { yieldBetweenStages: true, displayProfile: {} }), /^DisplayProfileError/);
  assert.ok((await raw(sit)).assets.length > 100);
  t.mock.method(globalThis, 'fetch', async url => new Response(String(url).endsWith('meta.json') ? '{}' : rsrc));
  await assert.rejects(loadOwnedTheme('/themes/1138', { source: 'scheme.rsrc', yieldBetweenStages: true }), /yieldBetweenStages needs MessageChannel/);
});

test('errors are the same ones, with or without the option', async t => {
  const state = boundaries(t);
  const message = async promise => { try { await promise; } catch (error) { return `${error.constructor.name}: ${error.message}`; } return 'resolved'; };
  for (const [label, bytes] of [['empty', new Uint8Array(0)], ['truncated fork', rsrc.slice(0, 100)], ['truncated archive', sit.slice(0, 400)], ['not a theme', new TextEncoder().encode('<!doctype html><html></html>'.repeat(8))]]) {
    const plain = await message(raw(bytes));
    assert.notEqual(plain, 'resolved', label);
    assert.equal(await message(raw(bytes, { yieldBetweenStages: true })), plain, label);
  }
  // Input and validation failures happen before the first boundary.
  state.count = 0;
  await assert.rejects(raw(new Uint8Array(0), { yieldBetweenStages: true }), /empty input/);
  await assert.rejects(raw(rsrc, { yieldBetweenStages: true, cinfEnvironment: {} }), /^CinfEnvironmentError/);
  assert.equal(state.count, 0);
});

test('a failing stage settles every provenance digest before the load rejects', async t => {
  boundaries(t);
  let started = 0, pending = 0;
  const digest = crypto.subtle.digest;
  crypto.subtle.digest = function (...args) {
    started++; pending++;
    const result = digest.apply(this, args);
    const settled = () => { pending--; };
    result.then(settled, settled);
    return result;
  };
  t.after(() => { crypto.subtle.digest = digest; });
  const unhandled = [];
  const onUnhandled = reason => unhandled.push(reason);
  process.on('unhandledRejection', onUnhandled);
  t.after(() => process.off('unhandledRejection', onUnhandled));
  const boom = new RangeError('stage failed');
  const failures = {
    'chrome stage': { meta: { get name() { throw boom; } } },
    'icon stage, after a boundary': { unmaskedIconIds: { includes() { throw boom; } } },
  };
  for (const [label, failing] of Object.entries(failures)) {
    for (const yieldBetweenStages of [false, true]) {
      started = 0;
      let pendingAtRejection;
      await raw(sit, { provenance: true, yieldBetweenStages, ...failing }).then(
        () => assert.fail(`${label}: resolved`),
        error => { pendingAtRejection = pending; assert.equal(error, boom, label); },
      );
      assert.ok(started > 10, `${label}: digests were in flight (${started})`);
      assert.equal(pendingAtRejection, 0, `${label}, yield ${yieldBetweenStages}: digests settled first`);
    }
  }
  for (let i = 0; i < 5; i++) await nextTask();
  assert.deepEqual(unhandled, []);
});

test('loadTheme, loadOwnedTheme and the resolvers pass the option through, and only when set', async t => {
  const state = boundaries(t);
  t.mock.method(globalThis, 'fetch', async url => new Response(String(url).endsWith('meta.json') ? '{}' : rsrc));
  const source = { source: 'scheme.rsrc' };
  for (const load of [loadTheme, loadOwnedTheme]) {
    state.count = 0;
    (await load('/themes/1138', source)).dispose?.();
    assert.equal(state.count, 0, `${load.name} default`);
    (await load('/themes/1138', { ...source, yieldBetweenStages: true })).dispose?.();
    assert.equal(state.count, 2, `${load.name} opted in`);
    // Read after the archive and sidecar requests, next to `provenance`: a value set
    // on the caller's object straight after the call is the one used.
    state.count = 0;
    const late = { ...source };
    const pending = load('/themes/1138', late);
    late.yieldBetweenStages = true;
    (await pending).dispose?.();
    assert.equal(state.count, 2, `${load.name} reads the option after its requests`);
  }
  for (const create of [createThemeResolver, createOwnedThemeResolver]) {
    const themes = [{ slug: '1138', ...source }];
    state.count = 0;
    const plain = create({ themes });
    await plain.load('1138');
    plain.dispose();
    assert.equal(state.count, 0, `${create.name} default`);
    // Read once, at creation: later changes to the caller's object do not matter.
    const options = { themes, yieldBetweenStages: true };
    const yielding = create(options);
    options.yieldBetweenStages = false;
    await yielding.load('1138');
    yielding.dispose();
    assert.equal(state.count, 2, `${create.name} opted in`);
    const options2 = { themes };
    const later = create(options2);
    options2.yieldBetweenStages = true;
    await later.load('1138');
    later.dispose();
    assert.equal(state.count, 2, `${create.name} ignores a value set after creation`);
  }
});
