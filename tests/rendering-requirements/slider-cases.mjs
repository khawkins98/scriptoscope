import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {endpointFork,endpointProvider,endpointIcon} from '../decoder-fixtures/slider-endpoints.mjs';
export const sliderPins=JSON.parse(readFileSync(new URL('../decoder-fixtures/slider-endpoint-pins.json',import.meta.url)));
export const sliderCaseIds=sliderPins.cases.map(p=>p.id);
export const sliderRequirement='geometry.conditional-group2-slider-endpoints';
const sha=b=>createHash('sha256').update(b).digest('hex');
export const sliderBindingIdentity=d=>`cinf-binding:${sha(JSON.stringify({environmentId:d.environmentId,themeForkSha256:d.themeFork.sha256,complete:true,providers:d.providerData.providers}))}`;
export function verifySliderFixtures(root){
 const d=sliderPins.definition;
 for(const pin of [d.fixture,d.forkBuilder])assert.equal(sha(readFileSync(resolve(root,pin.path))),pin.sha256,'owned fixture source');
 assert.equal(sha(endpointFork()),d.themeFork.sha256);assert.equal(endpointFork().length,d.themeFork.byteLength);
 assert.equal(sha(endpointProvider(3)),d.providerData.providers[0].forkSha256);
 assert.equal(endpointProvider(3).length,d.providerData.providers[0].forkByteLength);
 assert.equal(d.environmentId,`cinf-environment:${sha(JSON.stringify(d.providerData))}`);
 assert.equal(d.bindingId,`slider-layout:cinf-binding:${sha(JSON.stringify({environmentId:d.environmentId,themeForkSha256:d.themeFork.sha256,complete:true,providers:d.providerData.providers}))}`);
 for(const t of d.thumbs){const bytes=endpointIcon(t.orientation==='vertical',true);assert.equal(sha(bytes),t.sha256);assert.equal(bytes.length,t.byteLength);}
 for(const p of sliderPins.cases){
  const a=p.sourceAssumptions,travel=48-a.thumbAxis-2*a.corner;
  assert.deepEqual(a,{group:2,corner:3,thumbAxis:7,cross:16,numerator:p.options.value*2,denominator:2,positiveRange:true,noDragOverride:true});
  const pos=3+Math.trunc(travel*(p.options.orientation==='horizontal'?a.numerator:a.denominator-a.numerator)/a.denominator);
  const vertical=p.options.orientation==='vertical';
  assert.deepEqual(p.options,{orientation:vertical?'vertical':'horizontal',state:'normal',length:48,value:a.numerator/2});
  assert.deepEqual(p.size,vertical?[16,48]:[48,16]);
  assert.deepEqual(p.thumbRect,vertical?[0,pos,16,7]:[pos,0,7,16],'literal rectangle against pinned source arithmetic');
 }
}
export function validateSliderCase(c,input){
 const pin=sliderPins.cases.find(p=>p.id===c.id);assert(pin,'unknown slider case');
 assert.equal(c.mode,'direct');assert.equal(c.family,'slider');assert.deepEqual(c.options,pin.options);
 assert.deepEqual(c.inputs,[sliderPins.inputId]);assert.deepEqual(c.baseInputs,[]);
 assert.equal(input.kind,'synthetic');assert.deepEqual(input.definition,sliderPins.definition,'exact declared forks and environment');
}
/** Current declared-lane literal: red thumb over opaque white. The pinned
 * provider has corner cinfs only: archive groove metadata is suppressed.
 * Historical pin identities/statuses remain unchanged; this is modern policy. */
export function sliderLiteralPlane(pin){
 const vertical=pin.options.orientation==='vertical',[width,height]=pin.size,[left,top,w,h]=pin.thumbRect;
 return Array.from({length:width*height},(_,i)=>{
  const x=i%width,y=Math.floor(i/width),cross=vertical?x:y;
  return x>=left&&x<left+w&&y>=top&&y<top+h?[255,0,0,255]:[255,255,255,255];
 }).flat();
}
export function verifySliderRows(result){
 const d=sliderPins.definition;
 assert.deepEqual(result.baseInputs,[],'standalone invocation');assert.equal(result.displayPolicy,d.displayPolicy);
 assert.deepEqual(result.providerData,{id:d.environmentId,data:d.providerData},'actual prepared provider snapshot');
 assert.equal(result.provenance.fork.sha256,d.themeFork.sha256);assert.equal(result.provenance.fork.byteLength,d.themeFork.byteLength);
 assert.deepEqual(result.layoutEnvironment,{environmentId:d.environmentId,bindingId:sliderBindingIdentity(d)},'opaque generic binding identity');
 for(const pin of sliderPins.cases){
  const matches=result.rows.filter(r=>r.orientation===pin.options.orientation&&r.state==='normal'&&r.value===pin.options.value);
  assert.equal(matches.length,1,'missing/duplicate exact invocation');const row=matches[0];
  assert.deepEqual(row.options,pin.options);assert.deepEqual(row.size,pin.size);assert.deepEqual(row.pixels,sliderLiteralPlane(pin),'complete literal output');
  const t=d.thumbs.find(t=>t.orientation===pin.options.orientation),entries=result.thumbEntries.filter(([key])=>key===t.manifestKey);
  assert.equal(entries.length,1,'actual selected thumb key');const [key,element]=entries[0],ref=element.byteProvenance;
  assert.equal(element.sourceCicnId,t.signedId);assert.deepEqual([element.width,element.height],t.size);
  assert.equal(element.sourceCinfId,null,'static local pair remains absent');assert.equal(ref.cinfResourceIndex,null);
  assert.equal(ref.loadId,result.provenance.loadId);assert.equal(ref.manifestKey,key);assert.equal(ref.cicnResourceIndex,t.resourceIndex);
  assert(result.calls.includes(element.asset),'actual thumb decode URL');
  const actual=result.provenance.resources[t.resourceIndex];
  assert.deepEqual({resourceIndex:actual.resourceIndex,type:actual.type,signedId:actual.signedId,status:actual.status,byteLength:actual.byteLength,sha256:actual.sha256},
   {resourceIndex:t.resourceIndex,type:'cicn',signedId:t.signedId,status:'decoded',byteLength:t.byteLength,sha256:t.sha256});
  const resource={providerId:'layout',providerKind:'raw-fork',forkSha256:d.providerData.providers[0].forkSha256,occurrence:t.providerOccurrence,signedId:t.cinfId,byteLength:1,sha256:d.providerData.providers[0].resources[t.providerOccurrence].sha256};
  const role=result.cornerRoles.find(r=>r.orientation===t.orientation);
  assert.deepEqual(role,{orientation:t.orientation,attempts:[{id:t.cinfId,outcome:'found',resource}],selected:resource,corner:3},'typed adapter corner selection');
  assert.equal('sliderLayoutCinf' in element,false,'retired decoded loader view');
 }
 return sliderCaseIds;
}
