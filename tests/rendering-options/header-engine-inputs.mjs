// Synthetic current-display inputs; no production selection or drawing logic.
import { markerRgba } from './header-engine-oracle.mjs';
export const POLICY = 'mac-1.8-to-2.2-high-byte';
export function markerImage(api, rows) {
  const pixels = rows.flatMap(row => [...row].flatMap(markerRgba));
  return new api.PixelBuffer(rows[0]?.length ?? 0, rows.length, new Uint8ClampedArray(pixels));
}
export function imageUrl(api, rows) {
  return api.bufferToCanvas(markerImage(api, rows)).toDataURL();
}
export function headerTheme(api, fixture) {
  const source = fixture.source, width = source[0].length, height = source.length;
  const asset = imageUrl(api, source);
  const proof = { model: 'kaleidoscope-2.3.1-opaque-sampling-v1', comparison: 'opaque-current-display-rgb',
    width, height, displayPolicy: POLICY };
  const element = { sourceCicnId: -9567, sourceCinfId: -9567, asset, width, height,
    slice: { corner: fixture.corner ?? 2, side: fixture.side ?? 3, tile: fixture.tile },
    bodyRequest: { mode: fixture.patternMode ?? 0, resourceId: 0 }, bgAnchor: [3, 3],
    colorSamples: { model: 'kdef-2.3.1-color', displayPolicy: POLICY,
      background: { rgb16: [8481, 8481, 8481], displayRgb: [48, 48, 48] } },
    samplingEquivalence: { ...proof, status: 'equivalent', reason: 'all-opaque-display-rgb-equal' } };
  if (fixture.sampled) {
    delete element.samplingEquivalence;
    const companion = source.map(row => [...row].map(c => c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase()).join(''));
    element.sampledBandAsset = { ...proof, asset: imageUrl(api, companion), derivedPath: 'cicn-sampled/header-engine.png' };
  }
  const patterns = {};
  if (fixture.patternMode !== undefined) {
    patterns.pattern = { sourcePpatId: 0, asset: imageUrl(api, ['0123', '4567']), width: 4, height: 2 };
    element.bodyPattern = 'pattern';
  }
  return { baseUrl: '', manifest: { chromeElements: { face: element }, patterns } };
}
export function headerOptions(fixture) {
  const [x, y] = fixture.origin;
  const clip = fixture.clip;
  return { kind: fixture.kind, width: fixture.width, height: fixture.height, drawState: 1,
    compositionContext: { controlOrigin: [x, y], portOrigin: [13, -11],
      patternOrigin: { status: 'known', offset: fixture.offset },
      clip: clip ? { kind: 'rect', rect: { x: x + clip[0], y: y + clip[1], w: clip[2], h: clip[3] } } : { kind: 'unbounded' } } };
}
