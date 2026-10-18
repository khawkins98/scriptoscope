import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { validateTheme } from './validateTheme.js';
import { loadKaleidoscopeScheme } from './loadKaleidoscopeScheme.js';
import { forkOf, cinf, onePixelCicn } from '../../tests/resource-provenance/fixtures.mjs';
import { twoPixelPpat, comparePatternBinding } from '../../tests/resource-provenance/patterns.mjs';
const pins = JSON.parse(readFileSync(new URL('../../tests/resource-provenance/pattern-pins.json', import.meta.url)));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const load = (bytes, opts = {}) => loadKaleidoscopeScheme(bytes, { provenance: true, encodeAssets: false, ...opts });
const request = (mode, id) => { const bytes = cinf(); bytes[3] = mode; new DataView(bytes.buffer).setInt16(4, id); return bytes; };
const fixture = (second = twoPixelPpat({ red: 0 })) => forkOf([
  { type: 'cicn', id: -10239, data: onePixelCicn() },
  { type: 'cinf', id: -10239, data: request(0, -17) },
  { type: 'ppat', id: -17, name: 'first', data: twoPixelPpat() },
  { type: 'ppat', id: -17, name: 'second', data: second },
]);
const expected = (bytes, data, index = 2) => ({ inputSha256: sha(bytes), forkSha256: sha(bytes),
  signedId: -17, resourceIndex: index, byteLength: data.length, payloadSha256: sha(data) });

test('actual pattern occurrences bind distinct same-ID catalog entries without a filename/ID rejoin', async () => {
  const bytes = fixture(), theme = await load(bytes);
  assert.deepEqual(theme.byteProvenance.scope.resourceTypes, ['cicn', 'cinf', 'ppat']);
  for (const [key, data, index] of [['first', twoPixelPpat(), 2], ['second', twoPixelPpat({ red: 0 }), 3]]) {
    assert.equal(comparePatternBinding(theme, key, expected(bytes, data, index)).status, 'matched');
    assert.ok(Object.isFrozen(theme.manifest.patterns[key].byteProvenance));
  }
  const face = Object.values(theme.manifest.chromeElements)[0];
  assert.deepEqual(face.bodyRequest, { mode: 0, resourceId: -17 });
  assert.equal(face.bgPattern, 'second'); // existing last-ID compatibility choice, not original lookup proof
});

test('raw requests preserve all mode bytes, signed limits and zero without changing legacy links', async () => {
  for (const [mode, id] of [[0, 0], [5, -32768], [255, 32767]]) {
    const theme = await load(forkOf([{ type: 'cicn', id: -10239, data: onePixelCicn() },
      { type: 'cinf', id: -10239, data: request(mode, id) }, { type: 'ppat', id, data: twoPixelPpat() }]));
    const face = Object.values(theme.manifest.chromeElements)[0];
    assert.deepEqual(face.bodyRequest, { mode, resourceId: id });
    if (id === 0) assert.equal(face.bgPattern, null);
  }
});

test('wrong occurrence, key, load, payload and owner inputs fail the independent binding comparison', async () => {
  const bytes = fixture(), theme = await load(bytes), pin = expected(bytes, twoPixelPpat());
  for (const mutate of [
    t => { t.manifest.patterns.first.byteProvenance.ppatResourceIndex = 3; },
    t => { t.manifest.patterns.first.byteProvenance.manifestKey = 'second'; },
    t => { t.manifest.patterns.first.byteProvenance.loadId = 'other-load'; },
    t => { t.byteProvenance.resources[2].sha256 = sha(twoPixelPpat({ red: 0 })); },
    t => { t.byteProvenance.input.sha256 = 'other-owner'; },
    t => { t.byteProvenance.scope.resourceTypes = ['cicn', 'cinf']; },
  ]) { const changed = structuredClone(theme); mutate(changed); assert.equal(comparePatternBinding(changed, 'first', pin).status, 'mismatch'); }
});

test('duplicate pattern asset paths reject observed loads before encoding, including equal payloads', async () => {
  for (const data of [twoPixelPpat(), twoPixelPpat({ red: 0 })]) {
    const bytes = forkOf([{ type: 'ppat', id: 0, data: twoPixelPpat() }, { type: 'ppat', id: 0, data }]);
    let allocations = 0;
    await assert.rejects(load(bytes, { encodeAssets: true, assetUrlFactory() { allocations++; return 'blob:unexpected'; } }), /duplicate ppat asset binding/);
    assert.equal(allocations, 0);
    assert.equal(Object.keys((await load(bytes, { provenance: false })).manifest.patterns).length, 2);
  }
});

test('bit14 skipped and malformed pattern payloads remain observed without invented catalog bindings', async () => {
  const skipped = twoPixelPpat({ flags: 0x4000 }), malformed = twoPixelPpat(); new DataView(malformed.buffer).setUint32(70, 999);
  const theme = await load(forkOf([{ type: 'ppat', id: -1, data: skipped }, { type: 'ppat', id: 2, data: malformed }]));
  assert.deepEqual(Object.keys(theme.manifest.patterns ?? {}), []);
  assert.deepEqual(theme.byteProvenance.resources.map(r => [r.signedId, r.status, r.sha256]), [[-1, 'skipped', sha(skipped)], [2, 'error', sha(malformed)]]);
});

test('default pattern loads hash nothing and unobserved catalog owners stay unknown', async t => {
  const bytes = fixture();
  t.mock.method(crypto.subtle, 'digest', () => { throw new Error('unexpected digest'); });
  const theme = await load(bytes, { provenance: false });
  assert.equal(theme.byteProvenance, undefined);
  assert.equal(theme.manifest.patterns.first.byteProvenance, undefined);
  assert.equal(comparePatternBinding(theme, 'first', expected(bytes, twoPixelPpat())).status, 'unknown');
});

test('same-URL concurrent pattern loads and caller mutation retain private input snapshots', async t => {
  const bytes = [fixture(), fixture(twoPixelPpat({ red: 0x1234 }))]; let n = 0;
  t.mock.method(globalThis, 'fetch', async () => { const index = n++; if (!index) await new Promise(r => setTimeout(r, 10)); return new Response(bytes[index]); });
  const [a, b] = await Promise.all([load('https://fixture.invalid/same'), load('https://fixture.invalid/same')]);
  assert.notEqual(a.byteProvenance.loadId, b.byteProvenance.loadId);
  for (const [index, theme] of [a, b].entries()) assert.equal(theme.byteProvenance.input.sha256, sha(bytes[index]));
  assert.notEqual(a.byteProvenance.resources[3].sha256, b.byteProvenance.resources[3].sha256);
  const mutable = bytes[0].slice(), pending = load(mutable); mutable.fill(0);
  assert.equal((await pending).byteProvenance.input.sha256, sha(bytes[0]));
});

test('Crayon actual pattern catalog joins pinned archive/fork/payload bytes, without original lookup attribution', async () => {
  const bytes = new Uint8Array(readFileSync(new URL(`../../${pins.archivePath}`, import.meta.url)));
  const theme = await load(bytes);
  assert.equal(theme.byteProvenance.input.sha256, pins.archiveSha256);
  assert.equal(theme.byteProvenance.fork.sha256, pins.forkSha256);
  assert.equal(theme.byteProvenance.fork.selection.entryIndex, pins.entryIndex);
  assert.equal(theme.byteProvenance.fork.selection.entryName, pins.entryName);
  for (const pin of pins.patterns) {
    const [key, entry] = Object.entries(theme.manifest.patterns).find(([, p]) => p.sourcePpatId === pin.signedId);
    const record = theme.byteProvenance.resources.find(r => r.resourceIndex === entry.byteProvenance.ppatResourceIndex);
    assert.equal(entry.byteProvenance.manifestKey, key); assert.equal(entry.byteProvenance.loadId, theme.byteProvenance.loadId);
    assert.equal(record.type, 'ppat'); assert.equal(record.signedId, pin.signedId); assert.equal(record.status, 'decoded');
    assert.equal(record.byteLength, pin.byteLength); assert.equal(record.sha256, pin.payloadSha256);
  }
});


test('raw request shape rejects fractional or out-of-range metadata, while legacy absence stays unknown', async () => {
  const theme = await load(fixture());
  const clone = () => structuredClone(theme.manifest);
  for (const value of [{ mode: -1, resourceId: 0 }, { mode: 256, resourceId: 0 },
    { mode: 0.5, resourceId: 0 }, { mode: 0, resourceId: 32768 }, { mode: 0, resourceId: -32769 },
    { mode: 0, resourceId: 1.5 }, { mode: 0 }]) {
    const manifest = clone(); Object.values(manifest.chromeElements)[0].bodyRequest = value;
    assert.throws(() => validateTheme(manifest), /bodyRequest/);
  }
  const legacy = clone(); delete Object.values(legacy.chromeElements)[0].bodyRequest;
  assert.doesNotThrow(() => validateTheme(legacy));
  Object.values(legacy.chromeElements)[0].bodyRequest = null;
  assert.doesNotThrow(() => validateTheme(legacy));
});

test('last successfully decoded cinf occurrence carries the raw request independently of the pattern binding', async () => {
  const theme = await load(forkOf([{ type: 'cicn', id: -10239, data: onePixelCicn() },
    { type: 'cinf', id: -10239, data: request(0, -17) }, { type: 'cinf', id: -10239, data: request(5, 0) },
    { type: 'ppat', id: -17, name: 'pattern', data: twoPixelPpat() }]));
  const face = Object.values(theme.manifest.chromeElements)[0];
  assert.equal(face.byteProvenance.cinfResourceIndex, 2);
  assert.deepEqual(face.bodyRequest, { mode: 5, resourceId: 0 });
  assert.equal(theme.manifest.patterns.pattern.byteProvenance.ppatResourceIndex, 3);
});

test('ppat digest failure rejects before any URL allocation', async t => {
  const real = crypto.subtle.digest.bind(crypto.subtle), failure = new Error('ppat digest failed');
  let allocations = 0;
  t.mock.method(crypto.subtle, 'digest', (...args) => args[1].length === 104 ? Promise.reject(failure) : real(...args));
  await assert.rejects(load(fixture(), { encodeAssets: true, assetUrlFactory() { allocations++; return 'blob:unexpected'; } }), e => e === failure);
  assert.equal(allocations, 0);
});
