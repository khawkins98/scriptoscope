import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {sliderPins,sliderCaseIds,verifySliderFixtures,validateSliderCase,verifySliderRows,sliderLiteralPlane} from './slider-cases.mjs';
import {makeReport,digest,inventoryDigest} from './ledger.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url)),ledger=JSON.parse(readFileSync(new URL('./ledger.json',import.meta.url)));
// Owned records exercise verifier rejection, not a claim of browser execution.
function fixture(){
 const d=sliderPins.definition,loadId='owned-load',resources=Array.from({length:6},()=>({}));
 const layoutEnvironment={environmentId:d.environmentId,bindingId:d.bindingId,themeForkSha256:d.themeFork.sha256,policy:'caller-declared-ordered-cinf-only',scope:'standalone-group2-slider-layout'};
 const thumbEntries=d.thumbs.map(t=>{
  resources[t.resourceIndex]={resourceIndex:t.resourceIndex,type:'cicn',signedId:t.signedId,status:'decoded',byteLength:t.byteLength,sha256:t.sha256};
  const resource={providerId:'layout',providerKind:'raw-fork',forkSha256:d.providerData.providers[0].forkSha256,occurrence:t.providerOccurrence,signedId:t.cinfId,byteLength:1,sha256:d.providerData.providers[0].resources[t.providerOccurrence].sha256};
  return [t.manifestKey,{sourceCicnId:t.signedId,sourceCinfId:null,width:t.size[0],height:t.size[1],asset:`blob:${t.signedId}`,byteProvenance:{loadId,manifestKey:t.manifestKey,cicnResourceIndex:t.resourceIndex,cinfResourceIndex:null},sliderLayoutCinf:{...layoutEnvironment,orientation:t.orientation,thumbId:t.signedId,attempts:[{id:t.cinfId,outcome:'found',resource}],selected:resource,status:'ready',corner:3}}];
 });
 return structuredClone({baseInputs:[],displayPolicy:d.displayPolicy,providerData:{id:d.environmentId,data:d.providerData},layoutEnvironment,provenance:{loadId,fork:{...d.themeFork},resources},thumbEntries,calls:thumbEntries.map(([,e])=>e.asset),rows:sliderPins.cases.map(p=>({orientation:p.options.orientation,state:'normal',value:p.options.value,options:p.options,size:p.size,pixels:sliderLiteralPlane(p)}))});
}
test('slider exact owned inputs and six literal source positions stay bound',()=>{
 verifySliderFixtures(root);assert.deepEqual(verifySliderRows(fixture()),sliderCaseIds);
 for(const p of sliderPins.cases){
  const c=ledger.cases.find(c=>c.id===p.id),input=ledger.inputs.find(i=>i.id===sliderPins.inputId);validateSliderCase(c,input);
  for(const change of[c=>c.family='push',c=>c.mode='declarative',c=>c.options.length=64,c=>c.options.state='pressed',c=>c.options.value=.25,c=>c.baseInputs=['base'],c=>c.inputs=['other']]){
   const changed=structuredClone(c);change(changed);assert.throws(()=>validateSliderCase(changed,input));
  }
 }
});
test('slider actual request, provider, thumb, URL and complete output joins reject mutations',()=>{
 const changes=[r=>r.baseInputs.push('base'),r=>r.displayPolicy='other',r=>r.providerData.data.complete=false,
  r=>r.providerData.data.providers[0].resources[0].sha256='0'.repeat(64),r=>r.layoutEnvironment.bindingId='other',
  r=>r.provenance.fork.sha256='0'.repeat(64),r=>r.provenance.fork.byteLength--,
  r=>r.rows[0].options.length=64,r=>r.rows[0].size=[16,48],r=>r.rows[0].pixels.pop(),r=>r.rows[0].pixels[0]=255,
  r=>r.thumbEntries[0][0]='wrong-key',r=>r.thumbEntries[0][1].sourceCicnId--,
  r=>r.thumbEntries[0][1].width=8,r=>r.thumbEntries[0][1].byteProvenance.loadId='other',
  r=>r.thumbEntries[0][1].byteProvenance.cicnResourceIndex=5,r=>r.provenance.resources[2].status='error',
  r=>r.provenance.resources[2].sha256='0'.repeat(64),r=>r.calls[0]='other',
  r=>r.thumbEntries[0][1].sliderLayoutCinf.corner=0,r=>r.thumbEntries[0][1].sliderLayoutCinf.selected.providerId='other',
  r=>r.thumbEntries[0][1].sliderLayoutCinf.attempts[0].outcome='missing'];
 for(const change of changes){const rows=fixture();change(rows);assert.throws(()=>verifySliderRows(rows));}
 for(const change of[r=>r.rows.shift(),r=>r.rows.push(r.rows[0])]){const rows=fixture();change(rows);assert.throws(()=>verifySliderRows(rows),/missing\/duplicate/);}
});
test('slider assertion cannot use stale, dirty, wrong-path or missing-mode execution',()=>{
 const marker={id:'slider.declared-group2-endpoints',mode:'source',path:'tests/rendering-options/slider-endpoints.spec.mjs',status:'passed'};
 for(const execution of[undefined,{executionCommit:'old',workingTreeDirty:false,assertions:[marker]},{executionCommit:'current',workingTreeDirty:true,assertions:[marker]},{executionCommit:'current',workingTreeDirty:false,assertions:[{...marker,path:'wrong'}]},{executionCommit:'current',workingTreeDirty:false,assertions:[{...marker,mode:undefined}]}]){
  const r=makeReport(ledger,{executionCommit:'current',workingTreeDirty:false,execution});assert(r.execution.assertions.find(a=>a.id===marker.id).modes.every(m=>m.status==='not run'));
 }
});
test('complete prior inventory and all historical registry prefixes are unchanged',()=>{
 const transition=JSON.parse(readFileSync(new URL('./conditional-controls-transition.json',import.meta.url))),prior=structuredClone(ledger);
 for(const [key,count] of Object.entries(transition.counts)){
  prior[key]=prior[key].slice(0,count);assert.equal(digest(JSON.stringify(prior[key])),transition.prefixSha256[key],`${key} prefix`);
 }
 Object.assign(prior,{inventoryVersion:transition.inventoryVersion,inventorySha256:transition.inventorySha256,scope:transition.scope});
 assert.equal(inventoryDigest(prior),transition.inventorySha256);assert.equal(digest(JSON.stringify(prior)),transition.priorObjectSha256);
 assert.equal(prior.cases.length,40);assert.equal(prior.assessments.length,317);
});
