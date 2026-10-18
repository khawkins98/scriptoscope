import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { convertChrome } from './convert.js';
import { parseResourceFork } from './resource-fork.js';
import { readSchemeFork, schemeSource } from '../../scripts/lib/scheme-source.mjs';

// A minimal resource map with one resource per type. Keeping signed ids and
// four-byte type codes explicit catches loss of identity (including trailing spaces).
function forkOf(resources) {
  const dataLength = resources.reduce((n, r) => n + 4 + r.data.length, 0);
  const mapOffset = 16 + dataLength, mapLength = 30 + resources.length * 20;
  const bytes = new Uint8Array(mapOffset + mapLength), view = new DataView(bytes.buffer);
  [16, mapOffset, dataLength, mapLength].forEach((n, i) => view.setUint32(i * 4, n));
  view.setUint16(mapOffset + 24, 28);
  view.setUint16(mapOffset + 26, mapLength);
  const types = mapOffset + 28;
  view.setUint16(types, resources.length - 1);
  let dataOffset = 0;
  resources.forEach((r, i) => {
    const type = types + 2 + i * 8, refOffset = 2 + resources.length * 8 + i * 12;
    bytes.set([...r.type].map(c => c.charCodeAt(0)), type);
    view.setUint16(type + 6, refOffset);
    const ref = types + refOffset;
    view.setInt16(ref, r.id); view.setUint16(ref + 2, 0xffff);
    bytes[ref + 5] = dataOffset >>> 16; bytes[ref + 6] = dataOffset >>> 8; bytes[ref + 7] = dataOffset;
    view.setUint32(16 + dataOffset, r.data.length);
    bytes.set(r.data, 20 + dataOffset); dataOffset += 4 + r.data.length;
  });
  return bytes;
}

test('extraction distinguishes decoded, unsupported-variant, unhandled-type and failed resources', () => {
  const fork = forkOf([
    { type: 'Colr', id: 128, data: new Uint8Array(0) }, // malformed supported type
    { type: 'ppat', id: -7, data: new Uint8Array(10) }, // valid unsupported type 0
    { type: 'TMPL', id: 128, data: new Uint8Array(0) },
    { type: 'snd ', id: 9, data: new Uint8Array([1]) },
    { type: 'icl4', id: -3999, data: new Uint8Array([2]) },
    { type: 'clut', id: -14336, data: new Uint8Array(16) }, // one black header color
  ]);
  const { manifest } = convertChrome(fork);
  assert.deepEqual(manifest.counts, { total: 6, ok: 1, skipped: 4, errored: 1, raster: 0, geometry: 0, color: 1 });
  assert.equal(manifest.assets.find(a => a.type === 'ppat').reason, 'unsupported variant');
  for (const type of ['snd ', 'icl4', 'TMPL']) {
    assert.equal(manifest.assets.find(a => a.type === type).reason, 'not extracted by convertChrome');
  }
  assert.match(manifest.assets.find(a => a.type === 'Colr').error, /./);
});

test('unused palettes are inventoried without introducing another decode path', () => {
  const { manifest } = convertChrome(forkOf([{ type: 'clut', id: 42, data: new Uint8Array(0) }]));
  assert.equal(manifest.assets[0].status, 'skipped');
  assert.equal(manifest.counts.color, 0);
});

test('every corpus resource has exactly one extraction record and totals conserve outcomes', async () => {
  const root = fileURLToPath(new URL('../../themes/', import.meta.url));
  const slugs = readdirSync(root).filter(slug => schemeSource(`${root}/${slug}`));
  assert.ok(slugs.length >= 18, 'the shipped corpus is available');
  for (const slug of slugs) {
    const { fork } = await readSchemeFork(`${root}/${slug}`);
    const entries = parseResourceFork(fork);
    const { manifest, theme } = convertChrome(fork);
    const { counts, assets } = manifest;
    assert.deepEqual(assets.map(a => [a.type, a.id, a.name]), entries.map(e => [e.type, e.id, e.name || null]), slug);
    assert.equal(counts.total, entries.length, slug);
    assert.equal(counts.total, counts.ok + counts.skipped + counts.errored, slug);
    assert.equal(counts.ok, counts.raster + counts.geometry + counts.color, slug);
    for (const [status, count] of [['ok', counts.ok], ['skipped', counts.skipped], ['error', counts.errored]]) {
      assert.equal(assets.filter(a => a.status === status).length, count, `${slug}: ${status}`);
    }
    const cluts = assets.filter(a => a.type === 'clut' && a.status === 'ok');
    assert.equal(cluts.length, counts.color, slug);
    for (const c of cluts) {
      assert.ok(c.data.entries.length > 0, `${slug}: extracted palette`);
      assert.ok(theme.headerColors[c.id === -14336 ? 'active' : 'inactive'], `${slug}: palette used`);
    }
  }
});
