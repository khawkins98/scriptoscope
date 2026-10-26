import '../tests/helpers/registerTs.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
const { WindowManager } = await import('./interactive.ts');

function fixture(states = [true, false]) {
  const manager = new WindowManager(), requests = [], commits = [];
  const windows = states.map(active => ({ active, z: 0, renderEpoch: 0, theme: {}, opts: {}, host: { style: {}, isConnected: true } }));
  manager.windows = windows;
  manager.prepareRender = (entry, theme) => new Promise(resolve => requests.push({ entry, active: entry.active, theme, resolve }));
  manager.commitRender = (entry, prepared) => commits.push({ entry, active: prepared.active, theme: prepared.theme });
  const finish = async request => { request.resolve({ active: request.active, theme: request.theme }); await new Promise(resolve => setImmediate(resolve)); };
  return { manager, windows, requests, commits, finish };
}

test('rapid focus changes publish one active window before asynchronous preparation', async () => {
  const { manager, windows: [a, b], requests, commits, finish } = fixture();
  const first = manager.focus(b);
  assert.deepEqual([a.active, b.active], [false, true]);
  const second = manager.focus(a);
  assert.deepEqual([a.active, b.active], [true, false]);
  await finish(requests[2]);
  await finish(requests[3]);
  await second;
  await finish(requests[0]);
  await finish(requests[1]);
  await first;
  assert.deepEqual([a.active, b.active], [true, false]);
  assert.deepEqual(commits.map(({ entry, active }) => [entry === a ? 'a' : 'b', active]), [['a', true], ['b', false]]);
});

test('removed windows cannot commit a pending focus render', async () => {
  const { manager, windows: [a, b], requests, commits, finish } = fixture();
  const pending = manager.focus(b);
  manager.windows.splice(0, 1);
  await finish(requests[0]);
  await finish(requests[1]);
  await pending;
  assert.equal(commits.some(c => c.entry === a), false);
  assert.deepEqual(commits.map(c => [c.entry === b, c.active]), [[true, true]]);
});

test('clicking the active window raises it without preparing chrome', async () => {
  const { manager, windows: [a], requests } = fixture();
  await manager.focus(a);
  assert.equal(requests.length, 0);
  assert.ok(Number(a.host.style.zIndex) > 100000);
});


test('a superseding three-window focus cannot strand an inactive window with active chrome', async () => {
  const { manager, windows: [a, b, c], requests, commits, finish } = fixture([false, false, true]);
  const first = manager.focus(b), second = manager.focus(a);
  assert.deepEqual([a.active, b.active, c.active], [true, false, false]);
  assert.equal(requests.length, 4);
  await finish(requests[2]);
  await finish(requests[3]);
  await second;
  await finish(requests[0]);
  await finish(requests[1]);
  await first;
  assert.deepEqual(commits.map(({ entry, active }) => [entry === a ? 'a' : entry === b ? 'b' : 'c', active]),
    [['a', true], ['b', false], ['c', false]]);
});


test('events from a removed host cannot deactivate managed windows', async () => {
  const { manager, windows: [a, b], requests } = fixture();
  manager.windows.splice(1, 1);
  await manager.focus(b);
  assert.equal(a.active, true);
  assert.equal(requests.length, 0);
});

test('a held focus render cannot overwrite a completed retheme', async () => {
  const { manager, windows: [a, b], requests, commits, finish } = fixture();
  const pending = manager.focus(b), theme = {};
  const retheme = manager.retheme(theme);
  await finish(requests[2]);
  await finish(requests[3]);
  await retheme;
  await finish(requests[0]);
  await finish(requests[1]);
  await pending;
  assert.deepEqual([a.active, b.active], [false, true]);
  assert.equal(commits.length, 2);
  assert.ok(commits.every(c => c.theme === theme));
  assert.ok(manager.windows.every(w => w.theme === theme));
});
