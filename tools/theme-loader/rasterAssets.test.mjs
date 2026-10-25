import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ownRasterAssets, decodedRaster } from './rasterAssets.js';
import { notifyAssetUrlReleased } from './assetLifecycle.js';

const asset = (rgba, path = 'face') => ({ path, width: rgba.length / 4, height: 1, rgba: new Uint8Array(rgba) });

test('owned opaque pixels share storage across module copies; transparent RGB matches Canvas', async (t) => {
  const raw = await import('./rasterAssets.js?separately-deployed');
  const a = asset([21, 34, 55, 255, 89, 144, 233, 0]);
  const dispose = ownRasterAssets(new Map([['face', 'blob:pixel-owner']]), [a]);
  t.after(dispose);
  const pixels = raw.decodedRaster('blob:pixel-owner');
  assert.equal(pixels.data.buffer, a.rgba.buffer);
  assert.deepEqual([...pixels.data], [21, 34, 55, 255, 0, 0, 0, 0]);
  assert.equal(decodedRaster('blob:pixel-owner'), pixels);
  dispose();
  assert.equal(raw.decodedRaster('blob:pixel-owner'), undefined);
});

test('fractional alpha uses image decoding without altering decoder input', (t) => {
  const a = asset([21, 34, 55, 128, 89, 144, 233, 0]);
  const before = a.rgba.slice();
  const dispose = ownRasterAssets(new Map([['face', 'blob:fractional']]), [a]);
  t.after(dispose);
  assert.equal(decodedRaster('blob:fractional'), undefined);
  assert.deepEqual(a.rgba, before);
});

test('custom images have no assumed input pixels; external URLs remain borrowed', (t) => {
  const revoked = [];
  t.mock.method(URL, 'revokeObjectURL', url => revoked.push(url));
  const dispose = ownRasterAssets(new Map([['first', 'blob:custom'], ['alias', 'blob:custom'], ['borrowed', 'https://example.test/image.png']]));
  assert.equal(decodedRaster('blob:custom'), undefined);
  dispose(); dispose();
  assert.deepEqual(revoked, ['blob:custom']);
});

test('releasing a child does not release a base; external release drops retained pixels', (t) => {
  const base = ownRasterAssets(new Map([['face', 'blob:base']]), [asset([1, 2, 3, 255])]);
  const child = ownRasterAssets(new Map([['face', 'blob:child']]), [asset([4, 5, 6, 255])]);
  t.after(base); t.after(child);
  child();
  assert.equal(decodedRaster('blob:child'), undefined);
  assert.ok(decodedRaster('blob:base'));
  notifyAssetUrlReleased('blob:base');
  assert.equal(decodedRaster('blob:base'), undefined);
});
