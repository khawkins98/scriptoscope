import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseResourceFork } from './resource-fork.js';
import { providerFork } from '../../tests/decoder-fixtures/cinf-environment.mjs';
import { forkOf } from '../../tests/resource-provenance/fixtures.mjs';
const view = bytes => new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
const withLength = (bytes, field, length) => { view(bytes).setUint32(field, length); return bytes; };

test('resource length word and payload must fit declared data, not trailing map bytes', () => {
  for (const length of [0, 3, 4, 21])
    assert.throws(() => parseResourceFork(withLength(providerFork(0), 8, length)), /parseResourceFork:.*data/i, `dataLength=${length}`);
});

test('map header, type count, type entry and ref entry fit the declared map', () => {
  // Entire valid50-byte map remains physically present; only its declared end changes.
  for (const length of [0, 27, 29, 37, 49])
    assert.throws(() => parseResourceFork(withLength(providerFork(0), 12, length)), /parseResourceFork:.*map/i, `mapLength=${length}`);
});

test('Pascal name length and contents cannot escape the declared map', () => {
  for (const length of [50, 51, 52]) {
    const bytes = forkOf([{ type: 'cinf', id: 0, name: 'AB', data: Uint8Array.of(7) }]);
    assert.throws(() => parseResourceFork(withLength(bytes, 12, length)), /parseResourceFork:.*map/i, `mapLength=${length}`);
  }
});

test('section-relative offsets cannot borrow readable bytes from another section or file tail', () => {
  const bytes = providerFork(0), v = view(bytes), map = v.getUint32(4);
  // Ref starts map+38; resource data offset22 points at the map's zero header.
  bytes[map + 38 + 7] = 22;
  assert.throws(() => parseResourceFork(bytes), /parseResourceFork:.*data/i);
  const tail = new Uint8Array(bytes.length + 2); tail.set(providerFork(0));
  view(tail).setUint16(map + 24, 50); view(tail).setUint16(map + 50, 0xffff);
  assert.throws(() => parseResourceFork(tail), /parseResourceFork:.*map/i);
});

test('empty sentinels, zero-byte payloads, unnamed map-end pointer and byteOffset views stay valid', () => {
  assert.deepEqual(parseResourceFork(forkOf([])), []);
  const empty = forkOf([{ type: 'TEST', id: -7, data: new Uint8Array() }]);
  assert.deepEqual(parseResourceFork(empty), [{ type: 'TEST', id: -7, name: '', attributes: 0, data: new Uint8Array() }]);
  const noRefs = providerFork(0), v = view(noRefs), map = v.getUint32(4);
  v.setUint16(map + 30 + 4, 0xffff);
  assert.deepEqual(parseResourceFork(noRefs), []);
  const named = forkOf([{ type: 'TEST', id: 4, name: 'AB', data: Uint8Array.of(5, 6) }]);
  const backing = new Uint8Array(named.length + 13); backing.set(named, 7);
  assert.deepEqual(parseResourceFork(backing.subarray(7, 7 + named.length)), parseResourceFork(named));
});
