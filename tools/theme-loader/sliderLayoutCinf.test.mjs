import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { prepareCinfEnvironment, snapshotSliderLayoutCinf } from './cinf-environment.js';
import { loadKaleidoscopeScheme } from './loadKaleidoscopeScheme.js';
import { forkOf, faceBytes, external, marker, declaration } from '../../tests/decoder-fixtures/cinf-environment.mjs';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const info = (id, bytes) => ({ type: 'cinf', id, data: Uint8Array.from(bytes) });
const thumb = (id = -10129, name = 'thumb') => ({ type: 'cicn', id, name, data: faceBytes() });
const load = (bytes, sliderLayoutEnvironment, extra = {}) => loadKaleidoscopeScheme(bytes, { encodeAssets: false, sliderLayoutEnvironment, ...extra });
const view = loaded => snapshotSliderLayoutCinf(loaded.manifest, loaded.manifest.chromeElements.thumb, 'horizontal');

test('layout uses exact group-base then group0 lookup; one byte and explicit zero are valid', async () => {
  const primary = forkOf([info(-10132, [0])]), fallback = forkOf([info(-10144, [7])]);
  const env = await prepareCinfEnvironment(declaration([external('fallback', fallback), marker(), external('primary', primary)]));
  const bytes = forkOf([thumb(), info(-10131, [99])]);
  const loaded = await load(bytes, env), selected = view(loaded);
  assert.equal(selected.status, 'ready'); assert.equal(selected.corner, 0);
  assert.equal(selected.selected.providerId, 'primary'); assert.equal(selected.selected.byteLength, 1);
  assert.equal(selected.selected.sha256, sha(Uint8Array.of(0)));
  assert.equal(selected.selected.forkSha256, sha(primary)); assert.equal(selected.selected.occurrence, 0);
  assert.equal(selected.themeForkSha256, sha(bytes));
  assert.deepEqual(selected.attempts.map(a => [a.id, a.outcome]), [[-10132, 'found']]);
  const missing = await load(bytes, await prepareCinfEnvironment(declaration([external('fallback', fallback)])));
  assert.equal(view(missing).corner, 7);
  assert.deepEqual(view(missing).attempts.map(a => [a.id, a.outcome]), [[-10132, 'missing'], [-10144, 'found']]);
  assert.ok(Object.isFrozen(selected)); assert.ok(Object.isFrozen(selected.selected));
});

test('layout preserves provider order, stops on incomplete/duplicate/empty input, and keeps axes independent', async () => {
  const primary = info(-10132, [2]), theme = forkOf([thumb(), thumb(-10113, 'vertical'), primary]);
  const first = await load(theme, await prepareCinfEnvironment(declaration([external('external', forkOf([info(-10132, [3])])), marker()])));
  assert.equal(view(first).corner, 3);
  const local = await load(theme, await prepareCinfEnvironment(declaration([marker(), external('external', forkOf([info(-10132, [3])]))])));
  assert.equal(view(local).corner, 2); assert.equal(view(local).selected.occurrence, 2);
  const vertical = snapshotSliderLayoutCinf(local.manifest, local.manifest.chromeElements.vertical, 'vertical');
  assert.equal(vertical.status, 'unsupported'); assert.equal(vertical.reason, 'layout-cinf-uninitialized');
  assert.deepEqual(vertical.attempts.map(a => [a.id, a.outcome]), [[-10116, 'missing'], [-10128, 'missing']]);
  for (const [data, reason] of [
    [declaration([external('match', forkOf([primary]))], false), 'incomplete-environment'],
    [declaration([external('partial', forkOf([primary]), false)]), 'incomplete-provider'],
    [declaration([external('duplicate', forkOf([primary, primary]))]), 'duplicate-cinf'],
    [declaration([external('empty', forkOf([info(-10132, []), info(-10144, [4])]))]), 'empty-layout-cinf'],
  ]) {
    const actual = view(await load(forkOf([thumb()]), await prepareCinfEnvironment(data)));
    assert.equal(actual.status, 'unsupported'); assert.equal(actual.reason, reason); assert.equal(actual.attempts.length, 1);
  }
});

test('layout snapshots bytes before awaits without provenance and does not alter common fields or assets', async () => {
  const provider = forkOf([info(-10132, [4])]), expectedProvider = sha(provider);
  const preparing = prepareCinfEnvironment(declaration([external('source', provider)])); provider.fill(0);
  const env = await preparing, bytes = forkOf([thumb()]), original = bytes.slice(), expectedTheme = sha(bytes);
  const pending = load(bytes, env); bytes.fill(0); const loaded = await pending;
  assert.equal(view(loaded).selected.forkSha256, expectedProvider); assert.equal(view(loaded).themeForkSha256, expectedTheme);
  assert.equal(loaded.manifest.chromeElements.thumb.byteProvenance, undefined);
  const legacy = await load(original), stripped = structuredClone(loaded.manifest);
  delete stripped.sliderLayoutEnvironment;
  for (const element of Object.values(stripped.chromeElements)) delete element.sliderLayoutCinf;
  assert.deepEqual(stripped, legacy.manifest); assert.deepEqual(loaded.assets, legacy.assets);
  assert.equal(snapshotSliderLayoutCinf(legacy.manifest, undefined, 'horizontal'), undefined);
  await assert.rejects(load(original, structuredClone(env)), /prepareCinfEnvironment/);
});

test('layout admission binds the finalized actual thumb, manifest, asset and axis', async () => {
  const env = await prepareCinfEnvironment(declaration([external('source', forkOf([info(-10132, [2])]))]));
  const loaded = await load(forkOf([thumb(), thumb(-10129, 'other')]), env, {
    encodeAssets: true, assetUrlFactory: (_bytes, _width, _height, path) => `owned:${path}`,
  });
  const { thumb: face, other } = loaded.manifest.chromeElements, original = face.sliderLayoutCinf;
  assert.equal(view(loaded), original);
  assert.notEqual(face.asset, other.asset);
  face.sliderLayoutCinf = other.sliderLayoutCinf;
  assert.throws(() => view(loaded), /actual loaded group2 thumb/); face.sliderLayoutCinf = original;
  assert.throws(() => snapshotSliderLayoutCinf({ ...loaded.manifest }, face, 'horizontal'), /actual loaded group2 thumb/);
  assert.throws(() => snapshotSliderLayoutCinf(loaded.manifest, face, 'vertical'), /actual loaded group2 thumb/);
  assert.throws(() => snapshotSliderLayoutCinf(loaded.manifest, undefined, 'horizontal'), /actual loaded group2 thumb/);
  const captured = view(loaded); face.asset = 'changed';
  assert.throws(() => view(loaded), /actual loaded group2 thumb/); assert.equal(captured, original);
  const absent = await load(forkOf([info(-10132, [2])]), env);
  assert.throws(() => snapshotSliderLayoutCinf(absent.manifest, undefined, 'horizontal'), /actual loaded group2 thumb/);
});
