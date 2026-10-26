// Implementation-owned regression probes for the captured-face adapter seam.
import '../tests/helpers/registerTs.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
const { prepareThemeIcon } = await import('./engine/resources/theme.ts');
const { ResourceChain, mapProvider } = await import('./engine/resources/chain.ts');
const { drawCinfFrame, drawPreparedCinfFrame } = await import('./engine/qd/cinfFrame.ts');
const { PixelBuffer } = await import('./pixelBuffer.ts');
const { createTrace } = await import('./engine/trace.ts');
const { rect } = await import('./engine/qd/rect.ts');
import { LEGACY_DISPLAY_POLICY } from '../tools/theme-loader/display-profile.js';

const frame = { cornerSize: 1, sideThickness: 1, tileSides: 0, patternAnchor: 5, bgPatternId: -10162,
  bgPixel: { x: 1, y: 1 }, textPixel: { x: 1, y: 1 }, embossPixel: { x: 0, y: 0 } };
const selection = { owner: { baseUrl: 'captured', chainDepth: 2 },
  resource: { type: 'cicn', signedId: 10162, sourceCinfId: -10162, manifestKey: 'positive-alias', assetUrl: 'captured-image' } };
function raster(pixels, counters) {
  return { key: 'captured-raster', pixels() { counters.pixels++; return Promise.resolve(pixels); },
    imageUrl() { counters.images++; return Promise.resolve('captured-image'); } };
}

test('a captured face is not decoded again or confused with a body at the same request ID', async () => {
  const face = PixelBuffer.alloc(4, 4), body = PixelBuffer.alloc(2, 2);
  face.fillRect({ x: 0, y: 0, w: 4, h: 4 }, 20, 30, 40, 255);
  body.fillRect({ x: 0, y: 0, w: 2, h: 2 }, 90, 100, 110, 255);
  const counters = { pixels: 0, images: 0 };
  const theme = { manifest: {}, inspector: undefined, asset() { throw new Error('No unselected asset should load'); } };
  const prepared = await prepareThemeIcon(theme, 10162, { asset: 'face' }, raster(face, counters), { pixels: face, lazySamples: true });
  assert.equal(prepared.icon.pixmap, face);
  assert.deepEqual(counters, { pixels: 0, images: 0 });
  const bodyProvider = mapProvider('body', 'archive', [['cicn:-10162', { pixmap: body, pixelSize: 1, unmasked: null }]]);
  const chain = new ResourceChain([bodyProvider, mapProvider('metadata', 'cinf', [['cinf:-10162', frame]])], bodyProvider);
  const trace = createTrace('bevel-button');
  trace.controlPaint = { bodies: [], bands: [] };
  const out = PixelBuffer.alloc(4, 4);
  const result = drawCinfFrame(out, chain, { id: -10162, cicn: face, icon: prepared.icon,
    dstRect: rect(0, 0, 4, 4), bodyFill: true, selection }, trace);
  assert.equal(result.drawn, true);
  assert.deepEqual(out.getPixel(1, 1), [90, 100, 110, 255]);
  assert.deepEqual(out.getPixel(0, 0), [20, 30, 40, 255]);
  assert.equal(trace.controlPaint.bands[0].resource.signedId, 10162);
  assert.equal(trace.controlPaint.bands[0].owner.chainDepth, 2);
});

test('finite samples bind to the selected positive occurrence rather than its negative lookup alias', async () => {
  const face = PixelBuffer.alloc(4, 4), counters = { pixels: 0, images: 0 };
  const occurrence = { id: 10162, resourceIndex: 7, byteLength: 64, bounds: { top: 0, left: 0, bottom: 4, right: 4 } };
  const element = { asset: 'face', sourceCicnId: 10162, cicnSource: occurrence,
    engineColorSamples: { model: 'kdef-2.3.1-engine-points', source: occurrence, asset: 'face', width: 4, height: 4,
      displayPolicy: LEGACY_DISPLAY_POLICY, points: { '1,1': { rgb16: [256, 512, 768] } } } };
  const theme = { manifest: {}, inspector: { cicnResources: [occurrence] } };
  const prepared = await prepareThemeIcon(theme, 10162, element, raster(face, counters), { pixels: face });
  assert.deepEqual(prepared.icon.sampleRgb16({ x: 1, y: 1 }), [256, 512, 768]);
  const impostor = { ...element, cicnSource: { ...occurrence } };
  const unbound = await prepareThemeIcon(theme, 10162, impostor, raster(face, counters), { pixels: face });
  assert.equal(unbound.icon.sampleRgb16({ x: 1, y: 1 }), null);
});

test('captured sampler preparation stays lazy and obeys its lifetime before loading', async () => {
  const face = PixelBuffer.alloc(4, 4), counters = { pixels: 0, images: 0 };
  const proof = { model: 'kaleidoscope-2.3.1-opaque-sampling-v1', comparison: 'opaque-current-display-rgb',
    displayPolicy: LEGACY_DISPLAY_POLICY, width: 4, height: 4, status: 'different', reason: 'opaque-display-mismatch' };
  let ended = false;
  const theme = { manifest: {}, asset: () => raster(face, counters) };
  const prepared = await prepareThemeIcon(theme, -10162, { asset: 'face', samplingEquivalence: proof,
    sampledBandAsset: { ...proof, asset: 'sample', derivedPath: 'cicn-sampled/sample.png' } }, raster(face, counters),
  { pixels: face, lazySamples: true, ended: () => ended });
  assert.deepEqual(counters, { pixels: 0, images: 0 });
  ended = true;
  await assert.rejects(prepared.icon.prepareSampled(), { name: 'AbortError' });
  assert.equal(counters.pixels, 0);
});

const { composeBevelButton } = await import('./controls.ts');
const { createRasterAssetOwner, bindRasterOwner } = await import('../tools/theme-loader/rasterAssets.js');
function aliasTheme(id) {
  const rgba = new Uint8Array(9 * 9 * 4).fill(255);
  const owner = createRasterAssetOwner([{ path: 'face', width: 9, height: 9, rgba }], () => 'data:image/png;public-probe');
  const source = { manifest: { name: 'alias-probe', windowTypes: {}, chromeElements: {
    face: { asset: 'face', width: 9, height: 9, sourceCicnId: id, sourceCinfId: id,
      slice: { corner: 2, side: 1, tile: true }, bodyRequest: { mode: 0, resourceId: 0 }, bgAnchor: [4, 4] },
  }, patterns: {}, engineCinfs: { [id]: [2, 1, 1, 0, 0, 0, 0, 4, 0, 4, 0, 4, 0, 4, 0, 0, 0, 0] } } };
  bindRasterOwner(source, owner);
  return { kind: 'owned-theme', origin: 'alias-probe', source, imageUrl: owner.imageUrl, dispose: owner.dispose };
}
test('positive face aliases consume their matching positive cinf rather than an absent negative key', async () => {
  const negative = aliasTheme(-10163), positive = aliasTheme(10163);
  try {
    const a = await composeBevelButton(negative, { on: true });
    const b = await composeBevelButton(positive, { on: true });
    assert.ok(a && b);
    assert.deepEqual(b.data, a.data);
  } finally { negative.dispose(); positive.dispose(); }
});

test('prepared body diagnostics retain depth relative to the original invocation', async () => {
  const { themeResourceChain } = await import('./engine/resources/theme.ts');
  const { themeView } = await import('./ownedTheme.ts');
  const rgba = new Uint8Array([10, 20, 30, 255]);
  const owner = createRasterAssetOwner([{ path: 'pattern', width: 1, height: 1, rgba }], () => 'data:image/png;public-probe');
  const source = { manifest: { name: 'body-owner', chromeElements: {}, patterns: { pattern: { asset: 'pattern', sourcePpatId: 17 } } } };
  bindRasterOwner(source, owner);
  const input = { kind: 'owned-theme', origin: 'body-owner', source, imageUrl: owner.imageUrl, dispose: owner.dispose };
  try {
    const theme = themeView(input);
    const chain = await themeResourceChain(theme, [], { ownerDepth: 2, traceProvenance: true,
      bodyEnvironment: { owner: theme, face: { bodyPattern: 'pattern' }, width: 8, height: 8, requests: [{ type: 'ppat', id: 17 }] } });
    assert.deepEqual(chain.bodyProvider.selection('ppat', 17).owner, { baseUrl: 'body-owner', chainDepth: 2 });
  } finally { input.dispose(); }
});

test('valid supplied solid metadata renders independently of absent or malformed raw cinf', async () => {
  for (const raw of [undefined, [0]]) {
    const theme = aliasTheme(-10163);
    try {
      theme.source.manifest.engineCinfs = raw ? { '-10163': raw } : {};
      delete theme.source.manifest.chromeElements.face.bodyRequest;
      const out = await composeBevelButton(theme, { on: true });
      assert.deepEqual(out.getPixel(4, 4), [255, 255, 255, 255]);
    } finally { theme.dispose(); }
  }
});

test('prepared border retains both source-over stages for fractional alpha', async () => {
  const face = PixelBuffer.alloc(9, 9), out = PixelBuffer.alloc(22, 9);
  face.fillRect({ x: 0, y: 0, w: 9, h: 9 }, 255, 255, 255, 128);
  const result = await drawPreparedCinfFrame(out, { id: -10163, cicn: face,
    icon: { pixmap: face, pixelSize: null, unmasked: null }, dstRect: rect(0, 0, 9, 22), bodyFill: true },
    { allocate: PixelBuffer.alloc, geometry: { cornerSize: 2, sideThickness: 1, tileSides: true }, bodyMode: 0, bodyId: 0,
      background: null, rawBackground: false, bodyProvider: mapProvider('empty-body', 'archive', []) });
  assert.equal(result.drawn, true);
  assert.deepEqual(out.getPixel(0, 0), [64, 64, 64, 128]);
});

test('prepared compatibility sampling needs no equivalence proof and exports only on visible demand', async () => {
  const face = PixelBuffer.alloc(5, 5);
  face.fillRect({ x: 0, y: 0, w: 5, h: 5 }, 30, 40, 50, 255);
  const sentinel = new Error('sample-export-failure');
  const counts = { decodes: 0, images: 0 };
  const descriptor = { model: 'kaleidoscope-2.3.1-opaque-sampling-v1', comparison: 'opaque-current-display-rgb',
    displayPolicy: LEGACY_DISPLAY_POLICY, width: 5, height: 5, asset: 'sampled', derivedPath: 'cicn-sampled/public.png' };
  const theme = { manifest: {}, asset: () => ({ key: 'sampled',
    async pixels() { counts.decodes++; return face; },
    async imageUrl() { counts.images++; throw sentinel; } }) };
  const prepared = await prepareThemeIcon(theme, -10166, { asset: 'face', sampledBandAsset: descriptor },
    { key: 'face', async imageUrl() { return 'face-image'; } },
    { pixels: face, traceProvenance: true, lazySamples: true, sampling: { equivalent: false, descriptor } });
  const geometry = { cornerSize: 2, sideThickness: 1, tileSides: false }, out = PixelBuffer.alloc(16, 6);
  const frame = { allocate: PixelBuffer.alloc, geometry, bodyMode: 0, bodyId: 0, background: null, rawBackground: false,
    bodyProvider: mapProvider('empty-body', 'archive', []) };
  const input = { id: -10166, cicn: face, icon: prepared.icon, dstRect: rect(0, 0, 6, 16), bodyFill: true, selection };
  await drawPreparedCinfFrame(out, input, frame, undefined, rect(0, 0, 0, 0));
  assert.deepEqual(counts, { decodes: 0, images: 0 });
  const bands = [];
  await assert.rejects(drawPreparedCinfFrame(out, input, frame, undefined, undefined, { bandPaint: band => bands.push(band) }),
    error => error === sentinel);
  assert.deepEqual(bands.map(band => band.region), [0, 1]);
  assert.deepEqual(counts, { decodes: 1, images: 1 });
});

test('prepared borders normalize negative corners independently of raw body insets', async () => {
  const width = 5, height = 5, rgba = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) rgba.set([10 + x, 20, 30, 255], (y * width + x) * 4);
  const owner = createRasterAssetOwner([{ path: 'face', width, height, rgba }], () => 'unused-image');
  const source = { manifest: { chromeElements: { face: { asset: 'face', width, height, sourceCicnId: -10163,
    slice: { corner: -1, side: 1, tile: true }, bgAnchor: [0, 2] } } } };
  bindRasterOwner(source, owner);
  const theme = { kind: 'owned-theme', origin: 'geometry-probe', source, imageUrl: owner.imageUrl, dispose: owner.dispose };
  try {
    const out = await composeBevelButton(theme, { on: true, minWidth: 16, height: 5 });
    assert.deepEqual([5, 6, 7, 8].map(x => out.getPixel(x, 0)[0]), [10, 11, 12, 13]);
    const fractional = await composeBevelButton(theme, { on: true, minWidth: 16.5, height: 5.5 });
    assert.equal(fractional.width, 16.5);
    assert.equal(fractional.height, 5.5);
  } finally { theme.dispose(); }
});
