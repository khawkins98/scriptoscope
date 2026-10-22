import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';import {fileURLToPath} from 'node:url';
import {mixedPins,verifyMixedFixtures,validateMixedCase,verifyMixedRows} from './mixed-cases.mjs';
import {makeReport,digest} from './ledger.mjs';
import {buildLedger} from './build-ledger.mjs';
const ledger=JSON.parse(readFileSync(new URL('./ledger.json',import.meta.url)));
// Verifier negatives use declared synthetic records, never pretend to execute rendering.
const rows=()=>mixedPins.cases.map(p=>{
 const resources=p.definition.resources.map((e,i)=>({resourceIndex:i,type:e.type,signedId:e.id,status:'decoded',byteLength:e.byteLength,sha256:e.sha256}));
 const i=resources.findIndex(r=>r.signedId===p.expectedId),asset=`blob:owned-${p.id}`,loadId=`owned-${p.id}`;
 return {kind:p.kind,name:p.rowName,mixed:true,checked:false,disabled:p.options.disabled,options:p.options,keep:p.keep,size:p.size,pixels:p.pixels,calls:[asset],selected:[['selected',{sourceCicnId:p.expectedId,asset,byteProvenance:{loadId,manifestKey:'selected',cicnResourceIndex:i}}]],provenance:{loadId,fork:{sha256:p.definition.forkSha256},resources}};
});
test('mixed exact input pins and source arithmetic remain independently bound',()=>{
 verifyMixedFixtures(fileURLToPath(new URL('../../',import.meta.url)));assert.equal(verifyMixedRows(rows()).length,8);
 for(const p of mixedPins.cases){const c=ledger.cases.find(c=>c.id===p.id),input=ledger.inputs.find(i=>i.id===p.inputId);validateMixedCase(c,input);
 for(const mutate of[c=>c.family='push',c=>c.mode='declarative',c=>c.options.checked=true,c=>c.options.label='X',c=>c.baseInputs=['other'],c=>c.inputs=['other']]){const altered=structuredClone(c);mutate(altered);assert.throws(()=>validateMixedCase(altered,input));}}
});
test('mixed joins reject edited invocation, availability, fork, decoded owner, occurrence or pixels',()=>{
 for(const mutate of[
 r=>r.options.checked=true,r=>r.keep.pop(),r=>r.provenance.fork.sha256='0'.repeat(64),
 r=>r.selected[0][1].sourceCicnId--,r=>r.selected[0][1].byteProvenance.loadId='other',
 r=>r.selected[0][1].byteProvenance.cicnResourceIndex=0,r=>r.calls[0]='blob:other',
 r=>r.provenance.resources.forEach(e=>e.status='error'),r=>r.provenance.resources.forEach(e=>e.sha256='0'.repeat(64)),
 r=>r.pixels.pop(),r=>r.pixels[0]=42,r=>r.size=[2,1],
 ]){const altered=structuredClone(rows());mutate(altered[0]);assert.throws(()=>verifyMixedRows(altered));}
 assert.throws(()=>verifyMixedRows(rows().slice(1)),/missing\/duplicate/);assert.throws(()=>verifyMixedRows([...rows(),rows()[0]]),/missing\/duplicate/);
});
test('mixed assertion remains unexecuted for stale, dirty or wrong-path evidence',()=>{
 const marker={id:'checkable.mixed-cicn-selection',mode:'source',path:'tests/rendering-options/mixed-checkable.spec.mjs',status:'passed'};
 for(const execution of[undefined,{executionCommit:'old',workingTreeDirty:false,assertions:[marker]},{executionCommit:'current',workingTreeDirty:true,assertions:[marker]},{executionCommit:'current',workingTreeDirty:false,assertions:[{...marker,path:'wrong'}]}]){
 const r=makeReport(ledger,{executionCommit:'current',workingTreeDirty:false,execution});assert(r.execution.assertions.find(a=>a.id===marker.id).modes.every(m=>m.status==='not run'));
 }
});
// Historical prefixes are pinned to the 1.22.0 split state (every post-split family transition undone), as in ledger.test.mjs.
test('all prior registry objects and evidence history remain exact',()=>{
 const ledger=buildLedger({mode:'base'}).ledger;
 assert.equal(digest(JSON.stringify(ledger.inputs.slice(0,25))), '98168629efae7ddd699548a564c3c5376e9542665f448b3f1c74ee4a89a6b9a3');
 assert.equal(digest(JSON.stringify(ledger.evidence.slice(0,31))), '6813324ccdb6f43ae413dff8e05382895b2ad28090defdd8377e7abe93e4736b');
 assert.equal(digest(JSON.stringify(ledger.requirements.slice(0,34))), '03c223e30ebd76d44acbd794a4a307322bcb98b79fd8528c0dfa9df1e69cc8c4');
 assert.equal(digest(JSON.stringify(ledger.assertions.slice(0,18))), '5828a427d6d89b8a47a7fb2db054e36a5d5e1fa4158c544ac0d5408fc6050497');
 assert.equal(digest(JSON.stringify(ledger.cases.slice(0,32))), 'ba8fa653ec858c57bf503da46aeaeff198127b2f762d1e62e69b9972ff45c00d');
 assert.equal(digest(JSON.stringify(ledger.assessments.slice(0,269))), 'a5e9f0e0c9fdfe12774426457257661fd698f473ef50fe71789179348bab6527');
});
