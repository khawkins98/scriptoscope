import test from 'node:test';
import assert from 'node:assert/strict';
import { readInventory } from './validate-source.mjs';
import { compareAvailability } from './compare.mjs';
// Unit observations exercise the independent comparator without invoking a renderer.
const expected = id => {
  const c = readInventory().inventory.cases.find(c => c.id === id);
  return { ...c, reviewStatus: 'reviewed', effectiveAvailability: c.proposed?.outcome ?? 'unknown' };
};
const observation = c => ({ caseId: c.id, options: c.options, result: { kind: 'themed', width: 80, height: 28 },
  owners: Object.fromEntries(c.proposed.paint.map(p => [p.ownerId, `fixture://${p.ownerId}`])),
  traces: [{ version: 1, correlationId: c.id, family: c.family, requested: { state: c.options.disabled ? 'inactive' : c.options.pressed ? 'pressed' : 'active', pressed: Boolean(c.options.pressed), disabled: Boolean(c.options.disabled), default: Boolean(c.options.default), on: Boolean(c.options.on), small: Boolean(c.options.small) }, outcome: { status: 'themed', width: 80, height: 28 },
    steps: [...c.proposed.paint.map(p => ({ role: p.role, action: 'selected', usage: 'paint',
      owner: { baseUrl: `fixture://${p.ownerId}`, chainDepth: p.chainDepth },
      resource: { type: p.type, signedId: p.signedId, sourceCinfId: p.sourceCinfId, manifestKey: p.manifestKey, assetUrl: 'blob:volatile' } })), ...(c.proposed.requiredDecisions ?? [])] }] });
test('equal source and built null does not pass a known-themed expectation', () => {
  const c = expected('windows-95.push.normal');
  const sharedNull = { caseId: c.id, options: c.options, result: { kind: 'unavailable' }, traces: [{ version: 1, correlationId: c.id, family: c.family, requested: { state: c.options.disabled ? 'inactive' : c.options.pressed ? 'pressed' : 'active', pressed: Boolean(c.options.pressed), disabled: Boolean(c.options.disabled), default: Boolean(c.options.default), on: Boolean(c.options.on), small: Boolean(c.options.small) }, outcome: { status: 'unavailable' }, steps: [] }] };
  for (const _mode of ['source', 'built']) assert.equal(compareAvailability(c, sharedNull).status, 'failed');
});
test('same signed IDs under a competing key or wrong owner/depth cannot pass', () => {
  const c = expected('windows-95.push.normal');
  assert.equal(compareAvailability(c, observation(c)).status, 'passed');
  for (const mutate of [o => o.traces[0].steps[0].resource.manifestKey = 'competing-key', o => o.traces[0].steps[0].owner.baseUrl = 'fixture://base', o => o.traces[0].steps[0].owner.chainDepth = 1, o => o.traces[0].steps[0].resource.signedId = -10238, o => o.traces[0].steps[0].resource.sourceCinfId = null]) {
    const o = observation(c); mutate(o); assert.equal(compareAvailability(c, o).status, 'failed');
  }
});
test('ring reservation cannot stand in for a painted ring or mask a missing fallback decision', () => {
  const c = expected('windows-95.default.pressed'), o = observation(c);
  assert.equal(compareAvailability(c, o).status, 'passed');
  o.traces[0].steps.find(step => step.role === 'default-ring').usage = 'layout-reservation';
  assert.equal(compareAvailability(c, o).status, 'failed');
  const noFallback = observation(c); noFallback.traces[0].steps = noFallback.traces[0].steps.filter(step => step.action !== 'fallback');
  assert.equal(compareAvailability(c, noFallback).status, 'failed');
});
test('unknown signed metadata cannot be replaced by canonical request ID', () => {
  const c = expected('synthetic.named-unknown-id'), o = observation(c);
  assert.equal(compareAvailability(c, o).status, 'passed');
  o.traces[0].steps[0].resource.signedId = -10239;
  assert.equal(compareAvailability(c, o).status, 'failed');
});
test('UNKNOWN and unreviewed cases remain non-passing, and missing executions remain not run', () => {
  const unknown = expected('synthetic.raw-repurposed-only');
  assert.equal(compareAvailability(unknown, { result: { kind: 'themed' } }).status, 'unknown');
  const draft = { ...readInventory().inventory.cases[0], reviewStatus: 'draft-requires-independent-review', effectiveAvailability: 'unknown' };
  assert.equal(compareAvailability(draft, observation(draft)).status, 'unknown');
  assert.equal(compareAvailability(expected('windows-95.push.normal'), null).status, 'not-run');
});
test('matching harness options cannot conceal wrong actual trace state or flags', () => {
  const c = expected('windows-95.push.normal');
  for (const mutate of [o => o.traces[0].requested.state = 'pressed', o => o.traces[0].requested.default = true, o => o.traces[0].requested.disabled = true]) {
    const o = observation(c); mutate(o); assert.equal(compareAvailability(c, o).status, 'failed');
  }
});
