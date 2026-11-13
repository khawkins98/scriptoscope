// tools/sit-wasm/sit-wasm.malformed.test.mjs
// A malformed archive must make the decoder return — an ordinary error, or the entries it
// could decode — and must leave the shared WASM instance able to decode a valid archive.
// Before munbox/PATCHES.md patch #4 these inputs froze the decoder, aborted it, or wrote
// outside their buffers. The fixtures are built in malformed-archives.fixture.mjs.
//
// Everything that drives the decoder runs in a child process with a timeout, so a decoder
// that never returns fails the test instead of hanging the run.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readdirSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MALFORMED } from './malformed-archives.fixture.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const CHILD = join(here, 'malformed-archives.fixture.mjs');
const themes = join(root, 'themes');
// Every bundled StuffIt archive (all use method 13, the path that leaked).
const BUNDLED = readdirSync(themes).sort().map((d) => join(themes, d, 'scheme.sit')).filter((p) => existsSync(p));
const VALID = join(themes, 'platinum-8', 'scheme.sit');
const TIMEOUT_MS = 30_000; // the slowest case takes well under a second

function child(args, timeout = TIMEOUT_MS) {
  const p = spawnSync(process.execPath, [CHILD, ...args], { encoding: 'utf8', timeout, killSignal: 'SIGKILL' });
  assert.notEqual(p.error?.code, 'ETIMEDOUT', `decoder did not return within ${timeout} ms`);
  assert.equal(p.status, 0, `child exited with status ${p.status} (signal ${p.signal}): ${String(p.stderr).slice(0, 300)}`);
  return JSON.parse(p.stdout.trim().split('\n').pop());
}

test('fixtures stay small', () => {
  for (const [name, { bytes }] of Object.entries(MALFORMED)) assert.ok(bytes.length < 600, `${name}: ${bytes.length} bytes`);
});

for (const [name, { expect }] of Object.entries(MALFORMED)) {
  test(`malformed archive: ${name}`, () => {
    const r = child([name, VALID]);
    assert.notEqual(r.trapped, true, `decoder trapped or aborted: ${r.error}`);
    if (typeof expect === 'number') {
      assert.equal(r.error, undefined, 'returns the entries it decoded rather than an error');
      assert.equal(r.forks, expect, 'fork count');
    } else {
      assert.match(String(r.error), /^decodeArchive: /, 'an ordinary decoder error');
      assert.match(r.error, expect);
    }
    assert.equal(r.afterError, undefined, 'the same instance still decodes a valid archive');
    assert.equal(r.after, r.before, 'and decodes it to the same bytes as before the malformed input');
  });
}

test('the output cap leaves the bundled archives alone', () => {
  // Largest bundled archive decodes to about 1.55 MiB; the cap is 32 MiB.
  const r = child(['--memory', '1', ...BUNDLED]);
  assert.equal(r.errors, 0, 'every bundled archive decodes');
  assert.ok(r.largestOutput > 1024 * 1024 && r.largestOutput < 4 * 1024 * 1024, `largest packed output ${r.largestOutput}`);
});

test('decoder memory stays flat across repeated decodes of the bundled archives', () => {
  const r = child(['--memory', '12', ...BUNDLED], 120_000);
  assert.equal(r.errors, 0);
  assert.equal(r.memory.length, 12);
  assert.deepEqual(r.memory, new Array(12).fill(r.memory[0]), 'linear memory after each of 12 passes');
});

test('decoder memory stays flat across repeated malformed decodes', () => {
  // 200 passes over every fixture's error path, the valid archive in between. The two 4 GiB
  // fixtures are left out here only for time: each grows the buffer to the cap before failing.
  const r = child(['--memory-malformed', '200', VALID], 120_000);
  assert.equal(r.trapped, 0, 'no trap or abort');
  assert.equal(r.validMismatches, 0, 'the valid archive decodes identically after every pass');
  assert.equal(r.memoryEnd, r.memoryAfterFirstPass, 'linear memory after pass 200 equals pass 1');
});
