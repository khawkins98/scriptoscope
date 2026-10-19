import { createHash } from 'node:crypto';
import { test, expect, openHarness, attachObservations } from './fixtures.mjs';
import { headerCollisionSampledRows, headerSamplingCollisionIcon } from '../decoder-fixtures/header-surface.mjs';

for (const mode of ['source', 'built']) test(`${mode}: whole header consumes owned sampled lines with strict missing-data boundaries`, async ({ page, servers }, info) => {
  await openHarness(page, servers, mode);
  const result = await page.evaluate(async mode => {
    const api = await import(mode === 'source' ? '/src/index.ts' : '/dist/scriptoscope.js');
    const { forkOf } = await import('/tests/resource-provenance/fixtures.mjs');
    const f = await import('/tests/decoder-fixtures/header-surface.mjs');
    const b = await import('/tests/decoder-fixtures/sampled-bands.mjs');
    const cinf = f.headerSurfaceInfo(); cinf[0] = 3; cinf[2] = 1;
    const owner = await api.loadKaleidoscopeScheme(forkOf([{type:'cicn',id:-9567,data:f.headerSamplingCollisionIcon()}, {type:'cinf',id:-9567,data:cinf}]), {provenance:true});
    const [key, element] = Object.entries(owner.manifest.chromeElements)[0];
    const original = structuredClone(element);
    const source = await api.loadCicnBuffer(element.asset), companion = await api.loadCicnBuffer(element.sampledBandAsset.asset);
    const changedMask = new api.PixelBuffer(companion.width, companion.height, new Uint8ClampedArray(companion.data)); changedMask.setPixel(3,0,48,48,48,0);
    const wrongSize = api.PixelBuffer.alloc(1,1);
    const child = {baseUrl:'wrong-child/',base:owner,manifest:{chromeElements:{},patterns:{}}};
    const opts = {kind:'window-header',width:11,height:16,drawState:1,compositionContext:{controlOrigin:[0,0],portOrigin:[0,0],patternOrigin:{status:'unknown'},clip:{kind:'unbounded'}}};
    const rows = [];
    try {
      for (const kind of ['actual','missing','wrong-policy','wrong-dimensions','wrong-model','mask-mismatch','decoded-size','decode-error','empty-clip','clipped']) {
        const el = structuredClone(original); owner.manifest.chromeElements = {[key]:el}; const options = structuredClone(opts);
        if (kind === 'missing') delete el.sampledBandAsset;
        if (kind === 'wrong-policy') el.sampledBandAsset.displayPolicy = 'other-device';
        if (kind === 'wrong-dimensions') el.sampledBandAsset.width = 8;
        if (kind === 'wrong-model') el.sampledBandAsset.model = 'other-model';
        if (kind === 'mask-mismatch') el.sampledBandAsset.asset = api.bufferToCanvas(changedMask).toDataURL();
        if (kind === 'decoded-size') el.sampledBandAsset.asset = api.bufferToCanvas(wrongSize).toDataURL();
        if (kind === 'decode-error') el.sampledBandAsset.asset = 'data:image/png;base64,AAAA';
        if (kind === 'empty-clip') options.compositionContext.clip = {kind:'rect',rect:{x:30,y:30,w:1,h:1}};
        if (kind === 'clipped') options.compositionContext.clip = {kind:'rect',rect:{x:4,y:0,w:2,h:2}};
        let trace, value, error;
        try { value = await api.composeHeaderSurface(child,{...options,diagnostics:{correlationId:kind,onComplete:t=>{trace=t;}}}); } catch(e) { error = String(e); }
        rows.push({kind,status:value?.status,reason:value?.reason,error,trace,pixels:value?.status==='rendered'?Array.from({length:value.buffer.height},(_,y)=>Array.from({length:value.buffer.width},(_,x)=>value.buffer.getPixel(x,y))):null});
      }
      // Same serialized collision palette, now with an opaque corner: ordinary
      // CopyMask remains red, only the expanded lines consume sampled gray.
      const cornerOwner = await api.loadKaleidoscopeScheme(forkOf([{type:'cicn',id:-9567,data:b.sampledBandIcon()}, {type:'cinf',id:-9567,data:cinf}]));
      let corner;
      try { const value = await api.composeHeaderSurface(cornerOwner,opts); corner = value.status === 'rendered' ? [[0,0],[4,0],[0,4]].map(at=>value.buffer.getPixel(...at)) : value; }
      finally { cornerOwner.dispose(); }
      return {rows,corner,sourcePixels:[[3,0],[0,3]].map(at=>source.getPixel(...at)),element:original,provenance:owner.byteProvenance};
    } finally { owner.dispose(); }
  }, mode);
  const actual = result.rows[0];
  expect(actual.status).toBe('rendered');
  expect(actual.pixels).toEqual(headerCollisionSampledRows.map(row=>[...row].map(c=>c==='.'?[0,0,0,0]:[48,48,48,255])));
  expect(result.sourcePixels).toEqual([[255,0,0,255],[255,0,0,255]]);
  expect(result.corner).toEqual([[255,0,0,255],[48,48,48,255],[48,48,48,255]]);
  expect(actual.trace.headerSurface.lineSampling).toBe('sampled-companion');
  expect(actual.trace.bandPaints.map(b=>[b.region,b.branch])).toEqual([[2,'horizontal-lines'],[6,'vertical-lines']]);
  for (const band of actual.trace.bandPaints) {
    expect(band.owner).toEqual({baseUrl:'',chainDepth:1});
    expect(band.resource.signedId).toBe(-9567);
    expect(band.resource.byteProvenance).toMatchObject({loadId:result.provenance.loadId,cicnResourceIndex:0,cinfResourceIndex:1});
    expect(band.derived.assetUrl).toBe(result.element.sampledBandAsset.asset);
    expect(band.derived.path).toBe(result.element.sampledBandAsset.derivedPath);
  }
  expect(result.provenance.resources[0].sha256).toBe(createHash('sha256').update(headerSamplingCollisionIcon()).digest('hex'));
  for (const row of result.rows.slice(1,7)) {
    expect(row.status,row.kind).toBe('unsupported'); expect(row.reason).toBe('unverified-line-sampling');
    expect(row.trace.bandPaints).toBeUndefined(); expect(row.trace.steps.some(s=>s.usage==='paint')).toBe(false);
  }
  const failed=result.rows[7]; expect(failed.error).toBeTruthy(); expect(failed.trace.outcome.status).toBe('error'); expect(failed.trace.bandPaints).toBeUndefined();
  const empty=result.rows[8]; expect(empty.status).toBe('rendered'); expect(empty.trace.headerSurface.painted).toBe(false); expect(empty.trace.bandPaints).toBeUndefined();
  const clipped=result.rows[9]; expect(clipped.pixels).toEqual(headerCollisionSampledRows.map((row,y)=>[...row].map((c,x)=>y<2&&x>=4&&x<6?[48,48,48,255]:[0,0,0,0])));
  expect(clipped.trace.bandPaints.map(b=>b.region)).toEqual([2]);
  await attachObservations(info,'header-sampled-lines',mode,{mode,result,limits:'Independent synthetic current-display literal/source proof; original device/cache/ownership, pattern/mode5 and general fidelity remain unverified'});
});
