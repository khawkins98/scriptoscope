import { test, expect, openHarness, attachObservations, attachCase } from './fixtures.mjs';
import { themeFork } from '../decoder-fixtures/cinf-environment.mjs';
import { solidBackgroundRows } from '../decoder-fixtures/solid-background.mjs';
for (const runtime of ['source','built']) test(`${runtime}: explicit cinf environment consumes a separate role view and rejects unknown scope`, async ({ page,servers },info) => {
  await openHarness(page,servers,runtime);
  await page.route('**/__cinf-environment/scheme.rsrc', route => route.fulfill({status:200,contentType:'application/octet-stream',body:Buffer.from(themeFork({local:true}))}));
  let result;
  try {
    result = await page.evaluate(async runtime => {
      const api = await import(runtime==='source'?'/src/index.ts':'/dist/scriptoscope.js');
      const f = await import('/tests/decoder-fixtures/cinf-environment.mjs');
      const first=f.providerFork(), second=f.providerFork(0,[0,0]), records=[], malformedSections=[];
      for(const field of [8,12]) {
        const bytes=f.providerFork(0);new DataView(bytes.buffer).setUint32(field,0);
        try {
          await api.prepareCinfEnvironment(f.declaration([f.marker(),f.external('malformed-default',bytes)]));
          malformedSections.push({field,accepted:true});
        } catch(error) {malformedSections.push({field,accepted:false,message:error.message});}
      }
      const env = await api.prepareCinfEnvironment(f.declaration([f.external('first',first),f.marker(),f.external('second',second)]));
      const theme=await api.loadTheme('/__cinf-environment',{source:'scheme.rsrc',meta:{name:'owned synthetic'},provenance:true,cinfEnvironment:env});
      const common=JSON.stringify(theme.manifest.chromeElements.face);
      const options={label:'',minWidth:29,height:9,default:false,compositionContext:{controlOrigin:[13,17],portOrigin:[0,0],patternOrigin:{status:'known',offset:[0,0]},clip:{kind:'rect',rect:{x:13,y:17,w:29,h:9}}}};
      const draw=async (owner,extra={},family='push')=>{let trace;try {const { default: _default, ...bevelOptions }=options;const buffer=await api[family==='bevel'?'composeBevelButton':'composeButton'](owner,{...(family==='bevel'?bevelOptions:options),...extra,diagnostics:{onComplete:t=>trace=t}});return {trace,pixels:buffer?Array.from(buffer.data):null,size:buffer?[buffer.width,buffer.height]:null};}catch(e){return {trace,error:{name:e.name,code:e.code,message:e.message}};}};
      try {
        const painted=await draw(theme);
        records.push({kind:'separate-owner',...painted,view:theme.manifest.chromeElements.face.bodyCinf,localPair:theme.manifest.chromeElements.face.byteProvenance,unchanged:common===JSON.stringify(theme.manifest.chromeElements.face)});
        records.push({kind:'default-rejected',...await draw(theme,{default:true})});
        const base={...theme,base:theme};records.push({kind:'base-rejected',...await draw(base)});
        for(const [kind,bytes,data,extra,family] of [
          ['bevel',f.themeFork({id:-10166}),f.declaration([f.marker(),f.external('default',f.providerFork(0))]),{},'bevel'],
          ['fallback0',f.themeFork(),f.declaration([f.marker(),f.external('defaults',f.providerFork(0))]),{}],
          ['ordered-theme',f.themeFork({local:true}),f.declaration([f.marker(),f.external('other',first)]),{}],
          ['two-null',f.themeFork(),f.declaration([f.marker()]),{}],
          ['null-label-rejected',f.themeFork(),f.declaration([f.marker()]),{label:'X'}],
          ['unknown-rejected',f.themeFork(),f.declaration([f.external('listed-match',first)],false),{}],
          ['duplicate-rejected',f.themeFork(),f.declaration([f.external('duplicates',f.forkOf([{type:'cinf',id:-10239,data:new Uint8Array(18)},{type:'cinf',id:-10239,data:new Uint8Array(18)}]))]),{}],
          ['invalid-rejected',f.themeFork(),f.declaration([f.external('short',f.forkOf([{type:'cinf',id:-10239,data:new Uint8Array(1)}]))]),{}],
          ['mode5-rejected',f.themeFork(),f.declaration([f.external('mode5',f.providerFork(-10239,[3,3],5))]),{}],
          ['alias-rejected',f.themeFork({id:10239}),f.declaration([f.external('default',f.providerFork(0))]),{}],
          ['text-sample-rejected',f.themeFork(),f.declaration([f.external('bad-text',(()=>{const data=new Uint8Array([3,1,0,0,0,0,0,3,0,3,0,100,0,100,0,0,0,0]);return f.forkOf([{type:'cinf',id:-10239,data}]);})())]),{label:'X'}],
          ['empty-label-text-unavailable',f.themeFork(),f.declaration([f.external('bad-text',(()=>{const data=new Uint8Array([3,1,0,0,0,0,0,3,0,3,0,100,0,100,0,0,0,0]);return f.forkOf([{type:'cinf',id:-10239,data}]);})())]),{}],
        ]) {
          const environment=await api.prepareCinfEnvironment(data), owner=await api.loadKaleidoscopeScheme(bytes,{provenance:true,cinfEnvironment:environment});
          try {records.push({kind,...await draw(owner,extra,family),view:owner.manifest.chromeElements.face.bodyCinf});}finally{owner.dispose();}
        }
        // Real same-ID views must not be interchangeable, including across the decode await.
        const twins = await api.loadKaleidoscopeScheme(f.twinFaceFork(),{provenance:true,cinfEnvironment:env});
        const a=twins.manifest.chromeElements.face,b=twins.manifest.chromeElements.other, original=a.bodyCinf;
        const decode=HTMLImageElement.prototype.decode;let release;
        try {
          a.bodyCinf=b.bodyCinf;records.push({kind:'transplanted-view-rejected',...await draw(twins)});a.bodyCinf=original;
          const barrier=new Promise(r=>{release=r;});let entered;const started=new Promise(r=>{entered=r;});
          HTMLImageElement.prototype.decode=async function(){if(this.src===a.asset){entered();await barrier;}return decode.call(this);};
          const pending=draw(twins);await started;a.bodyCinf=b.bodyCinf;release();
          records.push({kind:'held-decode-original-view',...await pending,original,substitute:b.bodyCinf});
        } finally {release?.();HTMLImageElement.prototype.decode=decode;twins.dispose();}
        return {records,malformedSections,provenance:theme.byteProvenance,environment:env.id,commonUnchanged:common===JSON.stringify(theme.manifest.chromeElements.face)};
      } finally {theme.dispose();}
    },runtime);
    const rows=result.records, expected=solidBackgroundRows.flatMap(row=>[...row].flatMap(c=>c==='.'?[0,0,0,0]:c==='G'?[48,48,48,255]:[0,0,255,255]));
    expect(result.commonUnchanged).toBe(true);
    expect(result.malformedSections).toEqual([
      {field:8,accepted:false,message:expect.stringMatching(/^parseResourceFork:.*data section/)},
      {field:12,accepted:false,message:expect.stringMatching(/^parseResourceFork:.*map section/)},
    ]);
    for(const kind of ['separate-owner','fallback0','bevel','empty-label-text-unavailable']) {
      const row=rows.find(r=>r.kind===kind);expect(row.error).toBeUndefined();expect(row.size).toEqual([29,9]);expect(row.pixels).toEqual(expected);
      const admitted=row.trace.steps.find(s=>s.cinfLookup?.status==='ready');expect(admitted.cinfLookup.selected.providerKind).toBe('raw-fork');
      expect(row.trace.bandPaints.length).toBeGreaterThan(0);
      for(const band of row.trace.bandPaints) expect(band.resource.consumedCinf).toEqual(admitted.cinfLookup);
      expect(row.view.metadata.colorSamples.background).toEqual({rgb16:[0x2121,0x2121,0x2121],displayRgb:[48,48,48]});
    }
    expect(rows[0].localPair.cinfResourceIndex).toBe(1);expect(rows[0].view.selected.occurrence).toBe(0);
    expect(rows[0].view.selected.forkSha256).not.toBe(result.provenance.fork.sha256);
    const order=rows.find(r=>r.kind==='ordered-theme');expect(order.view.selected.providerKind).toBe('theme-fork');
    expect(order.pixels).toEqual(expected.map((v,i)=>expected[i-i%4]===48?[0,0,255,255][i%4]:v));
    const held=rows.find(r=>r.kind==='held-decode-original-view');expect(held.error).toBeUndefined();expect(held.pixels).toEqual(expected);
    expect(held.original.metadata.colorSamples.background).not.toEqual(held.substitute.metadata.colorSamples.background);
    expect(held.trace.steps.find(s=>s.cinfLookup?.status==='ready').cinfLookup.selected).toEqual(held.original.selected);
    expect(held.trace.bandPaints.every(p=>p.resource.manifestKey==='face' && p.resource.byteProvenance.cicnResourceIndex===0)).toBe(true);
    const empty=rows.find(r=>r.kind==='two-null');expect(empty.pixels).toEqual(Array(29*9*4).fill(0));
    expect(empty.trace.bandPaints??[]).toEqual([]);expect(empty.trace.legacyFacePaint).toBeUndefined();
    expect(empty.view.attempts.map(a=>[a.id,a.outcome])).toEqual([[-10239,'missing'],[0,'missing']]);
    for(const row of rows.filter(r=>r.kind.endsWith('rejected'))) {
      expect(row.error,row.kind).toMatchObject({name:'CinfEnvironmentError',code:'UNSUPPORTED_CINF_ENVIRONMENT'});
      expect(row.trace.outcome.status).toBe('error');expect(row.trace.bandPaints??[]).toEqual([]);
    }
  } catch(error) {await attachCase(page,info,{runtime,result},error);throw error;}
  await attachObservations(info,'cinf-environment',runtime,{runtime,mode:runtime,result,claim:'Explicit declared provider order and actual role-view input/paint joins; not original Resource Manager or body-resource provider proof'});
});
