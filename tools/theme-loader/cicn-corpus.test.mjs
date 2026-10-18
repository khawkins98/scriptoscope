import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { enumerateForks, selectFork } from '../../tests/control-availability/source.mjs';
import { parseResourceFork } from './resource-fork.js';
import { decodeCicn } from './decoders/cicn.js';
const root = new URL('../../', import.meta.url);
const choices = JSON.parse(readFileSync(new URL('tests/control-availability/source-choices.json', root))).sources;
const baseline = JSON.parse(readFileSync(new URL('tests/decoder-fixtures/cicn-corpus.json', root)));

test('cicn correction preserves all 3325 decoded corpus images (regression only)', async () => {
  const actual = [];
  for (const choice of choices) {
    const bytes = new Uint8Array(readFileSync(new URL(choice.path, root)));
    const fork = selectFork(bytes, await enumerateForks(bytes, choice.format), choice);
    const aggregate = createHash('sha256'); let count = 0;
    for (const resource of parseResourceFork(fork.bytes).filter(r => r.type === 'cicn')) {
      const decoded = decodeCicn(resource.data);
      aggregate.update(JSON.stringify([resource.id, decoded.width, decoded.height]));
      aggregate.update(decoded.rgba); count++;
    }
    actual.push({ slug: choice.slug, archiveSha256: choice.archiveSha256, forkSha256: choice.forkSha256,
      count, rgbaAggregateSha256: aggregate.digest('hex') });
  }
  assert.deepEqual(actual, baseline.rows);
  assert.equal(actual.reduce((n, row) => n + row.count, 0), 3325);
});
