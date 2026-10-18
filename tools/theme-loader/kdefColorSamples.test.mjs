import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeCicn } from './decoders/cicn.js';
import { convertChrome } from './convert.js';
import { loadKaleidoscopeScheme } from './loadKaleidoscopeScheme.js';
import { validateTheme } from './validateTheme.js';
import { forkOf } from '../../tests/resource-provenance/fixtures.mjs';
import { colorIcon, colorInfo } from '../../tests/decoder-fixtures/control-colors.mjs';

const entry = (value, r) => [value, r, 0x4567, 0x89ab];
const sample = (entries, index, flags = 0) => decodeCicn(colorIcon({ entries, pixels: Array(8).fill(index), flags }),
  { retainKdefColorSampler: true }).sampleKdefRgb16(0, 0);

test('kDEF color sampler uses positional match, last-zero shortcut, reverse duplicate and entry0 fallback in source order', () => {
  assert.deepEqual(sample([entry(9, 100), entry(1, 200), entry(1, 300)], 1), [200, 0x4567, 0x89ab]);
  assert.deepEqual(sample([entry(1, 100), entry(8, 200), entry(0, 300)], 1), [200, 0x4567, 0x89ab]);
  assert.deepEqual(sample([entry(1, 100), entry(8, 200), entry(1, 300), entry(9, 400)], 1), [300, 0x4567, 0x89ab]);
  assert.deepEqual(sample([entry(8, 100), entry(9, 200)], 3), [100, 0x4567, 0x89ab]);
  assert.equal(sample([entry(8, 100), entry(0, 200)], 3), null);
  assert.equal(sample([], 0), null);
});

test('kDEF sampler ignores ctFlags while raster decoding continues honoring bit15', () => {
  const entries = [entry(1, 0xffff), entry(0, 0)], bytes = colorIcon({ entries, pixels: Array(8).fill(0), flags: 0x8000 });
  const decoded = decodeCicn(bytes, { retainKdefColorSampler: true });
  assert.equal(decoded.rgba[0], 255); // ordinary raster: palette position0
  assert.deepEqual(decoded.sampleKdefRgb16(0, 0), [0xffff, 0x4567, 0x89ab]); // last-zero positional shortcut
  const reversed = [entry(1, 0xffff), entry(7, 0)];
  assert.deepEqual(sample(reversed, 1, 0x8000), [0xffff, 0x4567, 0x89ab]); // reverse lookup, unlike raster position1
  assert.equal(decodeCicn(colorIcon({ entries: reversed, pixels: Array(8).fill(1), flags: 0x8000 })).rgba[0], 0);
});

test('raw sample ignores mask and nonzero PixMap origin; unsafe coordinates stay unknown', () => {
  const bytes = colorIcon(), decoded = decodeCicn(bytes, { retainKdefColorSampler: true });
  assert.deepEqual([...decoded.rgba.slice(4, 8)], [33, 33, 33, 0]);
  assert.deepEqual(decoded.sampleKdefRgb16(1, 0), [0x2121, 0x2121, 0x2121]);
  for (const [x, y] of [[-1, 0], [0, -1], [4, 0], [0, 2], [0.5, 0], [NaN, 0]]) assert.equal(decoded.sampleKdefRgb16(x, y), null);
  bytes.fill(0); // private expanded samples are no longer coupled to caller bytes
  assert.deepEqual(decoded.sampleKdefRgb16(1, 0), [0x2121, 0x2121, 0x2121]);
  assert.equal(decodeCicn(colorIcon()).sampleKdefRgb16, undefined);
});

const converted = (icon, info = colorInfo()) => convertChrome(forkOf([
  { type: 'cicn', id: -10239, data: icon }, ...(info ? [{ type: 'cinf', id: -10239, data: info }] : []),
]));
const colors = (icon, info) => Object.values(converted(icon, info).theme.chromeElements)[0].colorSamples;
test('exact RGB16 emboss decisions survive mask loss, high-byte collisions and sentinel-shaped red', () => {
  const fixture = (bg, emboss) => colorIcon({ entries: [[0, ...bg], [1, 0x2121, 0x2121, 0x2121], [2, ...emboss]], pixels: [0, 1, 2, 0, 0, 0, 0, 0] });
  const info = colorInfo({ emboss: [2, 0] });
  assert.equal(colors(fixture([0x12aa, 3, 4], [0x12aa, 3, 4]), info).embossDecision, 'same-as-background');
  const unequal = colors(fixture([0x12aa, 3, 4], [0x12bb, 3, 4]), info);
  assert.equal(unequal.embossDecision, 'present');
  assert.deepEqual(unequal.background.displayRgb, unequal.emboss.displayRgb);
  assert.equal(colors(fixture([0, 0, 0], [0x1234, 7, 9]), info).embossDecision, 'sentinel');
  for (const red of [0x1200, 0x12ff]) assert.equal(colors(fixture([0, 0, 0], [red, 7, 9]), info).embossDecision, 'present');
  const absent = colors(fixture([0x1234, 7, 9], [0, 0, 0]), colorInfo());
  assert.equal(absent.embossDecision, 'absent-coordinates'); assert.equal(absent.emboss, null);
  const unknown = colors(fixture([0, 0, 0], [1, 2, 3]), colorInfo({ background: [-1, 0], emboss: [2, 0] }));
  assert.equal(unknown.embossDecision, 'unknown'); assert.deepEqual(unknown.text.rgb16, [0x2121, 0x2121, 0x2121]);
});

test('actual last cinf controls samples; scalar metadata survives conversion without retained sampler or double display transform', () => {
  const result = convertChrome(forkOf([{ type: 'cicn', id: -10239, data: colorIcon() },
    { type: 'cinf', id: -10239, data: colorInfo({ text: [0, 0] }) },
    { type: 'cinf', id: -10239, data: colorInfo() }]));
  const metadata = Object.values(result.theme.chromeElements)[0].colorSamples;
  assert.deepEqual(metadata.text.rgb16, [0x2121, 0x2121, 0x2121]);
  assert.deepEqual(metadata.text.displayRgb, [48, 48, 48]);
  assert.deepEqual([...result.assets[0].rgba.slice(4, 8)], [48, 48, 48, 0]);
  const inspect = value => { if (ArrayBuffer.isView(value)) return; assert.notEqual(typeof value, 'function');
    if (value && typeof value === 'object') for (const [key, child] of Object.entries(value)) { assert.notEqual(key, 'sampleKdefRgb16'); inspect(child); } };
  inspect(result);
  assert(Object.isFrozen(metadata)); assert(Object.isFrozen(metadata.text.rgb16));
  assert.equal(colors(colorIcon(), null), null);
});

test('manifest ingress accepts legacy unknowns and rejects malformed sample models, channels and decisions', () => {
  const theme = converted(colorIcon()).theme;
  validateTheme(theme);
  for (const value of [undefined, null]) { const copy = structuredClone(theme); Object.values(copy.chromeElements)[0].colorSamples = value;
    if (value === undefined) delete Object.values(copy.chromeElements)[0].colorSamples; validateTheme(copy); }
  for (const mutate of [c => { c.model = 'original-certified'; }, c => { c.text.rgb16[0] = 65536; }, c => { c.text.displayRgb[0] = 1.5; },
    c => { c.text.displayRgb[0] = 255; }, c => { delete c.background; }, c => { c.embossDecision = 'present'; }, c => { c.embossDecision = 'anything'; }]) {
    const copy = structuredClone(theme); mutate(Object.values(copy.chromeElements)[0].colorSamples); assert.throws(() => validateTheme(copy), /colorSamples/);
  }
});

test('duplicate actual cicn paths cannot certify sample/image identity; observed loads reject before encoding', async () => {
  const first = colorIcon({ entries: [[0, 0xffff, 0, 0]], pixels: Array(8).fill(0), mask: [0xf0, 0xf0] });
  const second = colorIcon({ entries: [[0, 0, 0, 0xffff]], pixels: Array(8).fill(0), mask: [0xf0, 0xf0] });
  const bytes = forkOf([{ type: 'cicn', id: -10239, name: 'same', data: first },
    { type: 'cicn', id: -10239, name: 'same', data: second }, { type: 'cinf', id: -10239, data: colorInfo() }]);
  const encoded = [];
  const theme = await loadKaleidoscopeScheme(bytes, { encodeAssets: true,
    assetUrlFactory: rgba => { encoded.push([...rgba.slice(0, 4)]); return `test:${encoded.length}`; } });
  assert.deepEqual(encoded, [[255, 0, 0, 255], [0, 0, 255, 255]]);
  for (const entry of Object.values(theme.manifest.chromeElements)) {
    assert.equal(entry.asset, 'test:2'); assert.equal(entry.colorSamples, null);
    assert.equal(entry.colorSamplesUnavailableReason, 'ambiguous-asset-path');
  }
  let allocations = 0;
  await assert.rejects(loadKaleidoscopeScheme(bytes, { provenance: true, encodeAssets: true,
    assetUrlFactory: () => { allocations++; return 'test:unexpected'; } }), /duplicate cicn asset binding/);
  assert.equal(allocations, 0);
});
