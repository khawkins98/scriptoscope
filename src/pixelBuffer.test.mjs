import '../tests/helpers/registerTs.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
const { PixelBuffer } = await import('./pixelBuffer.ts');

test('clipped alpha-over preserves straight-alpha rounding and transparent destination RGB', () => {
  const source = PixelBuffer.alloc(2, 2), target = PixelBuffer.alloc(3, 3);
  source.fillRect({ x: 0, y: 0, w: 2, h: 2 }, 100, 200, 80, 128);
  target.fillRect({ x: 0, y: 0, w: 3, h: 3 }, 20, 40, 60, 0);
  target.drawOver(source, 0, 0, { x: 1, y: 1, w: 1, h: 1 });
  assert.deepEqual(target.getPixel(1, 1), [60, 120, 70, 128]);
  for (const [x, y] of [[0, 0], [0, 1], [1, 0], [2, 1], [1, 2]])
    assert.deepEqual(target.getPixel(x, y), [20, 40, 60, 0]);
});

test('clipped alpha-over retains source order when source and destination alias', () => {
  const target = PixelBuffer.alloc(4, 1);
  for (let x = 0; x < 4; x++) target.setPixel(x, 0, x + 1, 0, 0, 255);
  target.drawOver(target, 1, 0, { x: 1, y: 0, w: 2, h: 1 });
  assert.deepEqual([0, 1, 2, 3].map(x => target.getPixel(x, 0)[0]), [1, 1, 1, 4]);
});

test('negative glyph origins clip in destination coordinates', () => {
  const source = PixelBuffer.alloc(2, 2), target = PixelBuffer.alloc(2, 2);
  source.setPixel(1, 1, 9, 8, 7, 255);
  target.drawOver(source, -1, -1, { x: 0, y: 0, w: 1, h: 1 });
  assert.deepEqual(target.getPixel(0, 0), [9, 8, 7, 255]);
  assert.deepEqual(target.getPixel(1, 1), [0, 0, 0, 0]);
});

test('constructor retains supplied data and instances share ordinary prototype methods', () => {
  const data = new Uint8ClampedArray(8), a = new PixelBuffer(2, 1, data), b = PixelBuffer.alloc(2, 1);
  assert.equal(a.data, data);
  assert.equal(Object.getPrototypeOf(a), PixelBuffer.prototype);
  for (const name of ['getPixel', 'setPixel', 'copyBits', 'drawOver', 'fillRect', 'nineSlice', 'toImageData']) {
    assert.equal(a[name], b[name]);
    assert.equal(a[name], PixelBuffer.prototype[name]);
  }
  data[0] = 17;
  assert.deepEqual(a.getPixel(0, 0), [17, 0, 0, 0]);
});

for (const method of ['copyBits', 'drawOver']) test(`${method} preserves traversal with shifted aliased typed-array views`, () => {
  for (const forward of [true, false]) {
    const data = new Uint8ClampedArray(20);
    for (let x = 0; x < 5; x++) data.set([x + 1, 0, 0, 255], x * 4);
    const source = new PixelBuffer(4, 1, data.subarray(forward ? 0 : 4, forward ? 16 : 20));
    const target = new PixelBuffer(4, 1, data.subarray(forward ? 4 : 0, forward ? 20 : 16));
    if (method === 'copyBits') target.copyBits(source, { x: 0, y: 0, w: 4, h: 1 }, { x: 0, y: 0, w: 4, h: 1 });
    else target.drawOver(source, 0, 0);
    assert.deepEqual([0, 1, 2, 3, 4].map(x => data[x * 4]), forward ? [1, 1, 1, 1, 1] : [2, 3, 4, 5, 5]);
  }
});


test('private canvas publication uses the exact view while public images remain snapshots', async () => {
  const { publishPixels, repaintControlCanvas } = await import('./canvasPublication.ts');
  const original = globalThis.ImageData;
  globalThis.ImageData = class {
    constructor(data, width, height) {
      if (typeof data === 'number') { height = width; width = data; data = new Uint8ClampedArray(width * height * 4); }
      Object.assign(this, { data, width, height });
    }
  };
  try {
    const backing = new Uint8ClampedArray(12); backing.set([1, 2, 3, 255], 4);
    const buffer = new PixelBuffer(1, 1, backing.subarray(4, 8));
    let uploaded, pixels;
    const context = { putImageData(image) { uploaded = image; pixels = image.data.slice(); } };
    publishPixels(context, buffer);
    assert.equal(uploaded.data.buffer, backing.buffer);
    assert.equal(uploaded.data.byteOffset, 4);
    assert.deepEqual([...pixels], [1, 2, 3, 255]);
    const snapshot = buffer.toImageData();
    buffer.data[0] = 9;
    assert.equal(snapshot.data[0], 1);
    assert.equal(pixels[0], 1);
    let resets = 0;
    const canvas = { get width() { return 1; }, set width(_) { resets++; },
      get height() { return 1; }, set height(_) { resets++; }, style: {}, getContext: () => context };
    repaintControlCanvas(canvas, buffer, 2);
    assert.equal(resets, 0);
    assert.equal(canvas.style.width, '2px');
    assert.equal(pixels[0], 9);
    publishPixels(context, new PixelBuffer(1, 1, new Uint8ClampedArray([7, 8])));
    assert.deepEqual([...pixels], [7, 8, 0, 0]);
  } finally { globalThis.ImageData = original; }
});
