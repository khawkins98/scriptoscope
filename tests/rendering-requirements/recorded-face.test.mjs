import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {captureBinding,validateRecordedBinding,validateRecordedExecution,compareRecordedPixels,PROFILE,exactOptions} from './recorded-face.mjs';
const ledger=JSON.parse(readFileSync(new URL('./ledger.json',import.meta.url)));
const captures=JSON.parse(readFileSync(new URL('../reference-captures/captures.json',import.meta.url))).captures;
// Synthetic assessor results exercise the join; these are not review records.
const context=()=>({captures:structuredClone(captures),report:{captures:captures.map(c=>({captureId:c.id,status:'reviewed-scoped-observation'}))}});
const c=()=>structuredClone(ledger.cases.find(c=>c.recordedComparison));
function reject(change,re){const x=c(),ctx=context(),b=structuredClone(x.recordedComparison);change(x,b,ctx);assert.throws(()=>validateRecordedBinding(x,b,ctx),re);}
test('recorded reference rejects stale/unreviewed, swapped case/profile/crop and incomplete source scope',()=>{
 assert.equal(validateRecordedBinding(c(),c().recordedComparison,context()).id,c().recordedComparison.captureId);
 reject((_c,_b,ctx)=>ctx.report.captures[0].status='awaiting-independent-review',/not currently reviewed/);
 reject((_c,b)=>b.requestDigest='0'.repeat(64),/stale or wrong/);
 reject((_c,b)=>b.captureDigest='0'.repeat(64),/stale or wrong/);
 reject((c)=>c.mode='declarative',/mode\/family/);
 reject((c)=>c.family='bevel',/mode\/family/);
 reject((c)=>c.options.disabled=true,/wrong exact case/);
 reject((c)=>c.inputs=['theme.system7-nostalgia-silver'],/source\/base/);
 reject((_c,b)=>b.profile={...b.profile,id:'other-profile'},/stale or wrong/);
 reject((_c,b)=>b.faceImageRect=[19,20,80,20],/stale or wrong/);
 reject((_c,b,ctx)=>b.captureId=ctx.captures[1].id,/stale or wrong/);
});
test('all1600 displayed pixels matter, while transparent white composition does not assert source alpha',()=>{
 const original=new Uint8Array(6400).fill(255),raw=new Uint8Array(original);
 assert.equal(compareRecordedPixels(raw,original),0);raw[6396]=254;assert.equal(compareRecordedPixels(raw,original),1);
 raw.set([0,0,0,0],6396);assert.equal(compareRecordedPixels(raw,original),0);
 assert.throws(()=>compareRecordedPixels(raw.subarray(0,6396),original),/all 1600/);
});
function execution(){
 const capture=captures.find(c=>c.requestId==='windows-95.normal'),binding=captureBinding(capture);
 const source={loadId:'unit-load',manifestKey:'unit-face',cicnResourceIndex:1,cinfResourceIndex:2};
 const resource={type:'cicn',signedId:-10239,manifestKey:'unit-face',sourceCinfId:-10239,assetUrl:'unit:asset',byteProvenance:source},owner={baseUrl:'unit:owner',chainDepth:0};
 return {capture,binding,row:{slug:capture.source.slug,state:'normal',options:exactOptions('normal'),outcome:{status:'themed',width:88,height:28},requested:{state:'active',pressed:false,disabled:false,default:false},profile:PROFILE.id,policy:PROFILE.id,originalComparison:{binding,differentPixels:0,comparedPixels:1600},profileInput:capture.source.archiveSha256,profileFork:capture.source.forkSha256,size:[88,28],facePlane:{rect:[4,4,80,20]},paintSelectionSteps:[{role:'face',usage:'paint',action:'selected',owner,resource}],bandPaints:[{role:'face',owner,resource}],source,loadId:source.loadId,resources:[{resourceIndex:1,type:'cicn',status:'decoded',signedId:-10239},{resourceIndex:2,type:'cinf',status:'decoded',signedId:-10239}],selectedKey:'unit-face',selectedAsset:'unit:asset',selectedCinfId:-10239,profileBaseUrl:owner.baseUrl}};
}
test('completed modern paint joins reject wrong owners, occurrences, profile and failed/partial execution',()=>{
 let x=execution();validateRecordedExecution(x.row,x.binding,x.capture);
 for(const [change,re] of [
  [r=>r.profile='wrong',/profile/],[r=>r.profileFork='wrong',/source bytes/],
  [r=>r.bandPaints=[],/paint dependency/],[r=>r.bandPaints=[{...r.bandPaints[0],owner:{baseUrl:'foreign',chainDepth:1}}],/paint dependency/],
  [r=>r.loadId='other',/occurrence\/load/],[r=>r.selectedAsset='other',/face identity/],
  [r=>r.outcome.status='error',/did not complete/],[r=>r.originalComparison.differentPixels=1,/pixel mismatch/],
  [r=>r.originalComparison.comparedPixels=1599,/incomplete/],[r=>r.requested.pressed=true,/request flags/],
 ]){x=execution();change(x.row);assert.throws(()=>validateRecordedExecution(x.row,x.binding,x.capture),re);}
});

test('recorded comparisons remain execution-unverified when the registered source/built marker is absent or stale',async()=>{
 const {makeReport}=await import('./ledger.mjs');
 const report=makeReport(ledger,{executionCommit:'current',workingTreeDirty:false,execution:{executionCommit:'older',workingTreeDirty:false,assertions:[{id:'recorded.empty-face-six',mode:'source',path:'tests/rendering-options/display-profile.spec.mjs',status:'passed'}]}});
 assert.equal(report.recordedConditionComparisons.cases.length,7);
 assert(report.recordedConditionComparisons.cases.every(c=>c.status==='unknown'&&c.execution.every(m=>m.status==='not run')));
});


test('Crayon exact context/profile and selected pattern payload are required without a pattern occupancy claim',()=>{
 const capture=captures.find(c=>c.requestId==='crayon-os.normal'),binding=captureBinding(capture);
 const pins=JSON.parse(readFileSync(new URL('../decoder-fixtures/crayon-recorded-source-pins.json',import.meta.url)));
 const make=()=>{
  const r=execution().row;Object.assign(r,{slug:'crayon-os',options:exactOptions('normal','crayon-os'),profile:binding.profile.id,policy:binding.profile.id,
   profileInput:capture.source.archiveSha256,profileFork:capture.source.forkSha256,originalComparison:{binding,differentPixels:0,comparedPixels:1600},
   composition:{faceRect:{x:20,y:20,w:80,h:20}},recordedSourcePins:structuredClone(pins),patternAsset:'unit:pattern'});
  r.source.cicnResourceIndex=pins.face.resourceIndex;r.source.cinfResourceIndex=pins.cinf.resourceIndex;
  r.resources=[...['face','cinf','pattern'].map(k=>({resourceIndex:pins[k].resourceIndex,signedId:pins[k].signedId,sha256:pins[k].payloadSha256,status:'decoded',type:k==='face'?'cicn':k==='pattern'?'ppat':'cinf'}))];
  r.paintSelectionSteps.push({role:'body-fill',usage:'paint',action:'selected',owner:r.paintSelectionSteps[0].owner,resource:{type:'ppat',signedId:17,manifestKey:'unit-pattern',assetUrl:'unit:pattern',byteProvenance:{loadId:r.loadId,manifestKey:'unit-pattern',ppatResourceIndex:pins.pattern.resourceIndex}}});return r;
 };
 validateRecordedExecution(make(),binding,capture);
 for(const [change,re]of [[r=>delete r.options.compositionContext,/options/],
  [r=>r.composition.faceRect.x=0,/port face/],[r=>r.profile=PROFILE.id,/profile/],
  [r=>r.resources[2].sha256='bad',/pattern owner\/payload/],
  [r=>r.paintSelectionSteps[1].resource.byteProvenance.loadId='foreign',/pattern owner\/payload/],
  [r=>r.bandPaints=[],/paint dependency/]]){const r=make();change(r);assert.throws(()=>validateRecordedExecution(r,binding,capture),re);}
});
