import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { prepareDisplayProfile, directRgb8Realizer, realizeRgb16 } from './display-profile.js';
import { decodePpat } from './decoders/ppat.js';
import { loadKaleidoscopeScheme } from './loadKaleidoscopeScheme.js';
import { forkOf } from '../../tests/resource-provenance/fixtures.mjs';
import { syntheticDisplayProfile } from '../../tests/decoder-fixtures/display-profile.mjs';
import { directDisplayProfile, directProfilePpat } from '../../tests/decoder-fixtures/direct-display-profile.mjs';

const expected = [90,100,110,255,120,130,140,255,20,30,40,255,90,100,110,255];
const unsupported = e => e.code === 'UNSUPPORTED_SOURCE_COLOR';
const asFork = bytes => forkOf([{ type: 'ppat', id: 128, data: bytes }]);

test('v2 direct policy is separately typed, snapshotted and canonical; v1 identities remain exact', async () => {
  const data = directDisplayProfile(), pending = prepareDisplayProfile(data);
  data.directRgb8.mappings[0].rgb8[0] = 1;
  const p = await pending, realize = directRgb8Realizer(p);
  assert.deepEqual(realize([170,170,170]), [90,100,110]);
  assert.deepEqual(realizeRgb16([0x2122,0x2121,0x2121], p), [120,130,140]);
  assert.throws(() => realizeRgb16([170*257,170*257,170*257], p), e => e.code === 'MISSING_MAPPING');
  assert.throws(() => realize([0x2121,0x2121,0x2121]), e => e.code === 'INVALID_SOURCE_COLOR');
  assert.ok(Object.isFrozen(p.data.directRgb8.mappings[0].rgb8));
  const reversed = directDisplayProfile(); reversed.directRgb8.mappings.reverse();
  assert.equal((await prepareDisplayProfile(reversed)).id, p.id);
  assert.throws(() => directRgb8Realizer(JSON.parse(JSON.stringify(p))), /prepareDisplayProfile/);
  assert.equal(directRgb8Realizer(await prepareDisplayProfile(syntheticDisplayProfile())), undefined);
  for (const mutate of [
    d => d.version = 1, d => delete d.directRgb8, d => d.directRgb8.context = 'any-context',
    d => d.directRgb8.scope = 'renderer-enforced', d => d.directRgb8.operation = 'CopyBits',
    d => d.directRgb8.mappings.push(d.directRgb8.mappings[0]),
    d => d.directRgb8.mappings.push(null),
    d => d.directRgb8.mappings[0].rgb8[0] = 256,
    d => d.directRgb8.mappings[0].deviceIndex = 99,
    d => d.directRgb8.mappings[0].deviceRgb16[0]++,
    d => d.directRgb8.evidence = [],
  ]) { const d = directDisplayProfile(); mutate(d); await assert.rejects(prepareDisplayProfile(d), e => e.code === 'INVALID_PROFILE'); }
  // Existing measured v1 canonical IDs are recorded independently before this change.
  for (const [name, hash] of [
    ['measured-display-profile.json', '506eb4e615f81385b6143c63a9612f4c899b14e2c93c60b67358b436777f772d'],
    ['measured-display-profile-crayon.json', 'd4e4f9ffb69f1292f2c86b3fb2914561c58f8b38a5aeb53336e6cf914b10a1a0'],
    ['measured-display-profile-lisa.json', '9bbdfe3464638676c8c8aac27d1b316a3f6bd21837be19f937e59fa5df4730a2'],
    ['measured-display-profile-animals.json', '287bde96a0ee72c13658b53c2e24643264325f79ded18ae0cd8d96257a9082b7'],
  ]) {
    const input = JSON.parse(fs.readFileSync(new URL(`../../tests/decoder-fixtures/${name}`, import.meta.url)));
    const actual = await prepareDisplayProfile(input);
    assert.equal(actual.id, `display-profile:${hash}`);
    assert.equal(Object.hasOwn(actual.data, 'directRgb8'), false);
  }
});

test('direct ppat uses RGB8 alone across padded/tight rows and byte views without a second transform', async () => {
  const p = await prepareDisplayProfile(directDisplayProfile());
  const options = { realizeRgb16: rgb => realizeRgb16(rgb, p), realizeDirectRgb8: directRgb8Realizer(p) };
  for (const rowBytes of [8,12]) {
    const bytes = directProfilePpat({ rowBytes }), wrapped = new Uint8Array(bytes.length + 11);
    wrapped.set(bytes, 7);
    const out = decodePpat(wrapped.subarray(7, 7 + bytes.length), options);
    assert.deepEqual([out.width, out.height], [2,2]);
    assert.deepEqual([...out.rgba], expected);
  }
  assert.deepEqual([...decodePpat(directProfilePpat()).rgba], [
    170,170,170,255,187,187,187,255,221,221,221,255,170,170,170,255,
  ]); // No-profile decoder remains the existing direct-byte behavior.
  assert.throws(() => decodePpat(directProfilePpat(), { realizeRgb16: rgb => rgb }), unsupported);
});

test('direct policy rejects unsupported layouts and exact-view truncation rather than guessing bytes', async () => {
  const p = await prepareDisplayProfile(directDisplayProfile());
  const options = { realizeRgb16: rgb => realizeRgb16(rgb, p), realizeDirectRgb8: directRgb8Realizer(p) };
  for (const mutate of [
    v => v.setUint16(0, 2), v => v.setUint16(58, 0), v => v.setUint16(60, 16),
    v => v.setUint16(62, 4), v => v.setUint16(64, 5),
    v => v.setInt16(40, 3), v => v.setInt16(38, 3),
    v => v.setInt16(34, 1), v => v.setInt16(36, -1), v => v.setInt16(38, 0),
    v => v.setUint16(42, 0), v => v.setUint16(44, 1), v => v.setUint32(46, 8),
    v => v.setUint32(66, 1), v => v.setUint16(32, 12), v => v.setUint16(32, 0x8004),
    v => v.setUint16(32, 0x800a), v => v.setUint32(2, 27),
    v => v.setUint32(2, 0xfffffff0), v => v.setUint32(6, 77), v => v.setUint32(6, 0xfffffff0),
  ]) {
    const bytes = directProfilePpat(); mutate(new DataView(bytes.buffer));
    assert.throws(() => decodePpat(bytes, options), unsupported);
  }
  const bytes = directProfilePpat();
  for (const n of [9,27,77,bytes.length - 1]) assert.throws(() => decodePpat(bytes.subarray(0,n), options), unsupported);
});

test('public loader joins actual direct pixels/profile and rejects a missing tuple before encoding', async () => {
  const p = await prepareDisplayProfile(directDisplayProfile());
  const loaded = await loadKaleidoscopeScheme(asFork(directProfilePpat()), { displayProfile: p, provenance: true, encodeAssets: false });
  assert.equal(loaded.manifest.displayProfile, p);
  assert.deepEqual([...loaded.assets[0].rgba], expected);
  assert.equal(loaded.byteProvenance.resources[0].status, 'decoded');
  let encoded = 0;
  const options = { displayProfile: p, encodeAssets: true, assetUrlFactory: () => { encoded++; return 'never'; } };
  await assert.rejects(loadKaleidoscopeScheme(asFork(directProfilePpat({ colors: [170,187,221,34] })), options), e => e.code === 'MISSING_MAPPING');
  assert.equal(encoded, 0);
  const d = directDisplayProfile();
  // RGB16 contains an expanded unknown RGB8 color, but it must never be used by the direct path.
  d.mappings.push({ rgb16: [34*257,34*257,34*257], deviceIndex: 0, deviceRgb16: [0,0,0] });
  await assert.rejects(loadKaleidoscopeScheme(asFork(directProfilePpat({ colors: [34,170,187,221] })),
    { ...options, displayProfile: await prepareDisplayProfile(d) }), e => e.code === 'MISSING_MAPPING');
  assert.equal(encoded, 0);
  const bad = directProfilePpat(); new DataView(bad.buffer).setUint16(62, 4);
  await assert.rejects(loadKaleidoscopeScheme(asFork(bad), options), unsupported);
  assert.equal(encoded, 0);
});
