import test from 'node:test';
import assert from 'node:assert/strict';
import { describeConversion, serialize } from './generate.mjs';
import { forkOf, onePixelCicn, cinf } from '../resource-provenance/fixtures.mjs';

test('all raw occurrences survive duplicate IDs, malformed decoder inputs and unsupported types', () => {
  const bytes = forkOf([
    { type: 'cicn', id: -9, name: 'first', data: onePixelCicn() },
    { type: 'cicn', id: -9, name: 'second', data: onePixelCicn(0x1010) },
    { type: 'cinf', id: -9, data: cinf() },
    { type: 'cicn', id: 9, data: new Uint8Array([1, 2]) },
    { type: 'TEST', id: 0, data: new Uint8Array([3, 4, 5]) },
  ]);
  const result = describeConversion(bytes);
  assert.equal(result.status, 'converted');
  assert.equal(result.resources.length, 5);
  assert.deepEqual(result.resources.slice(0, 2).map(r => r.duplicateOccurrences), [[0, 1], [0, 1]]);
  assert.notEqual(result.resources[0].sha256, result.resources[1].sha256);
  assert.equal(result.resources[3].conversion.status, 'error');
  assert.equal(result.resources[4].conversion.status, 'skipped');
  assert.deepEqual(result.catalogs.chromeElements.map(c => c.occurrences), [
    [{ role: 'cicnResourceIndex', resourceIndex: 0 }, { role: 'cinfResourceIndex', resourceIndex: 2 }],
    [{ role: 'cicnResourceIndex', resourceIndex: 1 }, { role: 'cinfResourceIndex', resourceIndex: 2 }],
  ]);
});

test('duplicate asset paths retain both occurrences rather than invent unique ownership', () => {
  const result = describeConversion(forkOf([0xffff, 0x1234].map(red => ({ type: 'cicn', id: 7, name: 'same', data: onePixelCicn(red) }))));
  assert.equal(result.status, 'converted');
  assert.deepEqual(result.resources[0].assetPaths, result.resources[1].assetPaths);
  assert.equal(result.catalogs.chromeElements.length, 2);
  assert.deepEqual(result.catalogs.chromeElements.map(c => c.occurrences[0].resourceIndex), [0, 1]);
});

test('icon policy records skipped short/duplicate inputs and actual first mask separately', () => {
  const resources = [new Uint8Array(1), new Uint8Array(256), new Uint8Array(256)].map(data => ({ type: 'ics8', id: 0, data }));
  resources.push({ type: 'ics#', id: 0, data: new Uint8Array(64).fill(255) });
  const result = describeConversion(forkOf(resources));
  assert.deepEqual(result.resources.slice(0, 3).map(r => r.iconConversion.status), ['skipped-short-payload', 'emitted', 'skipped-duplicate-after-emission']);
  assert.equal(result.icons[0].resourceIndex, 1);
  assert.equal(result.icons[0].maskResourceIndex, 3);
});

test('compact serialization preserves nulls, duplicate rows and nested bindings', () => {
  const value = { resources: [['a', -1, null, ['key']], ['a', -1, null, []]], binding: { empty: [] } };
  assert.deepEqual(JSON.parse(serialize(value)), value);
});
