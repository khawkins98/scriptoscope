import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { compareByteProvenance } from '../resource-provenance/compare.mjs';
export const headerBandPins = JSON.parse(readFileSync(new URL('../decoder-fixtures/header-band-source-pins.json',import.meta.url)));
export const headerBandCaseIds = headerBandPins.cases.map(p=>p.id);
const rgbaRows = pin => pin.literalRows.map(row=>[...row].map(symbol=>symbol==='.'?[0,0,0,0]:[...pin.literalPalette[symbol],255]));
export const headerLiteralPixels = index => rgbaRows(headerBandPins.cases[index]);
function actualJoin(step,row,pin) {
  const expected={...pin.expectedSelection,baseUrl:row.owner.baseUrl};
  assert.deepEqual(compareByteProvenance(step,row.owner,pin.source,expected),{status:'passed',errors:[]},`${pin.id}: actual owning bytes`);
  assert.equal(step.resource.byteProvenance.cicnResourceIndex,expected.cicnIndex);
  assert.equal(step.resource.byteProvenance.cinfResourceIndex,expected.cinfIndex);
}
export function verifyHeaderBandRows(rows,indices) {
  assert.equal(rows.length,indices.length,'Exact finite rows only');
  return indices.map(index=>{
    const pin=headerBandPins.cases[index],matches=rows.filter(r=>r.caseId===pin.id);
    assert.equal(matches.length,1,`${pin.id}: omitted/duplicate row`);const row=matches[0];
    assert.deepEqual(row.options,pin.options,`${pin.id}: exact invocation`);
    assert.deepEqual(row.selector,pin.rowSelector,`${pin.id}: fixture predicate`);
    const selected=row.trace.steps.filter(s=>s.role==='face'&&s.action==='selected'&&s.usage===pin.expectedSelection.usage);
    assert.equal(selected.length,1);const face=selected[0];actualJoin(face,row,pin);
    if(index<2){
      assert.notEqual(row.childBaseUrl,row.owner.baseUrl);
      assert.deepEqual(row.childDeclaration,{chromeElements:{},patterns:{wrong:{sourcePpatId:0,asset:'never-decode-child.png'}}});
    }
    if(index<3){
      assert.equal(row.trace.family,'header-surface');
      assert.deepEqual(row.trace.requested,{state:pin.options.drawState===0?'inactive':'active',pressed:false,disabled:false});
      const body=row.trace.steps.filter(s=>s.role==='body-fill');assert.equal(body.length,1);
      assert.deepEqual(body[0],{role:'body-fill',requestedId:0,bodyMode:0,requestedResourceType:'ppat',basis:'compatibility-policy',usage:'admission',owner:face.owner,action:'missing',reason:'same-face-owner-pattern-unavailable'});
      const h=row.trace.headerSurface;assert.deepEqual(h.context.controlOrigin,pin.options.compositionContext.controlOrigin);
      assert.deepEqual(h.context.portOrigin,pin.options.compositionContext.portOrigin);assert.deepEqual(h.context.clip,pin.options.compositionContext.clip);
      assert.deepEqual(h.context.patternOrigin,{status:'unknown'});assert.equal(h.drawState,pin.options.drawState);assert.equal(h.kind,pin.options.kind);
      assert.deepEqual(h.requestedRect,{x:pin.options.compositionContext.controlOrigin[0],y:pin.options.compositionContext.controlOrigin[1],w:pin.options.width,h:pin.options.height});
      assert.deepEqual(h.paintRect,{...h.requestedRect,h:pin.options.height+(pin.options.kind==='list-view-header'?1:0)});
      if(index<2){
        assert.equal(row.status,'rendered');assert.deepEqual(row.size,[19,13]);assert.deepEqual(row.pixels,rgbaRows(pin),`${pin.id}: complete independent literal pixels`);
        assert.deepEqual(row.trace.outcome,{status:'themed',width:19,height:13});assert.equal(h.admission,'rendered');assert.equal(h.painted,true);
        assert.equal(h.backgroundPolicy,'raw-sample-current-display');assert.equal(h.lineSampling,'not-required');
        assert.deepEqual(h.effectiveClip,index===0?{x:10,y:20,w:19,h:13}:{x:15,y:22,w:8,h:9});
        assert.deepEqual(row.trace.steps.filter(s=>s.usage==='paint'),[{...face,usage:'paint',reason:'admitted-header-surface-paint'}]);
      }else{
        assert.equal(row.status,'unsupported');assert.equal(row.reason,'unverified-line-sampling');assert.equal(row.pixels,null);assert.equal(row.size,null);
        assert.equal(h.admission,'unsupported');assert.equal(h.reason,'unverified-line-sampling');assert.equal(h.lineSampling,'unverified');assert.equal(h.backgroundPolicy,undefined);
        assert.deepEqual(row.trace.outcome,{status:'unavailable'});assert.equal(row.sampling.status,'different');
        assert.equal(row.trace.steps.some(s=>s.usage==='paint'),false);assert.equal(row.trace.bandPaints,undefined);
      }
    }else{
      assert.equal(row.trace.family,'push-button');assert.deepEqual(row.trace.requested,{state:'active',pressed:false,disabled:false,default:false});
      assert.deepEqual(row.size,[29,17]);assert.deepEqual(row.trace.outcome,{status:'themed',width:29,height:17});
      assert.deepEqual(row.pixels,pin.literalPixels,`${pin.id}: literal sampled bands and ordinary corner`);
      const bands=row.trace.bandPaints??[],sampled=bands.filter(b=>b.policy==='sampled-companion');assert.equal(sampled.length,2);
      assert.deepEqual(sampled.map(b=>[b.region,b.branch]),[[2,'horizontal-lines'],[6,'vertical-lines']]);
      for(const b of sampled){
        assert.deepEqual(b.owner,face.owner);assert.deepEqual(b.resource,face.resource);assert.equal(b.role,'face');
        actualJoin({...b,action:'selected',usage:'paint'},row,pin);
        assert.equal(b.derived.path,'cicn-sampled/cicn-n10239-band-fixture.png');assert.equal(b.derived.model,'kaleidoscope-2.3.1-opaque-sampling-v1');assert.equal(b.derived.displayPolicy,'mac-1.8-to-2.2-high-byte');
        assert.equal(row.owner.element.manifestKey,pin.expectedSelection.manifestKey);
        assert.equal(row.owner.element.asset,face.resource.assetUrl);
        assert.equal(typeof b.derived.assetUrl,'string');assert.notEqual(b.derived.assetUrl,face.resource.assetUrl);
        assert.equal(b.derived.assetUrl,row.owner.element.sampledBandAsset.asset,`${pin.id}: actual owned companion transport`);
        assert.equal(b.derived.path,row.owner.element.sampledBandAsset.derivedPath);
      }
      assert.equal(bands.find(b=>b.region===0)?.policy,'ordinary-raster');
    }
    return pin.id;
  });
}
