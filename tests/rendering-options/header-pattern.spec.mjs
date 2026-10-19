import { createHash } from 'node:crypto';
import { test, expect, openHarness, attachObservations } from './fixtures.mjs';
import { headerPatternBytes, headerPatternRows, headerPatternListRows, headerPatternColors } from '../decoder-fixtures/header-pattern.mjs';

for (const runtime of ['source','built']) test(`${runtime}: whole-header pattern uses original Rect phase and clipped inset union`, async ({page,servers},info)=>{
  await openHarness(page,servers,runtime);
  const result=await page.evaluate(async runtime=>{
    const api=await import(runtime==='source'?'/src/index.ts':'/dist/scriptoscope.js');
    const f=await import('/tests/decoder-fixtures/header-pattern.mjs');
    const {forkOf}=await import('/tests/resource-provenance/fixtures.mjs');
    const owner=await api.loadKaleidoscopeScheme(forkOf([
      {type:'cicn',id:-9567,data:f.headerPatternFace()},
      {type:'cinf',id:-9567,data:f.headerPatternInfo()},
      {type:'ppat',id:0,name:'asymmetric',data:f.headerPatternBytes()},
    ]),{provenance:true});
    const [key,original]=Object.entries(owner.manifest.chromeElements)[0];
    const pattern=structuredClone(owner.manifest.patterns.asymmetric);
    const child={baseUrl:'wrong-child/',base:owner,manifest:{chromeElements:{},patterns:{wrong:{sourcePpatId:0,asset:'must-not-load.png'}}}};
    const context=()=>({controlOrigin:[-5,7],portOrigin:[13,-9],patternOrigin:{status:'known',offset:[1,-2]},clip:{kind:'unbounded'}});
    const options=()=>({kind:'window-header',width:11,height:9,drawState:1,compositionContext:context()});
    const rows=[];
    try {
      for(const variant of ['mode0','mode1','mode2','mode3','mode4','list-clipped','mutated-context','unknown-origin','partial-pattern','missing-bg','empty-clip','decode-error','late-band-error']) {
        const element=structuredClone(original), opts=options(); owner.manifest.chromeElements={[key]:element}; owner.manifest.patterns={asymmetric:structuredClone(pattern)};
        if(variant.startsWith('mode')) element.bodyRequest.mode=Number(variant.slice(4));
        if(variant==='list-clipped') { element.bodyRequest.mode=4; opts.kind='list-view-header'; opts.compositionContext.clip={kind:'rect',rect:{x:-3,y:9,w:7,h:5}}; }
        if(variant==='unknown-origin') opts.compositionContext.patternOrigin={status:'unknown'};
        if(variant==='partial-pattern') { const p=api.PixelBuffer.alloc(1,1); p.setPixel(0,0,255,0,0,128); owner.manifest.patterns.asymmetric.asset=api.bufferToCanvas(p).toDataURL(); }
        if(variant==='missing-bg') { delete element.colorSamples; delete element.bgAnchor; }
        if(variant==='empty-clip') opts.compositionContext.clip={kind:'rect',rect:{x:20,y:20,w:1,h:1}};
        if(variant==='decode-error') owner.manifest.patterns.asymmetric.asset='data:image/png;base64,AAAA';
        if(variant==='late-band-error') {
          element.slice.corner=3; element.samplingEquivalence.status='different'; element.samplingEquivalence.reason='opaque-display-rgb-differs';
          element.sampledBandAsset={model:'kaleidoscope-2.3.1-opaque-sampling-v1',comparison:'opaque-current-display-rgb',displayPolicy:'mac-1.8-to-2.2-high-byte',width:7,height:7,derivedPath:'cicn-sampled/fail.png',asset:'data:image/png;base64,AAAA'};
        }
        let trace,value,error;
        const pending=api.composeHeaderSurface(child,{...opts,diagnostics:{correlationId:variant,onComplete:t=>{trace=t;}}});
        if(variant==='mutated-context') { opts.compositionContext.controlOrigin[0]=99; opts.compositionContext.patternOrigin.offset[0]=99; }
        try { value=await pending; } catch(e) { error=String(e); }
        rows.push({variant,status:value?.status,reason:value?.reason,error,trace,pixels:value?.status==='rendered'?Array.from(value.buffer.data):null});
      }
      owner.manifest.chromeElements={[key]:structuredClone(original)}; owner.manifest.patterns={asymmetric:pattern};
      const off=await api.composeHeaderSurface(child,options());
      return {rows,off:off.status==='rendered'?Array.from(off.buffer.data):off,pattern,provenance:owner.byteProvenance};
    } finally {owner.dispose();}
  },runtime);
  const pixels=rows=>rows.flatMap(row=>[...row].flatMap(c=>headerPatternColors[c]));
  for(const row of result.rows.slice(0,5)) {
    expect(row.status).toBe('rendered'); expect(row.pixels,row.variant).toEqual(pixels(headerPatternRows[Number(row.variant.slice(4))]));
    const step=row.trace.steps.find(s=>s.role==='body-fill'&&s.usage==='paint');
    expect(step).toMatchObject({action:'selected',reason:'completed-header-pattern-inset-union',owner:{baseUrl:'',chainDepth:1},resource:{type:'ppat',signedId:0,manifestKey:'asymmetric',assetUrl:result.pattern.asset,byteProvenance:{loadId:result.provenance.loadId,ppatResourceIndex:2}}});
    expect(row.trace.headerSurface.patternBody.paintedPixels).toBe(31);
    expect(row.trace.headerSurface.backgroundPolicy).toBeUndefined();
  }
  expect(result.provenance.resources[2]).toMatchObject({type:'ppat',signedId:0,sha256:createHash('sha256').update(headerPatternBytes()).digest('hex')});
  expect(result.rows[5].pixels).toEqual(pixels(headerPatternListRows));
  expect(result.rows[5].trace.headerSurface).toMatchObject({paintRect:{x:-5,y:7,w:11,h:10},patternBody:{phase:[-10,-12],paintedPixels:33}});
  expect(result.rows[6].pixels).toEqual(pixels(headerPatternRows[0]));
  for(const [index,reason] of [[7,'unknown-pattern-origin'],[8,'nonopaque-pattern']]) {
    expect(result.rows[index]).toMatchObject({status:'unsupported',reason});
    expect(result.rows[index].trace.steps.some(s=>s.usage==='paint')).toBe(false);
  }
  expect(result.rows[9].pixels).toEqual(pixels(headerPatternRows[0]));
  expect(result.rows[10].trace.headerSurface.painted).toBe(false);
  expect(result.rows[10].trace.steps.some(s=>s.usage==='paint')).toBe(false);
  for(const row of result.rows.slice(11)) { expect(row.error).toBeTruthy(); expect(row.trace.steps.some(s=>s.usage==='paint')).toBe(false); expect(row.trace.headerSurface.admission).toBe('error'); }
  expect(result.off).toEqual(pixels(headerPatternRows[0]));
  await attachObservations(info,'header-pattern',runtime,{runtime,result,limits:'Synthetic direct full-color arithmetic under declared origin/clip; no historical provider/cache/device or mode5 claim'});
});
