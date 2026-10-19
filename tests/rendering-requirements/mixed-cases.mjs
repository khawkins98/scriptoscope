import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {onePixelCicn,forkOf} from '../resource-provenance/fixtures.mjs';
export const mixedPins=JSON.parse(readFileSync(new URL('../decoder-fixtures/mixed-checkable-pins.json',import.meta.url)));
export const mixedCaseIds=mixedPins.cases.map(p=>p.id);
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
export function verifyMixedFixtures(root){
 assert.equal(hash(readFileSync(resolve(root,mixedPins.fixture.path))),mixedPins.fixture.sha256,'owned fixture source');
 for(const p of mixedPins.cases){
  const entries=p.definition.resources.map(r=>{const data=onePixelCicn(),v=new DataView(data.buffer);r.rgb16.forEach((c,i)=>v.setUint16(94+2*i,c));assert.equal(hash(data),r.sha256);assert.equal(data.length,r.byteLength);return {...r,data};});
  assert.equal(hash(forkOf(entries)),p.definition.forkSha256,'exact declared fork');
  assert.equal(p.value,2);assert.equal(p.tier,p.options.disabled?0:1);
  assert.deepEqual(p.options,{label:'',checked:false,mixed:true,disabled:p.tier===0});assert.deepEqual(p.size,[1,1]);
  const mixed=-9504+12*Number(p.kind==='radio')+6+p.tier;
  const selected=entries.some(r=>r.id===mixed)?mixed:mixed-3;
  assert.equal(p.expectedId,selected,'independent source selector');
  const chosen=entries.find(r=>r.id===selected);assert(chosen,'selected declaration absent');
  assert(chosen.rgb16.every(c=>c===0 || c===65535),'literal RGB endpoints');assert.deepEqual(p.pixels,[...chosen.rgb16.map(c=>c/257),255],'literal complete opaque pixel');
 }
}
export function validateMixedCase(c,input){
 const p=mixedPins.cases.find(p=>p.id===c.id);assert(p,'unknown mixed case');
 assert.equal(c.mode,'direct');assert.equal(c.family,p.kind);assert.deepEqual(c.options,p.options);assert.deepEqual(c.inputs,[p.inputId]);assert.deepEqual(c.baseInputs,[]);
 assert.equal(input.kind,'synthetic');assert.deepEqual(input.definition,{pins:{path:'tests/decoder-fixtures/mixed-checkable-pins.json',sha256:hash(readFileSync(new URL('../decoder-fixtures/mixed-checkable-pins.json',import.meta.url)))},caseId:p.id,forkSha256:p.definition.forkSha256},'exact owned input');
}
export function verifyMixedRows(rows){
 for(const p of mixedPins.cases){
  const matches=rows.filter(r=>r.kind===p.kind && r.name===p.rowName && r.mixed===true && !r.checked && !!r.disabled===p.options.disabled);
  assert.equal(matches.length,1,`${p.id}: missing/duplicate invocation`);const r=matches[0];
  assert.deepEqual(r.options,p.options,'actual invocation');assert.deepEqual(r.keep,p.keep,'declared availability');
  assert.equal(r.provenance.fork.sha256,p.definition.forkSha256,'actual loaded fork');
  assert.deepEqual(r.size,p.size);assert.deepEqual(r.pixels,p.pixels,'complete literal output');
  assert.equal(r.selected.length,1);assert.equal(r.calls.length,1);
  const [key,e]=r.selected[0],ref=e.byteProvenance,actual=r.provenance.resources[ref.cicnResourceIndex],expected=p.definition.resources.find(e=>e.id===p.expectedId);
  assert.equal(e.sourceCicnId,p.expectedId);assert.equal(ref.loadId,r.provenance.loadId);assert.equal(ref.manifestKey,key);assert.equal(r.calls[0],e.asset,'actual decoded selected URL');
  assert.deepEqual({type:actual.type,signedId:actual.signedId,status:actual.status,byteLength:actual.byteLength,sha256:actual.sha256},{type:'cicn',signedId:p.expectedId,status:'decoded',byteLength:expected.byteLength,sha256:expected.sha256});
 }
 return mixedCaseIds;
}
