import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { prepareCinfEnvironment, bindCinfEnvironment, bodyCinfView, isBoundBodyCinfView } from './cinf-environment.js';
import { loadKaleidoscopeScheme } from './loadKaleidoscopeScheme.js';
import { providerFork, themeFork, external, marker, declaration, forkOf } from '../../tests/decoder-fixtures/cinf-environment.mjs';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const load = (bytes, cinfEnvironment, extra = {}) => loadKaleidoscopeScheme(bytes, { encodeAssets: false, cinfEnvironment, ...extra });
const view = loaded => loaded.manifest.chromeElements.face.bodyCinf;
test('prepared cinf snapshots external bytes and binds same-ID before default across declared providers', async () => {
  const same = providerFork(), fallback = providerFork(0, [0, 0]);
  const expected = sha(same), pending = prepareCinfEnvironment(declaration([external('default-first', fallback), marker(), external('same-last', same)]));
  same.fill(0); const env = await pending, raw = themeFork(), loaded = await load(raw, env, { provenance: true }), v = view(loaded);
  assert.equal(v.status, 'ready'); assert.equal(v.selected.providerId, 'same-last'); assert.equal(v.selected.forkSha256, expected);
  assert.deepEqual(v.attempts.map(a => [a.id, a.outcome]), [[-10239, 'found']]);
  assert.equal(v.themeForkSha256, sha(raw)); assert.equal(v.metadata.colorSamples.background.rgb16[0], 0x2121);
  assert.deepEqual(v.metadata.colorSamples.background.displayRgb, [48,48,48]);
  assert.equal(loaded.manifest.chromeElements.face.byteProvenance.cinfResourceIndex, null);
  assert.ok(Object.isFrozen(env.data.providers[0].resources[0])); assert.ok(Object.isFrozen(v.metadata.colorSamples.background.rgb16));
});
test('provider ordering and theme marker select exact occurrence without altering common fields/assets', async () => {
  const raw = themeFork({ local: true }), other = providerFork(), a = external('other', other);
  const first = await load(raw, await prepareCinfEnvironment(declaration([a, marker()])));
  const second = await load(raw, await prepareCinfEnvironment(declaration([marker(), a])));
  assert.equal(view(first).selected.providerId, 'other'); assert.equal(view(second).selected.providerId, 'actual-theme');
  assert.equal(isBoundBodyCinfView(first.manifest.cinfEnvironment,view(first)),true);
  assert.equal(isBoundBodyCinfView(first.manifest.cinfEnvironment,structuredClone(view(first))),false);
  assert.equal(isBoundBodyCinfView(structuredClone(first.manifest.cinfEnvironment),view(first)),false);
  assert.equal(view(second).selected.occurrence, 1); assert.equal(view(second).selected.forkSha256, sha(raw));
  assert.deepEqual(first.manifest.chromeElements.face.bgAnchor, [0,0]); assert.deepEqual(view(first).metadata.bgAnchor, [3,3]);
  const legacy = await load(raw);
  const strip = x => { const c = structuredClone(x); delete c.cinfEnvironment; for (const e of Object.values(c.chromeElements)) delete e.bodyCinf; return c; };
  assert.deepEqual(strip(first.manifest), legacy.manifest); assert.deepEqual(first.assets, legacy.assets);
});
test('default0 and two NULLs remain distinct; repeated equal request/default attempts are retained', async () => {
  const fallback = await load(themeFork(), await prepareCinfEnvironment(declaration([marker(), external('defaults', providerFork(0))])));
  assert.deepEqual(view(fallback).attempts.map(a => [a.id,a.outcome]), [[-10239,'missing'],[0,'found']]);
  const empty = await prepareCinfEnvironment(declaration([marker()]));
  assert.equal(view(await load(themeFork(), empty)).status, 'no-body-or-border');
  const zero = bodyCinfView(await bindCinfEnvironment(empty, themeFork({ id: 0 })), { id: 0 }, {}, undefined, false);
  assert.deepEqual(zero.attempts.map(a => [a.id,a.outcome]), [[0,'missing'],[0,'missing']]);
});
test('incomplete, duplicate and short present cinf stop without fallback or legacy substitution', async () => {
  const record = { type:'cinf', id:-10239, data:new Uint8Array(18) };
  const cases = [
    [declaration([external('match',providerFork())],false),'incomplete-environment'],
    [declaration([external('partial',providerFork(),false),external('later',providerFork(0))]),'incomplete-provider'],
    [declaration([external('duplicates',forkOf([record,record])),external('later',providerFork(0))]),'duplicate-cinf'],
    [declaration([external('invalid',forkOf([{...record,data:new Uint8Array(1)}])),external('later',providerFork(0))]),'short-cinf'],
  ];
  for (const [data,reason] of cases) {
    const v = view(await load(themeFork(),await prepareCinfEnvironment(data)));
    assert.equal(v.status,'unsupported'); assert.equal(v.reason,reason); assert.equal(v.attempts.length,1);
  }
});
test('one environment bound to concurrent actual forks keeps independent ownership; invalid handles fail before encoders', async () => {
  const env = await prepareCinfEnvironment(declaration([marker(),external('fallback',providerFork(0))]));
  const [a,b] = await Promise.all([load(themeFork(),env),load(themeFork({local:true}),env)]);
  assert.notEqual(view(a).bindingId,view(b).bindingId); assert.equal(view(a).selected.providerId,'fallback'); assert.equal(view(b).selected.providerId,'actual-theme');
  let encoders=0;
  await assert.rejects(load(themeFork(),structuredClone(env),{encodeAssets:true,assetUrlFactory:()=>{encoders++;return 'unused';}}),/prepareCinfEnvironment/);
  assert.equal(encoders,0);
  await assert.rejects(prepareCinfEnvironment(declaration([marker(),marker()])),/Unique|Only one/);
});

test('selected role samples use the prepared display profile once, including hidden RGB', async () => {
  const { prepareDisplayProfile } = await import('./display-profile.js');
  const channel = Array.from({length:256},(_,i)=>i); channel[34]=101;
  const displayProfile = await prepareDisplayProfile({version:1,conditions:{kind:'owned-synthetic'},evidence:[{sha256:'0'.repeat(64),description:'synthetic mapping'}],
    devicePalette:[{index:0,rgb16:[0x2222,0x2222,0x2222]},{index:1,rgb16:[0,0,65535]}],
    mappings:[{rgb16:[0x2121,0x2121,0x2121],deviceIndex:0,deviceRgb16:[0x2222,0x2222,0x2222]},
      {rgb16:[0,0,65535],deviceIndex:1,deviceRgb16:[0,0,65535]}],producer:{model:'rgb16-high-byte-table',channels:[channel,channel,channel]}});
  const env=await prepareCinfEnvironment(declaration([external('source',providerFork())]));
  const loaded=await load(themeFork(),env,{displayProfile}),v=view(loaded);
  assert.equal(v.displayPolicy,displayProfile.id);assert.equal(v.metadata.colorSamples.displayPolicy,displayProfile.id);
  assert.deepEqual(v.metadata.colorSamples.background,{rgb16:[0x2121,0x2121,0x2121],displayRgb:[101,101,101]});
});
