// tools/sit-wasm/instance-recovery.test.mjs
// The wrapper shares one decoder instance between calls. These tests cover when it must
// replace that instance (a call into it threw, or its memory grew) and that it frees what it
// allocates. Crashes are simulated with stand-in instances, so nothing here depends on how
// the real decoder treats any particular input. The last test runs the real binary.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import createMunbox from './dist/munbox.mjs';
import { __createDecoderForTests as createDecoder, decodeArchive } from './index.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const opts = { timeout: 30_000 }; // nothing here waits on anything slow; a hang is a failure

const IN_PTR = 64, OUT_PTR = 1024;
const w32 = (h, o, v) => { h[o] = v & 255; h[o + 1] = (v >>> 8) & 255; h[o + 2] = (v >>> 16) & 255; h[o + 3] = v >>> 24; };

class Heap extends Uint8Array {
  failSet = false;
  failSlice = false;
  set(...a) { if (this.failSet) throw new RangeError('copy-in failed'); return super.set(...a); }
  slice(...a) { if (this.failSlice) throw new RangeError('copy-out failed'); return new Uint8Array(this).slice(...a); }
}

// A stand-in for an instantiated module. Its decode returns one resource-fork entry named
// after the instance, whose bytes are the input, so a result says which instance produced it.
// `onDecode(m)` runs first and may throw (a crash), return 0 (an ordinary decoder error) or
// swap in a bigger heap (memory growth).
function fakeModule(name, onDecode = () => {}) {
  const calls = { malloc: 0, free: 0, decode: 0, sitFree: 0 };
  const m = {
    name, calls, mallocResult: IN_PTR, errorText: 'boom',
    HEAPU8: new Heap(4096).fill(0xEE),
    _malloc() { calls.malloc++; return m.mallocResult; },
    _free(ptr) { assert.equal(ptr, IN_PTR); calls.free++; },
    _sit_free(ptr) { assert.equal(ptr, OUT_PTR); calls.sitFree++; },
    _sit_error: () => 1,
    UTF8ToString: () => m.errorText,
    _sit_decode(ptr, len) {
      calls.decode++;
      const input = m.HEAPU8.slice(ptr, ptr + len);
      if (onDecode(m) === 0) return 0;
      const h = m.HEAPU8, nameBytes = new TextEncoder().encode(name);
      let p = OUT_PTR + 8;
      w32(h, p, nameBytes.length); p += 4;
      h.set(nameBytes, p); p += nameBytes.length;
      w32(h, p, 0x41424344); w32(h, p + 4, 0x45464748); w32(h, p + 8, 1); w32(h, p + 12, input.length); p += 16;
      h.set(input, p); p += input.length;
      w32(h, OUT_PTR, p - OUT_PTR); w32(h, OUT_PTR + 4, 1);
      return OUT_PTR;
    },
  };
  return m;
}

// A decoder over stand-in instances: `behaviours[i]` is the onDecode of the i-th instance made.
function setup(behaviours = []) {
  const made = [];
  const decode = createDecoder(async () => {
    const m = fakeModule(`i${made.length}`, behaviours[made.length]);
    made.push(m);
    return m;
  });
  return { made, decode };
}
const input = (...b) => new Uint8Array(b);
const servedBy = (entries) => entries[0].name;

test('a healthy instance is shared, decodes correctly and frees both buffers each time', opts, async () => {
  const { made, decode } = setup();
  for (let i = 0; i < 5; i++) {
    const entries = await decode(input(i, 2, 3));
    assert.deepEqual(entries, [{ name: 'i0', type: 0x41424344, creator: 0x45464748, forkType: 1, bytes: input(i, 2, 3) }]);
  }
  assert.deepEqual(await decode(input(7, 8).buffer), [{ name: 'i0', type: 0x41424344, creator: 0x45464748, forkType: 1, bytes: input(7, 8) }]);
  assert.equal(made.length, 1);
  assert.deepEqual(made[0].calls, { malloc: 6, free: 6, decode: 6, sitFree: 6 });
});

for (const [kind, make] of [
  ['a WebAssembly trap', () => new WebAssembly.RuntimeError('unreachable')],
  ['a runtime abort', () => new WebAssembly.RuntimeError('Aborted(). Build with -sASSERTIONS for more info.')],
  ['any other throw', () => new RangeError('Maximum call stack size exceeded')],
]) {
  test(`${kind} in a decode rejects with that error and retires the instance`, opts, async () => {
    const crash = make();
    const { made, decode } = setup([() => { throw crash; }]);
    await assert.rejects(decode(input(1)), (e) => e === crash);
    assert.equal(made.length, 1, 'no replacement until a call needs one');

    assert.equal(servedBy(await decode(input(2))), 'i1');
    assert.equal(servedBy(await decode(input(3))), 'i1', 'the replacement is shared like the first instance');
    assert.equal(made.length, 2);
    assert.deepEqual(made[0].calls, { malloc: 1, free: 0, decode: 1, sitFree: 0 }, 'a crashed instance is not called again');
    assert.deepEqual(made[1].calls, { malloc: 2, free: 2, decode: 2, sitFree: 2 });
  });
}

test('a crash in any other call into the instance retires it too', opts, async () => {
  for (const method of ['_malloc', '_free', '_sit_free', '_sit_error', 'UTF8ToString']) {
    const crash = new WebAssembly.RuntimeError(`crash in ${method}`);
    const { made, decode } = setup([(m) => {
      m[method] = () => { throw crash; };
      return method === '_sit_error' || method === 'UTF8ToString' ? 0 : undefined;
    }]);
    if (method === '_malloc') await decode(input(0)); // the first decode installs the crash
    await assert.rejects(decode(input(1)), (e) => e === crash, method);
    assert.equal(servedBy(await decode(input(2))), 'i1', method);
    assert.equal(made.length, 2, method);
  }
});

test('an ordinary decoder error keeps the instance, frees the input and reports the decoder text', opts, async () => {
  let fail = true;
  const { made, decode } = setup([() => (fail ? 0 : undefined)]);
  await assert.rejects(decode(input(1)), (e) => e.constructor === Error && e.message === 'decodeArchive: boom');
  made[0].errorText = '';
  await assert.rejects(decode(input(1)), (e) => e.constructor === Error && e.message === 'decodeArchive: decode failed');
  fail = false;
  assert.equal(servedBy(await decode(input(2))), 'i0');
  assert.equal(made.length, 1);
  assert.deepEqual(made[0].calls, { malloc: 3, free: 3, decode: 3, sitFree: 1 });
});

test('a failed input allocation is an ordinary error and nothing is written to the heap', opts, async () => {
  const { made, decode } = setup();
  await decode(input(9)); // instance exists
  const m = made[0];
  const before = m.HEAPU8.slice();
  m.mallocResult = 0;
  await assert.rejects(decode(input(1, 2, 3, 4)), (e) => e.constructor === Error && e.message === 'decodeArchive: out of memory');
  assert.deepEqual(m.HEAPU8.slice(), before, 'heap untouched');
  assert.deepEqual(m.calls, { malloc: 2, free: 1, decode: 1, sitFree: 1 }, 'no decode, nothing to free');
  m.mallocResult = IN_PTR;
  assert.equal(servedBy(await decode(input(2))), 'i0', 'the instance stays in use');
  assert.equal(made.length, 1);
});

test('a throw while copying the result out frees the output buffer and keeps the instance', opts, async () => {
  const { made, decode } = setup();
  await decode(input(9));
  const m = made[0];
  // The stand-in decode itself slices the heap to read its input, so fail only the wrapper's copy-out.
  const realDecode = m._sit_decode;
  m._sit_decode = (...a) => { const r = realDecode(...a); m.HEAPU8.failSlice = true; return r; };
  await assert.rejects(decode(input(1)), (e) => e instanceof RangeError && e.message === 'copy-out failed');
  assert.deepEqual(m.calls, { malloc: 2, free: 2, decode: 2, sitFree: 2 });
  m.HEAPU8.failSlice = false;
  m._sit_decode = realDecode;
  assert.equal(servedBy(await decode(input(2))), 'i0');
  assert.equal(made.length, 1);
});

test('a throw while copying the input in frees the input buffer and keeps the instance', opts, async () => {
  const { made, decode } = setup();
  await decode(input(9));
  const m = made[0];
  m.HEAPU8.failSet = true;
  await assert.rejects(decode(input(1)), (e) => e instanceof RangeError && e.message === 'copy-in failed');
  assert.deepEqual(m.calls, { malloc: 2, free: 2, decode: 1, sitFree: 1 });
  m.HEAPU8.failSet = false;
  assert.equal(servedBy(await decode(input(2))), 'i0');
  assert.equal(made.length, 1);
});

// Growth as the real glue does it: HEAPU8 is replaced by a longer view with the same contents.
const grow = (m) => { const bigger = new Heap(m.HEAPU8.length * 2); bigger.set(m.HEAPU8); m.HEAPU8 = bigger; };

test('an instance whose memory grew during a decode is replaced after that decode', opts, async () => {
  let n = 0;
  const { made, decode } = setup([(m) => { if (++n === 3) grow(m); }]);
  assert.equal(servedBy(await decode(input(1))), 'i0');
  assert.equal(servedBy(await decode(input(2))), 'i0');
  assert.deepEqual(await decode(input(3, 3, 3)), [{ name: 'i0', type: 0x41424344, creator: 0x45464748, forkType: 1, bytes: input(3, 3, 3) }],
    'the decode that grew memory still returns its result');
  assert.equal(made.length, 1, 'no replacement until a call needs one');
  assert.equal(servedBy(await decode(input(4))), 'i1');
  assert.equal(servedBy(await decode(input(5))), 'i1');
  assert.equal(made.length, 2);
  assert.deepEqual(made[0].calls, { malloc: 3, free: 3, decode: 3, sitFree: 3 }, 'the grown instance was left clean');
  assert.equal(made[0].HEAPU8.length, 8192);
  assert.equal(made[1].HEAPU8.length, 4096);
});

test('growth also retires the instance when the decode ends in an ordinary error', opts, async () => {
  const { made, decode } = setup([(m) => { grow(m); return 0; }]);
  await assert.rejects(decode(input(1)), (e) => e.constructor === Error && e.message === 'decodeArchive: boom');
  assert.equal(servedBy(await decode(input(2))), 'i1');
  assert.equal(made.length, 2);
  assert.deepEqual(made[0].calls, { malloc: 1, free: 1, decode: 1, sitFree: 0 });
});

test('calls waiting on an instance that crashes share one replacement', opts, async () => {
  const crash = new WebAssembly.RuntimeError('unreachable');
  const { made, decode } = setup([() => { throw crash; }]);
  // All four start before the first instance exists, so all four wait on the same one.
  const results = await Promise.allSettled([decode(input(1)), decode(input(2)), decode(input(3)), decode(input(4))]);
  assert.equal(results[0].status, 'rejected');
  assert.equal(results[0].reason, crash);
  assert.deepEqual(results.slice(1).map((r) => r.status), ['fulfilled', 'fulfilled', 'fulfilled']);
  assert.deepEqual(results.slice(1).map((r) => [servedBy(r.value), [...r.value[0].bytes]]), [['i1', [2]], ['i1', [3]], ['i1', [4]]]);
  assert.equal(made.length, 2, 'one failure, one replacement');
  assert.equal(made[0].calls.decode, 1, 'the crashed instance served only the call that crashed it');
  assert.deepEqual(made[1].calls, { malloc: 3, free: 3, decode: 3, sitFree: 3 });
});

test('each crash among concurrent calls costs exactly one replacement', opts, async () => {
  const crash = () => { throw new WebAssembly.RuntimeError('unreachable'); };
  const { made, decode } = setup([crash, crash]);
  const results = await Promise.allSettled([1, 2, 3, 4, 5].map((b) => decode(input(b))));
  assert.deepEqual(results.map((r) => r.status), ['rejected', 'rejected', 'fulfilled', 'fulfilled', 'fulfilled']);
  assert.deepEqual(results.slice(2).map((r) => [servedBy(r.value), [...r.value[0].bytes]]), [['i2', [3]], ['i2', [4]], ['i2', [5]]]);
  assert.equal(made.length, 3);
  assert.deepEqual(made.map((m) => m.calls.decode), [1, 1, 3]);
});

test('calls waiting on an instance that grows share one replacement, and a call made mid-replacement joins it', opts, async () => {
  const { made, decode } = setup([grow]);
  const first = decode(input(1)), second = decode(input(2));
  assert.equal(servedBy(await first), 'i0');
  const third = decode(input(3)); // i0 is retired; `second` may or may not have asked for i1 yet
  assert.equal(servedBy(await second), 'i1');
  assert.equal(servedBy(await third), 'i1');
  assert.equal(made.length, 2);
  assert.deepEqual(made.map((m) => m.calls.decode), [1, 2]);
});

test('a failed instantiation rejects the calls waiting on it', opts, async () => {
  const failure = new Error('no wasm');
  let n = 0;
  const decode = createDecoder(async () => { n++; throw failure; });
  const results = await Promise.allSettled([decode(input(1)), decode(input(2))]);
  assert.deepEqual(results.map((r) => r.reason), [failure, failure]);
  assert.equal(n, 1);
});

test('real decoder: repeated passes over the bundled archives stay at the initial memory size with identical output', {
  timeout: 120_000,
}, async () => {
  const archives = readdirSync(resolve(root, 'themes')).sort()
    .map((slug) => resolve(root, 'themes', slug, 'scheme.sit')).filter(existsSync)
    .map((file) => new Uint8Array(readFileSync(file)));
  assert.ok(archives.length >= 13, `expected the bundled archives, found ${archives.length}`);
  const digest = (entries) => {
    const h = createHash('sha256');
    for (const e of entries) h.update(JSON.stringify([e.name, e.type, e.creator, e.forkType, e.bytes.length])).update(e.bytes);
    return h.digest('hex');
  };

  // Reference: each archive on an instance of its own, through the raw module.
  const initialSizes = new Set();
  const reference = [];
  for (const bytes of archives) {
    const fresh = createDecoder(async () => {
      const m = await createMunbox({ print: () => {} });
      initialSizes.add(m.HEAPU8.length);
      return m;
    });
    reference.push(digest(await fresh(bytes)));
  }
  assert.equal(initialSizes.size, 1);
  const [initial] = initialSizes;

  // One instance reused without replacement passes the initial size within a few passes;
  // PASSES is several times that, so a wrapper that kept its instance would fail below.
  const PASSES = 6;
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
  assert.ok(raw.HEAPU8.length > initial, 'premise: an instance that is never replaced grows over these passes');

  const instances = [];
  const decode = createDecoder(async () => {
    const m = await createMunbox({ print: () => {} });
    instances.push(m);
    return m;
  });
  let peak = 0;
  for (let pass = 0; pass < PASSES; pass++) {
    for (const [i, bytes] of archives.entries()) {
      const serving = instances.at(-1);
      const countBefore = instances.length;
      const grewEarlier = serving !== undefined && serving.HEAPU8.length > initial;
      assert.equal(digest(await decode(bytes)), reference[i], `pass ${pass} archive ${i}`);
      if (grewEarlier) assert.equal(instances.length, countBefore + 1, 'a grown instance is never used for another decode');
      else if (serving) assert.equal(instances.length, countBefore, 'an instance at its initial size is reused');
      peak = Math.max(peak, instances.at(-1).HEAPU8.length);
    }
  }
  assert.ok(instances.length > 1, 'the passes were enough to force a replacement');
  assert.ok(instances.length < PASSES * archives.length / 4, `replacements are occasional (${instances.length} instances)`);
  assert.ok(peak < raw.HEAPU8.length, `peak ${peak} stays below the unreplaced ${raw.HEAPU8.length}`);
  assert.ok(peak <= initial * 2, `peak ${peak} within twice the initial ${initial}`);

  // The shared public decoder gives the same output.
  for (const [i, bytes] of archives.entries()) assert.equal(digest(await decodeArchive(bytes)), reference[i]);
});
