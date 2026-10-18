import '../tests/helpers/registerTs.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
const { loadCicnBuffer } = await import('./cicnImage.ts');

test('failed image decodes are retryable; pending and successful loads are shared', async (t) => {
  const previous = { Image: globalThis.Image, document: globalThis.document };
  t.after(() => Object.assign(globalThis, previous));
  let decodes = 0;
  globalThis.Image = class {
    naturalWidth = 1;
    naturalHeight = 1;
    async decode() { if (++decodes === 1) throw new Error('temporary decode failure'); }
  };
  globalThis.document = { createElement: () => ({ getContext: () => ({
    drawImage() {}, getImageData: () => ({ data: new Uint8ClampedArray([1, 2, 3, 255]) }),
  }) }) };
  const pending = loadCicnBuffer('blob:retry-test');
  assert.equal(loadCicnBuffer('blob:retry-test'), pending);
  await assert.rejects(pending, /temporary decode/);
  const buffer = await loadCicnBuffer('blob:retry-test');
  assert.equal(buffer.width, 1);
  assert.equal(await loadCicnBuffer('blob:retry-test'), buffer);
  assert.equal(decodes, 2);
});
