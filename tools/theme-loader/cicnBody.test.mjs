import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { decodeCicn } from './decoders/cicn.js';
import { convertChrome } from './convert.js';
import { loadKaleidoscopeScheme } from './loadKaleidoscopeScheme.js';
import { validateTheme } from './validateTheme.js';
import { forkOf } from '../../tests/resource-provenance/fixtures.mjs';
import { entries, inputs, faceInfo, literalCicn } from '../../tests/decoder-fixtures/mode5.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
const converted=records=>convertChrome(forkOf(records));
const body=t=>t.chromeElements['mode5-face'].cicnBody;
const midpoint=()=>{const b=inputs.colorBody.slice(),v=new DataView(b.buffer);v.setUint16(118,0x2121);return b;}; // table98 + header8 + entry1*8 + green4 =118

test('mode5 layout admission uses mono bounds but color pixel plane; unsafe layout/palette remains unsupported',()=>{
  assert.equal(sha(inputs.oneBitBody),'948cbba432af6b8f5765990a0eeec224580bd125ccb0b0ec13cab9d7831cd008');
  for(const bytes of [inputs.colorBody,inputs.oneBitBody]) assert.equal(decodeCicn(bytes).bodyCicnSource.status,'ready');
  for(const mutate of [b=>{const v=new DataView(b.buffer);v.setUint16(72,1);v.setUint16(76,21);},b=>{const v=new DataView(b.buffer);v.setUint16(58,1);v.setUint16(62,21);},b=>new DataView(b.buffer).setUint16(16,1)]) {
    const bytes=inputs.colorBody.slice();mutate(bytes);assert.equal(decodeCicn(bytes).bodyCicnSource.status,'unsupported');
  }
  const nil=Uint8Array.from([...inputs.colorBody.slice(0,90),...inputs.colorBody.slice(98)]);
  for(let i=68;i<78;i++)nil[i]=0;
  assert.equal(decodeCicn(nil).bodyCicnSource.reason,'unsupported-source-layout');
  const arbitrary=literalCicn({rows:['RG'],maskRows:['11'],depth:1,palette:['R','G']});
  assert.equal(decodeCicn(arbitrary).bodyCicnSource.reason,'unsupported-one-bit-palette');
  const missing=inputs.colorBody.slice();new DataView(missing.buffer).setUint16(106,9); // first ColorSpec.value; used zero now absent
  assert.equal(decodeCicn(missing).bodyCicnSource.reason,'missing-palette-index');
});

test('ordinary hidden midtone is transformed once then made opaque, only selected color bodies allocate',()=>{
  const records=entries();records[2].data=midpoint();
  const c=converted(records),binding=body(c.theme),ordinary=c.assets.find(a=>a.path==='cicns/cicn-51-mode5-body.png'),derived=c.assets.find(a=>a.path===binding.derivedPath);
  assert.deepEqual(Array.from(ordinary.rgba.slice(4,8)),[0,48,0,0]);
  assert.deepEqual(Array.from(derived.rgba.slice(4,8)),[0,48,0,255]);
  assert.equal(c.assets.length,3);assert(Object.isFrozen(binding)&&Object.isFrozen(binding.sourceRect));
  assert.equal(converted(entries('indexed1')).assets.length,2);
  const noMode=entries();noMode[1].data=faceInfo();noMode[1].data[3]=0;
  const none=converted(noMode);assert.equal(none.assets.length,2);assert(!('cicnBody' in none.theme.chromeElements['mode5-face']));
});

test('all supported indexed depths preserve ordinary RGB for referenced unmasked bodies',()=>{
  for(const depth of [2,4,8]){
    const records=entries();records[2].data=literalCicn({rows:['RG'.repeat(10),'GR'.repeat(10)],maskRows:['0'.repeat(20),'0'.repeat(20)],depth,palette:['R','G']});
    const c=converted(records),b=body(c.theme),asset=c.assets.find(a=>a.path===b.derivedPath);
    assert.equal(b.pixelSize,depth);assert.equal(b.copy,'unmasked');assert.equal(asset.rgba.filter((v,i)=>i%4===3&&v===255).length,40);
    assert.deepEqual(Array.from(asset.rgba.slice(0,8)),[255,0,0,255,0,255,0,255]);
  }
});

test('raw resource absence is distinct from skipped/error/duplicate signed IDs and +/- selection',()=>{
  assert.equal(body(converted(entries('missing')).theme).status,'missing');
  for(const data of [Uint8Array.of(0),(()=>{const b=inputs.colorBody.slice();new DataView(b.buffer).setUint16(102,0x4000);return b;})()]){
    const r=entries();r[2].data=data;const c=converted(r);assert.equal(body(c.theme).status,'unsupported');assert.equal(body(c.theme).reason,'resource-decoding-unavailable');assert(!c.assets.some(a=>a.path.startsWith('cicn-body/')));
  }
  for(const duplicate of [{type:'cicn',id:51,name:'other',data:inputs.colorBody},{type:'cicn',id:51,name:'mode5-body',data:inputs.colorBody}]){
    const c=converted([...entries(),duplicate]);assert.equal(body(c.theme).status,'ambiguous');assert(!c.assets.some(a=>a.path.startsWith('cicn-body/')));
  }
  const r=entries();r[2].id=-51;assert.equal(body(converted(r).theme).status,'missing');
  assert.equal(body(converted(entries('color8',0)).theme).requestedId,0);
});

test('encoded links preserve immutable paths and own payload occurrence, shared references allocate once',async()=>{
  const r=entries();r[2].data=midpoint();r.push({type:'cicn',id:-10238,name:'other-face',data:inputs.face},{type:'cinf',id:-10238,data:faceInfo()});
  const paths=[];const t=await loadKaleidoscopeScheme(forkOf(r),{provenance:true,encodeAssets:true,assetUrlFactory:async(rgba,w,h,path)=>{paths.push(path);return `data:fixture,${encodeURIComponent(path)}`;}});
  try{
    const b=body(t.manifest);assert.equal(paths.filter(p=>p.startsWith('cicn-body/')).length,1);assert.equal(b.derivedPath,'cicn-body/cicn-51-mode5-body.png');assert(b.asset.startsWith('data:'));
    assert.equal(t.manifest.chromeElements['other-face'].cicnBody.asset,b.asset);assert(Object.isFrozen(b)&&Object.isFrozen(b.sourceRect));
    const ref=t.manifest.chromeElements[b.manifestKey].byteProvenance;assert.equal(ref.cicnResourceIndex,2);assert.equal(ref.loadId,t.byteProvenance.loadId);assert.equal(t.byteProvenance.resources[2].sha256,sha(midpoint()));assert.equal(t.byteProvenance.resources.length,5);
  }finally{t.dispose();}
});

test('parallel body owners do not share derived URLs, references or payload identity',async()=>{
  const fork=bytes=>{const r=entries();r[2].data=bytes;return forkOf(r);};let serial=0;
  const themes=await Promise.all([inputs.colorBody,midpoint()].map(b=>loadKaleidoscopeScheme(fork(b),{provenance:true,encodeAssets:true,assetUrlFactory:async()=>`data:owned,${++serial}`})));
  try{assert.notEqual(body(themes[0].manifest).asset,body(themes[1].manifest).asset);assert.notEqual(themes[0].byteProvenance.loadId,themes[1].byteProvenance.loadId);assert.notEqual(themes[0].byteProvenance.resources[2].sha256,themes[1].byteProvenance.resources[2].sha256);}finally{themes.forEach(t=>t.dispose());}
});

test('derived URL cleanup includes late worker success and ordinary disposal',async()=>{
  const revoke=URL.revokeObjectURL,revoked=[];URL.revokeObjectURL=url=>revoked.push(url);
  try{
    await assert.rejects(loadKaleidoscopeScheme(forkOf(entries()),{encodeAssets:true,assetUrlFactory:async(_rgba,_w,_h,path)=>{
      if(path.startsWith('cicn-body/')){await new Promise(r=>setTimeout(r,5));return 'blob:body-late';}throw Error('intentional encoding failure');
    }}),/intentional encoding failure/);assert.deepEqual(revoked,['blob:body-late']);
    const t=await loadKaleidoscopeScheme(forkOf(entries()),{encodeAssets:true,assetUrlFactory:async(_r,_w,_h,p)=>`blob:${p}`});t.dispose();t.dispose();assert.equal(revoked.filter(p=>p.startsWith('blob:cicn-body/')).length,1);
  }finally{URL.revokeObjectURL=revoke;}
});

test('validator rejects wrong request/target/type/size/asset and selected metadata on missing bindings',()=>{
  const base=converted(entries()).theme;
  for(const mutate of [b=>b.requestedId=-51,b=>b.manifestKey='mode5-face',b=>b.copy='masked',b=>b.sourceRect.w=19,b=>b.derivedPath='cicns/not-derived.png',b=>b.status='missing']){
    const t=structuredClone(base);mutate(body(t));assert.throws(()=>validateTheme(t),/cicn body/);
  }
});
