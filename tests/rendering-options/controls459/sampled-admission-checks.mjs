// Independent fixed literals and finite admission assertions. No runtime imports.
import assert from 'node:assert/strict';
const red=[255,0,0,255],gray=[48,48,48,255],clear=[0,0,0,0];
const scalarReject=['unsafePresent','noProofPresent','emptyAsset','wrongAssetType','nullAsset','symbolAsset','objectAsset','pathSymbol','badComparison','badPathType'];
export function verifySampledAdmission(row) {
 const name=`sampled scalar/proof admission ${row.kind}/observed=${row.observed}`;
 assert.equal(row.count,1,`${name}: callback exactly once`);
 if(row.kind==='decodeError'){
  assert.ok(row.error&&row.error.name!=='TypeError',`${name}: admitted valid transport decode error must reject`);
  assert.equal(row.trace.outcome.status,'error');assert.equal(row.size,null);
  assert.ok(!row.trace.bandPaints?.some(b=>b.derived),`${name}: failed decode has no completed derived contribution`);
  assert.ok(row.calls.includes('data:image/png;base64,AAAA'),`${name}: decode was actually attempted`);return;
 }
 assert.equal(row.error,undefined,`${name}: optional evidence must retain ordinary fallback`);
 assert.equal(row.trace.outcome.status,'themed');assert.deepEqual(row.size,[29,17]);
 assert.equal(row.coercions,0,`${name}: malformed scalar fields must not be coerced`);
 const transparent=row.kind==='transparent',equivalent=row.kind==='equivalent',valid=['valid','selected-base'].includes(row.kind);
 assert.deepEqual(row.band,transparent?clear:valid?gray:red,`${name}: independently fixed expanded band`);
 assert.deepEqual(row.corner,transparent?clear:red,`${name}: ordinary source corner`);
 assert.deepEqual(row.hole,equivalent?red:gray,`${name}: raw body survives mask hole`);
 const bands=row.trace.bandPaints??[],derived=bands.filter(b=>b.derived);
 for(const b of bands){
  assert.deepEqual(b.owner,{baseUrl:row.owner,chainDepth:row.kind==='selected-base'?1:0},`${name}: actual owner`);
  assert.equal(b.resource.type,'cicn');assert.equal(b.resource.signedId,-10239);assert.equal(b.resource.manifestKey,'face');assert.equal(b.resource.assetUrl,row.ordinary);
  if(row.observed){assert.equal(b.resource.byteProvenance.loadId,row.provenance.loadId);assert.equal(b.resource.byteProvenance.cicnResourceIndex,0);}
  else assert.equal(b.resource.byteProvenance,undefined);
 }
 if(valid){
  assert.equal(derived.length,2,`${name}: two actual expanded contributions`);
  for(const b of derived){assert.equal(b.policy,'sampled-companion');assert.deepEqual(b.derived,{path:'cicn-sampled/cicn-n10239-face.png',assetUrl:row.original,model:'kaleidoscope-2.3.1-opaque-sampling-v1',displayPolicy:'mac-1.8-to-2.2-high-byte'});}
  assert.equal(row.calls.filter(u=>u===row.original).length,1,`${name}: actual eligible transport`);
 }else{
  assert.equal(derived.length,0,`${name}: fallback cannot publish derived identity`);
  if(transparent)assert.equal(bands.length,0,`${name}: transparent source has no contributed bands`);
  if(scalarReject.includes(row.kind)||transparent||equivalent){
   assert.deepEqual([...row.calls].sort(),[row.ordinary,row.opaque].sort(),`${name}: no ineligible dependent decode`);
  }
 }
}
