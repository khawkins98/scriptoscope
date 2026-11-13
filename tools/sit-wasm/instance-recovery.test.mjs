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

// A decoder over stand-in instances: `behaviours[i]` is the onDecode of the i-th instance
// made. `loads[i]`, when given, is an error for the i-th load to reject with instead.
function setup(behaviours = [], loads = []) {
  const made = [];
  const log = { loads: 0, options: [] };
  const decode = createDecoder(async (options) => {
    const n = log.loads++;
    log.options.push(options);
    assert.ok(n < INSTANCE_CAP, 'runaway instantiation');
    if (loads[n]) throw loads[n];
    const m = fakeModule(`i${made.length}`, behaviours[made.length]);
    made.push(m);
    return m;
  });
  return { made, decode, log };
}
const input = (...b) => new Uint8Array(b);
const servedBy = (entries) => entries[0].name;
const entry = (name, bytes) => [{ name, type: 0x41424344, creator: 0x45464748, forkType: 1, bytes }];
const isThe = (error) => (e) => e === error;
const isOrdinary = (message) => (e) => e.constructor === Error && e.message === message;

// Runs `body` and fails if it left a promise rejection unhandled.
async function withoutUnhandledRejections(body) {
  const seen = [];
  const listener = (reason) => seen.push(reason);
  process.on('unhandledRejection', listener);
  try {
    await body();
    await new Promise((r) => setImmediate(r));
    await new Promise((r) => setImmediate(r));
  } finally { process.off('unhandledRejection', listener); }
  assert.equal(seen.length, 0, 'no unhandled rejections');
}

test('a healthy instance is shared, decodes correctly and frees both buffers each time', opts, async () => {
  const { made, decode, log } = setup();
  for (let i = 0; i < 5; i++) assert.deepEqual(await decode(input(i, 2, 3)), entry('i0', input(i, 2, 3)));
  assert.deepEqual(await decode(input(7, 8).buffer), entry('i0', input(7, 8)));
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

test('an instance that outgrew its limit is replaced by the next call, after delivering its result', opts, async () => {
  let n = 0;
  const { made, decode, log } = setup([(m) => { if (++n === 3) growTo(m, OVER); }]);
  assert.equal(servedBy(await decode(input(1))), 'i0');
  assert.equal(servedBy(await decode(input(2))), 'i0');
  assert.deepEqual(await decode(input(3, 3, 3)), entry('i0', input(3, 3, 3)), 'the decode that grew memory still returns its result');
  assert.equal(log.loads, 1, 'no replacement until a call needs one');
  assert.equal(servedBy(await decode(input(4))), 'i1');
  assert.equal(servedBy(await decode(input(5))), 'i1');
  assert.equal(log.loads, 2);
  assert.deepEqual(made[0].calls, { malloc: 3, free: 3, decode: 3, sitFree: 3 }, 'the outgrown instance was left clean');
  assert.equal(made[1].HEAPU8.length, HEAP);
});

test('memory at exactly twice the initial size is within the limit', opts, async () => {
  const { decode, log } = setup([(m) => growTo(m, HEAP * 2)]);
  for (let i = 0; i < 3; i++) assert.equal(servedBy(await decode(input(i))), 'i0');
  assert.equal(log.loads, 1);
});

test('growth that the size of the input and output accounts for does not replace the instance', opts, async () => {
  const big = new Uint8Array(12000).fill(7); // 3 × (input + output) is above the initial size
  const { made, decode, log } = setup([(m) => { if (m.HEAPU8.length < OVER) growTo(m, OVER); }]);
  for (let i = 0; i < 4; i++) assert.deepEqual(await decode(big), entry('i0', big));
  assert.equal(log.loads, 1, 'repeated large decodes keep one instance');
  assert.equal(servedBy(await decode(input(1))), 'i0', 'a small decode still finds it in service');
  assert.equal(servedBy(await decode(input(2))), 'i1', 'and marks it outgrown for a small input');
  assert.equal(log.loads, 2);
  assert.equal(made[0].calls.decode, 5);
});

test('growth during the input allocation counts', opts, async () => {
  const { made, decode, log } = setup();
  await decode(input(0));
  made[0].onMalloc = (m) => { if (m.HEAPU8.length < OVER) growTo(m, OVER); };
  assert.equal(servedBy(await decode(input(1))), 'i0');
  assert.equal(servedBy(await decode(input(2))), 'i1');
  assert.equal(log.loads, 2);
});

test('growth during the input allocation of an instance\'s first decode counts', opts, async () => {
  const fresh = [];
  const decode = createDecoder(async () => {
    assert.ok(fresh.length < INSTANCE_CAP, 'runaway instantiation');
    const m = fakeModule(`i${fresh.length}`);
    if (fresh.length === 0) m.onMalloc = () => { if (m.HEAPU8.length < OVER) growTo(m, OVER); };
    fresh.push(m);
    return m;
  });
  assert.equal(servedBy(await decode(input(1))), 'i0');
  assert.equal(servedBy(await decode(input(2))), 'i1', 'the initial size was taken before the allocation');
});

test('outgrowing the limit also counts when the decode ends in an ordinary error', opts, async () => {
  const { made, decode, log } = setup([(m) => { growTo(m, OVER); return 0; }]);
  await assert.rejects(decode(input(1)), isOrdinary('decodeArchive: boom'));
  assert.equal(servedBy(await decode(input(2))), 'i1');
  assert.equal(log.loads, 2);
  assert.deepEqual(made[0].calls, { malloc: 1, free: 1, decode: 1, sitFree: 0 });
});

test('outgrowing the limit also counts when a copy throws', opts, async () => {
  for (const flag of ['failSet', 'failSlice']) {
    const { made, decode, log } = setup();
    await decode(input(9));
    const m = made[0];
    const failure = new RangeError(`${flag} copy failed`);
    const realDecode = m._sit_decode;
    if (flag === 'failSet') m.onMalloc = () => { growTo(m, OVER); m.HEAPU8.failSet = failure; };
    else m._sit_decode = (...a) => { const r = realDecode(...a); growTo(m, OVER); m.HEAPU8.failSlice = failure; return r; };
    await assert.rejects(decode(input(1)), isThe(failure), flag);
    m.onMalloc = () => {};
    m._sit_decode = realDecode;
    assert.equal(servedBy(await decode(input(2))), 'i1', flag);
    assert.equal(log.loads, 2, flag);
  }
});

test('calls waiting on an instance that crashes share one replacement', opts, async () => {
  const crash = new WebAssembly.RuntimeError('unreachable');
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
  const crash = () => { throw new WebAssembly.RuntimeError('unreachable'); };
  const { made, decode, log } = setup([crash, crash]);
  const results = await Promise.allSettled([1, 2, 3, 4, 5].map((b) => decode(input(b))));
  assert.deepEqual(results.map((r) => r.status), ['rejected', 'rejected', 'fulfilled', 'fulfilled', 'fulfilled']);
  assert.deepEqual(results.slice(2).map((r) => [servedBy(r.value), [...r.value[0].bytes]]), [['i2', [3]], ['i2', [4]], ['i2', [5]]]);
  assert.equal(log.loads, 3);
  assert.deepEqual(made.map((m) => m.calls.decode), [1, 1, 3]);
});

test('calls already waiting on an instance that outgrows its limit still use it; later calls share one replacement', opts, async () => {
  const { made, decode, log } = setup([(m) => { if (m.HEAPU8.length < OVER) growTo(m, OVER); }]);
  const first = decode(input(1)), second = decode(input(2));
  assert.equal(servedBy(await first), 'i0');
  assert.equal(servedBy(await second), 'i0', 'it is healthy, so the call that was waiting on it is served');
  const later = await Promise.all([decode(input(3)), decode(input(4)), decode(input(5))]);
  assert.deepEqual(later.map(servedBy), ['i1', 'i1', 'i1']);
  assert.equal(log.loads, 2);
  assert.deepEqual(made.map((m) => m.calls.decode), [2, 3]);
});

test('a failed first instantiation is kept: later calls reject with it and nothing is retried', opts, async () => {
  const failure = new Error('no wasm');
  const { decode, log } = setup([], [failure]);
  const results = await Promise.allSettled([decode(input(1)), decode(input(2))]);
  assert.deepEqual(results.map((r) => r.reason), [failure, failure]);
  await assert.rejects(decode(input(3)), isThe(failure));
  await assert.rejects(decode(input(4)), isThe(failure));
  assert.equal(log.loads, 1);
});

test('a failed replacement after a crash rejects the calls waiting on it and the next call tries again', opts, async () => {
  await withoutUnhandledRejections(async () => {
    const crash = new WebAssembly.RuntimeError('unreachable');
    const failure = new Error('no wasm just now');
    const { made, decode, log } = setup([() => { throw crash; }], [null, failure, failure]);
    await assert.rejects(decode(input(1)), isThe(crash));
    const waiting = await Promise.allSettled([decode(input(2)), decode(input(3))]);
    assert.deepEqual(waiting.map((r) => r.reason), [failure, failure], 'both waited on the one failed load');
    assert.equal(log.loads, 2);
    await assert.rejects(decode(input(4)), isThe(failure), 'a second failure is not kept either');
    assert.equal(log.loads, 3);
    assert.equal(servedBy(await decode(input(5))), 'i1');
    assert.equal(servedBy(await decode(input(6))), 'i1');
    assert.equal(log.loads, 4);
    assert.equal(made[0].calls.decode, 1);
  });
});

test('a failed replacement for an outgrown instance costs nothing: that instance serves until one loads', opts, async () => {
  await withoutUnhandledRejections(async () => {
    const failure = new Error('no wasm just now');
    const { made, decode, log } = setup([(m) => { if (m.HEAPU8.length < OVER) growTo(m, OVER); }], [null, failure, failure]);
    assert.equal(servedBy(await decode(input(1))), 'i0');
    const waiting = await Promise.all([decode(input(2)), decode(input(3))]);
    assert.deepEqual(waiting.map(servedBy), ['i0', 'i0'], 'the load failed, so the outgrown instance served both');
    assert.equal(log.loads, 2, 'and both shared the one attempt');
    assert.equal(servedBy(await decode(input(4))), 'i0', 'a second failed attempt');
    assert.equal(log.loads, 3);
    assert.equal(servedBy(await decode(input(5))), 'i1', 'the third attempt loads');
    assert.equal(servedBy(await decode(input(6))), 'i1');
    assert.equal(log.loads, 4);
    assert.deepEqual(made.map((m) => m.calls.decode), [4, 2]);
  });
});

test('an outgrown instance that crashes while its replacement is failing is not used again', opts, async () => {
  await withoutUnhandledRejections(async () => {
    const crash = new WebAssembly.RuntimeError('unreachable');
    const failure = new Error('no wasm just now');
    let n = 0;
    const { decode, log } = setup([(m) => { if (++n === 1) growTo(m, OVER); else throw crash; }], [null, failure]);
    assert.equal(servedBy(await decode(input(1))), 'i0');
    await assert.rejects(decode(input(2)), isThe(crash), 'served by the outgrown instance, which crashes');
    assert.equal(servedBy(await decode(input(3))), 'i1');
    assert.equal(log.loads, 3);
  });
});

// A call can still be holding the old instance's promise when a later call starts the
// replacement: three calls on a loaded instance, queued so that the first outgrows it, the
// second (made from a microtask in between) starts the replacement, and the third then runs
// on the old instance.
async function straggler({ onThird, loads }) {
  let n = 0;
  const ctx = setup([(m) => { n++; if (n === 2) growTo(m, OVER); if (n === 3) onThird(); }], loads);
  await ctx.decode(input(0)); // the instance is loaded
  const first = ctx.decode(input(1));
  let second;
  const queued = Promise.resolve().then(() => { second = ctx.decode(input(2)); });
  const third = ctx.decode(input(3));
  await queued;
  return { ...ctx, results: await Promise.allSettled([first, second, third]) };
}

test('an instance that outgrew its limit and then crashed gets one replacement attempt per call', opts, async () => {
  await withoutUnhandledRejections(async () => {
    const crash = new WebAssembly.RuntimeError('unreachable');
    const failure = new Error('no wasm just now');
    let n = 0;
    const { decode, log } = setup([(m) => { if (++n === 1) growTo(m, OVER); else throw crash; }], [null, failure]);
    const results = await Promise.allSettled([decode(input(1)), decode(input(2))]); // both wait on the first instance
    assert.equal(servedBy(results[0].value), 'i0');
    assert.equal(results[1].reason, crash);
    await assert.rejects(decode(input(3)), isThe(failure));
    assert.equal(log.loads, 2);
    assert.equal(servedBy(await decode(input(4))), 'i1');
    assert.equal(log.loads, 3);
  });
});

test('a call that runs on the old instance after its replacement was started does not disturb the replacement', opts, async () => {
  const { decode, log, made, results } = await straggler({ onThird: () => {} });
  assert.deepEqual(results.map((r) => servedBy(r.value)), ['i0', 'i1', 'i0']);
  assert.equal(servedBy(await decode(input(4))), 'i1');
  assert.equal(servedBy(await decode(input(5))), 'i1');
  assert.equal(log.loads, 2, 'the old instance being over its limit does not retire the new one');
  assert.deepEqual(made.map((m) => m.calls.decode), [3, 3]);
});

test('a crash on the old instance after its replacement was started does not disturb the replacement', opts, async () => {
  const crash = new WebAssembly.RuntimeError('unreachable');
  const { decode, log, results } = await straggler({ onThird: () => { throw crash; } });
  assert.equal(servedBy(results[0].value), 'i0');
  assert.equal(servedBy(results[1].value), 'i1');
  assert.equal(results[2].reason, crash);
  assert.equal(servedBy(await decode(input(4))), 'i1');
  assert.equal(log.loads, 2);
});

test('a crash on the old instance while its replacement is failing leaves nothing stale behind', opts, async () => {
  await withoutUnhandledRejections(async () => {
    const crash = new WebAssembly.RuntimeError('unreachable');
    const { decode, log, results } = await straggler({ onThird: () => { throw crash; }, loads: [null, new Error('no wasm just now')] });
    assert.equal(servedBy(results[0].value), 'i0');
    assert.equal(servedBy(results[1].value), 'i1', 'the failed load fell back to an instance that had crashed, so the call loaded another');
    assert.equal(results[2].reason, crash);
    assert.equal(log.loads, 3);
    assert.equal(servedBy(await decode(input(4))), 'i1');
    assert.equal(servedBy(await decode(input(5))), 'i1');
    assert.equal(log.loads, 3);
  });
});

// A stand-in for the browser glue: it starts a streaming compile synchronously inside the
// factory call, as the real glue does, unless it is handed `instantiateWasm`.
const EMPTY_WASM = new Uint8Array([0, 0x61, 0x73, 0x6d, 1, 0, 0, 0]);
function browserLikeGlue({ streams = true, wasm = EMPTY_WASM } = {}) {
  const log = { fetches: 0, hooked: [], options: [], made: [], hookImports: {} };
  const imports = {};
  const next = () => { const m = fakeModule(`i${log.made.length}`, (mod) => { if (mod.crashNext) { mod.crashNext = false; throw new WebAssembly.RuntimeError('unreachable'); } }); log.made.push(m); return m; };
  const glue = (options) => {
    log.options.push(options);
    assert.ok(log.options.length <= INSTANCE_CAP, 'runaway instantiation');
    if (options.instantiateWasm) {
      return new Promise((done) => {
        options.instantiateWasm(log.hookImports, (instance, module) => { log.hooked.push({ instance, module }); done(next()); });
      });
    }
    log.fetches++;
    if (!streams) return Promise.resolve().then(next);
    const response = new Response(wasm, { headers: { 'content-type': 'application/wasm' } });
    return WebAssembly.instantiateStreaming(response, imports).then(next);
  };
  return { glue, log };
}

test('replacements reuse the module compiled for the first instance and do not fetch', opts, async () => {
  const streaming = WebAssembly.instantiateStreaming;
  const { glue, log } = browserLikeGlue();
  const decode = createDecoder(glue);
  const pending = decode(input(1));
  assert.equal(WebAssembly.instantiateStreaming, streaming, 'the global is as it was once the factory call returns');
  assert.equal(servedBy(await pending), 'i0');
  assert.equal(log.fetches, 1);

  log.made[0].crashNext = true;
  await assert.rejects(decode(input(2)), WebAssembly.RuntimeError);
  assert.equal(servedBy(await decode(input(3))), 'i1', 'replacement after a crash');
  growTo(log.made[1], OVER);
  assert.equal(servedBy(await decode(input(4))), 'i1');
  assert.equal(servedBy(await decode(input(5))), 'i2', 'replacement after outgrowing the limit');

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

test('a replacement that cannot be instantiated from the kept module rejects and the next call tries again', opts, async () => {
  await withoutUnhandledRejections(async () => {
    const { glue, log } = browserLikeGlue();
    const decode = createDecoder(glue);
    assert.equal(servedBy(await decode(input(1))), 'i0');
    log.made[0].crashNext = true;
    await assert.rejects(decode(input(2)), WebAssembly.RuntimeError);
    log.hookImports = 7; // not an imports object: instantiation rejects
    await assert.rejects(decode(input(3)), TypeError);
    log.hookImports = {};
    assert.equal(servedBy(await decode(input(4))), 'i1');
    assert.equal(log.fetches, 1);
    assert.equal(log.options.length, 3);
  });
});

test('without a captured module a replacement loads the way the first instance did', opts, async () => {
  const { glue, log } = browserLikeGlue({ streams: false });
  const decode = createDecoder(glue);
  assert.equal(servedBy(await decode(input(1))), 'i0');
  log.made[0].crashNext = true;
  await assert.rejects(decode(input(2)), WebAssembly.RuntimeError);
  assert.equal(servedBy(await decode(input(3))), 'i1');
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

test('a WebAssembly namespace that cannot be patched still loads', opts, async () => {
  const descriptor = Object.getOwnPropertyDescriptor(WebAssembly, 'instantiateStreaming');
  Object.defineProperty(WebAssembly, 'instantiateStreaming', { ...descriptor, writable: false });
  try {
    const { glue, log } = browserLikeGlue();
    const decode = createDecoder(glue);
    assert.equal(servedBy(await decode(input(1))), 'i0');
    log.made[0].crashNext = true;
    await assert.rejects(decode(input(2)), WebAssembly.RuntimeError);
    assert.equal(servedBy(await decode(input(3))), 'i1');
    assert.equal(log.fetches, 2, 'no module was captured, so the replacement loaded the default way');
  } finally { Object.defineProperty(WebAssembly, 'instantiateStreaming', descriptor); }
});

const realGlue = (instances) => async (options) => {
  assert.ok(instances.length < INSTANCE_CAP, 'runaway instantiation');
  const m = await createMunbox(options);
  instances.push(m);
  return m;
};
const digest = (entries) => {
  const h = createHash('sha256');
  for (const e of entries) h.update(JSON.stringify([e.name, e.type, e.creator, e.forkType, e.bytes.length])).update(e.bytes);
  return h.digest('hex');
};

test('real decoder: repeated passes over the bundled archives keep memory bounded with identical output', {
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
  const limit = 2 * initial;

  // One instance reused without replacement passes the limit well inside PASSES passes, so
  // a wrapper that kept its instance would fail below.
  const PASSES = 12;
  const raw = await createMunbox({ print: () => {} });
  for (let pass = 0; pass < PASSES; pass++) {
    for (const bytes of archives) {
      const inPtr = raw._malloc(bytes.length);
      raw.HEAPU8.set(bytes, inPtr);
      const outPtr = raw._sit_decode(inPtr, bytes.length);
      raw._free(inPtr);
      assert.ok(outPtr);
      raw._sit_free(outPtr);
    }
  }
  assert.ok(raw.HEAPU8.length > 1.5 * limit, 'premise: an instance that is never replaced grows far past the limit');

  const instances = [];
  const decode = createDecoder(realGlue(instances));
  let peak = 0;
  for (let pass = 0; pass < PASSES; pass++) {
    for (const [i, bytes] of archives.entries()) {
      const serving = instances.at(-1);
      const countBefore = instances.length;
      const over = serving !== undefined && serving.HEAPU8.length > limit;
      assert.equal(digest(await decode(bytes)), reference[i], `pass ${pass} archive ${i}`);
      if (over) assert.equal(instances.length, countBefore + 1, 'an instance over the limit is replaced before the next decode');
      else if (serving) assert.equal(instances.length, countBefore, 'an instance within the limit is reused');
      peak = Math.max(peak, instances.at(-1).HEAPU8.length);
    }
  }
  assert.ok(instances.length > 1, 'the passes were enough to force a replacement');
  assert.ok(instances.length <= PASSES / 2, `replacements are occasional (${instances.length} instances)`);
  assert.ok(peak <= 1.25 * limit, `peak ${peak} is within one growth step of the limit ${limit}`);
  assert.ok(peak < raw.HEAPU8.length / 1.5, `peak ${peak} stays well below the unreplaced ${raw.HEAPU8.length}`);

  // The shared public decoder gives the same output.
  for (const [i, bytes] of archives.entries()) assert.equal(digest(await decodeArchive(bytes)), reference[i]);
});

test('real decoder: a large input that grows a fresh instance does not replace it on every decode', {
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
  assert.equal(instances.length, 1, 'one instance served every large decode');
  const small = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
  await decode(small);
  assert.equal(instances.length, 1, 'the small decode ran on it and found it over the limit for a small input');
  await decode(small);
  assert.equal(instances.length, 2, 'so the next call replaced it');
  assert.ok(instances[1].HEAPU8.length < instances[0].HEAPU8.length);
});
