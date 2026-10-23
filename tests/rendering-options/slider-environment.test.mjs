// Contract oracle: slider-layout-cinf.md. These are typed-adapter admission
// checks, not loader-decoded roles or original Resource Manager evidence.
import '../helpers/registerTs.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
const { snapshotSliderEnvironment } = await import('../../src/engine/resources/sliderEnvironment.ts');
import { prepareCinfEnvironment } from '../../tools/theme-loader/cinf-environment.js';
import { loadKaleidoscopeScheme } from '../../tools/theme-loader/loadKaleidoscopeScheme.js';
import { forkOf, external, marker, declaration } from '../decoder-fixtures/cinf-environment.mjs';
import { endpointFork, endpointProvider } from '../decoder-fixtures/slider-endpoints.mjs';
const info = (id, bytes) => ({ type: 'cinf', id, data: Uint8Array.from(bytes) });
const load = async (providers, bytes = endpointFork(), complete = true) => ({ ...(await loadKaleidoscopeScheme(bytes, {
  encodeAssets: true, assetUrlFactory: (_b, _w, _h, path) => `owned:${path}`,
  sliderLayoutEnvironment: await prepareCinfEnvironment(declaration(providers, complete)),
})), baseUrl: 'owned' });
const view = (theme, axis = 'horizontal') => snapshotSliderEnvironment(theme, axis);
const reject = (theme, axis) => assert.throws(() => view(theme, axis), e => e.code === 'UNSUPPORTED_CINF_ENVIRONMENT');

test('corner lookup prioritizes group2 ID over group0 and providers within each ID; one byte zero is valid', async () => {
  for (const providers of [[external('a', endpointProvider(2)), external('b', endpointProvider(5))], [external('b', endpointProvider(5)), external('a', endpointProvider(2))]]) {
    assert.equal(view(await load(providers)).corner, providers[0].id === 'a' ? 2 : 5);
  }
  const theme = await load([external('fallback', endpointProvider(7, true)), external('primary', endpointProvider(0))]);
  for (const [axis, id] of [['horizontal', -10132], ['vertical', -10116]]) {
    const result = view(theme, axis);
    assert.equal(result.corner, 0); assert.equal(result.selected.providerId, 'primary'); assert.equal(result.selected.byteLength, 1);
    assert.deepEqual(result.attempts.map(a => [a.id, a.outcome]), [[id, 'found']]);
    assert.deepEqual(result.providers.map(p => [p.name, p.tier]), [['fallback', 'cinf'], ['primary', 'cinf']]);
    assert.equal(result.providers[0].get('cicn', id), null); assert.equal(result.providers[0].get('ppat', id), null);
  }
  const fallback = view(await load([external('fallback', endpointProvider(7, true))]));
  assert.equal(fallback.corner, 7);
  assert.deepEqual(fallback.attempts.map(a => [a.id, a.outcome]), [[-10132, 'missing'], [-10144, 'found']]);
  const localFork = forkOf([{ type: 'cicn', id: -10129, data: (await import('../decoder-fixtures/slider-endpoints.mjs')).endpointIcon(false, true) }, info(-10132, [4])]);
  assert.equal(view(await load([marker(), external('external', endpointProvider(2))], localFork)).corner, 4);
  assert.equal(view(await load([external('external', endpointProvider(2)), marker()], localFork)).corner, 2);
});

test('missing, empty, duplicate and unknown corners reject rather than become zero or fallback', async () => {
  const good = external('good', endpointProvider(3));
  for (const [providers, complete] of [
    [[], true], [[external('empty', forkOf([info(-10132, []), info(-10144, [4])]))], true],
    [[external('duplicate', forkOf([info(-10132, [2]), info(-10132, [3])])), good], true],
    [[external('partial', endpointProvider(2), false), good], true], [[good], false],
  ]) reject(await load(providers, endpointFork(), complete));
  // A complete absence may continue, whereas unknown evidence must stop.
  const absent = external('absent', forkOf([info(42, [9])]));
  assert.equal(view(await load([absent, good])).corner, 3);
  const horizontal = await load([external('horizontal-only', forkOf([info(-10132, [3])]))]);
  assert.equal(view(horizontal).corner, 3); reject(horizontal, 'vertical');
});

test('typed adapter binds actual owner, thumb, asset, dimensions, source identity and axis', async () => {
  const theme = await load([external('layout', endpointProvider())]);
  assert.equal(view(theme).corner, 3);
  reject({ ...theme, manifest: { ...theme.manifest } });
  reject({ ...theme, base: theme });
  const entries = theme.manifest.chromeElements, key = Object.keys(entries).find(k => entries[k].sourceCicnId === -10129), element = entries[key];
  for (const [field, changed] of [['asset', 'changed'], ['width', 8], ['height', 60], ['sourceCicnId', -10113], ['byteProvenance', {}]]) {
    const original = element[field]; element[field] = changed; reject(theme); element[field] = original; assert.equal(view(theme).corner, 3);
  }
  entries[key] = { ...element }; reject(theme); entries[key] = element;
  entries.duplicate = { ...element }; reject(theme); delete entries.duplicate;
  delete entries[key]; reject(theme); entries[key] = element;
  const noThumb = await load([external('layout', endpointProvider())], endpointFork({ thumb: false })); reject(noThumb);
  const onlyH = await load([external('layout', endpointProvider())]);
  const vk = Object.keys(onlyH.manifest.chromeElements).find(k => onlyH.manifest.chromeElements[k].sourceCicnId === -10113);
  delete onlyH.manifest.chromeElements[vk]; assert.equal(view(onlyH).corner, 3); reject(onlyH, 'vertical');
});

// PM adjudication (2026-10-23): completeness applies to the whole declaration,
// including providers never reached by a first-hit lookup. Preserve this failure
// until the separate runtime owner repairs it; do not encode unknown as absence.
test('declaration-wide completeness rejects an unqueried later incomplete provider', async () => {
  const good = external('complete', endpointProvider(3));
  const control = await load([good]); assert.equal(view(control).corner, 3);
  const incomplete = external('unqueried-incomplete', endpointProvider(4), false);
  reject(await load([good, incomplete]));
});
