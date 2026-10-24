// Additive invariant: cinf lookup stays on the caller chain; body lookup is face-owned.
import assert from 'node:assert/strict';
import {entries,faceInfo,literalCicn} from '../../decoder-fixtures/mode5.mjs';
import {forkOf} from '../../resource-provenance/fixtures.mjs';
import {ordinaryCase} from './body-completion-fixtures.mjs';
export function metadataOwnerCase(){
 const icon=(rows,palette)=>literalCicn({rows,maskRows:Array(2).fill('11111111111111111111'),depth:8,palette});
 const base=[entries()[0],{type:'cinf',id:-10239,data:faceInfo(-51)},{type:'cicn',id:-51,name:'base-default-body',data:icon(['YYYYYYYYYYYYYYYYYYYY','BBBBBBBBBBBBBBBBBBBB'],['Y','B'])},{type:'cicn',id:-52,name:'caller-requested-owned-body',data:icon(['CCCCCCCCCCCCCCCCCCCC','WWWWWWWWWWWWWWWWWWWW'],['C','W'])}];
 const callerInfo={type:'cinf',id:-10239,data:faceInfo(-52)},child=[callerInfo,{type:'cicn',id:-52,name:'foreign-requested-body',data:icon(Array(2).fill('MMMMMMMMMMMMMMMMMMMM'),['M'])}];
 const rows=['........................','........................','..CCCCCCCCCCCCCCCCCCCC..','..WWWWWWWWWWWWWWWWWWWW..','........................','........................'],colors={'.':[0,0,0,0],C:[0,255,255,255],W:[255,255,255,255]};
 return{id:'caller-cinf-face-owner-body',baseFork:Array.from(forkOf(base)),childFork:Array.from(forkOf(child)),joinedFork:Array.from(forkOf(base.map((r,i)=>i===1?callerInfo:r))),options:ordinaryCase().options,baseRgba:ordinaryCase().rgba,expectedRgba:rows.flatMap(r=>[...r].flatMap(c=>colors[c]))};
}
export async function observeMetadataOwner({apiUrl,fixture:c,mode}){
 const api=await import(apiUrl),capture=async(theme,traced)=>{const state={calls:0};try{const out=await api.composeButton(theme,{...c.options,...(traced?{diagnostics:{onComplete:t=>{state.calls++;state.trace=JSON.parse(JSON.stringify(t));}}}:{})});return{...state,size:out?[out.width,out.height]:null,rgba:out?Array.from(out.data):null};}catch(e){return{...state,error:{name:e.name,message:e.message}};}};
 const rows=[];for(const traced of [true,false]){const base=await api.loadKaleidoscopeScheme(Uint8Array.from(c.baseFork),traced?{provenance:true}:{}),joined=await api.loadKaleidoscopeScheme(Uint8Array.from(c.joinedFork),traced?{provenance:true}:{}),child=await api.loadKaleidoscopeScheme(Uint8Array.from(c.childFork),traced?{provenance:true}:{});base.baseUrl='metadata-actual-face-owner';child.baseUrl='metadata-caller';try{
 const directBase=await capture(base,traced),directJoined=await capture(joined,traced);child.base=base;const inherited=await capture(child,traced);rows.push({mode,traced,directBase,directJoined,inherited,owner:{baseUrl:base.baseUrl,elements:base.manifest.chromeElements,provenance:base.byteProvenance},child:{baseUrl:child.baseUrl}});
 }finally{delete child.base;child.dispose();joined.dispose();base.dispose();}}return rows;
}
export function evaluateMetadataOwner(rows,c){
 for(const r of rows)assert.equal(r.owner.elements['caller-requested-owned-body'].iconBlit,undefined,'frozen selected target has no opaque/depth declaration');
 for(const r of rows){for(const [key,rgba]of [['directBase',c.baseRgba],['directJoined',c.expectedRgba]]){const p=r[key];assert.equal(p.error,undefined,`${key}: valid raw metadata control`);assert.deepEqual(p.size,[24,6]);assert.deepEqual(p.rgba,rgba,`${key}: independent complete metadata-specific literal`);assert.ok(p.rgba.some((v,i)=>i%4===3&&v));}}
 const failures=[],passed=[];for(const r of rows){const id=`caller-cinf-face-owner-body/${r.traced?'traced':'plain'}`;try{const i=r.inherited;assert.equal(i.error,undefined,`${id}: independently valid selected caller metadata`);assert.deepEqual(i.size,[24,6]);assert.deepEqual(i.rgba,c.expectedRgba,`${id}: caller-cinf-request-plus-face-owned-body-required`);
 if(r.traced){assert.equal(i.calls,1);const metadata=i.trace.steps.filter(s=>s.usage==='admission'&&s.action==='selected'&&s.requestedId===-10239&&s.reason.startsWith('engine:')&&s.reason.includes(':cinf:'));assert.equal(metadata.length,1,'exact available ordinary cinf lookup observation');assert.deepEqual(metadata[0].owner,{baseUrl:r.child.baseUrl,chainDepth:0});const s=i.trace.steps.find(s=>s.role==='body-fill'&&s.usage==='paint'&&s.action==='selected');assert.equal(s.requestedId,-52);assert.equal(s.resource.type,'cicn');assert.equal(s.resource.signedId,-52);assert.equal(s.resource.manifestKey,'caller-requested-owned-body');assert.deepEqual(s.owner,{baseUrl:r.owner.baseUrl,chainDepth:1});assert.equal(s.resource.byteProvenance.cicnResourceIndex,3);assert.equal(s.resource.byteProvenance.loadId,r.owner.provenance.loadId);assert.equal(s.resource.consumedCinf,undefined,'ordinary static pairing cannot invent consumed-cinf identity');assert.equal(s.bodyPaint?.branch,'masked-copy');assert.equal(s.bodyPaint.paintedPixels,40);assert.equal(s.bodyPaint.sourceAssetUrl,r.owner.elements['caller-requested-owned-body'].asset);assert.deepEqual(s.bodyPaint.sourceRect,{x:0,y:0,w:20,h:2});assert.deepEqual(s.bodyPaint.destinationRect,{x:2,y:2,w:20,h:2});}
 passed.push(id);}catch(e){failures.push({id,message:e.message});}}
 return{positiveControls:'passed',passed,failures};
}
export function assertMetadataOwner(rows,c){const result=evaluateMetadataOwner(rows,c);assert.equal(result.failures.length,0,JSON.stringify(result.failures));return result;}
