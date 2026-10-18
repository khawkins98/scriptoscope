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
    rows.push({slug,profile:b.manifest.displayProfile.id,baseUrl:a.baseUrl,profileBaseUrl:b.baseUrl,input:a.byteProvenance.input.sha256,profileInput:b.byteProvenance.input.sha256,
     source:el.byteProvenance,resources:b.byteProvenance.resources,selected,policy:el.colorSamples?.displayPolicy??el.samplingEquivalence?.displayPolicy,
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
