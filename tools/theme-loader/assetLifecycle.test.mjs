import { test } from 'node:test';
import assert from 'node:assert/strict';

// Query suffixes instantiate separate ESM copies, like the bundled runtime and
// separately deployed raw loader. They must still share URL-release events.
const bundled = await import('./assetLifecycle.js?bundled');
const raw = await import('./assetLifecycle.js?raw');

test('release listeners communicate across module copies, unsubscribe, and isolate failures', (t) => {
  const calls = [];
  const stopBundled = bundled.onAssetUrlReleased((url) => calls.push(['bundled', url]));
  const stopThrowing = raw.onAssetUrlReleased(() => { throw new Error('subscriber failed'); });
  const stopRaw = raw.onAssetUrlReleased((url) => calls.push(['raw', url]));
  t.after(() => { stopBundled(); stopThrowing(); stopRaw(); });
  raw.notifyAssetUrlReleased('blob:first');
  assert.deepEqual(calls, [['bundled', 'blob:first'], ['raw', 'blob:first']]);
  stopBundled();
  stopBundled();
  bundled.notifyAssetUrlReleased('blob:second');
  assert.deepEqual(calls.at(-1), ['raw', 'blob:second']);
  assert.equal(calls.length, 3);
  stopThrowing();
  stopRaw();
  raw.notifyAssetUrlReleased('blob:third');
  assert.equal(calls.length, 3);
});
