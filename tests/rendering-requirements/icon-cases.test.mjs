import test from 'node:test';import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {iconPins,iconCaseIds,iconFixtureEntries,iconLiteralPlane,verifyIconFixtures,validateIconCase,verifyIconRows} from './icon-cases.mjs';
import {forkOf} from '../resource-provenance/fixtures.mjs';
// Declared verifier inputs, not claimed browser executions. Actual source/built
// rows supply the same fields through the public loader and observed decode.
const rows=()=>iconPins.cases.map(p=>{
 const entries=iconFixtureEntries(p),url=`blob:owned-${p.id}`,selected={id:p.expectedId,type:'ics4',size:16,depth:4,masked:true,resourceIndex:p.definition.selectedIndex,url};
 return {kind:p.kind,disabled:p.options.disabled,scenario:p.scenario,options:p.options,baseInputs:[],hasInspector:true,hasMaskCensus:true,
  inputSha256:p.definition.forkSha256,fork:Array.from(forkOf(entries)),provenance:{fork:{sha256:p.definition.forkSha256,byteLength:p.definition.forkByteLength}},
  resources:entries.map((e,index)=>({type:e.type,id:e.id,index,bytes:Array.from(e.data)})),maskResources:p.definition.resources.filter(e=>e.type==='ics#').map(e=>({id:e.id,resourceIndex:e.resourceIndex,byteLength:e.byteLength})),
  size:p.size,pixels:iconLiteralPlane(p),calls:[url],selected:[selected],index:[selected],selectedPayloadSha256:p.definition.resources[p.definition.selectedIndex].sha256};
});
test('icon pins bind16 explicit source-tier/value declarations separately from modern invocation',()=>{
 const root=fileURLToPath(new URL('../../',import.meta.url));verifyIconFixtures(root);
 const first=iconPins.cases[0],saved={stripeX:first.stripeX,pixelSha256:first.pixelSha256};
 try{first.stripeX++;first.pixelSha256=createHash('sha256').update(Uint8Array.from(iconLiteralPlane(first))).digest('hex');assert.throws(()=>verifyIconFixtures(root),/literal stripe slot/);}finally{Object.assign(first,saved);}
 assert.deepEqual(verifyIconRows(rows()),iconCaseIds);assert.equal(iconCaseIds.length,16);
 for(const p of iconPins.cases){const c={id:p.id,mode:'direct',family:p.kind,options:p.options,inputs:[p.inputId],baseInputs:[]},input={kind:'synthetic',definition:{...p.definition,sourceAssumptions:p.sourceAssumptions}};validateIconCase(c,input);
  for(const mutate of[c=>c.mode='declarative',c=>c.family='push',c=>c.options.label='X',c=>c.options.disabled=!c.options.disabled,c=>c.options.mixed=!c.options.mixed,c=>c.inputs=['other'],c=>c.baseInputs=['other']]){const altered=structuredClone(c);mutate(altered);assert.throws(()=>validateIconCase(altered,input));}
  const altered=structuredClone(input);altered.definition.sourceAssumptions.tier=1;assert.throws(()=>validateIconCase(c,altered));
 }
});
test('icon verifier rejects wrong state, loaded fork, occurrence, actual URL, mask census and pixels',()=>{
 for(const mutate of[
  r=>r.options.checked=true,r=>r.baseInputs=['other'],r=>r.hasInspector=false,r=>r.hasMaskCensus=false,
  r=>r.provenance.fork.sha256='0'.repeat(64),r=>r.provenance.fork.byteLength--,r=>r.fork[0]^=1,r=>r.inputSha256='0'.repeat(64),
  r=>r.resources[0].bytes[0]^=1,r=>r.resources[0].id--,r=>r.resources[0].index++,
  r=>r.calls[0]='blob:wrong',r=>r.calls.push(r.calls[0]),r=>r.selected[0].resourceIndex=2,r=>r.selected[0].id--,
  r=>r.selected[0].type='ics8',r=>r.selected[0].depth=8,r=>r.selected[0].size=32,r=>r.selected[0].masked=false,
  r=>r.selectedPayloadSha256='0'.repeat(64),r=>r.index=[],r=>r.maskResources.shift(),r=>r.maskResources[0].byteLength=63,
  r=>r.maskResources.push(r.maskResources[0]),r=>r.maskResources[0].resourceIndex++,
  r=>r.pixels[0]^=1,r=>r.pixels.pop(),r=>r.size=[17,16],
 ]){const altered=structuredClone(rows());mutate(altered[0]);assert.throws(()=>verifyIconRows(altered));}
 assert.throws(()=>verifyIconRows(rows().slice(1)),/missing\/duplicate/);assert.throws(()=>verifyIconRows([...rows(),rows()[0]]),/missing\/duplicate/);
});
test('mixed retry requires the exact missing-mask input and never registers manual/unknown rows',()=>{
 const source=rows(),i=source.findIndex(r=>r.scenario==='missing-mask');
 for(const mutate of[
  r=>r.scenario='manual',r=>r.scenario='unknown-census',r=>r.options.mixed=false,
  r=>r.maskResources.push({id:iconPins.table[r.kind][0][2],resourceIndex:5,byteLength:64}),
  r=>r.maskResources.push({id:iconPins.table[r.kind][0][2],resourceIndex:5,byteLength:63}),
  r=>r.selected[0].id=iconPins.table[r.kind][0][2],r=>r.selected[0].id=iconPins.table[r.kind][2][1],
 ]){const altered=structuredClone(source);mutate(altered[i]);assert.throws(()=>verifyIconRows(altered));}
 assert(iconPins.cases.every(p=>['off','checked','mixed','missing-mask'].includes(p.scenario)));
});
