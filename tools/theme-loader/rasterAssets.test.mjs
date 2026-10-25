import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRasterAssetOwner, decodedRaster, materializeRasterImage } from './rasterAssets.js';
const asset = (rgba, path = 'face') => ({ path, width: rgba.length / 4, height: 1, rgba: new Uint8Array(rgba) });
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };

test('owned pixels share storage across module copies without image work and normalize transparent RGB', async t => {
  const raw = await import('./rasterAssets.js?separately-deployed');
  const a = asset([21, 34, 55, 255, 89, 144, 233, 0]);
  let encodes = 0;
  const owner = createRasterAssetOwner([a], () => { encodes++; return 'blob:pixel-owner'; });
  t.after(owner.dispose);
  const ref = owner.references.get('face');
  const pixels = raw.decodedRaster(ref);
  assert.equal(pixels.data.buffer, a.rgba.buffer);
  assert.deepEqual([...pixels.data], [21, 34, 55, 255, 0, 0, 0, 0]);
  assert.equal(decodedRaster(ref), pixels);
  assert.equal(encodes, 0);
  assert.equal(await materializeRasterImage(ref), 'blob:pixel-owner');
  assert.equal(await owner.imageUrl('face'), 'blob:pixel-owner');
  assert.equal(encodes, 1);
  owner.dispose();
  assert.equal(raw.decodedRaster(ref), undefined);
  await assert.rejects(materializeRasterImage(ref), { name: 'AbortError' });
  assert.deepEqual(owner.usage(), { rasters: 0, pixelBytes: 0, images: 0, pending: 0 });
});

test('fractional alpha retains browser readback and releases redundant pixels after image materialization', async t => {
  const a = asset([21, 34, 55, 128, 89, 144, 233, 0]);
  const before = a.rgba.slice();
  const owner = createRasterAssetOwner([a], () => 'blob:fractional'); t.after(owner.dispose);
  assert.equal(decodedRaster(owner.references.get('face')), undefined);
  assert.deepEqual(a.rgba, before);
  await owner.imageUrl('face');
  assert.equal(owner.usage().pixelBytes, 0);
});

test('image-first fractional exports also release redundant input on pixel preparation', async t => {
  const owner = createRasterAssetOwner([asset([1, 2, 3, 128])], () => 'blob:image-first');
  t.after(owner.dispose);
  const ref = owner.references.get('face');
  await owner.imageUrl(ref);
  assert.equal(decodedRaster(ref), undefined);
  assert.equal(owner.usage().pixelBytes, 0);
});

test('custom output is authoritative; aliases revoke once and external URLs remain borrowed', async t => {
  const revoked = [];
  t.mock.method(URL, 'revokeObjectURL', url => revoked.push(url));
  const owner = createRasterAssetOwner([asset([1, 2, 3, 255]), asset([4, 5, 6, 255], 'other')], () => 'blob:custom', true);
  assert.equal(decodedRaster(owner.references.get('face')), undefined);
  await Promise.all([owner.imageUrl('face'), owner.imageUrl('other')]);
  owner.dispose(); owner.dispose();
  assert.deepEqual(revoked, ['blob:custom']);
  assert.equal(await materializeRasterImage('https://example.test/image.png'), 'https://example.test/image.png');
});

test('disposing one owner preserves a borrowed base owner', t => {
  const base = createRasterAssetOwner([asset([1, 2, 3, 255])], () => 'blob:base');
  const child = createRasterAssetOwner([asset([4, 5, 6, 255])], () => 'blob:child');
  t.after(base.dispose); t.after(child.dispose);
  const baseRef = base.references.get('face'), childRef = child.references.get('face');
  child.dispose();
  assert.equal(decodedRaster(childRef), undefined);
  assert.ok(decodedRaster(baseRef));
});

test('shared lazy work revokes late URLs after disposal without repopulating the owner', async t => {
  const held = deferred(), revoked = [];
  t.mock.method(URL, 'revokeObjectURL', url => revoked.push(url));
  const owner = createRasterAssetOwner([asset([1, 2, 3, 255])], () => held.promise);
  const first = owner.imageUrl('face'), second = owner.imageUrl('face');
  assert.equal(first, second);
  await Promise.resolve();
  assert.equal(owner.usage().pending, 1);
  owner.dispose();
  assert.equal(owner.usage().pixelBytes, 4, 'pending encoders still retain their input');
  held.resolve('blob:late');
  await assert.rejects(first, { name: 'AbortError' });
  assert.deepEqual(revoked, ['blob:late']);
  assert.deepEqual(owner.usage(), { rasters: 0, pixelBytes: 0, images: 0, pending: 0 });
  await assert.rejects(owner.imageUrl('face'), { name: 'AbortError' });
});

test('failed image requests can retry while the owner lives', async t => {
  let attempts = 0;
  const owner = createRasterAssetOwner([asset([1, 2, 3, 255])], () => { if (++attempts === 1) throw new Error('temporary encode failure'); return 'blob:retry'; });
  t.after(owner.dispose);
  await assert.rejects(owner.imageUrl('face'), /temporary encode failure/);
  assert.equal(await owner.imageUrl('face'), 'blob:retry');
  assert.equal(attempts, 2);
});

test('eager compatibility exports preserve duplicate path occurrences and last-result selection', async t => {
  const seen = [];
  const owner = createRasterAssetOwner([asset([1, 2, 3, 255]), asset([4, 5, 6, 255])], rgba => {
    seen.push([...rgba]); return `blob:occurrence-${seen.length}`;
  });
  t.after(owner.dispose);
  const images = await owner.imageUrls();
  assert.deepEqual(seen, [[1, 2, 3, 255], [4, 5, 6, 255]]);
  assert.equal(images.get('face'), 'blob:occurrence-2');
  assert.equal(owner.usage().rasters, 2);
});
