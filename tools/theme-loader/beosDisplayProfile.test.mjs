import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const file = name => new URL(`../../tests/decoder-fixtures/${name}`, import.meta.url);
const read = name => JSON.parse(readFileSync(file(name)));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const evidenceBytes = readFileSync(file('beos-display-calibration.json'));
const evidence = JSON.parse(evidenceBytes);
const profile = read('measured-display-profile-beos.json');

// The expected values below come from retained native rows and the independently
// frozen context0 attribution, never from conversion/rendering output.
function verify(data) {
  assert.equal(data.version, 2);
  assert.equal(sha(evidenceBytes), '61b6f43e71d7678f7a7fbc6ff2e9a2f3f6fcc5c1841245d5bebc7fe04c104062');
  assert.ok(data.evidence.some(x => x.sha256 === sha(evidenceBytes)));
  assert.deepEqual(data.conditions, evidence.conditions);
  const palette = Buffer.from(evidence.palettePayloadBase64, 'base64');
  const gamma = Buffer.from(evidence.gammaPayloadBase64, 'base64');
  assert.equal(sha(palette), data.conditions.palette.sha256);
  assert.equal(sha(gamma), data.conditions.gamma.sha256);
  assert.equal(palette.length, 2056);
  assert.equal(palette.readUInt16BE(4), 0x8000);
  assert.equal(palette.readInt16BE(6), 255);
  const entries = Array.from({ length: 256 }, (_, index) => ({ index,
    rgb16: [0, 1, 2].map(c => palette.readUInt16BE(10 + index * 8 + c * 2)) }));
  assert.deepEqual(data.devicePalette, entries);
  assert.deepEqual(Array.from({ length: 6 }, (_, i) => gamma.readInt16BE(i * 2)), [0, 0, 0, 1, 256, 8]);
  assert.equal(gamma.length, 268);
  assert.deepEqual(data.producer, { model: 'rgb16-high-byte-table', channels: Array.from({ length: 3 }, () => [...gamma.subarray(12)]) });
  assert.equal(evidence.mappingRows.length, 556);
  const measured = evidence.mappingRows.map((r, i) => {
    assert.equal(r.batch, 1 + Math.floor(i / 278)); assert.equal(r.sample, i % 278);
    assert.deepEqual(r.deviceRgb16, entries[r.deviceIndex].rgb16);
    return { rgb16: r.rgb16, deviceIndex: r.deviceIndex, deviceRgb16: r.deviceRgb16 };
  });
  assert.equal(new Set(measured.slice(0, 278).map(r => r.rgb16.join(','))).size, 278);
  assert.deepEqual(measured.slice(278), measured.slice(0, 278));
  assert.deepEqual(data.mappings, measured.slice(0, 278));
  const direct = data.directRgb8;
  assert.equal(direct.operation, 'GetPixPat-FillCRect-patCopy');
  assert.equal(direct.context, 'declared-context0'); assert.equal(direct.scope, 'preparation-only');
  assert.ok(direct.evidence.some(x => x.sha256 === sha(evidenceBytes)));
  assert.deepEqual(direct.mappings, [[170, 248], [187, 247], [221, 246]].map(([v, index]) => ({ rgb8: [v, v, v], deviceIndex: index, deviceRgb16: entries[index].rgb16 })));
  const observed = evidence.directContext0;
  assert.equal(observed.planSha256, '9c6897d865d8ebc7609c41c87343bd447f182459672f7c47aa08ccb4b21f6a43');
  assert.equal(observed.comparisonSha256, 'cf3c783d9cd5d51e47638836bf51ded0ea0a36cfc2d3cd153e09e56423e284c9');
  assert.equal(observed.rows.length, 24); assert.equal(observed.totalPixels, 20352);
  assert.equal(observed.grayPixelsCompared, 18102); assert.equal(observed.grayMismatches, 0);
  for (const [group, count] of [['uniform', 3456], ['mixed-owned', 2358], ['original', 12288]]) {
    assert.equal(observed.groups[group].grayPixelsCompared, count);
    assert.equal(observed.groups[group].grayMismatches, 0);
    for (const [rgb, index] of [['aaaaaa', 248], ['bbbbbb', 247], ['dddddd', 246]])
      assert.deepEqual(Object.keys(observed.groups[group].sourceRGB8ToObservedIndexCounts[rgb]), [String(index)]);
  }
  for (const join of evidence.observedProducerJoins) {
    assert.deepEqual(join.paletteRGB16, entries[join.index].rgb16);
    assert.deepEqual(join.observedRGBA, [join.paletteRGB16.map((v, c) => data.producer.channels[c][v >>> 8]).concat(255)]);
  }
  // Same recorded table as the prior profile, not a newly invented transform.
  const prior = read('measured-display-profile-animals.json');
  assert.deepEqual(data.producer, prior.producer); assert.deepEqual(data.devicePalette, prior.devicePalette);
}

test('finite BeOS profile binds both native RGB16 rounds and separate context0 direct observations', () => verify(profile));
test('finite data validation rejects missing/altered tuples, wrong direct index, sentinel expansion and producer drift', () => {
  for (const mutate of [
    d => d.mappings.pop(),
    d => { d.mappings[0].rgb16[0] ^= 1; },
    d => { d.directRgb8.mappings[0].deviceIndex = 247; d.directRgb8.mappings[0].deviceRgb16 = [...d.devicePalette[247].rgb16]; },
    d => d.directRgb8.mappings.push({ rgb8: [0x12, 0x34, 0x56], deviceIndex: 207, deviceRgb16: [...d.devicePalette[207].rgb16] }),
    d => { d.producer.channels[0][170] ^= 1; },
  ]) { const changed = structuredClone(profile); mutate(changed); assert.throws(() => verify(changed), assert.AssertionError); }
});
