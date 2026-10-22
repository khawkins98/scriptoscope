import '../../../tests/helpers/registerTs.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { normalizeControlState } = await import('./control.ts');
const { normalizeWindowState } = await import('./window.ts');
const { SCROLLBAR_PRESSED_PARTS } = await import('../tables/controlState.ts');

test('DECISIONS #4 scroll-bar mapping: state + pressedPart → hilite', () => {
  const h = (input) => normalizeControlState(input, SCROLLBAR_PRESSED_PARTS).hilite;
  assert.equal(h({}), 0);
  assert.equal(h({ state: 'normal' }), 0);
  assert.equal(h({ state: 'inactive' }), 254);
  assert.equal(h({ state: 'disabled' }), 255);
  assert.deepEqual(['up', 'down', 'pageUp', 'pageDown', 'thumb'].map(p => h({ state: 'pressed', pressedPart: p })), [20, 21, 22, 23, 129]);
  assert.equal(h({ state: 'pressed' }), 129, 'pressed without a part means thumb');
  const n = normalizeControlState({ state: 'pressed' }, SCROLLBAR_PRESSED_PARTS);
  assert.equal(n.pressedPart, 'thumb');
  assert.deepEqual(n.rows, ['state-pressed', 'scrollbar-part-thumb']);
});

test('pressedPart is ignored unless pressed; unknown states and parts are input errors', () => {
  assert.deepEqual(normalizeControlState({ state: 'normal', pressedPart: 'up' }, SCROLLBAR_PRESSED_PARTS), { state: 'normal', pressedPart: null, hilite: 0, rows: ['state-normal'] });
  assert.throws(() => normalizeControlState({ state: 'pressed', pressedPart: 'left' }, SCROLLBAR_PRESSED_PARTS), /unknown scrollbar part/);
  assert.throws(() => normalizeControlState({ state: 'hover' }, SCROLLBAR_PRESSED_PARTS), /unknown state/);
});

test('window state defaults to active and expanded', () => {
  assert.deepEqual(normalizeWindowState(), { state: 'active', collapsed: false });
  assert.deepEqual(normalizeWindowState({ state: 'inactive', collapsed: true }), { state: 'inactive', collapsed: true });
  assert.throws(() => normalizeWindowState({ state: 'focused' }), /unknown state/);
});
