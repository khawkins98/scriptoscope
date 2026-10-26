// Implementation-owned counterexamples, not independent acceptance fixtures.
import { createRasterAssetOwner, bindRasterOwner } from '../theme-loader/rasterAssets.js';

async function encode(rgba, width, height) {
  const canvas = new OffscreenCanvas(width, height), ctx = canvas.getContext('2d');
  const pixels = ctx.createImageData(width, height);
  pixels.data.set(rgba); ctx.putImageData(pixels, 0, 0);
  return URL.createObjectURL(await canvas.convertToBlob({ type: 'image/png' }));
}

export function syntheticThemes(guards = false) {
  return (guards ? [
    { name: 'solid-body-without-cinf', slice: { corner: 2, side: 1 }, bgAnchor: [2, 2], guard: 'body branch requires separate preparation' },
    { name: 'pattern-body-without-cinf', slice: { corner: 2, side: 1 }, bodyRequest: { mode: 1, resourceId: 42 }, guard: 'body branch requires separate preparation' },
    { name: 'present-short-cinf', engineCinfs: { '-10166': [0] }, guard: 'short cinf header' },
  ] : [
    { name: 'patterned-middle' },
    { name: 'unequal-insets', slice: { corner: 2, side: 1, tile: false } },
    { name: 'clamped-insets', slice: { corner: 12, side: 10, tile: false } },
    { name: 'partial-alpha', alpha: 128 },
    { name: 'clear-sampled-center', clearCenter: true },
    { name: 'tiled-unequal-insets', slice: { corner: 1, side: 2, tile: true } },
  ]).map(({ name, slice, alpha = 255, clearCenter, bgAnchor, bodyRequest, engineCinfs = {}, guard }) => {
    const width = 9, height = 7, rgba = new Uint8Array(width * height * 4);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const offset = (y * width + x) * 4;
      rgba.set([(x * 37 + y * 11) % 256, (y * 43 + x * 13) % 256, (x * 17 + y * 29) % 256,
        clearCenter && x === 2 && y === 2 ? 0 : alpha], offset);
    }
    const path = `${name}.png`;
    const assets = [{ path, rgba, width, height }];
    if (bodyRequest) assets.push({ path: 'pattern.png', width: 2, height: 2,
      rgba: new Uint8Array([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 0, 255]) });
    const owner = createRasterAssetOwner(assets, encode);
    const source = { manifest: { name: `synthetic:${name}`, chromeElements: {
      face: { sourceCicnId: -10166, asset: path, width, height, ...(slice ? { slice } : {}),
        ...(bgAnchor ? { bgAnchor } : {}), ...(bodyRequest ? { bodyRequest, bodyPattern: 'pattern' } : {}) },
    }, patterns: bodyRequest ? { pattern: { sourcePpatId: 42, asset: 'pattern.png' } } : {}, engineCinfs } };
    bindRasterOwner(source, owner);
    const theme = { kind: 'owned-theme', origin: `synthetic:${name}`, source, imageUrl: owner.imageUrl, dispose: owner.dispose };
    return { name, theme, guard };
  });
}

export function syntheticCases() {
  const cases = [];
  for (const minWidth of [16, 23, 80]) for (const height of [1, 3, 20, 45])
    for (const label of ['', 'Ag']) for (const disabled of [false, true]) for (const fg of [undefined, '#123456', ''])
      for (const clipped of [false, true]) cases.push({ minWidth, height, label, disabled,
        ...(fg === undefined ? {} : { fg }), ...(clipped ? { compositionContext: {
          controlOrigin: [10, 20], portOrigin: [0, 0], patternOrigin: { status: 'unknown' },
          clip: { kind: 'rect', rect: { x: 12, y: 21, w: 11, h: 7 } },
        } } : {}) });
  return cases;
}
