import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {decodeCicn} from './decoders/cicn.js';
import {loadKaleidoscopeScheme} from './loadKaleidoscopeScheme.js';
import {validateTheme} from './validateTheme.js';
import {forkOf} from '../../tests/resource-provenance/fixtures.mjs';
import {sampledBandIcon} from '../../tests/decoder-fixtures/sampled-bands.mjs';
import {colorIcon} from '../../tests/decoder-fixtures/control-colors.mjs';
const entry=(data=sampledBandIcon(),name='same')=>({type:'cicn',id:-10239,name,data});
const load=(entries,opts={})=>loadKaleidoscopeScheme(forkOf(entries),{encodeAssets:false,...opts});
const at=(rgba,x,y)=>[...rgba.slice((y*7+x)*4,(y*7+x)*4+4)];

test('complete safe sampling creates raw high-byte companion, retaining mask and ordinary pixels',()=>{
  const result=decodeCicn(sampledBandIcon());
  assert.equal(result.samplingEquivalence.status,'different');
  assert.deepEqual(at(result.rgba,3,0),[255,0,0,255]);
  assert.deepEqual(at(result.sampledBandRgba,3,0),[33,33,33,255]);
  assert.deepEqual(at(result.sampledBandRgba,1,1),[0,0,0,0]);
  for(let i=3;i<result.rgba.length;i+=4)assert.equal(result.rgba[i],result.sampledBandRgba[i]);
  const late=decodeCicn(sampledBandIcon({unsafeLast:true}));
  assert.equal(late.samplingEquivalence.status,'different'); // early mismatch is NOT complete safety
  assert.equal(late.sampledBandRgba,null);
  assert.equal(decodeCicn(sampledBandIcon({transparent:true})).sampledBandRgba,null);
  assert.equal(decodeCicn(colorIcon({origin:0})).sampledBandRgba,null);
});

test('same occurrence binds raw/encoded companion and stable path; LUT applied exactly once',async()=>{
  for(const encodeAssets of [false,true]){
    const encoded=[];
    const loaded=await load([entry()],{provenance:true,encodeAssets,assetUrlFactory:(rgba,w,h,path)=>{
      encoded.push({path,rgba:[...rgba]});return `opaque:${path}`;
    }});
    const e=loaded.manifest.chromeElements.same, companion=e.sampledBandAsset;
    assert(Object.isFrozen(companion));
    assert.equal(companion.derivedPath,'cicn-sampled/cicn-n10239-same.png');
    assert.equal(companion.asset,`${encodeAssets?'opaque:':''}${companion.derivedPath}`);
    assert.equal(e.asset,`${encodeAssets?'opaque:':''}cicns/cicn-n10239-same.png`);
    assert.equal(e.byteProvenance.loadId,loaded.byteProvenance.loadId);
    assert.equal(e.byteProvenance.cicnResourceIndex,0);
    assert.equal(loaded.byteProvenance.resources.length,1); // derived asset is not a new original resource
    assert.equal(loaded.byteProvenance.resources[0].sha256,createHash('sha256').update(sampledBandIcon()).digest('hex'));
    const assets=encodeAssets?encoded:loaded.assets;
    assert.deepEqual(at(assets.find(a=>a.path===companion.derivedPath).rgba,3,0),[48,48,48,255]);
    assert.deepEqual(at(assets.find(a=>a.path.startsWith('cicns/')).rgba,3,0),[255,0,0,255]);
    validateTheme(loaded.manifest);
  }
});

test('concurrent same-key/ID loads retain their own companion decision and source identity',async()=>{
  const inputs=[sampledBandIcon(),sampledBandIcon({unsafeLast:true}),sampledBandIcon({transparent:true})];
  const loaded=await Promise.all(inputs.map(data=>load([entry(data)],{provenance:true})));
  assert.equal(new Set(loaded.map(t=>t.byteProvenance.loadId)).size,3);
  for(const [i,t] of loaded.entries()){
    const e=t.manifest.chromeElements.same;
    assert.equal(!!e.sampledBandAsset,i===0);
    assert.equal(t.assets.length,i===0?2:1);
    assert.equal(e.byteProvenance.loadId,t.byteProvenance.loadId);
    assert.equal(t.byteProvenance.resources[0].sha256,createHash('sha256').update(inputs[i]).digest('hex'));
  }
});

test('duplicate ordinary paths discard unreferenced companions before allocation; observed loads reject',async()=>{
  const resources=[entry(),entry()];let paths=[];
  const theme=await load(resources,{encodeAssets:true,assetUrlFactory:(_p,_w,_h,path)=>{paths.push(path);return`opaque:${path}`;}});
  assert(Object.values(theme.manifest.chromeElements).every(e=>!e.sampledBandAsset));
  assert.equal(paths.filter(p=>p.startsWith('cicn-sampled/')).length,0);
  paths=[];
  await assert.rejects(load(resources,{provenance:true,encodeAssets:true,assetUrlFactory:()=>{paths.push('allocated');return'bad';}}),/duplicate cicn asset binding/);
  assert.deepEqual(paths,[]);
});

test('derived URLs follow normal late encoder failure and idempotent disposal ownership',async()=>{
  const revoke=URL.revokeObjectURL, revoked=[];URL.revokeObjectURL=url=>revoked.push(url);
  try {
    await assert.rejects(load([entry()],{encodeAssets:true,assetUrlFactory:async(_p,_w,_h,path)=>{
      if(path.startsWith('cicns/'))throw new Error('ordinary failed');
      await new Promise(resolve=>setTimeout(resolve,5));return'blob:late-companion';
    }}),/ordinary failed/);
    assert.deepEqual(revoked,['blob:late-companion']);
    const t=await load([entry()],{encodeAssets:true,assetUrlFactory:(_p,_w,_h,path)=>`blob:${path}`});
    t.dispose();t.dispose();
    assert.deepEqual(revoked,['blob:late-companion','blob:cicns/cicn-n10239-same.png','blob:cicn-sampled/cicn-n10239-same.png']);
  }finally{URL.revokeObjectURL=revoke;}
});

test('companion model/path/dimensions are structurally checked, not authenticated caller metadata',async()=>{
  const t=(await load([entry()])).manifest;
  for(const [key,value]of [['model','forged'],['comparison','rgb16'],['displayPolicy','device'],['width',8],['asset',''],['derivedPath','../cicns/other.png']]){
    const bad=structuredClone(t);bad.chromeElements.same.sampledBandAsset[key]=value;
    assert.throws(()=>validateTheme(bad),/sampled band/);
  }
});
