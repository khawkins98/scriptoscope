import {readRecordedContext,captureBinding,validateRecordedExecution,validateRecordedBinding,compareRecordedPixels} from '../rendering-requirements/recorded-face.mjs';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {literalCicn,faceInfo} from '../decoder-fixtures/mode5.mjs';
import {test,expect,openHarness,attachObservations} from './fixtures.mjs';
for(const mode of ['source','built']) {
 test(`${mode}: measured profile loads both real themes without asset overrides and isolates default pixels`,async({page,servers},info)=>{
  info.annotations.push({type:'fidelity-assertion',description:'recorded.empty-face-six'});
  info.annotations.push({type:'fidelity-assertion',description:'recorded.crayon-normal'});
  const referenceContext=readRecordedContext(fileURLToPath(new URL('../../',import.meta.url)));
  const bindings=referenceContext.captures.map(c=>captureBinding(c));
  const ledger=JSON.parse(readFileSync(new URL('../rendering-requirements/ledger.json',import.meta.url)));
  for(const binding of bindings)validateRecordedBinding(ledger.cases.find(c=>c.recordedComparison?.captureId===binding.captureId),binding,referenceContext);
  await openHarness(page,servers,mode);
  const result=await page.evaluate(async ({mode,bindings})=>{
   const api=await import(mode==='built'?'/dist/scriptoscope.js':'/src/index.ts');
   const data=await(await fetch('/tests/decoder-fixtures/measured-display-profile.json')).json(),profile=await api.prepareDisplayProfile(data),rows=[];
   // Eligibility/digests are checked by the reference gate; these independent
   // original PNG bytes supply the pixel oracle for the existing render.
   const {captures}=await(await fetch('/tests/reference-captures/captures.json')).json();
   for(const slug of ['windows-95','system7-nostalgia-silver','crayon-os']){
    const selectedProfile=slug==='crayon-os'?await api.prepareDisplayProfile(await(await fetch('/tests/decoder-fixtures/measured-display-profile-crayon.json')).json()):profile;
    const recordedSourcePins=slug==='crayon-os'?await(await fetch('/tests/decoder-fixtures/crayon-recorded-source-pins.json')).json():null;
    const a=await api.loadTheme('/themes/'+slug,{provenance:true}),b=await api.loadTheme('/themes/'+slug,{provenance:true,displayProfile:selectedProfile});
    for(const state of (slug==='crayon-os'?['normal']:['normal','pressed','inactive'])){
    let trace;const options={label:'',minWidth:80,height:20,default:false,pressed:state==='pressed',disabled:state==='inactive',...(slug==='crayon-os'?{compositionContext:{controlOrigin:[20,20],portOrigin:[0,0],patternOrigin:{status:'unknown'},clip:{kind:'rect',rect:{x:0,y:0,w:160,h:80}}}}:{})};
    const normal=await api.composeButton(b,{...options,diagnostics:{onComplete:t=>trace=t}}),legacy=await api.composeButton(a,options);
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
    rows.push({slug,state,options,composition:trace.composition,recordedSourcePins,patternAsset:patternStep?b.manifest.patterns[patternStep.resource.manifestKey]?.asset:null,loadId:b.byteProvenance.loadId,profileFork:b.byteProvenance.fork.sha256,selectedKey:selected.resource.manifestKey,selectedAsset:el.asset,selectedCinfId:el.sourceCinfId??null,outcome:trace.outcome,requested:trace.requested,profile:b.manifest.displayProfile.id,baseUrl:a.baseUrl,profileBaseUrl:b.baseUrl,input:a.byteProvenance.input.sha256,profileInput:b.byteProvenance.input.sha256,
     originalComparison:{binding:bindings.find(b=>b.captureId===reference.id),comparedPixels:1600,originalRgba:btoa(String.fromCharCode(...original)),captureId:reference.id,requestDigest:reference.requestDigest,imageSha256,imageSize:[canvas.width,canvas.height],sourceArchiveSha256:reference.source.archiveSha256,
      layer:'composited-face-pixels',background:[255,255,255],differentPixels,verifiedRequirementIds:[]},
     source:el.byteProvenance,resources:b.byteProvenance.resources,selected,facePlane:{rect:[4,4,80,20],encoding:'base64-rgba8',rgba:btoa(String.fromCharCode(...faceRgba))},paintSelectionSteps:trace.steps.filter(s=>s.usage==='paint'&&s.action==='selected'),bandPaints:trace.bandPaints??[],legacyFacePaint:trace.legacyFacePaint??null,policy:el.colorSamples?.displayPolicy??el.samplingEquivalence?.displayPolicy,
     different:normal.data.some((v,i)=>v!==legacy.data[i]),size:[normal.width,normal.height],body:[...normal.getPixel(44,14)],
     urlsDistinct:Object.keys(a.manifest.chromeElements).every(k=>a.manifest.chromeElements[k].asset!==b.manifest.chromeElements[k].asset)});
    }
    a.dispose();b.dispose();
   }return rows;
  },{mode,bindings});
  for(const row of result){
   const capture=referenceContext.captures.find(c=>c.id===row.originalComparison.captureId);
   validateRecordedExecution(row,captureBinding(capture),capture);
   expect(compareRecordedPixels(Buffer.from(row.facePlane.rgba,'base64'),Buffer.from(row.originalComparison.originalRgba,'base64'))).toBe(0);
  }
  for(const row of result){expect(row.profileInput).toBe(row.input);expect(row.profileBaseUrl).toBe(row.baseUrl);expect(row.urlsDistinct).toBe(true);if(row.state==='normal')expect(row.different).toBe(true);expect(row.policy).toBe(row.profile);expect(row.selected.resource.byteProvenance).toBeTruthy();
   expect(row.requested).toMatchObject({state:row.state==='normal'?'active':row.state,pressed:row.state==='pressed',disabled:row.state==='inactive',default:false});
   expect(row.originalComparison.imageSize).toEqual([160,80]);expect(row.originalComparison.sourceArchiveSha256).toBe(row.profileInput);expect(row.originalComparison.differentPixels).toBe(0);
   if(row.slug==='system7-nostalgia-silver')expect(row.legacyFacePaint.resource.byteProvenance).toEqual(row.selected.resource.byteProvenance);
   else expect(row.bandPaints.some(p=>p.role==='face')).toBe(true);
  }
  expect(result).toHaveLength(7);
  expect(result[0].body).toEqual([218,218,218,255]);
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
