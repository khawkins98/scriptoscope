// Implementation checks derived only from engine/header.md; no acceptance inputs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import ts from 'typescript';
registerHooks({
  resolve(specifier, context, next) {
    if (specifier.endsWith('.js') && context.parentURL?.startsWith('file:')) {
      const alternate = new URL(specifier.replace(/\.js$/, '.ts'), context.parentURL);
      if (existsSync(alternate)) return next(alternate.href, context);
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.endsWith('.ts')) return { format: 'module', shortCircuit: true,
      source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText };
    return next(url, context);
  },
});
const { PixelBuffer } = await import('../../pixelBuffer.js');
const { snapshotControlComposition } = await import('../../controlComposition.js');
const { headerResourceId, planHeaderSurface, planHeaderGeometry, drawHeaderSurface, planHeaderColumns, drawHeaderColumns } = await import('../index.js');
const context = (extra = {}) => snapshotControlComposition({ controlOrigin: [0, 0], portOrigin: [0, 0], patternOrigin: { status: 'api-unavailable' }, clip: { kind: 'unbounded' }, ...extra });
const plan = (extra = {}) => planHeaderSurface({ kind: 'window-header', width: 8, height: 8, drawState: 1, context: context(), ...extra });
const solid = (w, h, color) => { const p = PixelBuffer.alloc(w, h); p.fillRect({ x: 0, y: 0, w, h }, ...color); return p; };
const bg = { r: 10, g: 20, b: 30, a: 255 };
test('raw state dispatch and compatibility inactive use their finite policies', () => {
  assert.equal(headerResourceId(0), -9568);
  for (const state of [1, 2, 4294967295]) assert.equal(headerResourceId(state), -9567);
  assert.equal(headerResourceId(true), -9568); assert.equal(headerResourceId(false), -9567);
});
test('list-view extends geometry before cropping the requested plane', () => {
  const p = plan({ kind: 'list-view-header', width: 5, height: 5 });
  const g = planHeaderGeometry({ width: 4, height: 4 }, { corner: 1, side: 1, tile: true }, p);
  assert.equal(p.paintRect.h, 6); assert.equal(g.bands[3].destination.y, 5);
  assert.equal(g.bands[3].visible, false);
});
test('clipped pattern uses translated absolute anchor without resetting phase', () => {
  const p = plan({ width: 7, height: 4, context: context({ controlOrigin: [-3, 2], portOrigin: [18, -6],
    patternOrigin: { status: 'known', offset: [1, 0] }, clip: { kind: 'rect', rect: { x: -1, y: 2, w: 3, h: 4 } } }) });
  const pattern = PixelBuffer.alloc(2, 1); pattern.setPixel(0, 0, 12, 0, 0, 255); pattern.setPixel(1, 0, 24, 0, 0, 255);
  const out = PixelBuffer.alloc(7, 4);
  const r = drawHeaderSurface(out, { source: solid(2, 2, [0, 0, 0, 0]), plan: p, slice: { corner: 0, side: 0, tile: true }, mode: 0, pattern });
  assert.equal(r.painted, true); assert.equal(r.patternBody.paintedPixels, 12);
  assert.deepEqual(out.getPixel(2, 1), [12, 0, 0, 255]); assert.deepEqual(out.getPixel(3, 1), [24, 0, 0, 255]);
  assert.equal(out.getPixel(1, 1)[3], 0); assert.equal(out.getPixel(5, 1)[3], 0);
});
test('sampled companion supplies lines and leaves ordinary corners source colored', () => {
  const source = solid(3, 3, [210, 0, 0, 255]), sampled = solid(3, 3, [60, 60, 60, 255]);
  const out = PixelBuffer.alloc(8, 8);
  const r = drawHeaderSurface(out, { source, sampled, plan: plan(), slice: { corner: 1, side: 1, tile: false }, mode: 0, background: bg });
  assert.equal(r.lineSampling, 'sampled-companion'); assert.equal(r.sampledRegions.length, 4);
  assert.deepEqual(out.getPixel(0, 0), [210, 0, 0, 255]); assert.deepEqual(out.getPixel(3, 0), [60, 60, 60, 255]);
  assert.deepEqual(out.getPixel(3, 3), [10, 20, 30, 255]);
});
test('invalid companion admits no partial paint', () => {
  const source = solid(3, 3, [210, 0, 0, 255]), sampled = solid(3, 3, [60, 60, 60, 255]); sampled.data[3] = 0;
  const out = PixelBuffer.alloc(8, 8);
  const r = drawHeaderSurface(out, { source, sampled, plan: plan(), slice: { corner: 1, side: 1, tile: false }, mode: 0, background: bg });
  assert.equal(r.unsupported, 'unverified-line-sampling'); assert.equal(out.data.some(Boolean), false);
});
test('empty clip needs neither color nor sampled pixels and claims no paint', () => {
  const p = plan({ context: context({ clip: { kind: 'rect', rect: { x: 0, y: 0, w: 0, h: 8 } } }) });
  const out = PixelBuffer.alloc(8, 8);
  const r = drawHeaderSurface(out, { source: solid(3, 3, [210, 0, 0, 255]), plan: p, slice: { corner: 1, side: 1, tile: false }, mode: 0 });
  assert.equal(r.unsupported, undefined); assert.equal(r.painted, false); assert.equal(r.lineSampling, 'not-required');
});
test('columns preserve empty lists and crop glyphs to each narrow cell', () => {
  const source = solid(5, 5, [100, 100, 100, 255]);
  const empty = planHeaderColumns({ source, columns: [], hasBgPattern: false }); assert.equal(empty.width, 0); assert.equal(empty.height, 16);
  const p = planHeaderColumns({ source, columns: [{ label: 'wide', width: 7 }, { label: '', width: 3 }], height: 2, hasBgPattern: false });
  const out = PixelBuffer.alloc(p.width, p.height), glyph = solid(8, 2, [255, 255, 255, 255]);
  drawHeaderColumns(out, { source, plan: p, glyphs: [glyph, null] });
  assert.equal(p.height, 16); assert.equal(out.getPixel(6, 7)[0], 255); assert.equal(out.getPixel(7, 7)[0], 100);
});

const { composeEngineHeaderSurface, composeEngineHeaderColumns } = await import('../../headerFacade.js');
const { prepareDisplayProfile, DisplayProfileError } = await import('../../../tools/theme-loader/display-profile.js');
const assets = new Map();
const loads = [];
globalThis.Image = class {
  async decode() {
    loads.push(this.src);
    const entry = assets.get(this.src);
    if (!entry) throw new Error(`Unregistered owned fixture ${this.src}`);
    if (entry.error) throw entry.error;
    if (entry.wait) await entry.wait;
    this.pixels = entry.pixels;
    this.naturalWidth = entry.pixels.width; this.naturalHeight = entry.pixels.height;
  }
};
globalThis.document = { createElement(name) {
  assert.equal(name, 'canvas');
  let image;
  return { width: 0, height: 0, getContext() { return { drawImage(value) { image = value; },
    getImageData() { return { data: new Uint8ClampedArray(image.pixels.data) }; } }; } };
} };
const wholeOptions = extra => ({ kind: 'window-header', width: 4, height: 4, drawState: 1,
  compositionContext: { controlOrigin: [0, 0], portOrigin: [0, 0], patternOrigin: { status: 'api-unavailable' }, clip: { kind: 'unbounded' } }, ...extra });
const theme = (asset, element = {}) => ({ baseUrl: 'https://owned.invalid', manifest: { name: 'owned fixture', windowTypes: {}, chromeElements: {
  face: { asset, width: 3, height: 3, sourceCicnId: -9567, slice: { corner: 0, side: 0, tile: false }, bodyRequest: { mode: 0, resourceId: 0 }, ...element },
} } });
test('facade retains registered profile capability and descriptors across the face await', async () => {
  const profile = await prepareDisplayProfile({ version: 1, conditions: { own: true }, evidence: [{ sha256: 'a'.repeat(64), description: 'owned synthetic mapping' }],
    producer: { model: 'rgb16-high-byte-table', channels: Array.from({ length: 3 }, () => Array.from({ length: 256 }, (_, i) => i)) },
    devicePalette: [{ index: 0, rgb16: [1280, 2560, 3840] }], mappings: [{ rgb16: [1000, 2000, 3000], deviceIndex: 0, deviceRgb16: [1280, 2560, 3840] }] });
  let release;
  const url = 'https://owned.invalid/profile-face.png';
  assets.set(url, { pixels: solid(3, 3, [0, 0, 0, 255]), wait: new Promise(resolve => { release = resolve; }) });
  const owner = theme('profile-face.png', { bgAnchor: [0, 0], colorSamples: { model: 'kdef-2.3.1-color', displayPolicy: profile.id,
    background: { rgb16: [1000, 2000, 3000], displayRgb: [5, 10, 15] } } });
  owner.manifest.displayProfile = profile;
  let trace;
  const options = wholeOptions({ diagnostics: { onComplete(value) { trace = value; } } });
  const pending = composeEngineHeaderSurface(owner, options);
  owner.manifest.chromeElements.face.slice.corner = 20;
  owner.manifest.chromeElements.face.colorSamples.background.rgb16[0] = 65000;
  owner.manifest.displayProfile = { id: profile.id, data: profile.data };
  owner.baseUrl = 'https://changed.invalid'; options.compositionContext.controlOrigin[0] = 100;
  release();
  const result = await pending;
  assert.equal(result.status, 'rendered'); assert.deepEqual(result.buffer.getPixel(1, 1), [5, 10, 15, 255]);
  const paint = trace.steps.find(step => step.role === 'face' && step.usage === 'paint');
  assert.equal(paint.resource.assetUrl, url); assert.deepEqual(trace.headerSurface.context.controlOrigin, [0, 0]);
  assert.equal(Object.isFrozen(trace), true);
});
test('decode failure identity wins over diagnostic callback failure and completes once', async () => {
  const error = new Error('owned face decode failure');
  assets.set('https://owned.invalid/broken-face.png', { error });
  let calls = 0;
  await assert.rejects(composeEngineHeaderSurface(theme('broken-face.png'), wholeOptions({ diagnostics: { onComplete(trace) {
    calls++; assert.equal(trace.headerSurface.admission, 'error'); throw new Error('owned callback failure');
  } } })), value => value === error);
  assert.equal(calls, 1);
});
test('entire profile chain is guarded even when root has the selected face', async () => {
  const owner = theme('guard-face.png'); owner.base = theme('unused.png'); owner.base.manifest.displayProfile = { id: 'unregistered' };
  const before = loads.length;
  await assert.rejects(composeEngineHeaderSurface(owner, wholeOptions()), DisplayProfileError);
  assert.equal(loads.length, before);
});
test('columns capture caller columns before asset loading', async () => {
  let release;
  assets.set('https://owned.invalid/columns-face.png', { pixels: solid(3, 3, [50, 50, 50, 255]), wait: new Promise(resolve => { release = resolve; }) });
  const columns = [{ label: '', width: 5 }], options = { columns, height: 17 };
  const pending = composeEngineHeaderColumns(theme('columns-face.png'), options);
  columns[0].width = 99; options.height = 99; release();
  const result = await pending; assert.equal(result.width, 5); assert.equal(result.height, 17);
});
test('empty clip still admits structural metadata while skipping body and companion IO', async () => {
  const owner = theme('empty-face.png', { slice: { corner: 1, side: 1, tile: false },
    bodyPattern: 'unneeded', sampledBandAsset: { model: 'kaleidoscope-2.3.1-opaque-sampling-v1', comparison: 'opaque-current-display-rgb',
      displayPolicy: 'mac-1.8-to-2.2-high-byte', width: 3, height: 3, asset: 'unneeded-companion.png', derivedPath: 'cicn-sampled/unused.png' } });
  owner.manifest.patterns = { unneeded: { sourcePpatId: 0, asset: 'unneeded-pattern.png' } };
  assets.set('https://owned.invalid/empty-face.png', { pixels: solid(3, 3, [200, 0, 0, 255]) });
  let trace;
  const options = wholeOptions({ diagnostics: { onComplete(value) { trace = value; } } });
  options.compositionContext.clip = { kind: 'rect', rect: { x: 0, y: 0, w: 0, h: 4 } };
  const before = loads.length, result = await composeEngineHeaderSurface(owner, options);
  assert.equal(result.status, 'rendered'); assert.equal(result.buffer.data.some(Boolean), false);
  assert.equal(trace.headerSurface.painted, false); assert.deepEqual(loads.slice(before), ['https://owned.invalid/empty-face.png']);
  assert.equal(trace.steps.some(step => step.usage === 'paint'), false);
  owner.manifest.chromeElements.face.slice.corner = -1;
  assert.equal((await composeEngineHeaderSurface(owner, options)).reason, 'invalid-slice');
});
test('observed undecoded same-owner patterns never turn into solid fallback', async () => {
  const owner = theme('observed-face.png'); owner.inspector = { ppatResources: [{ id: 0, resourceIndex: 0, byteLength: 0 }] };
  assets.set('https://owned.invalid/observed-face.png', { pixels: solid(3, 3, [200, 0, 0, 255]) });
  assert.equal((await composeEngineHeaderSurface(owner, wholeOptions())).reason, 'ambiguous-body-selection');
});
