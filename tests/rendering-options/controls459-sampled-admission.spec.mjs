// Finite optional sampled-descriptor admission, ported from frozen independent
// review modules. This is a modern public policy, not native sampling evidence.
import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { sampledBandIcon } from '../decoder-fixtures/sampled-bands.mjs';
import { verifySampledAdmission } from './controls459/sampled-admission-checks.mjs';
import { test,expect,openHarness,attachCase,attachObservations } from './fixtures.mjs';
for(const mode of ['source','built'])test(`${mode}: finite sampled scalar transport and primary proof admission`,async({page,servers},info)=>{
 await openHarness(page,servers,mode);let result;
 try{
  result=await page.evaluate(async mode=>{
   const api=await import(mode==='source'?'/src/index.ts':'/dist/scriptoscope.js');
   const {collectSampledAdmission}=await import('/tests/rendering-options/controls459/sampled-admission-fixtures.mjs');
   return collectSampledAdmission(api);
  },mode);
  // Passing real controls precede corruption checks; a setup error is not a kill.
  for(const observed of [false,true])for(const kind of ['valid','badAlpha','badSize','badComparison','transparent','equivalent','selected-base','decodeError'])verifySampledAdmission(result.find(r=>r.kind===kind&&r.observed===observed));
  const validationErrors=[];
  for(const row of result)try{verifySampledAdmission(row);}catch(e){validationErrors.push({kind:row.kind,observed:row.observed,message:e.message});}
  const negatives=[];
  for(const [name,mutate]of [['wrong-owner',r=>r.trace.bandPaints[0].owner.baseUrl='foreign'],['wrong-band',r=>r.band=[255,0,0,255]],['wrong-transport',r=>r.trace.bandPaints.find(b=>b.derived).derived.assetUrl='unloaded:foreign'],['wrong-mask-hole',r=>r.hole=[0,0,0,0]]]){
   const changed=structuredClone(result.find(r=>r.kind==='valid'&&r.observed));mutate(changed);expect(()=>verifySampledAdmission(changed),name).toThrow();negatives.push(name);
  }
  for(const row of result.filter(r=>r.observed))expect(row.provenance.resources.find(r=>r.type==='cicn'&&r.signedId===-10239).sha256).toBe(createHash('sha256').update(sampledBandIcon({transparent:row.kind==='transparent',...(row.kind==='equivalent'?{sampledRgb:[65535,0,0]}:{})})).digest('hex'));
  const path=info.outputPath('sampled-admission-observations.json');await writeFile(path,JSON.stringify({mode,result,validationErrors,negatives},null,2));await info.attach('sampled-admission-observations.json',{path,contentType:'application/json'});
  await attachObservations(info,'controls459-sampled-admission',mode,{mode,result,validationErrors,negatives,limits:'Finite synthetic public admission; native provider/cache/device behavior unknown'});
  expect(validationErrors,'finite scalar transport and primary proof consistency').toEqual([]);
 }catch(error){await attachCase(page,info,{mode,result},error);throw error;}
});
