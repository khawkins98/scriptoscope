import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { loadKaleidoscopeScheme } from './loadKaleidoscopeScheme.js';
import { buildThemeJson } from './buildThemeJson.js';
import { forkOf, onePixelCicn, cinf } from '../../tests/resource-provenance/fixtures.mjs';
import { twoPixelPpat } from '../../tests/resource-provenance/patterns.mjs';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
// One part-0 rectangle and one literal entry per edge, independent of builder.
function wnd(width = 1) {
  const bytes = new Uint8Array(36), v = new DataView(bytes.buffer);
  v.setInt16(8, 1); v.setInt16(10, width);
  for (const offset of [12, 18, 24, 30]) v.setInt16(offset + 2, 1);
  return bytes;
}
const load = (resources, options = {}) => loadKaleidoscopeScheme(forkOf(resources), { encodeAssets: false, provenance: true, ...options });
function binding(theme, key) {
  const value = theme.manifest.windowTypes[key].byteProvenance;
  assert.equal(value.loadId, theme.byteProvenance.loadId); assert.equal(value.manifestKey, key);
  assert.ok(Object.isFrozen(value) && Object.isFrozen(value.recipe) && Object.isFrozen(value.chrome) && Object.isFrozen(value.sprites));
  return value;
}

test('duplicate/custom wnd occurrences carry unique keys and actual last-successful chrome/neighbor cinf', async () => {
  const otherCinf = cinf(); otherCinf[0] = 2;
  const resources = [
    { type: 'wnd#', id: 1000, name: 'Odd Frame', data: wnd() },
    { type: 'wnd#', id: 1000, name: 'Odd Frame', data: wnd(2) },
    { type: 'cicn', id: 1000, name: 'old', data: onePixelCicn() },
    { type: 'cicn', id: 1000, name: 'new', data: onePixelCicn(0x1234) },
    { type: 'cicn', id: 1000, name: 'bad', data: new Uint8Array(1) },
    { type: 'cinf', id: 992, data: cinf() },
    { type: 'cinf', id: 992, data: otherCinf },
    { type: 'cinf', id: 1000, data: cinf() },
  ];
  const theme = await load(resources);
  assert.deepEqual(Object.keys(theme.manifest.windowTypes), ['odd-frame', 'odd-frame-2']);
  for (const [i, key] of ['odd-frame', 'odd-frame-2'].entries()) {
    const b = binding(theme, key);
    assert.deepEqual(b.recipe, { kind: 'wnd-resource', resourceIndex: i });
    assert.deepEqual(b.chrome, { active: 3, inactive: 3 });
    assert.equal(b.cinfResourceIndex, 6);
    assert.equal(theme.manifest.windowTypes[key].cinf.cornerSize, 2);
    assert.equal(theme.byteProvenance.resources.find(r => r.resourceIndex === i).sha256, sha(resources[i].data));
  }
  assert.equal(theme.byteProvenance.resources.find(r => r.resourceIndex === 4).status, 'error');
  const plain = await load(resources, { provenance: false });
  assert.equal(plain.manifest.windowTypes['odd-frame'].byteProvenance, undefined);
});

test('synthetic recipe identifies table and actual fallback/sprite occurrence, even with un-emitted wnd', async () => {
  const resources = [
    { type: 'wnd#', id: 1000, data: wnd() }, // valid but no paired frame; synthesis still occurs
    { type: 'cicn', id: -14332, data: onePixelCicn() },
    { type: 'ppat', id: -14331, data: twoPixelPpat() },
    { type: 'cicn', id: -14330, data: onePixelCicn() },
  ];
  const theme = await load(resources), b = binding(theme, 'document-window');
  assert.deepEqual(b.recipe, { kind: 'corner-sprite-table', key: 'document-window', trigger: 'no-emitted-wnd-window-types' });
  assert.deepEqual(b.chrome, { active: 1, inactive: 1 });
  assert.equal(b.cinfResourceIndex, null);
  assert.deepEqual(b.sprites, { pinstripe: { type: 'ppat', resourceIndex: 2 }, growBox: { type: 'cicn', resourceIndex: 3 } });
  assert.ok(Object.isFrozen(b.sprites.pinstripe));
  const preferred = await load([...resources, { type: 'cicn', id: -14331, data: onePixelCicn() }]);
  assert.deepEqual(binding(preferred, 'document-window').sprites.pinstripe, { type: 'cicn', resourceIndex: 4 });
});

test('encoded concurrent loads retain their own occurrence/hash identity and unchanged default output', async () => {
  const records = red => [{ type: 'wnd#', id: -14336, data: wnd() }, { type: 'cicn', id: -14336, data: onePixelCicn(red) }];
  const encode = { encodeAssets: true, assetUrlFactory: (_rgba, _w, _h, path) => `memory:${path}` };
  const [a, b, plain] = await Promise.all([load(records(0xffff), encode), load(records(0), encode), load(records(0), { ...encode, provenance: false })]);
  assert.notEqual(binding(a, 'document-window').loadId, binding(b, 'document-window').loadId);
  assert.notEqual(a.byteProvenance.resources[1].sha256, b.byteProvenance.resources[1].sha256);
  assert.equal(b.manifest.windowTypes['document-window'].chrome.active, plain.manifest.windowTypes['document-window'].chrome.active);
  const strip = value => JSON.parse(JSON.stringify(value, (key, child) => key === 'byteProvenance' ? undefined : child));
  assert.deepEqual(strip(b.manifest), plain.manifest);
  assert.ok(b.byteProvenance.scope.resourceTypes.includes('wnd#'));
});

test('builder excludes explicit failed wnd records without claiming a decoded recipe', () => {
  const theme = buildThemeJson({ assets: [
    { type: 'wnd#', id: 1000, status: 'error', byteReference: { loadId: 'load', resourceIndex: 0 } },
    { type: 'cicn', id: 1000, status: 'ok', file: 'frame.png', width: 1, height: 1, byteReference: { loadId: 'load', resourceIndex: 1 } },
  ] });
  assert.equal(theme.windowTypes, undefined);
});

test('corner file-nullish fallback preserves missing/null versus empty-string decisions', () => {
  const asset = (type, id, file, index) => ({ type, id, status: 'ok', file, width: 1, height: 1,
    byteReference: { loadId: 'fixture', resourceIndex: index } });
  for (const missing of [undefined, null]) {
    const theme = buildThemeJson({ assets: [
      asset('cicn', -14332, 'active.png', 0), asset('cicn', -14336, missing, 1),
      asset('cicn', -14331, missing, 2), asset('ppat', -14331, 'stripe.png', 3),
    ] });
    const wt = theme.windowTypes['document-window'];
    assert.deepEqual(wt.chrome, { active: 'active.png', inactive: 'active.png' });
    assert.deepEqual(wt.byteProvenance.chrome, { active: 0, inactive: 0 });
    assert.equal(wt.sprites.pinstripe, 'stripe.png');
    assert.deepEqual(wt.byteProvenance.sprites.pinstripe, { type: 'ppat', resourceIndex: 3 });
  }
  const theme = buildThemeJson({ assets: [
    asset('cicn', -14332, 'active.png', 0), asset('cicn', -14336, '', 1),
    asset('cicn', -14331, '', 2), asset('ppat', -14331, 'stripe.png', 3),
  ] });
  const wt = theme.windowTypes['document-window'];
  assert.equal(wt.chrome.inactive, '');
  assert.equal(wt.byteProvenance.chrome.inactive, 1);
  assert.equal(wt.sprites, undefined);
  assert.deepEqual(wt.byteProvenance.sprites, {});
});
