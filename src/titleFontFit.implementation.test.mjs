// Implementation-owned substitute-style checks; synthetic metrics, no font/pixel oracle.
import assert from 'node:assert/strict';
import { after, afterEach, beforeEach, test } from 'node:test';
import { registerHooks, stripTypeScriptTypes } from 'node:module';
import { readFileSync } from 'node:fs';

const hooks = registerHooks({
  resolve(specifier, context, next) {
    try { return next(specifier, context); }
    catch (error) {
      if (specifier.startsWith('.') && specifier.endsWith('.js') && error.code === 'ERR_MODULE_NOT_FOUND') {
        return next(`${specifier.slice(0, -3)}.ts`, context);
      }
      throw error;
    }
  },
  load(url, context, next) {
    if (url.endsWith('.ts')) return { format: 'module', shortCircuit: true,
      source: stripTypeScriptTypes(readFileSync(new URL(url), 'utf8'), { mode: 'transform' }) };
    return next(url, context);
  },
});
const { resolveTitleStyle, measureTitle, rasterizeTitle, truncateTitle } = await import('./titleFont.ts');
const { PixelBuffer } = await import('./pixelBuffer.ts');
const { themeView } = await import('./ownedTheme.ts');
const { renderWindow } = await import('./renderWindow.ts');
const { composeWindowChrome } = await import('./composeChrome.ts');
after(() => hooks.deregister());

const originalDocument = globalThis.document, originalImageData = globalThis.ImageData;
let pinned, metrics, measurements, paints, publications;
beforeEach(() => {
  pinned = true; measurements = []; paints = []; publications = [];
  metrics = size => ({ actualBoundingBoxAscent: Math.ceil(size * 0.7), actualBoundingBoxDescent: Math.ceil(size * 0.2) });
  globalThis.ImageData = class {
    constructor(data, width, height) {
      if (typeof data === 'number') { height = width; width = data; data = new Uint8ClampedArray(width * height * 4); }
      Object.assign(this, { data, width, height });
    }
  };
  globalThis.document = {
    fonts: { check: () => pinned, load: async () => [] },
    createElement() {
      return { style: {}, dataset: {}, attributes: {}, children: [],
        setAttribute(key, value) { this.attributes[key] = value; },
        append(...children) { this.children.push(...children); },
        appendChild(child) { this.children.push(child); },
        getContext() { return {
          font: '', letterSpacing: '', glyph: null,
          measureText(text) {
            const size = Number(this.font.match(/([\d.]+)px/)[1]);
            measurements.push({ text, font: this.font, spacing: this.letterSpacing });
            return { width: text.length * size, ...metrics(size) };
          },
          fillText(text, x, y) {
            const size = Number(this.font.match(/([\d.]+)px/)[1]);
            const metric = metrics(size);
            this.glyph = { text, x, y, width: text.length * size,
              top: -metric.actualBoundingBoxAscent, bottom: metric.actualBoundingBoxDescent,
              font: this.font, spacing: this.letterSpacing, color: this.fillStyle };
            paints.push(this.glyph);
          },
          getImageData(x, y, width, height) {
            const data = new Uint8ClampedArray(width * height * 4);
            const glyph = this.glyph;
            if (glyph) {
              const rgb = glyph.color.slice(1).match(/../g).map(value => parseInt(value, 16));
              for (let row = 0; row < height; row++) {
                for (let col = 0; col < width; col++) {
                  if (x + col < glyph.x || x + col >= glyph.x + glyph.width ||
                      y + row < glyph.y + glyph.top || y + row >= glyph.y + glyph.bottom) continue;
                  data.set([...rgb, 255], (row * width + col) * 4);
                }
              }
            }
            return { data, width, height };
          },
          putImageData(image, x, y) { publications.push({ data: image.data.slice(), width: image.width, height: image.height, x, y }); },
        }; },
      };
    },
  };
});
afterEach(() => { globalThis.document = originalDocument; globalThis.ImageData = originalImageData; });
const clip = h => () => ({ w: 100, h });

test('preferred native and fractional styles remain unchanged when full-title ink fits', () => {
  const native = resolveTitleStyle('Full gy', 13, clip(20), { bold: true });
  assert.equal(native.style.size, 16);
  assert.equal(native.omitInk, false);
  pinned = false;
  const result = resolveTitleStyle('Full gy', 12.5, clip(20));
  assert.equal(result.style.size, 12.5);
  assert.equal(result.style.bold, false);
  assert.equal(result.style.spacing, '0.5px');
  assert.equal(result.omitInk, false);
  assert.equal(measurements.length, 2);
});

test('descending integer candidates use full-title advances and retain family, bold and spacing', () => {
  const preferred = resolveTitleStyle('Full gy', 13, clip(20), { bold: true });
  const advances = [];
  const result = resolveTitleStyle('Full gy', 13, advance => {
    advances.push(advance); return { w: advance, h: 11 };
  }, { bold: true });
  assert.deepEqual(advances, [112, 105, 98, 91, 84, 77]);
  assert.equal(result.style.size, 11);
  assert.equal(result.style.family, preferred.style.family);
  assert.equal(result.style.bold, true);
  assert.equal(result.style.spacing, '0px');
  assert.ok(measurements.every(call => call.text === 'Full gy'));
  measurements.length = 0;
  const measure = text => measureTitle(text, 13, { style: result.style }).advance;
  assert.equal(measure('Full gy'), 77);
  const shortened = truncateTitle('Full gy', 35, measure);
  rasterizeTitle(shortened, 13, '#ffffff', { style: result.style });
  assert.ok(measurements.every(call => call.font.startsWith('bold 11px ') && call.spacing === '0px'));
  assert.equal(paints.at(-1).font, measurements[0].font);
});

test('fit checks signed ink descent rather than transparent raster allocation', () => {
  metrics = () => ({ actualBoundingBoxAscent: 14, actualBoundingBoxDescent: -11 });
  const result = resolveTitleStyle("'", 13, clip(5));
  assert.equal(result.style.size, 16);
  assert.equal(result.omitInk, false);
  assert.equal(measurements.length, 1);
});

function fixture(titleHeight = 11) {
  const cicn = PixelBuffer.alloc(40, 30); cicn.data.fill(255);
  const sample = value => ({ rgb16: [value, value, value], displayRgb: [value, value, value] });
  const wt = { chrome: { active: 'synthetic' },
    parts: { 'part-0': { rect: [2, 14, 38, 28] }, 'part-4': { rect: [10, 1, 20, 1 + titleHeight] } },
    edges: { top: [{ part: 'part-0', at: 0 }, { part: 'part-1', at: 5 }, { part: 'part-5', at: 25 }, { part: 'part-8', at: 40 }] },
    titleSamples: { active: { text: sample(0), shadow: sample(200) } },
  };
  const view = themeView({ baseUrl: 'synthetic', manifest: { windowTypes: { 'titled-utility-window': wt }, chromeElements: {}, patterns: {} } });
  view.asset = () => ({ key: 'synthetic', pixels: async () => cicn });
  return { view, wt, cicn };
}

test('renderer resolves once from the full title before truncation and both paints reuse the result', async () => {
  const { view } = fixture();
  const win = await renderWindow(view, { windowType: 'titled-utility-window', title: 'Full gy', width: 45 });
  assert.equal(win.attributes['aria-label'], 'Full gy');
  // Full-title coverage probes are allowed; only the final paints use the truncated title.
  const finalPaints = paints.filter(call => call.text.endsWith('…'));
  assert.equal(finalPaints.length, 2);
  assert.ok(finalPaints.every(call => call.font.startsWith('bold 11px ') && call.spacing === '0px'));
  assert.deepEqual(finalPaints.map(call => call.color), ['#c8c8c8', '#000000']);
  assert.ok(paints.filter(call => !call.text.endsWith('…')).every(call => call.text === 'Full gy'));
  assert.equal(publications.length, 1);
  const actual = win._scriptoscopeComposed;
  assert.deepEqual(publications[0].data, actual.buffer.data);
  const { x, y, w, h } = actual.titleRect;
  const pixel = (px, py) => Array.from(publications[0].data.slice((py * publications[0].width + px) * 4, (py * publications[0].width + px) * 4 + 4));
  // Synthetic size 11 has eight ascent rows and three descent rows. Main ink
  // reaches both vertical bounds; the one-pixel shadow survives on its right.
  assert.equal(h, 11);
  assert.deepEqual(pixel(x, y), [0, 0, 0, 255]);
  assert.deepEqual(pixel(x, y + h - 1), [0, 0, 0, 255]);
  const advance = finalPaints[0].text.length * 11;
  assert.ok(advance < w + 2, 'fixture leaves room for the clipped shadow');
  assert.deepEqual(pixel(x + advance, y + 1), [200, 200, 200, 255]);
});

test('impossible slots suppress main and shadow while retaining preferred geometry and accessible title', async () => {
  metrics = () => ({ actualBoundingBoxAscent: 1, actualBoundingBoxDescent: 20 });
  const { view, wt, cicn } = fixture(1);
  const title = 'Full gy';
  const win = await renderWindow(view, { windowType: 'titled-utility-window', title, width: 240 });
  const expected = composeWindowChrome(cicn, wt, 240, 120, { altWidgets: true, titleWidthPx: title.length * 16, titleLength: title.length });
  const actual = win._scriptoscopeComposed;
  assert.ok(paints.every(call => call.text === title && call.color === '#000000'), 'only full-title coverage probes may paint');
  assert.equal(publications.length, 1);
  assert.deepEqual(publications[0].data, expected.buffer.data);
  assert.equal(win.attributes['aria-label'], title);
  assert.deepEqual(actual.titleRect, expected.titleRect);
  assert.deepEqual(actual.titleRegion, expected.titleRegion);
  assert.deepEqual(actual.layout.sides.map(side => side?.P), expected.layout.sides.map(side => side?.P));
  assert.deepEqual(actual.buffer.data, expected.buffer.data);
});

test('empty text and preferred empty clips keep existing behavior', () => {
  assert.equal(resolveTitleStyle('', 13, clip(1)).omitInk, false);
  assert.equal(resolveTitleStyle('Full gy', 13, clip(0)).style.size, 16);
});
