import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {validateCompletedFacePaint,captureBinding,validateRecordedBinding,validateRecordedExecution,compareRecordedPixels,PROFILE,CRAYON_PROFILE,RECORDED_CASES,profileFor,recordedSubjects,validateRecordedProfiles,exactOptions} from './recorded-face.mjs';
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
 assert.equal(report.recordedConditionComparisons.cases.length,45);
 assert(report.recordedConditionComparisons.cases.every(c=>c.status==='unknown'&&c.execution.every(m=>m.status==='not run')));
});


test('Crayon exact context/profile and selected pattern payload are required without a pattern occupancy claim',()=>{
 const capture=captures.find(c=>c.requestId==='crayon-os.normal'),binding=captureBinding(capture);
 const pins=JSON.parse(readFileSync(new URL('../decoder-fixtures/crayon-recorded-source-pins.json',import.meta.url)));
 const make=()=>{
  const r=execution().row;Object.assign(r,{slug:'crayon-os',options:exactOptions('normal','crayon-os'),profile:binding.profile.id,policy:binding.profile.id,
   profileInput:capture.source.archiveSha256,profileFork:capture.source.forkSha256,originalComparison:{binding,differentPixels:0,comparedPixels:1600},
   composition:{faceRect:{x:20,y:20,w:80,h:20},context:{...exactOptions('normal','crayon-os').compositionContext,basis:'caller-declared'},appliedUnknownPatternOffset:true,originalPortState:'unverified'},recordedSourcePins:structuredClone(pins),patternAsset:'unit:pattern'});
  r.source.cicnResourceIndex=pins.face.resourceIndex;r.source.cinfResourceIndex=pins.cinf.resourceIndex;
  r.resources=[...['face','cinf','pattern'].map(k=>({resourceIndex:pins[k].resourceIndex,signedId:pins[k].signedId,sha256:pins[k].payloadSha256,status:'decoded',type:k==='face'?'cicn':k==='pattern'?'ppat':'cinf'}))];
  r.paintSelectionSteps.push({role:'body-fill',usage:'paint',action:'selected',owner:r.paintSelectionSteps[0].owner,resource:{type:'ppat',signedId:17,manifestKey:'unit-pattern',assetUrl:'unit:pattern',byteProvenance:{loadId:r.loadId,manifestKey:'unit-pattern',ppatResourceIndex:pins.pattern.resourceIndex}}});return r;
 };
 validateRecordedExecution(make(),binding,capture);
 for(const [change,re]of [[r=>delete r.options.compositionContext,/options/],
  [r=>r.composition.faceRect.x=0,/port face/],[r=>r.profile=PROFILE.id,/profile/],[r=>r.composition.context.clip.rect.w=80,/actual port context/],
  [r=>r.resources[2].sha256='bad',/pattern owner\/payload/],
  [r=>r.paintSelectionSteps[1].resource.byteProvenance.loadId='foreign',/pattern owner\/payload/],
  [r=>r.bandPaints=[],/paint dependency/]]){const r=make();change(r);assert.throws(()=>validateRecordedExecution(r,binding,capture),re);}
});

test('Lisa requires its exact profile/context/payloads and actual no-ppat0 observation',()=>{
 const capture=captures.find(c=>c.requestId==='apple-lisa.normal'),binding=captureBinding(capture);
 const pins=JSON.parse(readFileSync(new URL('../decoder-fixtures/lisa-recorded-source-pins.json',import.meta.url)));
 const make=()=>{
  const r=execution().row;Object.assign(r,{slug:'apple-lisa',options:exactOptions('normal','apple-lisa'),profile:binding.profile.id,policy:binding.profile.id,
   profileInput:capture.source.archiveSha256,profileFork:capture.source.forkSha256,originalComparison:{binding,differentPixels:0,comparedPixels:1600},
   composition:{faceRect:{x:20,y:20,w:80,h:20},context:{...exactOptions('normal','apple-lisa').compositionContext,basis:'caller-declared'},appliedUnknownPatternOffset:true,originalPortState:'unverified'},recordedSourcePins:structuredClone(pins),patternAsset:null});
  r.source.cicnResourceIndex=pins.face.resourceIndex;r.source.cinfResourceIndex=pins.cinf.resourceIndex;
  r.resources=['face','cinf'].map(k=>({resourceIndex:pins[k].resourceIndex,signedId:pins[k].signedId,sha256:pins[k].payloadSha256,status:'decoded',type:k==='face'?'cicn':'cinf'}));
  r.bodyFillSteps=[{role:'body-fill',usage:'paint',action:'missing',owner:r.paintSelectionSteps[0].owner,requestedResourceType:'ppat',requestedId:0,bodyMode:0,reason:'same-face-owner-pattern-unavailable'}];return r;
 };
 validateRecordedExecution(make(),binding,capture);
 for(const [change,re]of [[r=>r.profile=PROFILE.id,/profile/],[r=>r.composition.context.portOrigin=[1,0],/pinned port context/],
  [r=>r.resources[0].sha256='bad',/pinned face\/cinf/],[r=>r.bodyFillSteps=[],/no-ppat0/],
  [r=>r.resources.push({type:'ppat',signedId:0,status:'decoded'}),/no-ppat0/]]){
  const row=make();change(row);assert.throws(()=>validateRecordedExecution(row,binding,capture),re);
 }
});

test('recorded state joins require their own face/cinf/body/pattern pins and completed paint',()=>{
 const statePins=JSON.parse(readFileSync(new URL('../decoder-fixtures/recorded-state-source-pins.json',import.meta.url)));
 for(const slug of ['crayon-os','apple-lisa','animals','beos-r503'])for(const state of ['animals','beos-r503'].includes(slug)?['normal','pressed','inactive']:['pressed','inactive']){
  // Synthetic trace structure isolates verifier failures; original PNGs remain the browser oracle.
  const capture=structuredClone(captures.find(c=>c.requestId===slug+'.normal'));
  capture.conditions.state=state;capture.requestId=slug+'.'+state;
  const binding=captureBinding(capture),pins=statePins[slug][state];
  const make=()=>{
   const r=execution().row,options=exactOptions(state,slug),owner=r.paintSelectionSteps[0].owner;
   Object.assign(r,{slug,state,options,requested:{state:state==='normal'?'active':state,pressed:options.pressed,disabled:options.disabled,default:false},profile:binding.profile.id,policy:binding.profile.id,
    profileInput:capture.source.archiveSha256,profileFork:capture.source.forkSha256,originalComparison:{binding,differentPixels:0,comparedPixels:1600},
    selectedKey:pins.emittedKey,selectedCinfId:pins.cinf.signedId,selectedBodyRequest:structuredClone(pins.bodyRequest),recordedSourcePins:structuredClone(pins),
    composition:{faceRect:{x:20,y:20,w:80,h:20},context:{...options.compositionContext,basis:'caller-declared'},appliedUnknownPatternOffset:true,originalPortState:'unverified'},patternAsset:pins.pattern?'unit:pattern':null});
   Object.assign(r.source,{manifestKey:pins.emittedKey,cicnResourceIndex:pins.face.resourceIndex,cinfResourceIndex:pins.cinf.resourceIndex});
   Object.assign(r.paintSelectionSteps[0].resource,{signedId:pins.face.signedId,manifestKey:pins.emittedKey,sourceCinfId:pins.cinf.signedId});
   r.resources=['face','cinf',...(pins.pattern?['pattern']:[])].map(k=>({resourceIndex:pins[k].resourceIndex,signedId:pins[k].signedId,sha256:pins[k].payloadSha256,byteLength:pins[k].bytes,status:'decoded',type:k==='face'?'cicn':k==='pattern'?'ppat':'cinf'}));
   if(pins.pattern)r.paintSelectionSteps.push({role:'body-fill',usage:'paint',action:'selected',owner,resource:{type:'ppat',signedId:pins.pattern.signedId,manifestKey:'unit-pattern',assetUrl:r.patternAsset,byteProvenance:{loadId:r.loadId,manifestKey:'unit-pattern',ppatResourceIndex:pins.pattern.resourceIndex}}});
   else r.bodyFillSteps=[{role:'body-fill',usage:'paint',action:'missing',owner,requestedResourceType:'ppat',requestedId:0,bodyMode:0,reason:'same-face-owner-pattern-unavailable'}];
   return r;
  };
  validateRecordedExecution(make(),binding,capture);
  for(const [mutate,reason]of [
   [r=>r.state=state==='normal'?'pressed':'normal',/execution case/],
   [r=>r.selectedKey='wrong-state-key',/face identity/],
   [r=>r.selectedBodyRequest.resourceId=999,/body request/],
   [r=>r.resources[0].sha256='wrong-face',/payload/],
   [r=>r.resources[1].sha256='wrong-cinf',/payload/],
   [r=>r.resources[1].byteLength=1,/lengths/],
   [r=>r.bandPaints=[],/paint dependency/],
  ]){const r=make();mutate(r);assert.throws(()=>validateRecordedExecution(r,binding,capture),reason);}
  if(pins.pattern){const r=make();r.paintSelectionSteps[1].resource.signedId=pins.pattern.signedId===17?-10238:17;assert.throws(()=>validateRecordedExecution(r,binding,capture),/pattern owner\/payload/);}
  else {const r=make();r.resources.push({type:'ppat',signedId:0});assert.throws(()=>validateRecordedExecution(r,binding,capture),/no-ppat0/);
   const selected=make();selected.paintSelectionSteps.push({role:'body-fill',usage:'paint',action:'selected',resource:{type:'ppat',signedId:128}});assert.throws(()=>validateRecordedExecution(selected,binding,capture),/no-ppat0/);
  }
 }
});


test('completed paint follows paired metadata and rejects fabricated legacy dependencies',()=>{
 const make=()=>{const r=execution().row; r.resources=r.resources.filter(x=>x.type!=='cinf');
  r.facePlane.rgba=Buffer.alloc(6400,255).toString('base64');
  r.legacyFacePaint={...r.bandPaints[0],basis:'compatibility-policy',operation:'legacy-nine-slice-and-sample-fill',destinationRect:{x:0,y:0,w:80,h:20},retainedNonzeroAlphaPixels:1600};return r;};
 const good=make();validateCompletedFacePaint(good,good.paintSelectionSteps[0],false);
 for(const change of [r=>delete r.legacyFacePaint,r=>r.legacyFacePaint.owner={baseUrl:'foreign'},r=>r.legacyFacePaint.operation='selected-only',r=>r.legacyFacePaint.retainedNonzeroAlphaPixels=1599,r=>r.facePlane.rgba='',r=>r.resources.push({type:'cinf',signedId:-10239})]){
  const r=make();change(r);assert.throws(()=>validateCompletedFacePaint(r,r.paintSelectionSteps[0],false));
 }
 const paired=make();paired.bandPaints=[];assert.throws(()=>validateCompletedFacePaint(paired,paired.paintSelectionSteps[0],true),/paint dependency/);
});

test('explicit recorded registry rejects unknown subjects and preserves nullable metadata paint contracts',async()=>{
 const {RECORDED_CASES,STATE_SOURCE_PINS,profileFor,caseId}=await import('./recorded-face.mjs');
 assert.equal(profileFor('unregistered'),undefined);
 const added=Object.entries(RECORDED_CASES).filter(([,v])=>['shared307','e1971'].includes(v.caseSuffix));
 assert.equal(added.length,7);
 for(const [slug,entry] of added)for(const state of entry.states){
  const pins=STATE_SOURCE_PINS[slug][state];
  const capture=structuredClone(captures.find(c=>c.requestId==='beos-r503.normal'));
  capture.source.slug=slug;capture.source.archiveSha256=pins.sourceArchiveSha256;capture.source.forkSha256=pins.sourceForkSha256;capture.conditions.state=state;
  const binding=captureBinding(capture);
  const make=()=>{
   const r=execution().row,options=exactOptions(state,slug);
   Object.assign(r,{slug,state,options,completionCount:1,profile:profileFor(slug,state).id,policy:profileFor(slug,state).id,
    requested:{state:state==='normal'?'active':state,pressed:options.pressed,disabled:options.disabled,default:false},
    profileInput:pins.sourceArchiveSha256,profileFork:pins.sourceForkSha256,selectedKey:pins.emittedKey,
    selectedCinfId:pins.cinf?.signedId??null,selectedBodyRequest:structuredClone(pins.bodyRequest),recordedSourcePins:structuredClone(pins),
    patternAsset:null,bodyFillSteps:[],originalComparison:{binding,differentPixels:0,comparedPixels:1600},
    composition:{faceRect:{x:20,y:20,w:80,h:20},context:{...options.compositionContext,basis:'caller-declared'},appliedUnknownPatternOffset:true,originalPortState:'unverified'}});
   Object.assign(r.source,{manifestKey:pins.emittedKey,cicnResourceIndex:pins.face.resourceIndex,cinfResourceIndex:pins.cinf?.resourceIndex??null});
   Object.assign(r.paintSelectionSteps[0].resource,{signedId:pins.face.signedId,manifestKey:pins.emittedKey,sourceCinfId:pins.cinf?.signedId??null});
   r.resources=['face',...(pins.cinf?['cinf']:[])].map(k=>({resourceIndex:pins[k].resourceIndex,signedId:pins[k].signedId,sha256:pins[k].payloadSha256,byteLength:pins[k].bytes,status:'decoded',type:k==='face'?'cicn':'cinf'}));
   r.facePlane.rgba=Buffer.alloc(6400,255).toString('base64');
   if(pins.completedFaceRegions)r.bandPaints=pins.completedFaceRegions.map(region=>({...r.bandPaints[0],region}));
   if(pins.cinf)r.bodyFillSteps=[{role:'body-fill',usage:'paint',action:'missing',owner:r.paintSelectionSteps[0].owner,requestedResourceType:'ppat',requestedId:0,bodyMode:0,reason:'same-face-owner-pattern-unavailable'}];
   else{r.legacyFacePaint={...r.bandPaints[0],basis:'compatibility-policy',operation:'legacy-nine-slice-and-sample-fill',sourceRect:{x:0,y:0,w:pins.sourceSize[0],h:pins.sourceSize[1]},destinationRect:{x:0,y:0,w:80,h:20},effectiveFaceClip:{x:0,y:0,w:80,h:20},controlOrigin:[20,20],declaredClip:options.compositionContext.clip,coordinateSpace:'face-local-before-ring',rasterAlpha:'copy-source-rgba',retainedNonzeroAlphaPixels:1600};r.bandPaints=[];}
   return r;
  };
  assert.match(caseId(slug,state),/(shared307|e1971)-profile$/);validateRecordedExecution(make(),binding,capture);
  const mutations=[r=>r.completionCount=0,r=>r.completionCount=2,r=>r.profile='other',r=>r.resources[0].sha256='wrong',r=>r.resources[0].resourceIndex++,r=>r.resources[0].byteLength++,r=>r.selectedBodyRequest={mode:0,resourceId:128},r=>r.recordedSourcePins.paintKind='invented',r=>r.composition.context.controlOrigin=[0,0]];
  if(pins.cinf)mutations.push(r=>r.bandPaints=[],r=>r.bodyFillSteps=[],r=>r.resources.push({type:'ppat',signedId:0}),r=>r.bodyFillSteps[0].usage='inspect');
  else mutations.push(r=>delete r.legacyFacePaint,r=>r.legacyFacePaint.sourceRect.w++,r=>r.legacyFacePaint.effectiveFaceClip.w=79,r=>r.legacyFacePaint.retainedNonzeroAlphaPixels--,r=>r.bandPaints=[r.legacyFacePaint],r=>r.bodyFillSteps=[{action:'missing'}],r=>r.resources.push({type:'cinf',signedId:pins.face.signedId}),r=>r.paintSelectionSteps.push({role:'body-fill',usage:'paint',action:'selected',resource:{type:'ppat',signedId:128}}));
  for(const mutate of mutations){const row=make();mutate(row);assert.throws(()=>validateRecordedExecution(row,binding,capture),undefined,slug+'/'+state);}
 }
});

test('completed recorded pattern requires catalog/load/URL, exact plane and actual union writes', async()=>{
 const {validateRecordedPatternPaint,STATE_SOURCE_PINS}=await import('./recorded-face.mjs');
 const pins=structuredClone(STATE_SOURCE_PINS['monkey-paradise'].normal),raw=Buffer.alloc(32*16*4,255);
 const {createHash}=await import('node:crypto');pins.completedPattern.decodedRgbaSha256=createHash('sha256').update(raw).digest('hex');
 const make=()=>{
  const reference={loadId:'unit',manifestKey:'pattern',ppatResourceIndex:459},entry={asset:'unit:pattern',sourcePpatId:128,byteProvenance:reference};
  const resources=[{resourceIndex:459,type:'ppat',status:'decoded',signedId:128,byteLength:454,sha256:pins.pattern.payloadSha256}];
  const row={profileBaseUrl:'unit:owner',loadId:'unit',resources,patternAsset:entry.asset,patternCatalog:{manifestKey:'pattern',entry},patternPlane:{size:[32,16],rgba:raw.toString('base64')},patternLoad:{version:1,loadId:'unit',scope:{resourceTypes:['ppat'],evidence:'decoder-input-bytes'},input:{sha256:pins.sourceArchiveSha256},fork:{sha256:pins.sourceForkSha256},resources}};
  const step={role:'body-fill',action:'selected',usage:'paint',requestedId:128,requestedResourceType:'ppat',bodyMode:2,owner:{baseUrl:'unit:owner',chainDepth:0},resource:{type:'ppat',signedId:128,manifestKey:'pattern',assetUrl:entry.asset,byteProvenance:reference},bodyPaint:{sourceAssetUrl:entry.asset,branch:'pattern-fill-union',coordinateSpace:'face-local-before-ring',unionRects:pins.completedPattern.unionRects,paintedPixels:1216,sourceSize:[32,16],context:{...exactOptions('normal','monkey-paradise').compositionContext,basis:'caller-declared'},phase:{basis:'modern-composition-policy',offset:[-80,0],originalPatternPhase:'unverified'}}};
  return {row:structuredClone(row),step:structuredClone(step)};
 };
 let x=make();validateRecordedPatternPaint(x.row,x.step,pins);
 for(const change of [x=>delete x.step.bodyPaint,x=>x.step.bodyPaint.paintedPixels=0,x=>x.step.bodyPaint.unionRects=[],x=>x.step.bodyPaint.phase.originalPatternPhase='verified',x=>x.row.patternCatalog.entry.asset='foreign',x=>x.row.patternLoad.loadId='foreign',x=>x.row.resources[0].sha256='bad',x=>x.row.patternPlane.rgba=Buffer.alloc(raw.length).toString('base64'),x=>x.step.bodyPaint.context.clip.rect.w=80]){
  x=make();change(x);assert.throws(()=>validateRecordedPatternPaint(x.row,x.step,pins),/pattern/);
 }
});


test('state profile selection keeps defaults and binds the same override to capture and execution inputs',()=>{
 // Existing bindings serve as distinct unit inputs, not new measured-theme claims.
 const registry={'windows-95':{...RECORDED_CASES['windows-95'],profilesByState:{pressed:CRAYON_PROFILE}}};
 const subject=recordedSubjects(registry)[0];
 assert.deepEqual(subject.cases.map(c=>c.profile.id),[PROFILE.id,CRAYON_PROFILE.id,PROFILE.id]);
 for(const item of subject.cases){
  const capture=captures.find(c=>c.requestId==='windows-95.'+item.state);
  assert.deepEqual(captureBinding(capture,registry).profile,item.profile);
  assert.deepEqual(item.options,exactOptions(item.state,'windows-95'));
 }
 assert.equal(profileFor('windows-95',undefined,registry),PROFILE);
 assert.equal(profileFor('unknown','pressed',registry),undefined);
 validateRecordedProfiles(fileURLToPath(new URL('../../',import.meta.url)),registry);
 const malformed=structuredClone(registry);malformed['windows-95'].profilesByState.pressed=null;
 assert.throws(()=>profileFor('windows-95','pressed',malformed),/invalid registered profile/);
 assert.throws(()=>recordedSubjects(malformed),/invalid registered profile/);
 assert.throws(()=>captureBinding(captures.find(c=>c.requestId==='windows-95.pressed'),malformed),/invalid registered profile/);
 const drift=structuredClone(registry);drift['windows-95'].profilesByState.pressed.sha256='0'.repeat(64);
 assert.throws(()=>validateRecordedProfiles(fileURLToPath(new URL('../../',import.meta.url)),drift),/profile DATA bytes changed/);
 const typo=structuredClone(registry);typo['windows-95'].profilesByState.presssed=typo['windows-95'].profilesByState.pressed;
 assert.throws(()=>validateRecordedProfiles(fileURLToPath(new URL('../../',import.meta.url)),typo),/outside registered states/);
 const badShape=structuredClone(registry);badShape['windows-95'].profilesByState=[];
 assert.throws(()=>validateRecordedProfiles(fileURLToPath(new URL('../../',import.meta.url)),badShape),/invalid state profile registry/);
});

test('state-profile support preserves every existing recorded binding including Evolution normal/inactive',()=>{
 const subjects=recordedSubjects();
 for(const capture of captures){
  const old=ledger.cases.find(c=>c.recordedComparison?.captureId===capture.id);
  assert.deepEqual(captureBinding(capture),old.recordedComparison,capture.id);
  assert.deepEqual(subjects.find(s=>s.slug===capture.source.slug).cases.find(c=>c.state===capture.conditions.state).profile,old.recordedComparison.profile);
 }
 const evolution=subjects.find(s=>s.slug==='evolution');
 assert.deepEqual(evolution.cases.map(c=>c.state),['normal','pressed','inactive']);
 for(const c of evolution.cases)assert.deepEqual(c.profile,c.state==='pressed'?RECORDED_CASES.evolution.profilesByState.pressed:RECORDED_CASES.evolution.profile);
 assert.notDeepEqual(RECORDED_CASES.evolution.profilesByState.pressed,RECORDED_CASES.evolution.profile);
});

// Literal regions follow pinned cinf geometry and independently checked source alpha:
// corner10/side10 at height20 leaves no vertical-side regions; corner6/side4 retains them.
test('finite completed-region pins reject omitted, repeated and invented nonempty bands',()=>{
 for(const regions of [[0,1,2,3,4,5],[0,1,2,3,4,5,6,7]]){
  const row=execution().row,selected=row.paintSelectionSteps[0];
  row.bandPaints=regions.map(region=>({...row.bandPaints[0],region}));
  validateCompletedFacePaint(row,selected,true,regions);
  for(const changed of [row.bandPaints.slice(1),[...row.bandPaints].reverse(),[...row.bandPaints,row.bandPaints[0]],[...row.bandPaints.slice(0,-1),{...row.bandPaints[0],region:99}]]){
   assert.throws(()=>validateCompletedFacePaint({...row,bandPaints:changed},selected,true,regions),/completed regions/);
  }
 }
});
