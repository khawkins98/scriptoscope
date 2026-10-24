// Implementation-owned unit checks derived only from docs/spec/engine/tab.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
registerHooks({ resolve(specifier, context, nextResolve) {
  try { return nextResolve(specifier, context); }
  catch (error) {
    if (error.code === 'ERR_MODULE_NOT_FOUND' && specifier.endsWith('.js'))
      return nextResolve(specifier.slice(0, -3) + '.ts', context);
    throw error;
  }
} });
const { drawTab, tabOriginalResourceIds, tabOriginalState } = await import('./tab.ts');
const { PixelBuffer } = await import('../../pixelBuffer.ts');

const source = () => {
  const p = PixelBuffer.alloc(5, 3);
  for (let y = 0; y < 3; y++) for (let x = 0; x < 5; x++) p.setPixel(x, y, 10 + x, 20 + y, 30, 255);
  return p;
};
const input = (p, extra = {}) => ({ source: p, destination: { left: 0, top: 0, right: 8, bottom: 3 },
  metadata: { corner: 1, side: 2, tile: false, mode: 0, patternId: 0 }, samplingEquivalent: true, ...extra });
test('B3/B4 overlap repeats one column, retaining full source height', () => {
  const p = source(), port = PixelBuffer.alloc(8, 3);
  p.setPixel(2, 1, 200, 0, 0, 255);
  const r = drawTab(port, input(p));
  assert.equal(r.drawn, true);
  assert.equal(r.center, 'empty');
  assert.equal(r.bottom, 3);
  assert.deepEqual(port.getPixel(6, 1), p.getPixel(1, 1));
  assert.deepEqual(port.getPixel(0, 2), p.getPixel(0, 2));
});
test('C1 companion only changes sampled bands, ordinary caps keep decoded pixels', () => {
  const p = source(), sampled = source(), port = PixelBuffer.alloc(8, 3);
  sampled.setPixel(1, 1, 91, 92, 93, 255); sampled.setPixel(0, 1, 99, 99, 99, 255);
  const r = drawTab(port, input(p, { samplingEquivalent: false, sampled }));
  assert.equal(r.drawn, true);
  assert.deepEqual(port.getPixel(2, 1), [91, 92, 93, 255]);
  assert.deepEqual(port.getPixel(0, 1), p.getPixel(0, 1));
  const untouched = PixelBuffer.alloc(8, 3);
  assert.equal(drawTab(untouched, input(p, { samplingEquivalent: false })).unsupported, 'unsupported-sampling');
  assert.equal(untouched.data.some(v => v !== 0), false);
});
test('P4 phase uses incoming outer rect and B6 returns source bottom', () => {
  const p = source(), pattern = PixelBuffer.alloc(2, 2), port = PixelBuffer.alloc(10, 10);
  pattern.setPixel(0, 0, 1, 0, 0, 255); pattern.setPixel(1, 0, 2, 0, 0, 255);
  pattern.setPixel(0, 1, 3, 0, 0, 255); pattern.setPixel(1, 1, 4, 0, 0, 255);
  const r = drawTab(port, input(p, { destination: { left: 1, top: 2, right: 9, bottom: 9 },
    metadata: { corner: 1, side: 1, tile: true, mode: 4, patternId: 17 }, pattern }));
  assert.equal(r.drawn, true); assert.equal(r.bottom, 5); assert.deepEqual(r.phase, { x: 9, y: 9 });
  assert.deepEqual(port.getPixel(2, 3), [2, 0, 0, 255]);
});
test('original V1 retry is separate from public large fallback', () => {
  assert.equal(tabOriginalState(255, true, true), 3);
  assert.deepEqual(tabOriginalResourceIds('small', tabOriginalState(0, true, false)), [-9975, -9959]);
});
test('B8 keeps leading fragment of the final tile and reports B1-B4 paint order', () => {
  const p = source(), port = PixelBuffer.alloc(7, 3);
  const trace = { family: 'tab', inputs: {}, resolved: [], rects: {}, drawOps: [] };
  const r = drawTab(port, input(p, { destination: { left: 0, top: 0, right: 7, bottom: 3 },
    metadata: { corner: 1, side: 2, tile: true, mode: 0, patternId: 0 } }), trace);
  assert.equal(r.drawn, true);
  assert.deepEqual(port.getPixel(5, 0), p.getPixel(2, 0));
  assert.deepEqual(trace.drawOps.filter(op => op.op === 'tabBand').map(op => op.row), ['B1', 'B2', 'B3', 'B4']);
});
test('native emboss equal to background remains an output; empty centre needs neither realization', () => {
  const p = source(), port = PixelBuffer.alloc(8, 3), rgb = { r: 5, g: 6, b: 7, a: 255 };
  const r = drawTab(port, input(p, { backgroundRGB: rgb, textRGB: rgb, embossRGB: rgb }));
  assert.deepEqual(r.embossRGB, rgb); assert.deepEqual(r.textRGB, rgb);
  assert.equal(drawTab(PixelBuffer.alloc(8, 3), input(p)).drawn, true);
});

test('P1 zero request erases even when unrelated prepared pattern exists', () => {
  const p = source(), port = PixelBuffer.alloc(8, 3), pattern = source();
  const r = drawTab(port, input(p, { metadata: { corner: 1, side: 1, tile: true, mode: 4, patternId: 0 },
    pattern, backgroundRGB: { r: 60, g: 61, b: 62, a: 255 } }));
  assert.equal(r.center, 'solid'); assert.deepEqual(port.getPixel(2, 1), [60, 61, 62, 255]);
});
