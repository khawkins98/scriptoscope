import test from 'node:test';
import assert from 'node:assert/strict';
import { withControlDiagnostics } from './controlDiagnostics.ts';

const requested = { state: 'active', pressed: false, disabled: false, default: false };
test('diagnostics preserve the returned object and disabled tracing creates no collector', async () => {
  const pixels = { width: 12, height: 20 }, collectors = [];
  for (const diagnostics of [undefined, { onComplete() {} }]) {
    assert.equal(await withControlDiagnostics(diagnostics, 'push-button', { ...requested }, async collector => {
      collectors.push(collector); return pixels;
    }), pixels);
  }
  assert.equal(collectors[0], undefined);
  assert.equal(typeof collectors[1].record, 'function');
});

test('diagnostic completion preserves primary errors and calls once', async () => {
  const rendererError = new Error('renderer'), callbackError = new Error('callback');
  for (const renderFails of [false, true]) for (const callbackFails of [false, true]) {
    let calls = 0, trace;
    const result = withControlDiagnostics({ onComplete: value => {
      calls++; trace = value; if (callbackFails) throw callbackError;
    } }, 'push-button', { ...requested }, async () => {
      if (renderFails) throw rendererError;
      return null;
    });
    if (renderFails || callbackFails) await assert.rejects(result, error => error === (renderFails ? rendererError : callbackError));
    else assert.equal(await result, null);
    assert.equal(calls, 1);
    assert.equal(trace.outcome.status, renderFails ? 'error' : 'unavailable');
  }
});

test('shared callback receives isolated frozen completion records in completion order', async () => {
  let release;
  const barrier = new Promise(resolve => { release = resolve; });
  const records = [], onComplete = trace => records.push(trace);
  const first = withControlDiagnostics({ onComplete, correlationId: 'first' }, 'push-button', { ...requested }, async collector => {
    collector.record({ role: 'face', requestedId: -10239, action: 'missing', reason: 'missing-resource', basis: 'source-dispatch', usage: 'paint' });
    await barrier; return null;
  });
  const second = await withControlDiagnostics({ onComplete, correlationId: 'second' }, 'bevel-button', { ...requested }, async () => ({ width: 12, height: 20 }));
  release(); await first;
  assert.equal(second.width, 12);
  assert.deepEqual(records.map(t => t.correlationId), ['second', 'first']);
  assert.deepEqual(records.map(t => t.steps.length), [0, 1]);
  assert.notEqual(records[0].steps, records[1].steps);
  assert.equal(Object.isFrozen(records[1].steps[0]), true);
  assert.equal(Object.isFrozen(records[1].requested), true);
  assert.throws(() => records[1].steps.push({}), TypeError);
});
