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
const SIT5 = resolve(root, '.scratch', 'masswerk7le.sit'); // a multi-file SIT5 / method-15 archive

test('decodes a real Kaleidoscope .sit → picked resource fork byte-identical to the corpus', {
  skip: existsSync(FIXTURE) ? false : 'fixture .scratch/system7nostalgiasilver.sit absent',
}, async () => {
  const sit = new Uint8Array(readFileSync(FIXTURE));

  // A Kaleidoscope .sit typically wraps the scheme alongside a ReadMe (and sometimes a folder
  // icon file). Post-patch (spike fix #3 to lib/layers/sit.c — folder sub-entries no longer
  // count against num_files), decodeArchive returns every fork in the archive — the assertion
  // here is "at least the scheme fork is present," not "exactly one."
  const entries = await decodeArchive(sit);
  const rsrcEntries = entries.filter((e) => e.forkType === 1 && e.bytes.length > 0);
  assert.ok(rsrcEntries.length >= 1, 'at least one resource fork');

  // stuffItResourceFork picks the LARGEST non-Icon resource fork — that's the scheme. It must
  // equal the corpus bytes exactly (the corpus was produced by the same pipeline).
  const fork = await stuffItResourceFork(sit);
  const corpus = new Uint8Array(readFileSync(CORPUS));
  assert.equal(fork.length, corpus.length, 'picked resource-fork length matches the corpus');
  assert.deepEqual(fork, corpus, 'picked resource-fork bytes match the corpus exactly');
});

test('multi-file SIT5 (method 15): picks the scheme fork, tolerates munbox’s trailing over-run', {
  skip: existsSync(SIT5) ? false : 'fixture .scratch/masswerk7le.sit absent',
}, async () => {
  const sit = new Uint8Array(readFileSync(SIT5));
  // Must NOT throw, even though munbox over-runs the last SIT5 entry (returns -1) — the shim
  // keeps the entries it decoded.
  const entries = await decodeArchive(sit);
  const rsrc = entries.filter((e) => e.forkType === 1 && e.bytes.length > 0);
  assert.ok(rsrc.length >= 2, 'several resource forks (folder Icon + scheme + ReadMe)');

  // stuffItResourceFork picks the LARGEST non-Icon resource fork (the scheme), not the first
  // (which is the tiny folder-icon file).
  const fork = await stuffItResourceFork(sit);
  const largest = Math.max(...rsrc.filter((e) => !/(^|\/)Icon\r?$/.test(e.name)).map((e) => e.bytes.length));
  assert.equal(fork.length, largest, 'returns the scheme fork (largest), not the folder icon');
  assert.ok(fork.length > 8000, 'the scheme fork is the substantial one');
});

test('a non-archive input yields no resource fork (the scheme helper rejects it clearly)', async () => {
  // munbox passes unrecognized bytes through as a data fork; there's no resource fork,
  // so stuffItResourceFork must reject it with a clear message — not return empty.
  const garbage = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
  const entries = await decodeArchive(garbage);
  assert.ok(entries.every((e) => e.forkType === 0), 'no resource-fork entry for non-archive input');
  await assert.rejects(() => stuffItResourceFork(garbage), /no resource fork/);
});
