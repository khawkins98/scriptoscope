import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {prepareDisplayProfile,realizeRgb16,DisplayProfileError,assertDisplayProfileChain} from './display-profile.js';
import {convertScheme} from './convert.js';import {loadKaleidoscopeScheme} from './loadKaleidoscopeScheme.js';import {validateTheme} from './validateTheme.js';
import {forkOf} from '../../tests/resource-provenance/fixtures.mjs';
import {solidBackgroundIcon,solidBackgroundInfo} from '../../tests/decoder-fixtures/solid-background.mjs';
import {colorIcon,colorInfo} from '../../tests/decoder-fixtures/control-colors.mjs';
import {syntheticDisplayProfile,profilePpat,profileClut} from '../../tests/decoder-fixtures/display-profile.mjs';
const fork=()=>forkOf([{type:'cicn',id:-10239,data:solidBackgroundIcon({collision:true,opaqueBackground:true})},{type:'cinf',id:-10239,data:solidBackgroundInfo()},{type:'ppat',id:77,data:profilePpat()},{type:'clut',id:-14336,data:profileClut()}]);
test('profile snapshots exact joint RGB16, low bits and producer stage into immutable content identity',async()=>{
 const data=syntheticDisplayProfile(),pending=prepareDisplayProfile(data);data.mappings[4].deviceRgb16[0]=0;const p=await pending;
 assert.deepEqual(realizeRgb16([0x2121,0x2121,0x2121],p),[90,100,110]);assert.deepEqual(realizeRgb16([0x2122,0x2121,0x2121],p),[120,130,140]);
 assert.deepEqual(realizeRgb16([0,0,65535],p),[7,9,11]);assert.deepEqual(realizeRgb16([0,0,0],p),[0,0,0]);
 assert.throws(()=>realizeRgb16([0x2121,0x2122,0x2121],p),e=>e.code==='MISSING_MAPPING');
 const same=syntheticDisplayProfile();same.mappings.reverse();same.devicePalette.reverse();assert.equal((await prepareDisplayProfile(same)).id,p.id);
 const different=syntheticDisplayProfile();different.producer.channels[0][90]=91;assert.notEqual((await prepareDisplayProfile(different)).id,p.id);
 assert.ok(Object.isFrozen(p.data.mappings[0].rgb16));assert.throws(()=>p.data.producer.channels[0][0]=99);
 for(const mutate of [d=>d.mappings.push(d.mappings[0]),d=>d.mappings[0].deviceIndex=99,d=>d.mappings[0].deviceRgb16=[1,2,3],d=>d.producer.channels[0].pop(),d=>d.conditions.bad=NaN]){const d=syntheticDisplayProfile();mutate(d);await assert.rejects(prepareDisplayProfile(d),DisplayProfileError);}
});
test('same mapper prepares ordinary pixels, independent samples, companion, ppat and header without a second transform',async()=>{
 const p=await prepareDisplayProfile(syntheticDisplayProfile()),out=convertScheme(fork(),{displayProfile:p});
 const face=Object.values(out.theme.chromeElements).find(e=>e.sourceCicnId===-10239),asset=out.assets.find(a=>a.path===face.asset);
 assert.equal(out.theme.displayProfile,p);assert.deepEqual([...asset.rgba.slice(0,4)],[7,9,11,255]);assert.deepEqual([...asset.rgba.slice((3*7+3)*4,(3*7+3)*4+4)],[20,30,40,255]);
 assert.deepEqual(face.colorSamples.background.displayRgb,[90,100,110]);assert.equal(face.colorSamples.displayPolicy,p.id);assert.equal(face.samplingEquivalence.status,'different');
 const companion=out.assets.find(a=>a.path===face.sampledBandAsset.asset);assert.deepEqual([...companion.rgba.slice((3*7+3)*4,(3*7+3)*4+4)],[90,100,110,255]);
 assert.deepEqual([...out.assets.find(a=>a.path.startsWith('ppats/')).rgba],[120,130,140,255]);assert.equal(out.theme.headerColors.active.frame,'#78828c');
 const wrong={...out.theme,displayProfile:undefined};assert.throws(()=>validateTheme(wrong));
 const malformed={...out.theme,chromeElements:{...out.theme.chromeElements,[Object.keys(out.theme.chromeElements)[0]]:{...face,colorSamples:{...face.colorSamples,displayPolicy:'display-profile:invented'}}}};assert.throws(()=>validateTheme(malformed));
 assert.throws(()=>convertScheme(fork(),{displayProfile:JSON.parse(JSON.stringify(p))}),DisplayProfileError);
});
test('missing mappings including hidden RGB abort the whole load before any encoder URL',async()=>{
 const data=syntheticDisplayProfile();data.mappings=data.mappings.filter(r=>r.rgb16[0]!==0x2122);const p=await prepareDisplayProfile(data);let encoded=0;
 await assert.rejects(loadKaleidoscopeScheme(fork(),{displayProfile:p,encodeAssets:true,assetUrlFactory:()=>{encoded++;return'never';}}),e=>e.code==='MISSING_MAPPING');assert.equal(encoded,0);
 const hidden=forkOf([{type:'cicn',id:-10239,data:colorIcon({entries:[[0,123,456,789]],pixels:Array(8).fill(0),mask:[0,0],origin:0})},{type:'cinf',id:-10239,data:colorInfo()}]);
 await assert.rejects(loadKaleidoscopeScheme(hidden,{displayProfile:p,encodeAssets:true,assetUrlFactory:()=>{encoded++;return'never';}}),e=>e.code==='MISSING_MAPPING');assert.equal(encoded,0);
 const legacy=await loadKaleidoscopeScheme(fork(),{encodeAssets:false});assert.equal(legacy.manifest.displayProfile,undefined);
 const custom=await loadKaleidoscopeScheme(fork(),{displayProfile:await prepareDisplayProfile(syntheticDisplayProfile()),encodeAssets:false});
 assert.throws(()=>assertDisplayProfileChain({manifest:custom.manifest,base:{manifest:legacy.manifest}},custom.manifest.displayProfile),e=>e.code==='PROFILE_MISMATCH');
});
test('measured finite profile prepares both complete themes and preserves every alpha and original byte identity',async()=>{
 const profile=await prepareDisplayProfile(JSON.parse(fs.readFileSync(new URL('../../tests/decoder-fixtures/measured-display-profile.json',import.meta.url))));
 for(const slug of ['windows-95','system7-nostalgia-silver']){
 const root=new URL(`../../themes/${slug}/`,import.meta.url),file=['scheme.sit','scheme.rsrc'].find(n=>fs.existsSync(new URL(n,root))),bytes=new Uint8Array(fs.readFileSync(new URL(file,root)));
 const a=await loadKaleidoscopeScheme(bytes,{encodeAssets:false,provenance:true}),b=await loadKaleidoscopeScheme(bytes,{encodeAssets:false,provenance:true,displayProfile:profile});
 assert.equal(a.assets.length,b.assets.length);assert.equal(a.byteProvenance.input.sha256,b.byteProvenance.input.sha256);assert.equal(a.byteProvenance.fork.sha256,b.byteProvenance.fork.sha256);
 for(let i=0;i<a.assets.length;i++){assert.equal(a.assets[i].path,b.assets[i].path);for(let j=3;j<a.assets[i].rgba.length;j+=4)assert.equal(a.assets[i].rgba[j],b.assets[i].rgba[j],`${slug}/${a.assets[i].path}/${j}`);}
 assert.equal(b.manifest.displayProfile,profile);assert.ok(b.assets.some((x,i)=>x.rgba.some((v,j)=>j%4!==3&&v!==a.assets[i].rgba[j])));
 }
});
