import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { prepareCinfEnvironment, bindCinfEnvironment, copiedCinfPayload, snapshotCinfResourceOwner } from './cinf-environment.js';
import { loadKaleidoscopeScheme } from './loadKaleidoscopeScheme.js';
import { forkOf, external, marker, declaration } from '../../tests/decoder-fixtures/cinf-environment.mjs';
import { endpointFork, endpointProvider } from '../../tests/decoder-fixtures/slider-endpoints.mjs';
const sha = b => createHash('sha256').update(b).digest('hex');
const load = (bytes, env, extra = {}) => loadKaleidoscopeScheme(bytes, { encodeAssets: false, sliderLayoutEnvironment: env, ...extra });

test('slider option preserves generic prepared/bound IDs, data and copied complete payloads', async () => {
  const bytes = endpointProvider(3), original = bytes.slice();
  const pending = prepareCinfEnvironment(declaration([external('layout', bytes), marker()]));
  bytes.fill(0); const env = await pending;
  assert.equal(env.data.providers[0].forkSha256, sha(original));
  assert.equal(env.id, `cinf-environment:${sha(JSON.stringify(env.data))}`);
  assert.deepEqual(copiedCinfPayload(env.data.providers[0].resources[0]), [3]);
  const fork = endpointFork(), binding = await bindCinfEnvironment(env, fork);
  const { id, ...bindingData } = binding;
  assert.equal(id, `cinf-binding:${sha(JSON.stringify(bindingData))}`);
  const loaded = await load(fork, env), plain = await load(fork);
  assert.deepEqual(loaded.manifest.sliderLayoutEnvironment, { environmentId: env.id, bindingId: id });
  assert.ok(Object.isFrozen(loaded.manifest.sliderLayoutEnvironment));
  const stripped = structuredClone(loaded.manifest); delete stripped.sliderLayoutEnvironment;
  assert.deepEqual(stripped, plain.manifest); assert.deepEqual(loaded.assets, plain.assets);
  assert.equal(Object.values(stripped.chromeElements).some(e => 'sliderLayoutCinf' in e), false);
  assert.equal(snapshotCinfResourceOwner(plain.manifest, 'sliderLayoutEnvironment'), undefined);
  await assert.rejects(load(fork, structuredClone(env)), /prepareCinfEnvironment/);
});

test('opaque owner capability rejects cloned/transplanted/replaced/deleted markers', async () => {
  const env = await prepareCinfEnvironment(declaration([external('layout', endpointProvider())]));
  const first = await load(endpointFork(), env), second = await load(endpointFork(), env);
  const field = 'sliderLayoutEnvironment', manifest = first.manifest, original = manifest[field];
  const valid = () => assert.ok(snapshotCinfResourceOwner(manifest, field).binding);
  const rejected = owner => assert.throws(() => snapshotCinfResourceOwner(owner, field), e => e.code === 'UNSUPPORTED_CINF_ENVIRONMENT');
  valid(); rejected({ ...manifest }); rejected(structuredClone(manifest));
  assert.throws(() => { original.bindingId = 'changed'; }, TypeError);
  for (const replacement of [{ ...original }, second.manifest[field], undefined, null]) {
    manifest[field] = replacement; rejected(manifest); manifest[field] = original; valid();
  }
  delete manifest[field]; rejected(manifest); manifest[field] = original; valid();
  const profile = manifest.displayProfile; manifest.displayProfile = {}; rejected(manifest); manifest.displayProfile = profile; valid();
});

test('loader copies fork bytes before asynchronous preparation without provenance', async () => {
  const env = await prepareCinfEnvironment(declaration([marker()]));
  const bytes = endpointFork(), original = bytes.slice(), pending = load(bytes, env); bytes.fill(0);
  const loaded = await pending, plain = await load(original);
  const copy = structuredClone(loaded.manifest); delete copy.sliderLayoutEnvironment;
  assert.deepEqual(copy, plain.manifest); assert.deepEqual(loaded.assets, plain.assets);
  assert.ok(Object.values(copy.chromeElements).every(e => e.byteProvenance === undefined));
});

test('portable theme-loader tools remain generic and never import runtime src', () => {
  for (const name of readdirSync(new URL('./', import.meta.url)).filter(n => n.endsWith('.js'))) {
    const source = readFileSync(new URL(name, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /(?:from\s*|import\s*\()['"][^'"]*\/src\//, name);
  }
});
