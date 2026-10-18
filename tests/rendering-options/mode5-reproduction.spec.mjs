import { createHash } from 'node:crypto';
import { entries, expectedBuffers, literalCicn } from '../decoder-fixtures/mode5.mjs';
import { sampledBandIcon, sampledBandInfo } from '../decoder-fixtures/sampled-bands.mjs';
import { twoPixelPpat } from '../resource-provenance/patterns.mjs';
import { test, expect, openHarness, attachCase, attachObservations } from './fixtures.mjs';
const cases = [
  { id:'color8', expected:'color8' },
  { id:'indexed1', expected:'indexed1' },
  { id:'missing', expected:'missing' },
  { id:'negative-origin-clip', kind:'color8', expected:'color8Clipped', clipped:true },
  { id:'signed-id-zero', kind:'color8', expected:'color8', bodyId:0 },
  { id:'same-id-cicn-and-ppat', kind:'color8', expected:'color8', collision:true },
  { id:'same-id-ppat-only', kind:'missing', expected:'missing', collision:true },
];
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
for(const mode of ['source','built']) for(const c of cases) test(`${mode}: mode5 ${c.id} matches independent literal`,async({page,servers},info)=>{
  await openHarness(page,servers,mode);
  const records=entries(c.kind??c.id,c.bodyId??51);
  if(c.collision) records.push({type:'ppat',id:c.kind==='missing'?52:51,name:'same ID different resource type',data:twoPixelPpat()});
  let result;
  try{
    result=await page.evaluate(async({mode,records,clipped})=>{
      const api=await import(mode==='source'?'/src/index.ts':'/dist/scriptoscope.js');
      const {forkOf}=await import('/tests/resource-provenance/fixtures.mjs');
      const theme=await api.loadKaleidoscopeScheme(forkOf(records.map(r=>({...r,data:Uint8Array.from(r.data)}))),{provenance:true});
      let trace;
      const options={label:'',minWidth:24,height:6,...(clipped?{compositionContext:{controlOrigin:[-3,5],portOrigin:[0,0],patternOrigin:{status:'unknown'},clip:{kind:'rect',rect:{x:0,y:7,w:4,h:1}}}}:{})};
      try{
        const output=await api.composeButton(theme,{...options,diagnostics:{onComplete:value=>{trace=value;}}});
        return{options,width:output?.width,height:output?.height,rgba:output?Array.from(output.data):null,trace,provenance:theme.byteProvenance,elements:theme.manifest.chromeElements,patterns:theme.manifest.patterns};
      }finally{theme.dispose();}
    },{mode,clipped:c.clipped??false,records:records.map(r=>({...r,data:Array.from(r.data)}))});
    const expected=Array.from(expectedBuffers[c.expected]);
    const observation={mode,case:c.id,expectedKind:c.expected,expectedDimensions:[24,6],expectedOpaque:expected.filter((x,i)=>i%4===3&&x===255).length,expectedSha256:sha(expectedBuffers[c.expected]),inputs:records.map(r=>({type:r.type,id:r.id,sha256:sha(r.data),bytes:r.data.length})),result};
    observation.actualOpaque=result.rgba?.filter((x,i)=>i%4===3&&x===255).length;
    observation.actualSha256=result.rgba?sha(Uint8Array.from(result.rgba)):null;
    observation.differentPixels=result.rgba?expected.reduce((n,_,i)=>i%4===0&&expected.slice(i,i+4).some((v,j)=>v!==result.rgba[i+j])?n+1:n,0):null;
    await attachObservations(info,'mode5-reproduction',`${mode}-${c.id}`,observation);
    expect([result.width,result.height]).toEqual([24,6]);
    expect(result.rgba).toEqual(expected);
    const binding=result.elements['mode5-face'].cicnBody;
    expect(binding.requestedId).toBe(c.kind==='missing'||c.id==='missing'?52:c.bodyId??51);
    const painted=result.trace.steps.find(s=>s.bodyPaint);
    expect(painted.bodyPaint.paintedPixels).toBe(observation.expectedOpaque);
    if(c.expected==='missing') expect(painted.bodyPaint.branch).toBe('missing-erase');
    else {
      expect(painted.bodyPaint.branch).toBe(c.id==='indexed1'?'masked-copy':'unmasked-copy');
      expect(painted.resource.byteProvenance.loadId).toBe(result.provenance.loadId);
      expect(painted.resource.byteProvenance.cicnResourceIndex).toBe(2);
      expect(painted.resource.manifestKey).toBe('mode5-body');
      expect(result.provenance.resources[2].sha256).toBe(observation.inputs[2].sha256);
    }
  }catch(error){await attachCase(page,info,{mode,case:c.id,result},error);throw error;}
});

for(const mode of ['source','built']) test(`${mode}: mode5 encoded hidden RGB and inherited owner retain exact payload and dependency scope`,async({page,servers},info)=>{
  await openHarness(page,servers,mode);let result;
  const records=entries(),mid=records[2].data.slice();new DataView(mid.buffer).setUint16(118,0x2121);records[2].data=mid;
  try{
    result=await page.evaluate(async({mode,records})=>{
      const api=await import(mode==='source'?'/src/index.ts':'/dist/scriptoscope.js'),{forkOf}=await import('/tests/resource-provenance/fixtures.mjs');
      const owner=await api.loadKaleidoscopeScheme(forkOf(records.map(r=>({...r,data:Uint8Array.from(r.data)}))),{provenance:true});owner.baseUrl='actual-body-owner';
      const child={baseUrl:'child',base:owner,manifest:{chromeElements:{}}},binding=owner.manifest.chromeElements['mode5-face'].cicnBody;
      const decode=HTMLImageElement.prototype.decode;let calls=0;
      HTMLImageElement.prototype.decode=function(){if(this.src===binding.asset)calls++;return decode.call(this);};
      try{
        const rows=[];
        for(const kind of ['full-clip','scaled','normal']){
          let trace;const options={label:'',minWidth:24,height:kind==='scaled'?7:6,diagnostics:{onComplete:t=>{trace=t;}},...(kind==='full-clip'?{compositionContext:{controlOrigin:[0,0],portOrigin:[0,0],patternOrigin:{status:'unknown'},clip:{kind:'rect',rect:{x:100,y:100,w:1,h:1}}}}:{})};
          const out=await api.composeButton(child,options);rows.push({kind,trace,pixel:out.getPixel(3,2),calls});
        }
        return{rows,binding,provenance:owner.byteProvenance};
      }finally{HTMLImageElement.prototype.decode=decode;owner.dispose();}
    },{mode,records:records.map(r=>({...r,data:Array.from(r.data)}))});
    expect(result.rows.map(r=>r.calls)).toEqual([0,0,1]);expect(result.rows[2].pixel).toEqual([0,48,0,255]);
    const paint=result.rows[2].trace.steps.find(s=>s.bodyPaint);
    expect(paint.owner).toEqual({baseUrl:'actual-body-owner',chainDepth:1});
    expect(paint.resource.byteProvenance.loadId).toBe(result.provenance.loadId);
    expect(result.provenance.resources[2].sha256).toBe(sha(mid));
    expect(paint.bodyPaint.sourceAssetUrl).toBe(result.binding.asset);expect(paint.bodyPaint.derivedPath).toBe(result.binding.derivedPath);
    expect(result.rows[0].trace.steps.some(s=>s.reason==='cicn-body-outside-clip')).toBe(true);
    expect(result.rows[1].trace.steps.some(s=>s.reason==='cicn-body-scaling-unsupported')).toBe(true);
  }catch(error){await attachCase(page,info,{mode,result},error);throw error;}
  await attachObservations(info,'mode5-reproduction',`${mode}-owner-hidden-rgb`,{mode,result});
});

for(const mode of ['source','built']) test(`${mode}: mode5 cancellation and decode errors cannot publish a body dependency`,async({page,servers},info)=>{
  await openHarness(page,servers,mode);let result;
  try{
    result=await page.evaluate(async({mode,records})=>{
      const api=await import(mode==='source'?'/src/index.ts':'/dist/scriptoscope.js'),{forkOf}=await import('/tests/resource-provenance/fixtures.mjs');const decode=HTMLImageElement.prototype.decode,rows=[];
      for(const kind of ['face-abort','body-abort','body-error']){
        const t=await api.loadKaleidoscopeScheme(forkOf(records.map(r=>({...r,data:Uint8Array.from(r.data)}))));
        const face=t.manifest.chromeElements['mode5-face'],body=face.cicnBody.asset;let release,entered,trace,calls=0;
        const wait=new Promise(r=>{release=r;}),started=new Promise(r=>{entered=r;}),controller=new AbortController();
        const held=kind==='face-abort'?face.asset:body;
        HTMLImageElement.prototype.decode=async function(){if(this.src===body)calls++;if(this.src===held){if(kind==='body-error')throw Error('intentional body decode');entered();await wait;}return decode.call(this);};
        try{
          const pending=api.composeButton(t,{label:'',minWidth:24,height:6,diagnostics:{onComplete:t=>{trace=t;}}},controller.signal).then(()=>({resolved:true}),e=>({resolved:false,name:e.name,message:e.message}));
          if(kind!=='body-error'){await started;controller.abort();release();}
          rows.push({kind,outcome:await pending,trace,calls});
        }finally{release();HTMLImageElement.prototype.decode=decode;t.dispose();}
      }
      return rows;
    },{mode,records:entries().map(r=>({...r,data:Array.from(r.data)}))});
    expect(result.map(r=>r.calls)).toEqual([0,1,1]);
    for(const r of result){expect(r.outcome.resolved).toBe(false);expect(r.trace.outcome.status).toBe('error');expect(r.trace.steps.some(s=>s.bodyPaint)).toBe(false);}
    expect(result[0].outcome.name).toBe('AbortError');expect(result[1].outcome.name).toBe('AbortError');expect(result[2].outcome.message).toContain('intentional body decode');
  }catch(error){await attachCase(page,info,{mode,result},error);throw error;}
  await attachObservations(info,'mode5-reproduction',`${mode}-abort-error`,{mode,result});
});

for(const mode of ['source','built']) test(`${mode}: mode5 later border and ring failures suppress unpublished body paint`,async({page,servers},info)=>{
  await openHarness(page,servers,mode);let result;
  const borderRecords=entries();
  borderRecords[0].data=sampledBandIcon();
  borderRecords[1].data=borderRecords[1].data.slice();borderRecords[1].data[0]=3;borderRecords[1].data[1]=1;
  borderRecords[2].data=literalCicn({rows:Array(4).fill('R'.repeat(22)),maskRows:Array(4).fill('0'.repeat(22)),depth:8,palette:['R']});
  const missingRecords=borderRecords.slice(0,2).map(r=>({...r,data:r.data.slice()}));new DataView(missingRecords[1].data.buffer).setInt16(4,52);
  const ringRecords=[...entries(),{type:'cicn',id:-10231,name:'sampled-ring',data:sampledBandIcon()},
    {type:'cinf',id:-10231,data:sampledBandInfo()}];
  try{
    result=await page.evaluate(async({mode,groups})=>{
      const api=await import(mode==='source'?'/src/index.ts':'/dist/scriptoscope.js'),{forkOf}=await import('/tests/resource-provenance/fixtures.mjs');
      const decode=HTMLImageElement.prototype.decode,rows=[];
      for(const [group,records] of Object.entries(groups))for(const action of ['abort','error']){
        const t=await api.loadKaleidoscopeScheme(forkOf(records.map(r=>({...r,data:Uint8Array.from(r.data)}))),{provenance:true});
        const face=t.manifest.chromeElements['mode5-face'],body=face.cicnBody.asset;
        const border=group==='ring'?t.manifest.chromeElements['sampled-ring']:face;
        const held=border.sampledBandAsset.asset;
        let entered,release,trace,bodyCalls=0,bandCalls=0;
        const started=new Promise(r=>{entered=r;}),wait=new Promise(r=>{release=r;}),controller=new AbortController();
        HTMLImageElement.prototype.decode=async function(){
          if(this.src===body)bodyCalls++;
          if(this.src===held){bandCalls++;entered();await wait;if(action==='error')throw Error('intentional later sampled border decode');}
          return decode.call(this);
        };
        try{
          const pending=api.composeButton(t,{label:'',minWidth:24,height:6,default:group==='ring',diagnostics:{onComplete:t=>{trace=t;}}},controller.signal)
            .then(()=>({resolved:true}),e=>({resolved:false,name:e.name,message:e.message}));
          await started;
          const bodyCallsBeforeRelease=bodyCalls;
          if(action==='abort')controller.abort();release();
          rows.push({group,action,outcome:await pending,trace,bodyCallsBeforeRelease,bodyCalls,bandCalls,bodyAsset:body??null,heldAsset:held});
        }finally{release();HTMLImageElement.prototype.decode=decode;t.dispose();}
      }
      return rows;
    },{mode,groups:Object.fromEntries(Object.entries({body:borderRecords,missing:missingRecords,ring:ringRecords}).map(([key,records])=>[key,records.map(r=>({...r,data:Array.from(r.data)}))]))});
    for(const r of result){
      expect(r.bodyCallsBeforeRelease).toBe(r.group==='missing'?0:1);expect(r.bandCalls).toBe(1);
      expect(r.outcome.resolved).toBe(false);expect(r.trace.outcome.status).toBe('error');
      expect(r.trace.steps.some(s=>s.bodyPaint)).toBe(false);
      expect(r.trace.steps.some(s=>s.role==='body-fill'&&s.action==='selected'&&s.usage==='paint')).toBe(false);
      if(r.action==='abort')expect(r.outcome.name).toBe('AbortError');
      else expect(r.outcome.message).toContain('intentional later sampled border decode');
    }
  }catch(error){await attachCase(page,info,{mode,result},error);throw error;}
  await attachObservations(info,'mode5-reproduction',`${mode}-later-border-error`,{mode,result});
});

for(const mode of ['source','built']) test(`${mode}: mode5 disposal revokes and evicts only its conditional body asset`,async({page,servers},info)=>{
  await openHarness(page,servers,mode);let result;
  try{
    result=await page.evaluate(async({mode,records})=>{
      const api=await import(mode==='source'?'/src/index.ts':'/dist/scriptoscope.js'),{forkOf}=await import('/tests/resource-provenance/fixtures.mjs');
      const t=await api.loadKaleidoscopeScheme(forkOf(records.map(r=>({...r,data:Uint8Array.from(r.data)}))),{assetUrlFactory:async(rgba,w,h,path)=>{
        const c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(rgba),w,h),0,0);
        return path.startsWith('cicn-body/')?URL.createObjectURL(await new Promise(r=>c.toBlob(r))):c.toDataURL();
      }});
      const binding=t.manifest.chromeElements['mode5-face'].cicnBody,decode=HTMLImageElement.prototype.decode,revoke=URL.revokeObjectURL;let calls=0;const revoked=[];
      HTMLImageElement.prototype.decode=function(){if(this.src===binding.asset)calls++;return decode.call(this);};URL.revokeObjectURL=url=>{revoked.push(url);revoke.call(URL,url);};
      try{
        const opts={label:'',minWidth:24,height:6};await api.composeButton(t,opts);await api.composeButton(t,opts);const before=calls;t.dispose();t.dispose();
        const after=await api.composeButton(t,opts).then(()=>({resolved:true}),e=>({resolved:false,name:e.name}));
        return{before,calls,revoked,bodyUrl:binding.asset,after};
      }finally{HTMLImageElement.prototype.decode=decode;t.dispose();URL.revokeObjectURL=revoke;}
    },{mode,records:entries().map(r=>({...r,data:Array.from(r.data)}))});
    expect(result.before).toBe(1);expect(result.calls).toBe(2);expect(result.revoked).toEqual([result.bodyUrl]);
  }catch(error){await attachCase(page,info,{mode,result},error);throw error;}
  await attachObservations(info,'mode5-reproduction',`${mode}-disposal`,{mode,result});
});

for(const mode of ['source','built']) test(`${mode}: mode5 malformed caller bindings cannot claim source paint or borrow another owner`,async({page,servers},info)=>{
  await openHarness(page,servers,mode);let result;
  try{
    result=await page.evaluate(async({mode,records,maskedRecords})=>{
      const api=await import(mode==='source'?'/src/index.ts':'/dist/scriptoscope.js'),{forkOf}=await import('/tests/resource-provenance/fixtures.mjs');const rows=[];
      for(const kind of ['no-binding','wrong-id','wrong-key','wrong-copy','wrong-alpha','missing-child-owner','masked-transparent','masked-nonbinary']){
        const selected=(kind.startsWith('masked-')?maskedRecords:records).map(r=>({...r,data:Uint8Array.from(r.data)}));
        if(kind==='masked-transparent')selected[2].data.fill(0,82,90);
        const t=await api.loadKaleidoscopeScheme(forkOf(selected));
        const face=t.manifest.chromeElements['mode5-face'],b=face.cicnBody;let theme=t,trace;
        if(kind==='no-binding')delete face.cicnBody;
        if(kind==='wrong-id')face.cicnBody={...b,requestedId:-51};
        if(kind==='wrong-key')face.cicnBody={...b,manifestKey:'mode5-face'};
        if(kind==='wrong-copy')face.cicnBody={...b,copy:'masked'};
        if(kind==='wrong-alpha'){
          const c=document.createElement('canvas');c.width=20;c.height=2;face.cicnBody={...b,asset:c.toDataURL()};
        }
        if(kind==='masked-nonbinary'){
          const c=document.createElement('canvas');c.width=20;c.height=2;const ctx=c.getContext('2d');ctx.fillStyle='rgba(0,0,0,0.5)';ctx.fillRect(0,0,20,2);const asset=c.toDataURL();
          face.cicnBody={...b,asset};t.manifest.chromeElements[b.manifestKey].asset=asset;
        }
        if(kind==='missing-child-owner')theme={base:t,baseUrl:'child',manifest:{chromeElements:{'mode5-face':face}}};
        try{await api.composeButton(theme,{label:'',minWidth:24,height:6,diagnostics:{onComplete:t=>{trace=t;}}});rows.push({kind,trace});}finally{t.dispose();}
      }
      return rows;
    },{mode,records:entries().map(r=>({...r,data:Array.from(r.data)})),maskedRecords:entries('indexed1').map(r=>({...r,data:Array.from(r.data)}))});
    expect(result.find(r=>r.kind==='masked-transparent').trace.steps.filter(s=>s.role==='body-fill').every(s=>!s.resource)).toBe(true);
    for(const row of result){expect(row.trace.steps.some(s=>s.bodyPaint)).toBe(false);expect(row.trace.steps.some(s=>s.role==='body-fill'&&s.action==='fallback')).toBe(true);}
  }catch(error){await attachCase(page,info,{mode,result},error);throw error;}
  await attachObservations(info,'mode5-reproduction',`${mode}-admission`,{mode,result});
});

for(const mode of ['source','built']) test(`${mode}: mode5 missing-body raster background approximation is explicit`,async({page,servers},info)=>{
  await openHarness(page,servers,mode);let result;
  const records=entries('missing');records[0].data=records[0].data.slice();records[0].data[82]=0x80; // only the bg sample becomes opaque
  try{
    result=await page.evaluate(async({mode,records})=>{
      const api=await import(mode==='source'?'/src/index.ts':'/dist/scriptoscope.js'),{forkOf}=await import('/tests/resource-provenance/fixtures.mjs'),rows=[];
      for(const kind of ['absent','invalid']){
        const t=await api.loadKaleidoscopeScheme(forkOf(records.map(r=>({...r,data:Uint8Array.from(r.data)}))));let trace;
        const face=t.manifest.chromeElements['mode5-face'];
        if(kind==='absent')delete face.colorSamples;
        else face.colorSamples={...face.colorSamples,background:{rgb16:[-1,65535,0],displayRgb:[0,255,0]}};
        try{const out=await api.composeButton(t,{label:'',minWidth:24,height:6,diagnostics:{onComplete:t=>{trace=t;}}});rows.push({kind,pixel:out.getPixel(2,2),trace});}finally{t.dispose();}
      }
      return rows;
    },{mode,records:records.map(r=>({...r,data:Array.from(r.data)}))});
    for(const row of result){expect(row.pixel).toEqual([0,255,0,255]);expect(row.trace.steps.some(s=>s.action==='missing'&&s.reason==='same-owner-resource-absent')).toBe(true);expect(row.trace.steps.some(s=>s.action==='fallback'&&s.reason==='missing-cicn-body-background-unverified'&&s.basis==='compatibility-policy')).toBe(true);expect(row.trace.steps.some(s=>s.bodyPaint)).toBe(false);}
  }catch(error){await attachCase(page,info,{mode,result},error);throw error;}
  await attachObservations(info,'mode5-reproduction',`${mode}-missing-bg-policy`,{mode,result});
});

for(const mode of ['source','built']) test(`${mode}: concurrent mode5 same-key owners retain separate actual copied dependencies`,async({page,servers},info)=>{
  await openHarness(page,servers,mode);let result;
  try{
    result=await page.evaluate(async({mode,records})=>{
      const api=await import(mode==='source'?'/src/index.ts':'/dist/scriptoscope.js'),{forkOf}=await import('/tests/resource-provenance/fixtures.mjs');
      const themes=await Promise.all([false,true].map(mid=>{
        const r=records.map(r=>({...r,data:Uint8Array.from(r.data)}));if(mid)new DataView(r[2].data.buffer).setUint16(118,0x2121);
        return api.loadKaleidoscopeScheme(forkOf(r),{provenance:true});
      }));const traces=[],onComplete=t=>traces.push(t);
      try{
        const outputs=await Promise.all(themes.map((t,i)=>{t.baseUrl=`body-owner-${i}`;return api.composeButton(t,{label:'',minWidth:24,height:6,diagnostics:{correlationId:`body-${i}`,onComplete}});}));
        return{pixels:outputs.map(out=>out.getPixel(3,2)),traces,owners:themes.map(t=>({loadId:t.byteProvenance.loadId,payloadSha256:t.byteProvenance.resources[2].sha256,binding:t.manifest.chromeElements['mode5-face'].cicnBody}))};
      }finally{themes.forEach(t=>t.dispose());}
    },{mode,records:entries().map(r=>({...r,data:Array.from(r.data)}))});
    expect(result.pixels).toEqual([[0,255,0,255],[0,48,0,255]]);expect(new Set(result.owners.map(o=>o.loadId)).size).toBe(2);expect(new Set(result.owners.map(o=>o.payloadSha256)).size).toBe(2);
    for(const [i,owner] of result.owners.entries()){
      const trace=result.traces.find(t=>t.correlationId===`body-${i}`),paint=trace.steps.find(s=>s.bodyPaint);
      expect(paint.owner.baseUrl).toBe(`body-owner-${i}`);expect(paint.resource.byteProvenance.loadId).toBe(owner.loadId);expect(paint.bodyPaint.sourceAssetUrl).toBe(owner.binding.asset);expect(paint.bodyPaint.paintedPixels).toBe(40);
    }
  }catch(error){await attachCase(page,info,{mode,result},error);throw error;}
  await attachObservations(info,'mode5-reproduction',`${mode}-concurrent`,{mode,result});
});
