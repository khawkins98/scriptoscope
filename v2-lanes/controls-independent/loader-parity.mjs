// Independent input fixture: typed owners, explicit [] opt-outs, exact points,
// public source/built/standalone boundary parity. Never a native oracle.
import '../../tests/helpers/registerTs.mjs';
import { forkOf } from '../../tests/resource-provenance/fixtures.mjs';
import { colorIcon,colorInfo } from '../../tests/decoder-fixtures/control-colors.mjs';
import { writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const source=await import('../../src/loadKaleidoscopeScheme.ts'),built=await import('../../dist/scriptoscope.js'),standalone=await import('../../dist/pages-loader/loadKaleidoscopeScheme.js');
const planes=Array(64).fill(255);planes[32]=127;
const rows=[],failures=[];
for(const origin of [9,-9]) {
 const bytes=forkOf([{type:'cicn',id:-10239,name:'face',data:colorIcon({origin:0})},{type:'cinf',id:-10239,data:colorInfo()},
  {type:'cicn',id:-9503,name:'check',data:colorIcon({origin})},{type:'ics#',id:-10236,data:Uint8Array.from(planes)},
  {type:'ics8',id:-10236,data:new Uint8Array(256)},{type:'ics4',id:-10236,data:new Uint8Array(128).fill(17)}]);
 const results=[];
 for(const [mode,api] of [['source',source],['built',built],['standalone',standalone]]) {
  const out=await api.loadKaleidoscopeScheme(bytes,{encodeAssets:false});
  assert.deepEqual(out.cicnResources.map(r=>[r.id,r.resourceIndex]),[[-10239,0],[-9503,2]]);
  assert.deepEqual(out.iconColorResources.map(r=>[r.type,r.id,r.resourceIndex]),[['ics8',-10236,4],['ics4',-10236,5]]);
  assert.deepEqual(out.iconMaskResources.map(r=>[r.id,r.resourceIndex]),[[-10236,3]]);
  const color=out.iconIndex.find(r=>r.type==='ics8'),opaque=out.assets.find(a=>a.path===`icons/${color.unmaskedFile}`),masked=out.assets.find(a=>a.path===`icons/${color.file}`);
  assert.equal(color.resourceIndex,4);assert.equal(masked.rgba[3],0);assert.equal(opaque.rgba[3],255);assert.ok(opaque.rgba.every((v,i)=>i%4!==3||v===255));
  assert.ok(out.manifest.chromeElements.face.engineColorSamples.points['0,0']);
  if(JSON.stringify(out.manifest.chromeElements.check.boundsOrigin)!==JSON.stringify({top:origin,left:origin}))failures.push({mode,origin,rule:'CB11 full source bounds',actual:out.manifest.chromeElements.check.boundsOrigin??null,expected:{top:origin,left:origin}});
  for(const [option,predicate] of [
   ['iconBlitCicnIds',x=>!x.assets.some(a=>a.path.startsWith('cicn-unmasked/'))],
   ['unmaskedIconIds',x=>!x.assets.some(a=>a.path.startsWith('icons/opaque-'))],
   ['engineCinfIds',x=>!x.manifest.engineCinfs],
  ]) {const opted=await api.loadKaleidoscopeScheme(bytes,{encodeAssets:false,[option]:[]});assert.ok(predicate(opted),`${mode} explicit [] ${option}`);}
  results.push({mode,manifest:out.manifest,assets:out.assets.map(a=>({path:a.path,width:a.width,height:a.height,rgba:[...a.rgba]})),census:out.cicnResources});
 }
 for(const out of results.slice(1))assert.deepEqual({...out,mode:'source'},results[0],`${out.mode} source full asset/manifest parity`);
 rows.push({origin,modes:results.map(r=>r.mode),parity:true,explicitEmptyOptions:true,typedOccurrences:true});
}
writeFileSync('/Users/khawkins/orca/worker-receipts/v2-lanes/459-controls-independent/loader-parity-data.json',JSON.stringify({rows,failures,unknown:['native glyph/device/provider equivalence']},null,2)+'\n');
console.log(JSON.stringify({rows,failures}));process.exitCode=failures.length?1:0;
