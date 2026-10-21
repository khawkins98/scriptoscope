import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { REPOSITORY_ROOT, compactStore, formatCompactJSON, originalBytes, readOriginal } from '../helpers/compact-json.mjs';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const store = compactStore();
const file = path => resolve(REPOSITORY_ROOT, path);

test('every compacted file is canonical compact-json-v1 and decodes to its bound original identity', () => {
  assert.ok(store.compacted.length > 0);
  for (const entry of store.compacted) {
    const stored = readFileSync(file(entry.path));
    assert.equal(sha(stored), entry.storedSha256, `${entry.path}: stored bytes changed without a store update`);
    assert.equal(formatCompactJSON(JSON.parse(stored)), stored.toString(), `${entry.path}: not canonical compact layout`);
    const original = originalBytes(stored);
    assert.equal(original.length, entry.originalBytes);
    assert.equal(sha(original), entry.originalSha256);
  }
});

test('a semantic edit to a compacted file cannot reproduce the bound identity', () => {
  const entry = store.compacted.find(e => e.path.endsWith('measured-display-profile-floppies.json'));
  const value = JSON.parse(readFileSync(file(entry.path)));
  value.mappings[0].deviceIndex ^= 1;
  const edited = Buffer.from(formatCompactJSON(value));
  // Unregistered bytes are returned unchanged, so every existing sha256 check fails.
  assert.notEqual(sha(originalBytes(edited)), entry.originalSha256);
});

test('removed duplicates resolve only to their declared byte-identical single copy', () => {
  for (const alias of store.aliases) {
    assert.equal(existsSync(file(alias.path)), false, `${alias.path}: duplicate still committed`);
    const bytes = readOriginal(alias.path);
    assert.equal(sha(bytes), alias.sha256);
    assert.equal(bytes.length, alias.bytes);
  }
  assert.throws(() => readOriginal('tests/reference-captures/not-an-alias.json'), /ENOENT/);
});

test('externalized evidence is absent and names a private hash-bound locator', () => {
  for (const entry of store.external) {
    assert.equal(existsSync(file(entry.path)), false, `${entry.path}: externalized file still committed`);
    assert.match(entry.sha256, /^[a-f0-9]{64}$/);
    assert.match(entry.privateArchiveSha256, /^[a-f0-9]{64}$/);
    assert.match(entry.privateCommit, /^[a-f0-9]{40}$/);
    for (const field of ['privateRepository', 'privateAsset', 'privateMember', 'role']) assert.ok(entry[field], `${entry.path}: ${field}`);
    assert.ok(Number.isInteger(entry.bytes) && entry.bytes > 0);
  }
});
