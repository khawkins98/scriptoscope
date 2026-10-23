import '../helpers/registerTs.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
const { themeResourceChain }=await import('../../src/engine/resources/theme.ts');
const { notifyAssetUrlReleased }=await import('../../tools/theme-loader/assetLifecycle.js');
const { LEGACY_DISPLAY_POLICY }=await import('../../tools/theme-loader/display-profile.js');
const key={type:'cicn',id:-9503},color={type:'ics8',id:-10236},mask={type:'ics#',id:-10236};
const theme=(inspector={},chromeElements={})=>({manifest:{name:'independent',chromeElements},baseUrl:'',inspector:{iconIndex:[],...(Object.values(chromeElements).some(el=>el.cicnSource)?{cicnResources:Object.values(chromeElements).flatMap(el=>el.cicnSource?[el.cicnSource]:[])}:{}),...inspector}});
let serial=0;
function sampleElement() { const asset=`blob:independent-${serial++}`,source={id:-9503,resourceIndex:7,byteLength:100,bounds:{top:0,left:0,bottom:3,right:3}};return {cicnSource:source,asset,width:3,height:3,sourceCicnId:-9503,boundsOrigin:{left:0,top:0},byteProvenance:{loadId:'owner-A',cicnResourceIndex:7},engineColorSamples:{source,model:'kdef-2.3.1-engine-points',asset,width:3,height:3,displayPolicy:LEGACY_DISPLAY_POLICY,points:{'0,0':{rgb16:[257,258,259],displayRgb:[1,1,1]}}}}; }
async function imageEnvironment(fn) {
  const oldImage=globalThis.Image,oldDocument=globalThis.document;
  const requests=[];let pause,start,fail=false;
  globalThis.Image=class { naturalWidth=3;naturalHeight=3;set src(v){this.url=v;requests.push(v);} async decode(){start?.();if(pause)await pause;if(fail)throw Error('decode poison');}};
  globalThis.document={createElement:()=>({getContext:()=>({drawImage(){},getImageData:()=>({data:new Uint8ClampedArray(36).fill(255)})})})};
  try {await fn({requests,setPause:(p,s)=>{pause=p;start=s;},setFail:v=>{fail=v;}});}finally{globalThis.Image=oldImage;globalThis.document=oldDocument;requests.forEach(notifyAssetUrlReleased);}
}

test('resource identity: malformed/duplicate/raw undecoded cicn and color are UNKNOWN; explicit absence NULL',async()=>{
  for(const census of [[{id:-9503,resourceIndex:0,byteLength:1}],[{id:-9503,resourceIndex:-1,byteLength:0}],[{id:-9503,resourceIndex:0,byteLength:2},{id:-9503,resourceIndex:1,byteLength:2}]]) {
    const c=await themeResourceChain(theme({cicnResources:census}),[key],{checkables:true});assert.equal(c.getResource(key.type,key.id).value.status,'unknown');
  }
  for(const census of [[{type:'ics8',id:-10236,resourceIndex:3,byteLength:1}],[{type:'ics8',id:-10236,resourceIndex:3,byteLength:256},{type:'ics8',id:-10236,resourceIndex:4,byteLength:256}]]) {
    const c=await themeResourceChain(theme({iconColorResources:census}),[color],{checkables:true});assert.equal(c.getResource(color.type,color.id).value.status,'unknown');
  }
  const c=await themeResourceChain(theme({cicnResources:[],iconColorResources:[],iconMaskResources:[]}),[key,color,mask],{checkables:true});for(const r of [key,color,mask])assert.equal(c.getResource(r.type,r.id),null);
});
test('older manually declared manifest stays independent of optional census for other families',async()=>{
  const c=await themeResourceChain(theme({iconMaskPlanes:{'-10236':Array(64).fill(255)}}),[mask]);assert.equal(c.getResource(mask.type,mask.id).value.planes.length,64);
  const restricted=await themeResourceChain(theme({iconMaskPlanes:{'-10236':Array(64).fill(255)}}),[mask],{checkables:true});assert.equal(restricted.getResource(mask.type,mask.id).value.status,'unknown');
});
test('finite raw samples: exact point only; replacement asset and display-policy mismatch reject; provider snapshot immutable',async()=>imageEnvironment(async()=>{
  const el=sampleElement(),t=theme({}, {x:el});const c=await themeResourceChain(t,[key]);const source=c.getResource(key.type,key.id).value;
  assert.deepEqual(source.sampleRgb16({x:0,y:0}),[257,258,259]);assert.equal(source.sampleRgb16({x:1,y:0}),null);
  el.engineColorSamples.points['0,0'].rgb16[0]=999;assert.deepEqual(source.sampleRgb16({x:0,y:0}),[257,258,259]);
  el.asset=`blob:replacement-${serial++}`;const replacement=await themeResourceChain(t,[key]);assert.equal(replacement.getResource(key.type,key.id).value.sampleRgb16({x:0,y:0}),null);
  const other=sampleElement();other.engineColorSamples.displayPolicy='unrelated-profile';assert.equal((await themeResourceChain(theme({}, {other}),[key])).getResource(key.type,key.id).value.sampleRgb16({x:0,y:0}),null);
}));
test('finite raw samples reject an occurrence replaced at the same asset path',async()=>imageEnvironment(async()=>{
  const el=sampleElement();el.byteProvenance.cicnResourceIndex=8;
  // Existing serialized points belong to occurrence 7; the path alone cannot
  // establish source identity when occurrence 8 replaces it.
  const replacement={...el.cicnSource,resourceIndex:8};el.cicnSource=replacement;
  const c=await themeResourceChain(theme({cicnResources:[replacement]},{el}),[key],{checkables:true});
  assert.equal(c.getResource(key.type,key.id).value.sampleRgb16({x:0,y:0}),null,'stale occurrence samples must be unavailable');
}));
test('typed cicn decoded occurrence must agree with raw occurrence, not merely signed ID',async()=>imageEnvironment(async()=>{
  const el=sampleElement(); // declared decoder observer says occurrence 7
  const c=await themeResourceChain(theme({cicnResources:[{id:-9503,resourceIndex:8,byteLength:100}]},{el}),[key],{checkables:true});
  assert.equal(c.getResource(key.type,key.id).value.status,'unknown','raw occurrence 8 cannot borrow decoded occurrence 7');
}));
test('URL ownership and abort: pre-abort performs zero decodes; owner release rejects pending; unrelated release leaves it live',async()=>imageEnvironment(async({requests,setPause})=>{
  const el=sampleElement(),t=theme({}, {el}),controller=new AbortController();controller.abort();
  await assert.rejects(themeResourceChain(t,[key],{signal:controller.signal}),{name:'AbortError'});assert.deepEqual(requests,[]);
  for(const releaseOwner of [false,true]) {
    el.asset=`blob:lifetime-${serial++}`;let resume,started;const begin=new Promise(r=>{started=r;});const pause=new Promise(r=>{resume=r;});setPause(pause,started);
    const pending=themeResourceChain(t,[key],{signal:new AbortController().signal});await begin;
    notifyAssetUrlReleased(releaseOwner?el.asset:'blob:other-owner');resume();
    if(releaseOwner)await assert.rejects(pending,{name:'AbortError'});else assert.ok(await pending);
  }
}));
test('explicit empty cinfBodies prevents raw body preload; selected header otherwise adds exactly its typed dependency',async()=>imageEnvironment(async({requests})=>{
 // Two header bytes govern mode and a signed resource ID; these literals are
 // TMPL129 fields (qd-primitives B1/B4), independent of loader implementation.
 const header=Array(18).fill(0);header[3]=0;header[4]=0;header[5]=77;
 const t=theme();t.manifest.engineCinfs={'-10239':header};t.manifest.patterns={poison:{sourcePpatId:77,asset:`blob:body-${serial++}`}};
 const wanted=[{type:'cinf',id:-10239}];
 await themeResourceChain(t,wanted,{cinfBodies:[]});assert.deepEqual(requests,[],'declared environment opts out of local raw body preparation');
 const prepared=await themeResourceChain(t,wanted,{cinfBodies:[-10239,0]});assert.deepEqual(requests,[t.manifest.patterns.poison.asset]);assert.ok(prepared.getResource('ppat',77));assert.equal(prepared.getResource('cicn',77),null);
}));

test('finite samples from another provider or a copied census object stay unavailable despite equal scalar identity',async()=>imageEnvironment(async()=>{
 const el=sampleElement(),t=theme({}, {el});const chain=await themeResourceChain(t,[key]);const source=chain.getResource(key.type,key.id).value;assert.deepEqual(source.sampleRgb16({x:0,y:0}),[257,258,259]);
 t.inspector.cicnResources=[{...el.cicnSource}];assert.equal(source.sampleRgb16({x:0,y:0}),null);
 const fresh=sampleElement(),other=sampleElement();fresh.engineColorSamples.source=other.cicnSource;const foreign=await themeResourceChain(theme({}, {fresh}),[key]);assert.equal(foreign.getResource(key.type,key.id).value.sampleRgb16({x:0,y:0}),null);
}));
