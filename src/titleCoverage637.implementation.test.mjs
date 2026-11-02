// Implementation-owned P1 boundary/failure checks derived from window-title-fit.md.
// Synthetic Canvas reports and raster points are deliberately independent of real fonts.
import '../tests/helpers/registerTs.mjs';
import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
const { resolveTitleStyle, measureTitle, paintTitle, truncateTitle } = await import('./titleFont.ts');
const { PixelBuffer } = await import('./pixelBuffer.ts');
const { composeProceduralFrameChrome } = await import('./proceduralFrameChrome.ts');

const previousDocument = globalThis.document;
let canvases, draws, reads, measures, report, points, fail;
beforeEach(() => {
  canvases = []; draws = []; reads = []; measures = []; fail = '';
  report = () => ({ width: 9000, actualBoundingBoxLeft: 0, actualBoundingBoxRight: 9000,
    actualBoundingBoxAscent: 7, actualBoundingBoxDescent: 1, fontBoundingBoxAscent: 9, fontBoundingBoxDescent: 3 });
  points = () => [];
  globalThis.document = { fonts: { check: () => false, load: async () => [] },
    createElement() {
      const canvas = { width: 300, height: 150, getContext() {
        if (fail === 'context' && canvas.width > 0) return null;
        let paint;
        return {
          font: '', letterSpacing: '', textBaseline: 'alphabetic',
          measureText(text) { measures.push({ text, font: this.font }); return report(Number(this.font.match(/([\d.]+)px/)[1]), text); },
          clearRect() { paint = undefined; },
          fillText(text, x, y, ...extra) {
            const size = Number(this.font.match(/([\d.]+)px/)[1]);
            paint = { text, x, y, size, font: this.font, spacing: this.letterSpacing, extra,
              width: canvas.width, height: canvas.height };
            draws.push(paint);
          },
          getImageData(sx, sy, w, h) {
            reads.push({ sx, sy, w, h, paint });
            if (fail === 'readback') throw new Error('synthetic readback denied');
            const data = new Uint8ClampedArray(w * h * 4);
            for (const [dx, dy, alpha] of points(paint.size, paint.text)) {
              const x = Math.floor(paint.x + dx) - sx, y = Math.floor(paint.y + dy) - sy;
              if (x >= 0 && x < w && y >= 0 && y < h) {
                const offset = (y * w + x) * 4;
                data[offset] = 123; data[offset + 3] = alpha;
              }
            }
            return { data };
          },
        };
      } };
      canvases.push(canvas); return canvas;
    },
  };
});
afterEach(() => { globalThis.document = previousDocument; });
const slot = () => ({ x: 4.25, y: 2.5, w: 40, h: 12 });
const unknown = error => error.name === 'TitleCoverageUnavailableError';

test('complete finite exterior traversal uses one fixed tile and preserves full request and phase', () => {
  const text = 'full 😀 combining é request';
  const result = resolveTitleStyle(text, 13, slot);
  assert.equal(result.style.size, 13);
  assert.equal(result.omitInk, false);
  // Envelope [-10, 9019) by [-14, 22): two query rows, three columns each.
  assert.equal(draws.length, 6);
  assert.equal(canvases.filter(c => c.width > 0).length, 1);
  assert.ok(canvases.every(c => c.width === 0 || (c.width <= 4096 && c.height <= 32)));
  assert.ok(reads.every(r => r.w <= 4096 && r.h <= 32));
  assert.ok(draws.every(p => p.text === text && p.extra.length === 0 && p.spacing === '0.5px'));
  assert.ok(draws.every(p => p.x - Math.floor(p.x) === .25 && p.y - Math.floor(p.y) === .5));
  assert.deepEqual(measures.map(m => m.text), [text]);
});

test('faint disconnected coverage beyond the first horizontal tile forces nonfit; size search is not monotonic', () => {
  points = size => size === 13 || size === 12 ? [[8500, -12, 1]] : [[8500, -7, 1]];
  const result = resolveTitleStyle('whole request', 13, slot, { bold: true });
  assert.equal(result.style.size, 11);
  assert.ok(draws.some(p => p.size === 13 && p.x < -8000));
  assert.ok(draws.every(p => p.font.startsWith('bold ') && p.text === 'whole request'));
  measures.length = 0;
  points = size => size === 12 ? [] : [[8500, -12, 1]];
  assert.equal(resolveTitleStyle('whole request', 13, slot).style.size, 12);
  assert.equal(measures.length, 2);
});

test('signed negative bearings and distant vertical tiles are traversed without clipping to advance', () => {
  report = () => ({ width: 1, actualBoundingBoxLeft: 5000, actualBoundingBoxRight: -4990,
    actualBoundingBoxAscent: 70, actualBoundingBoxDescent: 1 });
  points = () => [[-4995, -70, 1]];
  const result = resolveTitleStyle('mark', 3, () => ({ w: 1, h: 5 }));
  assert.equal(result.omitInk, false); // baseline 70: the point is on row 0.
  assert.equal(result.style.size, 3);
  assert.ok(draws.some(p => p.y < 40));
  assert.ok(draws.every(p => p.x >= 4990));
});

test('zero actual metrics do not establish empty raster and alpha one is nonfit', () => {
  report = () => ({ width: 0, actualBoundingBoxLeft: 0, actualBoundingBoxRight: 0,
    actualBoundingBoxAscent: 0, actualBoundingBoxDescent: 0 });
  points = () => [[0, 1, 1]];
  assert.equal(resolveTitleStyle('zero', 3, () => ({ w: 20, h: 1 })).omitInk, true);
  assert.equal(measures.length, 3);
  assert.ok(reads.length >= 3);
});

test('missing, nonfinite, inconsistent and unsafe bounds are unavailable before trying smaller styles', () => {
  const original = report;
  for (const changed of [
    { actualBoundingBoxLeft: undefined }, { actualBoundingBoxDescent: NaN },
    { actualBoundingBoxRight: Infinity }, { actualBoundingBoxLeft: -10000 },
    { actualBoundingBoxAscent: -10 }, { actualBoundingBoxRight: Number.MAX_SAFE_INTEGER },
  ]) {
    measures.length = 0; report = () => ({ ...original(), ...changed });
    assert.throws(() => resolveTitleStyle('unresolved', 13, slot), unknown);
    assert.equal(measures.length, 1);
  }
});

test('a safe integer translation that would lose fractional phase is unavailable', () => {
  const original = report;
  report = () => ({ ...original(), actualBoundingBoxLeft: -(2 ** 52), actualBoundingBoxRight: 2 ** 52 + 10 });
  assert.throws(() => resolveTitleStyle('phase', 13, slot), unknown);
  assert.equal(measures.length, 1);
  assert.equal(draws.length, 0);
});

test('host readback and scratch context failures remain unavailable, never TF5 or a smaller size', () => {
  for (const mode of ['readback', 'context']) {
    fail = mode; measures.length = 0;
    assert.throws(() => resolveTitleStyle('unresolved', 13, slot), unknown);
    assert.equal(measures.length, 1);
  }
});

test('contained expanded envelope needs no observation; metrics remain raster-free for long text', () => {
  report = () => ({ width: 1e9, actualBoundingBoxLeft: 0, actualBoundingBoxRight: 1e9,
    actualBoundingBoxAscent: 2, actualBoundingBoxDescent: -2, fontBoundingBoxAscent: 9, fontBoundingBoxDescent: 3 });
  const measured = measureTitle('x'.repeat(10000), 1);
  assert.deepEqual(measured, { advance: 1e9, ascent: 2, fontAscent: 9, fontDescent: 3 });
  const result = resolveTitleStyle('long', 1, () => ({ w: 1, h: 20 }));
  assert.equal(result.omitInk, false);
  assert.equal(draws.length, 0);
  assert.ok(canvases.every(c => c.width === 0 && c.height === 0));
});

test('publication keeps overhang and faint rows beyond reported ink while preserving fractional pen and baseline', () => {
  points = () => [[-2, -9, 1], [4, 2, 255]];
  const buffer = PixelBuffer.alloc(20, 20);
  assert.equal(paintTitle(buffer, 'whole publication', 13, '#000000', 7.25, 11.5,
    { x: 3, y: 2, w: 10, h: 14 }), true);
  assert.equal(buffer.getPixel(5, 2)[3], 1);
  assert.equal(buffer.getPixel(11, 13)[3], 255);
  assert.equal(draws[0].x, 4.25);
  assert.equal(draws[0].y, 9.5);
  assert.deepEqual([draws[0].width, draws[0].height], [10, 14]);
  assert.equal(measures.length, 0);
  fail = 'readback';
  const unchanged = buffer.data.slice();
  assert.throws(() => paintTitle(buffer, 'failed', 13, '#000000', 7, 11,
    { x: 0, y: 0, w: 20, h: 20 }), unknown);
  assert.deepEqual(buffer.data, unchanged);
});

test('procedural titles retain requested size, UTF-16 truncation policy and metrics-only geometry', async () => {
  report = (size, text) => ({ width: text.length * 6, actualBoundingBoxLeft: 0, actualBoundingBoxRight: text.length * 6,
    actualBoundingBoxAscent: 7, actualBoundingBoxDescent: 1, fontBoundingBoxAscent: 9, fontBoundingBoxDescent: 3 });
  const theme = { manifest: { windowTypes: {}, chromeElements: {}, patterns: {} } };
  const title = 'A'.repeat(1000);
  const result = await composeProceduralFrameChrome(theme, 'document-window', 'active', 100, 50, { title });
  assert.ok(result.fullWidth >= 100);
  assert.ok(measures.some(m => m.text === title));
  assert.ok(draws.every(p => p.width <= result.fullWidth && p.height <= result.fullHeight));
  assert.ok(draws.every(p => p.text.length < title.length && p.text.endsWith('…') && p.font.startsWith('12px ')));
  assert.ok(canvases.every(c => c.width === 0 || c.width <= result.fullWidth));
  draws.length = 0; measures.length = 0;
  globalThis.document.fonts.check = () => true;
  await composeProceduralFrameChrome(theme, 'document-window', 'active', 100, 50, { title: 'Document' });
  assert.ok(measures.every(m => m.font.startsWith('16px ')));
  measures.length = 0;
  await composeProceduralFrameChrome(theme, 'titled-utility-window', 'active', 100, 50, { title: 'Tool' });
  assert.ok(measures.every(m => m.font.startsWith('10px ')));
});

// Observe every explicit storage resize, including states before context use.
test('title canvas storage stays within its role bound throughout initialization', () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const storage = [];
  globalThis.document = {
    fonts: { check: () => false },
    createElement(name) {
      assert.equal(name, 'canvas');
      let width = 300, height = 150;
      const states = [];
      const canvas = {
        get width() { return width; },
        set width(value) { width = value; states.push([width, height]); },
        get height() { return height; },
        set height(value) { height = value; states.push([width, height]); },
        getContext(kind) {
          assert.equal(kind, '2d');
          return {
            canvas,
            measureText: () => ({ width: 20000, actualBoundingBoxLeft: 2,
              actualBoundingBoxRight: 20002, actualBoundingBoxAscent: 8,
              actualBoundingBoxDescent: 2, fontBoundingBoxAscent: 8,
              fontBoundingBoxDescent: 2 }),
            clearRect() {},
            fillText() {},
            getImageData: (_x, _y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
          };
        },
      };
      storage.push({ canvas, states });
      return canvas;
    },
  };
  const bounded = (entry, maxWidth, maxHeight, partial = false) => {
    assert.ok(entry.states.length > 0);
    for (const [width, height] of entry.states) {
      assert.ok(width === 0 || height === 0 || (width <= maxWidth && height <= maxHeight),
        `intermediate ${width}x${height} exceeds ${maxWidth}x${maxHeight}`);
    }
    if (!partial) {
      assert.equal(entry.canvas.width, maxWidth);
      assert.equal(entry.canvas.height, maxHeight);
    }
  };
  try {
    assert.equal(measureTitle('complete request', 12).advance, 20000);
    bounded(storage.shift(), 0, 0);

    assert.equal(resolveTitleStyle('complete request', 12, () => ({ w: 80, h: 10 })).omitInk, false);
    bounded(storage.shift(), 0, 0);
    bounded(storage.shift(), 4096, 32, true);

    for (const [width, height] of [[6000, 8], [8, 5], [8, 200]]) {
      let publications = 0;
      const target = { width, height, drawOver() { publications++; } };
      assert.equal(paintTitle(target, 'complete request', 12, '#123456', 0, 8,
        { x: 0, y: 0, w: width, h: height }), true);
      assert.equal(publications, 1);
      bounded(storage.shift(), 0, 0);
      bounded(storage.shift(), width, height);
    }
    assert.equal(storage.length, 0);
  } finally {
    if (previous) Object.defineProperty(globalThis, 'document', previous);
    else delete globalThis.document;
  }
});

test('metrics-only consumers reject unusable consumed reports without raster allocation', () => {
  const original = report;
  for (const changed of [
    { width: NaN }, { width: Infinity }, { width: -1 }, { width: 2 ** 53 },
    { actualBoundingBoxAscent: undefined }, { actualBoundingBoxAscent: NaN },
    { actualBoundingBoxDescent: undefined }, { actualBoundingBoxDescent: Infinity },
    { actualBoundingBoxAscent: -2, actualBoundingBoxDescent: 1 },
    { fontBoundingBoxAscent: NaN }, { fontBoundingBoxDescent: Infinity },
  ]) {
    report = () => ({ ...original(), ...changed });
    assert.throws(() => measureTitle('complete request', 12), unknown);
  }
  assert.equal(draws.length, 0);
  assert.ok(canvases.every(c => c.width === 0 && c.height === 0));
});

test('metrics-only fallbacks preserve nominal formulas and valid signed font metrics', () => {
  report = () => ({ width: 3.2, actualBoundingBoxAscent: 0, actualBoundingBoxDescent: 0 });
  assert.deepEqual(measureTitle('zero', 12), { advance: 4, ascent: 9, fontAscent: 9, fontDescent: 0 });
  report = () => ({ width: 3.2, actualBoundingBoxAscent: -2, actualBoundingBoxDescent: 3.2,
    fontBoundingBoxAscent: 0, fontBoundingBoxDescent: 0 });
  assert.deepEqual(measureTitle('signed', 12), { advance: 4, ascent: 1, fontAscent: 1, fontDescent: 4 });
  report = () => ({ width: 3.2, actualBoundingBoxAscent: 7.2, actualBoundingBoxDescent: -2,
    fontBoundingBoxAscent: -1.2, fontBoundingBoxDescent: 3.2 });
  assert.deepEqual(measureTitle('signed font', 12), { advance: 4, ascent: 8, fontAscent: -1, fontDescent: 4 });
  assert.equal(draws.length, 0);
});

test('host measurement exceptions reject distinctly for measurement, fitting and truncation', () => {
  report = () => { throw new Error('synthetic native measurement failure'); };
  const measure = text => measureTitle(text, 12).advance;
  assert.throws(() => measure('complete'), unknown);
  assert.throws(() => resolveTitleStyle('complete', 12, slot), unknown);
  assert.throws(() => truncateTitle('complete', 20, measure), unknown);
  assert.equal(draws.length, 0);
});

test('truncation cannot skip an invalid full request, prefix or end-marker measurement', () => {
  for (const invalid of [NaN, Infinity, -1, 2 ** 53]) {
    for (const rejected of ['ABC', 'AB…', '…']) {
      const visited = [];
      assert.throws(() => truncateTitle('ABC', 0, text => {
        visited.push(text);
        return text === rejected ? invalid : text.length * 5;
      }), unknown);
      assert.equal(visited.at(-1), rejected);
    }
  }
  for (const rejected of ['AB…', '…']) {
    assert.throws(() => truncateTitle('ABC', 0, text => {
      if (text === rejected) throw new Error('synthetic prefix measurement failure');
      return text.length * 5;
    }), unknown);
  }
});

test('procedural preparation rejects invalid complete title metrics and host failures', async () => {
  const original = report;
  const theme = { manifest: { windowTypes: {}, chromeElements: {}, patterns: {} } };
  for (const stage of ['complete', 'host']) {
    report = (size, text) => {
      if (stage === 'host') throw new Error('synthetic native measurement failure');
      return { ...original(size, text), width: NaN };
    };
    await assert.rejects(composeProceduralFrameChrome(theme, 'document-window', 'active', 100, 50,
      { title: `${stage}A`.repeat(1000) }), unknown, stage);
  }
  assert.equal(draws.length, 0);
});

test('absent DOM and null Canvas context keep existing measurement and style fallback behavior', () => {
  delete globalThis.document;
  assert.equal(measureTitle('complete', 12), null);
  assert.equal(resolveTitleStyle('complete', 12, slot).style.size, 12);
  globalThis.document = { createElement: () => ({ getContext: () => null }) };
  assert.equal(measureTitle('complete', 12), null);
  assert.equal(resolveTitleStyle('complete', 12, slot).omitInk, false);
});

test('guarded queries retain exact projected metric anchors on both axes and own every exterior pixel', () => {
  const x = -3.25, top = 2.5, height = 12;
  // The nominal ascent puts the absolute baseline at 68.5.
  const metric = { left: x - 2.5, right: x + 8168.25, top: 68.5 - 65.25, bottom: 68.5 - 1.5 };
  report = () => ({ width: 8200, actualBoundingBoxLeft: 2.5, actualBoundingBoxRight: 8168.25,
    actualBoundingBoxAscent: 65.25, actualBoundingBoxDescent: -1.5 });
  const result = resolveTitleStyle('whole guarded request', 13, () => ({ x, y: top, w: 30, h: height }));
  assert.equal(result.style.size, 13);
  const envelope = { left: Math.floor(metric.left - 14), right: Math.ceil(metric.right + 14),
    top: Math.floor(metric.top - 14), bottom: Math.ceil(metric.bottom + 14) };
  let index = 0, ownedExteriorArea = 0;
  for (let first = envelope.top; first < envelope.bottom; first += 30) {
    const last = Math.min(first + 30, envelope.bottom);
    if (first >= top && last <= top + height) continue;
    for (let left = envelope.left; left < envelope.right; left += 4094) {
      const right = Math.min(left + 4094, envelope.right);
      const read = reads[index++], paint = read.paint;
      const anchorX = Math.max(metric.left, Math.min(metric.right, left + (right - left) / 2));
      const anchorY = Math.max(metric.top, Math.min(metric.bottom, first + (last - first) / 2));
      const originX = Math.min(left, Math.floor(anchorX)) - 1;
      const originY = Math.min(first, Math.floor(anchorY)) - 1;
      assert.deepEqual([paint.x, paint.y], [x - originX, 68.5 - originY]);
      assert.deepEqual([read.sx, read.sy, read.w, read.h], [left - originX, first - originY, right - left, last - first]);
      assert.deepEqual([paint.width, paint.height], [Math.max(right, Math.ceil(anchorX)) + 1 - originX,
        Math.max(last, Math.ceil(anchorY)) + 1 - originY]);
      assert.ok(anchorX > originX && anchorX < originX + paint.width);
      assert.ok(anchorY > originY && anchorY < originY + paint.height);
      assert.ok(read.sx >= 1 && read.sy >= 1 && read.sx + read.w < paint.width && read.sy + read.h < paint.height);
      for (let row = first; row < last; row++) {
        if (row < top || row + 1 > top + height) ownedExteriorArea += right - left;
      }
    }
  }
  assert.equal(index, reads.length);
  const interiorRows = Math.max(0, Math.floor(top + height) - Math.ceil(top));
  assert.equal(ownedExteriorArea, (envelope.right - envelope.left) * (envelope.bottom - envelope.top - interiorRows));
  assert.ok(reads.some(r => r.w < 4094 && r.h < 30));
  assert.ok(reads.some(r => r.sx > 1 && r.sy > 1));
});

test('partial corner owns faint alpha while interior rows never disprove fit', () => {
  report = () => ({ width: 8200, actualBoundingBoxLeft: 0, actualBoundingBoxRight: 8200,
    actualBoundingBoxAscent: 7, actualBoundingBoxDescent: 1 });
  points = size => size === 13 ? [[8205, 10, 1]] : [];
  assert.equal(resolveTitleStyle('corner', 13, slot).style.size, 12);
  // Preferred envelope bottom is 22: this point is in its final corner query.
  assert.ok(draws.some(p => p.size === 13 && p.x < -8000));
  assert.ok(measures.length > 1);
  points = () => [[8200, -7, 1], [0, 0, 1]];
  assert.equal(resolveTitleStyle('inside', 13, slot).style.size, 13);
});
