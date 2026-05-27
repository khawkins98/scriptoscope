// tools/sit-wasm/sit-wasm.test.mjs
// The munbox WASM decoder must recover a Kaleidoscope scheme's resource fork from a real
// StuffIt .sit, byte-for-byte. The fixture is the git-ignored clean-room source
// (.scratch/system7nostalgiasilver.sit); the expected output is the fork we already ship
// (themes/system7-nostalgia-silver/scheme.rsrc). Skips when the fixture is absent (CI).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodeArchive, stuffItResourceFork } from './index.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const FIXTURE = resolve(root, '.scratch', 'system7nostalgiasilver.sit');
const CORPUS = resolve(root, 'themes', 'system7-nostalgia-silver', 'scheme.rsrc');

test('decodes a real Kaleidoscope .sit → resource fork byte-identical to the corpus', {
  skip: existsSync(FIXTURE) ? false : 'fixture .scratch/system7nostalgiasilver.sit absent',
}, async () => {
  const sit = new Uint8Array(readFileSync(FIXTURE));

  // The full fork list: a single file with a resource fork (Kaleidoscope schemes).
  const entries = await decodeArchive(sit);
  const rsrcEntries = entries.filter((e) => e.forkType === 1 && e.bytes.length > 0);
  assert.equal(rsrcEntries.length, 1, 'exactly one resource fork');

  const fork = await stuffItResourceFork(sit);
  const corpus = new Uint8Array(readFileSync(CORPUS));
  assert.equal(fork.length, corpus.length, 'resource-fork length matches the corpus');
  assert.deepEqual(fork, corpus, 'resource-fork bytes match the corpus exactly');
});

test('a non-archive input yields no resource fork (the scheme helper rejects it clearly)', async () => {
  // munbox passes unrecognized bytes through as a data fork; there's no resource fork,
  // so stuffItResourceFork must reject it with a clear message — not return empty.
  const garbage = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
  const entries = await decodeArchive(garbage);
  assert.ok(entries.every((e) => e.forkType === 0), 'no resource-fork entry for non-archive input');
  await assert.rejects(() => stuffItResourceFork(garbage), /no resource fork/);
});
