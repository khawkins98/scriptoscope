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
const { createTitleRequest, resolveTitleStyle, measureTitle, paintTitle, truncateTitle } = await import('./titleFont.ts');
const { PixelBuffer } = await import('./pixelBuffer.ts');
const { themeView } = await import('./ownedTheme.ts');
const { renderWindow } = await import('./renderWindow.ts');
const { composeWindowChrome } = await import('./composeChrome.ts');
after(() => hooks.deregister());

const originalDocument = globalThis.document, originalImageData = globalThis.ImageData;
let pinned, metrics, measurements, paints;
beforeEach(() => {
  pinned = true; measurements = []; paints = [];
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
        getContext() { let ink, observation = false; return {
          font: '', letterSpacing: '',
          measureText(text) {
            const size = Number(this.font.match(/([\d.]+)px/)[1]);
            measurements.push({ text, font: this.font, spacing: this.letterSpacing });
            return { width: text.length * size, actualBoundingBoxLeft: 0, actualBoundingBoxRight: text.length * size, ...metrics(size) };
          },
          clearRect() { ink = undefined; observation = true; },
          fillText(text, x, y) {
            if (!observation) paints.push({ text, font: this.font, spacing: this.letterSpacing });
            const size = Number(this.font.match(/([\d.]+)px/)[1]);
            const m = metrics(size);
            ink = { left: x, right: x + text.length * size,
              top: y - m.actualBoundingBoxAscent, bottom: y + m.actualBoundingBoxDescent };
          },
          getImageData(sx, sy, width, height) {
            const data = new Uint8ClampedArray(width * height * 4);
            for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
              if (ink && sx + x >= ink.left && sx + x < ink.right && sy + y >= ink.top && sy + y < ink.bottom) data[(y * width + x) * 4 + 3] = 255;
            }
            return { data };
          },
          putImageData() {},
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
  paintTitle(PixelBuffer.alloc(35, 11), shortened, 13, '#ffffff', 0, 8, { x: 0, y: 0, w: 35, h: 11 }, { style: result.style });
  assert.ok(measurements.every(call => call.font.startsWith('bold 11px ') && call.spacing === '0px'));
  assert.equal(paints[0].font, measurements[0].font);
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
  assert.equal(paints.length, 2);
  assert.ok(paints.every(call => call.font.startsWith('bold 11px ') && call.spacing === '0px'));
  assert.ok(paints.every(call => call.text.endsWith('…')));
});

test('impossible slots suppress main and shadow while retaining preferred geometry and accessible title', async () => {
  metrics = () => ({ actualBoundingBoxAscent: 1, actualBoundingBoxDescent: 20 });
  const { view, wt, cicn } = fixture(1);
  const title = 'Full gy';
  const win = await renderWindow(view, { windowType: 'titled-utility-window', title, width: 240 });
  const expected = composeWindowChrome(cicn, wt, 240, 120, { altWidgets: true, titleWidthPx: title.length * 16, titleLength: title.length });
  const actual = win._scriptoscopeComposed;
  assert.equal(paints.length, 0);
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


test('title requests reuse only their last matching measurement and fresh requests remeasure', () => {
  const request = createTitleRequest();
  const style = { family: 'Synthetic', size: 12, bold: false, spacing: '0px' };
  const options = { request, style };
  measureTitle('Same', 12, options);
  const context = request.context;
  measureTitle('Same', 12, options);
  assert.equal(measurements.length, 1);
  assert.equal(request.context, context);
  style.spacing = '1px';
  measureTitle('Same', 12, options);
  assert.equal(measurements.length, 2);
  measureTitle('Other', 12, options);
  measureTitle('Same', 12, options);
  assert.equal(measurements.length, 4);
  const fresh = createTitleRequest();
  measureTitle('Same', 12, { request: fresh, style });
  assert.equal(measurements.length, 5);
  assert.notEqual(fresh.context, context);
});
