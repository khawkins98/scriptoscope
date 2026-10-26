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

test('theme disposal evicts only its raster URLs, including pending entries', async (t) => {
  const { readFile } = await import('node:fs/promises');
  const { loadKaleidoscopeScheme } = await import('../tools/theme-loader/loadKaleidoscopeScheme.js');
  const bytes = await readFile(new URL('../themes/1138/scheme.rsrc', import.meta.url));
  const previous = { Image: globalThis.Image, document: globalThis.document };
  t.after(() => Object.assign(globalThis, previous));
  t.mock.method(URL, 'revokeObjectURL', () => {});
  let rejectOld;
  let decodes = 0;
  globalThis.Image = class {
    naturalWidth = 1;
    naturalHeight = 1;
    decode() {
      decodes++;
      if (this.src === 'blob:released' && decodes === 2) return new Promise((_resolve, reject) => { rejectOld = reject; });
      return Promise.resolve();
    }
  };
  globalThis.document = { createElement: () => ({ getContext: () => ({
    drawImage() {}, getImageData: () => ({ data: new Uint8ClampedArray([1, 2, 3, 255]) }),
  }) }) };
  const borrowed = await loadCicnBuffer('blob:borrowed');
  const theme = await loadKaleidoscopeScheme(bytes, { encodeAssets: true, assetUrlFactory: () => 'blob:released' });
  const old = loadCicnBuffer('blob:released');
  theme.dispose();
  const replacement = loadCicnBuffer('blob:released');
  assert.notEqual(replacement, old);
  rejectOld(new Error('disposed while decoding'));
  await assert.rejects(old, /disposed while decoding/);
  assert.equal(loadCicnBuffer('blob:released'), replacement, 'late rejection cannot evict a replacement');
  await replacement;
  assert.equal(await loadCicnBuffer('blob:borrowed'), borrowed, 'unrelated raster remains cached');
  assert.equal(decodes, 3);
  const completedTheme = await loadKaleidoscopeScheme(bytes, { encodeAssets: true, assetUrlFactory: () => 'blob:completed' });
  const completed = await loadCicnBuffer('blob:completed');
  completedTheme.dispose();
  assert.notEqual(await loadCicnBuffer('blob:completed'), completed, 'completed raster is evicted too');
  assert.equal(decodes, 5);
});

test('size-only raster consumers do not require canvas-readable image pixels', async t => {
  const { rasterDimensions } = await import('./cicnImage.ts');
  const previous = { Image: globalThis.Image, document: globalThis.document };
  t.after(() => Object.assign(globalThis, previous));
  globalThis.Image = class {
    naturalWidth = 7; naturalHeight = 5;
    async decode() { assert.equal(this.src, 'https://external.test/pattern.png'); }
  };
  globalThis.document = { createElement() { throw new Error('Cross-origin pixels cannot be read'); } };
  assert.deepEqual(await rasterDimensions('https://external.test/pattern.png'), { width: 7, height: 5 });
});
