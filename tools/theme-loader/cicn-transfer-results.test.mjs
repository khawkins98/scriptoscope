import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { prepareCicnTransferResults, describeCicnTransferSource } from './cicn-transfer-results.js';
import { prepareDisplayProfile } from './display-profile.js';
import { loadKaleidoscopeScheme } from './loadKaleidoscopeScheme.js';
import { forkOf } from '../../tests/resource-provenance/fixtures.mjs';
const fixture = JSON.parse(fs.readFileSync(new URL('../../tests/decoder-fixtures/finite-cicn-transfer.json',import.meta.url)));
const clone = v => structuredClone(v);
async function setup(data=fixture.data, profile=fixture.profile) {
  const results=await prepareCicnTransferResults(data);
  return {displayProfile:await prepareDisplayProfile(profile),cicnTransfer:{results,contractId:results.contractId,maskPolicy:'source-mask-alpha'}};
}
const load = (opts,bytes=fixture.fork) => loadKaleidoscopeScheme(Uint8Array.from(bytes),{...opts,encodeAssets:false});
test('finite plane retains every destination RGB, separately applies mask, and binds actual occurrence',async()=>{
  const opts=await setup(),theme=await load({...opts,provenance:true});
  assert.deepEqual([...theme.assets[0].rgba],fixture.expectedRgba);
  const e=theme.manifest.chromeElements.owned,p=e.cicnTransfer;
  assert.equal(e.samplingEquivalence.status,'unknown'); // raw source sampler stays unsafe
  assert.equal(e.colorSamples,null);assert.equal(e.bodyRequest,null);
  assert.equal(p.forkSha256,theme.byteProvenance.fork.sha256);
  assert.equal(p.source.payloadSha256,theme.byteProvenance.resources[0].sha256);
  assert.deepEqual(p.resource,{type:'cicn',signedId:-10239,resourceIndex:0});
  assert.equal(p.resultsId,opts.cicnTransfer.results.id);assert(Object.isFrozen(p.operation));
  assert.throws(()=>{p.operation.sourceRect[0]=1;},TypeError);
  assert.equal(opts.displayProfile.data.mappings.length,1); // no destination RGB16 query mapping exists
  await assert.rejects(load({displayProfile:opts.displayProfile}),e=>e.code==='UNSUPPORTED_SOURCE_COLOR');
  const legacy=await load({});assert.equal(legacy.manifest.chromeElements.owned.cicnTransfer,undefined);
});
test('same source index can have distinct observed coordinates; sampler comparison checks both',async()=>{
  const bytes=Uint8Array.from(fixture.bytes);bytes.set([0,0],bytes.length-2);
  const data=clone(fixture.data);data.records[0].source=await describeCicnTransferSource(bytes);
  const theme=await load(await setup(data),forkOf([{type:'cicn',id:-10239,name:'owned',data:bytes}]));
  assert.equal(theme.manifest.chromeElements.owned.samplingEquivalence.status,'different');
  assert.deepEqual([...theme.assets[0].rgba],fixture.expectedRgba);
});
test('factory snapshots before hashing; loader snapshots input and authorization before awaits',async()=>{
  const input=clone(fixture.data),pending=prepareCicnTransferResults(input);
  input.records[0].destinationIndices[0]=3;
  const results=await pending;assert.equal(results.data.records[0].destinationIndices[0],2);
  const displayProfile=await prepareDisplayProfile(fixture.profile),bytes=Uint8Array.from(fixture.fork);
  const option={results,contractId:results.contractId,maskPolicy:'source-mask-alpha'};
  const loading=loadKaleidoscopeScheme(bytes,{displayProfile,cicnTransfer:option,encodeAssets:false});
  bytes.fill(0);option.contractId='changed';
  assert.deepEqual([...(await loading).assets[0].rgba],fixture.expectedRgba);
});
test('closed data rejects wrong context, incomplete plane, unbound palette, duplicate source and fields',async()=>{
  for(const change of [
    d=>d.extra=true,d=>d.records[0].operation.extra=true,d=>d.records[0].operation.masked=true,
    d=>d.records[0].operation.foregroundRGB16=[1,0,0],d=>d.records[0].operation.clipRect=[6,6,8,7],
    d=>d.records[0].destinationIndices.pop(),d=>d.records[0].destinationIndices[0]=255,
    d=>d.records.push(clone(d.records[0])),d=>d.environment.devicePalette.push(clone(d.environment.devicePalette[0])),
    d=>d.records[0].preparationEvidenceSha256='unknown',
  ]){const d=clone(fixture.data);change(d);await assert.rejects(prepareCicnTransferResults(d),e=>e.code==='INVALID_CICN_TRANSFER');}
});
test('forgery, representation/context/profile drift and unlisted sparse inputs fail before any URL',async()=>{
  const opts=await setup();let allocated=0;
  const reject=async(options,bytes=fixture.fork)=>assert.rejects(loadKaleidoscopeScheme(Uint8Array.from(bytes),{...options,assetUrlFactory:()=>{allocated++;return'never';}}));
  await reject({...opts,cicnTransfer:{...opts.cicnTransfer,results:{...opts.cicnTransfer.results}}});
  await reject({...opts,cicnTransfer:{...opts.cicnTransfer,contractId:'wrong'}});
  await reject({cicnTransfer:opts.cicnTransfer});
  const profile=clone(fixture.profile);profile.producer.channels[0][17]++;
  await reject({...opts,displayProfile:await prepareDisplayProfile(profile)});
  const data=clone(fixture.data);data.records[0].source.indexedRepresentationSha256='f'.repeat(64);
  await reject(await setup(data));
  const other=Uint8Array.from(fixture.bytes);other[0]=1;
  await reject(opts,forkOf([{type:'cicn',id:-10239,name:'owned',data:other}]));
  const mapped=Uint8Array.from(fixture.bytes);mapped.set([0,0],mapped.length-2);
  const mappedFork=forkOf([{type:'cicn',id:99,name:'mapped-unrelated',data:mapped}]);
  assert.equal((await load({displayProfile:opts.displayProfile},mappedFork)).assets.length,1);
  await reject(opts,mappedFork); // fully mapped input still must match an explicitly selected transfer
  const duplicated=forkOf([0,1].map(()=>({type:'cicn',id:-10239,name:'owned',data:Uint8Array.from(fixture.bytes)})));
  await reject(opts,duplicated);
  assert.equal(allocated,0);
});
