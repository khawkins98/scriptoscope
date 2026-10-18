import { test, expect, openHarness, attachCase, attachObservations } from './fixtures.mjs';
import { headerBandPins, verifyHeaderBandRows } from '../rendering-requirements/header-band-cases.mjs';
import { headerBandMutations } from '../rendering-requirements/header-band-negatives.mjs';
const groups=[
  {indices:[0,1],id:'header.whole-surface-literal'},
  {indices:[2],id:'header.sampling-admission-policy'},
  {indices:[3],id:'band.sampled-line-color-literal'},
];
for(const mode of ['source','built'])for(const group of groups)test(`${mode}: registered ${group.id} exact rows and falsified observations`,async({page,servers},info)=>{
  info.annotations.push({type:'fidelity-assertion',description:group.id});
  await openHarness(page,servers,mode);let result;
  try{
    result=await page.evaluate(async({mode,indices,pins})=>{
      const api=await import(mode==='source'?'/src/index.ts':'/dist/scriptoscope.js');
      const {forkOf}=await import('/tests/resource-provenance/fixtures.mjs');
      const h=await import('/tests/decoder-fixtures/header-surface.mjs'),b=await import('/tests/decoder-fixtures/sampled-bands.mjs');
      const rows=[];
      for(const index of indices){
        const pin=pins[index];let entries;
        if(index<2)entries=[-9567,-9568].flatMap(id=>[{type:'cicn',id,data:h.headerOverlapIcon()},{type:'cinf',id,data:h.headerOverlapInfo()}]);
        else if(index===2){const cinf=h.headerSurfaceInfo();cinf[0]=3;cinf[2]=1;entries=[{type:'cicn',id:-9567,data:h.headerSamplingCollisionIcon()},{type:'cinf',id:-9567,data:cinf}];}
        else entries=[{type:'cicn',id:-10239,name:'band fixture',data:b.sampledBandIcon()},{type:'cinf',id:-10239,data:b.sampledBandInfo(true)}];
        const owner=await api.loadKaleidoscopeScheme(forkOf(entries),{provenance:true});
        const child={baseUrl:'wrong-child/',base:owner,manifest:{chromeElements:{},patterns:{wrong:{sourcePpatId:0,asset:'never-decode-child.png'}}}};
        try{
          let trace;const options=structuredClone(pin.options);
          const value=await api[index===3?'composeButton':'composeHeaderSurface'](index<2?child:owner,{...options,diagnostics:{correlationId:pin.id,onComplete:t=>{trace=t;}}});
          const out=index===3?value:value.status==='rendered'?value.buffer:null;
          const selected=trace.steps.find(s=>s.role==='face'&&s.action==='selected');
          rows.push({caseId:pin.id,selector:pin.rowSelector,options,status:index===3?'rendered':value.status,reason:index===3?null:value.reason,
            owner:{baseUrl:owner.baseUrl,byteProvenance:owner.byteProvenance,element:{manifestKey:selected.resource.manifestKey,asset:owner.manifest.chromeElements[selected.resource.manifestKey].asset,sampledBandAsset:owner.manifest.chromeElements[selected.resource.manifestKey].sampledBandAsset??null}},...(index<2?{childBaseUrl:child.baseUrl,childDeclaration:child.manifest}:{}),
            trace,size:out?[out.width,out.height]:null,sampling:owner.manifest.chromeElements[selected.resource.manifestKey].samplingEquivalence,
            pixels:out?index===3?[[4,0],[0,4],[0,0]].map(at=>({at,rgba:[...out.getPixel(...at)]})):Array.from({length:out.height},(_,y)=>Array.from({length:out.width},(_,x)=>[...out.getPixel(x,y)])):null});
        }finally{owner.dispose();}
      }return rows;
    },{mode,indices:group.indices,pins:headerBandPins.cases});
    const verifiedCaseIds=verifyHeaderBandRows(result,group.indices),negatives=[];
    for(const[name,mutate]of headerBandMutations(group.indices)){
      const changed=structuredClone(result);mutate(changed);expect(()=>verifyHeaderBandRows(changed,group.indices),name).toThrow();negatives.push(name);
    }
    await attachObservations(info,'header-band-requirements',`${mode}-${group.id}`,{mode,result,verifiedCaseIds,negatives,
      evidence:'Exact finite synthetic source/literal assertions; unsupported admission is compatibility policy, not original unavailability',limits:'No original capture, device color, historical ownership, font or native interaction certification'});
  }catch(error){await attachCase(page,info,{mode,result,group},error);throw error;}
});
