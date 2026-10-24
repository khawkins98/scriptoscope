import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {forkOf} from '../resource-provenance/fixtures.mjs';
export const iconPins=JSON.parse(readFileSync(new URL('../decoder-fixtures/checkable-icon-pins.json',import.meta.url)));
export const iconCaseIds=iconPins.cases.map(p=>p.id);
export const iconRequirement='selection.conditional-checkable-icon';
const sha=b=>createHash('sha256').update(Uint8Array.from(b)).digest('hex');
export const iconLiteralPlane=p=>Array.from({length:256},(_,i)=>[...(i%16===p.stripeX?[0,0,0]:[255,255,255]),255]).flat();
// Reconstruct the owned input declaration, not renderer output. Source selection
// assumptions are explicit; matching public options does not prove native flags.
export function iconFixtureEntries(p){
 const entries=[];
 iconPins.table[p.kind].flat().forEach((id,index)=>{
  const data=new Uint8Array(128);for(let y=0;y<16;y++)data[y*8+(index>>1)]|=index%2?15:240;
  entries.push({type:'ics4',id,data},{type:'ics#',id,data:new Uint8Array(64).fill(255)});
 });
 if(p.scenario==='missing-mask')entries.splice(entries.findIndex(e=>e.type==='ics#'&&e.id===iconPins.table[p.kind][p.options.disabled?1:0][2]),1);
 return entries;
}
export function verifyIconFixtures(root){
 assert.equal(sha(readFileSync(resolve(root,iconPins.forkBuilder.path))),iconPins.forkBuilder.sha256);
 assert.deepEqual(iconPins.table,{checkbox:[[-10236,-10235,-10234],[-10240,-10239,-10238],[-10232,-10231,-10230]],radio:[[-10220,-10219,-10218],[-10224,-10223,-10222],[-10216,-10215,-10214]]},'pinned source IDs, including pressed distractors');
 for(const p of iconPins.cases){
  const entries=iconFixtureEntries(p),bytes=forkOf(entries),a=p.sourceAssumptions;
  assert.equal(sha(bytes),p.definition.forkSha256);assert.equal(bytes.length,p.definition.forkByteLength);
  assert.deepEqual(entries.map((r,i)=>({type:r.type,id:r.id,resourceIndex:i,byteLength:r.data.length,sha256:sha(r.data)})),p.definition.resources);
  assert.deepEqual(a,{kind:p.kind==='checkbox'?0:1,tier:p.options.disabled?2:0,value:p.scenario==='off'?0:p.scenario==='checked'?1:2,maskLookup:'declared-complete-same-fork'});
  const requested=iconPins.table[p.kind][a.tier===2?1:0][a.value],missing=!entries.some(e=>e.type==='ics#'&&e.id===requested);
  const selected=iconPins.table[p.kind][a.tier===2?1:0][a.value>=2&&missing?1:a.value];
  assert.equal(p.expectedId,selected,'conditional table/NULL-mask selection');
  assert.equal(p.stripeX,iconPins.table[p.kind].flat().indexOf(selected),'literal stripe slot matches selected owned payload');
  assert.equal(entries[p.definition.selectedIndex].id,selected);assert.equal(entries[p.definition.maskIndex].id,selected);
  assert.equal(sha(iconLiteralPlane(p)),p.pixelSha256);
 }
}
export function validateIconCase(c,input){
 const p=iconPins.cases.find(p=>p.id===c.id);assert(p,'unknown icon case');
 assert.equal(c.mode,'direct');assert.equal(c.family,p.kind);assert.deepEqual(c.options,p.options);
 assert.deepEqual(c.inputs,[p.inputId]);assert.deepEqual(c.baseInputs,[]);
 assert.equal(input.kind,'synthetic');assert.deepEqual(input.definition,{...p.definition,sourceAssumptions:p.sourceAssumptions},'exact owned input and conditional native assumptions');
}
export function verifyIconRows(rows,{presentation,eightBitCompanions=false}={}){
 for(const p of iconPins.cases){
  // Original pinned ics4 input/plane remains unchanged. The public engine's
  // colour-port probe adds independent same-owner ics8 (CB18), never ics4 substitution.
  const entries=iconFixtureEntries(p);
  if(eightBitCompanions)iconPins.table[p.kind].flat().forEach((id,index)=>{const data=new Uint8Array(256);for(let y=0;y<16;y++)data[y*16+index]=255;entries.push({type:'ics8',id,data});});
  const fork=eightBitCompanions?forkOf(entries):null;
  const resources=eightBitCompanions?entries.map((e,i)=>({type:e.type,id:e.id,resourceIndex:i,byteLength:e.data.length,sha256:sha(e.data)})):p.definition.resources;
  const selectedIndex=eightBitCompanions?entries.findIndex(e=>e.type==='ics8'&&e.id===p.expectedId):p.definition.selectedIndex;
  const forkSha=fork?sha(fork):p.definition.forkSha256,forkLength=fork?.length??p.definition.forkByteLength;
  const matches=rows.filter(r=>r.kind===p.kind&&r.disabled===p.options.disabled&&r.scenario===p.scenario);
  assert.equal(matches.length,1,`${p.id}: missing/duplicate invocation`);const r=matches[0];
  assert.equal(r.hasInspector,true);assert.equal(r.hasMaskCensus,true);
  assert.deepEqual(r.options,p.options);assert.deepEqual(r.baseInputs,[],'same-fork standalone');
  assert.equal(r.inputSha256,forkSha);assert.equal(sha(r.fork),forkSha);
  // The observer does not include ics4/ics# per-occurrence records. The actual
  // loaded whole-fork hash binds this complete owned input list; the inspector
  // supplies the actual selected color and mask occurrence indices.
  assert.equal(r.provenance.fork.sha256,forkSha);assert.equal(r.provenance.fork.byteLength,forkLength);
  assert.deepEqual(r.resources.map(e=>({type:e.type,id:e.id,resourceIndex:e.index,byteLength:e.bytes.length,sha256:sha(e.bytes)})),resources,'whole declared fork and exact occurrences');
  const census=resources.filter(e=>e.type==='ics#').map(e=>({id:e.id,resourceIndex:e.resourceIndex,byteLength:e.byteLength}));
  assert.deepEqual(r.maskResources,census,'complete loaded census, including absent requested mixed mask');
  const literal=iconLiteralPlane(p),plane=presentation?presentation({width:p.size[0],height:p.size[1],rgba:literal},'icon'):{width:p.size[0],height:p.size[1],rgba:literal};
  assert.deepEqual(r.size,[plane.width,plane.height]);assert.deepEqual(r.pixels,plane.rgba,'complete owned stripe plus declared full allocation, not decoder/transfer certification');
  if(eightBitCompanions)assert(r.calls.length>0);else assert.equal(r.calls.length,1);assert.equal(r.selected.length,1);const selected=r.selected[0];
  assert.deepEqual({id:selected.id,type:selected.type,size:selected.size,depth:selected.depth,masked:selected.masked,resourceIndex:selected.resourceIndex},{id:p.expectedId,type:eightBitCompanions?'ics8':'ics4',size:16,depth:eightBitCompanions?8:4,masked:true,resourceIndex:selectedIndex});
  if(eightBitCompanions){assert(r.calls.includes(selected.unmaskedUrl),'actual consumed colour plane decoded');assert(r.calls.every(url=>r.index.some(e=>e.type==='ics8'&&e.unmaskedUrl===url)),'every eager decode belongs to this same-fork ics8 census');assert.equal(r.trace.resolved.filter(e=>e.type==='ics8'&&e.found).length,1);assert.equal(r.trace.resolved.find(e=>e.type==='ics8'&&e.found).id,p.expectedId);}else assert.equal(r.calls[0],selected.url,'actual decoded URL');
  const actualIndex=r.index.filter(e=>e.url===selected.url&&e.resourceIndex===selected.resourceIndex);
  assert.equal(actualIndex.length,1,'actual loaded color index');assert.deepEqual(actualIndex[0],selected);
  assert.equal(r.selectedPayloadSha256,resources[selectedIndex].sha256);
  const mask=r.maskResources.filter(e=>e.id===p.expectedId);assert.equal(mask.length,1);assert.equal(mask[0].resourceIndex,p.definition.maskIndex);
 }
 return iconCaseIds;
}
