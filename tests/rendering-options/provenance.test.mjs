import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { compareByteProvenance } from '../resource-provenance/compare.mjs';
import { enumerateForks, selectFork, sha256 } from '../control-availability/source.mjs';
import { parseResourceFork } from '../../tools/theme-loader/resource-fork.js';
const patterns = JSON.parse(readFileSync(new URL('../resource-provenance/body-pattern-pins.json', import.meta.url))).themes;
const sources = JSON.parse(readFileSync(new URL('../control-availability/source-candidates.json', import.meta.url))).themes;
const choices = JSON.parse(readFileSync(new URL('../control-availability/source-choices.json', import.meta.url))).sources;

test('body pattern pins bind exact independently selected raw occurrences', async () => {
  for (const p of patterns) {
    const choice = choices.find(c => c.slug === p.slug), bytes = readFileSync(new URL(`../../${choice.path}`, import.meta.url));
    const fork = selectFork(bytes, await enumerateForks(bytes, choice.format), choice);
    assert.equal(sha256(bytes), p.archiveSha256); assert.equal(sha256(fork.bytes), p.forkSha256);
    const resources = parseResourceFork(fork.bytes);
    for (const pin of p.candidates) {
      assert.equal(resources.filter(r => r.type === pin.type && r.id === pin.signedId).length, 1);
      const raw = resources[pin.resourceIndex];
      assert.equal(raw.type, pin.type); assert.equal(raw.id, pin.signedId);
      assert.equal(raw.data.length, pin.byteLength); assert.equal(sha256(raw.data), pin.payloadSha256);
    }
  }
});

test('typed pattern joins reject wrong load, owner, type, occurrence and payload', () => {
  const p = patterns[0], source = sources.find(s => s.slug === p.slug), pin = p.candidates[0];
  const key = `ppat-${pin.signedId}`, baseUrl = `/themes/${p.slug}`;
  const expected = { type: 'ppat', signedId: pin.signedId, sourceCinfId: null, manifestKey: key, baseUrl, chainDepth: 0, role: 'body-fill', usage: 'paint' };
  const fourCC = s => [...s].reduce((v, c) => (v * 256 + c.charCodeAt(0)) >>> 0, 0);
  const loaded = { baseUrl, byteProvenance: { version: 1, loadId: 'owned-load', input: source.archive,
    fork: { sha256: p.forkSha256, byteLength: source.selectedFork.byteLength, selection: { ...source.selectedFork,
      policy: 'largest-non-icon-resource-fork', fileType: fourCC(source.selectedFork.fileType), creator: fourCC(source.selectedFork.creator) } },
    resources: [{ ...pin, sha256: pin.payloadSha256, status: 'decoded' }] } };
  const step = { action: 'selected', usage: 'paint', role: 'body-fill', owner: { baseUrl, chainDepth: 0 },
    resource: { ...expected, byteProvenance: { loadId: 'owned-load', manifestKey: key, ppatResourceIndex: pin.resourceIndex } } };
  const joined = { ...source, candidates: [...source.candidates, ...p.candidates] };
  assert.equal(compareByteProvenance(step, loaded, joined, expected).status, 'passed');
  for (const mutate of [
    (s) => { s.resource.byteProvenance.loadId = 'other'; },
    (s) => { s.owner.baseUrl = '/other'; },
    (s) => { s.usage = 'layout-reservation'; },
    (s) => { s.resource.type = 'cicn'; },
    (s) => { s.resource.byteProvenance.ppatResourceIndex++; },
    (s, l) => { l.byteProvenance.resources[0].sha256 = 'wrong'; },
    (s, l) => { l.byteProvenance.fork.sha256 = 'wrong'; },
    (s, l) => { l.byteProvenance.resources[0].status = 'failed'; },
    (s, l) => { l.byteProvenance.resources.push(l.byteProvenance.resources[0]); },
    (s, l, j) => { j.candidates.push(pin); },
  ]) {
    const s = structuredClone(step), l = structuredClone(loaded), j = structuredClone(joined); mutate(s, l, j);
    assert.equal(compareByteProvenance(s, l, j, expected).status, 'failed');
  }
  assert.equal(compareByteProvenance(step, { baseUrl }, joined, expected).status, 'unknown');
});
