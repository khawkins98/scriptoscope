import {literalCicn,faceInfo} from '../decoder-fixtures/mode5.mjs';
import {test,expect,openHarness,attachObservations} from './fixtures.mjs';
for(const mode of ['source','built']) {
 test(`${mode}: measured profile loads both real themes without asset overrides and isolates default pixels`,async({page,servers},info)=>{
  await openHarness(page,servers,mode);
  const result=await page.evaluate(async mode=>{
   const api=await import(mode==='built'?'/dist/scriptoscope.js':'/src/index.ts');
   const data=await(await fetch('/tests/decoder-fixtures/measured-display-profile.json')).json(),profile=await api.prepareDisplayProfile(data),rows=[];
   for(const slug of ['windows-95','system7-nostalgia-silver']){
    const a=await api.loadTheme('/themes/'+slug,{provenance:true}),b=await api.loadTheme('/themes/'+slug,{provenance:true,displayProfile:profile});
    let trace;const options={label:'',minWidth:80,height:20,default:false};
    const normal=await api.composeButton(b,{...options,diagnostics:{onComplete:t=>trace=t}}),legacy=await api.composeButton(a,options);
    const selected=trace.steps.find(s=>s.role==='face'&&s.action==='selected'),el=b.manifest.chromeElements[selected.resource.manifestKey];
    const faceRgba=Uint8Array.from(Array.from({length:20},(_,y)=>Array.from({length:80},(_,x)=>normal.getPixel(x+4,y+4))).flat(2));
    rows.push({slug,profile:b.manifest.displayProfile.id,baseUrl:a.baseUrl,profileBaseUrl:b.baseUrl,input:a.byteProvenance.input.sha256,profileInput:b.byteProvenance.input.sha256,
     source:el.byteProvenance,resources:b.byteProvenance.resources,selected,facePlane:{rect:[4,4,80,20],encoding:'base64-rgba8',rgba:btoa(String.fromCharCode(...faceRgba))},paintDependencies:trace.steps.filter(s=>s.usage==='paint'&&s.action==='selected'),policy:el.colorSamples?.displayPolicy??el.samplingEquivalence?.displayPolicy,
     different:normal.data.some((v,i)=>v!==legacy.data[i]),size:[normal.width,normal.height],body:[...normal.getPixel(44,14)],
     urlsDistinct:Object.keys(a.manifest.chromeElements).every(k=>a.manifest.chromeElements[k].asset!==b.manifest.chromeElements[k].asset)});
    a.dispose();b.dispose();
   }return rows;
  },mode);
  for(const row of result){expect(row.profileInput).toBe(row.input);expect(row.profileBaseUrl).toBe(row.baseUrl);expect(row.urlsDistinct).toBe(true);expect(row.different).toBe(true);expect(row.policy).toBe(row.profile);expect(row.selected.resource.byteProvenance).toBeTruthy();}
  expect(result[0].body).toEqual([218,218,218,255]);
  await attachObservations(info,'display-profile',mode,{mode,rows:result,claim:'Actual shared loader observations; original reference comparison is separate evidence.'});
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
