import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';

// Synthetic canvas coverage, deliberately independent of its reported metrics.
function fixture(rows, { pinned = false, metrics = {} } = {}) {
  const draws = [];
  const document = {
    fonts: { check: () => pinned },
    createElement() {
      const canvas = { width: 300, height: 150 };
      let points = [];
      const ctx = {
        font: '', letterSpacing: '',
        measureText(text) {
          const size = Number(this.font.match(/([\d.]+)px/)[1]);
          return { width: text.length * size, actualBoundingBoxAscent: 2,
            actualBoundingBoxDescent: 0, ...metrics };
        },
        fillText(text, x, y) {
          const size = Number(this.font.match(/([\d.]+)px/)[1]);
          draws.push({ text, size, font: this.font, spacing: this.letterSpacing });
          points = rows(size, text).map(([row, alpha]) => [x, y + row, alpha]);
        },
        getImageData(x, y, w, h) {
          const data = new Uint8ClampedArray(w * h * 4);
          for (const [px, py, alpha] of points) {
            if (px < 0 || py < 0 || px >= canvas.width || py >= canvas.height) continue;
            if (px >= x && py >= y && px < x + w && py < y + h) {
              data[((py - y) * w + px - x) * 4 + 3] = alpha;
            }
          }
          return { data };
        },
      };
      canvas.getContext = () => ctx;
      return canvas;
    },
  };
  class PixelBuffer {
    static alloc(width, height) { return { width, height, data: new Uint8ClampedArray(width * height * 4) }; }
  }
  const source = readFileSync(new URL('./titleFont.ts', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const module = { exports: {} };
  const require = name => {
    if (name === './pixelBuffer.js') return { PixelBuffer };
    if (name === './engine/tables/window.js') return { TITLE_TEXT: { TX8: { baselineAbove: 4 } } };
    throw new Error(`Unexpected dependency: ${name}`);
  };
  new Function('require', 'module', 'exports', 'document', compiled)(require, module, module.exports, document);
  return { ...module.exports, draws };
}

test('faint descent beyond metrics forces the largest fitting integer candidate', () => {
  const f = fixture(size => [[-2, 255], [size - 4, 1]]);
  const advances = [];
  const result = f.resolveTitleStyle('full fallback title', 10, advance => {
    advances.push(advance);
    return { w: advance, h: 8 };
  }, { bold: true });
  assert.equal(result.style.size, 7);
  assert.equal(result.style.bold, true);
  assert.equal(result.style.spacing, '0.5px');
  assert.equal(result.omitInk, false);
  assert.deepEqual(advances, [10, 9, 8, 7].map(size => size * 'full fallback title'.length));
  assert.ok(f.draws.every(draw => draw.text === 'full fallback title' && draw.font.startsWith('bold ')));
  const raster = f.rasterizeTitle('full fallback title', 10, '#000000', { style: result.style });
  assert.equal(raster.buffer.data.filter((_, i) => i % 4 === 3 && raster.buffer.data[i] === 1).length, 1);
  assert.equal(raster.advance, 7 * 'full fallback title'.length);
});

test('underestimated ascent is tested at the unchanged metric baseline', () => {
  const f = fixture(size => [[-size, 1], [-1, 255]]);
  const result = f.resolveTitleStyle('fallback', 10, () => ({ w: 100, h: 8 }));
  assert.equal(result.style.size, 4);
  const r = f.rasterizeTitle('fallback', 4, '#000000', { style: result.style });
  assert.equal(r.ascent, 4);
  assert.equal(f.measureTitle('fallback', 4, { style: result.style }).ascent, 2);
  assert.equal(r.buffer.data[3], 1);
});

test('candidate-specific clip controls selection and impossible slots keep preferred geometry', () => {
  const f = fixture(() => [[-2, 255], [2, 1]]);
  const result = f.resolveTitleStyle('abc', 10, advance => ({ w: advance, h: advance >= 24 ? 4 : 8 }));
  assert.equal(result.style.size, 7);
  const impossible = f.resolveTitleStyle('abc', 10, () => ({ w: 100, h: 1 }));
  assert.equal(impossible.omitInk, true);
  assert.equal(impossible.style.size, 10);
});

test('resolved pinned family survives subsequent advance, truncation and raster measurement', () => {
  const f = fixture(size => [[-2, 255], [size - 4, 1]], { pinned: true });
  const result = f.resolveTitleStyle('abcdef', 10, () => ({ w: 30, h: 8 }), { bold: true });
  assert.equal(result.style.size, 7);
  assert.match(result.style.family, /^"Charcoal 12", /);
  assert.equal(result.style.spacing, '0px');
  const measure = text => f.measureTitle(text, 10, { style: result.style }).advance;
  assert.equal(f.truncateTitle('abcdef', 28, measure), 'abc…');
  f.rasterizeTitle('abc…', 10, '#000000', { style: result.style });
  assert.equal(f.draws.at(-1).size, 7);
  assert.equal(f.draws.at(-1).spacing, '0px');
});

test('blank ink and existing empty preferred clips preserve preferred style', () => {
  const f = fixture(() => []);
  assert.equal(f.resolveTitleStyle(' ', 10, () => ({ w: 10, h: 1 })).style.size, 10);
  assert.equal(f.resolveTitleStyle('x', 10, () => ({ w: 0, h: 0 })).omitInk, false);
});

test('zero reported bounds do not hide painted fallback rows', () => {
  const f = fixture(size => [[size - 1, 1]], {
    metrics: { actualBoundingBoxAscent: 0, actualBoundingBoxDescent: 0 },
  });
  const result = f.resolveTitleStyle('fallback', 10, () => ({ w: 100, h: 8 }));
  assert.equal(result.style.size, 4);
  assert.equal(result.omitInk, false);
});

test('negative reported descent and upper-only ink retain a fitting preferred size', () => {
  const f = fixture(() => [[-2, 1]], { metrics: { actualBoundingBoxDescent: -1 } });
  const result = f.resolveTitleStyle('capitals', 10, () => ({ w: 100, h: 4 }));
  assert.equal(result.style.size, 10);
  assert.equal(result.omitInk, false);
});
