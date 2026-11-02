import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

test('author command validates MacBinary packaging before writing either scheme output', () => {
  const dir = mkdtempSync(join(tmpdir(), 'author-scheme-'));
  const source = new URL('../authoring/schemes/kingfisher/scheme.mjs', import.meta.url).href;
  try {
    writeFileSync(join(dir, 'scheme.mjs'), `export { buildScheme } from ${JSON.stringify(source)};\n`);
    writeFileSync(join(dir, 'meta.json'), JSON.stringify({ name: 'Invalid:Name' }));
    writeFileSync(join(dir, 'scheme.rsrc'), 'previous resource fork');
    writeFileSync(join(dir, 'scheme.bin'), 'previous MacBinary');
    const result = spawnSync(process.execPath, [fileURLToPath(new URL('./author-scheme.mjs', import.meta.url)), dir], {
      encoding: 'utf8', timeout: 30000,
    });
    assert.ifError(result.error);
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stderr, /MacBinary packaging failed:.*name must be/);
    assert.equal(readFileSync(join(dir, 'scheme.rsrc'), 'utf8'), 'previous resource fork');
    assert.equal(readFileSync(join(dir, 'scheme.bin'), 'utf8'), 'previous MacBinary');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
