import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { archiveFailure } from './failure-archive.mjs';

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'rendering-archive-test-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const output = join(root, 'replaceable'), archive = join(root, 'archive');
  mkdirSync(output);
  return { root, output, archive };
}
const metadata = { status: 'failed', errors: [{ message: 'original geometry assertion' }], retry: 0 };

test('trace, screenshot and body bytes survive a subsequent run deleting its output', t => {
  const { output, archive } = fixture(t), trace = Buffer.from([0, 1, 255, 7]), screenshot = Buffer.from([137, 80, 78, 71]);
  writeFileSync(join(output, 'trace.zip'), trace); writeFileSync(join(output, 'screen.png'), screenshot);
  const result = archiveFailure(archive, metadata, [
    { name: 'trace', path: join(output, 'trace.zip'), contentType: 'application/zip' },
    { name: 'screenshot', path: join(output, 'screen.png'), contentType: 'image/png' },
    { name: 'case', body: Buffer.from('{"actual":null}'), contentType: 'application/json' },
  ]);
  rmSync(output, { recursive: true }); mkdirSync(output);
  const record = JSON.parse(readFileSync(join(result.directory, 'record.json')));
  assert.equal(record.archiveComplete, true); assert.equal(record.status, 'failed');
  assert.deepEqual(record.errors, metadata.errors);
  for (const [index, expected] of [trace, screenshot, Buffer.from('{"actual":null}')].entries()) {
    const file = record.files[index], actual = readFileSync(join(result.directory, file.path));
    assert.deepEqual(actual, expected); assert.equal(file.sha256, createHash('sha256').update(expected).digest('hex'));
  }
});

test('repeat attempts and duplicate attachment labels cannot overwrite earlier evidence or escape the archive', t => {
  const { archive } = fixture(t), attachments = [
    { name: '../../same', contentType: 'text/plain', body: Buffer.from('first') },
    { name: '../../same', contentType: 'text/plain', body: Buffer.from('second') },
  ];
  const first = archiveFailure(archive, metadata, attachments), second = archiveFailure(archive, { ...metadata, retry: 1 }, attachments);
  assert.notEqual(first.directory, second.directory); assert.equal(readdirSync(archive).length, 2);
  for (const attempt of [first, second]) for (const [index, file] of attempt.record.files.entries()) {
    assert.equal(resolve(attempt.directory, file.path).startsWith(attempt.directory + '/'), true);
    assert.equal(readFileSync(join(attempt.directory, file.path), 'utf8'), index ? 'second' : 'first');
  }
});

test('missing attachments retain the primary failure and cannot claim complete preservation', t => {
  const { archive, output } = fixture(t);
  const { record } = archiveFailure(archive, metadata, [
    { name: 'missing-trace', path: join(output, 'gone.zip'), contentType: 'application/zip' },
    { name: 'empty-reference', contentType: 'text/plain' },
    { name: 'surviving-case', body: Buffer.from('details'), contentType: 'text/plain' },
  ]);
  assert.equal(record.archiveComplete, false); assert.deepEqual(record.errors, metadata.errors);
  assert.deepEqual(record.files.map(file => file.status), ['unavailable', 'unavailable', 'preserved']);
  assert.equal(record.files[0].reason, 'ENOENT'); assert.equal(record.files[1].reason, 'no-path-or-body');
  assert.equal(archiveFailure(archive, metadata, []).record.archiveComplete, false);
});
