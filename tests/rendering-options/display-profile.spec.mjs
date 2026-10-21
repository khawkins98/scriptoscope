import {RECORDED_CASES,recordedSubjects,readRecordedContext,captureBinding,validateRecordedExecution,validateRecordedBinding,compareRecordedPixels} from '../rendering-requirements/recorded-face.mjs';
import {readFileSync} from 'node:fs';
import {readOriginal} from '../helpers/compact-json.mjs';
import {fileURLToPath} from 'node:url';
import {literalCicn,faceInfo} from '../decoder-fixtures/mode5.mjs';
import {test,expect,openHarness,attachObservations} from './fixtures.mjs';
for(const mode of ['source','built']) {
 test(`${mode}: finite BeOS direct profile loads the whole archive and prepares exact ppat128 pixels`,async({page,servers},info)=>{
  await openHarness(page,servers,mode);
  const row=await page.evaluate(async mode=>{
   const api=await import(mode==='built'?'/dist/scriptoscope.js':'/src/index.ts');
   const data=await(await fetch('/tests/decoder-fixtures/measured-display-profile-beos.json')).json();
   const profile=await api.prepareDisplayProfile(data),theme=await api.loadTheme('/themes/beos-r503',{displayProfile:profile,provenance:true});
   try {
    const matches=Object.entries(theme.manifest.patterns).filter(([,p])=>p.sourcePpatId===128);
    if(matches.length!==1)throw Error('Missing unique ppat128');
    const [key,pattern]=matches[0],image=await createImageBitmap(await(await fetch(pattern.asset)).blob());
    const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
    const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0);image.close();
    const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;
    // Independent serialized source: each of eight512px rows is35 aa,1 bb,476 dd,
    // followed by16 padding bytes. Native context0 evidence gives192/205/231.
    let differentPixels=0;
    for(let y=0;y<8;y++)for(let x=0;x<512;x++){
     const v=x<35?192:x===35?205:231,o=(y*512+x)*4;
     if(pixels[o]!==v||pixels[o+1]!==v||pixels[o+2]!==v||pixels[o+3]!==255)differentPixels++;
    }
    let trace;await api.composeButton(theme,{label:'',minWidth:80,height:20,default:false,diagnostics:{onComplete:t=>trace=t}});
    const face=trace.steps.find(s=>s.role==='face'&&s.usage==='paint'&&s.action==='selected');
    const incomplete=structuredClone(data);incomplete.directRgb8.mappings=incomplete.directRgb8.mappings.filter(r=>r.rgb8[0]!==170);
    let allocated=0,missingCode;
    try{await api.loadKaleidoscopeScheme(new Uint8Array(await(await fetch('/themes/beos-r503/scheme.sit')).arrayBuffer()),{displayProfile:await api.prepareDisplayProfile(incomplete),assetUrlFactory:()=>{allocated++;return'never';}});}catch(e){missingCode=e.code;}
    return {mode,profileId:profile.id,manifestProfileId:theme.manifest.displayProfile.id,baseUrl:theme.baseUrl,
     load:theme.byteProvenance,pattern:{key,...pattern},size:[canvas.width,canvas.height],differentPixels,
     pixelRgba:btoa(String.fromCharCode(...pixels)),sourceLayout:{width:512,height:8,rowBytes:2064,pmVersion:1},
     normalFace:face,normalElement:theme.manifest.chromeElements[face.resource.manifestKey],bandPaints:trace.bandPaints??[],
     bodyFillSteps:trace.steps.filter(s=>s.role==='body-fill'),missingCode,allocated};
   }finally{theme.dispose();}
  },mode);
  await attachObservations(info,'display-profile-beos-direct',mode,row);
  expect(row.profileId).toBe('display-profile:913a5b3ad1d6501ad9059a4cad783c88c930a9647f32b0989993f4af7f2ee538');
  expect(row.manifestProfileId).toBe(row.profileId);
  expect(row.load.input.sha256).toBe('04b315396840c5f6e53555381d51ab86087169d5687640261d92c3f85510c0c0');
  expect(row.load.fork.sha256).toBe('f8d70eb86bdda078c07ba509a0e069f525700b7af1a2c7b022265c65decf2bac');
  expect(row.pattern.byteProvenance).toMatchObject({loadId:row.load.loadId,manifestKey:row.pattern.key,ppatResourceIndex:1183});
  expect(row.load.resources.filter(r=>r.resourceIndex===1183)).toEqual([expect.objectContaining({type:'ppat',signedId:128,status:'decoded',byteLength:16590,sha256:'0f18915ca70d1bce2a314669cbe84121922508639ede1ce7733791a506230bf2'})]);
  expect(row.pattern.asset).toMatch(/^blob:/);expect(row.size).toEqual([512,8]);expect(row.differentPixels).toBe(0);
  expect(row.normalFace.resource.signedId).toBe(-10239);expect(row.normalFace.owner).toMatchObject({baseUrl:row.baseUrl,chainDepth:0});
  expect(row.normalElement.bodyRequest).toEqual({mode:0,resourceId:0});expect(row.normalElement.colorSamples.displayPolicy).toBe(row.profileId);
  expect(row.normalFace.resource.byteProvenance).toMatchObject({loadId:row.load.loadId,cicnResourceIndex:190,cinfResourceIndex:394});
  expect(row.bandPaints.some(p=>p.role==='face')).toBe(true);
  expect(row.bodyFillSteps.some(s=>s.action==='selected'&&s.resource?.signedId===128)).toBe(false);
  expect(row.missingCode).toBe('MISSING_MAPPING');expect(row.allocated).toBe(0);
 });
 test(`${mode}: measured profile loads real themes without asset overrides and isolates default pixels`,async({page,servers},info)=>{
  info.annotations.push({type:'fidelity-assertion',description:'recorded.empty-face-six'});
  info.annotations.push({type:'fidelity-assertion',description:'recorded.crayon-normal'});
  info.annotations.push({type:'fidelity-assertion',description:'recorded.lisa-normal'});
  info.annotations.push({type:'fidelity-assertion',description:'recorded.crayon-lisa-four-state'});
  info.annotations.push({type:'fidelity-assertion',description:'recorded.animals-three-state'});
  info.annotations.push({type:'fidelity-assertion',description:'recorded.beos-three-state'});
  info.annotations.push({type:'fidelity-assertion',description:'recorded.shared307-eighteen'});
  info.annotations.push({type:'fidelity-assertion',description:'recorded.evolution-empty-two'});
  info.annotations.push({type:'fidelity-assertion',description:'recorded.monkey-three-state'});
  info.annotations.push({type:'fidelity-assertion',description:'recorded.floppies-evolution-four-state'});
  info.annotations.push({type:'fidelity-assertion',description:'recorded.nine-state-j1223'});
  const referenceContext=readRecordedContext(fileURLToPath(new URL('../../',import.meta.url)));
  const bindings=referenceContext.captures.map(c=>captureBinding(c));
  const ledger=JSON.parse(readFileSync(new URL('../rendering-requirements/ledger.json',import.meta.url)));
  for(const binding of bindings)validateRecordedBinding(ledger.cases.find(c=>c.recordedComparison?.captureId===binding.captureId),binding,referenceContext);
  await openHarness(page,servers,mode);
  const subjects=recordedSubjects();
  // Browser preparation receives the bound original DATA bytes recovered from compact storage.
  const transferBytes=Object.fromEntries(subjects.flatMap(s=>s.cases).filter(c=>c.cicnTransfer).map(c=>[c.cicnTransfer.path,readOriginal(c.cicnTransfer.path).toString('base64')]));
  const result=await page.evaluate(async ({mode,bindings,subjects,transferBytes})=>{
   const api=await import(mode==='built'?'/dist/scriptoscope.js':'/src/index.ts');
   const {prepareRecordedTransfer,recordedLoadKey,retainRecordedTransfers}=await import('/tests/rendering-requirements/recorded-transfer.mjs');
   const rows=[];
   // Eligibility/digests are checked by the reference gate; these independent
   // original PNG bytes supply the pixel oracle for the existing render.
   const {captures}=await(await fetch('/tests/reference-captures/captures.json')).json();
   for(const subject of subjects){
    const {slug}=subject;
    // Opted-in preparation has no unprofiled comparison; strict mapped-default rejection is tested separately.
    const a=subject.cases.some(c=>c.cicnTransfer)?null:await api.loadTheme('/themes/'+slug,{provenance:true}),profileThemes=new Map();
    try {
    for(const {state,profile,cicnTransfer,options,sourcePins:recordedSourcePins} of subject.cases){
    const profileKey=recordedLoadKey(profile,cicnTransfer);
    let b=profileThemes.get(profileKey);
    if(!b){
     const selectedProfile=await api.prepareDisplayProfile(await(await fetch('/'+profile.path)).json());
     if(selectedProfile.id!==profile.id)throw Error('Wrong registered profile '+slug+'/'+state);
     const transfer=await prepareRecordedTransfer(cicnTransfer,api,async path=>Uint8Array.from(atob(transferBytes[path]),c=>c.charCodeAt(0)));
     b=await api.loadTheme('/themes/'+slug,{provenance:true,displayProfile:selectedProfile,...(transfer?{cicnTransfer:transfer}:{})});
     profileThemes.set(profileKey,b);
    }
    let trace,completionCount=0;
    const normal=await api.composeButton(b,{...options,diagnostics:{onComplete:t=>{completionCount++;trace=t;}}}),legacy=a?await api.composeButton(a,options):null;
    const selected=trace.steps.find(s=>s.role==='face'&&s.action==='selected'),el=b.manifest.chromeElements[selected.resource.manifestKey];
    const faceRgba=Uint8Array.from(Array.from({length:20},(_,y)=>Array.from({length:80},(_,x)=>normal.getPixel(x+4,y+4))).flat(2));
    const reference=captures.find(c=>c.requestId===slug+'.'+state);
    if(reference?.kind!=='independent-original'||reference.reviewScope?.id!=='public-api-empty-face')throw Error('Missing scoped original '+slug);
    const bytes=await(await fetch('/tests/reference-captures/'+reference.image.path)).arrayBuffer();
    const imageSha256=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');
    if(imageSha256!==reference.image.sha256)throw Error('Original image hash mismatch '+slug);
    const image=await createImageBitmap(new Blob([bytes],{type:'image/png'})),canvas=new OffscreenCanvas(image.width,image.height),ctx=canvas.getContext('2d');
    ctx.drawImage(image,0,0);image.close();const original=ctx.getImageData(20,20,80,20).data;
    let differentPixels=0;for(let i=0;i<faceRgba.length;i+=4){const alpha=faceRgba[i+3];
     if(original[i+3]!==255||[0,1,2].some(c=>Math.round((faceRgba[i+c]*alpha+255*(255-alpha))/255)!==original[i+c]))differentPixels++;
    }
    const patternStep=trace.steps.find(s=>s.role==='body-fill'&&s.action==='selected'&&s.resource?.type==='ppat');
    // Retain the actual catalog and decoded plane before any fallible trace assertions.
    let patternEvidence={};
    if(recordedSourcePins?.completedPattern && patternStep){
     const key=patternStep.resource.manifestKey,entry=b.manifest.patterns[key];
     if(entry){
      const im=await createImageBitmap(await(await fetch(entry.asset)).blob()),pc=new OffscreenCanvas(im.width,im.height),px=pc.getContext('2d');
      px.drawImage(im,0,0);im.close();const rgba=px.getImageData(0,0,pc.width,pc.height).data;
      patternEvidence={patternCatalog:{manifestKey:key,entry},patternLoad:b.byteProvenance,patternPlane:{size:[pc.width,pc.height],encoding:'base64-rgba8',rgba:btoa(String.fromCharCode(...rgba))}};
     }
    }
    rows.push({slug,state,options,completionCount,bodyFillSteps:trace.steps.filter(s=>s.role==='body-fill'),composition:trace.composition,recordedSourcePins,patternAsset:patternStep?b.manifest.patterns[patternStep.resource.manifestKey]?.asset:null,loadId:b.byteProvenance.loadId,profileFork:b.byteProvenance.fork.sha256,selectedKey:selected.resource.manifestKey,selectedAsset:el.asset,selectedCinfId:el.sourceCinfId??null,...(recordedSourcePins?{selectedBodyRequest:el.bodyRequest??null}:{}),outcome:trace.outcome,requested:trace.requested,profile:b.manifest.displayProfile.id,baseUrl:(a??b).baseUrl,profileBaseUrl:b.baseUrl,input:(a??b).byteProvenance.input.sha256,profileInput:b.byteProvenance.input.sha256,
     ...patternEvidence,...retainRecordedTransfers(b,cicnTransfer),...(el.cicnTransfer?{selectedCicnTransfer:el.cicnTransfer}:{}),
     originalComparison:{binding:bindings.find(b=>b.captureId===reference.id),comparedPixels:1600,originalRgba:btoa(String.fromCharCode(...original)),captureId:reference.id,requestDigest:reference.requestDigest,imageSha256,imageSize:[canvas.width,canvas.height],sourceArchiveSha256:reference.source.archiveSha256,
      layer:'composited-face-pixels',background:[255,255,255],differentPixels,verifiedRequirementIds:[]},
     source:el.byteProvenance,resources:b.byteProvenance.resources,selected,facePlane:{rect:[4,4,80,20],encoding:'base64-rgba8',rgba:btoa(String.fromCharCode(...faceRgba))},paintSelectionSteps:trace.steps.filter(s=>s.usage==='paint'&&s.action==='selected'),bandPaints:trace.bandPaints??[],legacyFacePaint:trace.legacyFacePaint??null,policy:el.colorSamples?.displayPolicy??el.samplingEquivalence?.displayPolicy,
     different:legacy?normal.data.some((v,i)=>v!==legacy.data[i]):null,size:[normal.width,normal.height],body:[...normal.getPixel(44,14)],
     urlsDistinct:a?Object.keys(a.manifest.chromeElements).every(k=>a.manifest.chromeElements[k].asset!==b.manifest.chromeElements[k].asset):null});
    }
    } finally { a?.dispose();for(const theme of profileThemes.values())theme.dispose(); }
   }return rows;
  },{mode,bindings,subjects,transferBytes});
  await info.attach('recorded-before-validation.json',{body:JSON.stringify(result,null,2),contentType:'application/json'});
  for(const row of result){
   const capture=referenceContext.captures.find(c=>c.id===row.originalComparison.captureId);
   validateRecordedExecution(row,captureBinding(capture),capture);
   expect(compareRecordedPixels(Buffer.from(row.facePlane.rgba,'base64'),Buffer.from(row.originalComparison.originalRgba,'base64'))).toBe(0);
  }
  for(const row of result){expect(row.profileInput).toBe(row.input);expect(row.profileBaseUrl).toBe(row.baseUrl);if(row.cicnTransfer){expect(row.urlsDistinct).toBeNull();expect(row.different).toBeNull();}else expect(row.urlsDistinct).toBe(true);if(!row.cicnTransfer&&row.state==='normal'&&RECORDED_CASES[row.slug].expectNormalDefaultDifference)expect(row.different).toBe(true);expect(row.policy).toBe(row.profile);expect(row.selected.resource.byteProvenance).toBeTruthy();
   expect(row.requested).toMatchObject({state:row.state==='normal'?'active':row.state,pressed:row.state==='pressed',disabled:row.state==='inactive',default:false});
   expect(row.originalComparison.imageSize).toEqual([160,80]);expect(row.originalComparison.sourceArchiveSha256).toBe(row.profileInput);expect(row.originalComparison.differentPixels).toBe(0);
   if(RECORDED_CASES[row.slug].paintKind==='legacy-face')expect(row.legacyFacePaint.resource.byteProvenance).toEqual(row.selected.resource.byteProvenance);
   else expect(row.bandPaints.some(p=>p.role==='face')).toBe(true);
  }
  expect(result).toHaveLength(subjects.reduce((n,s)=>n+s.cases.length,0));
  expect(result.find(row=>row.slug==='windows-95'&&row.state==='normal').body).toEqual([218,218,218,255]);
  await attachObservations(info,'display-profile',mode,{mode,rows:result,claim:'Exact recorded empty-face composited pixels under the explicit measured profile only; no mask, font, private-painter or whole-requirement verification.'});
 });
 test(`${mode}: joint profile reaches sampled bands and rejects missing maps before URL allocation`,async({page,servers})=>{
  await openHarness(page,servers,mode);const result=await page.evaluate(async mode=>{
   const api=await import(mode==='built'?'/dist/scriptoscope.js':'/src/index.ts');const {forkOf}=await import('/tests/resource-provenance/fixtures.mjs');const {sampledBandIcon,sampledBandInfo}=await import('/tests/decoder-fixtures/sampled-bands.mjs');const {syntheticDisplayProfile}=await import('/tests/decoder-fixtures/display-profile.mjs');
   const bytes=forkOf([{type:'cicn',id:-10239,data:sampledBandIcon()},{type:'cinf',id:-10239,data:sampledBandInfo(true)}]);
   const p=await api.prepareDisplayProfile(syntheticDisplayProfile()),loaded=await api.loadKaleidoscopeScheme(bytes,{displayProfile:p});let trace;
   const out=await api.composeButton(loaded,{label:'',minWidth:29,height:17,diagnostics:{onComplete:t=>trace=t}});
   const changed=syntheticDisplayProfile();changed.producer.channels[0][90]=91;const other=await api.prepareDisplayProfile(changed),second=await api.loadKaleidoscopeScheme(bytes,{displayProfile:other}),otherOut=await api.composeButton(second,{label:'',minWidth:29,height:17});
   let count=0,code;const incomplete=syntheticDisplayProfile();incomplete.mappings=incomplete.mappings.filter(r=>r.rgb16[0]!==0x2121);
   try{await api.loadKaleidoscopeScheme(bytes,{displayProfile:await api.prepareDisplayProfile(incomplete),assetUrlFactory:()=>{count++;return'bad';}});}catch(e){code=e.code;}
   let chain;try{await api.composeButton({...loaded,base:second},{label:''});}catch(e){chain=e.code;}
   const result={band:[...out.getPixel(4,0)],corner:[...out.getPixel(0,0)],other:[...otherOut.getPixel(4,0)],derivedPolicies:trace.bandPaints.filter(x=>x.derived).map(x=>x.derived.displayPolicy),profile:p.id,count,code,chain};loaded.dispose();second.dispose();return result;
  },mode);
  expect(result.band).toEqual([90,100,110,255]);expect(result.corner).toEqual([20,30,40,255]);expect(result.other).toEqual([91,100,110,255]);expect(result.derivedPolicies.length).toBeGreaterThan(0);expect(result.derivedPolicies.every(x=>x===result.profile)).toBe(true);expect(result.count).toBe(0);expect(result.code).toBe('MISSING_MAPPING');expect(result.chain).toBe('PROFILE_MISMATCH');
 });
 test(`${mode}: profile mode5 keeps hidden body RGB realized once through public paint`,async({page,servers})=>{
  await openHarness(page,servers,mode);
  const records=[{type:'cicn',id:-10239,data:literalCicn({rows:Array(7).fill('BBBBBBB'),maskRows:Array(7).fill('0000000'),depth:8,palette:['B']})},
   {type:'cinf',id:-10239,data:faceInfo(51)},
   {type:'cicn',id:51,data:literalCicn({rows:['R'.repeat(20),'B'.repeat(20)],maskRows:['0'.repeat(20),'0'.repeat(20)],depth:8,palette:['R','B']})}];
  const result=await page.evaluate(async({mode,records})=>{
   const api=await import(mode==='built'?'/dist/scriptoscope.js':'/src/index.ts'),{forkOf}=await import('/tests/resource-provenance/fixtures.mjs'),{syntheticDisplayProfile}=await import('/tests/decoder-fixtures/display-profile.mjs');
   const data=syntheticDisplayProfile();data.producer.channels[0][20]=21;data.producer.channels[0][21]=99;
   const profile=await api.prepareDisplayProfile(data),theme=await api.loadKaleidoscopeScheme(forkOf(records.map(r=>({...r,data:Uint8Array.from(r.data)}))),{displayProfile:profile});let trace;
   try{const out=await api.composeButton(theme,{label:'',minWidth:24,height:6,diagnostics:{onComplete:t=>trace=t}}),face=Object.values(theme.manifest.chromeElements).find(e=>e.sourceCicnId===-10239);
    return{rgba:[...out.data],policy:face.cicnBody.displayPolicy,profile:profile.id,paint:trace.steps.find(s=>s.bodyPaint)?.bodyPaint};
   }finally{theme.dispose();}
  },{mode,records:records.map(r=>({...r,data:[...r.data]}))});
  const expected=Array.from({length:24*6},(_,i)=>{const x=i%24,y=Math.floor(i/24);return x>=2&&x<22&&y===2?[21,30,40,255]:x>=2&&x<22&&y===3?[7,9,11,255]:[0,0,0,0];}).flat();
  expect(result.rgba).toEqual(expected);expect(result.policy).toBe(result.profile);expect(result.paint.branch).toBe('unmasked-copy');expect(result.paint.paintedPixels).toBe(40);
 });
 test(`${mode}: declarative resolver snapshots profile and rejects incompatible borrowed themes`,async({page,servers})=>{
  await openHarness(page,servers,mode);const result=await page.evaluate(async mode=>{
   const api=await import(mode==='built'?'/dist/scriptoscope.js':'/src/index.ts');const profile=await api.prepareDisplayProfile(await(await fetch('/tests/decoder-fixtures/measured-display-profile.json')).json());
   const root=document.createElement('section');document.body.append(root);root.innerHTML='<div data-scriptoscope-window data-scriptoscope-title="Profile" style="width:320px"><button data-scriptoscope-button>OK</button><label>Value<input type="range" value="37"></label></div>';
   const opts={root,themeBaseUrl:'/themes',pageThemeDefault:'windows-95',displayProfile:profile,bootAffordance:'none',syncToUrlParam:false};
   const pending=api.mountDeclarative(opts);delete opts.displayProfile;const handle=await pending;
   const original=root.querySelector('input'),legacy=await api.loadTheme('/themes/windows-95');let mismatch;try{handle.registerTheme('wrong',legacy);}catch(e){mismatch=e.code;}
   await handle.retheme('system7-nostalgia-silver');const stats={...handle.stats},same=original===root.querySelector('input'),value=original.value;
   handle.disconnect();legacy.dispose();const restored=root.querySelector('button').style.display;root.remove();return{mismatch,stats,same,value,restored};
  },mode);
  expect(result.mismatch).toBe('PROFILE_MISMATCH');expect(result.stats.windows).toBe(1);expect(result.stats.buttons).toBe(1);expect(result.same).toBe(true);expect(result.value).toBe('37');expect(result.restored).toBe('');
 });
}
