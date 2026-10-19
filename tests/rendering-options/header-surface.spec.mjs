import { createHash } from 'node:crypto';
import { test, expect, openHarness, attachCase, attachObservations } from './fixtures.mjs';
import { headerCollisionSampledRows, headerSurfaceIcon, headerSurfaceInfo, windowHeaderRows, listViewHeaderRows,
  clippedWindowHeaderRows, clippedListViewHeaderRows, headerOverlapIcon, headerOverlapInfo,
  headerOverlapWindowRows, headerOverlapListRows, headerOverlapClippedWindowRows, headerOverlapClippedListRows } from '../decoder-fixtures/header-surface.mjs';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

for (const mode of ['source', 'built']) test(`${mode}: whole header surfaces preserve literal bands, mask overlap, raw state and list-view extension before clipping`, async ({ page, servers }, info) => {
  await openHarness(page, servers, mode); let result;
  try {
    result = await page.evaluate(async mode => {
      const api = await import(mode === 'built' ? '/dist/scriptoscope.js' : '/src/index.ts');
      const { forkOf } = await import('/tests/resource-provenance/fixtures.mjs');
      const f = await import('/tests/decoder-fixtures/header-surface.mjs');
      const rows = [];
      for (const overlap of [false, true]) {
        const bytes = forkOf([-9567, -9568].flatMap(id => [{ type: 'cicn', id, data: overlap ? f.headerOverlapIcon() : f.headerSurfaceIcon({ inactive: id === -9568 }) },
          { type: 'cinf', id, data: overlap ? f.headerOverlapInfo() : f.headerSurfaceInfo() }]));
        const owner = await api.loadKaleidoscopeScheme(bytes, { provenance: true });
        const child = { baseUrl: 'wrong-child/', base: owner, manifest: { chromeElements: {}, patterns: { wrong: { sourcePpatId: 0, asset: 'never-decode-child.png' } } } };
        try {
          for (const kind of ['window-header', 'list-view-header']) for (const drawState of [0, 1, 2, 0xffffffff]) for (const clipped of [false, true]) {
            const width = overlap ? 19 : 11, height = overlap ? 13 : 16;
            let trace;
            const value = await api.composeHeaderSurface(child, { kind, width, height, drawState,
              compositionContext: { controlOrigin: [10,20], portOrigin: [0,0], patternOrigin: { status: 'unknown' },
                clip: clipped ? { kind: 'rect', rect: overlap ? {x:15,y:22,w:8,h:9} : { x:10,y:20,w:6,h:15 } } : { kind: 'unbounded' } },
              diagnostics: { correlationId: `${overlap}/${kind}/${drawState}/${clipped}`, onComplete: t => { trace = t; } } });
            const palette = overlap ? f.headerOverlapColors : drawState === 0 ? f.headerInactiveColors : f.headerColors;
            const pixelRows = value.status === 'rendered' ? Array.from({ length: height }, (_, y) => Array.from({ length: width }, (_, x) => {
              const p = value.buffer.getPixel(x,y); if (!p[3]) return '.';
              return Object.entries(palette).find(([,rgb]) => rgb.every((v,i) => v === p[i]) && p[3] === 255)?.[0] ?? '?';
            }).join('')) : null;
            const selected = trace.steps.find(s => s.role === 'face' && s.action === 'selected');
            const el = selected && owner.manifest.chromeElements[selected.resource.manifestKey];
            rows.push({ overlap, kind, drawState, clipped, status:value.status, reason:value.reason,
              size: value.status === 'rendered' ? [value.buffer.width,value.buffer.height] : null, pixels:pixelRows, trace,
              sampling:el?.samplingEquivalence, ownerLoadId:owner.byteProvenance.loadId, ownerBaseUrl:owner.baseUrl, resources: el && owner.byteProvenance.resources.filter(r =>
                [el.byteProvenance.cicnResourceIndex,el.byteProvenance.cinfResourceIndex].includes(r.resourceIndex)) });
          }
        } finally { owner.dispose(); }
      }
      return rows;
    }, mode);
    expect(result).toHaveLength(32);
    for (const row of result) {
      expect(row.status, `${row.overlap}/${row.kind}/${row.drawState}/${row.clipped}: ${row.reason}`).toBe('rendered');
      const expected = row.overlap ? row.clipped ? row.kind === 'window-header' ? headerOverlapClippedWindowRows : headerOverlapClippedListRows : row.kind === 'window-header' ? headerOverlapWindowRows : headerOverlapListRows
        : row.clipped ? row.kind === 'window-header' ? clippedWindowHeaderRows : clippedListViewHeaderRows
        : row.kind === 'window-header' ? windowHeaderRows : listViewHeaderRows;
      expect(row.pixels).toEqual(expected);
      expect(row.size).toEqual(row.overlap ? [19,13] : [11,16]);
      const selected = row.trace.steps.find(s => s.role === 'face' && s.action === 'selected');
      const id = row.drawState === 0 ? -9568 : -9567;
      expect(selected.owner.baseUrl).toBe(row.ownerBaseUrl);
      expect(selected.resource.byteProvenance).toMatchObject({loadId:row.ownerLoadId,manifestKey:selected.resource.manifestKey,cicnResourceIndex:row.resources.find(r=>r.type==='cicn').resourceIndex,cinfResourceIndex:row.resources.find(r=>r.type==='cinf').resourceIndex});
      expect(selected).toMatchObject({ basis:'compatibility-policy', usage:'admission', requestedId:id, owner:{chainDepth:1}, resource:{signedId:id,sourceCinfId:id} });
      expect(row.trace.steps.filter(s => s.usage === 'paint')).toEqual([{ ...selected, usage:'paint', reason:'admitted-header-surface-paint' }]);
      expect(row.resources.find(r => r.type === 'cicn')).toMatchObject({ signedId:id,sha256:hash(row.overlap ? headerOverlapIcon() : headerSurfaceIcon({inactive:row.drawState===0})) });
      expect(row.resources.find(r => r.type === 'cinf')).toMatchObject({ signedId:id,sha256:hash(row.overlap ? headerOverlapInfo() : headerSurfaceInfo()) });
      expect(row.trace.headerSurface).toMatchObject({ kind:row.kind,drawState:row.drawState,admission:'rendered',
        requestedRect:{x:10,y:20,w:row.size[0],h:row.size[1]},paintRect:{x:10,y:20,w:row.size[0],h:row.size[1]+(row.kind==='list-view-header'?1:0)},
        backgroundPolicy:'raw-sample-current-display',lineSampling:row.overlap?'not-required':'equivalent-current-display' });
      expect(row.trace.steps.some(s => s.role==='body-fill' && s.action==='missing' && s.reason==='same-face-owner-pattern-unavailable')).toBe(true);
    }
    await attachObservations(info,'header-surface',`${mode}-literal`,{mode,result,evidence:'hand-encoded-input-and-literal-output',limits:'Declared display policy and current resolver ownership; no original capture, font, pattern, device-cache or recording certification'});
  } catch(error) { await attachCase(page,info,{mode,result},error); throw error; }
});

for (const mode of ['source', 'built']) test(`${mode}: header admission keeps missing evidence, unsupported bodies and nonbinary masks explicit`, async ({ page, servers }, info) => {
  await openHarness(page, servers, mode); let result;
  try {
    result = await page.evaluate(async mode => {
      const api = await import(mode === 'built' ? '/dist/scriptoscope.js' : '/src/index.ts');
      const { forkOf } = await import('/tests/resource-provenance/fixtures.mjs');
      const f = await import('/tests/decoder-fixtures/header-surface.mjs');
      const owner = await api.loadKaleidoscopeScheme(forkOf([{type:'cicn',id:-9567,data:f.headerSurfaceIcon()},{type:'cinf',id:-9567,data:f.headerSurfaceInfo()}]));
      const key=Object.keys(owner.manifest.chromeElements)[0], initial=structuredClone(owner.manifest.chromeElements[key]);
      const green=api.PixelBuffer.alloc(1,1); green.setPixel(0,0,0,255,0,255); const pattern=api.bufferToCanvas(green).toDataURL();
      const source = await api.loadCicnBuffer(owner.manifest.chromeElements[key].asset);
      const partial = new api.PixelBuffer(source.width,source.height,new Uint8ClampedArray(source.data)); partial.setPixel(0,0,255,0,0,128);
      const partialUrl=api.bufferToCanvas(partial).toDataURL();
      const rows=[];
      const options={kind:'window-header',width:11,height:16,drawState:1,compositionContext:{controlOrigin:[10,20],portOrigin:[3,5],patternOrigin:{status:'unknown'},clip:{kind:'unbounded'}}};
      try {
        for(const variant of ['unknown-clip','special-origin','missing-face','missing-slice','invalid-slice','missing-request','invalid-request','mode5','pattern0','pattern17','ambiguous-pattern','missing-bg','ambiguous-bg','missing-proof','different-proof','unknown-proof','wrong-model','wrong-comparison','wrong-policy','wrong-reason','wrong-width','wrong-height','unsafe-source','true-one-pixel','nonbinary']) {
          const el=structuredClone(initial); delete el.sampledBandAsset; // Exercise equivalence-only admission; companion admission has its own case.
          owner.manifest.chromeElements={[key]:el}; owner.manifest.patterns={};
          const opts=structuredClone(options);
          if(variant==='unknown-clip') opts.compositionContext.clip={kind:'unknown'};
          if(variant==='special-origin') opts.compositionContext.controlOrigin=[-1,-1];
          if(variant==='missing-face') owner.manifest.chromeElements={};
          if(variant==='missing-slice') delete el.slice;
          if(variant==='invalid-slice') el.slice.corner=2.5;
          if(variant==='missing-request') delete el.bodyRequest;
          if(variant==='invalid-request') el.bodyRequest.resourceId=32768;
          if(variant==='mode5') el.bodyRequest.mode=5;
          if(variant.startsWith('pattern')) { const id=Number(variant.slice(7)); el.bodyRequest.resourceId=id; owner.manifest.patterns={actual:{sourcePpatId:id,asset:pattern}}; }
          if(variant==='ambiguous-pattern') owner.manifest.patterns={one:{sourcePpatId:0,asset:pattern},two:{sourcePpatId:0,asset:pattern}};
          if(variant==='missing-bg') delete el.colorSamples;
          if(variant==='ambiguous-bg') el.colorSamplesUnavailableReason='ambiguous-asset-path';
          if(variant==='missing-proof') delete el.samplingEquivalence;
          if(variant==='different-proof') el.samplingEquivalence={...el.samplingEquivalence,status:'different'};
          if(variant==='unknown-proof') el.samplingEquivalence={...el.samplingEquivalence,status:'unknown'};
          if(variant==='wrong-model') el.samplingEquivalence={...el.samplingEquivalence,model:'unknown'};
          if(variant==='wrong-comparison') el.samplingEquivalence={...el.samplingEquivalence,comparison:'raw-rgb16'};
          if(variant==='wrong-policy') el.samplingEquivalence={...el.samplingEquivalence,displayPolicy:'unknown'};
          if(variant==='wrong-reason') el.samplingEquivalence={...el.samplingEquivalence,reason:'unknown'};
          if(variant==='wrong-width') el.samplingEquivalence={...el.samplingEquivalence,width:6};
          if(variant==='wrong-height') el.samplingEquivalence={...el.samplingEquivalence,height:6};
          if(variant==='true-one-pixel') {el.slice.corner=3;el.slice.tile=true;delete el.samplingEquivalence;}
          if(variant==='unsafe-source') {el.slice.corner=7;opts.width=19;opts.height=20;}
          if(variant==='nonbinary') el.asset=partialUrl;
          let trace; const value=await api.composeHeaderSurface(owner,{...opts,diagnostics:{onComplete:t=>{trace=t;}}});
          rows.push({variant,status:value.status,reason:value.reason,trace});
        }
        owner.manifest.chromeElements={[key]:structuredClone(initial)};
        owner.manifest.patterns={broken:{sourcePpatId:0,asset:'data:image/png;base64,AAAA'}};
        let errorTrace,errorText;try {await api.composeHeaderSurface(owner,{...options,diagnostics:{onComplete:t=>{errorTrace=t;throw new Error('callback-secondary');}}});}catch(e){errorText=String(e);}
        const invalid=[]; for(const patch of [{width:0},{height:1.5},{drawState:-1},{drawState:2**32},{compositionContext:null},{kind:'column'},
          {compositionContext:{...options.compositionContext,controlOrigin:[32760,20]}},
          {compositionContext:{...options.compositionContext,controlOrigin:[-32769,20]}},
          {kind:'list-view-header',height:1,compositionContext:{...options.compositionContext,controlOrigin:[0,32766]}}]) {
          try{await api.composeHeaderSurface(owner,{...options,...patch});invalid.push('accepted');}catch(e){invalid.push(e.name);}
        }
        return {rows,errorTrace,errorText,invalid};
      } finally {owner.dispose();}
    },mode);
    const expected={'unknown-clip':'unknown-clip','special-origin':'special-window-origin','missing-face':'missing-face','missing-slice':'missing-slice','invalid-slice':'invalid-slice','missing-request':'missing-body-request','invalid-request':'invalid-body-request',mode5:'cicn-body',pattern0:'pattern-body',pattern17:'pattern-body','ambiguous-pattern':'ambiguous-body-selection','missing-bg':'missing-background-sample','ambiguous-bg':'missing-background-sample','unsafe-source':'unsafe-source-geometry',nonbinary:'nonbinary-mask'};
    for(const row of result.rows) {
      expect(row.reason,row.variant).toBe(expected[row.variant]??'unverified-line-sampling');
      expect(row.status).toBe(row.variant==='missing-face'?'unavailable':'unsupported');
      expect(row.trace.headerSurface.admission).toBe(row.status);
      expect(row.trace.steps.some(s=>s.usage==='paint')).toBe(false);
      expect(row.trace.headerSurface.backgroundPolicy).toBeUndefined();
      if(['unknown-clip','special-origin'].includes(row.variant)) expect(row.trace.steps).toEqual([]);
      if(row.variant==='mode5') expect(row.trace.steps.some(s=>s.role==='body-fill')).toBe(false);
      if(row.variant.startsWith('pattern')) { const dependency=row.trace.steps.find(s=>s.role==='body-fill'&&s.action==='selected'); expect(dependency.resource.signedId).toBe(Number(row.variant.slice(7))); expect(dependency.usage).toBe('admission'); expect(dependency.reason).not.toContain('-paint'); }
    }
    expect(result.errorText).not.toContain('callback-secondary'); expect(result.errorTrace.outcome.status).toBe('error');
    expect(result.errorTrace.headerSurface.admission).toBe('error'); expect(result.errorTrace.steps.some(s=>s.usage==='paint')).toBe(false);
    expect(result.invalid).toHaveLength(9); expect(result.invalid).not.toContain('accepted');
    await attachObservations(info,'header-surface',`${mode}-admission`,{mode,result,limits:'Unsupported is explicit; metadata is caller-declared for substituted assets, not authentication'});
  }catch(error){await attachCase(page,info,{mode,result},error);throw error;}
});

for (const mode of ['source', 'built']) test(`${mode}: header diagnostics freeze actual invocations without extra decodes or legacy pixel changes`, async ({ page, servers }, info) => {
  await openHarness(page, servers, mode); let result;
  try {
    result=await page.evaluate(async mode=>{
      const api=await import(mode==='built'?'/dist/scriptoscope.js':'/src/index.ts');
      const {forkOf}=await import('/tests/resource-provenance/fixtures.mjs');
      const f=await import('/tests/decoder-fixtures/header-surface.mjs');
      const owner=await api.loadKaleidoscopeScheme(forkOf([{type:'cicn',id:-9567,data:f.headerOverlapIcon()},{type:'cinf',id:-9567,data:f.headerOverlapInfo()}]));
      const legacyOwner=await api.loadKaleidoscopeScheme(forkOf([{type:'cicn',id:-9567,data:f.headerSurfaceIcon()},{type:'cinf',id:-9567,data:f.headerSurfaceInfo()}]));
      const key=Object.keys(owner.manifest.chromeElements)[0],el=owner.manifest.chromeElements[key];
      const source=await api.loadCicnBuffer(el.asset),encoded=api.bufferToCanvas(source).toDataURL();
      const theme=suffix=>({baseUrl:location.origin,manifest:{chromeElements:{actual:{...el,asset:`${encoded}#header-${suffix}`}},patterns:{}}});
      const options=()=>({kind:'window-header',width:19,height:13,drawState:1,compositionContext:{controlOrigin:[10,20],portOrigin:[0,0],patternOrigin:{status:'unknown'},clip:{kind:'unbounded'}}});
      const decode=HTMLImageElement.prototype.decode;let decodes=0,heldResolve,release;
      const held=new Promise(resolve=>{heldResolve=resolve;}),gate=new Promise(resolve=>{release=resolve;});
      HTMLImageElement.prototype.decode=async function(){decodes++;if(this.src.endsWith('#header-held')){heldResolve();await gate;}return decode.call(this);};
      try{
        const plain=await api.composeHeaderSurface(theme('plain'),options()),plainDecodes=decodes;decodes=0;
        let observedTrace;const observed=await api.composeHeaderSurface(theme('observed'),{...options(),diagnostics:{onComplete:t=>{observedTrace=t;}}});const observedDecodes=decodes;
        const traces=[],calls={};const callback=t=>{traces.push(t);calls[t.correlationId]=(calls[t.correlationId]??0)+1;};
        const a=options();const pending=api.composeHeaderSurface(theme('held'),{...a,diagnostics:{correlationId:'held',onComplete:callback}});await held;
        a.compositionContext.controlOrigin[0]=200;a.compositionContext.clip={kind:'unknown'};
        await api.composeHeaderSurface(theme('second'),{...options(),kind:'list-view-header',diagnostics:{correlationId:'second',onComplete:callback}});
        release();await pending;
        const callbackError=new Error('header-callback');let caught,callsOnThrow=0;
        try{await api.composeHeaderSurface(theme('throws'),{...options(),diagnostics:{onComplete:()=>{callsOnThrow++;throw callbackError;}}});}catch(e){caught=e;}
        const old=await api.composeListHeader(legacyOwner,{columns:[{label:'',width:11}],height:16});
        const tokens=buffer=>Array.from({length:buffer.height},(_,y)=>Array.from({length:buffer.width},(_,x)=>{const p=buffer.getPixel(x,y);return p[3]?Object.entries(f.headerColors).find(([,rgb])=>rgb.every((v,i)=>v===p[i]))?.[0]??'?':'.';}).join(''));
        const tiny=await api.composeHeaderSurface(legacyOwner,{...options(),width:3,height:2});
        let emptyTrace;
        const empty=await api.composeHeaderSurface(owner,{...options(),compositionContext:{...options().compositionContext,clip:{kind:'rect',rect:{x:100,y:100,w:1,h:1}}},diagnostics:{onComplete:t=>{emptyTrace=t;}}});
        const nonsentinel=[];
        for(const [kind,origin] of [['window-header',[-1,0]],['list-view-header',[-1,-1]]]) {
          const value=await api.composeHeaderSurface(owner,{...options(),kind,compositionContext:{...options().compositionContext,controlOrigin:origin}});
          nonsentinel.push({kind,origin,status:value.status});
        }
        const frozen=value=>!value||typeof value!=='object'||(Object.isFrozen(value)&&Object.values(value).every(frozen));
        return{plainStatus:plain.status,observedStatus:observed.status,plainDecodes,observedDecodes,
          emptyStatus:empty.status,emptyPixels:empty.status==='rendered'&&empty.buffer.data.every(v=>v===0),emptyTrace,nonsentinel,
          same:plain.buffer.data.every((v,i)=>v===observed.buffer.data[i]),observedTrace,frozen:frozen(observedTrace)&&traces.every(frozen),traces,calls,
          callbackIdentity:caught===callbackError,callsOnThrow,oldPixels:tokens(old),tinyStatus:tiny.status,tinySize:tiny.status==='rendered'?[tiny.buffer.width,tiny.buffer.height]:null,tinyPixels:tiny.status==='rendered'?tokens(tiny.buffer):null};
      }finally{release();HTMLImageElement.prototype.decode=decode;owner.dispose();legacyOwner.dispose();}
    },mode);
    expect(result).toMatchObject({plainStatus:'rendered',observedStatus:'rendered',plainDecodes:1,observedDecodes:1,same:true,frozen:true,calls:{held:1,second:1},callbackIdentity:true,callsOnThrow:1,tinyStatus:'rendered',tinySize:[3,2],tinyPixels:['hJK','lno']});
    expect(result.emptyStatus).toBe('rendered'); expect(result.emptyPixels).toBe(true);
    expect(result.emptyTrace.headerSurface).toMatchObject({admission:'rendered',painted:false});
    expect(result.emptyTrace.headerSurface.backgroundPolicy).toBeUndefined();
    expect(result.emptyTrace.steps.some(s=>s.usage==='paint')).toBe(false);
    expect(result.emptyTrace.steps.some(s=>s.usage==='admission'&&s.role==='face'&&s.action==='selected')).toBe(true);
    expect(result.nonsentinel).toEqual([{kind:'window-header',origin:[-1,0],status:'rendered'},{kind:'list-view-header',origin:[-1,-1],status:'rendered'}]);
    expect(result.traces.map(t=>t.correlationId)).toEqual(['second','held']);
    expect(result.traces.find(t=>t.correlationId==='held').headerSurface.context.controlOrigin).toEqual([10,20]);
    expect(result.traces.find(t=>t.correlationId==='held').headerSurface.effectiveClip).toEqual({x:10,y:20,w:19,h:13});
    expect(result.oldPixels).toEqual(['.a...QQ..bc','dE.......FG','dE.......FG','dE.......FG','L.........R','L.........R','L.........R','...........','...........','...........','...........','...........','...........','hI.......JK','hI.......JK','lmBBB....no']);
    await attachObservations(info,'header-surface',`${mode}-invocation`,{mode,result,limits:'Old column pixels preserved; finite source-backed surface subset, no original captures'});
  }catch(error){await attachCase(page,info,{mode,result},error);throw error;}
});

for (const mode of ['source','built']) test(`${mode}: actual palette collisions use retained samples for both one-pixel expansion flags`,async({page,servers},info)=>{
  await openHarness(page,servers,mode);let result;
  try{
    result=await page.evaluate(async mode=>{
      const api=await import(mode==='built'?'/dist/scriptoscope.js':'/src/index.ts');
      const {forkOf}=await import('/tests/resource-provenance/fixtures.mjs');
      const f=await import('/tests/decoder-fixtures/header-surface.mjs'),rows=[];
      for(const tile of [false,true]){
        const cinf=f.headerSurfaceInfo();cinf[0]=3;cinf[2]=Number(tile);
        const owner=await api.loadKaleidoscopeScheme(forkOf([{type:'cicn',id:-9567,data:f.headerSamplingCollisionIcon()},{type:'cinf',id:-9567,data:cinf}]),{provenance:true});
        try{
          let trace;const value=await api.composeHeaderSurface(owner,{kind:'window-header',width:11,height:16,drawState:1,compositionContext:{controlOrigin:[0,0],portOrigin:[0,0],patternOrigin:{status:'unknown'},clip:{kind:'unbounded'}},diagnostics:{onComplete:t=>{trace=t;}}});
          const selected=trace.steps.find(s=>s.role==='face'&&s.action==='selected'),el=owner.manifest.chromeElements[selected.resource.manifestKey];
          const decoded=await api.loadCicnBuffer(el.asset);
          rows.push({tile,status:value.status,reason:value.reason,pixels:value.status==='rendered'?Array.from({length:value.buffer.height},(_,y)=>Array.from({length:value.buffer.width},(_,x)=>value.buffer.getPixel(x,y))):null,trace,sampling:el.samplingEquivalence,background:el.colorSamples.background,
            topSample:decoded.getPixel(3,0),leftSample:decoded.getPixel(0,3),resource:owner.byteProvenance.resources.find(r=>r.resourceIndex===selected.resource.byteProvenance.cicnResourceIndex)});
        }finally{owner.dispose();}
      }return rows;
    },mode);
    for(const row of result){
      expect(row).toMatchObject({status:'rendered',sampling:{status:'different'},background:{rgb16:[8481,8481,8481],displayRgb:[48,48,48]},topSample:[255,0,0,255],leftSample:[255,0,0,255],resource:{sha256:'ae6a14ab40e4f69489f9444084133376abe2ff5872c3f82c4fa0e56290831231'}});
      expect(row.pixels).toEqual(headerCollisionSampledRows.map(r=>[...r].map(c=>c==='.'?[0,0,0,0]:[48,48,48,255])));
      expect(row.trace.headerSurface.lineSampling).toBe('sampled-companion'); expect(row.trace.bandPaints).toHaveLength(2);
    }
    await attachObservations(info,'header-surface',`${mode}-palette-boundary`,{mode,result,limits:'Real decoder collision uses retained raw-sampler companion; no device or original ownership claim'});
  }catch(error){await attachCase(page,info,{mode,result},error);throw error;}
});
