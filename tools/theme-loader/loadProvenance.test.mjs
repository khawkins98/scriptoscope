import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { loadKaleidoscopeScheme } from './loadKaleidoscopeScheme.js';
import { faceFork, forkOf, cinf, onePixelCicn, stuffIt } from '../../tests/resource-provenance/fixtures.mjs';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const load = (bytes, opts = {}) => loadKaleidoscopeScheme(bytes, { provenance: true, encodeAssets: false, ...opts });
const pins = JSON.parse(readFileSync(new URL('../../tests/control-availability/source-candidates.json', import.meta.url)));
const code = value => value === null ? null : String.fromCharCode(value >>> 24, value >>> 16 & 255, value >>> 8 & 255, value & 255);

for (const pin of pins.themes) test(`${pin.slug}: actual load bytes and converted payloads match independently reviewed source pins`, async () => {
  const bytes = new Uint8Array(readFileSync(new URL(`../../${pin.archive.path}`, import.meta.url)));
  const theme = await load(bytes), e = theme.byteProvenance;
  assert.equal(e.input.sha256, pin.archive.sha256); assert.equal(e.input.byteLength, pin.archive.byteLength);
  assert.equal(e.fork.sha256, pin.selectedFork.forkSha256);
  assert.equal(e.fork.byteLength, pin.selectedFork.byteLength);
  const selected = e.fork.selection;
  assert.deepEqual([selected.entryIndex, selected.entryName, selected.forkType, code(selected.fileType), code(selected.creator)],
    [pin.selectedFork.entryIndex, pin.selectedFork.entryName, pin.selectedFork.forkType, pin.selectedFork.fileType, pin.selectedFork.creator]);
  for (const expected of pin.candidates) {
    const actual = e.resources.filter(r => r.type === expected.type && r.signedId === expected.signedId);
    if (expected.presence === 'absent-from-selected-fork') assert.equal(actual.length, 0);
    else { assert.equal(actual.length, 1); assert.equal(actual[0].sha256, expected.payloadSha256); assert.equal(actual[0].byteLength, expected.byteLength); assert.equal(actual[0].status, 'decoded'); }
  }
  for (const [key, element] of Object.entries(theme.manifest.chromeElements)) {
    const ref = element.byteProvenance;
    assert.equal(ref.loadId, e.loadId); assert.equal(ref.manifestKey, key);
    assert.equal(e.resources.find(r => r.resourceIndex === ref.cicnResourceIndex).signedId, element.sourceCicnId);
    if (ref.cinfResourceIndex !== null) assert.equal(e.resources.find(r => r.resourceIndex === ref.cinfResourceIndex).signedId, element.sourceCinfId);
  }
});

test('same-ID alternate forks retain the actually selected occurrence, policy and payload', async () => {
  const a = faceFork(), b = forkOf([{ type: 'cicn', id: -10239, data: onePixelCicn(0) }, { type: 'cinf', id: -10239, data: cinf() }, { type: 'TMPL', id: 1, data: new Uint8Array(20) }]);
  const archive = stuffIt([{ name: 'first', bytes: a }, { name: 'chosen', bytes: b }, { name: 'Icon\r', bytes: new Uint8Array(1000) }]);
  const { byteProvenance: e } = await load(archive);
  assert.equal(e.input.sha256, sha(archive)); assert.equal(e.fork.selection.entryIndex, 1); assert.equal(e.fork.selection.entryName, 'chosen');
  assert.equal(e.fork.selection.policy, 'largest-non-icon-resource-fork');
  assert.equal(e.fork.sha256, sha(b)); assert.notEqual(e.fork.sha256, sha(a));
  assert.equal(e.resources[0].sha256, sha(onePixelCicn(0))); assert.notEqual(e.resources[0].sha256, sha(onePixelCicn()));
});

test('duplicate cinf IDs retain the last successfully decoded metadata occurrence', async () => {
  const other = cinf(); other[0] = 2;
  const theme = await load(forkOf([
    { type: 'cicn', id: -10239, data: onePixelCicn() },
    { type: 'cinf', id: -10239, data: cinf() }, { type: 'cinf', id: -10239, data: other },
  ]));
  const [[key, element]] = Object.entries(theme.manifest.chromeElements);
  assert.deepEqual(element.byteProvenance, { loadId: theme.byteProvenance.loadId, manifestKey: key, cicnResourceIndex: 0, cinfResourceIndex: 2 });
  assert.equal(theme.byteProvenance.resources[2].sha256, sha(other));
});

test('ambiguous duplicate asset bindings reject opted-in evidence before allocation, even for equal payloads', async () => {
  for (const second of [onePixelCicn(), onePixelCicn(0)]) {
    const bytes = forkOf([{ type: 'cicn', id: -10239, data: onePixelCicn() }, { type: 'cicn', id: -10239, data: second }]);
    let allocations = 0;
    await assert.rejects(load(bytes, { encodeAssets: true, assetUrlFactory() { allocations++; return 'blob:unexpected'; } }), /unsupported: duplicate cicn asset binding/);
    assert.equal(allocations, 0);
    const legacy = await load(bytes, { provenance: false });
    assert.equal(Object.keys(legacy.manifest.chromeElements).length, 2);
    assert.equal(legacy.byteProvenance, undefined);
  }
});

test('caller mutation cannot race a load snapshot; evidence is deeply frozen and byte-free', async () => {
  const original = faceFork(), bytes = Buffer.from(original), loading = load(bytes);
  bytes.fill(0); const theme = await loading;
  assert.equal(theme.byteProvenance.input.sha256, sha(original));
  const visit = value => { if (value && typeof value === 'object') { assert.ok(Object.isFrozen(value)); assert.ok(!ArrayBuffer.isView(value)); for (const child of Object.values(value)) visit(child); } };
  visit(theme.byteProvenance); for (const element of Object.values(theme.manifest.chromeElements)) visit(element.byteProvenance);
});

test('simultaneous same-URL loads retain distinct load IDs and actual response bytes', async t => {
  let n = 0; const bytes = [faceFork(), faceFork(0)];
  t.mock.method(globalThis, 'fetch', async () => { const index = n++; if (!index) await new Promise(resolve => setTimeout(resolve, 10)); return new Response(bytes[index]); });
  const [a, b] = await Promise.all([load('https://fixture.invalid/same'), load('https://fixture.invalid/same')]);
  assert.notEqual(a.byteProvenance.loadId, b.byteProvenance.loadId);
  assert.equal(a.byteProvenance.input.sha256, sha(bytes[0])); assert.equal(b.byteProvenance.input.sha256, sha(bytes[1]));
  assert.notEqual(a.byteProvenance.resources[0].sha256, b.byteProvenance.resources[0].sha256);
});

test('disabled provenance performs no digest and adds no evidence', async t => {
  t.mock.method(crypto.subtle, 'digest', () => { throw new Error('unexpected digest'); });
  const theme = await load(faceFork(), { provenance: false });
  assert.equal(theme.byteProvenance, undefined);
  assert.ok(Object.values(theme.manifest.chromeElements).every(e => e.byteProvenance === undefined));
});

test('resource hash failures reject before URL allocation and pending hashes settle', async t => {
  const digest = crypto.subtle.digest.bind(crypto.subtle), failure = new Error('digest failed'); let calls = 0, encoders = 0, settled = 0;
  t.mock.method(crypto.subtle, 'digest', async (...args) => { const n = ++calls; if (n === 3) throw failure; if (n > 3) await new Promise(resolve => setTimeout(resolve, 10)); const result = await digest(...args); settled++; return result; });
  await assert.rejects(load(faceFork(), { encodeAssets: true, assetUrlFactory() { encoders++; return 'blob:unexpected'; } }), error => error === failure);
  assert.equal(encoders, 0); assert.equal(calls, 4); assert.equal(settled, 3);
});

test('failed decodes are recorded without invented manifest bindings', async () => {
  const malformed = onePixelCicn(); new DataView(malformed.buffer).setUint16(32, 3);
  const theme = await load(forkOf([{ type: 'cicn', id: -10239, data: malformed }, { type: 'cinf', id: -10239, data: cinf() }]));
  assert.deepEqual(theme.byteProvenance.resources.map(r => r.status), ['error', 'decoded']);
  assert.deepEqual(theme.manifest.chromeElements ?? {}, {});
});

test('mutation during an asynchronous digest cannot change the private parse/convert snapshot', async t => {
  const original = faceFork(), bytes = original.slice(), digest = crypto.subtle.digest.bind(crypto.subtle);
  let enter, release, calls = 0;
  const entered = new Promise(resolve => { enter = resolve; }), held = new Promise(resolve => { release = resolve; });
  t.mock.method(crypto.subtle, 'digest', async (...args) => { if (++calls === 1) { enter(); await held; } return digest(...args); });
  const pending = load(bytes); await entered; bytes.fill(0); release();
  const theme = await pending;
  assert.equal(theme.byteProvenance.input.sha256, sha(original));
  assert.equal(theme.byteProvenance.resources[0].sha256, sha(onePixelCicn()));
});

test('missing cinf stays null and invalid cinf rejects without exposing a successful load', async () => {
  const theme = await load(forkOf([{ type: 'cicn', id: -10239, data: onePixelCicn() }]));
  assert.equal(Object.values(theme.manifest.chromeElements)[0].byteProvenance.cinfResourceIndex, null);
  let encoders = 0;
  await assert.rejects(load(forkOf([{ type: 'cicn', id: -10239, data: onePixelCicn() }, { type: 'cinf', id: -10239, data: new Uint8Array(1) }]),
    { encodeAssets: true, assetUrlFactory() { encoders++; } }), /slice.side/);
  assert.equal(encoders, 0);
});

test('independent join rejects wrong fork/payload/owner/key/occurrence and keeps absent evidence unknown', async () => {
  const { compareByteProvenance } = await import('../../tests/resource-provenance/compare.mjs');
  const pin = pins.themes.find(p => p.slug === 'windows-95');
  const theme = await load(new Uint8Array(readFileSync(new URL(`../../${pin.archive.path}`, import.meta.url))));
  const key = 'cicn--10239', ref = theme.manifest.chromeElements[key].byteProvenance;
  const loaded = { baseUrl: '/themes/windows-95', byteProvenance: theme.byteProvenance };
  const expected = { baseUrl: loaded.baseUrl, chainDepth: 0, role: 'face', usage: 'paint', signedId: -10239, sourceCinfId: -10239, manifestKey: key };
  const step = { owner: { baseUrl: loaded.baseUrl, chainDepth: 0 }, role: 'face', usage: 'paint', action: 'selected',
    resource: { type: 'cicn', signedId: -10239, sourceCinfId: -10239, manifestKey: key, byteProvenance: ref } };
  assert.deepEqual(compareByteProvenance(step, loaded, pin, expected), { status: 'passed', errors: [] });
  const changes = [
    [s => { s.loaded.byteProvenance.fork.sha256 = 'wrong-fork'; }, /fork bytes/],
    [s => { s.loaded.byteProvenance.fork.selection.entryIndex = 999; }, /entryIndex/],
    [s => { s.loaded.byteProvenance.resources.find(r => r.resourceIndex === ref.cicnResourceIndex).sha256 = 'wrong-payload'; }, /payload bytes/],
    [s => { s.step.owner.baseUrl = '/child'; }, /owner/],
    [s => { s.step.owner.chainDepth = 1; }, /depth/],
    [s => { s.step.resource.manifestKey = 'competing-key'; }, /manifest key/],
    [s => { s.step.resource.byteProvenance.loadId = 'other-load'; }, /invocation/],
    [s => { s.step.resource.byteProvenance.cicnResourceIndex = -10239; }, /occurrence/],
    [s => { s.step.resource.byteProvenance.cinfResourceIndex = ref.cicnResourceIndex; }, /type\/ID/],
    [s => { s.step.usage = 'layout-reservation'; }, /role\/usage/],
    [s => { s.loaded.byteProvenance.resources.find(r => r.resourceIndex === ref.cicnResourceIndex).status = 'error'; }, /not decoded/],
  ];
  for (const [change, error] of changes) {
    const sample = structuredClone({ step, loaded }); change(sample);
    const result = compareByteProvenance(sample.step, sample.loaded, pin, expected);
    assert.equal(result.status, 'failed'); assert.match(result.errors.join('; '), error);
  }
  const absent = structuredClone(step); delete absent.resource.byteProvenance;
  assert.equal(compareByteProvenance(absent, loaded, pin, expected).status, 'unknown');
});


test('repeated cicn IDs with distinct output bindings retain separate occurrence references', async () => {
  const theme = await load(forkOf([{ type: 'cicn', id: -10239, name: 'First', data: onePixelCicn() }, { type: 'cicn', id: -10239, name: 'Second', data: onePixelCicn(0) }]));
  const first = theme.manifest.chromeElements.first.byteProvenance, second = theme.manifest.chromeElements.second.byteProvenance;
  assert.equal(first.cicnResourceIndex, 0); assert.equal(second.cicnResourceIndex, 1);
  assert.equal(first.manifestKey, 'first'); assert.equal(second.manifestKey, 'second');
  assert.equal(theme.byteProvenance.resources[0].sha256, sha(onePixelCicn()));
  assert.equal(theme.byteProvenance.resources[1].sha256, sha(onePixelCicn(0)));
});
