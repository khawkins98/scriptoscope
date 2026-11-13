// tools/sit-wasm/instance-recovery.test.mjs
// The wrapper shares one decoder instance between calls. These tests cover when it must
// replace that instance (a call into it threw, or it outgrew its memory limit), how a
// replacement is loaded and what happens when that load fails, and that the wrapper frees
// what it allocates. Crashes are simulated with stand-in instances, so nothing here depends
// on how the real decoder treats any particular input. The last tests run the real binary.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import createMunbox from './dist/munbox.mjs';
import { __createDecoderForTests as createDecoder, decodeArchive } from './index.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const opts = { timeout: 30_000 }; // nothing here waits on anything slow; a hang is a failure

// A wrapper bug can make a call wait in a loop that never leaves the microtask queue, and no
// test timeout can interrupt that. This watchdog process kills the test process if it is
// still running after three minutes (the file takes seconds), so such a bug fails the run
// instead of hanging it. It exits by itself once the test process is gone.
const WATCHDOG = `const pid = ${process.pid}, start = Date.now();
setInterval(() => {
  try { process.kill(pid, 0); } catch { process.exit(); }
  if (Date.now() - start > 180000) { try { process.kill(pid, 'SIGKILL'); } catch {} process.exit(); }
}, 1000);`;
const watchdog = spawn(process.execPath, ['-e', WATCHDOG], { stdio: 'ignore' });
watchdog.unref();
after(() => { watchdog.kill(); });

// Every stand-in factory refuses to make more than this many instances. A wrapper that
// loads replacements without bound would otherwise spin in microtasks, where no test
// timeout can interrupt it; with the cap its calls reject and the test fails at once.
const INSTANCE_CAP = 24;

const HEAP = 65536, IN_PTR = 64, OUT_PTR = 16384;
const w32 = (h, o, v) => { h[o] = v & 255; h[o + 1] = (v >>> 8) & 255; h[o + 2] = (v >>> 16) & 255; h[o + 3] = v >>> 24; };

class Heap extends Uint8Array {
  failSet = null; // an error for the next set() to throw
  failSlice = null; // an error for the next slice() to throw
  set(...a) { if (this.failSet) throw this.failSet; return super.set(...a); }
  slice(...a) { if (this.failSlice) throw this.failSlice; return new Uint8Array(this).slice(...a); }
}

// Growth as the real glue does it: HEAPU8 is replaced by a longer view with the same contents.
const growTo = (m, bytes) => { const bigger = new Heap(bytes); bigger.set(m.HEAPU8); m.HEAPU8 = bigger; };

// A stand-in for an instantiated module. Its decode returns one resource-fork entry named
// after the instance, whose bytes are the input, so a result says which instance produced it.
// `onDecode(m)` runs first and may throw (a crash), return 0 (an ordinary decoder error) or
// grow the heap.
function fakeModule(name, onDecode = () => {}) {
  const calls = { malloc: 0, free: 0, decode: 0, sitFree: 0 };
  const m = {
    name, calls, mallocResult: IN_PTR, mallocSizes: [], errorText: 'boom', onMalloc: () => {},
    HEAPU8: new Heap(HEAP).fill(0xEE),
    _malloc(n) { calls.malloc++; m.mallocSizes.push(n); m.onMalloc(m); return m.mallocResult; },
    _free(ptr) { assert.equal(ptr, IN_PTR); calls.free++; },
    _sit_free(ptr) { assert.equal(ptr, OUT_PTR); calls.sitFree++; },
    _sit_error: () => 1,
    UTF8ToString: () => m.errorText,
    _sit_decode(ptr, len) {
      calls.decode++;
      const input = new Uint8Array(m.HEAPU8).slice(ptr, ptr + len);
      if (onDecode(m) === 0) return 0;
      const h = m.HEAPU8, nameBytes = new TextEncoder().encode(name);
      let p = OUT_PTR + 8;
      w32(h, p, nameBytes.length); p += 4;
      Uint8Array.prototype.set.call(h, nameBytes, p); p += nameBytes.length;
      w32(h, p, 0x41424344); w32(h, p + 4, 0x45464748); w32(h, p + 8, 1); w32(h, p + 12, input.length); p += 16;
      Uint8Array.prototype.set.call(h, input, p); p += input.length;
      w32(h, OUT_PTR, p - OUT_PTR); w32(h, OUT_PTR + 4, 1);
      return OUT_PTR;
    },
  };
  return m;
}

// A decoder over stand-in instances. `behaviours[i]` is the onDecode of the i-th instance
// made. `loads[n]` says how the n-th load goes instead of succeeding: an Error rejects with
// it, `{ throwSync }` makes the factory throw it synchronously, and `{ gate }` (from
// `gate()`) holds the load until the test opens the gate; `{ gate, then }` also runs `then`
// in the job that completes the load.
function setup(behaviours = [], loads = []) {
  const made = [];
  const log = { loads: 0, options: [] };
  const make = () => { const m = fakeModule(`i${made.length}`, behaviours[made.length]); made.push(m); return m; };
  const decode = createDecoder((options) => {
    const n = log.loads++;
    log.options.push(options);
    if (n >= INSTANCE_CAP) return Promise.reject(new Error('runaway instantiation'));
    const how = loads[n];
    if (how instanceof Error) return Promise.reject(how);
    if (how?.throwSync) throw how.throwSync;
    if (how?.gate) return how.gate.then(() => { const m = make(); how.then?.(); return m; });
    return Promise.resolve().then(make);
  });
  return { made, decode, log };
}
const gate = () => { let open; const promise = new Promise((r) => { open = r; }); return { gate: promise, open }; };
const input = (...b) => new Uint8Array(b);
const servedBy = (entries) => entries[0].name;
const entry = (name, bytes) => [{ name, type: 0x41424344, creator: 0x45464748, forkType: 1, bytes }];
const isThe = (error) => (e) => e === error;
const isOrdinary = (message) => (e) => e.constructor === Error && e.message === message;
const crashError = () => new WebAssembly.RuntimeError('unreachable');
// Lets every pending promise job run, so a load started in the background has landed.
const settle = () => new Promise((r) => setImmediate(r));
// Freezes Date.now() for the test and returns a function that advances it.
const clock = (t) => { t.mock.timers.enable({ apis: ['Date'], now: 1_000_000 }); return (ms) => t.mock.timers.tick(ms); };
const RETRY_MS = 1000;

// Runs `body` and fails if it left a promise rejection unhandled.
async function withoutUnhandledRejections(body) {
  const seen = [];
  const listener = (reason) => seen.push(reason);
  process.on('unhandledRejection', listener);
  try {
    await body();
    await settle();
    await settle();
  } finally { process.off('unhandledRejection', listener); }
  assert.equal(seen.length, 0, 'no unhandled rejections');
}

// The instance in service (`old`) is over its limit: the next call starts loading one
// replacement and is still served by `old`; once that has loaded, calls are served by `fresh`.
async function expectReplacement({ decode, log }, old, fresh) {
  const before = log.loads;
  assert.equal(servedBy(await decode(input(200))), old, 'the call that starts the replacement is served by the old instance');
  assert.equal(log.loads, before + 1, 'one replacement started');
  await settle();
  assert.equal(servedBy(await decode(input(201))), fresh);
  assert.equal(servedBy(await decode(input(202))), fresh);
  assert.equal(log.loads, before + 1);
}
async function expectNoReplacement({ decode, log }, name) {
  const before = log.loads;
  for (let i = 0; i < 3; i++) { assert.equal(servedBy(await decode(input(210 + i))), name); await settle(); }
  assert.equal(log.loads, before);
}

test('a healthy instance is shared, decodes correctly and frees both buffers each time', opts, async () => {
  const { made, decode, log } = setup();
  for (let i = 0; i < 5; i++) assert.deepEqual(await decode(input(i, 2, 3)), entry('i0', input(i, 2, 3)));
  assert.deepEqual(await decode(input(7, 8).buffer), entry('i0', input(7, 8)));
  await settle();
  assert.equal(log.loads, 1);
  assert.deepEqual(made[0].calls, { malloc: 6, free: 6, decode: 6, sitFree: 6 });
  assert.deepEqual(made[0].mallocSizes, [3, 3, 3, 3, 3, 2]);
});

test('an empty input still allocates one byte', opts, async () => {
  const { made, decode } = setup();
  assert.deepEqual(await decode(input()), entry('i0', input()));
  assert.deepEqual(made[0].mallocSizes, [1]);
});

for (const [kind, make] of [
  ['a WebAssembly trap', () => new WebAssembly.RuntimeError('unreachable')],
  ['a runtime abort', () => new WebAssembly.RuntimeError('Aborted(). Build with -sASSERTIONS for more info.')],
  ['any other throw', () => new RangeError('Maximum call stack size exceeded')],
]) {
  test(`${kind} in a decode rejects with that error and retires the instance`, opts, async () => {
    const crash = make();
    const { made, decode, log } = setup([() => { throw crash; }]);
    await assert.rejects(decode(input(1)), isThe(crash));
    await settle();
    assert.equal(log.loads, 1, 'no replacement until a call needs one');

    assert.equal(servedBy(await decode(input(2))), 'i1');
    assert.equal(servedBy(await decode(input(3))), 'i1', 'the replacement is shared like the first instance');
    assert.equal(log.loads, 2);
    assert.deepEqual(made[0].calls, { malloc: 1, free: 0, decode: 1, sitFree: 0 }, 'a crashed instance is not called again');
    assert.deepEqual(made[1].calls, { malloc: 2, free: 2, decode: 2, sitFree: 2 });
  });
}

test('a crash in any other call into the instance retires it too', opts, async () => {
  for (const method of ['_malloc', '_free', '_sit_free', '_sit_error', 'UTF8ToString']) {
    const crash = new WebAssembly.RuntimeError(`crash in ${method}`);
    const { made, decode, log } = setup([(m) => {
      m[method] = () => { throw crash; };
      return method === '_sit_error' || method === 'UTF8ToString' ? 0 : undefined;
    }]);
    if (method === '_malloc') await decode(input(0)); // the first decode installs the crash
    await assert.rejects(decode(input(1)), isThe(crash), method);
    assert.equal(servedBy(await decode(input(2))), 'i1', method);
    assert.equal(log.loads, 2, method);
    assert.equal(made.length, 2, method);
  }
});

test('an ordinary decoder error keeps the instance, frees the input and reports the decoder text', opts, async () => {
  let fail = true;
  const { made, decode, log } = setup([() => (fail ? 0 : undefined)]);
  await assert.rejects(decode(input(1)), isOrdinary('decodeArchive: boom'));
  made[0].errorText = '';
  await assert.rejects(decode(input(1)), isOrdinary('decodeArchive: decode failed'));
  fail = false;
  assert.equal(servedBy(await decode(input(2))), 'i0');
  await settle();
  assert.equal(log.loads, 1);
  assert.deepEqual(made[0].calls, { malloc: 3, free: 3, decode: 3, sitFree: 1 });
});

test('a failed input allocation is an ordinary error and nothing is written to the heap', opts, async () => {
  const { made, decode, log } = setup();
  await decode(input(9)); // instance exists
  const m = made[0];
  const before = new Uint8Array(m.HEAPU8);
  m.mallocResult = 0;
  await assert.rejects(decode(input(1, 2, 3, 4)), isOrdinary('decodeArchive: out of memory'));
  assert.deepEqual(new Uint8Array(m.HEAPU8), before, 'heap untouched');
  assert.deepEqual(m.calls, { malloc: 2, free: 1, decode: 1, sitFree: 1 }, 'no decode, nothing to free');
  m.mallocResult = IN_PTR;
  assert.equal(servedBy(await decode(input(2))), 'i0', 'the instance stays in use');
  await settle();
  assert.equal(log.loads, 1);
});

test('a throw while copying the result out reaches the caller as thrown, frees the output buffer and keeps the instance', opts, async () => {
  const { made, decode, log } = setup();
  await decode(input(9));
  const m = made[0];
  const failure = new RangeError('copy-out failed');
  const realDecode = m._sit_decode;
  m._sit_decode = (...a) => { const r = realDecode(...a); m.HEAPU8.failSlice = failure; return r; };
  await assert.rejects(decode(input(1)), isThe(failure));
  assert.deepEqual(m.calls, { malloc: 2, free: 2, decode: 2, sitFree: 2 });
  m.HEAPU8.failSlice = null;
  m._sit_decode = realDecode;
  assert.equal(servedBy(await decode(input(2))), 'i0');
  await settle();
  assert.equal(log.loads, 1);
});

test('a throw while copying the input in reaches the caller as thrown, frees the input buffer and keeps the instance', opts, async () => {
  const { made, decode, log } = setup();
  await decode(input(9));
  const m = made[0];
  const failure = new RangeError('copy-in failed');
  m.HEAPU8.failSet = failure;
  await assert.rejects(decode(input(1)), isThe(failure));
  assert.deepEqual(m.calls, { malloc: 2, free: 2, decode: 1, sitFree: 1 });
  m.HEAPU8.failSet = null;
  assert.equal(servedBy(await decode(input(2))), 'i0');
  await settle();
  assert.equal(log.loads, 1);
});

test('when cleanup after a failed copy throws as well, the copy error wins and the instance is retired', opts, async () => {
  for (const [flag, cleanup] of [['failSet', '_free'], ['failSlice', '_sit_free']]) {
    const { made, decode, log } = setup();
    await decode(input(9));
    const m = made[0];
    const failure = new RangeError(`${flag} copy failed`);
    const realDecode = m._sit_decode;
    if (flag === 'failSet') m.HEAPU8.failSet = failure;
    else m._sit_decode = (...a) => { const r = realDecode(...a); m.HEAPU8.failSlice = failure; return r; };
    m[cleanup] = () => { throw new WebAssembly.RuntimeError(`crash in ${cleanup}`); };
    await assert.rejects(decode(input(1)), isThe(failure), cleanup);
    assert.equal(servedBy(await decode(input(2))), 'i1', cleanup);
    assert.equal(log.loads, 2, cleanup);
  }
});

// The limit for a decode is max(2 × initial, initial + 3 × (input + output bytes)).
const OVER = HEAP * 2 + 4096;
const growOnce = (m) => { if (m.HEAPU8.length < OVER) growTo(m, OVER); };

test('an instance that outgrew its limit delivers its result, serves the next call while its replacement loads, then is replaced', opts, async () => {
  let n = 0;
  const ctx = setup([(m) => { if (++n === 3) growTo(m, OVER); }]);
  const { made, decode, log } = ctx;
  assert.equal(servedBy(await decode(input(1))), 'i0');
  assert.equal(servedBy(await decode(input(2))), 'i0');
  assert.deepEqual(await decode(input(3, 3, 3)), entry('i0', input(3, 3, 3)), 'the decode that grew memory still returns its result');
  await settle();
  assert.equal(log.loads, 1, 'no replacement until a call needs one');
  await expectReplacement(ctx, 'i0', 'i1');
  assert.deepEqual(made[0].calls, { malloc: 4, free: 4, decode: 4, sitFree: 4 }, 'the outgrown instance was left clean');
  assert.equal(made[1].HEAPU8.length, HEAP);

  growTo(made[1], OVER); // and the same again for its replacement
  assert.equal(servedBy(await decode(input(9))), 'i1');
  await expectReplacement(ctx, 'i1', 'i2');
  assert.equal(log.loads, 3);
});

test('memory at exactly twice the initial size is within the limit', opts, async () => {
  const ctx = setup([(m) => growTo(m, HEAP * 2)]);
  assert.equal(servedBy(await ctx.decode(input(1))), 'i0');
  await expectNoReplacement(ctx, 'i0');
});

test('growth that the size of the input and output accounts for does not replace the instance', opts, async () => {
  const big = new Uint8Array(12000).fill(7); // 3 × (input + output) is above the initial size
  const ctx = setup([growOnce]);
  for (let i = 0; i < 4; i++) { assert.deepEqual(await ctx.decode(big), entry('i0', big)); await settle(); }
  assert.equal(ctx.log.loads, 1, 'repeated large decodes keep one instance');
  assert.equal(servedBy(await ctx.decode(input(1))), 'i0', 'a small decode finds it over the limit for a small input');
  await expectReplacement(ctx, 'i0', 'i1');
});

test('growth during the input allocation counts', opts, async () => {
  const ctx = setup();
  await ctx.decode(input(0));
  ctx.made[0].onMalloc = growOnce;
  assert.equal(servedBy(await ctx.decode(input(1))), 'i0');
  await expectReplacement(ctx, 'i0', 'i1');
});

test('growth during the input allocation of an instance\'s first decode counts', opts, async () => {
  const fresh = [];
  const decode = createDecoder(() => Promise.resolve().then(() => {
    const m = fakeModule(`i${fresh.length}`);
    if (fresh.length === 0) m.onMalloc = growOnce;
    fresh.push(m);
    return m;
  }));
  assert.equal(servedBy(await decode(input(1))), 'i0');
  assert.equal(servedBy(await decode(input(2))), 'i0');
  await settle();
  assert.equal(servedBy(await decode(input(3))), 'i1', 'the initial size was taken before the allocation');
});

test('outgrowing the limit also counts when the decode ends in an ordinary error', opts, async () => {
  const ctx = setup([(m) => { if (m.HEAPU8.length < OVER) { growTo(m, OVER); return 0; } }]);
  await assert.rejects(ctx.decode(input(1)), isOrdinary('decodeArchive: boom'));
  assert.deepEqual(ctx.made[0].calls, { malloc: 1, free: 1, decode: 1, sitFree: 0 });
  await expectReplacement(ctx, 'i0', 'i1');
});

test('outgrowing the limit also counts when a copy throws', opts, async () => {
  for (const flag of ['failSet', 'failSlice']) {
    const ctx = setup();
    await ctx.decode(input(9));
    const m = ctx.made[0];
    const failure = new RangeError(`${flag} copy failed`);
    const realDecode = m._sit_decode;
    if (flag === 'failSet') m.onMalloc = () => { growTo(m, OVER); m.HEAPU8.failSet = failure; };
    else m._sit_decode = (...a) => { const r = realDecode(...a); growTo(m, OVER); m.HEAPU8.failSlice = failure; return r; };
    await assert.rejects(ctx.decode(input(1)), isThe(failure), flag);
    m.onMalloc = () => {};
    m._sit_decode = realDecode;
    m.HEAPU8.failSet = m.HEAPU8.failSlice = null;
    await expectReplacement(ctx, 'i0', 'i1');
  }
});

test('calls waiting on an instance that crashes share one replacement', opts, async () => {
  const crash = crashError();
  const { made, decode, log } = setup([() => { throw crash; }]);
  // All four start before the first instance exists, so all four wait on the same one.
  const results = await Promise.allSettled([decode(input(1)), decode(input(2)), decode(input(3)), decode(input(4))]);
  assert.equal(results[0].status, 'rejected');
  assert.equal(results[0].reason, crash);
  assert.deepEqual(results.slice(1).map((r) => r.status), ['fulfilled', 'fulfilled', 'fulfilled']);
  assert.deepEqual(results.slice(1).map((r) => [servedBy(r.value), [...r.value[0].bytes]]), [['i1', [2]], ['i1', [3]], ['i1', [4]]]);
  assert.equal(log.loads, 2, 'one failure, one replacement');
  assert.equal(made[0].calls.decode, 1, 'the crashed instance served only the call that crashed it');
  assert.deepEqual(made[1].calls, { malloc: 3, free: 3, decode: 3, sitFree: 3 });
});

test('each crash among concurrent calls costs exactly one replacement', opts, async () => {
  const crash = () => { throw crashError(); };
  const { made, decode, log } = setup([crash, crash]);
  const results = await Promise.allSettled([1, 2, 3, 4, 5].map((b) => decode(input(b))));
  assert.deepEqual(results.map((r) => r.status), ['rejected', 'rejected', 'fulfilled', 'fulfilled', 'fulfilled']);
  assert.deepEqual(results.slice(2).map((r) => [servedBy(r.value), [...r.value[0].bytes]]), [['i2', [3]], ['i2', [4]], ['i2', [5]]]);
  assert.equal(log.loads, 3);
  assert.deepEqual(made.map((m) => m.calls.decode), [1, 1, 3]);
});

test('calls made while a replacement is loading are served by the outgrown instance and share that one load', opts, async () => {
  const held = gate();
  const { made, decode, log } = setup([growOnce], [null, held]);
  assert.equal(servedBy(await decode(input(1))), 'i0');
  const during = await Promise.all([decode(input(2)), decode(input(3)), decode(input(4))]);
  assert.deepEqual(during.map(servedBy), ['i0', 'i0', 'i0']);
  assert.equal(servedBy(await decode(input(5))), 'i0');
  assert.equal(log.loads, 2, 'one replacement, however many calls arrive while it loads');
  held.open();
  await settle();
  assert.equal(servedBy(await decode(input(6))), 'i1');
  assert.equal(log.loads, 2);
  assert.deepEqual(made.map((m) => m.calls.decode), [5, 1]);
});

test('a replacement that never finishes loading costs nothing', opts, async () => {
  const { decode, log } = setup([growOnce], [null, gate()]);
  for (let i = 0; i < 6; i++) { assert.equal(servedBy(await decode(input(i))), 'i0'); await settle(); }
  assert.equal(log.loads, 2);
});

test('a factory that throws synchronously while replacing an outgrown instance costs nothing', opts, async (t) => {
  await withoutUnhandledRejections(async () => {
    const advance = clock(t);
    const ctx = setup([growOnce], [null, { throwSync: new Error('factory threw') }]);
    assert.equal(servedBy(await ctx.decode(input(1))), 'i0');
    assert.equal(servedBy(await ctx.decode(input(2))), 'i0', 'the call that met the throw is served');
    assert.equal(ctx.log.loads, 2);
    await settle();
    advance(RETRY_MS);
    await expectReplacement(ctx, 'i0', 'i1');
  });
});

test('a crash on an outgrown instance while its replacement loads: the late replacement is not put in service', opts, async () => {
  const held = gate();
  const crash = crashError();
  let n = 0;
  const { made, decode, log } = setup([(m) => { n++; if (n === 1) growTo(m, OVER); if (n === 3) throw crash; }], [null, held]);
  assert.equal(servedBy(await decode(input(1))), 'i0');
  assert.equal(servedBy(await decode(input(2))), 'i0'); // starts the held replacement
  await assert.rejects(decode(input(3)), isThe(crash));
  assert.equal(servedBy(await decode(input(4))), 'i1', 'nothing usable, so this call loaded its own replacement');
  assert.equal(log.loads, 3);
  held.open();
  await settle();
  assert.equal(made.length, 3, 'the held load finished');
  assert.equal(servedBy(await decode(input(5))), 'i1', 'and was not swapped in over the instance in service');
  await settle();
  assert.equal(log.loads, 3);
});

test('an instance that outgrew its limit and then crashed is replaced once', opts, async () => {
  const crash = crashError();
  let n = 0;
  const { decode, log } = setup([(m) => { if (++n === 1) growTo(m, OVER); else throw crash; }]);
  const results = await Promise.allSettled([decode(input(1)), decode(input(2))]); // both wait on the first instance
  assert.equal(servedBy(results[0].value), 'i0');
  assert.equal(results[1].reason, crash);
  assert.equal(servedBy(await decode(input(3))), 'i1');
  await settle();
  assert.equal(servedBy(await decode(input(4))), 'i1');
  assert.equal(log.loads, 2);
});

test('a call that was already waiting when the replacement went into service runs on the old instance without disturbing the new one', opts, async () => {
  // The late call is made from a job queued while the replacement's load completes, so it
  // waits on the old instance's promise and runs after the swap.
  let late;
  const held = gate();
  held.then = () => { Promise.resolve().then(() => { late = ctx.decode(input(9)); }); };
  const ctx = setup([growOnce], [null, held]);
  assert.equal(servedBy(await ctx.decode(input(1))), 'i0');
  assert.equal(servedBy(await ctx.decode(input(2))), 'i0');
  held.open();
  await settle();
  assert.equal(servedBy(await late), 'i0');
  await expectNoReplacement(ctx, 'i1');
  assert.equal(ctx.log.loads, 2, 'the old instance being over its limit does not retire the new one');
});

test('a failed first instantiation is kept: later calls reject with it and nothing is retried', opts, async (t) => {
  const advance = clock(t);
  const failure = new Error('no wasm');
  const { decode, log } = setup([], [failure]);
  const results = await Promise.allSettled([decode(input(1)), decode(input(2))]);
  assert.deepEqual(results.map((r) => r.reason), [failure, failure]);
  await assert.rejects(decode(input(3)), isThe(failure));
  advance(10 * RETRY_MS);
  await assert.rejects(decode(input(4)), isThe(failure));
  assert.equal(log.loads, 1);
});

test('a failed replacement after a crash rejects the calls that need it, is retried no sooner than the retry interval, and decoding recovers', opts, async (t) => {
  await withoutUnhandledRejections(async () => {
    const advance = clock(t);
    const crash = crashError();
    const failure = new Error('no wasm just now'), second = new Error('still no wasm');
    const { made, decode, log } = setup([() => { throw crash; }], [null, failure, second]);
    await assert.rejects(decode(input(1)), isThe(crash));
    const waiting = await Promise.allSettled([decode(input(2)), decode(input(3))]);
    assert.deepEqual(waiting.map((r) => r.reason), [failure, failure], 'both waited on the one failed load');
    assert.equal(log.loads, 2);
    for (let i = 0; i < 5; i++) await assert.rejects(decode(input(4)), isThe(failure), 'within the interval: the same failure, no new attempt');
    advance(RETRY_MS - 1);
    await assert.rejects(decode(input(4)), isThe(failure));
    assert.equal(log.loads, 2);
    advance(1);
    await assert.rejects(decode(input(5)), isThe(second), 'the interval has passed: a new attempt, which also fails');
    assert.equal(log.loads, 3);
    await assert.rejects(decode(input(5)), isThe(second));
    assert.equal(log.loads, 3, 'the interval restarts at the latest failure');
    advance(RETRY_MS);
    assert.equal(servedBy(await decode(input(6))), 'i1');
    assert.equal(servedBy(await decode(input(7))), 'i1');
    assert.equal(log.loads, 4);
    assert.equal(made[0].calls.decode, 1);
  });
});

test('a failed replacement for an outgrown instance costs nothing and is retried no sooner than the retry interval', opts, async (t) => {
  await withoutUnhandledRejections(async () => {
    const advance = clock(t);
    const failure = new Error('no wasm just now');
    const ctx = setup([growOnce], [null, failure, failure]);
    const { made, decode, log } = ctx;
    assert.equal(servedBy(await decode(input(1))), 'i0');
    assert.equal(servedBy(await decode(input(2))), 'i0');
    assert.equal(log.loads, 2);
    await settle();
    for (let i = 0; i < 5; i++) { assert.equal(servedBy(await decode(input(3))), 'i0'); await settle(); }
    assert.equal(log.loads, 2, 'within the interval: no new attempt');
    advance(RETRY_MS - 1);
    assert.equal(servedBy(await decode(input(4))), 'i0');
    assert.equal(log.loads, 2);
    advance(1);
    assert.equal(servedBy(await decode(input(5))), 'i0');
    assert.equal(log.loads, 3, 'the interval has passed: a second attempt, which also fails');
    await settle();
    assert.equal(servedBy(await decode(input(6))), 'i0');
    assert.equal(log.loads, 3);
    advance(RETRY_MS);
    await expectReplacement(ctx, 'i0', 'i1');
    assert.equal(log.loads, 4);
    assert.equal(made[0].calls.decode, 11);
  });
});

// A stand-in for the browser glue: it starts a streaming compile synchronously inside the
// factory call, as the real glue does, unless it is handed `instantiateWasm`. `plan` can
// change how individual loads go.
const EMPTY_WASM = new Uint8Array([0, 0x61, 0x73, 0x6d, 1, 0, 0, 0]);
function browserLikeGlue(plan = {}) {
  const log = { fetches: 0, hooked: [], options: [], made: [], hookImports: {}, responses: [], streamed: [] };
  const imports = { marker: 'the glue\'s imports' };
  const next = () => {
    const m = fakeModule(`i${log.made.length}`, (mod) => { if (mod.crashNext) { mod.crashNext = false; throw crashError(); } });
    log.made.push(m);
    return m;
  };
  const glue = (options) => {
    const n = log.options.push(options) - 1;
    if (n >= INSTANCE_CAP) return Promise.reject(new Error('runaway instantiation'));
    if (plan.throwSync?.(n)) throw plan.throwSync(n);
    if (options.instantiateWasm) {
      if (plan.rejectHook) return Promise.reject(plan.rejectHook);
      return new Promise((done) => {
        options.instantiateWasm(log.hookImports, (instance, module) => {
          if (plan.receiveThrows) throw plan.receiveThrows;
          log.hooked.push({ instance, module });
          done(next());
        });
      });
    }
    log.fetches++;
    if (plan.rejectDefault?.(n)) return Promise.reject(plan.rejectDefault(n));
    if (plan.streams && !plan.streams(n)) return Promise.resolve().then(next);
    const response = new Response(plan.wasm ?? EMPTY_WASM, { headers: { 'content-type': 'application/wasm' } });
    log.responses.push(response);
    const streamed = WebAssembly.instantiateStreaming(response, imports);
    log.streamed.push(streamed);
    return streamed.then(next);
  };
  return { glue, log, imports };
}
const crashAndReplace = async (decode, log, old, fresh) => {
  log.made.at(-1).crashNext = true;
  await assert.rejects(decode(input(100)), WebAssembly.RuntimeError);
  assert.equal(log.made.at(-1).name, old);
  assert.equal(servedBy(await decode(input(101))), fresh);
};
// Runs `body` with `wrapper` installed as WebAssembly.instantiateStreaming, as another
// library might have done, and puts the native function back afterwards.
async function withInstalled(makeWrapper, body) {
  const native = WebAssembly.instantiateStreaming;
  const wrapper = makeWrapper(native);
  WebAssembly.instantiateStreaming = wrapper;
  try { await body(wrapper, native); } finally { WebAssembly.instantiateStreaming = native; }
}

test('replacements reuse the module compiled for the first instance and do not fetch', opts, async () => {
  const streaming = WebAssembly.instantiateStreaming;
  const { glue, log } = browserLikeGlue();
  const decode = createDecoder(glue);
  const pending = decode(input(1));
  assert.equal(WebAssembly.instantiateStreaming, streaming, 'the global is as it was once the factory call returns');
  assert.equal(servedBy(await pending), 'i0');
  assert.equal(log.fetches, 1);

  await crashAndReplace(decode, log, 'i0', 'i1');
  growTo(log.made[1], OVER);
  assert.equal(servedBy(await decode(input(4))), 'i1');
  await expectReplacement({ decode, log: { get loads() { return log.options.length; } } }, 'i1', 'i2');

  assert.equal(log.fetches, 1, 'only the first instance fetched');
  assert.equal(log.hooked.length, 2);
  assert.ok(log.hooked[0].module instanceof WebAssembly.Module);
  assert.equal(log.hooked[1].module, log.hooked[0].module, 'one compiled module serves every replacement');
  assert.ok(log.hooked.every((h) => h.instance instanceof WebAssembly.Instance));
  assert.notEqual(log.hooked[0].instance, log.hooked[1].instance, 'each replacement is a new instance');
  assert.equal(log.options.length, 3);
  assert.ok(log.options.every((o) => typeof o.print === 'function'), 'stdout is silenced for every instance');
  assert.equal(WebAssembly.instantiateStreaming, streaming);
});

test('the glue\'s streaming call reaches the function that was installed with the same receiver, arguments and promise, and that function stays installed', opts, async () => {
  const seen = [], returned = [];
  await withInstalled((native) => function installed(...args) {
    seen.push({ self: this, args });
    const result = native.apply(this, args);
    returned.push(result);
    return result;
  }, async (installed) => {
    const { glue, log, imports } = browserLikeGlue();
    const decode = createDecoder(glue);
    const pending = decode(input(1));
    assert.equal(WebAssembly.instantiateStreaming, installed, 'the function found is the one put back, not the native one');
    assert.equal(servedBy(await pending), 'i0');
    assert.equal(seen.length, 1);
    assert.equal(seen[0].self, WebAssembly);
    assert.equal(seen[0].args.length, 2);
    assert.equal(seen[0].args[0], log.responses[0]);
    assert.equal(seen[0].args[1], imports);
    assert.equal(log.streamed[0], returned[0], 'the glue gets the very promise the installed function returned');
    await crashAndReplace(decode, log, 'i0', 'i1');
    assert.equal(log.fetches, 1, 'the module was captured through the installed function');
    assert.equal(seen.length, 1);
    assert.equal(WebAssembly.instantiateStreaming, installed);
  });
});

test('a captured value that is not a WebAssembly.Module is not kept', opts, async () => {
  await withoutUnhandledRejections(async () => {
    await withInstalled((native) => function installed(...args) {
      return native.apply(this, args).then((made) => ({ instance: made.instance, module: { not: 'a module' } }));
    }, async () => {
      const { glue, log } = browserLikeGlue();
      const decode = createDecoder(glue);
      assert.equal(servedBy(await decode(input(1))), 'i0');
      await crashAndReplace(decode, log, 'i0', 'i1');
      await crashAndReplace(decode, log, 'i1', 'i2');
      assert.equal(log.fetches, 3, 'every load went the default way');
      assert.equal(log.hooked.length, 0);
      assert.ok(log.options.every((o) => !('instantiateWasm' in o)), 'and no load tried the value that was not a module');
    });
  });
});

test('a streaming result with no usable shape is ignored without an unhandled rejection', opts, async () => {
  await withoutUnhandledRejections(async () => {
    await withInstalled(() => function installed() { return Promise.resolve(undefined); }, async () => {
      const { glue, log } = browserLikeGlue();
      const decode = createDecoder(glue);
      assert.equal(servedBy(await decode(input(1))), 'i0');
      await crashAndReplace(decode, log, 'i0', 'i1');
      assert.equal(log.fetches, 2);
    });
  });
});

test('when the kept module cannot be instantiated it is dropped: that load and later ones go the default way', opts, async () => {
  await withoutUnhandledRejections(async () => {
    const { glue, log } = browserLikeGlue();
    const decode = createDecoder(glue);
    assert.equal(servedBy(await decode(input(1))), 'i0');
    log.hookImports = 7; // not an imports object: instantiating the kept module rejects
    await crashAndReplace(decode, log, 'i0', 'i1');
    assert.equal(log.fetches, 2, 'the same call fell back to the default load');
    log.hookImports = {};
    await crashAndReplace(decode, log, 'i1', 'i2');
    assert.equal(log.fetches, 3, 'the kept module is not tried again');
    assert.equal(log.hooked.length, 0);
    assert.equal(log.options.filter((o) => 'instantiateWasm' in o).length, 1);
  });
});

test('a throw from the glue while it receives the instance falls back to the default load', opts, async () => {
  await withoutUnhandledRejections(async () => {
    const plan = {};
    const { glue, log } = browserLikeGlue(plan);
    const decode = createDecoder(glue);
    assert.equal(servedBy(await decode(input(1))), 'i0');
    plan.receiveThrows = new Error('receive threw');
    await crashAndReplace(decode, log, 'i0', 'i1');
    assert.equal(log.fetches, 2);
  });
});

test('a glue rejection on the kept-module path falls back to the default load, and a failure of that reaches the caller', opts, async (t) => {
  await withoutUnhandledRejections(async () => {
    const advance = clock(t);
    const plan = {};
    const { glue, log } = browserLikeGlue(plan);
    const decode = createDecoder(glue);
    assert.equal(servedBy(await decode(input(1))), 'i0');
    plan.rejectHook = new Error('glue rejected');
    const offline = new Error('offline');
    plan.rejectDefault = () => offline;
    log.made[0].crashNext = true;
    await assert.rejects(decode(input(2)), WebAssembly.RuntimeError);
    await assert.rejects(decode(input(3)), isThe(offline), 'the call does not hang: it gets the default load\'s failure');
    plan.rejectDefault = null;
    advance(RETRY_MS);
    assert.equal(servedBy(await decode(input(4))), 'i1');
    assert.equal(log.fetches, 3);
  });
});

test('the module is captured from whichever load first streams, not only from the first load', opts, async () => {
  const { glue, log } = browserLikeGlue({ streams: (n) => n >= 1 });
  const decode = createDecoder(glue);
  assert.equal(servedBy(await decode(input(1))), 'i0');
  await crashAndReplace(decode, log, 'i0', 'i1');
  assert.equal(log.fetches, 2, 'the first load did not stream, so the second loaded the default way');
  await crashAndReplace(decode, log, 'i1', 'i2');
  assert.equal(log.fetches, 2, 'the second load streamed, so the third reused its module');
  assert.equal(log.hooked.length, 1);
});

test('without a captured module a replacement loads the way the first instance did', opts, async () => {
  const { glue, log } = browserLikeGlue({ streams: () => false });
  const decode = createDecoder(glue);
  assert.equal(servedBy(await decode(input(1))), 'i0');
  await crashAndReplace(decode, log, 'i0', 'i1');
  assert.equal(log.fetches, 2);
  assert.equal(log.hooked.length, 0);
  assert.ok(log.options.every((o) => typeof o.print === 'function' && !('instantiateWasm' in o)));
});

test('a failed streaming compile rejects as the glue rejects, restores the global and captures nothing', opts, async () => {
  const streaming = WebAssembly.instantiateStreaming;
  const { glue, log } = browserLikeGlue({ wasm: new Uint8Array([1, 2, 3, 4]) });
  const decode = createDecoder(glue);
  const direct = await WebAssembly.instantiateStreaming(new Response(new Uint8Array([1, 2, 3, 4]), { headers: { 'content-type': 'application/wasm' } }), {}).catch((e) => e);
  const pending = decode(input(1));
  assert.equal(WebAssembly.instantiateStreaming, streaming);
  await assert.rejects(pending, (e) => e.constructor === direct.constructor && e.message === direct.message);
  assert.equal(log.fetches, 1);
  assert.equal(log.hooked.length, 0);
});

test('a glue that throws synchronously rejects the call and leaves the global as it was', opts, async () => {
  const streaming = WebAssembly.instantiateStreaming;
  const thrown = new Error('factory threw');
  const { glue } = browserLikeGlue({ throwSync: () => thrown });
  const decode = createDecoder(glue);
  const pending = decode(input(1));
  assert.equal(WebAssembly.instantiateStreaming, streaming);
  await assert.rejects(pending, isThe(thrown));
});

test('a WebAssembly namespace that cannot be patched still loads', opts, async () => {
  const descriptor = Object.getOwnPropertyDescriptor(WebAssembly, 'instantiateStreaming');
  Object.defineProperty(WebAssembly, 'instantiateStreaming', { ...descriptor, writable: false });
  try {
    const { glue, log } = browserLikeGlue();
    const decode = createDecoder(glue);
    assert.equal(servedBy(await decode(input(1))), 'i0');
    await crashAndReplace(decode, log, 'i0', 'i1');
    assert.equal(log.fetches, 2, 'no module was captured, so the replacement loaded the default way');
  } finally { Object.defineProperty(WebAssembly, 'instantiateStreaming', descriptor); }
});

const realGlue = (instances) => async (options) => {
  assert.ok(instances.length < INSTANCE_CAP, 'runaway instantiation');
  const m = await createMunbox(options);
  m.decodes = 0;
  const realDecode = m._sit_decode;
  m._sit_decode = (...a) => { m.decodes++; return realDecode(...a); };
  instances.push(m);
  return m;
};
const digest = (entries) => {
  const h = createHash('sha256');
  for (const e of entries) h.update(JSON.stringify([e.name, e.type, e.creator, e.forkType, e.bytes.length])).update(e.bytes);
  return h.digest('hex');
};

test('real decoder: repeated passes over the bundled archives use one instance at its initial size with identical output', {
  timeout: 120_000,
}, async () => {
  const archives = readdirSync(resolve(root, 'themes')).sort()
    .map((slug) => resolve(root, 'themes', slug, 'scheme.sit')).filter(existsSync)
    .map((file) => new Uint8Array(readFileSync(file)));
  assert.ok(archives.length >= 13, `expected the bundled archives, found ${archives.length}`);

  // Reference: each archive on an instance of its own.
  const fresh = [];
  const reference = [];
  for (const bytes of archives) reference.push(digest(await createDecoder(realGlue(fresh))(bytes)));
  const initial = fresh[0].HEAPU8.length;
  assert.ok(fresh.every((m) => m.HEAPU8.length === initial), 'no bundled archive grows a fresh instance');

  const PASSES = 6;
  const instances = [];
  const decode = createDecoder(realGlue(instances));
  for (let pass = 0; pass < PASSES; pass++) {
    for (const [i, bytes] of archives.entries()) assert.equal(digest(await decode(bytes)), reference[i], `pass ${pass} archive ${i}`);
  }
  await settle();
  assert.equal(instances.length, 1, 'no replacement was needed');
  assert.equal(instances[0].decodes, PASSES * archives.length);
  assert.equal(instances[0].HEAPU8.length, initial, 'memory did not grow');

  // The shared public decoder gives the same output.
  for (const [i, bytes] of archives.entries()) assert.equal(digest(await decodeArchive(bytes)), reference[i]);
});

test('real decoder: a large input is decoded repeatedly on one instance, which is replaced once small inputs follow', {
  timeout: 120_000,
}, async () => {
  const large = new Uint8Array(8 * 1024 * 1024); // not an archive: passes through as one data fork
  for (let i = 0; i < large.length; i += 4096) large[i] = i >>> 12;
  const instances = [];
  const decode = createDecoder(realGlue(instances));
  const first = digest(await decode(large));
  const initial = (await createMunbox({ print: () => {} })).HEAPU8.length;
  assert.ok(instances[0].HEAPU8.length > 2 * initial, 'premise: this input takes a fresh instance past twice its initial size');
  for (let i = 0; i < 4; i++) assert.equal(digest(await decode(large)), first);
  await settle();
  assert.equal(instances.length, 1, 'one instance served every large decode');

  const small = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
  const smallDigest = digest(await decode(small)); // finds the instance over the limit for a small input
  assert.equal(digest(await decode(small)), smallDigest); // starts the replacement, served by the old instance
  assert.equal(instances[0].decodes, 7);
  for (let i = 0; i < 400 && instances.length < 2; i++) await new Promise((r) => setTimeout(r, 5));
  await settle();
  assert.equal(instances.length, 2, 'the replacement loaded');
  assert.equal(digest(await decode(small)), smallDigest);
  assert.equal(instances[1].decodes, 1, 'and is in service');
  assert.equal(instances[1].HEAPU8.length, initial);
  await settle();
  assert.equal(instances.length, 2);
});
