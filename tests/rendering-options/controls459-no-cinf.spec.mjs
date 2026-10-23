// Candidate execution is not inventory activation or independent reviewer approval.
import {test,expect,openHarness,attachObservations} from './fixtures.mjs';
import {readFileSync} from 'node:fs';
import {readInventory} from '../control-availability/validate-source.mjs';
import {compareNoCinfAdmission} from './controls459/no-cinf-admission.mjs';
const proposal=JSON.parse(readFileSync(new URL('../control-availability/corrections/459-no-cinf-admission.json',import.meta.url))),{inventory,choices,fixtures}=readInventory();
for(const mode of ['source','built'])test(`${mode}: candidate no-cinf admissions preserve actual identity without painted dependencies`,async({page,servers},info)=>{
 await openHarness(page,servers,mode);const rows=[];
 for(const change of proposal.changes){const c=change.after,ref=c.sourceEvidence.find(r=>r.fixture),fixture=ref?fixtures.fixtures.find(f=>f.id===ref.fixture):null,sourceChoice=fixture?null:choices.sources.find(s=>'theme.'+s.slug===c.input);
 const observed=await page.evaluate(async args=>{const api=await import(args.mode==='built'?'/dist/scriptoscope.js':'/src/index.ts');const {runAvailabilityCase}=await import('/tests/control-availability/browser.mjs');return runAvailabilityCase(api,args.c,args.fixture,args.sourceChoice);},{mode,c,fixture,sourceChoice});rows.push({id:c.id,observed,errors:compareNoCinfAdmission(c,observed)});}
 await attachObservations(info,'controls459-no-cinf',mode,{mode,rows,candidateActive:inventory.inventoryVersion===proposal.candidateInventoryVersion,unknown:['all original pixels','native/provider equivalence','malformed or UNKNOWN metadata']});expect(rows.flatMap(r=>r.errors.map(error=>({id:r.id,error})))).toEqual([]);expect(rows).toHaveLength(9);
});
// Source/fork/asset joins are preserved independently of the old painted-selection
// assumption. This is the ten source/built archive scopes in the inactive patch.
const {boundaryInput}=await import('./border-boundary-inputs.mjs');
const missingArchiveSlugs=proposal.borderScope.affectedSourceBuiltArchiveProbes;
const missingInputs=await Promise.all(missingArchiveSlugs.map(slug=>boundaryInput(choices.sources.find(s=>s.slug===slug))));
for(const mode of ['source','built'])test(`${mode}: candidate no-cinf border admission keeps raw source joins and all pixels unassessed`,async({page,servers},info)=>{
 await openHarness(page,servers,mode);
 const rows=await page.evaluate(async({mode,inputs})=>{const api=await import(mode==='built'?'/dist/scriptoscope.js':'/src/index.ts');const out=[];
  for(const input of inputs){const theme=await api.loadTheme('/themes/'+input.choice.slug,{source:input.choice.path.split('/').at(-1),provenance:true});try{
   for(const [state,id]of [['active',-10239],['pressed',-10238],['inactive',-10240]]){const matches=Object.entries(input.elements).filter(([,e])=>e.signedId===id);if(matches.length!==1)throw Error('Independent raw signed art input ambiguous');const [key,raw]=matches[0];if(raw.cinfResourceIndex!==null||Object.values(input.resources).some(r=>r.type==='cinf'&&[id,0].includes(r.signedId)))throw Error('Input does not prove exact metadata and cinf0 NULL');
    for(const omitted of [false,true]){let trace;const result=await api.composeButton(theme,{label:'',default:false,pressed:state==='pressed',disabled:state==='inactive',...(omitted?{}:{minWidth:24,height:1}),diagnostics:{onComplete:t=>trace=t}});out.push({slug:input.choice.slug,state,id,key,raw,omitted,owner:theme.baseUrl,trace,size:result?[result.width,result.height]:null,loadId:theme.byteProvenance.loadId,input:theme.byteProvenance.input,fork:theme.byteProvenance.fork,source:input.choice,resources:theme.byteProvenance.resources,assetUrl:api.assetUrl(theme,theme.manifest.chromeElements[key].asset),rawResources:input.resources});}
   }
  }finally{theme.dispose();}}
  return out;
 },{mode,inputs:missingInputs});
 for(const row of rows){const identity={role:'face',usage:'admission',ownerId:'actual-theme',chainDepth:0,type:'cicn',signedId:row.id,sourceCinfId:null,manifestKey:row.key};expect(compareNoCinfAdmission({family:'push-button',proposed:{admission:[identity],metadataAbsence:{type:'cinf',kind:'known-null-in-declared-theme-chain',requestedIds:[row.id,0]}}},{result:{kind:row.size?'themed':'unavailable',width:row.size?.[0],height:row.size?.[1]},owners:{'actual-theme':row.owner},traces:[row.trace]}),row.slug+':'+row.state).toEqual([]);
  const actual=row.trace.steps.find(s=>s.action==='selected'&&s.reason==='resource-id');expect(actual.resource.assetUrl).toBe(row.assetUrl);expect(actual.resource.byteProvenance).toMatchObject({loadId:row.loadId,manifestKey:row.key,cicnResourceIndex:row.raw.cicnResourceIndex,cinfResourceIndex:null});const raw=row.rawResources[row.raw.cicnResourceIndex],payload=row.resources.find(r=>r.resourceIndex===row.raw.cicnResourceIndex);expect(payload).toMatchObject({status:'decoded',type:'cicn',signedId:row.id,byteLength:raw.byteLength,sha256:raw.sha256});expect(row.input.sha256).toBe(row.source.archiveSha256);expect(row.fork.sha256).toBe(row.source.forkSha256);expect(row.fork.selection.entryIndex).toBe(row.source.entryIndex);expect(row.fork.selection.entryName).toBe(row.source.entryName);
  const size=row.omitted?[56,row.raw.height<=28?row.raw.height:20]:[24,1];expect(row.size).toEqual(size.map(v=>v+8));row.assessedPixels=0;row.pixelStatus='unknown-missing-cinf';
 }
 await attachObservations(info,'controls459-no-cinf-border',mode,{mode,rows,candidateActive:inventory.inventoryVersion===proposal.candidateInventoryVersion,unknown:['all original pixels','global default cinf provider','native device and glyph equivalence']});expect(rows).toHaveLength(5*3*2);
});
