// Independent fixed literals and finite admission assertions. No runtime imports.
import assert from 'node:assert/strict';
const red=[255,0,0,255],gray=[48,48,48,255],clear=[0,0,0,0];
const scalarReject=['unsafePresent','noProofPresent','emptyAsset','wrongAssetType','nullAsset','symbolAsset','objectAsset','pathSymbol','badComparison','badPathType'];
// Frozen whole 29x17 planes, derived from the fixed raw 7x7 c3/s1 input
// and public qd-primitives E1-E3 / solid inset-union contracts, before execution.
// R = ordinary ctFlags raster red; G = RGB16 0x2121 -> display48;
// . = untouched transparent RGBA (including RGB zero), never a don't-care.
// Body: [3,26)x[1,16) union [1,28)x[3,14). Opaque source mask:
// (0,0) corner, (3,0) top, (0,3) left; all other source bits clear.
// Thus only TL red, top [3,26)x{0}, left {0}x[3,14) survive as border.
export const sampledWholePlaneRows=Object.freeze({
 admitted:Object.freeze([
  'R..GGGGGGGGGGGGGGGGGGGGGGG...',
  '...GGGGGGGGGGGGGGGGGGGGGGG...',
  '...GGGGGGGGGGGGGGGGGGGGGGG...',
  'GGGGGGGGGGGGGGGGGGGGGGGGGGGG.',
  'GGGGGGGGGGGGGGGGGGGGGGGGGGGG.',
  'GGGGGGGGGGGGGGGGGGGGGGGGGGGG.',
  'GGGGGGGGGGGGGGGGGGGGGGGGGGGG.',
  'GGGGGGGGGGGGGGGGGGGGGGGGGGGG.',
  'GGGGGGGGGGGGGGGGGGGGGGGGGGGG.',
  'GGGGGGGGGGGGGGGGGGGGGGGGGGGG.',
  'GGGGGGGGGGGGGGGGGGGGGGGGGGGG.',
  'GGGGGGGGGGGGGGGGGGGGGGGGGGGG.',
  'GGGGGGGGGGGGGGGGGGGGGGGGGGGG.',
  'GGGGGGGGGGGGGGGGGGGGGGGGGGGG.',
  '...GGGGGGGGGGGGGGGGGGGGGGG...',
  '...GGGGGGGGGGGGGGGGGGGGGGG...',
  '.............................',
 ]),
 fallback:Object.freeze([
  'R..RRRRRRRRRRRRRRRRRRRRRRR...',
  '...GGGGGGGGGGGGGGGGGGGGGGG...',
  '...GGGGGGGGGGGGGGGGGGGGGGG...',
  'RGGGGGGGGGGGGGGGGGGGGGGGGGGG.',
  'RGGGGGGGGGGGGGGGGGGGGGGGGGGG.',
  'RGGGGGGGGGGGGGGGGGGGGGGGGGGG.',
  'RGGGGGGGGGGGGGGGGGGGGGGGGGGG.',
  'RGGGGGGGGGGGGGGGGGGGGGGGGGGG.',
  'RGGGGGGGGGGGGGGGGGGGGGGGGGGG.',
  'RGGGGGGGGGGGGGGGGGGGGGGGGGGG.',
  'RGGGGGGGGGGGGGGGGGGGGGGGGGGG.',
  'RGGGGGGGGGGGGGGGGGGGGGGGGGGG.',
  'RGGGGGGGGGGGGGGGGGGGGGGGGGGG.',
  'RGGGGGGGGGGGGGGGGGGGGGGGGGGG.',
  '...GGGGGGGGGGGGGGGGGGGGGGG...',
  '...GGGGGGGGGGGGGGGGGGGGGGG...',
  '.............................',
 ]),
 equivalent:Object.freeze([
  'R..RRRRRRRRRRRRRRRRRRRRRRR...',
  '...RRRRRRRRRRRRRRRRRRRRRRR...',
  '...RRRRRRRRRRRRRRRRRRRRRRR...',
  'RRRRRRRRRRRRRRRRRRRRRRRRRRRR.',
  'RRRRRRRRRRRRRRRRRRRRRRRRRRRR.',
  'RRRRRRRRRRRRRRRRRRRRRRRRRRRR.',
  'RRRRRRRRRRRRRRRRRRRRRRRRRRRR.',
  'RRRRRRRRRRRRRRRRRRRRRRRRRRRR.',
  'RRRRRRRRRRRRRRRRRRRRRRRRRRRR.',
  'RRRRRRRRRRRRRRRRRRRRRRRRRRRR.',
  'RRRRRRRRRRRRRRRRRRRRRRRRRRRR.',
  'RRRRRRRRRRRRRRRRRRRRRRRRRRRR.',
  'RRRRRRRRRRRRRRRRRRRRRRRRRRRR.',
  'RRRRRRRRRRRRRRRRRRRRRRRRRRRR.',
  '...RRRRRRRRRRRRRRRRRRRRRRR...',
  '...RRRRRRRRRRRRRRRRRRRRRRR...',
  '.............................',
 ]),
 transparent:Object.freeze([
  '.............................',
  '...GGGGGGGGGGGGGGGGGGGGGGG...',
  '...GGGGGGGGGGGGGGGGGGGGGGG...',
  '.GGGGGGGGGGGGGGGGGGGGGGGGGGG.',
  '.GGGGGGGGGGGGGGGGGGGGGGGGGGG.',
  '.GGGGGGGGGGGGGGGGGGGGGGGGGGG.',
  '.GGGGGGGGGGGGGGGGGGGGGGGGGGG.',
  '.GGGGGGGGGGGGGGGGGGGGGGGGGGG.',
  '.GGGGGGGGGGGGGGGGGGGGGGGGGGG.',
  '.GGGGGGGGGGGGGGGGGGGGGGGGGGG.',
  '.GGGGGGGGGGGGGGGGGGGGGGGGGGG.',
  '.GGGGGGGGGGGGGGGGGGGGGGGGGGG.',
  '.GGGGGGGGGGGGGGGGGGGGGGGGGGG.',
  '.GGGGGGGGGGGGGGGGGGGGGGGGGGG.',
  '...GGGGGGGGGGGGGGGGGGGGGGG...',
  '...GGGGGGGGGGGGGGGGGGGGGGG...',
  '.............................',
 ]),
});
const wholePalette={R:red,G:gray,'.':clear};
export function expectedSampledWholePlane(kind) {
 const plane=kind==='transparent'?'transparent':kind==='equivalent'?'equivalent':['valid','selected-base'].includes(kind)?'admitted':'fallback';
 return sampledWholePlaneRows[plane].flatMap(row=>[...row].flatMap(pixel=>wholePalette[pixel]));
}
export function verifySampledWholePlane(row) {
 const name=`sampled whole-plane RGBA ${row.kind}/observed=${row.observed}`;
 if(row.kind==='decodeError'){assert.equal(row.rgba,null,`${name}: rejected transport has no output`);return;}
 assert.deepEqual(row.size,[29,17],`${name}: exact allocation`);
 assert.deepEqual(row.rgba,expectedSampledWholePlane(row.kind),`${name}: exact complete literal plane`);
}
// Kept separately so an off-probe mutation can explicitly prove the three
// original point checks still pass on the very same corrupted observation.
export function verifySampledPointProbes(row) {
 const name=`sampled scalar/proof admission ${row.kind}/observed=${row.observed}`;
 const transparent=row.kind==='transparent',equivalent=row.kind==='equivalent',valid=['valid','selected-base'].includes(row.kind);
 assert.deepEqual(row.band,transparent?clear:valid?gray:red,`${name}: independently fixed expanded band`);
 assert.deepEqual(row.corner,transparent?clear:red,`${name}: ordinary source corner`);
 assert.deepEqual(row.hole,equivalent?red:gray,`${name}: raw body survives mask hole`);
}
export function verifySampledAdmission(row) {
 const name=`sampled scalar/proof admission ${row.kind}/observed=${row.observed}`;
 assert.equal(row.count,1,`${name}: callback exactly once`);
 if(row.kind==='decodeError'){
  assert.ok(row.error&&row.error.name!=='TypeError',`${name}: admitted valid transport decode error must reject`);
  assert.equal(row.trace.outcome.status,'error');assert.equal(row.size,null);
  assert.ok(!row.trace.bandPaints?.some(b=>b.derived),`${name}: failed decode has no completed derived contribution`);
  assert.ok(row.calls.includes('data:image/png;base64,AAAA'),`${name}: decode was actually attempted`);
  verifySampledWholePlane(row);return;
 }
 assert.equal(row.error,undefined,`${name}: optional evidence must retain ordinary fallback`);
 assert.equal(row.trace.outcome.status,'themed');assert.deepEqual(row.size,[29,17]);
 assert.equal(row.coercions,0,`${name}: malformed scalar fields must not be coerced`);
 const transparent=row.kind==='transparent',equivalent=row.kind==='equivalent',valid=['valid','selected-base'].includes(row.kind);
 verifySampledPointProbes(row);
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
 verifySampledWholePlane(row);
}
