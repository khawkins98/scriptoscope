// Browser-only declared transport inputs. No runtime imports or expected-output
// assembly. Original coordinate/sample contract: engine/tab.md B/C/P and AD.
import { TAB_ENGINE_INPUT, TAB_ENGINE_PATTERN, TAB_ENGINE_PALETTE as colors } from './tab-engine-rules.mjs';
export function tabFixture(api, { id = -9975, mode = 0, request = 17, pattern = true, tile = true, maskedBackground = false, sourceRows = TAB_ENGINE_INPUT } = {}) {
  const image = rows => {
    const out = api.PixelBuffer.alloc(rows[0].length, rows.length);
    rows.forEach((row, y) => [...row].forEach((key, x) => { if (key !== '.') out.setPixel(x, y, ...colors[key]); }));
    return api.bufferToCanvas(out).toDataURL();
  };
  const rows = [...sourceRows];
  if (maskedBackground) rows[2] = rows[2].slice(0, 3) + '.' + rows[2].slice(4);
  const asset = image(rows), width = rows[0].length, height = rows.length;
  const source = { id, resourceIndex: 0, byteLength: 1, bounds: { top: 0, left: 0, bottom: height, right: width } };
  const policy = 'mac-1.8-to-2.2-high-byte';
  const proof = { model: 'kaleidoscope-2.3.1-opaque-sampling-v1', comparison: 'opaque-current-display-rgb', displayPolicy: policy, width, height,
    status: 'equivalent', reason: 'all-opaque-display-rgb-equal' };
  const sample = { rgb16: [8481, 34952, 8481], displayRgb: colors.Z.slice(0, 3) };
  const cinf = [1, 1, tile ? 1 : 0, mode, request >> 8 & 255, request & 255, 0, 2, 0, 3, 0, 2, 0, 3, 0, 2, 0, 3];
  const element = { sourceCicnId: id, sourceCinfId: id, asset, width, height, boundsOrigin: { top: 0, left: 0 }, cicnSource: source,
    slice: { corner: 1, side: 1, tile }, bodyRequest: { mode, resourceId: request }, bgAnchor: [3, 2],
    colorSamples: { model: 'kdef-2.3.1-color', displayPolicy: policy, background: sample, text: sample, emboss: sample, embossDecision: 'same-as-background' },
    engineColorSamples: { model: 'kdef-2.3.1-engine-points', source, asset, width, height, displayPolicy: policy, points: { '3,2': sample } },
    samplingEquivalence: proof };
  const patterns = pattern ? { chosen: { sourcePpatId: request, asset: image(TAB_ENGINE_PATTERN), width: 3, height: 2 } } : {};
  const owner = { baseUrl: location.origin, manifest: { chromeElements: { chosen: element }, patterns, engineCinfs: { [id]: cinf } },
    inspector: { cicnResources: [source], ppatResources: pattern ? [{ id: request, resourceIndex: 2, byteLength: 1 }] : [] } };
  return { owner, element, cinf, image, colors, source, sample, policy, proof };
}
export function tabPixels(buffer) {
  if (!buffer) return null;
  const keys = Object.keys(colors);
  return Array.from({ length: buffer.height }, (_, y) => Array.from({ length: buffer.width }, (_, x) => {
    const p = buffer.getPixel(x, y); if (!p[3]) return '.';
    return keys.find(k => colors[k].every((v, i) => v === p[i])) ?? '?';
  }).join(''));
}
