import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { evaluateCinfLookup as lookup } from './cinf-lookup-contract.mjs';
const record = (id, occurrence = 0) => ({ id, occurrence, sha256: createHash('sha256').update(`owned synthetic cinf identity ${id}/${occurrence}`).digest('hex') });
const provider = (id, resources, complete = true) => ({ id, resources, complete });
const environment = (...providers) => ({ complete: true, providers });
const request = { requestedId: -10239, body: true };
test('same-ID success admits metadata from the explicitly selected provider, not the cicn owner', () => {
  const result = lookup({ ...request, environment: environment(provider('configured-art', [record(0)]), provider('declared-base', [record(-10239, 7)])) });
  assert.deepEqual(result.attempts.map(a => [a.id, a.outcome]), [[-10239, 'found']]);
  assert.deepEqual(result.selected, { provider: 'declared-base', occurrence: 7, sha256: record(-10239, 7).sha256 });
  assert.equal(result.status, 'metadata-admitted'); assert.equal(result.pixelResult, 'unknown');
});
test('explicit NULL retries body default0 or ring default1 across declared providers', () => {
  const env = environment(provider('art', []), provider('defaults', [record(0, 2), record(1, 3)]));
  for (const [body, id, occurrence] of [[true, 0, 2], [false, 1, 3]]) {
    const r = lookup({ ...request, body, environment: env });
    assert.deepEqual(r.attempts.map(a => [a.id, a.outcome]), [[-10239, 'missing'], [id, 'found']]);
    assert.deepEqual(r.selected, { provider: 'defaults', occurrence, sha256: record(id, occurrence).sha256 });
  }
});
test('two explicit misses skip this body/border stage; coincident IDs are not deduplicated', () => {
  for (const [body, id] of [[true, 0], [false, 1]]) {
    const r = lookup({ requestedId: id, body, environment: environment(provider('empty', [])) });
    assert.deepEqual(r.attempts.map(a => [a.id, a.outcome]), [[id, 'missing'], [id, 'missing']]);
    assert.equal(r.status, 'no-body-or-border'); assert.equal(r.pixelResult, 'body-border-stage-skipped');
  }
  const selected = { provider: 'changed-between-calls', occurrence: 4, sha256: record(0, 4).sha256 };
  const r = lookup({ requestedId: 0, body: true, transcript: [{ id: 0, outcome: 'missing' }, { id: 0, outcome: 'found', resource: selected }] });
  assert.deepEqual(r.selected, selected); assert.equal(r.attempts.length, 2);
});
test('incomplete environment/provider and duplicate occurrences stay unknown without fallback', () => {
  const declarations = [
    { complete: false, providers: [provider('partial-list', [])] },
    { complete: false, providers: [provider('partial-list-with-match', [record(-10239)])] },
    environment(provider('unknown-priority-provider', [], false), provider('lower', [record(-10239)])),
    environment(provider('partial-provider-with-match', [record(-10239)], false)),
    environment(provider('duplicate', [record(-10239, 1), record(-10239, 2)])),
  ];
  for (const env of declarations) {
    const r = lookup({ ...request, environment: env });
    assert.equal(r.status, 'unknown'); assert.equal(r.attempts.length, 1); assert.equal(r.selected, undefined);
  }
  const r = lookup({ ...request, transcript: [{ id: -10239, outcome: 'missing' }, { id: 0, outcome: 'ambiguous' }] });
  assert.equal(r.status, 'unknown'); assert.equal(r.attempts.length, 2);
});
test('caller-declared provider order changes selection, never becomes a historical search-order assertion', () => {
  const a = provider('a', [record(-10239, 1)]), b = provider('b', [record(-10239, 2)]);
  assert.equal(lookup({ ...request, environment: environment(a, b) }).selected.provider, 'a');
  assert.equal(lookup({ ...request, environment: environment(b, a) }).selected.provider, 'b');
});
test('transcripts reject wrong attempts, unreachable continuation and unsupported identity claims', () => {
  const found = { id: -10239, outcome: 'found', resource: { provider: 'p', occurrence: 0, sha256: record(-10239).sha256 } };
  for (const transcript of [[], [{ id: 0, outcome: 'missing' }], [found, { id: 0, outcome: 'missing' }],
    [{ id: -10239, outcome: 'unknown' }, { id: 0, outcome: 'found', resource: found.resource }],
    [{ ...found, resource: { ...found.resource, sha256: 'unbound' } }], [{ id: -10239, outcome: 'missing', resource: found.resource }]])
    assert.throws(() => lookup({ ...request, transcript }), TypeError);
  assert.throws(() => lookup({ ...request, environment: environment(), transcript: [] }), TypeError);
  assert.throws(() => lookup({ ...request, environment: { providers: [] } }), TypeError);
});
