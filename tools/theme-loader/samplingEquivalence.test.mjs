import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeCicn } from './decoders/cicn.js';
import { loadKaleidoscopeScheme } from './loadKaleidoscopeScheme.js';
import { compareOpaqueSampling } from './sampling-equivalence.js';
import { validateTheme } from './validateTheme.js';
import { forkOf } from '../../tests/resource-provenance/fixtures.mjs';
import { colorIcon } from '../../tests/decoder-fixtures/control-colors.mjs';
const red = [65535, 0, 0], green = [0, 65535, 0], blue = [0, 0, 65535], black = [0, 0, 0];
const icon = opts => colorIcon({ origin: 0, mask: [0xf0, 0xf0], ...opts });
const decode = (entries, index, flags = 0, extra = {}) => decodeCicn(icon({ entries, pixels: Array(8).fill(index), flags, ...extra }));
const expectStatus = (actual, status, reason) => {
  assert.deepEqual(actual.samplingEquivalence, { model: 'kaleidoscope-2.3.1-opaque-sampling-v1',
    comparison: 'opaque-current-display-rgb', displayPolicy: 'mac-1.8-to-2.2-high-byte',
    width: 4, height: 2, status, reason });
  assert(Object.isFrozen(actual.samplingEquivalence));
};

test('opaque equivalence follows actual raster and engine palette branches, not ctFlags alone', () => {
  for (const flags of [0, 0x8000]) expectStatus(decode([[0, ...red], [1, ...green]], 1, flags), 'equivalent', 'all-opaque-display-rgb-equal');
  // Unique reverse lookup agrees with flags0; position1 is blue under bit15.
  expectStatus(decode([[1, ...red], [7, ...blue]], 1), 'equivalent', 'all-opaque-display-rgb-equal');
  const different = decode([[1, ...red], [7, ...blue]], 1, 0x8000);
  assert.deepEqual([...different.rgba.slice(0, 4)], [0, 0, 255, 255]);
  expectStatus(different, 'different', 'opaque-display-mismatch');
  // Positional match wins even when a later duplicate exists.
  expectStatus(decode([[9, ...red], [1, ...green], [1, ...blue]], 1), 'equivalent', 'all-opaque-display-rgb-equal');
  // No positional match: engine last duplicate is green, raster first is red.
  const duplicate = decode([[1, ...red], [8, ...blue], [1, ...green], [9, ...black]], 1);
  assert.deepEqual([...duplicate.rgba.slice(0, 4)], [255, 0, 0, 255]);
  expectStatus(duplicate, 'different', 'opaque-display-mismatch');
  // Final-zero shortcut ignores value: index1 reads green, raster flags0 red.
  expectStatus(decode([[1, ...red], [8, ...green], [0, ...blue]], 1), 'different', 'opaque-display-mismatch');
  expectStatus(decode([[1, ...red], [8, ...green], [0, ...blue]], 1, 0x8000), 'equivalent', 'all-opaque-display-rgb-equal');
});

test('missing values, unsafe positional access and raw16 collisions have distinct classifications', () => {
  expectStatus(decode([[8, ...red], [9, ...green]], 3), 'different', 'opaque-display-mismatch'); // engine entry0 red, raster black
  expectStatus(decode([[8, ...black], [9, ...green]], 3), 'equivalent', 'all-opaque-display-rgb-equal');
  expectStatus(decode([[8, ...red], [0, ...green]], 3), 'unknown', 'unsafe-palette-access');
  expectStatus(decode([], 0), 'unknown', 'unsafe-palette-access');
  const sameHighByte = [[1, 0x8000, 0, 0], [8, ...blue], [1, 0x80ff, 0, 0], [9, ...black]];
  expectStatus(decode(sameHighByte, 1), 'equivalent', 'all-opaque-display-rgb-equal');
  // Literal current LUT collision: high bytes101 and102 both map to120.
  expectStatus(decode([[1,0x6500,0,0],[8,...blue],[1,0x6600,0,0],[9,...black]], 1), 'equivalent', 'all-opaque-display-rgb-equal'); // not raw16 equality
});

test('mask-zero samples are skipped, including unsafe colors; an opaque late mismatch is retained', () => {
  expectStatus(decode([[8, ...red], [0, ...green]], 3, 0, { mask: [0, 0] }), 'equivalent', 'all-opaque-display-rgb-equal');
  const entries = [[0, ...green], [2, ...blue], [1, ...red]];
  expectStatus(decode(entries, 0, 0x8000, { pixels: [0, 1, 0, 0, 0, 0, 0, 1], mask: [0xb0, 0xe0] }), 'equivalent', 'all-opaque-display-rgb-equal');
  expectStatus(decode(entries, 0, 0x8000, { pixels: [0, 1, 0, 0, 0, 0, 0, 1], mask: [0xb0, 0xf0] }), 'different', 'opaque-display-mismatch');
});

test('nonzero or mismatched source/mask bounds stay unknown without changing decode policy', () => {
  expectStatus(decode([[0, ...red]], 0, 0, { origin: 7 }), 'unknown', 'unsupported-layout');
  for (const mutate of [v => v.setUint16(30, 16), v => v.setUint16(16, 1), v => { v.setInt16(56, 1); v.setInt16(60, 3); }, v => v.setInt16(62, 3)]) {
    const b = icon({ entries: [[0, ...red]], pixels: Array(8).fill(0) }); mutate(new DataView(b.buffer));
    expectStatus(decodeCicn(b), 'unknown', 'unsupported-layout');
  }
});

const load = (entries, options = {}) => loadKaleidoscopeScheme(forkOf(entries), { encodeAssets: false, ...options });
test('occurrence-bound metadata survives raw and encoded loads without cinf or retained vectors/functions', async () => {
  const entries = [{ type: 'cicn', id: 7, name: 'first', data: icon({ entries: [[0, ...red]], pixels: Array(8).fill(0) }) },
    { type: 'cicn', id: 7, name: 'second', data: icon({ entries: [[1, ...red], [7, ...blue]], pixels: Array(8).fill(1), flags: 0x8000 }) }];
  for (const encodeAssets of [false, true]) {
    const loaded = await load(entries, { provenance: true, encodeAssets, assetUrlFactory: (_p, _w, _h, path) => `opaque:${path}` });
    const elements = Object.values(loaded.manifest.chromeElements);
    assert.deepEqual(elements.map(e => [e.samplingEquivalence.status, e.byteProvenance.cicnResourceIndex, e.sourceCinfId]), [['equivalent', 0, null], ['different', 1, null]]);
    for (const e of elements) {
      assert(Object.isFrozen(e.samplingEquivalence));
      assert(Object.values(e.samplingEquivalence).every(v => ['string', 'number'].includes(typeof v)));
    }
    validateTheme(loaded.manifest);
  }
});

test('duplicate encoded asset paths cannot claim equivalence even for identical payloads', async () => {
  for (const second of [red, blue]) {
    const entries = [red, second].map(rgb => ({ type: 'cicn', id: 7, name: 'same', data: icon({ entries: [[0, ...rgb]], pixels: Array(8).fill(0) }) }));
    const loaded = await load(entries, { encodeAssets: true, assetUrlFactory: () => 'opaque:alias' });
    for (const e of Object.values(loaded.manifest.chromeElements)) expectStatus(e, 'unknown', 'ambiguous-asset-path');
    let allocated = 0;
    await assert.rejects(load(entries, { provenance: true, encodeAssets: true, assetUrlFactory: () => { allocated++; return 'bad'; } }), /duplicate cicn asset binding/);
    assert.equal(allocated, 0);
  }
});

test('manifest validates model, comparison, dimensions and status/reason without authenticating callers', async () => {
  const loaded = await load([{ type: 'cicn', id: 7, data: icon() }]);
  for (const absent of [null, undefined]) {
    const t = structuredClone(loaded.manifest), e = Object.values(t.chromeElements)[0];
    if (absent === undefined) delete e.samplingEquivalence; else e.samplingEquivalence = absent;
    validateTheme(t);
  }
  for (const [key, value] of [['model', 'historical-proof'], ['comparison', 'raw-rgb16'], ['displayPolicy', 'device'], ['width', 99], ['height', 0], ['status', 'constructor'], ['reason', 'opaque-display-mismatch']]) {
    const t = structuredClone(loaded.manifest); Object.values(t.chromeElements)[0].samplingEquivalence[key] = value;
    assert.throws(() => validateTheme(t), /sampling equivalence/);
  }
});

test('comparison memoizes repeated opaque palette indices without retaining the source vectors', () => {
  const indices = Uint8Array.from([0,1,0,1,0,1]);
  const rgba = Uint8Array.from([255,0,0,255,0,255,0,255,255,0,0,255,0,255,0,255,255,0,0,255,0,255,0,255]);
  const pmap = {width:3,height:2,bounds:{left:0,top:0},isPixMap:true,pixelType:0,cmpCount:1,cmpSize:8,pixelSize:8,packType:0};
  let calls=0;
  const result=compareOpaqueSampling(indices,rgba,pmap,pmap,(x,y)=>{calls++;return indices[y*3+x]?[0,65535,0]:[65535,0,0];});
  assert.equal(calls,2);assert.equal(result.status,'equivalent');
  assert(Object.values(result).every(v=>['string','number'].includes(typeof v)));
});

test('all four indexed depths use packed rows and independent mask strides without reading padding', () => {
  for (const [depth, pixels] of [
    [1, [0x50,255,255,255,0xa0,255,255,255]],
    [2, [0x11,255,255,255,0x44,255,255,255]],
    [4, [0x01,0x01,255,255,0x10,0x10,255,255]],
    [8, [0,1,0,1,1,0,1,0]],
  ]) {
    const bytes=icon({entries:[[0,...red],[1,...green]],pixels});
    const view=new DataView(bytes.buffer);view.setUint16(32,depth);view.setUint16(36,depth);
    const actual=decodeCicn(bytes);
    expectStatus(actual,'equivalent','all-opaque-display-rgb-equal');
    assert.deepEqual([...actual.rgba], [red,green,red,green,green,red,green,red].flatMap(rgb=>[...rgb.map(c=>c>>8),255]));
  }
});
