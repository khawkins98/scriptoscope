import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeRasterPng } from './encodeRasterPng.js';

for (const offscreen of [true, false]) {
  test(`PNG canvas shell copies pixels before asynchronous ${offscreen ? 'offscreen' : 'DOM'} encoding`, async () => {
    const rgba = new Uint8Array([10, 20, 30, 255]);
    let copied, finish;
    const blob = new Blob(['png']);
    const canvas = { getContext: () => ({
      createImageData: () => ({ data: new Uint8ClampedArray(4) }),
      putImageData: image => { copied = image.data; },
    }) };
    if (offscreen) canvas.convertToBlob = options => {
      assert.equal(options.type, 'image/png');
      return new Promise(resolve => { finish = () => resolve(blob); });
    };
    else canvas.toBlob = (callback, type) => {
      assert.equal(type, 'image/png');
      finish = () => callback(blob);
    };
    const pending = encodeRasterPng(canvas, rgba, 1, 1);
    rgba.fill(0);
    assert.deepEqual([...copied], [10, 20, 30, 255]);
    assert.equal(canvas.width, 1);
    assert.equal(canvas.height, 1);
    finish();
    assert.equal(await pending, blob);
  });
}

test('PNG shell rejects unavailable contexts and null DOM encodes', async () => {
  await assert.rejects(encodeRasterPng({ getContext: () => null }, new Uint8Array(4), 1, 1), /no 2d context/);
  const canvas = { getContext: () => ({ createImageData: () => ({ data: new Uint8ClampedArray(4) }), putImageData() {} }),
    toBlob: callback => callback(null) };
  await assert.rejects(encodeRasterPng(canvas, new Uint8Array(4), 1, 1), /canvas.toBlob returned null/);
});
