// Implementation-owned unit checks derived only from docs/spec/engine/window-widgets.md
// (§2.3, WD9, WD11, HT7) and hit-regions.md HP48.
import test from 'node:test';
import assert from 'node:assert/strict';
import '../../../tests/helpers/registerTs.mjs';
const { probeWidgetStrip, widgetCicnIds } = await import('./window.ts');
const { ResourceChain, mapProvider } = await import('../resources/chain.ts');

const fork = ids => new ResourceChain([mapProvider('synthetic', 'archive', ids.map(id => [`cicn:${id}`, { id }]))]);

test('WD11/WD9: the base id, plus the sideTitle retry base - 8 (altWidgets clear: no +8)', () => {
  assert.deepEqual(widgetCicnIds(), [-14330]);
  assert.deepEqual(widgetCicnIds({ sideTitle: false }), [-14330]);
  assert.deepEqual(widgetCicnIds({ sideTitle: true }), [-14330, -14338]);
});

test('WD9/HT7: a side-titled type retries -14338 when -14330 is absent; a top-titled type does not', () => {
  const onlyRetry = fork([-14338]);
  const side = probeWidgetStrip(onlyRetry, { sideTitle: true });
  assert.equal(side?.id, -14338);
  assert.equal(probeWidgetStrip(onlyRetry, { sideTitle: false }), null);
  // -14330 present: both axes take it first.
  const both = fork([-14330, -14338]);
  assert.equal(probeWidgetStrip(both, { sideTitle: true })?.id, -14330);
  assert.equal(probeWidgetStrip(both, { sideTitle: false })?.id, -14330);
  assert.equal(probeWidgetStrip(fork([]), { sideTitle: true }), null);
});
