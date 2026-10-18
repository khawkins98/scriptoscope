import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { solidPins } from './solid-cases.mjs';
import { solidBackgroundIcon, solidBackgroundInfo } from '../decoder-fixtures/solid-background.mjs';
import { forkOf } from '../resource-provenance/fixtures.mjs';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
test('serialized solid fixtures retain independently reviewed payload and raw-map identities', () => {
  const info = solidBackgroundInfo();
  assert.equal(Buffer.from(info).toString('hex'), solidPins.cinf.hex);
  assert.equal(hash(info), solidPins.cinf.sha256);
  for (const pin of solidPins.cases) {
    const icon = solidBackgroundIcon({ collision: pin.collision, opaqueBackground: pin.collision });
    assert.equal(icon.length, pin.cicnBytes); assert.equal(hash(icon), pin.cicnSha256);
    const bytes = forkOf([-10239, -10238, -10240, -10166, -10165, -10167].flatMap(id => [
      { type: 'cicn', id, data: icon }, { type: 'cinf', id, data: info },
    ]));
    assert.equal(bytes.length, pin.forkBytes); assert.equal(hash(bytes), pin.forkSha256);
  }
});
