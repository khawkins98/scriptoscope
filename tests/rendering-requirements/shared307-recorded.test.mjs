import test from 'node:test';
import assert from 'node:assert/strict';
import {readOriginal} from '../helpers/compact-json.mjs';
import {createHash} from 'node:crypto';
import {prepareDisplayProfile} from '../../tools/theme-loader/display-profile.js';
import {RECORDED_CASES,STATE_SOURCE_PINS} from './recorded-face.mjs';
import {inventoryDigest,makeReport} from './ledger.mjs';
// Original bound bytes: compact files decode exactly; removed duplicates follow their declared alias.
const read=path=>readOriginal(path);
const json=path=>JSON.parse(read(path));
const hash=data=>createHash('sha256').update(data).digest('hex');
const registry=Object.entries(RECORDED_CASES).filter(([,e])=>e.caseSuffix==='shared307');

test('Shared307 retains the complete prior 72-case/509-obligation ledger and old source pins',()=>{
 const ledger=json('tests/rendering-requirements/ledger.json'),transition=json('tests/rendering-requirements/shared307-recorded-transition.json'),prior=structuredClone(ledger);
 for(const [key,count] of Object.entries(transition.counts)){
  prior[key]=prior[key].slice(0,count);assert.equal(hash(JSON.stringify(prior[key])),transition.prefixSha256[key],key);
 }
 Object.assign(prior,{inventoryVersion:transition.inventoryVersion,inventorySha256:transition.inventorySha256,scope:transition.scope});
 assert.equal(inventoryDigest(prior),transition.inventorySha256);assert.equal(hash(JSON.stringify(prior)),transition.priorObjectSha256);
 assert.deepEqual(makeReport(prior).requirementStatus.counts,{verified:91,mismatched:0,unsupported:0,unknown:418});
 const next=json('tests/rendering-requirements/evolution-recorded-transition.json'),historical=structuredClone(ledger);
 for(const [key,count] of Object.entries(next.counts))historical[key]=historical[key].slice(0,count);
 Object.assign(historical,{inventoryVersion:next.inventoryVersion,inventorySha256:next.inventorySha256,scope:next.scope});
 assert.equal(inventoryDigest(historical),next.inventorySha256);assert.equal(hash(JSON.stringify(historical)),next.priorObjectSha256);
 const added=historical.assessments.slice(transition.counts.assessments);
 assert.equal(added.length,108);assert.equal(added.filter(a=>a.status==='verified').length,18);
 assert(added.every(a=>a.status===(a.requirementId==='output.recorded-composited-face'?'verified':'unknown')));
 assert.deepEqual(makeReport(historical).requirementStatus.counts,{verified:109,mismatched:0,unsupported:0,unknown:508});
 assert(ledger.cases.every(c=>c.inventoryClosure.status==='open'));
 const oldPins=Object.fromEntries(Object.entries(STATE_SOURCE_PINS).filter(([slug])=>prior.cases.some(c=>c.recordedComparison && c.inputs.includes('theme.'+slug))));
 assert.equal(hash(JSON.stringify(oldPins)),transition.priorSourcePinsSha256);
});

test('six separate finite profiles join all 3684 native query rows, positional palettes, gamma and finite producer samples',async()=>{
 assert.equal(registry.length,6);
 for(const [slug,entry] of registry){
  const base='tests/reference-captures/'+slug+'-calibration/';
  const data=json(entry.profile.path),binding=json(base+'profile-binding.json'),measurement=json(base+'measurement.json');
  assert.equal(hash(read(entry.profile.path)),entry.profile.sha256);assert.equal(hash(read(base+'prepared-profile.json')),entry.profile.sha256);
  assert.equal(binding.id,entry.profile.id);assert.equal(hash(read(base+'measurement.json')),binding.measurement.sha256);
  const profile=await prepareDisplayProfile(data);assert.equal(profile.id,entry.profile.id);
  assert.equal(data.version,1);assert.equal(data.directRgb8,undefined);assert.notEqual(data.conditions.device?.currentEqualsMain,true);
  assert.equal(data.conditions.configuredScheme.slug,slug);assert.equal(data.conditions.configuredScheme.forkSha256,measurement.source.forkSha256);
  const rows=measurement.actualRows;assert.equal(rows.length,614);assert.equal(data.mappings.length,307);
  const palette=read(base+'indexed-palette.bin'),gamma=read(base+'producer-table.bin');
  assert.equal(hash(palette),measurement.sameRunPalette.sha256);assert.equal(hash(gamma),measurement.sameRunGamma.sha256);
  assert.equal(palette.length,2056);assert.equal(palette.readUInt16BE(4),32768);assert.equal(palette.readUInt16BE(6),255);
  assert.equal(gamma.length,268);assert.deepEqual(Array.from({length:6},(_,i)=>gamma.readUInt16BE(i*2)),[0,0,0,1,256,8]);
  const positional=Array.from({length:256},(_,index)=>({index,rgb16:[0,1,2].map(c=>palette.readUInt16BE(8+index*8+2+c*2))}));
  assert.deepEqual(data.devicePalette,positional);
  assert.deepEqual(data.producer.channels,[0,1,2].map(()=>Array.from(gamma.subarray(12))));
  for(let i=0;i<307;i++){
   const a=rows[i],b=rows[i+307];assert.equal(a.batch,1);assert.equal(b.batch,2);assert.equal(a.sample,i);assert.equal(b.sample,i);
   assert.deepEqual(a.inputRGB16,b.inputRGB16);assert.equal(a.deviceIndex,b.deviceIndex);assert.deepEqual(a.reverseRGB16,b.reverseRGB16);
   assert.deepEqual(a.reverseRGB16,positional[a.deviceIndex].rgb16);
   assert.deepEqual(data.mappings[i],{rgb16:a.inputRGB16,deviceIndex:a.deviceIndex,deviceRgb16:a.reverseRGB16});
  }
  for(const sample of measurement.hostProducerSamples)assert.deepEqual(sample.observedRGBA,[...sample.nativeRGB16.map(v=>gamma[12+(v>>>8)]),255]);
 }
});
