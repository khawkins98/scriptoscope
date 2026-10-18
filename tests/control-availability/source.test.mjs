import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { enumerateForks, selectFork, describeFork, sourceCandidate, sha256 } from './source.mjs';
const bytes = new Uint8Array([1, 2, 3]);
const entry = (entryIndex, entryName, contents) => ({ entryIndex, entryName, forkType: 1, fileType: 'Colr', creator: 'Test', bytes: new Uint8Array(contents) });
const chosen = entry(7, 'Chosen scheme', [4, 5]);
const choice = { slug: 'fixture', archiveSha256: sha256(bytes), entryIndex: 7, entryName: 'Chosen scheme', forkSha256: sha256(chosen.bytes) };
test('explicit identity selects the small declared fork, never the largest resource fork', () => {
  const larger = entry(3, 'Unrelated application', Array(99).fill(9));
  assert.equal(selectFork(bytes, [larger, chosen], choice), chosen);
  assert.equal(describeFork(chosen).entryIndex, 7);
});
test('missing choices and ambiguous duplicate entry identities fail closed', () => {
  assert.throws(() => selectFork(bytes, [chosen], { ...choice, entryName: undefined }), /missing explicit entry/);
  const absent = { ...choice }; delete absent.entryIndex;
  assert.throws(() => selectFork(bytes, [chosen], absent), /missing explicit entry/);
  assert.throws(() => selectFork(bytes, [chosen, { ...chosen }], choice), /ambiguous/);
});
test('archive, entry name, index and fork digest drift each require explicit review', () => {
  assert.throws(() => selectFork(new Uint8Array([8]), [chosen], choice), /archive hash drift/);
  assert.throws(() => selectFork(bytes, [{ ...chosen, entryName: 'Corrected decoded name' }], choice), /missing explicit entry/);
  assert.throws(() => selectFork(bytes, [{ ...chosen, entryIndex: 8 }], choice), /missing explicit entry/);
  assert.throws(() => selectFork(bytes, [{ ...chosen, bytes: new Uint8Array([8]) }], choice), /fork hash drift/);
});
test('standalone resource forks use an explicit null entry identity', async () => {
  const entries = await enumerateForks(bytes, 'rsrc');
  assert.equal(entries.length, 1); assert.equal(entries[0].entryName, null); assert.equal(entries[0].entryIndex, null);
  assert.equal(selectFork(bytes, entries, { slug: 'raw', archiveSha256: sha256(bytes), entryName: null, entryIndex: null, forkSha256: sha256(bytes) }), entries[0]);
  await assert.rejects(enumerateForks(bytes, 'auto'), /Unsupported explicit/);
});
test('source generation preserves unreviewed status and signed payload identity without rendering', async () => {
  const selections = JSON.parse(readFileSync(new URL('./source-choices.json', import.meta.url)));
  const selected = selections.sources.find(source => source.slug === 'windows-95');
  const archive = readFileSync(new URL(`../../${selected.path}`, import.meta.url));
  const candidate = await sourceCandidate(archive, selected);
  assert.equal(candidate.reviewStatus, 'unreviewed'); assert.equal(candidate.expectedAvailability, 'unknown');
  assert.deepEqual(candidate.selectedFork.entryName, selected.entryName);
  assert(candidate.candidates.every(resource => resource.signedId < 0));
  for (const resource of candidate.candidates.filter(resource => resource.presence === 'present')) {
    assert.match(resource.payloadSha256, /^[a-f0-9]{64}$/); assert(resource.byteLength > 0);
  }
  assert.equal(candidate.candidates.find(resource => resource.type === 'cicn' && resource.signedId === -10230).presence, 'absent-from-selected-fork');
  assert.equal('proposed' in candidate, false); assert.equal('outcome' in candidate, false);
});
