import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, cpSync, symlinkSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

test('author command validates MacBinary packaging before writing either scheme output', () => {
  const dir = mkdtempSync(join(tmpdir(), 'author-scheme-'));
  const source = new URL('../authoring/schemes/scriptoscope/scheme.mjs', import.meta.url).href;
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

test('author and scheme checks agree on long display names and native filenames', () => {
  const root = mkdtempSync(join(tmpdir(), 'author-scheme-name-'));
  const dir = join(root, 'authoring/schemes/example');
  const name = 'A scheme name longer than thirty-one characters';
  const source = new URL('../authoring/schemes/scriptoscope/scheme.mjs', import.meta.url).href;
  try {
    mkdirSync(dir, { recursive: true });
    mkdirSync(join(root, 'scripts'));
    cpSync(new URL('./check-authored-schemes.mjs', import.meta.url), join(root, 'scripts/check-authored-schemes.mjs'));
    symlinkSync(fileURLToPath(new URL('../tools', import.meta.url)), join(root, 'tools'), 'junction');
    writeFileSync(join(dir, 'scheme.mjs'), `export { buildScheme } from ${JSON.stringify(source)};\n`);
    writeFileSync(join(dir, 'meta.json'), JSON.stringify({ name }));
    const result = spawnSync(process.execPath, [fileURLToPath(new URL('./author-scheme.mjs', import.meta.url)), dir], {
      encoding: 'utf8', timeout: 30000,
    });
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    const bin = readFileSync(join(dir, 'scheme.bin'));
    assert.equal(bin[1], 31);
    assert.equal(bin.subarray(2, 33).toString('ascii'), 'A scheme name longer than thirt');
    assert.equal(JSON.parse(readFileSync(join(dir, 'meta.json'), 'utf8')).name, name);
    const check = spawnSync(process.execPath, [join(root, 'scripts/check-authored-schemes.mjs')], {
      encoding: 'utf8', timeout: 30000,
    });
    assert.ifError(check.error);
    assert.equal(check.status, 0, check.stdout + check.stderr);
    assert.match(check.stdout, /All 1 authored schemes passed/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
