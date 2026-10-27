import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import * as baseline from './artifacts/baseline/scriptoscope.js';
import * as root from './artifacts/boundary/scriptoscope.js';
import * as core from './artifacts/boundary/renderer.js';
const error = async fn => { try { await fn(); return null; } catch(e) { return { name:e.name, code:e.code, message:e.message }; } };
assert.deepEqual(Object.keys(root),Object.keys(baseline));
for(const name of Object.keys(core)) assert.equal(core[name],root[name],name);
const callableChanges=[];
for(const name of Object.keys(root)) if(typeof root[name]==='function') { assert.equal(root[name].length,baseline[name].length,name);assert.deepEqual(root[name].prototype?Object.getOwnPropertyNames(root[name].prototype):null,baseline[name].prototype?Object.getOwnPropertyNames(baseline[name].prototype):null,name);if(root[name].name!==baseline[name].name)callableChanges.push(name); }
const bytes=new Uint8Array(286), v=new DataView(bytes.buffer);
v.setUint32(0,256);v.setUint32(4,256);v.setUint32(12,30);bytes.set(bytes.slice(0,16),256);v.setUint16(280,28);v.setUint16(282,30);v.setInt16(284,-1);
const producer={model:'rgb16-high-byte-table',channels:Array.from({length:3},()=>Array.from({length:256},(_,i)=>i))};
const profileData={version:1,conditions:{purpose:'authored interop'},evidence:[{sha256:'0'.repeat(64),description:'caller authored'}],devicePalette:[{index:0,rgb16:[0,0,0]}],mappings:[{rgb16:[0,0,0],deviceIndex:0,deviceRgb16:[0,0,0]}],producer};
const environmentData={version:1,complete:true,providers:[{kind:'theme-fork',id:'authored',complete:true}]};
const prepared=[];
for(const [producerApi,consumerApi]of [[core,root],[root,core]]) {
 const profile=await producerApi.prepareDisplayProfile(profileData), environment=await producerApi.prepareCinfEnvironment(environmentData);
 const owned=await root.loadOwnedKaleidoscopeScheme(bytes,{displayProfile:profile,cinfEnvironment:environment});
 assert.equal(owned.source.manifest.displayProfile,profile);
 assert.equal(await consumerApi.composeButton(owned),null);
 const pixel=new producerApi.PixelBuffer(2,2);assert(pixel instanceof core.PixelBuffer);assert(pixel instanceof root.PixelBuffer);
 assert.deepEqual(await error(()=>root.composeProgress(owned,{length:60})),await error(()=>core.composeProgress(owned,{length:60}))); 
 owned.dispose();const disposed=await error(()=>consumerApi.composeProgress(owned,{length:60}));assert.deepEqual(disposed,{name:'AbortError',code:20,message:'Raster owner disposed'});
 prepared.push({profile:profile.id,environment:environment.id,disposed});
}
const errors=[];
for(const name of ['prepareDisplayProfile','prepareCinfEnvironment','prepareCicnTransferResults']) { const before=await error(()=>baseline[name]({})),after=await error(()=>root[name]({}));assert.deepEqual(after,before);errors.push({name,...after}); }
const metadata=[];
for(const api of [baseline,root,core]){const events=[];const theme={get baseUrl(){events.push('baseUrl');return 'origin'},manifest:{get chromeElements(){events.push('chromeElements');return {x:{get asset(){events.push('asset');return 'ref'}}}}}};assert.equal(api.assetUrl(theme,'ref'),'origin/ref');assert.equal(api.assetUrl(theme,'data:opaque'),'data:opaque');assert(api.findChromeElement(theme,'ref'));metadata.push(events);}
assert.deepEqual(metadata[0],metadata[1]);assert.deepEqual(metadata[0],metadata[2]);
const results={rootExports:Object.keys(root).length,coreAliases:Object.keys(core).length,keysArityPrototypePreserved:true,minifiedCallableNamesChanged:callableChanges,prepared,errors,metadata};
await writeFile(new URL('./artifacts/interop.json',import.meta.url),JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
