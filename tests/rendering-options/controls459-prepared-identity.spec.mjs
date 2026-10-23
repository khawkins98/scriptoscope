// Exact public CinfLookupView projection and actual art admission owner; native
// provider/device/glyph equivalence remains UNKNOWN. Real owned raw-fork inputs.
import {test,expect,openHarness,attachObservations} from './fixtures.mjs';
for(const mode of ['source','built'])test(`${mode}: prepared cinf admission binds actual art owner and exact lookup-only identity`,async({page,servers},info)=>{
 await openHarness(page,servers,mode);
 const observed=await page.evaluate(async mode=>{const api=await import(mode==='built'?'/dist/scriptoscope.js':'/src/index.ts');const {forkOf}=await import('/tests/resource-provenance/fixtures.mjs');const {solidBackgroundIcon,solidBackgroundInfo}=await import('/tests/decoder-fixtures/solid-background.mjs');
  const metadata=solidBackgroundInfo(),foreign=forkOf([{type:'cinf',id:0,data:metadata}]),source=forkOf([{type:'cicn',id:-10239,name:'actual-face',data:solidBackgroundIcon()}]);
  const digest=async bytes=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');
  const environment=await api.prepareCinfEnvironment({version:1,complete:true,providers:[{kind:'theme-fork',id:'actual',complete:true},{kind:'raw-fork',id:'foreign-cinf0',complete:true,bytes:foreign}]});
  const theme=await api.loadKaleidoscopeScheme(source,{cinfEnvironment:environment,provenance:true});try{let trace;const result=await api.composeButton(theme,{label:'',minWidth:29,height:9,diagnostics:{onComplete:t=>trace=t}});const view=theme.manifest.chromeElements['actual-face'].bodyCinf,{metadata:ignored,...lookup}=view;
   return{trace,lookup,bodyMetadataPresent:!!ignored,owner:{baseUrl:theme.baseUrl,chainDepth:0},environmentId:environment.id,bindingId:theme.manifest.cinfEnvironment.bindingId,expectedPayloadSha256:await digest(metadata),expectedForkSha256:await digest(foreign),size:result?[result.width,result.height]:null,opaque:result?[...result.data].filter((v,i)=>i%4===3&&v).length:0};
  }finally{theme.dispose();}
 },mode);
 await attachObservations(info,'controls459-prepared-identity',mode,{mode,observed,unknown:['native provider/device/glyph equivalence']});
 expect(observed.size).toEqual([29,9]);expect(observed.opaque).toBeGreaterThan(0);expect(observed.bodyMetadataPresent).toBe(true);
 expect(observed.lookup).toMatchObject({environmentId:observed.environmentId,bindingId:observed.bindingId,requestedId:-10239,status:'ready',selected:{providerId:'foreign-cinf0',providerKind:'raw-fork',signedId:0,occurrence:0,sha256:observed.expectedPayloadSha256,forkSha256:observed.expectedForkSha256}});expect(observed.lookup.attempts.map(a=>[a.id,a.outcome])).toEqual([[-10239,'missing'],[0,'found']]);
 const admission=observed.trace.steps.find(s=>s.reason==='declared-cinf-role-view'&&s.action==='selected'&&s.usage==='admission');expect(admission).toBeDefined();expect.soft(admission.owner).toEqual(observed.owner);expect.soft(admission.cinfLookup).toEqual(observed.lookup);
 const bands=observed.trace.bandPaints??[];expect(bands.length).toBeGreaterThan(0);for(const band of bands){expect.soft(band.owner).toEqual(observed.owner);expect.soft(band.resource.consumedCinf).toEqual(observed.lookup);}
 for(const step of observed.trace.steps.filter(s=>s.cinfLookup))expect.soft(step.cinfLookup).toEqual(observed.lookup);
});
