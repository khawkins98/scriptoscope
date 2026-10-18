import { createHash } from 'node:crypto';
import { sampledBandIcon } from '../decoder-fixtures/sampled-bands.mjs';
import { test, expect, openHarness, attachCase, attachObservations } from './fixtures.mjs';
for (const mode of ['source','built']) for (const family of ['push','bevel','ring']) for (const tile of [false,true])
  test(`${mode}: sampled ${family} bands retain raster corners (tile=${tile})`,async({page,servers},info)=>{
    await openHarness(page,servers,mode);let result;
    try {
      result=await page.evaluate(async({mode,family,tile})=>{
        const api=await import(mode==='source'?'/src/index.ts':'/dist/scriptoscope.js');
        const {forkOf}=await import('/tests/resource-provenance/fixtures.mjs');
        const {sampledBandIcon,sampledBandInfo}=await import('/tests/decoder-fixtures/sampled-bands.mjs');
        const id=family==='bevel'?-10163:family==='ring'?-10231:-10239;
        const entries=[{type:'cicn',id,name:'band fixture',data:sampledBandIcon()},{type:'cinf',id,data:sampledBandInfo(tile)}];
        if(family==='ring') {entries.push({type:'cicn',id:-10239,name:'face',data:sampledBandIcon({transparent:true})},{type:'cinf',id:-10239,data:sampledBandInfo(tile)});}
        const theme=await api.loadKaleidoscopeScheme(forkOf(entries),{provenance:true});let trace;
        try {
          const opts={label:'',minWidth:29,height:17,default:family==='ring',diagnostics:{onComplete:t=>{trace=t;}}};
          const out=await (family==='bevel'?api.composeBevelButton(theme,opts):api.composeButton(theme,opts));
          return {pixels:[[4,0],[0,4],[0,0]].map(([x,y])=>out.getPixel(x,y)),trace,provenance:theme.byteProvenance,elements:theme.manifest.chromeElements};
        }finally{theme.dispose();}
      },{mode,family,tile});
      expect(result.pixels).toEqual([[48,48,48,255],[48,48,48,255],[255,0,0,255]]);
      const dependency=result.trace.bandPaints.filter(p=>p.policy==='sampled-companion');
      expect(dependency.length).toBe(2);
      for(const p of dependency){
        expect(p.role).toBe(family==='ring'?'default-ring':'face');
        expect(p.owner).toEqual({baseUrl:'',chainDepth:0});
        expect(p.resource.byteProvenance).toMatchObject({loadId:result.provenance.loadId,cicnResourceIndex:0,manifestKey:'band-fixture'});
        expect(p.resource.signedId).toBe(family==='bevel'?-10163:family==='ring'?-10231:-10239);
        expect(p.derived.path).toBe(`cicn-sampled/cicn-n${-p.resource.signedId}-band-fixture.png`);
        expect(result.provenance.resources[0].sha256).toBe(createHash('sha256').update(sampledBandIcon()).digest('hex'));
      }
    }catch(error){await attachCase(page,info,{mode,family,tile,result},error);throw error;}
    await attachObservations(info,'sampled-bands',`${mode}-${family}-${tile}`,{mode,family,tile,result});
  });

for(const mode of ['source','built']) test(`${mode}: band sampling only decodes and traces visible expansion dependencies`,async({page,servers},info)=>{
  await openHarness(page,servers,mode);let result;
  try {
    result=await page.evaluate(async mode=>{
      const api=await import(mode==='source'?'/src/index.ts':'/dist/scriptoscope.js');
      const {forkOf}=await import('/tests/resource-provenance/fixtures.mjs');
      const {sampledBandIcon,sampledBandInfo}=await import('/tests/decoder-fixtures/sampled-bands.mjs');
      const decode=HTMLImageElement.prototype.decode, rows=[];
      const run=async(kind)=>{
        const cinf=sampledBandInfo(kind==='repeat');if(kind==='repeat')cinf[0]=2;
        const entries=[{type:'cicn',id:-10239,name:'face',data:sampledBandIcon()},{type:'cinf',id:-10239,data:cinf}];
        if(kind==='reservation')entries.push({type:'cicn',id:-10231,name:'ring',data:sampledBandIcon()},{type:'cinf',id:-10231,data:sampledBandInfo()});
        const owner=await api.loadKaleidoscopeScheme(forkOf(entries),{provenance:true});owner.baseUrl='owner';
        const child={base:owner,baseUrl:'child',manifest:{chromeElements:{}}};
        const urls=Object.values(owner.manifest.chromeElements).flatMap(e=>e.sampledBandAsset?[e.sampledBandAsset.asset]:[]);
        let calls=[],trace;HTMLImageElement.prototype.decode=function(){calls.push(this.src);return decode.call(this);};
        const context={controlOrigin:[0,0],portOrigin:[0,0],patternOrigin:{status:'unknown'},clip:{kind:'rect',rect:kind==='clipped'?{x:0,y:0,w:3,h:3}:{x:4,y:0,w:8,h:1}}};
        try {
          const opts={label:'',minWidth:kind==='unit'?7:29,height:kind==='unit'?7:17,
            ...(kind==='clipped'||kind==='partial'?{compositionContext:context}:{}),diagnostics:{onComplete:t=>{trace=t;}}};
          const out=await api.composeButton(child,opts);
          return {kind,companionDecodes:calls.filter(u=>urls.includes(u)).length,trace,loadId:owner.byteProvenance.loadId,
            pixels:[[0,0],[3,0],[4,0],[0,4],[12,0],[0,3]].map(([x,y])=>out.getPixel(x,y))};
        }finally{HTMLImageElement.prototype.decode=decode;owner.dispose();}
      };
      for(const kind of ['unit','repeat','clipped','partial','reservation'])rows.push(await run(kind));
      return rows;
    },mode);
    expect(result.map(r=>[r.kind,r.companionDecodes])).toEqual([['unit',1],['repeat',0],['clipped',0],['partial',1],['reservation',1]]);
    expect(result[0].pixels[5]).toEqual([255,0,0,255]); // destination height1 uses ordinary copy, horizontal band still expands
    expect(result[1].pixels[1]).toEqual([255,0,0,255]); // source width3 repeats ordinary raster
    expect(result[2].pixels[0]).toEqual([255,0,0,255]);
    expect(result[3].pixels[2]).toEqual([48,48,48,255]);
    expect(result[3].pixels[4]).toEqual([0,0,0,0]); // exclusive clip edge
    for(const row of result){
      const painted=row.trace.bandPaints??[];
      for(const p of painted){expect(p.owner).toEqual({baseUrl:'owner',chainDepth:1});expect(p.resource.byteProvenance.loadId).toBe(row.loadId);}
      const companions=painted.filter(p=>p.policy==='sampled-companion');
      expect(companions.length>0).toBe(['unit','partial','reservation'].includes(row.kind));
      for(const p of companions){expect(p.derived.path).toBe('cicn-sampled/cicn-n10239-face.png');expect(p.role).toBe('face');}
      expect(painted.some(p=>p.role==='default-ring')).toBe(false); // reservation does not paint/decode
    }
  }catch(error){await attachCase(page,info,{mode,result},error);throw error;}
  await attachObservations(info,'sampled-bands',`${mode}-dependencies`,{mode,result});
});

for(const mode of ['source','built']) test(`${mode}: cancelled face or companion decode cannot publish sampled paint`,async({page,servers},info)=>{
  await openHarness(page,servers,mode);let result;
  try {
    result=await page.evaluate(async mode=>{
      const api=await import(mode==='source'?'/src/index.ts':'/dist/scriptoscope.js');
      const {forkOf}=await import('/tests/resource-provenance/fixtures.mjs');
      const {sampledBandIcon,sampledBandInfo}=await import('/tests/decoder-fixtures/sampled-bands.mjs');
      const decode=HTMLImageElement.prototype.decode, rows=[];
      for(const heldPart of ['face','companion']){
        const t=await api.loadKaleidoscopeScheme(forkOf([{type:'cicn',id:-10239,name:'face',data:sampledBandIcon()},{type:'cinf',id:-10239,data:sampledBandInfo()}]));
        const e=t.manifest.chromeElements.face, hold=heldPart==='face'?e.asset:e.sampledBandAsset.asset;
        let release,entered,trace,calls=[];const barrier=new Promise(r=>{release=r;}),started=new Promise(r=>{entered=r;});
        HTMLImageElement.prototype.decode=async function(){calls.push(this.src);if(this.src===hold){entered();await barrier;}return decode.call(this);};
        const controller=new AbortController();
        try {
          const pending=api.composeButton(t,{label:'',minWidth:29,height:17,diagnostics:{onComplete:t=>{trace=t;}}},controller.signal).then(()=>({resolved:true}),e=>({resolved:false,name:e.name}));
          await started;controller.abort();release();const outcome=await pending;
          rows.push({heldPart,outcome,trace,companionDecodes:calls.filter(u=>u===e.sampledBandAsset.asset).length});
        }finally{release();HTMLImageElement.prototype.decode=decode;t.dispose();}
      }
      return rows;
    },mode);
    for(const r of result){expect(r.outcome).toEqual({resolved:false,name:'AbortError'});expect(r.trace.outcome.status).toBe('error');expect((r.trace.bandPaints??[]).some(p=>p.policy==='sampled-companion')).toBe(false);}
    expect(result.map(r=>r.companionDecodes)).toEqual([0,1]);
  }catch(error){await attachCase(page,info,{mode,result},error);throw error;}
  await attachObservations(info,'sampled-bands',`${mode}-cancel`,{mode,result});
});

for(const mode of ['source','built']) test(`${mode}: sampled mask holes preserve body and disposal evicts the owned derived raster`,async({page,servers},info)=>{
  await openHarness(page,servers,mode);let result;
  try {
    result=await page.evaluate(async mode=>{
      const api=await import(mode==='source'?'/src/index.ts':'/dist/scriptoscope.js');
      const {forkOf}=await import('/tests/resource-provenance/fixtures.mjs');
      const {sampledBandIcon,sampledBandInfo}=await import('/tests/decoder-fixtures/sampled-bands.mjs');
      const cinf=sampledBandInfo();cinf[1]=4;
      // Ordinary face is a retained data URL; only the actual derived blob is
      // revoked. A later public compose must attempt decode again, not retain it.
      const t=await api.loadKaleidoscopeScheme(forkOf([{type:'cicn',id:-10239,name:'face',data:sampledBandIcon()},{type:'cinf',id:-10239,data:cinf}]),{
        assetUrlFactory:async(rgba,w,h,path)=>{
          const c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(rgba),w,h),0,0);
          return path.startsWith('cicn-sampled/')?URL.createObjectURL(await new Promise(r=>c.toBlob(r))):c.toDataURL();
        },
      });
      const e=t.manifest.chromeElements.face;
      // Distinguishable caller-declared body below the loader's actual masked band.
      e.colorSamples={...e.colorSamples,background:{rgb16:[0,65535,0],displayRgb:[0,255,0]}};
      const decode=HTMLImageElement.prototype.decode,revoke=URL.revokeObjectURL,revoked=[];let companionDecodes=0;
      URL.revokeObjectURL=url=>{revoked.push(url);revoke.call(URL,url);};
      HTMLImageElement.prototype.decode=function(){if(this.src===e.sampledBandAsset.asset)companionDecodes++;return decode.call(this);};
      try{
        const out=await api.composeButton(t,{label:'',minWidth:29,height:17});
        await api.composeButton(t,{label:'',minWidth:29,height:17});
        const cachedDecodes=companionDecodes;t.dispose();
        const after=await api.composeButton(t,{label:'',minWidth:29,height:17}).then(()=>({resolved:true}),error=>({resolved:false,name:error.name}));
        return{body:out.getPixel(4,3),band:out.getPixel(4,0),corner:out.getPixel(0,0),cachedDecodes,after,companionDecodes,revokedCompanion:revoked.filter(url=>url===e.sampledBandAsset.asset).length};
      }finally{HTMLImageElement.prototype.decode=decode;t.dispose();URL.revokeObjectURL=revoke;}
    },mode);
    expect(result.body).toEqual([0,255,0,255]);expect(result.band).toEqual([48,48,48,255]);expect(result.corner).toEqual([255,0,0,255]);
    expect(result.cachedDecodes).toBe(1);expect(result.companionDecodes).toBe(2);expect(result.revokedCompanion).toBe(1); // Firefox may retain its own decoded blob after revocation
  }catch(error){await attachCase(page,info,{mode,result},error);throw error;}
  await attachObservations(info,'sampled-bands',`${mode}-mask-disposal`,{mode,result});
});

for(const mode of ['source','built']) test(`${mode}: concurrent same-key companion owners and diagnostic callbacks stay isolated`,async({page,servers},info)=>{
  await openHarness(page,servers,mode);let result;
  try{
    result=await page.evaluate(async mode=>{
      const api=await import(mode==='source'?'/src/index.ts':'/dist/scriptoscope.js');
      const {forkOf}=await import('/tests/resource-provenance/fixtures.mjs');
      const {sampledBandIcon,sampledBandInfo}=await import('/tests/decoder-fixtures/sampled-bands.mjs');
      const owners=await Promise.all([[8481,8481,8481],[0,65535,0]].map(sampledRgb=>api.loadKaleidoscopeScheme(forkOf([
        {type:'cicn',id:-10239,name:'same',data:sampledBandIcon({sampledRgb})},{type:'cinf',id:-10239,data:sampledBandInfo()},
      ]),{provenance:true})));
      const traces=[];const onComplete=t=>traces.push(t);
      try{
        const outputs=await Promise.all(owners.map((theme,i)=>{theme.baseUrl=`owner-${i}`;return api.composeButton(theme,{label:'',minWidth:29,height:17,diagnostics:{correlationId:`call-${i}`,onComplete}});}));
        return{pixels:outputs.map(out=>out.getPixel(4,0)),traces,owners:owners.map(t=>({loadId:t.byteProvenance.loadId,element:t.manifest.chromeElements.same}))};
      }finally{owners.forEach(t=>t.dispose());}
    },mode);
    expect(result.pixels).toEqual([[48,48,48,255],[0,255,0,255]]);
    expect(new Set(result.owners.map(o=>o.loadId)).size).toBe(2);
    expect(new Set(result.owners.map(o=>o.element.sampledBandAsset.asset)).size).toBe(2);
    for(const [i,owner]of result.owners.entries()){
      const trace=result.traces.find(t=>t.correlationId===`call-${i}`);
      expect(trace.outcome.status).toBe('themed');
      for(const p of trace.bandPaints){expect(p.owner.baseUrl).toBe(`owner-${i}`);expect(p.resource.byteProvenance.loadId).toBe(owner.loadId);}
      for(const p of trace.bandPaints.filter(p=>p.policy==='sampled-companion'))expect(p.derived.assetUrl).toBe(owner.element.sampledBandAsset.asset);
    }
  }catch(error){await attachCase(page,info,{mode,result},error);throw error;}
  await attachObservations(info,'sampled-bands',`${mode}-concurrent`,{mode,result});
});

for(const mode of ['source','built']) test(`${mode}: caller-declared companion cannot replace the ordinary source mask`,async({page,servers},info)=>{
  await openHarness(page,servers,mode);let result;
  try{
    result=await page.evaluate(async mode=>{
      const api=await import(mode==='source'?'/src/index.ts':'/dist/scriptoscope.js');
      const {forkOf}=await import('/tests/resource-provenance/fixtures.mjs');
      const {sampledBandIcon,sampledBandInfo}=await import('/tests/decoder-fixtures/sampled-bands.mjs');
      const info=sampledBandInfo();info[1]=4;
      const t=await api.loadKaleidoscopeScheme(forkOf([{type:'cicn',id:-10239,name:'face',data:sampledBandIcon()},{type:'cinf',id:-10239,data:info}]));
      const c=document.createElement('canvas');c.width=7;c.height=7;const ctx=c.getContext('2d');ctx.fillStyle='#0000ff';ctx.fillRect(0,0,7,7);
      const e=t.manifest.chromeElements.face;e.sampledBandAsset={...e.sampledBandAsset,asset:c.toDataURL()};
      e.colorSamples={...e.colorSamples,background:{rgb16:[0,65535,0],displayRgb:[0,255,0]}};let trace;
      try{const out=await api.composeButton(t,{label:'',minWidth:29,height:17,diagnostics:{onComplete:t=>{trace=t;}}});return{hole:out.getPixel(4,3),band:out.getPixel(4,0),trace};}finally{t.dispose();}
    },mode);
    expect(result.hole).toEqual([0,255,0,255]);expect(result.band).toEqual([255,0,0,255]);
    expect(result.trace.bandPaints.some(p=>p.policy==='sampled-companion')).toBe(false);
    expect(result.trace.bandPaints.filter(p=>p.branch!=='copy').every(p=>p.policy==='compatibility-raster')).toBe(true);
  }catch(error){await attachCase(page,info,{mode,result},error);throw error;}
  await attachObservations(info,'sampled-bands',`${mode}-invalid-mask`,{mode,result});
});
